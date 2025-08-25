// ==UserScript==
// @name         Fahrzeug-Tool (Besatzung, FMS, Rückalarm & Verschrotten)
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Fügt eine robuste Werkzeugleiste über der Fahrzeugtabelle in Leitstellen UND allen Wachentypen ein.
// @author       Masklin
// @match        https://www.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://missionchief.com/buildings/*
// @match        https://*.missionchief.com/buildings/*
// @match        https://leitstellenspiel.com/buildings/*
// @match        https://*.leitstellenspiel.com/buildings/*
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/541690/Fahrzeug-Tool%20%28Besatzung%2C%20FMS%2C%20R%C3%BCckalarm%20%20Verschrotten%29.user.js
// @updateURL https://update.greasyfork.org/scripts/541690/Fahrzeug-Tool%20%28Besatzung%2C%20FMS%2C%20R%C3%BCckalarm%20%20Verschrotten%29.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = '[Fahrzeug-Tool]';
    // Die Prüfung, ob es eine Leitstellenseite ist, bleibt für die Spalten-Logik und den KM-Button wichtig.
    const isDispatchPage = !!document.querySelector('ul.nav-tabs a[href="#tab_vehicle"]');

    // Baut die UI-Elemente und gibt sie zurück
    function buildControls(progressBar) {
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
        setFms2Btn.addEventListener('mouseover', function() { this.style.backgroundColor = '#f0ad4e'; this.style.color = 'black'; });
        setFms2Btn.addEventListener('mouseout', function() { this.style.backgroundColor = ''; this.style.color = ''; });
        fmsBtnGroup.appendChild(setFms2Btn);
        const setFms6Btn = document.createElement('button');
        setFms6Btn.textContent = '6';
        setFms6Btn.className = 'btn btn-xs';
        setFms6Btn.style.backgroundColor = 'black';
        setFms6Btn.style.color = 'white';
        setFms6Btn.style.borderColor = 'black';
        setFms6Btn.style.width = '25px';
        setFms6Btn.addEventListener('mouseover', function() { this.style.backgroundColor = '#f0ad4e'; this.style.color = 'black'; });
        setFms6Btn.addEventListener('mouseout', function() { this.style.backgroundColor = 'black'; this.style.color = 'white'; });
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

        crewBtn.addEventListener('click', () => handleCrewAction(progressBar));
        backalarmBtn.addEventListener('click', () => handleBackalarmAction(progressBar));
        scrapBtn.addEventListener('click', () => handleScrapAction(progressBar));
        setFms6Btn.addEventListener('click', () => handleSetFms(6, '2', progressBar));
        setFms2Btn.addEventListener('click', () => handleSetFms(2, '6', progressBar));
        return mainContainer;
    }

    function getVisibleVehicleRows() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable) return [];
        return Array.from(vehicleTable.querySelectorAll('tbody tr')).filter(row => row.style.display !== 'none');
    }

    async function handleScrapAction(progressBar) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert('Keine sichtbaren Fahrzeuge zum Verschrotten gefunden.'); return; }
        if (!confirm(`ACHTUNG!\nMöchten Sie wirklich ${vehicleIds.length} Fahrzeuge unwiderruflich verschrotten?\n\nDIESE AKTION KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!`)) return;
        await processWithProgress(vehicleIds, progressBar, async (id) => {
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
        // Die Spaltenerkennung per Inhalt ist robuster als per Index
        const statusSpan = row.querySelector('span.building_list_fms');
        return statusSpan?.textContent.trim();
    }

    async function handleBackalarmAction(progressBar) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.filter(row => {
            const status = getFmsStatusFromRow(row);
            return status && !['1', '2', '6'].includes(status);
        }).map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert('Keine Fahrzeuge zum Rückalarmieren gefunden.'); return; }
        if (!confirm(`Möchten Sie ${vehicleIds.length} Fahrzeuge zur Wache zurückalarmieren?`)) return;
        await processWithProgress(vehicleIds, progressBar, async (id) => {
            await fetch(`/vehicles/${id}/backalarm?return=vehicle_show`);
        }, 50);
    }

    async function handleSetFms(targetStatus, currentStatusFilter, progressBar) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.filter(row => getFmsStatusFromRow(row) === currentStatusFilter)
            .map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert(`Keine sichtbaren Fahrzeuge mit Status ${currentStatusFilter} gefunden.`); return; }
        if (!confirm(`Möchten Sie ${vehicleIds.length} Fahrzeuge von Status ${currentStatusFilter} auf ${targetStatus} setzen?`)) return;
        await processWithProgress(vehicleIds, progressBar, async (id) => {
            await fetch(`/vehicles/${id}/set_fms/${targetStatus}`);
        }, 50);
    }

    async function handleCrewAction(progressBar) {
        const rows = getVisibleVehicleRows();
        const vehicleIds = rows.map(row => row.querySelector('td a[href*="/vehicles/"]')?.href.match(/\/vehicles\/(\d+)/)?.[1]).filter(Boolean);
        if (vehicleIds.length === 0) { alert('Keine sichtbaren Fahrzeuge gefunden.'); return; }
        if (!confirm(`Für ${vehicleIds.length} Fahrzeuge die maximale Besatzung einstellen?`)) return;
        await processWithProgress(vehicleIds, progressBar, async (id) => {
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

    async function processWithProgress(ids, progressBar, action, delay) {
        const progressContainer = progressBar.parentNode;
        progressContainer.style.display = 'block';
        progressBar.className = 'progress-bar progress-bar-info progress-bar-striped active';
        progressBar.style.width = '0%';
        progressBar.textContent = `0 / ${ids.length}`;
        let processed = 0, failed = 0;
        for (const id of ids) {
            try { await action(id); }
            catch (e) { console.error(`${SCRIPT_PREFIX} Fehler bei ID ${id}:`, e); failed++; }
            processed++;
            progressBar.style.width = `${Math.round((processed / ids.length) * 100)}%`;
            progressBar.textContent = `${processed} / ${ids.length}`;
            await new Promise(res => setTimeout(res, delay));
        }
        progressBar.classList.remove('progress-bar-striped', 'active');
        progressBar.classList.add(failed > 0 ? 'progress-bar-danger' : 'progress-bar-success');
        const summary = `Vorgang abgeschlossen. ${processed - failed} Aktionen erfolgreich.`;
        alert(summary + (failed > 0 ? ` ${failed} Fehler.` : ''));
        finishAndReload();
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

    function run() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable || document.getElementById('lssToolContainer')) return;

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress';
        progressContainer.style.display = 'none';
        progressContainer.style.marginBottom = '10px';
        const progressBar = document.createElement('div');
        progressBar.id = 'lssToolProgressBar';
        progressBar.className = 'progress-bar';
        progressBar.style.width = '0%';
        progressContainer.appendChild(progressBar);

        const controls = buildControls(progressBar);

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