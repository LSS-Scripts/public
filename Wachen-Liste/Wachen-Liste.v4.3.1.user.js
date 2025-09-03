// ==UserScript==
// @name         Leitstellenspiel Wachen-Übersicht (Dark-Mode-Design) [Angepasst für B&M Manager]
// @namespace    http://tampermonkey.net/
// @version      4.3.1
// @description  Korrekte Stellplatz-Berechnung für Rettungswachen (+10 für Großwache). Lädt Abhängigkeiten selbst.
// @author       Masklin / Anpassung von Gemini
// @match        https://www.leitstellenspiel.de/
// @grant        GM_addStyle
// ==/UserScript==

(async function() {
    'use strict';

    /**
     * NEUER ABSCHNITT: Abhängigkeiten dynamisch nachladen
     * Diese Funktion sorgt dafür, dass jQuery und DataTables geladen werden,
     * da der B&M Scriptmanager die @require-Anweisungen ignoriert.
     */
    const loadScript = (url) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    try {
        // Prüfen, ob jQuery geladen ist. Leitstellenspiel.de lädt es oft selbst, aber sicher ist sicher.
        if (typeof jQuery === 'undefined' || typeof $ === 'undefined') {
            console.log('Wachen-Übersicht: Lade jQuery...');
            await loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
        }
        // Prüfen, ob die DataTables-Bibliothek geladen ist.
        if (typeof $.fn.dataTable === 'undefined') {
            console.log('Wachen-Übersicht: Lade DataTables...');
            await loadScript('https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js');
        }
    } catch (error) {
        console.error("Fehler beim Laden der Abhängigkeiten für Wachen-Übersicht:", error);
        alert("Wachen-Übersicht konnte nicht gestartet werden, da eine benötigte Bibliothek nicht geladen werden konnte. Bitte die Seite neu laden.");
        return; // Skriptausführung abbrechen
    }
    // ENDE DES NEUEN ABSCHNITTS


    /*
     * AB HIER FOLGT DER ORIGINALE, UNVERÄNDERTE SKRIPT-CODE
     */
    GM_addStyle(`
        /* CSS für Dark-Mode-Design und den Filter-Bauer */
        @import url('https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css');
        .lss-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); z-index: 9998; display: flex; justify-content: center; align-items: center; }
        .lss-modal-content { background-color: #282c34; color: #dcdcdc; padding: 25px; border-radius: 8px; border: 1px solid #444; width: 80%; max-width: 1200px; max-height: 90vh; overflow-y: auto; box-shadow: 0 5px 25px rgba(0,0,0,0.5); position: relative; }
        .lss-modal-content h2 { margin-top: 0; color: #ffffff; border-bottom: 2px solid #e03c31; padding-bottom: 10px; }
        .lss-modal-close { position: absolute; top: 15px; right: 20px; font-size: 32px; font-weight: bold; cursor: pointer; color: #aaa; transition: color 0.2s; }
        .lss-modal-close:hover { color: #fff; }
        .filter-controls { margin-bottom: 20px; padding: 15px; background-color: #333842; border-radius: 5px; border: 1px solid #444; display: flex; flex-direction: column; gap: 15px; }
        .filter-row-basic { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
        .filter-group { display: flex; align-items: center; gap: 10px; }
        .filter-controls label { font-weight: bold; color: #dcdcdc; margin: 0; }
        .filter-controls input[type=range] { vertical-align: middle; }
        .filter-controls input[type=text], .filter-controls select { background-color: #5a6268; border: 1px solid #6c757d; color: #dcdcdc; border-radius: 4px; padding: 8px; }
        .level-value-span { font-weight: bold; font-size: 1.1em; color: #52d68a; background-color: #282c34; padding: 2px 8px; border-radius: 4px; min-width: 25px; text-align: center; }
        #extensionFiltersContainer .filter-row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
        .remove-filter-btn { background-color: #e03c31; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; font-weight: bold; cursor: pointer; line-height: 25px; text-align: center; }
        #addExtensionFilterBtn { background-color: #52d68a; color: #282c34; border: none; border-radius: 4px; padding: 8px 12px; font-weight: bold; cursor: pointer; align-self: flex-start; }
        .dataTables_wrapper { color: #dcdcdc; } .dataTables_length, .dataTables_filter, .dataTables_info, .dataTables_paginate { margin-bottom: 15px; }
        #wachenTable { border-collapse: collapse; } #wachenTable thead th { background-color: #383e49; color: #ffffff; border-bottom: 2px solid #e03c31; font-weight: bold; }
        #wachenTable tbody td { padding: 10px; border-bottom: 1px solid #444; } #wachenTable tbody td a { color: #528bff; text-decoration: none; font-weight: bold; } #wachenTable tbody td a:hover { text-decoration: underline; }
        #wachenTable tbody tr:nth-of-type(even) { background-color: #2c313a; } #wachenTable tbody tr:hover { background-color: #4a5162; color: #fff; cursor: default; } #wachenTable tbody tr:last-child td { border-bottom: none; }
        .building-type-filter-container { display: flex; gap: 10px; margin-bottom: 10px; }
        .building-type-filter { background-color: #454c59; color: #dcdcdc; border: 1px solid #6c757d; border-radius: 4px; padding: 8px 12px; cursor: pointer; user-select: none; transition: background-color 0.2s; }
        .building-type-filter.active { background-color: #528bff; border-color: #528bff; color: #fff; }
        #wachen-uebersicht-link > .glyphicon { margin-right: 10px; }
    `);

    let wachenTableInstance = null;
    let customFilterFunction = null;
    let allBuildings = [];
    const buildingTypeNames = {
        0: 'Feuerwache',
        2: 'Rettungswache',
        6: 'Polizeiwache'
    };

    function formatDate(isoString) { return new Date(isoString).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'; }

    function closeModal() {
        const modal = document.getElementById('wachenUebersichtModal');
        if (modal) {
            if (customFilterFunction) {
                const index = $.fn.dataTable.ext.search.indexOf(customFilterFunction);
                if (index > -1) { $.fn.dataTable.ext.search.splice(index, 1); }
            }
            if (wachenTableInstance) { wachenTableInstance.destroy(); wachenTableInstance = null; }
            modal.remove();
        }
    }

    async function showWachenModal() {
        if (document.getElementById('wachenUebersichtModal')) return;

        const modalHtml = `<div id="wachenUebersichtModal" class="lss-modal-overlay"><div class="lss-modal-content"><span class="lss-modal-close">&times;</span><h2>Wachen-Übersicht</h2><p>Lade Wachen- und Fahrzeugdaten, bitte warten...</p></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.querySelector('.lss-modal-close').addEventListener('click', closeModal);

        try {
            const [buildingsResponse, vehiclesResponse] = await Promise.all([ fetch('/api/buildings'), fetch('/api/vehicles') ]);
            allBuildings = await buildingsResponse.json();
            const vehicles = await vehiclesResponse.json();
            const vehicleCounts = vehicles.reduce((acc, v) => ({...acc, [v.building_id]: (acc[v.building_id] || 0) + 1}), {});

            const relevantBuildings = allBuildings.filter(b => b.building_type in buildingTypeNames);
            const levels = relevantBuildings.map(s => s.level);
            const minLevel = Math.min(...levels, 0);
            const maxLevel = Math.max(...levels, 1);

            const modalContent = document.querySelector('#wachenUebersichtModal .lss-modal-content');
            modalContent.innerHTML = `
                <span class="lss-modal-close">&times;</span>
                <h2>Wachen-Übersicht (${relevantBuildings.length} Wachen)</h2>
                <div class="filter-controls">
                    <div class="building-type-filter-container">
                        <label>Wachentypen:</label>
                        <div class="building-type-filter active" data-type="0">Feuerwache</div>
                        <div class="building-type-filter active" data-type="2">Rettungswache</div>
                        <div class="building-type-filter active" data-type="6">Polizeiwache</div>
                    </div>
                    <div class="filter-row-basic">
                        <div class="filter-group"><label for="nameFilter">Wachenname:</label><input type="text" id="nameFilter" placeholder="Namensteil..."></div>
                        <div class="filter-group"><label for="levelFilterMin">Level (min):</label><input type="range" id="levelFilterMin" min="${minLevel}" max="${maxLevel}" value="${minLevel}"><span id="levelValueMin" class="level-value-span">${minLevel}</span></div>
                        <div class="filter-group"><label for="levelFilterMax">Level (max):</label><input type="range" id="levelFilterMax" min="${minLevel}" max="${maxLevel}" value="${maxLevel}"><span id="levelValueMax" class="level-value-span">${maxLevel}</span></div>
                    </div>
                    <div id="extensionFiltersContainer"></div>
                    <button id="addExtensionFilterBtn">+ Erweiterungs-Filter hinzufügen</button>
                </div>
                <table id="wachenTable" class="display" style="width:100%"></table>
            `;

            modalContent.querySelector('.lss-modal-close').addEventListener('click', closeModal);

            const updateExtensionFilterOptions = () => {
                const activeTypes = Array.from(document.querySelectorAll('.building-type-filter.active')).map(el => parseInt(el.dataset.type, 10));
                const relevantExtensions = new Set();
                allBuildings
                    .filter(b => activeTypes.includes(b.building_type))
                    .forEach(b => b.extensions.forEach(e => relevantExtensions.add(e.caption)));
                const sortedExtensions = Array.from(relevantExtensions).sort();
                const newOptions = sortedExtensions.map(e => `<option value="${e}">${e}</option>`).join('');
                document.querySelectorAll('#extensionFiltersContainer .extension-select').forEach(sel => sel.innerHTML = newOptions);
            };

            $('.building-type-filter').on('click', function() {
                $(this).toggleClass('active');
                updateExtensionFilterOptions();
                wachenTableInstance.draw();
            });

            const addFilterRowFunc = () => {
                const newRow = document.createElement('div');
                newRow.className = 'filter-row';
                newRow.innerHTML = `<select class="condition-select"><option value="has">Hat Erweiterung</option><option value="not_has">Hat NICHT</option><option value="is_building">im Bau</option></select><select class="extension-select"></select><button class="remove-filter-btn">&times;</button>`;
                $('#extensionFiltersContainer').append(newRow);
                updateExtensionFilterOptions();
                wachenTableInstance.draw();
            };

            $('#addExtensionFilterBtn').on('click', addFilterRowFunc);
            $('#extensionFiltersContainer').on('click', '.remove-filter-btn', function() { $(this).closest('.filter-row').remove(); wachenTableInstance.draw(); });
            $('#extensionFiltersContainer').on('change', 'select', () => wachenTableInstance.draw());

            const tableData = relevantBuildings.map(station => {
                let stellplaetze = station.level + 1;
                // ### NEU: Stellplatzlogik für Großwache um Rettungswachen erweitert ###
                if ([0, 2, 6].includes(station.building_type) && station.extensions.some(e => e.caption === 'Großwache')) {
                    stellplaetze += 10;
                }

                const belegt = vehicleCounts[station.id] || 0;
                const frei = stellplaetze - belegt;
                const extensionsList = station.extensions.length > 0 ? station.extensions.map(ext => {
                    let status = ext.available_at ? ` (im Bau bis ${formatDate(ext.available_at)})` : '';
                    return `&bull; ${ext.caption}${status}`;
                }).join('<br>') : 'Keine Erweiterungen';
                const tooltipTitle = `Erweiterungen:\n${extensionsList.replace(/<br>/g, '\n').replace(/&bull; /g, '• ')}`;
                const stationLink = `<a href="/buildings/${station.id}" target="_blank" rel="noopener noreferrer" title="${tooltipTitle}">${station.caption}</a>`;

                return [stationLink, buildingTypeNames[station.building_type], station.personal_count, stellplaetze, belegt, frei];
            });

            wachenTableInstance = $('#wachenTable').DataTable({
                data: tableData,
                columns: [ { title: "Name" }, { title: "Typ" }, { title: "Personal" }, { title: "Stellplätze" }, { title: "Belegt" }, { title: "Frei" } ],
                dom: 'lrtip',
                createdRow: (row, data) => {
                    const freiCell = $('td:eq(5)', row);
                    freiCell.css('font-weight', 'bold').css('color', data[5] > 0 ? '#52d68a' : (data[5] < 0 ? '#e03c31' : ''));
                },
                pageLength: 10,
                language: { lengthMenu: "_MENU_ Einträge", info: "Zeige _START_ bis _END_ von _TOTAL_", infoEmpty: "Nichts gefunden", infoFiltered: "(gefiltert aus _MAX_)", paginate: { previous: "Zurück", next: "Weiter" } }
            });

            $('#nameFilter').on('keyup', () => wachenTableInstance.draw());
            $('#levelFilterMin, #levelFilterMax').on('input', function() {
                $(`#levelValue${$(this).attr('id').replace('levelFilter', '')}`).text($(this).val());
                wachenTableInstance.draw();
            });

            customFilterFunction = function(settings, data, dataIndex) {
                const station = relevantBuildings[dataIndex];
                if (!station) return false;
                const activeTypes = Array.from(document.querySelectorAll('.building-type-filter.active')).map(el => parseInt(el.dataset.type, 10));
                if (!activeTypes.includes(station.building_type)) return false;
                const nameFilter = $('#nameFilter').val().toLowerCase();
                if (nameFilter && !station.caption.toLowerCase().includes(nameFilter)) return false;
                const minLevel = parseInt($('#levelFilterMin').val(), 10);
                const maxLevel = parseInt($('#levelFilterMax').val(), 10);
                if (station.level < minLevel || station.level > maxLevel) return false;
                let allRulesMet = true;
                document.querySelectorAll('#extensionFiltersContainer .filter-row').forEach(row => {
                    if (!allRulesMet) return;
                    const condition = row.querySelector('.condition-select').value;
                    const extName = row.querySelector('.extension-select').value;
                    if (!extName) return;
                    switch (condition) {
                        case 'has': if (!station.extensions.some(e => e.caption === extName && e.enabled)) allRulesMet = false; break;
                        case 'not_has': if (station.extensions.some(e => e.caption === extName)) allRulesMet = false; break;
                        case 'is_building': if (!station.extensions.some(e => e.caption === extName && e.available_at)) allRulesMet = false; break;
                    }
                });
                return allRulesMet;
            };
            $.fn.dataTable.ext.search.push(customFilterFunction);

            updateExtensionFilterOptions();
            wachenTableInstance.draw();

        } catch (error) {
            console.error('Fehler beim Abrufen oder Verarbeiten der Daten:', error);
            document.querySelector('#wachenUebersichtModal .lss-modal-content p').textContent = 'Fehler beim Laden der Daten.';
        }
    }

    function addMenuItem() {
        const settingsLink = document.querySelector('a[href="/settings/index"]');
        if (settingsLink) {
            const settingsLi = settingsLink.parentElement;
            if (document.getElementById('wachen-uebersicht-link')) return;
            const newLi = document.createElement('li');
            newLi.setAttribute('role', 'presentation');
            const newLink = document.createElement('a');
            newLink.id = 'wachen-uebersicht-link';
            newLink.href = '#';
            newLink.innerHTML = '<span class="glyphicon glyphicon-home" aria-hidden="true"></span> Wachen-Übersicht';
            newLink.style.cursor = 'pointer';
            newLink.addEventListener('click', (e) => { e.preventDefault(); showWachenModal(); });
            newLi.appendChild(newLink);
            settingsLi.parentNode.insertBefore(newLi, settingsLi.nextSibling);
        }
    }

    // Warten, bis das Dokument geladen ist, bevor wir den Menüpunkt hinzufügen.
    // jQuery ($) ist dank unseres Laders an dieser Stelle garantiert verfügbar.
    $(document).ready(function() {
        addMenuItem();
    });

})();
