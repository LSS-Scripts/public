// ==UserScript==
// @name         Fahrzeug & Flotten-Tool (FMS 6, Besatzung, Refit etc.)
// @namespace    http://tampermonkey.net/
// @version      7.3.0
// @description  Kombiniert die Werkzeugleiste (mit Worker-Pool-Abarbeitung) mit dem globalen FMS 6 Status-Viewer.
// @author       Masklin, Gemini & Community-Feedback
// @match        https://www.leitstellenspiel.de/*
// @match        https://*.leitstellenspiel.de/*
// @match        https://missionchief.com/*
// @match        https://*.missionchief.com/*
// @match        https://leitstellenspiel.com/*
// @match        https://*.leitstellenspiel.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = '[Fahrzeug & Flotten-Tool]';

    // ========================================================================
    // === STYLING (CSS für das FMS 6 Modal-Fenster)
    // ========================================================================
    GM_addStyle(`
        #fms6-modal-backdrop {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 10000; display: none;
        }
        #fms6-modal {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 90%; max-width: 600px;
            background-color: #fdfdfd; border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 10001; display: flex; flex-direction: column;
        }
        #fms6-modal-header {
            padding: 15px 20px; border-bottom: 1px solid #ddd;
            display: flex; justify-content: space-between; align-items: center;
        }
        #fms6-modal-header h3 {
            margin: 0; font-size: 18px; color: #333;
        }
        #fms6-modal-close {
            border: none; background: none; font-size: 24px;
            cursor: pointer; color: #888;
        }
        #fms6-modal-body {
            padding: 20px; max-height: 70vh; overflow-y: auto;
        }
        #fms6-building-list {
            list-style: none; padding: 0; margin: 0;
        }
        #fms6-building-list li {
            background-color: #f8f9fa; border-radius: 5px;
            margin-bottom: 10px; padding: 10px 15px;
            border: 1px solid #dee2e6;
        }
        #fms6-building-list a {
            font-weight: bold; color: #337ab7;
            text-decoration: none; display: block;
            margin-bottom: 8px; font-size: 16px;
        }
        #fms6-building-list a:hover {
            text-decoration: underline;
        }
        .fms6-count-badge {
            background-color: #c9302c; color: white;
            padding: 3px 8px; border-radius: 12px;
            font-size: 13px; margin-left: 8px;
            font-weight: normal;
        }
        .vehicle-types-container {
            display: flex; flex-wrap: wrap; gap: 5px;
            justify-content: flex-start;
        }
        .vehicle-type-tag {
            display: inline-block; background-color: #e9ecef;
            color: #495057; padding: 3px 8px;
            border-radius: 12px; font-size: 11px;
            font-weight: bold; white-space: nowrap;
        }
    `);


    // ========================================================================
    // === SECTION 1: FMS 6 STATUS VIEWER (Globale Funktion)
    // ========================================================================

    function createFms6Modal() {
        if (document.getElementById('fms6-modal-backdrop')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'fms6-modal-backdrop';
        const modal = document.createElement('div');
        modal.id = 'fms6-modal';
        modal.innerHTML = `
            <div id="fms6-modal-header">
                <h3><span class="glyphicon glyphicon-signal" style="color: #c9302c;"></span> Gebäude mit Fahrzeugen in FMS 6</h3>
                <button id="fms6-modal-close">&times;</button>
            </div>
            <div id="fms6-modal-body">
                <ul id="fms6-building-list"><li>Lade Daten...</li></ul>
            </div>`;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        const closeHandler = () => backdrop.style.display = 'none';
        document.getElementById('fms6-modal-close').addEventListener('click', closeHandler);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeHandler(); });
    }

    async function fetchApiData(url, isExternal = false) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: isExternal ? url : `https://www.leitstellenspiel.de${url}`,
                onload: response => resolve(JSON.parse(response.responseText)),
                onerror: reject
            });
        });
    }

    async function fetchAndShowFms6Vehicles() {
        const modalBackdrop = document.getElementById('fms6-modal-backdrop');
        const buildingList = document.getElementById('fms6-building-list');
        modalBackdrop.style.display = 'block';
        buildingList.innerHTML = '<li>Lade Fahrzeug- & Typen-Daten von den APIs...</li>';

        try {
            const [allVehicles, vehicleTypes] = await Promise.all([
                fetchApiData('/api/vehicles'),
                fetchApiData('https://api.lss-manager.de/de_DE/vehicles', true)
            ]);

            const fms6Vehicles = allVehicles.filter(v => v.fms_real === 6);
            if (fms6Vehicles.length === 0) {
                buildingList.innerHTML = '<li>Keine Fahrzeuge in Status 6 gefunden.</li>';
                return;
            }

            const buildings = {};
            fms6Vehicles.forEach(v => {
                if (!buildings[v.building_id]) {
                    buildings[v.building_id] = { count: 0, vehicleNames: [], typeCounts: {} };
                }
                buildings[v.building_id].count++;
                buildings[v.building_id].vehicleNames.push(v.caption);

                const typeCaption = vehicleTypes[v.vehicle_type]?.caption || 'Unbekannt';
                buildings[v.building_id].typeCounts[typeCaption] = (buildings[v.building_id].typeCounts[typeCaption] || 0) + 1;
            });

            const sortedBuildingIds = Object.keys(buildings).sort((a, b) => buildings[b].count - buildings[a].count);

            buildingList.innerHTML = '';
            sortedBuildingIds.forEach(buildingId => {
                const data = buildings[buildingId];
                const listItem = document.createElement('li');

                const link = document.createElement('a');
                link.href = `/buildings/${buildingId}`;
                link.target = "_blank";
                link.title = `Fahrzeuge:\n- ${data.vehicleNames.join('\n- ')}`;
                link.innerHTML = `Gebäude #${buildingId} <span class="fms6-count-badge">${data.count} Fzg.</span>`;

                const typesContainer = document.createElement('div');
                typesContainer.className = 'vehicle-types-container';
                for (const type in data.typeCounts) {
                    const count = data.typeCounts[type];
                    const typeTag = document.createElement('span');
                    typeTag.className = 'vehicle-type-tag';
                    typeTag.textContent = `${count}x ${type}`;
                    typesContainer.appendChild(typeTag);
                }

                listItem.appendChild(link);
                listItem.appendChild(typesContainer);
                buildingList.appendChild(listItem);
            });

        } catch (e) {
            buildingList.innerHTML = '<li>Fehler beim Abrufen oder Verarbeiten der API-Daten.</li>';
            console.error(`${SCRIPT_PREFIX} Fehler bei der FMS 6-Anzeige:`, e);
        }
    }

    function injectFms6ViewerMenuItem() {
        // Warten, bis das Menü sicher im DOM ist
        const checkExist = setInterval(function() {
            const profileMenu = document.querySelector('#menu_profile + .dropdown-menu');
            if (profileMenu) {
                clearInterval(checkExist);
                if (!document.getElementById('fms6-status-button')) {
                    const divider = document.createElement('li');
                    divider.className = 'divider';
                    divider.setAttribute('role', 'presentation');
                    const listItem = document.createElement('li');
                    listItem.setAttribute('role', 'presentation');
                    const link = document.createElement('a');
                    link.id = 'fms6-status-button';
                    link.href = '#';
                    link.innerHTML = '<span class="glyphicon glyphicon-signal" style="color: #c9302c;"></span> FMS 6 Status';
                    link.addEventListener('click', (e) => { e.preventDefault(); fetchAndShowFms6Vehicles(); });
                    listItem.appendChild(link);
                    profileMenu.insertBefore(divider, profileMenu.firstChild);
                    profileMenu.insertBefore(listItem, profileMenu.firstChild);
                }
            }
        }, 100);
    }


    // ========================================================================
    // === SECTION 2: FAHRZEUG-TOOL AUF WACHEN-SEITEN (Basis: v7.2.0)
    // ========================================================================
    const isDispatchPage = !!document.querySelector('ul.nav-tabs a[href="#tab_vehicle"]');
    const allowedLfTypeIds = [0, 1, 6, 7, 8, 9, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 30, 37, 87, 88, 89, 90, 163, 166];

    function buildControls(shouldShowRefitButton) {
        const mainContainer = document.createElement('div');
        mainContainer.id = 'lssToolContainer';
        mainContainer.style.display = 'flex';
        mainContainer.style.justifyContent = 'space-between';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.padding = '10px 0';

        const leftContainer = document.createElement('div');
        leftContainer.style.display = 'flex';
        leftContainer.style.alignItems = 'center';
        leftContainer.className = 'btn-group';

        const crewBtn = document.createElement('button');
        crewBtn.className = 'btn btn-success btn-sm';
        crewBtn.innerHTML = '<span class="glyphicon glyphicon-user"></span> Max. Besatzung';
        leftContainer.appendChild(crewBtn);

        if (shouldShowRefitButton) {
            const refitBtn = document.createElement('button');
            refitBtn.className = 'btn btn-primary btn-sm';
            refitBtn.innerHTML = '<span class="glyphicon glyphicon-wrench"></span> Refit \'Maximum LF\'';
            refitBtn.style.marginLeft = '5px';
            leftContainer.appendChild(refitBtn);
            refitBtn.addEventListener('click', () => handleRefitAction());
        }

        const fmsContainer = document.createElement('div');
        fmsContainer.style.marginLeft = '20px';
        fmsContainer.style.display = 'flex';
        fmsContainer.style.alignItems = 'center';
        const fmsLabel = document.createElement('span');
        fmsLabel.textContent = 'FMS:';
        fmsLabel.style.marginRight = '5px';
        fmsContainer.appendChild(fmsLabel);
        const fmsBtnGroup = document.createElement('div');
        fmsBtnGroup.className = 'btn-group';
        const setFms2Btn = document.createElement('button');
        setFms2Btn.textContent = '2';
        setFms2Btn.className = 'btn btn-xs building_list_fms building_list_fms_2';
        setFms2Btn.style.width = '25px';
        fmsBtnGroup.appendChild(setFms2Btn);
        const setFms6Btn = document.createElement('button');
        setFms6Btn.textContent = '6';
        setFms6Btn.className = 'btn btn-xs';
        setFms6Btn.style.backgroundColor = 'black';
        setFms6Btn.style.color = 'white';
        setFms6Btn.style.borderColor = 'black';
        setFms6Btn.style.width = '25px';
        fmsBtnGroup.appendChild(setFms6Btn);
        fmsContainer.appendChild(fmsBtnGroup);
        leftContainer.appendChild(fmsContainer);
        const backalarmBtn = document.createElement('button');
        backalarmBtn.className = 'btn btn-warning btn-sm';
        backalarmBtn.innerHTML = '<span class="glyphicon glyphicon-bell"></span> Rückalarmieren';
        backalarmBtn.style.marginLeft = '20px';
        leftContainer.appendChild(backalarmBtn);
        const scrapBtn = document.createElement('button');
        scrapBtn.className = 'btn btn-danger btn-sm';
        scrapBtn.innerHTML = '<span class="glyphicon glyphicon-trash"></span> Verschrotten';
        scrapBtn.style.marginLeft = '5px';
        leftContainer.appendChild(scrapBtn);
        mainContainer.appendChild(leftContainer);

        if (isDispatchPage) {
            const rightContainer = document.createElement('div');
            const kmBtn = document.createElement('button');
            kmBtn.className = 'btn btn-default btn-xs';
            kmBtn.title = 'Gesamtkilometer der sichtbaren Fahrzeuge berechnen';
            kmBtn.innerHTML = '<span class="glyphicon glyphicon-road"></span>';
            rightContainer.appendChild(kmBtn);
            mainContainer.appendChild(rightContainer);
            kmBtn.addEventListener('click', handleKilometerAction);
        }

        crewBtn.addEventListener('click', () => handleCrewAction());
        backalarmBtn.addEventListener('click', () => handleBackalarmAction());
        scrapBtn.addEventListener('click', () => handleScrapAction());
        setFms6Btn.addEventListener('click', () => handleSetFms(6, '2'));
        setFms2Btn.addEventListener('click', () => handleSetFms(2, '6'));
        return mainContainer;
    }

    function getVisibleVehicleRows() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable) return [];
        return Array.from(vehicleTable.querySelectorAll('tbody tr')).filter(row => row.style.display !== 'none');
    }

    function getVehicleDataFromRow(row) {
        const link = row.querySelector('td a[href*="/vehicles/"]');
        if (!link) return null;
        const idMatch = link.href.match(/\/vehicles\/(\d+)/);
        const id = idMatch ? idMatch[1] : null;
        const name = link.textContent.replace(/\u200b/g, '').trim();
        const typeIdImg = row.querySelector('img[vehicle_type_id]');
        const typeId = typeIdImg ? parseInt(typeIdImg.getAttribute('vehicle_type_id'), 10) : null;
        const fms = row.querySelector('span.building_list_fms')?.textContent.trim();

        if (!id || !name) return null;
        return { id, name, typeId, fms };
    }

    async function handleRefitAction() {
        const vehicles = getVisibleVehicleRows()
            .map(getVehicleDataFromRow)
            .filter(v => v && v.typeId !== null && allowedLfTypeIds.includes(v.typeId));

        if (vehicles.length === 0) {
            alert('Keine passenden LF-Fahrzeuge für ein Refit in der aktuellen Ansicht gefunden.');
            return;
        }
        if (!confirm(`Möchten Sie ${vehicles.length} passende LF-Fahrzeuge auf 'Maximum LF' umrüsten und danach auf FMS 2 setzen?`)) return;

        const firstId = vehicles[0].id;
        const initialResponse = await fetch(`/vehicles/${firstId}/refit`);
        const htmlText = await initialResponse.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

        const templateOption = Array.from(doc.querySelectorAll('select[name="vehicle_fitting_template[id]"] option'))
                                   .find(option => option.textContent.trim().match(/Maximum\s+LF/i));

        if (!templateOption) {
            alert('Fehler: Die Ausrüstungsvorlage "Maximum LF" wurde auf der Umrüst-Seite nicht gefunden. Bitte stelle sicher, dass sie existiert.');
            return;
        }
        const templateId = templateOption.value;
        console.log(`${SCRIPT_PREFIX} "Maximum LF" Vorlage gefunden mit ID: ${templateId}`);


        const form = doc.getElementById('refit_form');
        const authToken = form.querySelector('input[name="authenticity_token"]').value;
        const postUrlTemplate = form.action.replace(firstId, '{id}');

        if (!authToken) {
            alert('Fehler: Konnte keinen gültigen Security-Token finden.');
            return;
        }

        await processWithProgress(vehicles, async (vehicle) => {
            const postUrl = postUrlTemplate.replace('{id}', vehicle.id);
            const formData = new FormData();
            formData.append('utf8', '✓');
            formData.append('authenticity_token', authToken);
            formData.append('vehicle_fitting_template[id]', templateId);
            formData.append('commit', 'Fahrzeug umrüsten');
            const postResponse = await fetch(postUrl, { method: 'POST', body: formData });
            if (!postResponse.ok && postResponse.status !== 302) throw new Error(`Refit-Serverfehler: ${postResponse.status}`);

            const fmsResponse = await fetch(`/vehicles/${vehicle.id}/set_fms/2`);
            if (!fmsResponse.ok) throw new Error(`FMS-Serverfehler: ${fmsResponse.status}`);
        });
    }

    async function handleCrewAction() {
        const vehicles = getVisibleVehicleRows().map(getVehicleDataFromRow).filter(Boolean);
        if (vehicles.length === 0) { alert('Keine sichtbaren Fahrzeuge gefunden.'); return; }
        if (!confirm(`Für ${vehicles.length} Fahrzeuge die maximale Besatzung einstellen?`)) return;
        await processWithProgress(vehicles, async (vehicle) => {
            const response = await fetch(`/vehicles/${vehicle.id}/edit`);
            const text = await response.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const select = doc.getElementById('vehicle_personal_max');
            if (!select) throw new Error('Dropdown nicht gefunden');
            const maxValue = Math.max(...Array.from(select.options).map(o => parseInt(o.value, 10)));
            if (parseInt(select.value, 10) !== maxValue) {
                const form = doc.querySelector('form');
                const formData = new FormData(form);
                formData.set('vehicle[personal_max]', maxValue);
                await fetch(form.action, { method: 'POST', body: formData });
            }
        });
    }

    async function handleScrapAction() {
        const vehicles = getVisibleVehicleRows().map(getVehicleDataFromRow).filter(Boolean);
        if (vehicles.length === 0) { alert('Keine sichtbaren Fahrzeuge zum Verschrotten gefunden.'); return; }
        if (!confirm(`ACHTUNG!\nMöchten Sie wirklich ${vehicles.length} Fahrzeuge unwiderruflich verschrotten?`)) return;
        await processWithProgress(vehicles, async (vehicle) => {
            const token = document.querySelector('meta[name="csrf-token"]').content;
            await fetch(`/vehicles/${vehicle.id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': token } });
        });
    }

    function handleKilometerAction() {
        const rows = getVisibleVehicleRows();
        if (rows.length === 0) { alert('Keine sichtbaren Fahrzeuge gefunden.'); return; }
        let totalMeters = 0;
        rows.forEach(row => {
            const kmCell = row.querySelector('td:last-child');
            const sortValue = kmCell?.getAttribute('sortvalue');
            if (sortValue) totalMeters += parseInt(sortValue, 10);
        });
        const totalKilometers = totalMeters / 1000;
        const formattedKilometers = totalKilometers.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        alert(`Die ${rows.length} sichtbaren Fahrzeuge sind insgesamt ${formattedKilometers} km gefahren.`);
    }

    async function handleBackalarmAction() {
        const vehicles = getVisibleVehicleRows()
            .map(getVehicleDataFromRow)
            .filter(v => v && v.fms && !['1', '2', '6'].includes(v.fms));
        if (vehicles.length === 0) { alert('Keine Fahrzeuge zum Rückalarmieren gefunden.'); return; }
        if (!confirm(`Möchten Sie ${vehicles.length} Fahrzeuge zur Wache zurückalarmieren?`)) return;
        await processWithProgress(vehicles, async (vehicle) => {
            await fetch(`/vehicles/${vehicle.id}/backalarm?return=vehicle_show`);
        });
    }

    async function handleSetFms(targetStatus, currentStatusFilter) {
        const vehicles = getVisibleVehicleRows()
            .map(getVehicleDataFromRow)
            .filter(v => v && v.fms === currentStatusFilter);
        if (vehicles.length === 0) { alert(`Keine sichtbaren Fahrzeuge mit Status ${currentStatusFilter} gefunden.`); return; }
        if (!confirm(`Möchten Sie ${vehicles.length} Fahrzeuge von Status ${currentStatusFilter} auf ${targetStatus} setzen?`)) return;
        await processWithProgress(vehicles, async (vehicle) => {
            await fetch(`/vehicles/${vehicle.id}/set_fms/${targetStatus}`);
        });
    }

    async function processWithProgress(vehicles, action) {
        const CONCURRENCY_LIMIT = 20;
        const progressContainer = document.getElementById('lssToolProgressContainer');
        progressContainer.innerHTML = '';
        progressContainer.style.display = 'grid';
        progressContainer.style.gap = '2px';
        progressContainer.style.marginBottom = '10px';

        const originalTotal = vehicles.length;
        if (originalTotal === 0) return;

        let targetTotal = originalTotal;
        let columns = 20;

        if (originalTotal <= 40) {
            if (originalTotal <= 20) {
                columns = originalTotal;
            } else {
                 while (true) {
                    let foundDivisor = false;
                    for (let i = 20; i >= 2; i--) {
                        if (targetTotal % i === 0) {
                            columns = i;
                            foundDivisor = true;
                            break;
                        }
                    }
                    if (foundDivisor) break;
                    targetTotal++;
                }
            }
        }

        progressContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

        const blockElements = new Map();
        vehicles.forEach(vehicle => {
            const block = document.createElement('div');
            block.style.height = '18px';
            block.style.backgroundColor = '#fff';
            block.style.border = '1px solid #eee';
            block.style.fontSize = '10px';
            block.style.color = '#333';
            block.style.textAlign = 'center';
            block.style.lineHeight = '16px';
            block.style.overflow = 'hidden';
            block.style.whiteSpace = 'nowrap';
            block.textContent = vehicle.id;
            block.title = `Fahrzeug: ${vehicle.name}\nID: ${vehicle.id}`;
            progressContainer.appendChild(block);
            blockElements.set(vehicle.id, block);
        });

        const emptyCellsToAdd = targetTotal - originalTotal;
        if (originalTotal <= 40) {
            for (let i = 0; i < emptyCellsToAdd; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.style.border = '1px solid transparent';
                emptyCell.style.backgroundColor = '#f8f8f8';
                progressContainer.appendChild(emptyCell);
            }
        }

        let failedCount = 0;
        const queue = [...vehicles];

        const worker = async () => {
            while (queue.length > 0) {
                const vehicle = queue.shift();
                if (!vehicle) continue;

                const block = blockElements.get(vehicle.id);
                block.style.backgroundColor = 'gold';
                block.style.color = '#000';

                try {
                    await action(vehicle);
                    block.style.backgroundColor = 'limegreen';
                } catch (e) {
                    failedCount++;
                    block.style.backgroundColor = 'crimson';
                    block.style.color = '#fff';
                    block.title += `\nFEHLER: ${e.message}`;
                    console.error(`${SCRIPT_PREFIX} FEHLER bei Fahrzeug-ID ${vehicle.id}:`, e.message);
                }
            }
        };

        const workers = [];
        for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        alert(`Vorgang abgeschlossen. ${originalTotal - failedCount} erfolgreich, ${failedCount} Fehler.`);
        if (failedCount === 0) finishAndReload();
    }

    function finishAndReload() {
        setTimeout(() => {
            const targetHash = isDispatchPage ? '#tab_vehicle' : '#vehicle';
            window.location.href = window.location.pathname + (window.location.search || '') + targetHash;
            window.location.reload();
        }, 1000);
    }

    function runBuildingTool() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable || document.getElementById('lssToolContainer')) return;

        document.getElementById('lssToolContainer')?.remove();
        document.getElementById('lssToolProgressContainer')?.remove();

        const visibleRows = getVisibleVehicleRows();
        const shouldShowRefitButton = visibleRows.some(row => {
            const data = getVehicleDataFromRow(row);
            return data && data.typeId !== null && allowedLfTypeIds.includes(data.typeId);
        });

        const progressContainer = document.createElement('div');
        progressContainer.id = 'lssToolProgressContainer';

        const controls = buildControls(shouldShowRefitButton);

        vehicleTable.parentNode.insertBefore(controls, vehicleTable);
        vehicleTable.parentNode.insertBefore(progressContainer, vehicleTable);

        console.log(`${SCRIPT_PREFIX} Steuerung erfolgreich eingefügt.`);
    }

    // ========================================================================
    // === MAIN INITIALIZER (ROUTER)
    // ========================================================================
    (function main() {
        // Feature 1: FMS 6 Viewer (läuft auf ALLEN Seiten)
        createFms6Modal();
        injectFms6ViewerMenuItem();

        // Feature 2: Fahrzeug-Tool (läuft NUR auf Wachen-Seiten)
        if (window.location.pathname.startsWith('/buildings/')) {
            const observer = new MutationObserver(runBuildingTool);
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(runBuildingTool, 500);
        }
    })();

})();
