// ==UserScript==
// @name         Leitstellenspiel Erweiterungsanzeige & Schnellbau
// @namespace    leitstellenspiel-scripts
// @version      4.1.0
// @description  Fügt eine zusätzliche, schnelle & interaktive Übersicht der Erweiterungen auf der Hauptseite der Wache ein.
// @author       B&M
// @match        https://*.leitstellenspiel.de/buildings/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const SCRIPT_PREFIX = '[Erweiterungs-UI Standalone v10.1]';
    const PRESET_STORAGE_KEY = 'extension_builder_global_preset_v1';
    function log(message) { console.log(`${SCRIPT_PREFIX} ${message}`); }
    function error(message) { console.error(`${SCRIPT_PREFIX} ${message}`); }
    log("Skript wird geladen...");

    // #region KONFIGURATION & DATEN
    const STORAGE_KEY = 'extension_builder_presets_final_v2';
    const SELECTED_OUTLINE_COLOR = '#FFA500';

    const CONCURRENT_BUILDS = 10;
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 300;
    const HOTKEY_BUILD_KEY = 'f';

    const RELOAD_DELAY_MS = 2000; // 2 Sekunden Wartezeit vor dem Neuladen
    let activeToggleRequests = 0;
    let reloadTimer = null;

    const icons = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
        building: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>`,
        not_built: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
        danger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`
    };

    // NEU: Ein Array, das alle aktiven Timer-Elemente speichert.
    const activeTimers = [];
    // #endregion

    // #region Hilfsfunktionen & Aktionen
    function getCSRFToken() { return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''; }
    function getBuildingInfo() {
        const h1 = document.querySelector("h1[building_type]");
        if (!h1) return null;
        const buildingId = window.location.pathname.split("/")[2];
        return { buildingId };
    }
    function loadSelections() { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    function saveSelection(buildingId, selectedIds) {
        const selections = loadSelections();
        selections[buildingId] = selectedIds;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
    }
    async function toggleExtensionReadiness(buildingId, extensionId, element) {
    // NEU: Wenn ein Element übergeben wird, markieren wir es als "in Bearbeitung".
    if (element) {
        element.dataset.processing = 'true';
        element.style.opacity = '0.5';
        element.style.cursor = 'wait';
        const span = element.querySelector('span');
        if (span) span.textContent = 'Schalte um...';
    }

    // Laufenden Reload-Timer immer abbrechen, wenn eine neue Aktion startet.
    clearTimeout(reloadTimer);

    // Zähler für aktive Anfragen erhöhen.
    activeToggleRequests++;
    log(`Neue Umschalt-Anfrage. Aktive Anfragen: ${activeToggleRequests}`);

    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        error("CSRF-Token nicht gefunden!");
        activeToggleRequests--; // Zähler wieder verringern, da die Anfrage fehlschlägt.
        // NEU: Sperre im Fehlerfall aufheben, falls die Seite nicht neu lädt
        if (element) {
            delete element.dataset.processing;
            element.style.opacity = '1';
            element.style.cursor = 'pointer';
        }
        return;
    }

    try {
        const response = await fetch(`/buildings/${buildingId}/extension_ready/${extensionId}/${buildingId}`, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
        if (!response.ok) throw new Error(`Server-Fehler: ${response.status}`);
        log(`Anfrage für Erw. ${extensionId} erfolgreich abgeschlossen.`);
    } catch (err) {
        error(`Fehler bei Anfrage für Erw. ${extensionId}: ${err.message}`);
    } finally {
        // Zähler verringern, da diese Anfrage (erfolgreich oder nicht) beendet ist.
        activeToggleRequests--;
        log(`Eine Anfrage beendet. Verbleibende aktive Anfragen: ${activeToggleRequests}`);

        // NUR wenn dies die letzte offene Anfrage war, den finalen Reload-Timer starten.
        if (activeToggleRequests === 0) {
            log("Alle Anfragen abgeschlossen. Starte finalen Reload-Timer...");
            reloadTimer = setTimeout(() => location.reload(), RELOAD_DELAY_MS);
        }
    }
}
    async function handleBuildButtonClick(buildingId) {
        if (!buildingId) return;
        const buildBtn = document.getElementById('build-extensions-btn');
        if (!buildBtn || buildBtn.disabled) return;
        const statusSpan = document.getElementById('build-status');
        const queue = Array.from(document.querySelectorAll('.detail-item.extension-selected, .gemini-expansion-card.extension-selected'));
        if (queue.length === 0) {
            alert("Bitte wähle zuerst mindestens eine Erweiterung aus.");
            return;
        }
        buildBtn.disabled = true;
        let processedCount = 0;
        let errorCount = 0;
        const totalToBuild = queue.length;
        statusSpan.textContent = `Starte Bau von ${totalToBuild} Erweiterungen...`;
        const csrfToken = getCSRFToken();
        if (!csrfToken) { statusSpan.textContent = "Fehler: CSRF-Token nicht gefunden."; buildBtn.disabled = false; return; }
        const worker = async () => {
            while (queue.length > 0) {
                const element = queue.shift();
                if (!element) continue;
                processedCount++;
                const extensionId = element.dataset.extensionId;
                const name = element.dataset.name || `ID ${extensionId}`;
                statusSpan.textContent = `[${processedCount}/${totalToBuild}] Baue: ${name}...`;
                if (!await buildExtension(buildingId, extensionId, csrfToken)) errorCount++;
            }
        };
        const workers = Array(CONCURRENT_BUILDS).fill(null).map(worker);
        await Promise.all(workers);
        statusSpan.textContent = `Alle ${totalToBuild} Aufträge abgearbeitet. ${errorCount > 0 ? `${errorCount} Fehler.` : 'Alle erfolgreich!'} Lade Seite neu...`;
        setTimeout(() => location.reload(), 2500);
    }
    async function buildExtension(buildingId, extensionId, csrfToken) {
        let attempts = 0;
        const buildUrl = `/buildings/${buildingId}/extension/credits/${extensionId}?redirect_building_id=${buildingId}`;
        const formData = new FormData();
        formData.append('authenticity_token', csrfToken);
        formData.append('_method', 'post');
        while (attempts <= MAX_RETRIES) {
            attempts++;
            try {
                const response = await fetch(buildUrl, { method: 'POST', body: formData });
                if (response.ok || response.status === 302 || response.redirected) {
                     log(`[${extensionId}] Erfolgreich gebaut.`);
                     return true;
                }
                if (response.status === 409 && attempts <= MAX_RETRIES) {
                    log(`[${extensionId}] Konflikt (409). Versuch ${attempts}/${MAX_RETRIES}...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                } else {
                    error(`[${extensionId}] Nicht behebbarer Fehler: Status ${response.status}`);
                    return false;
                }
            } catch (err) {
                error(`[${extensionId}] Netzwerkfehler: ${err.message}`);
                if (attempts <= MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }
        error(`[${extensionId}] Bau nach ${MAX_RETRIES} Versuchen fehlgeschlagen.`);
        return false;
    }
    // #endregion

    // #region Haupt-Initialisierung und UI-Logik
    function initialize() {
        const buildingInfo = getBuildingInfo();
        if (!buildingInfo) return;
        const allItems = gatherExtensionData();
        if (allItems.length === 0) {
            log("Keine Erweiterungen zum Anzeigen gefunden.");
            return;
        }
        const aggregatedExpansions = allItems.reduce((acc, item) => {
            if (!acc[item.name]) acc[item.name] = { items: [] };
            acc[item.name].items.push(item);
            return acc;
        }, {});
        injectCustomCss();
        setupHotkeyListener();
        createInteractiveUI(buildingInfo, aggregatedExpansions);
        // NEU: Startet den globalen Timer, nachdem die UI erstellt wurde.
        startGlobalTimer();
    }

    function gatherExtensionData() {
    log("Sammle Erweiterungsdaten direkt aus der Standard-Tabelle...");
    const allItems = [];
    // Ein temporärer Zähler für die Platzhalter-IDs
    let tempIdCounter = 9000;

    const expansionRows = document.querySelectorAll('#ausbauten tbody tr');

    expansionRows.forEach(row => {
        const name = row.querySelector('b')?.textContent.trim();
        if (!name) return;

        const item = { name, status: 'unknown', text: '', extensionId: -1 };

        const buildLink = row.querySelector('a[href*="/extension/credits/"]');
        const statusLabel = row.querySelector('span.label');
        const readyToggleLink = row.querySelector('a[href*="/extension_ready/"]');
        const timerSpan = row.querySelector('span[data-end-time]');

        if (buildLink) {
            item.status = 'not_built';
            item.text = 'Nicht gebaut';
            item.extensionId = parseInt(buildLink.getAttribute('href').match(/\/extension\/credits\/(\d+)/)?.[1] || '-1', 10);
        } else if (timerSpan) {
            item.status = 'building';
            item.text = `Fertig in: ${timerSpan.textContent}`;
            item.endTime = Math.floor(parseInt(timerSpan.dataset.endTime, 10) / 1000);

            let idSourceLink = row.querySelector('a[href*="/extension_finish/"]') || row.querySelector('a[href*="/extension_cancel/"]');

            if (idSourceLink) {
                const href = idSourceLink.getAttribute('href');
                const match = href.match(/\/(?:extension_finish|extension_cancel)\/(\d+)/);
                item.extensionId = match ? parseInt(match[1], 10) : -1;
            } else {
                // NEUE KORREKTUR: Wenn keine Links gefunden werden (für Items #2, #3... in der Queue),
                // weise eine temporäre ID zu, damit der Eintrag nicht verworfen wird.
                item.extensionId = tempIdCounter++;
            }

        } else if (statusLabel) {
            const isEnabled = statusLabel.classList.contains('label-success');
            item.status = isEnabled ? 'success' : 'danger';
            item.text = isEnabled ? 'Einsatzbereit' : 'Nicht einsatzbereit';
            item.extensionId = parseInt(readyToggleLink?.getAttribute('href').match(/extension_ready\/(\d+)/)?.[1] || '-1', 10);
        }

        if (item.extensionId !== -1) {
            allItems.push(item);
        }
    });
    return allItems;
}

    function createInteractiveUI(buildingInfo, aggregatedExpansions) {
    const dlWrapper = document.createElement('div');
    dlWrapper.classList.add('row');
    const existingDl = document.querySelector('dl.dl-horizontal');
    if (!existingDl) return;
    existingDl.classList.add('col-md-4');
    existingDl.before(dlWrapper);
    dlWrapper.append(existingDl);
    const mainContainer = document.createElement('div');
    mainContainer.classList.add('col-md-8');
    dlWrapper.append(mainContainer);
    const expansionContainer = document.createElement('div');
    expansionContainer.id = 'gemini-expansion-container';
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'extension-builder-button-container';
    buttonContainer.style.marginTop = '15px';
    // KORREKTUR: Die Vorlagen-Buttons sind hier korrekterweise schon entfernt.
    buttonContainer.innerHTML = `<button id="build-extensions-btn" class="btn btn-primary"><span class="glyphicon glyphicon-wrench"></span> Ausgewählte bauen (F)</button><div id="build-status" style="margin-top: 10px; font-weight: bold;"></div>`;

    Object.entries(aggregatedExpansions).forEach(([name, data]) => {
        const card = document.createElement('div');
        card.classList.add('gemini-expansion-card');
        const successCount = data.items.filter(i => i.status === 'success').length;
        const primaryStatus = ['danger', 'building', 'success'].find(s => data.items.some(i => i.status === s)) || 'not_built';
        card.classList.add(`status-${primaryStatus}`);
        let displayName = name;
        if (data.items.length > 1) displayName += ` (${successCount}/${data.items.length})`;
        const mainLine = document.createElement('div');
        mainLine.classList.add('card-main-line');
        mainLine.innerHTML = `<div class="icon">${icons[primaryStatus]}</div><div class="name">${displayName}</div>`;
        card.appendChild(mainLine);
        if (data.items.length > 1) {
            card.dataset.expandable = "true";
            const detailsLine = document.createElement('div');
            detailsLine.classList.add('card-details-line');
            data.items.forEach(item => {
                const detailItem = document.createElement('div');
                detailItem.classList.add('detail-item', `status-${item.status}`);
                detailItem.innerHTML = `<div class="icon">${icons[item.status]}</div><span>${item.text}</span>`;
                detailItem.dataset.extensionId = item.extensionId;
                detailItem.dataset.status = item.status;
                detailItem.dataset.name = item.name;
                if (item.status !== 'building') detailItem.dataset.clickable = "true";
                if (item.status === 'building' && item.endTime) {
                     activeTimers.push({ element: detailItem, endTime: item.endTime });
                }
                detailsLine.appendChild(detailItem);
            });
            card.appendChild(detailsLine);
            mainLine.addEventListener('click', () => card.classList.toggle('expanded'));
            detailsLine.addEventListener('click', e => {
                const target = e.target.closest('.detail-item');
                // NEU: Ignoriere Klicks, wenn das Element bereits in Bearbeitung ist.
                if (!target || !target.dataset.clickable || target.dataset.processing === 'true') return;

                if (target.dataset.status === 'not_built') {
                    target.classList.toggle('extension-selected');
                    updateAndSaveSelectionState(buildingInfo.buildingId);
                } else if (['success', 'danger'].includes(target.dataset.status)) {
                    // NEU: Das angeklickte Element wird an die Funktion übergeben.
                    toggleExtensionReadiness(buildingInfo.buildingId, target.dataset.extensionId, target);
                }
            });
        } else if (data.items.length === 1) {
            const item = data.items[0];
            card.dataset.extensionId = item.extensionId;
            card.dataset.name = item.name;
            card.dataset.status = item.status;
            if (item.status === 'building') {
                card.dataset.expandable = "true";
                const detailsLine = document.createElement('div');
                detailsLine.classList.add('card-details-line');
                const detailItem = document.createElement('div');
                detailItem.classList.add('detail-item', `status-${item.status}`);
                detailItem.innerHTML = `<span>${item.text}</span>`;
                if (item.endTime) {
                    activeTimers.push({ element: detailItem, endTime: item.endTime });
                }
                detailsLine.appendChild(detailItem);
                card.appendChild(detailsLine);
                mainLine.addEventListener('click', () => card.classList.toggle('expanded'));
            } else {
                const detailItem = document.createElement('div');
                detailItem.classList.add('detail-item', `status-${item.status}`);
                detailItem.innerHTML = `<span>${item.text}</span>`;
                mainLine.appendChild(detailItem);
                card.dataset.clickable = "true";
                card.style.cursor = "pointer";
                card.addEventListener('click', () => {
                    // NEU: Ignoriere Klicks, wenn die Karte bereits in Bearbeitung ist.
                    if (card.dataset.processing === 'true') return;

                    if (item.status === 'not_built') {
                        card.classList.toggle('extension-selected');
                        updateAndSaveSelectionState(buildingInfo.buildingId);
                    } else if (['success', 'danger'].includes(item.status)) {
                        // NEU: Die Karte (das angeklickte Element) wird an die Funktion übergeben.
                        toggleExtensionReadiness(buildingInfo.buildingId, item.extensionId, card);
                    }
                });
            }
        }
        expansionContainer.appendChild(card);
    });
    mainContainer.appendChild(expansionContainer);
    mainContainer.appendChild(buttonContainer);
    buttonContainer.querySelector('#build-extensions-btn').addEventListener('click', () => handleBuildButtonClick(buildingInfo.buildingId));

    // KORREKTUR: Die überflüssigen Event-Listener für die entfernten Buttons wurden hier gelöscht.

    // Automatische Anwendung der Vorlage ODER Laden der wachenspezifischen Auswahl
    const presetNames = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '[]');
    if (presetNames.length > 0) {
        log(`Globale Vorlage mit ${presetNames.length} Erweiterungen gefunden. Wende an...`);
        document.querySelectorAll('.gemini-expansion-card[data-name], .detail-item[data-name]').forEach(item => {
            if (item.dataset.status === 'not_built' && presetNames.includes(item.dataset.name)) {
                item.classList.add('extension-selected');
            }
        });
        updateAndSaveSelectionState(buildingInfo.buildingId);
    } else {
        const savedSelection = loadSelections()[buildingInfo.buildingId] || [];
        if (savedSelection.length > 0) log(`Keine globale Vorlage, lade wachenspezifische Auswahl.`);
        document.querySelectorAll('.gemini-expansion-card, .detail-item').forEach(item => {
            const id = parseInt(item.dataset.extensionId, 10);
            if (item.dataset.status === 'not_built' && savedSelection.includes(id)) {
                item.classList.add('extension-selected');
            }
        });
    }
}

    function injectCustomCss() {
    const css = `
        /* ============================================= */
        /* == ALLGEMEINE STILE (für beide Modi gültig) == */
        /* ============================================= */
        #gemini-expansion-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; align-items: start; }
        .gemini-expansion-card { padding: 12px 15px; border-radius: 8px; border: 1px solid transparent; transition: all 0.2s ease-in-out; }
        .card-main-line { display: flex; align-items: center; font-size: 1.1em; font-weight: bold; }
        .card-main-line .icon { margin-right: 12px; flex-shrink: 0; }
        .card-main-line .name { flex-grow: 1; margin-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-main-line .detail-item { flex-shrink: 0; }
        .card-details-line { display: flex; flex-wrap: wrap; gap: 6px; overflow: hidden; max-height: 0; margin-top: 0; transition: max-height 0.5s ease-in-out, margin-top 0.5s ease-in-out; }
        .detail-item { display: inline-flex; align-items: center; padding: 3px 7px; border-radius: 4px; font-size: 0.9em; transition: all 0.2s ease-in-out; }
        .detail-item[data-clickable="true"] { cursor: pointer; }
        .gemini-expansion-card[data-expandable="true"] > .card-main-line { cursor: pointer; }
        .gemini-expansion-card.expanded .card-details-line { max-height: 200px; margin-top: 12px; }
        .gemini-expansion-card.extension-selected, .detail-item.extension-selected { outline: 2px solid ${SELECTED_OUTLINE_COLOR} !important; outline-offset: 1px; }
        .status-success { color: #5cb85c; } .status-building { color: #f0ad4e; } .status-danger { color: #d9534f; }
        #build-extensions-btn { font-weight: bold; color: white; border: none; border-radius: 8px; padding: 10px 18px; background: linear-gradient(120deg, #ff8c00, #ffa500, #ffbf00, #ffd700); background-size: 250% 100%; box-shadow: 0 4px 15px 0 rgba(255, 165, 0, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.25); cursor: pointer; transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); position: relative; overflow: hidden; }
        #build-extensions-btn:before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%); transform: rotate(45deg); opacity: 0; transition: opacity 0.5s ease; }
        #build-extensions-btn:hover { background-position: 100% 0; box-shadow: 0 8px 20px 0 rgba(255, 165, 0, 0.55); transform: translateY(-2px); }
        #build-extensions-btn:hover:before { opacity: 1; }
        #build-extensions-btn:active { transform: translateY(1px); box-shadow: 0 2px 8px 0 rgba(255, 165, 0, 0.4); transition-duration: 0.1s; }
        #build-extensions-btn:disabled { background: #555; box-shadow: none; cursor: not-allowed; filter: grayscale(80%); }

        /* ================================= */
        /* == DARK MODE STILE              == */
        /* ================================= */
        .dark .gemini-expansion-card { background-color: #333; border-color: #555; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .dark .gemini-expansion-card:hover { transform: translateY(-3px); box-shadow: 0 5px 10px rgba(0,0,0,0.4); border-color: #777; }
        .dark .detail-item { background-color: #444; }
        .dark .detail-item[data-clickable="true"]:hover { background-color: #555; }
        .dark .gemini-expansion-card.extension-selected, .dark .detail-item.extension-selected { background-color: #5a4d3c; }
        .dark .status-not_built { color: #999; }

        /* ================================= */
        /* == LIGHT MODE STILE             == */
        /* ================================= */
        .light .gemini-expansion-card { background-color: #ffffff; border-color: #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .light .gemini-expansion-card:hover { transform: translateY(-3px); box-shadow: 0 5px 10px rgba(0,0,0,0.15); border-color: #bbb; }
        .light .detail-item { background-color: #f0f0f0; }
        .light .detail-item[data-clickable="true"]:hover { background-color: #e0e0e0; }
        .light .gemini-expansion-card.extension-selected, .light .detail-item.extension-selected { background-color: #fff4e0; }
        .light .status-not_built { color: #666; }
        .light #build-extensions-btn:disabled { color: #777; background: #ccc; filter: grayscale(50%); }
    `;
    document.head.appendChild(document.createElement('style')).innerHTML = css;
}
    function updateAndSaveSelectionState(buildingId) {
        if (!buildingId) return;
        const selectedItems = Array.from(document.querySelectorAll('.extension-selected[data-extension-id]'));

        // Speichert die IDs für die aktuelle Wache (wie bisher)
        const selectedIds = selectedItems.map(el => parseInt(el.dataset.extensionId, 10));
        saveSelection(buildingId, selectedIds);

        // NEU: Speichert die Namen der ausgewählten Items automatisch als globale Vorlage
        const selectedNames = selectedItems
            .map(el => el.dataset.name)
            .filter(name => name); // Stellt sicher, dass keine leeren Einträge gespeichert werden
        localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(selectedNames));
    }

    function setupHotkeyListener() {
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key.toLowerCase() === HOTKEY_BUILD_KEY && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('build-extensions-btn')?.click();
            }
        });
    }

    // NEU: Die globale Timer-Funktion
    function startGlobalTimer() {
        // Überprüfe, ob die `formatTime` Funktion des Spiels verfügbar ist.
        if (typeof window.formatTime !== 'function') {
            log("`window.formatTime` nicht gefunden. Timer-Anzeige könnte unformatiert sein.");
            // Fallback-Funktion
            window.formatTime = s => new Date(s * 1000).toISOString().substr(11, 8);
        }

        setInterval(() => {
    if (activeTimers.length === 0) return;

    const nowInSeconds = Math.floor(Date.now() / 1000);

    for (let i = activeTimers.length - 1; i >= 0; i--) {
        const timer = activeTimers[i];
        const timeLeft = timer.endTime - nowInSeconds;
        const textElement = timer.element.querySelector('span');

        if (timeLeft > 0) {
            // --- NEUER CODE ZUM FORMATIEREN DES DATUMS ---
            const completionDate = new Date(timer.endTime * 1000);
            const day = String(completionDate.getDate()).padStart(2, '0');
            const month = String(completionDate.getMonth() + 1).padStart(2, '0'); // +1, da Monate von 0-11 gezählt werden
            const year = completionDate.getFullYear();
            const hours = String(completionDate.getHours()).padStart(2, '0');
            const minutes = String(completionDate.getMinutes()).padStart(2, '0');
            const formattedDateTime = `${day}.${month}.${year} ${hours}:${minutes}`;
            // --- ENDE DES NEUEN CODES ---

            // Angepasste Textausgabe
            textElement.textContent = `Fertig in: ${window.formatTime(timeLeft)} (${formattedDateTime})`;

        } else {
            // Timer ist abgelaufen, UI aktualisieren
            textElement.textContent = 'Einsatzbereit';
            timer.element.className = 'detail-item status-success';
            timer.element.dataset.status = "success";
            timer.element.dataset.clickable = "true";
            const iconElement = timer.element.querySelector('.icon');
            if (iconElement) iconElement.innerHTML = icons.success;

            // Den fertigen Timer aus der Liste entfernen
            activeTimers.splice(i, 1);
        }
    }
}, 1000);
    }

    // ENTFERNT: Die alte, fehlerhafte `timerUpdate`-Überschreibung wurde gelöscht.

    const observer = new MutationObserver((mutations, obs) => {
         if (document.getElementById('ausbauten')) {
             obs.disconnect();
             initialize();
             log("Initialisierung abgeschlossen.");
         }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
