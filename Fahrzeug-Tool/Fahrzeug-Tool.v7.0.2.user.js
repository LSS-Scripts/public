// ==UserScript==
// @name         Fahrzeug-Tool (Besatzung, FMS, Rückalarm, Refit & Verschrotten)
// @namespace    http://tampermonkey.net/
// @version      7.0.2
// @description  Fügt eine Werkzeugleiste hinzu. Die Fortschrittsanzeige ("Defrag"-Bar) ordnet sich immer als perfektes, symmetrisches Rechteck an. Bugfix für Refit-Template-ID.
// @author       Masklin, Gemini & Community-Feedback
// @match        https://www.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://missionchief.com/buildings/*
// @match        https://*.missionchief.com/buildings/*
// @match        https://leitstellenspiel.com/buildings/*
// @match        https://*.leitstellenspiel.com/buildings/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = '[Fahrzeug-Tool]';
    const isDispatchPage = !!document.querySelector('ul.nav-tabs a[href="#tab_vehicle"]');
    const allowedLfTypeIds = [0, 1, 6, 7, 8, 9, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 30, 37, 87, 88, 89, 90, 163, 166];

    // --- UI-Erstellung ---
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

    // --- Hilfsfunktionen ---
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


    // --- Aktionen ---
    async function handleRefitAction() {
        const vehicles = getVisibleVehicleRows()
            .map(getVehicleDataFromRow)
            .filter(v => v && v.typeId !== null && allowedLfTypeIds.includes(v.typeId));

        if (vehicles.length === 0) {
            alert('Keine passenden LF-Fahrzeuge für ein Refit in der aktuellen Ansicht gefunden.');
            return;
        }
        if (!confirm(`Möchten Sie ${vehicles.length} passende LF-Fahrzeuge auf 'Maximum LF' umrüsten?`)) return;

        const firstId = vehicles[0].id;
        const initialResponse = await fetch(`/vehicles/${firstId}/refit`);
        const htmlText = await initialResponse.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        
        // KORREKTUR: Finde die Template-ID dynamisch
        const templateOption = Array.from(doc.querySelectorAll('#vehicle_fitting_template_id option'))
                                   .find(option => option.textContent.trim() === 'Maximum LF');

        if (!templateOption) {
            alert('Fehler: Die Ausrüstungsvorlage "Maximum LF" wurde auf der Umrüst-Seite nicht gefunden. Bitte stelle sicher, dass sie existiert und exakt so heißt.');
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
            formData.append('vehicle_fitting_template[id]', templateId); // Verwende die gefundene ID
            formData.append('vehicle_fitting_template[template_caption]', '');
            formData.append('cabin_size_new_value', '9');
            formData.append('water_tank_capacity_new_value', '4500');
            formData.append('pump_capacity_new_value', '4000');
            formData.append('foam_capacity_new_value', '1000');
            formData.append('commit', 'Fahrzeug umrüsten');
            const postResponse = await fetch(postUrl, { method: 'POST', body: formData });
            if (!postResponse.ok && postResponse.status !== 302) throw new Error(`Serverfehler: ${postResponse.status}`);
        }, 400);
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
        }, 250);
    }

    async function handleScrapAction() {
        const vehicles = getVisibleVehicleRows().map(getVehicleDataFromRow).filter(Boolean);
        if (vehicles.length === 0) { alert('Keine sichtbaren Fahrzeuge zum Verschrotten gefunden.'); return; }
        if (!confirm(`ACHTUNG!\nMöchten Sie wirklich ${vehicles.length} Fahrzeuge unwiderruflich verschrotten?`)) return;
        await processWithProgress(vehicles, async (vehicle) => {
            const token = document.querySelector('meta[name="csrf-token"]').content;
            await fetch(`/vehicles/${vehicle.id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': token } });
        }, 100);
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
        }, 50);
    }

    async function handleSetFms(targetStatus, currentStatusFilter) {
        const vehicles = getVisibleVehicleRows()
            .map(getVehicleDataFromRow)
            .filter(v => v && v.fms === currentStatusFilter);
        if (vehicles.length === 0) { alert(`Keine sichtbaren Fahrzeuge mit Status ${currentStatusFilter} gefunden.`); return; }
        if (!confirm(`Möchten Sie ${vehicles.length} Fahrzeuge von Status ${currentStatusFilter} auf ${targetStatus} setzen?`)) return;
        await processWithProgress(vehicles, async (vehicle) => {
            await fetch(`/vehicles/${vehicle.id}/set_fms/${targetStatus}`);
        }, 50);
    }

    async function processWithProgress(vehicles, action, delay) {
        const progressContainer = document.getElementById('lssToolProgressContainer');
        progressContainer.innerHTML = '';
        progressContainer.style.display = 'grid';
        progressContainer.style.gap = '2px';
        progressContainer.style.marginBottom = '10px';
        
        const originalTotal = vehicles.length;
        if (originalTotal === 0) return;

        let targetTotal = originalTotal;
        let columns = 0;

        if (originalTotal <= 20) {
            columns = originalTotal;
            targetTotal = originalTotal;
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
        
        progressContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

        const blockElements = [];
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
            blockElements.push(block);
        });
        
        const emptyCellsToAdd = targetTotal - originalTotal;
        for (let i = 0; i < emptyCellsToAdd; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.style.border = '1px solid transparent';
            emptyCell.style.backgroundColor = '#f8f8f8';
            progressContainer.appendChild(emptyCell);
        }

        const promises = [];
        for (let i = 0; i < vehicles.length; i++) {
            const vehicle = vehicles[i];
            const currentBlock = blockElements[i];
            currentBlock.style.backgroundColor = 'gold';
            currentBlock.style.color = '#000';

            const promise = action(vehicle)
                .then(result => {
                    currentBlock.style.backgroundColor = 'limegreen';
                    return result;
                })
                .catch(e => {
                    currentBlock.style.backgroundColor = 'crimson';
                    currentBlock.style.color = '#fff';
                    currentBlock.title += `\nFEHLER: ${e.message}`;
                    console.error(`${SCRIPT_PREFIX} FEHLER bei Fahrzeug-ID ${vehicle.id}:`, e.message);
                    return Promise.reject(e);
                });
            promises.push(promise);
            await new Promise(res => setTimeout(res, delay));
        }

        await Promise.allSettled(promises);

        setTimeout(() => {
            const failedCount = promises.filter(p => p.status === 'rejected').length;
            alert(`Vorgang abgeschlossen. ${vehicles.length - failedCount} erfolgreich, ${failedCount} Fehler.`);
            if (failedCount === 0) finishAndReload();
        }, 0);
    }

    function finishAndReload() {
        setTimeout(() => {
            const targetHash = isDispatchPage ? '#tab_vehicle' : '#vehicle';
            window.location.href = window.location.pathname + (window.location.search || '') + targetHash;
            window.location.reload();
        }, 1000);
    }

    // --- Haupt-Startfunktion ---
    function run() {
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

    const observer = new MutationObserver(run);
    if (window.location.pathname.startsWith('/buildings/')) {
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(run, 500);
    }
})();
