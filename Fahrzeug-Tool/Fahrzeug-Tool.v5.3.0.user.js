// ==UserScript==
// @name         Fahrzeug-Tool (Besatzung, FMS, Rückalarm, Refit & Verschrotten)
// @namespace    http://tampermonkey.net/
// @version      5.3.0
// @description  Fügt eine robuste Werkzeugleiste über der Fahrzeugtabelle in Leitstellen UND allen Wachentypen ein. Refit-Button nur für LF.
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
    function buildControls(progressBarSent, progressBarCompleted, shouldShowRefitButton) {
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
            refitBtn.addEventListener('click', () => handleRefitAction(progressBarSent, progressBarCompleted));
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

        crewBtn.addEventListener('click', () => handleCrewAction(progressBarSent, progressBarCompleted));
        backalarmBtn.addEventListener('click', () => handleBackalarmAction(progressBarSent, progressBarCompleted));
        scrapBtn.addEventListener('click', () => handleScrapAction(progressBarSent, progressBarCompleted));
        setFms6Btn.addEventListener('click', () => handleSetFms(6, '2', progressBarSent, progressBarCompleted));
        setFms2Btn.addEventListener('click', () => handleSetFms(2, '6', progressBarSent, progressBarCompleted));
        return mainContainer;
    }

    // --- Hilfsfunktionen ---
    function getVisibleVehicleRows() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable) return [];
        return Array.from(vehicleTable.querySelectorAll('tbody tr')).filter(row => row.style.display !== 'none');
    }

    function getVehicleTypeIdFromRow(row) {
        const img = row.querySelector('img[vehicle_type_id]');
        if (!img) return null;
        const typeId = img.getAttribute('vehicle_type_id');
        return typeId ? parseInt(typeId, 10) : null;
    }


    // --- Aktionen ---
    async function handleRefitAction(progressBarSent, progressBarCompleted) {
        const rows = getVisibleVehicleRows();
        const lfVehicleIds = rows
            .filter(row => {
                const typeId = getVehicleTypeIdFromRow(row);
                return typeId !== null && allowedLfTypeIds.includes(typeId);
            })
            .map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1])
            .filter(Boolean);

        if (lfVehicleIds.length === 0) {
            alert('Keine passenden LF-Fahrzeuge für ein Refit in der aktuellen Ansicht gefunden.');
            return;
        }
        if (!confirm(`Möchten Sie ${lfVehicleIds.length} passende LF-Fahrzeuge auf 'Maximum LF' umrüsten?`)) {
            return;
        }

        console.log(`${SCRIPT_PREFIX} Starte Refit-Prozess für ${lfVehicleIds.length} LF-Fahrzeuge.`);

        const firstId = lfVehicleIds[0];
        const initialResponse = await fetch(`/vehicles/${firstId}/refit`);
        const htmlText = await initialResponse.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const form = doc.getElementById('refit_form');
        const authToken = form.querySelector('input[name="authenticity_token"]').value;
        const postUrlTemplate = form.action.replace(firstId, '{id}');

        if (!authToken) {
            alert('Fehler: Konnte keinen gültigen Security-Token finden. Aktion abgebrochen.');
            return;
        }

        await processWithProgress(lfVehicleIds, progressBarSent, progressBarCompleted, async (id) => {
            const postUrl = postUrlTemplate.replace('{id}', id);
            const formData = new FormData();
            formData.append('utf8', '✓');
            formData.append('authenticity_token', authToken);
            formData.append('vehicle_fitting_template[id]', '120');
            formData.append('vehicle_fitting_template[template_caption]', '');
            formData.append('cabin_size_new_value', '9');
            formData.append('water_tank_capacity_new_value', '4500');
            formData.append('pump_capacity_new_value', '4000');
            formData.append('foam_capacity_new_value', '1000');
            formData.append('refit_with_coins', '');
            formData.append('commit', 'Fahrzeug umrüsten');

            const postResponse = await fetch(postUrl, {
                method: 'POST',
                body: formData,
            });

            if (!postResponse.ok && postResponse.status !== 302) {
                throw new Error(`Server hat mit einem Fehler geantwortet: ${postResponse.status} ${postResponse.statusText}`);
            }
        }, 400);
    }

    async function handleCrewAction(progressBarSent, progressBarCompleted) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert('Keine sichtbaren Fahrzeuge gefunden.'); return; }
        if (!confirm(`Für ${vehicleIds.length} Fahrzeuge die maximale Besatzung einstellen?`)) return;
        await processWithProgress(vehicleIds, progressBarSent, progressBarCompleted, async (id) => {
            const response = await fetch(`/vehicles/${id}/edit`);
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

    async function handleScrapAction(progressBarSent, progressBarCompleted) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert('Keine sichtbaren Fahrzeuge zum Verschrotten gefunden.'); return; }
        if (!confirm(`ACHTUNG!\nMöchten Sie wirklich ${vehicleIds.length} Fahrzeuge unwiderruflich verschrotten?\n\nDIESE AKTION KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!`)) return;
        await processWithProgress(vehicleIds, progressBarSent, progressBarCompleted, async (id) => {
            const token = document.querySelector('meta[name="csrf-token"]').content;
            await fetch(`/vehicles/${id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': token } });
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

    function getFmsStatusFromRow(row) {
        const statusSpan = row.querySelector('span.building_list_fms');
        return statusSpan?.textContent.trim();
    }

    async function handleBackalarmAction(progressBarSent, progressBarCompleted) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.filter(row => {
            const status = getFmsStatusFromRow(row);
            return status && !['1', '2', '6'].includes(status);
        }).map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert('Keine Fahrzeuge zum Rückalarmieren gefunden.'); return; }
        if (!confirm(`Möchten Sie ${vehicleIds.length} Fahrzeuge zur Wache zurückalarmieren?`)) return;
        await processWithProgress(vehicleIds, progressBarSent, progressBarCompleted, async (id) => {
            await fetch(`/vehicles/${id}/backalarm?return=vehicle_show`);
        }, 50);
    }

    async function handleSetFms(targetStatus, currentStatusFilter, progressBarSent, progressBarCompleted) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.filter(row => getFmsStatusFromRow(row) === currentStatusFilter)
            .map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert(`Keine sichtbaren Fahrzeuge mit Status ${currentStatusFilter} gefunden.`); return; }
        if (!confirm(`Möchten Sie ${vehicleIds.length} Fahrzeuge von Status ${currentStatusFilter} auf ${targetStatus} setzen?`)) return;
        await processWithProgress(vehicleIds, progressBarSent, progressBarCompleted, async (id) => {
            await fetch(`/vehicles/${id}/set_fms/${targetStatus}`);
        }, 50);
    }

    async function processWithProgress(ids, progressBarSent, progressBarCompleted, action, delay) {
        const progressContainer = progressBarSent.parentNode;
        progressContainer.style.display = 'block';

        // Reset bars
        progressBarSent.className = 'progress-bar';
        progressBarSent.style.width = '0%';
        progressBarSent.style.backgroundColor = '#f0f0f0'; // Light grey for sent
        progressBarCompleted.className = 'progress-bar progress-bar-info progress-bar-striped active';
        progressBarCompleted.style.width = '0%';
        progressBarCompleted.textContent = `0 / ${ids.length}`;

        let sentCount = 0;
        let completedCount = 0;
        const promises = [];

        for (const id of ids) {
            const promise = action(id)
                .catch(e => {
                    console.error(`${SCRIPT_PREFIX} FEHLER bei Fahrzeug-ID ${id}:`, e.message);
                    return Promise.reject(e);
                })
                .finally(() => {
                    completedCount++;
                    const completedPercent = Math.round((completedCount / ids.length) * 100);
                    progressBarCompleted.style.width = `${completedPercent}%`;
                    progressBarCompleted.textContent = `${completedCount} / ${ids.length}`;
                });
            promises.push(promise);

            sentCount++;
            const sentPercent = Math.round((sentCount / ids.length) * 100);
            progressBarSent.style.width = `${sentPercent}%`;

            await new Promise(res => setTimeout(res, delay));
        }

        const results = await Promise.allSettled(promises);
        const failedCount = results.filter(r => r.status === 'rejected').length;
        const successCount = ids.length - failedCount;

        progressBarCompleted.classList.remove('progress-bar-striped', 'active');
        progressBarCompleted.classList.remove('progress-bar-info');
        progressBarCompleted.classList.add(failedCount > 0 ? 'progress-bar-danger' : 'progress-bar-success');

        const summary = `Vorgang abgeschlossen. ${successCount} Aktionen erfolgreich.`;
        alert(summary + (failedCount > 0 ? ` ${failedCount} Fehler (siehe Konsole für Details).` : ''));

        if (failedCount === 0) {
            finishAndReload();
        }
    }


    function finishAndReload() {
        setTimeout(() => {
            const targetHash = isDispatchPage ? '#tab_vehicle' : '#vehicle';
            if (window.location.hash !== targetHash) {
                window.location.href = window.location.pathname + targetHash;
            } else {
                window.location.reload();
            }
        }, 1000);
    }


    // --- Haupt-Startfunktion ---
    function run() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable || document.getElementById('lssToolContainer')) return;

        const oldControls = document.getElementById('lssToolContainer');
        if(oldControls) oldControls.remove();
        const oldProgress = document.getElementById('lssToolProgressContainer');
        if(oldProgress) oldProgress.remove();

        const visibleRows = getVisibleVehicleRows();
        const shouldShowRefitButton = visibleRows.some(row => {
            const typeId = getVehicleTypeIdFromRow(row);
            return typeId !== null && allowedLfTypeIds.includes(typeId);
        });

        // Create the new stacked progress bar structure
        const progressContainer = document.createElement('div');
        progressContainer.id = 'lssToolProgressContainer';
        progressContainer.className = 'progress';
        progressContainer.style.display = 'none';
        progressContainer.style.marginBottom = '10px';
        progressContainer.style.position = 'relative';
        progressContainer.style.backgroundColor = '#f0f0f0'; // Base background

        const progressBarSent = document.createElement('div');
        progressBarSent.id = 'lssToolProgressBarSent';
        progressBarSent.className = 'progress-bar';
        progressBarSent.style.width = '0%';
        progressBarSent.style.backgroundColor = '#e0e0e0'; // Slightly darker grey for sent
        progressBarSent.style.position = 'absolute';
        progressBarSent.style.left = '0';
        progressBarSent.style.top = '0';
        progressBarSent.style.height = '100%';


        const progressBarCompleted = document.createElement('div');
        progressBarCompleted.id = 'lssToolProgressBarCompleted';
        progressBarCompleted.className = 'progress-bar';
        progressBarCompleted.style.width = '0%';
        progressBarCompleted.style.position = 'absolute';
        progressBarCompleted.style.left = '0';
        progressBarCompleted.style.top = '0';
        progressBarCompleted.style.height = '100%';
        progressBarCompleted.style.textAlign = 'center'; // Center text
        progressBarCompleted.style.color = 'black'; // Ensure text is visible
        progressBarCompleted.style.zIndex = '2'; // Put on top


        progressContainer.appendChild(progressBarSent);
        progressContainer.appendChild(progressBarCompleted);


        const controls = buildControls(progressBarSent, progressBarCompleted, shouldShowRefitButton);

        vehicleTable.parentNode.insertBefore(controls, vehicleTable);
        vehicleTable.parentNode.insertBefore(progressContainer, vehicleTable);

        console.log(`${SCRIPT_PREFIX} Steuerung erfolgreich eingefügt/aktualisiert.`);
    }

    const observer = new MutationObserver(run);
    if (window.location.pathname.startsWith('/buildings/')) {
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(run, 500);
    }
})();
