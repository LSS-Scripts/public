// ==UserScript==
// @name         Leitstellenspiel - Wachen-Namen-Manager (Massen-Umbenennung)
// @namespace    http://tampermonkey.net/
// @version      13.6
// @description  Fügt einen Button hinzu, um sichtbare Wachen per Suchen & Ersetzen (mit Platzhaltern und fortlaufender Nummerierung) umzubenennen.
// @author       Gemini & Community
// @match        https://www.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Globale Variablen
    let managerVisible = false;
    let buildings = {};
    let uiContainer = null;
    let tableObserver = null;
    const MAX_CONCURRENT_WORKERS = 10;

    const styles = `
        #wachen-liste-body { max-height: 450px; overflow-y: auto; }
        .building-grid-container { display: flex; flex-wrap: wrap; gap: 10px; }
        .building-grid-item {
            display: flex; flex-direction: column; padding: 5px; border: 1px solid #ddd; border-radius: 4px; background-color: #fff;
            box-sizing: border-box; flex-grow: 1; flex-basis: calc(33.333% - 10px); min-width: 250px;
        }
        .building-grid-item label { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; color: #000 !important; opacity: 1 !important; }
        .building-grid-item input { font-size: 12px; color: #000 !important; }
        .item-changed { background-color: #fff3cd !important; }
        .item-processing { background-color: #e9ecef !important; }
        .item-success { background-color: #A7F0A7 !important; }
        .item-error { background-color: #F0A7A7 !important; }
    `;

    function applySearchAndReplace() {
        const searchTerm = document.getElementById('sr_search').value;
        const replaceTerm = document.getElementById('sr_replace').value;
        const useRegex = document.getElementById('sr_regex').checked;
        const inputs = document.querySelectorAll('#wachen-liste-body input[type="text"]');

        // NEU: Werte für die Nummerierung auslesen
        const useNumbering = document.getElementById('sr_numbering_enabled').checked;
        const startNumber = parseInt(document.getElementById('sr_start_number').value, 10) || 0;
        const numberPrefix = document.getElementById('sr_number_prefix').value;
        let counter = startNumber;

        let regex;
        if (useRegex) {
            try {
                let pattern = searchTerm;
                if (pattern === '.*') { pattern = '^.*$'; }
                regex = new RegExp(pattern, 'g');
            }
            catch (e) { alert(`Ungültiger Regulärer Ausdruck: ${e.message}`); return; }
        }

        inputs.forEach(input => {
            const buildingId = input.closest('.building-grid-item').dataset.id;
            const buildingData = buildings[buildingId];
            let currentReplaceTerm = replaceTerm;

            if (buildingData && buildingData.address && !buildingData.hasError) {
                const addressMatch = buildingData.address.match(/(\d{5})\s+([^,]+)/);
                const plz = addressMatch ? addressMatch[1].trim() : '';
                const ort = addressMatch ? addressMatch[2].trim() : buildingData.address;

                currentReplaceTerm = currentReplaceTerm.replace(/\[ADRESSE\]/g, buildingData.address);
                currentReplaceTerm = currentReplaceTerm.replace(/\[PLZ\]/g, plz);
                currentReplaceTerm = currentReplaceTerm.replace(/\[ORT\]/g, ort);
            }

            // NEU: Platzhalter [NR] ersetzen, falls aktiviert
            if (useNumbering) {
                currentReplaceTerm = currentReplaceTerm.replace(/\[NR\]/g, numberPrefix + counter);
            }

            const originalValue = input.value;
            let newValue;

            if (!useRegex && originalValue === searchTerm) {
                newValue = currentReplaceTerm;
            } else {
                newValue = useRegex
                    ? originalValue.replace(regex, currentReplaceTerm)
                    : originalValue.replaceAll(searchTerm, currentReplaceTerm);
            }

            if (originalValue !== newValue) {
                input.value = newValue;
                input.dispatchEvent(new Event('input'));
            }

            // NEU: Zähler für die nächste Wache erhöhen
            if (useNumbering) {
                counter++;
            }
        });
    }

    async function loadAddresses() {
        const loadBtn = document.getElementById('load-addresses-btn');
        const statusSpan = document.getElementById('address-status');
        loadBtn.disabled = true;
        statusSpan.textContent = 'Lade Adressen... (0%)';

        const itemsToLoad = Object.values(buildings).filter(b => b.address === null);
        if (itemsToLoad.length === 0) {
            statusSpan.textContent = 'Alle Adressen sind bereits geladen.';
            loadBtn.disabled = false;
            return;
        }

        const taskQueue = [...itemsToLoad];
        let completedTasks = 0;
        let successCount = 0;
        let skippedCount = 0;

        const fetchAddressTask = async (task) => {
            const itemElement = document.querySelector(`.building-grid-item[data-id='${task.id}']`);
            try {
                await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: "GET", url: `/buildings/${task.id}/move`,
                        onload: res => {
                            const doc = new DOMParser().parseFromString(res.responseText, "text/html");
                            const addressInput = doc.getElementById('building_address');

                            if (addressInput) {
                                buildings[task.id].address = addressInput.value;
                                buildings[task.id].hasError = false;
                                successCount++;
                            } else {
                                buildings[task.id].hasError = true;
                                const errorAlert = doc.querySelector('div.alert.alert-danger');
                                if (errorAlert && errorAlert.textContent.includes("FMS Status 2")) {
                                    if(itemElement) {
                                        itemElement.classList.add('item-error');
                                        itemElement.title = 'Fehler: Nicht alle Fahrzeuge sind in Status 2.';
                                    }
                                    skippedCount++;
                                } else {
                                     if(itemElement) {
                                         itemElement.classList.add('item-error');
                                         itemElement.title = 'Fehler: Adresse konnte nicht geladen werden.';
                                     }
                                }
                            }
                            resolve();
                        },
                        onerror: reject
                    });
                });
            } catch (error) {
                console.error(`Fehler beim Laden der Adresse für Wache ${task.id}:`, error);
                buildings[task.id].hasError = true;
                if(itemElement) itemElement.classList.add('item-error');
            } finally {
                completedTasks++;
                statusSpan.textContent = `Lade Adressen... (${Math.round((completedTasks / itemsToLoad.length) * 100)}%)`;
            }
        };

        const worker = async () => {
            while (taskQueue.length > 0) {
                const task = taskQueue.shift();
                if (task) await fetchAddressTask(task);
            }
        };

        const workerPromises = Array.from({ length: MAX_CONCURRENT_WORKERS }, () => worker());
        await Promise.all(workerPromises);

        let finalStatus = `${successCount} Adressen geladen.`;
        if (skippedCount > 0) {
            finalStatus += ` ${skippedCount} wegen Status-2-Fehler übersprungen.`;
        }
        statusSpan.textContent = finalStatus;
        loadBtn.disabled = false;
    }


    function showManager() {
        if (managerVisible) return;
        managerVisible = true;
        const buildingTable = document.getElementById('building_table');
        if (!buildingTable) { managerVisible = false; return; }

        uiContainer = document.createElement('div');
        uiContainer.id = 'wachen-manager-container';
        uiContainer.innerHTML = `
            <style>${styles}</style>
            <div class="panel panel-default">
                <div class="panel-heading"><h4>Wachen-Namen-Manager (Grid & Parallel-Batch)</h4></div>
                <div class="panel-body">
                    <div class="form-inline" style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
                         <button id="load-addresses-btn" class="btn btn-info" title="Lädt Adressen für Platzhalter: [ADRESSE], [PLZ], [ORT]">Adressen laden</button>
                         <span id="address-status" style="margin-left: 10px; font-style: italic;"></span>
                    </div>
                    <div id="search-replace-container" class="form-inline" style="margin-bottom: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
                        <strong style="margin-right: 15px;">Suchen & Ersetzen</strong>
                        <div class="form-group"><input type="text" class="form-control" id="sr_search" placeholder="Suchen nach..."></div>
                        <div class="form-group" style="margin-left: 5px;"><input type="text" class="form-control" id="sr_replace" placeholder="Ersetzen durch..."></div>
                        <button id="sr_apply" class="btn btn-default" style="margin-left: 10px;">Vorschau anwenden</button>
                        <div class="checkbox" style="margin-left: 10px; padding-top: 5px;"><label title="Reguläre Ausdrücke erlauben"><input type="checkbox" id="sr_regex"> RegExp</label></div>
                    </div>
                    <div id="numbering-container" class="form-inline" style="margin-bottom: 20px; padding: 10px 15px; border: 1px solid #ddd; border-radius: 4px; background-color: #f9f9f9;">
                        <div class="checkbox" style="margin-right: 15px;">
                            <label title="Fügt den Platzhalter [NR] in den Ersetzungstext ein."><input type="checkbox" id="sr_numbering_enabled"> <strong>Nummerierung aktivieren</strong></label>
                        </div>
                        <div class="form-group"><label for="sr_start_number" style="margin-right: 5px;">Startwert:</label><input type="number" class="form-control" id="sr_start_number" value="1" style="width: 100px;"></div>
                        <div class="form-group" style="margin-left: 15px;"><label for="sr_number_prefix" style="margin-right: 5px;">Präfix:</label><input type="text" class="form-control" id="sr_number_prefix" value="#" placeholder="z.B. #" style="width: 80px;"></div>
                    </div>
                    <div id="wachen-liste-body"><p>Lade Wachen...</p></div>
                </div>
                <div class="panel-footer">
                    <button id="save-all-names" class="btn btn-success">Alle Änderungen speichern</button>
                    <button id="close-manager" class="btn btn-danger" style="margin-left: 10px;">Schließen</button>
                    <div id="save-progress" style="margin-top: 10px;"></div>
                </div>
            </div>`;

        buildingTable.parentNode.insertBefore(uiContainer, buildingTable);
        const startBtnContainer = document.getElementById('start-rename-btn-container');
        if (startBtnContainer) startBtnContainer.style.display = 'none';

        document.getElementById('load-addresses-btn').addEventListener('click', loadAddresses);
        document.getElementById('sr_apply').addEventListener('click', applySearchAndReplace);
        document.getElementById('save-all-names').addEventListener('click', saveAllChanges);
        document.getElementById('close-manager').addEventListener('click', hideManager);

        updateUI();
        startTableObserver();
    }

    function hideManager() {
        if (!managerVisible) return;
        if (uiContainer) uiContainer.remove();
        if (tableObserver) tableObserver.disconnect();
        const startBtnContainer = document.getElementById('start-rename-btn-container');
        if (startBtnContainer) startBtnContainer.style.display = 'block';
        managerVisible = false;
    }

    function updateUI() {
        const container = document.getElementById('wachen-liste-body');
        if (!container) return;
        container.innerHTML = '';
        buildings = {};
        const rows = document.querySelectorAll('#building_table tbody tr:not([style*="display: none"])');
        if (rows.length === 0) { container.innerHTML = '<p>Keine sichtbaren Wachen in der Tabelle gefunden.</p>'; return; }

        const gridContainer = document.createElement('div');
        gridContainer.className = 'building-grid-container';

        rows.forEach(row => {
            const link = row.querySelector('td:nth-child(2) a[href*="/buildings/"]');
            if (link) {
                const buildingName = link.textContent.trim();
                const buildingId = link.getAttribute('href').split('/').pop();
                buildings[buildingId] = { id: buildingId, name: buildingName, address: null, hasError: false };

                const item = document.createElement('div');
                item.className = 'building-grid-item';
                item.dataset.id = buildingId;
                item.innerHTML = `<label for="building_name_${buildingId}" title="${buildingName}">${buildingName}</label><input type="text" class="form-control input-sm" id="building_name_${buildingId}" value="${buildingName}">`;

                const input = item.querySelector('input');
                input.addEventListener('input', () => {
                    item.classList.toggle('item-changed', input.value !== buildings[buildingId].name);
                });
                gridContainer.appendChild(item);
            }
        });
        container.appendChild(gridContainer);
    }

    async function saveAllChanges() {
        const saveButton = document.getElementById('save-all-names');
        const progressDiv = document.getElementById('save-progress');
        saveButton.disabled = true;

        const changes = Object.values(buildings).map(b => {
            const item = document.querySelector(`.building-grid-item[data-id='${b.id}']`);
            const input = item?.querySelector('input');
            return {
                id: b.id,
                newName: input ? input.value.trim() : b.name,
                originalName: b.name,
                element: item
            };
        })
        .filter(change => change.newName !== change.originalName && !buildings[change.id].hasError);


        if (changes.length === 0) {
            progressDiv.innerHTML = '<div class="alert alert-info">Keine gültigen Änderungen zum Speichern. (Wachen mit Fehlern werden ignoriert)</div>';
            saveButton.disabled = false;
            return;
        }

        progressDiv.innerHTML = `<p>${changes.length} Wache(n) wird/werden umbenannt...</p><div class="progress"><div class="progress-bar" role="progressbar" style="width: 0%;"></div></div>`;
        const progressBar = progressDiv.querySelector('.progress-bar');
        let completedTasks = 0;

        const taskQueue = [...changes];
        changes.forEach(change => {
            if(change.element) change.element.classList.add('item-processing');
        });

        const renameTask = async (task) => {
            try {
                const token = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({ method: "GET", url: `/buildings/${task.id}/edit`, onload: res => { const doc = new DOMParser().parseFromString(res.responseText, "text/html"); const tokenInput = doc.querySelector('input[name="authenticity_token"]'); tokenInput ? resolve(tokenInput.value) : reject('Token fehlt'); }, onerror: () => reject('Netzwerkfehler') });
                });
                await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({ method: "POST", url: `/buildings/${task.id}`, data: `_method=patch&authenticity_token=${encodeURIComponent(token)}&building[name]=${encodeURIComponent(task.newName)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" }, onload: resolve, onerror: reject });
                });
                if(task.element) task.element.classList.replace('item-processing', 'item-success');
            } catch (error) {
                if(task.element) task.element.classList.replace('item-processing', 'item-error');
                console.error(`Fehler bei Wache ${task.id}:`, error);
            } finally {
                completedTasks++;
                progressBar.style.width = `${(completedTasks / changes.length) * 100}%`;
            }
        };

        const worker = async () => {
            while (taskQueue.length > 0) {
                const task = taskQueue.shift();
                if (task) await renameTask(task);
            }
        };

        const workerPromises = Array.from({ length: MAX_CONCURRENT_WORKERS }, () => worker());
        await Promise.all(workerPromises);

        progressDiv.innerHTML += '<p class="alert alert-info">Alle Änderungen abgeschlossen. Seite wird in 3 Sekunden neu geladen.</p>';
        setTimeout(() => window.location.reload(), 3000);
    }

    function startTableObserver() {
        const targetNode = document.querySelector('#building_table tbody');
        if (!targetNode) return;
        tableObserver = new MutationObserver(() => setTimeout(updateUI, 250));
        tableObserver.observe(targetNode, { childList: true, attributes: true, subtree: true, attributeFilter: ['style'] });
    }

    function placeStartButton() {
        const buildingTable = document.getElementById('building_table');
        const buttonContainerExists = document.getElementById('start-rename-btn-container');
        if (buildingTable && !buttonContainerExists) {
            const startButtonContainer = document.createElement('div');
            startButtonContainer.id = 'start-rename-btn-container';
            startButtonContainer.style.marginBottom = '10px';
            startButtonContainer.innerHTML = `<button id="start-rename-btn" class="btn btn-primary"><span class="glyphicon glyphicon-pencil"></span> Massen-Umbenennung starten</button>`;
            buildingTable.parentNode.insertBefore(startButtonContainer, buildingTable);
            document.getElementById('start-rename-btn').addEventListener('click', showManager);
        }
        if (!buildingTable && managerVisible) {
            hideManager();
        }
    }

    const mainContent = document.getElementById('content') || document.body;
    const pageObserver = new MutationObserver(() => placeStartButton());
    pageObserver.observe(mainContent, { childList: true, subtree: true });
    placeStartButton();

})();
