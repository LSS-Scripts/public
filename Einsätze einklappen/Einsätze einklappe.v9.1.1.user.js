// ==UserScript==
// @name         Einsätze einklappen (Finale LSSM-Logik) - GM_Storage_FIX
// @namespace    http://tampermonkey.net/
// @version      9.1.1
// @description  Klappt Einsätze exakt nach der Logik des LSS-Managers ein und speichert den Zustand. Reagiert auf LSSM-Änderungen. (Nutzt GM_Storage statt localStorage)
// @author       Masklin & Gemini & Hendrik
// @match        https://www.leitstellenspiel.de/
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Speicherfunktionen (UMGEBAUT AUF GM_STORAGE) ---
    const STORAGE_KEY = 'tm_collapsed_missions';

    // Wir brauchen eine globale Variable, um den Zustand im Speicher zu halten
    let collapsedMissionsSet = new Set();

    // Funktion, um den Zustand einmalig beim Start zu laden
    const initializeStorage = async () => {
        try {
            const stored = await GM_getValue(STORAGE_KEY, null);
            if (stored) {
                collapsedMissionsSet = new Set(JSON.parse(stored));
            } else {
                collapsedMissionsSet = new Set();
            }
        } catch (e) {
            console.error('[Einklapp-Skript] Fehler beim LESEN des GM_Storage:', e);
            console.error('[Einklapp-Skript] Setze Speicher zurück, um Fehler zu beheben.');
            await GM_deleteValue(STORAGE_KEY); // Bei korrupten Daten zurücksetzen
            collapsedMissionsSet = new Set();
        }
    };

    // Gibt einfach den aktuellen In-Memory-Zustand zurück (schnell!)
    const getCollapsedMissions = () => {
        return collapsedMissionsSet;
    };

    // Speichert den Zustand asynchron im Hintergrund
    const saveCollapsedMissions = async (missionIdsSet) => {
        // Aktualisiere zuerst den In-Memory-Zustand
        collapsedMissionsSet = missionIdsSet;
        try {
            const dataToSave = JSON.stringify([...missionIdsSet]);
            await GM_setValue(STORAGE_KEY, dataToSave);
            // Fürs Debugging kannst du die nächste Zeile einkommentieren:
            // console.log('[Einklapp-Skript] Erfolgreich in GM_Storage gespeichert:', dataToSave);
        } catch (e) {
            // Wir entfernen den nervigen Alert. Ein Fehler in der Konsole reicht.
            console.error('[Einklapp-Skript] FEHLER beim SPEICHERN im GM_Storage:', e);
        }
    };

    // 1. CSS-Stile
    GM_addStyle(`
        .mission-collapsed-tm .panel-body { display: none !important; }
        .mission-collapsed-tm .panel-heading { display: flex !important; align-items: center !important; gap: 4px !important; }
        .mission-collapsed-tm .panel-heading .progress { flex-grow: 1; min-width: 0; margin-bottom: 0; position: relative; background-color: #000 !important; }
        .mission-collapsed-tm .panel-heading .progress-bar { text-align: left !important; }
        .mission-collapsed-tm .lssm-collapsed-bar-content { position: absolute; top: 0; left: 0; right: 0; height: 100%; display: flex; align-items: center; justify-content: space-between; z-index: 2; }
        .mission-collapsed-tm .lssm-collapsed-bar-content a { margin-left: 5px; color: white !important; text-shadow: none !important; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mission-collapsed-tm .lssm-collapsed-bar-content .mission_overview_countdown { margin-right: 5px; flex-shrink: 0; font-size: 14px; }
        .collapse-button-tm { margin-right: 4px !important; }
        #toggleAllMissionsBtn-tm { margin-right: 5px !important; }
    `);

    // Die Kernfunktion
    const toggleMissionLSSMStyle = (missionNode, forceState, skipSave = false) => {
        const missionId = missionNode.getAttribute('mission_id');
        if (!missionId) return;
        const isCollapsed = missionNode.classList.contains('mission-collapsed-tm');
        const shouldCollapse = forceState === undefined ? !isCollapsed : forceState;
        if (shouldCollapse === isCollapsed) return;
        const collapseBtn = missionNode.querySelector('.collapse-button-tm');
        const icon = missionNode.querySelector(`#mission_vehicle_state_${missionId}`);
        const progressBarWrapper = missionNode.querySelector(`#mission_bar_outer_${missionId}`);
        const progressBar = missionNode.querySelector(`#mission_bar_${missionId}`);
        const caption = missionNode.querySelector(`#mission_caption_${missionId}`);
        const countdown = missionNode.querySelector(`#mission_overview_countdown_${missionId}`);
        if (!collapseBtn || !icon || !progressBarWrapper || !progressBar || !caption) return;
        if (shouldCollapse) {
            missionNode.classList.add('mission-collapsed-tm');
            collapseBtn.innerHTML = '📖';
            const createPlaceholder = (element, name) => { if (!element) return; const p = document.createElement('div'); p.style.display = 'none'; p.dataset.collapsablePlaceholder = name; element.after(p); };
            createPlaceholder(icon, 'icon'); createPlaceholder(progressBarWrapper, 'progressbar'); createPlaceholder(caption, 'caption'); createPlaceholder(countdown, 'countdown');
            collapseBtn.after(icon); caption.after(progressBarWrapper);
            const barContent = document.createElement('div'); barContent.className = 'lssm-collapsed-bar-content'; barContent.append(caption); if (countdown) barContent.append(countdown);
            progressBarWrapper.prepend(barContent);
        } else {
            missionNode.classList.remove('mission-collapsed-tm');
            collapseBtn.innerHTML = '🤏';
            const placeholders = { icon: missionNode.querySelector('[data-collapsable-placeholder="icon"]'), progressbar: missionNode.querySelector('[data-collapsable-placeholder="progressbar"]'), caption: missionNode.querySelector('[data-collapsable-placeholder="caption"]'), countdown: missionNode.querySelector('[data-collapsable-placeholder="countdown"]')};
            if (placeholders.icon) placeholders.icon.after(icon); if (placeholders.caption) placeholders.caption.after(caption); if (placeholders.progressbar) placeholders.progressbar.after(progressBarWrapper); if (countdown && placeholders.countdown) placeholders.countdown.after(countdown);
            missionNode.querySelector('.lssm-collapsed-bar-content')?.remove();
            Object.values(placeholders).forEach(p => p?.remove());
        }
        if (!skipSave) {
            // Diese Funktion ist jetzt synchron, da sie nur das In-Memory-Set liest
            const currentCollapsedMissions = getCollapsedMissions();
            if (shouldCollapse) currentCollapsedMissions.add(missionId);
            else currentCollapsedMissions.delete(missionId);
            
            // Diese Funktion speichert im Hintergrund, ohne das Skript zu blockieren
            saveCollapsedMissions(currentCollapsedMissions);
        }
    };

    // --- HILFSFUNKTIONEN ---
    const addCollapseButton = (missionNode) => {
        const heading = missionNode.querySelector('.panel-heading');
        const alarmButton = heading?.querySelector('.mission-alarm-button');
        if (!heading || !alarmButton || heading.querySelector('.collapse-button-tm')) return;
        const collapseBtn = document.createElement('a');
        collapseBtn.innerHTML = '🤏';
        collapseBtn.title = 'Einklappen/Ausklappen';
        collapseBtn.className = 'btn btn-default btn-xs collapse-button-tm';
        collapseBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleMissionLSSMStyle(missionNode); });
        alarmButton.before(collapseBtn);
    };
    const addToggleAllButton = () => {
        if (document.getElementById('toggleAllMissionsBtn-tm')) return;
        const mainPanel = document.getElementById('missions-panel-main');
        const filterControl = mainPanel?.querySelector('.filters-display-control');
        if (!filterControl) return;
        const toggleAllBtn = document.createElement('a');
        toggleAllBtn.id = 'toggleAllMissionsBtn-tm';
        toggleAllBtn.innerHTML = '🤏/📖';
        toggleAllBtn.title = 'Alle Einsätze umschalten';
        toggleAllBtn.className = 'btn btn-default btn-xs';
        toggleAllBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const missions = document.querySelectorAll('#mission_list > .missionSideBarEntry');
            const shouldCollapse = Array.from(missions).some(m => !m.classList.contains('mission-collapsed-tm'));
            // Wichtig: toggleMissionLSSMStyle (mit skipSave=true) ist synchron
            missions.forEach(node => toggleMissionLSSMStyle(node, shouldCollapse, true)); 
            
            // Jetzt den neuen Zustand final im Hintergrund speichern
            const missionIds = shouldCollapse ? new Set(Array.from(missions).map(n => n.getAttribute('mission_id')).filter(Boolean)) : new Set();
            saveCollapsedMissions(missionIds);
        });
        filterControl.before(toggleAllBtn);
    };
    const cleanupStorage = () => {
        // 1. Hole alle IDs, die wir gespeichert haben (aus dem In-Memory-Set)
        const storedMissions = getCollapsedMissions();
        if (storedMissions.size === 0) return; // Nichts zu tun

        // 2. Hole alle IDs, die aktuell auf der Seite sichtbar sind
        const visibleMissionNodes = document.querySelectorAll('#mission_list > .missionSideBarEntry');
        const visibleMissionIds = new Set();
        visibleMissionNodes.forEach(node => {
            const id = node.getAttribute('mission_id');
            if (id) visibleMissionIds.add(id);
        });

        // 3. Erstelle einen neuen, sauberen Satz
        const cleanedMissions = new Set();
        for (const storedId of storedMissions) {
            if (visibleMissionIds.has(storedId)) {
                cleanedMissions.add(storedId);
            }
        }

        // 4. Speichere den sauberen Satz (nur wenn nötig)
        if (cleanedMissions.size !== storedMissions.size) {
            console.log(`[Einklapp-Skript] Speicher bereinigt. ${storedMissions.size - cleanedMissions.size} alte Einträge entfernt.`);
            saveCollapsedMissions(cleanedMissions);
        }
    };

    // --- INITIALISIERUNG UND OBSERVER ---
    const processNode = (node) => {
        if (!node.matches || !node.matches('.missionSideBarEntry:not([data-collapse-processed-tm])')) return;

        addCollapseButton(node);
        node.setAttribute('data-collapse-processed-tm', 'true');
        const missionId = node.getAttribute('mission_id');
        // getCollapsedMissions() ist jetzt synchron und schnell
        if (missionId && getCollapsedMissions().has(missionId)) {
            toggleMissionLSSMStyle(node, true, true);
        }
    };

    const observer = new MutationObserver((mutations) => {
        addToggleAllButton();
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches('.missionSideBarEntry')) {
                    processNode(node);
                } else if (node.querySelector) {
                    node.querySelectorAll('.missionSideBarEntry').forEach(processNode);
                }
                const creditsWrapper = node.matches('div[class*="average-credits_wrapper"]') ? node : node.querySelector('div[class*="average-credits_wrapper"]');
                if (creditsWrapper) {
                    const missionNode = creditsWrapper.closest('.missionSideBarEntry');
                    if (missionNode && missionNode.classList.contains('mission-collapsed-tm')) {
                        toggleMissionLSSMStyle(missionNode, false, true);
                        toggleMissionLSSMStyle(missionNode, true, true);
                    }
                }
            }
        }
    });

    // --- HAUPTFUNKTION (async) ---
    // Wir packen den Start in eine async-Funktion, damit wir auf den Speicher warten können
    const main = async () => {
        // 1. Zuerst den Speicher laden
        await initializeStorage();

        // 2. Initialer Durchlauf für alle Elemente, die beim Start des Scripts bereits da sind.
        addToggleAllButton();
        document.querySelectorAll('.missionSideBarEntry').forEach(processNode);

        // 3. Speicher einmalig beim Laden bereinigen
        cleanupStorage();

        // 4. Observer starten, um auf zukünftige, dynamische Änderungen zu lauschen.
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // Skript starten
    main();

})();
