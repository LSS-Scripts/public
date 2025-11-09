// ==UserScript==
// @name         Leitstellenspiel Gebäude- & Personalstatistik (V9.2)
// @namespace    http://tampermonkey.net/
// @version      9.6
// @description  Zählt Personal, Wachen pro Leitstelle (mit % und Aktiv/Inaktiv-Status), inkl. Deaktivierungs-Aktion (Blaues Theme)
// @author       Gemini (bearbeitet)
// @match        https://www.leitstellenspiel.de/*
// @grant        GM.xmlHttpRequest
// @grant        GM_addStyle
// @connect      leitstellenspiel.de
// ==/UserScript==

(function() {
    'use strict';

    // --- Konstanten ---
    const MAX_CONCURRENT_WORKERS = 8;
    const UPDATE_UI_EVERY_X_BUILDINGS = 10;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const BUILDING_TYPE_MAP = {
        0: 'Feuerwache', 1: 'Feuerwehrschule', 2: 'Rettungswache', 3: 'Rettungsschule',
        4: 'Krankenhaus', 5: 'Rettungshubschrauber-Station', 6: 'Polizeiwache', 7: 'Leitstelle',
        8: 'Polizeischule', 9: 'THW', 10: 'THW Bundesschule', 11: 'Bereitschaftspolizei',
        12: 'Schnelleinsatzgruppe (SEG)', 13: 'Polizeihubschrauberstation', 14: 'Bereitstellungsraum',
        15: 'Wasserrettung', 17: 'Polizei-Sondereinheiten', 18: 'Feuerwache (Kleinwache)',
        19: 'Polizeiwache (Kleinwache)', 20: 'Rettungswache (Kleinwache)', 21: 'Rettungshundestaffel',
        24: 'Reiterstaffel', 25: 'Bergrettungswache', 26: 'Seenotrettungswache',
        27: 'Schule für Seefahrt und Seenotrettung', 28: 'Hubschrauberstation (Seenotrettung)'
    };

    const getBuildingName = (type) => BUILDING_TYPE_MAP[type] || `Unbekannter Typ (${type})`;

    // Globaler Speicher für Daten, die von Event-Handlern benötigt werden
    let scriptDataStore = {
        leitstelleBuildingLists: new Map(),
        leitstellenMap: new Map(),
        tasks: [] // NEU V9.6
    };
    // --- Eigene CSS-Stile ---
    const customCss = `
        /* Modal breiter und feste Mindestbreite */
        #gemini_building_stats_modal .modal-dialog {
            width: 90%;
            max-width: 1600px;
            min-width: 1000px;
        }
        /* Statistik-Box (allgemein) */
        .gemini-stat-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #3a3a3a; /* Dunkelgrau */
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            color: #f1f1f1;
            font-weight: 500;
        }
        /* Zähler (Badge) in warmem Blau */
        .gemini-stat-badge {
            background-color: #3498db; /* Helles Blau */
            color: #ffffff;
            padding: 5px 10px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 10px;
        }
        /* Überschriften in einem passenden Blauton */
        #gemini_building_stats_modal h4 {
            color: #5bc0de; /* Ein hellerer Blauton für Überschriften */
            margin-top: 15px;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
            padding-bottom: 5px;
        }

        /* NEU V9.2: Stat-Box pro Leitstelle (detailliert) */
        .gemini-ls-stat-box {
            background-color: #3a3a3a;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 6px;
            color: #f1f1f1;
            border-left: 4px solid #3498db; /* Blauer Rand */
            height: 95%; /* Für gleiche Höhe in einer Reihe */
        }
        .gemini-ls-stat-box-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .gemini-ls-stat-box-header .gemini-stat-badge {
            font-size: 13px;
            padding: 4px 8px;
        }
        .gemini-ls-stat-box-details {
            font-size: 12px;
        }
        .gemini-ls-stat-box-details span {
            margin-right: 15px;
        }
        /* Bootstrap-Farben für Text */
        .text-success { color: #5cb85c; }
        .text-danger { color: #d9534f; }
        .text-info { color: #5bc0de; }
        .text-warning { color: #f0ad4e; }

        /* NEU V9.2: Aktion-Box */
        .gemini-action-box {
            background-color: #2f2f2f;
            border: 1px solid #444;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
        }
        .gemini-action-box .form-control {
            width: 100px;
            display: inline-block;
            margin-right: 10px;
            background-color: #555;
            color: #fff;
            border: 1px solid #666;
        }
        .gemini-action-box h5 {
            margin-top: 0;
            color: #f1f1f1;
            font-weight: bold;
        }
    `;
    GM_addStyle(customCss);


    // --- Haupt-Statistik-Funktion ---

    async function showBuildingStats(event) {
        if(event) event.preventDefault();
        console.log('[LSS-Statistik V9.6] Starte Statistik-Erhebung...');

        // Modal (neu) initialisieren
        showModal('<h4 id="gemini_stats_title">Lade Gebäudeliste...</h4><div id="gemini_stats_body"></div>');
        const modalTitle = document.getElementById('gemini_stats_title');
        const modalBody = document.getElementById('gemini_stats_body');

        // Daten-Store bei jedem Lauf zurücksetzen
        scriptDataStore = {
            leitstelleBuildingLists: new Map(),
            leitstellenMap: new Map()
        };

        try {
            const response = await fetch('https://www.leitstellenspiel.de/api/buildings');
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            const buildings = await response.json();

            // --- V9.1: Leitstellen-Map erstellen ---
            const leitstellenMap = new Map();
            leitstellenMap.set(null, "Ohne Leitstelle"); // Für nicht zugeordnete
            for (const building of buildings) {
                if (building.building_type === 7) { // 7 = Leitstelle
                    leitstellenMap.set(building.id, building.caption);
                }
            }
            scriptDataStore.leitstellenMap = leitstellenMap; // Im globalen Store speichern

            // --- V9.2: Umfassende Zählung ---
            const allBuildingIds = [];
            const buildingCounts = new Map(); // Globale Typ-Zählung
            const personnelCounts = new Map(); // Globale Personal-Zählung
            const leitstelleBuildingCounts = new Map(); // Detaillierte Zählung pro LS
            const leitstelleBuildingLists = new Map(); // ID-Listen für Aktionen
            const globalBuildingStats = { total: 0, enabled: 0, disabled: 0 };
            let totalPersonnel = 0;
            const tasks = [];

            for (const building of buildings) {
                allBuildingIds.push(building.id);
                const type = building.building_type;
                const pCount = building.personal_count;

                // --- Globale Zählung (V9.2) ---
                globalBuildingStats.total++;
                building.enabled ? globalBuildingStats.enabled++ : globalBuildingStats.disabled++;

                buildingCounts.set(type, (buildingCounts.get(type) || 0) + 1);
                personnelCounts.set(type, (personnelCounts.get(type) || 0) + pCount);
                totalPersonnel += pCount;

                // --- Zählung pro Leitstelle (V9.2) ---
                if (type !== 7) { // Leitstellen selbst nicht mitzählen
                    const leitstelle_id = building.leitstelle_building_id || null;

                    // Initialisiere Maps, falls nötig
                    if (!leitstelleBuildingLists.has(leitstelle_id)) {
                        leitstelleBuildingLists.set(leitstelle_id, new Map()); // Map für Typen
                    }
                    if (!leitstelleBuildingCounts.has(leitstelle_id)) {
                        leitstelleBuildingCounts.set(leitstelle_id, new Map());
                    }

                    const lsTypeLists = leitstelleBuildingLists.get(leitstelle_id);

                    // Initialisiere Listen für diesen Gebäudetyp
                    if (!lsTypeLists.has(type)) {
                        lsTypeLists.set(type, { enabled: [], disabled: [] });
                    }

                    // ID zur Aktions-Liste hinzufügen
                    const typeLists = lsTypeLists.get(type);
                    building.enabled ?
                        typeLists.enabled.push(building.id) :
                        typeLists.disabled.push(building.id);

                    // Details für Statistik-Box zählen
                    const statsForThisLS = leitstelleBuildingCounts.get(leitstelle_id);
                    const typeStats = statsForThisLS.get(type) || { total: 0, enabled: 0, disabled: 0 };

                    typeStats.total++;
                    building.enabled ? typeStats.enabled++ : typeStats.disabled++;
                    statsForThisLS.set(type, typeStats);
                }
                // --- Ende Zählung pro LS ---

                if (pCount > 0) {
                    tasks.push({
                        id: building.id,
                        url: `https://www.leitstellenspiel.de/buildings/${building.id}/personals`
                    });
                }
            }

            // Aktions-Listen im globalen Store sichern
            scriptDataStore.leitstelleBuildingLists = leitstelleBuildingLists;
            scriptDataStore.tasks = tasks; // NEU V9.6

            console.log(`[LSS-Statistik V9.6] ${buildings.length} Gebäude gefunden. ${tasks.length} Gebäude mit Personal werden gescannt.`);
            console.log('[LSS-Statistik V9.6] Gesammelte Gebäude-IDs:', allBuildingIds);

            // --- HTML zusammensetzen (V9.2) ---
            const baseHtml = generateBaseStatsHtml(buildingCounts, personnelCounts, globalBuildingStats.total, totalPersonnel, globalBuildingStats);
            const leitstellenHtml = generateLeitstellenStatsHtml(leitstelleBuildingCounts, scriptDataStore.leitstellenMap);
            modalBody.innerHTML = baseHtml + leitstellenHtml;
            // --- Ende HTML ---

            modalTitle.textContent = 'Gebäude- & Personalstatistik';

            // NEU V9.6: Manuelles Starten des Personal-Scans
            modalBody.innerHTML += `
                <div id="gemini-personnel-scan-section">
                    <hr style="border-color: #444;">
                    <div class="gemini-action-box" id="gemini-scan-control-box">
                        <h5 style="margin-top: 0;">Personal-Detailscan (Optional)</h5>
                        <p style="color: #ccc; margin-bottom: 15px;">Sammelt Details zu Ausbildungen und Rollen. Starten Sie dies erst, NACHDEM Sie (De-)Aktivierungen vorgenommen haben, um Konflikte zu vermeiden.</p>
                        <button class="btn btn-primary" id="gemini_start_scan_btn">
                            <span class="glyphicon glyphicon-play" aria-hidden="true" style="margin-right: 5px;"></span> Personal-Scan jetzt starten
                        </button>
                    </div>
                    <div id="gemini-progress-wrapper" style="display: none;"></div>
                    <div id="gemini-training-stats-wrapper" style="display: none;"><h4>Personal in Ausbildung</h4><div id="gemini-training-stats"></div></div>
                    <div id="gemini-role-stats-wrapper" style="display: none;"><h4>Ausgebildetes Personal (Rollen)</h4><div id="gemini-role-stats"></div></div>
                </div>
            `;

            // V9.6: Scan wird nicht mehr automatisch gestartet
            /*
            await scanPersonnelPages(
                tasks,
                document.getElementById('gemini-progress-wrapper'),
                document.getElementById('gemini-training-stats'),
                document.getElementById('gemini-role-stats')
            );
            */

        } catch (error) {
            console.error('[LSS-Statistik V9.6] Fehler:', error);
            modalBody.innerHTML = `<div class="alert alert-danger">Fehler beim Abrufen der Daten: ${error.message}</div>`;
        }
    }

    /**
     * Generiert das HTML für die globalen Statistiken (V9.2 Update)
     */
    function generateBaseStatsHtml(buildingCounts, personnelCounts, totalBuildings, totalPersonnel, globalBuildingStats) {
        let totalHtml = '<h4>Gesamtstatistik</h4>';

        // NEU V9.2: Aufgeteilte Gesamt-Statistik
        totalHtml += '<div class="row">';
        totalHtml += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box"><strong>Gesamtgebäude</strong><span class="gemini-stat-badge">${totalBuildings.toLocaleString()}</span></div></div>`;
        totalHtml += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #5cb85c;"><strong>Aktiv</strong><span class="gemini-stat-badge">${globalBuildingStats.enabled.toLocaleString()}</span></div></div>`;
        totalHtml += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #d9534f;"><strong>Deaktiviert</strong><span class="gemini-stat-badge">${globalBuildingStats.disabled.toLocaleString()}</span></div></div>`;
        totalHtml += '</div>';
        totalHtml += '<div class="row">';
        totalHtml += `<div class="col-md-12 col-sm-12 col-xs-12"><div class="gemini-stat-box"><strong>Gesamtpersonal (aus API)</strong><span class="gemini-stat-badge">${totalPersonnel.toLocaleString()}</span></div></div>`;
        totalHtml += '</div>';

        // Gebäudeanzahl (Global)
        let buildingGridHtml = '<h4>Gebäudeanzahl (Global)</h4><div class="row">';
        const sortedBuildingCounts = new Map([...buildingCounts.entries()].sort((a, b) => a[0] - b[0]));
        for (const [type, count] of sortedBuildingCounts.entries()) {
            buildingGridHtml += `<div class="col-md-3 col-sm-6 col-xs-12">
                <div class="gemini-stat-box">
                    <span>${getBuildingName(type)}</span>
                    <span class="gemini-stat-badge">${count.toLocaleString()}</span>
                </div>
            </div>`;
        }
        buildingGridHtml += '</div>';

        // Personalanzahl (Global)
        let personnelGridHtml = '<h4>Personalanzahl (Global, aus API)</h4><div class="row">';
        const sortedPersonnelCounts = new Map([...personnelCounts.entries()].sort((a, b) => a[0] - b[0]));
        for (const [type, count] of sortedPersonnelCounts.entries()) {
             personnelGridHtml += `<div class="col-md-3 col-sm-6 col-xs-12">
                <div class="gemini-stat-box">
                    <span>${getBuildingName(type)}</span>
                    <span class="gemini-stat-badge">${count.toLocaleString()}</span>
                </div>
            </div>`;
        }
        personnelGridHtml += '</div>';

        return totalHtml + buildingGridHtml + personnelGridHtml;
    }

    /**
     * Generiert das HTML für die nach Leitstellen gruppierten Wachenzählungen (V9.2 Update)
     */
    function generateLeitstellenStatsHtml(leitstelleBuildingCounts, leitstellenMap) {
        let html = '<h4>Wachenverhältnis pro Leitstelle</h4>';

        const sortedLeitstellen = [...leitstelleBuildingCounts.entries()].sort((a, b) => {
            const nameA = leitstellenMap.get(a[0]) || 'ZZZ';
            const nameB = leitstellenMap.get(b[0]) || 'ZZZ';
            return nameA.localeCompare(nameB);
        });

        if (sortedLeitstellen.length === 0) {
             html += '<div class="alert alert-info">Keine Wachen gefunden, die einer Leitstelle zugeordnet sind.</div>';
             return html;
        }

        for (const [leitstelle_id_raw, buildingCountsMap] of sortedLeitstellen) {
            // ID für DOM-Elemente (null wird zu "null")
            const leitstelle_id_dom = leitstelle_id_raw === null ? 'null' : leitstelle_id_raw;
            const lsName = leitstellenMap.get(leitstelle_id_raw) || `Unbekannte LS (ID: ${leitstelle_id_raw})`;

            // V9.2: Gesamt-Stats für diese LS berechnen
            let lsTotalBuildings = 0;
            let lsTotalEnabled = 0;
            let lsTotalDisabled = 0;
            for (const stats of buildingCountsMap.values()) {
                lsTotalBuildings += stats.total;
                lsTotalEnabled += stats.enabled;
                lsTotalDisabled += stats.disabled;
            }

            html += `<h4>${lsName}</h4>`;

            // V9.2: Summary-Reihe für diese LS
            html += '<div class="row">';
            html += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box"><strong>Gesamt (diese LS)</strong><span class="gemini-stat-badge">${lsTotalBuildings}</span></div></div>`;
            html += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #5cb85c;"><strong>Aktiv</strong><span class="gemini-stat-badge">${lsTotalEnabled}</span></div></div>`;
            html += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #d9534f;"><strong>Deaktiviert</strong><span class="gemini-stat-badge">${lsTotalDisabled}</span></div></div>`;
            html += '</div>';

            // V9.2: Detail-Reihe (3-Spalten-Layout)
            html += '<div class="row">';
            const sortedCounts = new Map([...buildingCountsMap.entries()].sort((a, b) => a[0] - b[0]));

            for (const [type, stats] of sortedCounts) {
                const percent = lsTotalBuildings > 0 ? ((stats.total / lsTotalBuildings) * 100).toFixed(1) : 0;
                html += `<div class="col-md-4 col-sm-6 col-xs-12">
                    <div class="gemini-ls-stat-box">
                        <div class="gemini-ls-stat-box-header">
                            <span>${getBuildingName(type)}</span>
                            <span class="gemini-stat-badge">${stats.total} (${percent}%)</span>
                        </div>
                        <div class="gemini-ls-stat-box-details">
                            <span class="text-success">Aktiv: ${stats.enabled}</span>
                            <span class="text-danger">Deaktiviert: ${stats.disabled}</span>
                        </div>
                    </div>
                </div>`;
            }
            html += '</div>'; // row

            // V9.4: Dropdown-Optionen für beide Aktionen erstellen
            let optionsHtmlDeactivate = '';
            let optionsHtmlActivate = '';
            const sortedTypesForDropdown = [...buildingCountsMap.entries()].sort((a, b) => a[0] - b[0]);

            for (const [type, stats] of sortedTypesForDropdown) {
                if (stats.enabled > 0) {
                    optionsHtmlDeactivate += `<option value="${type}" data-max="${stats.enabled}">${getBuildingName(type)} (Max: ${stats.enabled})</option>`;
                }
                if (stats.disabled > 0) {
                    optionsHtmlActivate += `<option value="${type}" data-max="${stats.disabled}">${getBuildingName(type)} (Max: ${stats.disabled})</option>`;
                }
            }

            // V9.4: Aktions-Box (mit Aktivieren & Deaktivieren)
            html += `
                <div class="row">
                    <div class="col-md-12">
                        <div class="gemini-action-box">
                            <h5 style="margin-bottom: 15px;">Aktionen für ${lsName}</h5>

                            <h6 style="color: #f0ad4e;">Zufällig Deaktivieren</h6>
                            ${ optionsHtmlDeactivate.length > 0 ? `
                            <div>
                                <select id="gemini_deact_type_${leitstelle_id_dom}" class="form-control" style="width: 250px; margin-right: 10px; display: inline-block;">
                                    ${optionsHtmlDeactivate}
                                </select>
                                <input type="number" id="gemini_deact_count_${leitstelle_id_dom}" class="form-control" placeholder="Anzahl" min="1">
                                <button class="btn btn-warning gemini-deactivate-btn" data-ls-id-raw="${leitstelle_id_raw}" data-ls-id-dom="${leitstelle_id_dom}">
                                    Deaktivieren
                                </button>
                                <span id="gemini_deact_max_label_${leitstelle_id_dom}" style="margin-left: 10px; color: #999; font-size: 12px;"></span>
                            </div>
                            <div id="gemini_action_status_deact_${leitstelle_id_dom}" style="margin-top: 10px; min-height: 1.5em;"></div>
                            ` : `
                            <div class="text-info" style="margin-bottom: 15px;">Keine aktivierten Wachen zum Deaktivieren vorhanden.</div>
                            `}

                            <hr style="border-color: #444;">

                            <h6 style="color: #5cb85c;">Zufällig Aktivieren</h6>
                            ${ optionsHtmlActivate.length > 0 ? `
                            <div>
                                <select id="gemini_act_type_${leitstelle_id_dom}" class="form-control" style="width: 250px; margin-right: 10px; display: inline-block;">
                                    ${optionsHtmlActivate}
                                </select>
                                <input type="number" id="gemini_act_count_${leitstelle_id_dom}" class="form-control" placeholder="Anzahl" min="1">
                                <button class="btn btn-success gemini-activate-btn" data-ls-id-raw="${leitstelle_id_raw}" data-ls-id-dom="${leitstelle_id_dom}">
                                    Aktivieren
                                </button>
                                <span id="gemini_act_max_label_${leitstelle_id_dom}" style="margin-left: 10px; color: #999; font-size: 12px;"></span>
                            </div>
                            <div id="gemini_action_status_act_${leitstelle_id_dom}" style="margin-top: 10px; min-height: 1.5em;"></div>
                            ` : `
                            <div class="text-info">Keine deaktivierten Wachen zum Aktivieren vorhanden.</div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }
        return html;

    }


    // --- Worker-Pool & HTML-Parsing ---

    async function scanPersonnelPages(tasks, progressWrapper, trainingDiv, roleDiv) {
        // Progressbar in Blau
        progressWrapper.innerHTML = `
            <h4>Personal-Scan (wird geladen...)</h4>
            <div class="progress" style="background-color: #555;">
                <div id="gemini_stats_progressbar" class="progress-bar progress-bar-info progress-bar-striped active" role="progressbar" style="width: 0%; min-width: 2em;">
                    0 / ${tasks.length}
                </div>
            </div>
            <div id="gemini_stats_progress_details" style="text-align: center; margin-bottom: 15px;">Starte Scan...</div>
        `;
        const progressBar = document.getElementById('gemini_stats_progressbar');
        const progressDetails = document.getElementById('gemini_stats_progress_details');

        const trainingStats = { total: 0, courses: new Map() };
        const trainedRoleStats = { total: 0, roles: new Map() };
        let processedCount = 0;
        const totalTasks = tasks.length;
        const queue = [...tasks];

        const worker = async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (!task) continue;

                try {
                    const html = await fetchPage(task.url);
                    const { coursesFound, rolesFound } = parsePersonnelHtml(html);

                    trainingStats.total += coursesFound.length;
                    coursesFound.forEach(course => trainingStats.courses.set(course, (trainingStats.courses.get(course) || 0) + 1));

                    trainedRoleStats.total += rolesFound.length;
                    rolesFound.forEach(role => trainedRoleStats.roles.set(role, (trainedRoleStats.roles.get(role) || 0) + 1));

                } catch (error) {
                    console.warn(`[LSS-Statistik V9.2] Fehler bei Gebäude ${task.id}:`, error);
                }

                processedCount++;
                const percentage = ((processedCount / totalTasks) * 100).toFixed(1);
                progressBar.style.width = `${percentage}%`;
                progressBar.textContent = `${processedCount} / ${totalTasks}`;
                progressDetails.textContent = `Scanne Gebäude ${task.id}...`;

                if (processedCount % UPDATE_UI_EVERY_X_BUILDINGS === 0 || processedCount === totalTasks) {
                    renderLiveStats(trainingStats, trainedRoleStats, trainingDiv, roleDiv);
                }
            }
        };

        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
            workerPromises.push(worker());
        }

        await Promise.all(workerPromises);

        console.log('[LSS-Statistik V9.6] Scan abgeschlossen. In Ausbildung:', trainingStats);
        console.log('[LSS-Statistik V9.6] Ausgebildete Rollen:', trainedRoleStats);

        progressWrapper.remove();
    }

    /**
     * Rendert die Zähler für Ausbildung und Rollen in ihre Ziel-DIVs.
     */
    function renderLiveStats(trainingStats, trainedRoleStats, trainingDiv, roleDiv) {
        // HTML für "In Ausbildung"
        let trainingHtml = `<div class="row"><div class="col-md-12"><div class="gemini-stat-box"><strong>Gesamt in Ausbildung</strong><span class="gemini-stat-badge">${trainingStats.total.toLocaleString()}</span></div></div></div>`;
        trainingHtml += '<div class="row">';
        const sortedCourses = new Map([...trainingStats.courses.entries()].sort((a, b) => b[1] - a[1]));
        for (const [course, count] of sortedCourses.entries()) {
            trainingHtml += `<div class="col-md-3 col-sm-6 col-xs-12">
                <div class="gemini-stat-box">
                    <span>${course}</span>
                    <span class="gemini-stat-badge">${count.toLocaleString()}</span>
                </div>
            </div>`;
        }
        trainingHtml += '</div>';
        trainingDiv.innerHTML = trainingHtml;

        // HTML für "Ausgebildetes Personal"
        let roleHtml = `<div class="row"><div class="col-md-12"><div class="gemini-stat-box"><strong>Gesamt zugewiesene Rollen</strong><span class="gemini-stat-badge">${trainedRoleStats.total.toLocaleString()}</span></div></div></div>`;
        roleHtml += '<div class="row">';
        const sortedRoles = new Map([...trainedRoleStats.roles.entries()].sort((a, b) => b[1] - a[1]));
        for (const [role, count] of sortedRoles.entries()) {
            roleHtml += `<div class="col-md-3 col-sm-6 col-xs-12">
                <div class="gemini-stat-box">
                    <span>${role}</span>
                    <span class="gemini-stat-badge">${count.toLocaleString()}</span>
                </div>
            </div>`;
        }
        roleHtml += '</div>';
        roleDiv.innerHTML = roleHtml;
    }

    /**
     * Ruft eine Seite mit GM.xmlHttpRequest ab.
     */
    function fetchPage(url) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP Status ${response.status} für ${url}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Fehler beim Abrufen von ${url}: ${error.statusText}`));
                },
                ontimeout: function() {
                    reject(new Error(`Timeout beim Abrufen von ${url}`));
                }
            });
        });
    }

    /**
     * Parst das HTML einer Personal-Seite.
     */
    function parsePersonnelHtml(html) {
        const coursesFound = [];
        const rolesFound = [];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const rows = doc.querySelectorAll('tr[data-filterable-by]');

            rows.forEach(row => {
                const trainingLink = row.querySelector('span.label > a[href*="/schoolings/"]');
                if (trainingLink) {
                    const courseName = trainingLink.textContent.trim();
                    if (courseName) {
                        coursesFound.push(courseName);
                    }
                } else {
                    const roleCell = row.querySelector('td:nth-child(2)');
                    if (roleCell) {
                        const roleNamesString = roleCell.textContent.trim();
                        if (roleNamesString) {
                            const individualRoles = roleNamesString.split(',');
                            for (let role of individualRoles) {
                                const cleanRole = role.trim();
                                if (cleanRole) {
                                    rolesFound.push(cleanRole);
                                }
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('[LSS-Statistik V9.2] Fehler beim Parsen von HTML:', e);
        }
        return { coursesFound, rolesFound };
    }

    // --- NEU V9.2: Aktionen ---

    /**
     * Sendet den Toggle-Befehl für ein Gebäude.
     */
    function toggleBuildingState(buildingId) {
        const url = `https://www.leitstellenspiel.de/buildings/${buildingId}/active`;
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP Status ${response.status} für ${url}`));
                    }
                },
                onerror: function(error) {
                    reject(new Error(`Fehler beim Abrufen von ${url}: ${error.statusText}`));
                },
                ontimeout: function() {
                    reject(new Error(`Timeout beim Abrufen von ${url}`));
                }
            });
        });
    }

    /**
     * Event-Handler für den Deaktivieren-Button (V9.3)
     */
    async function handleDeactivation(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const lsIdRaw = button.dataset.lsIdRaw === 'null' ? null : parseInt(button.dataset.lsIdRaw, 10);
        const lsIdDom = button.dataset.lsIdDom;

        const select = document.getElementById(`gemini_deact_type_${lsIdDom}`);
        const input = document.getElementById(`gemini_deact_count_${lsIdDom}`);
        const statusDiv = document.getElementById(`gemini_action_status_deact_${lsIdDom}`);
        // NEU: Werte auslesen
        if (!select || !input) {
            statusDiv.innerHTML = '<span class="text-danger">Fehler: UI-Elemente nicht gefunden.</span>';
            return;
        }

        const buildingType = parseInt(select.value, 10);
        const selectedOption = select.options[select.selectedIndex];
        const maxCount = parseInt(selectedOption.dataset.max, 10);
        let count = parseInt(input.value, 10);

        // Validierung
        if (isNaN(count) || count <= 0) {
            statusDiv.innerHTML = '<span class="text-danger">Bitte eine gültige Anzahl > 0 eingeben.</span>';
            return;
        }
        if (count > maxCount) {
            statusDiv.innerHTML = `<span class="text-danger">Anzahl zu groß. Es sind nur ${maxCount} Wachen dieses Typs aktiv.</span>`;
            return;
        }

        // NEU: Spezifische Liste holen
        const lsBuildingLists = scriptDataStore.leitstelleBuildingLists.get(lsIdRaw);
        const buildingList = lsBuildingLists ? lsBuildingLists.get(buildingType) : null;

        if (!buildingList || !buildingList.enabled || buildingList.enabled.length === 0) {
            statusDiv.innerHTML = '<span class="text-danger">Fehler: Keine aktivierten Wachen für diesen Typ gefunden.</span>';
            return;
        }

        button.disabled = true;
        input.disabled = true;
        select.disabled = true;
        statusDiv.innerHTML = '<span class="text-info">Starte Deaktivierung...</span>';

        // Zufällige Auswahl treffen
        const shuffledIds = buildingList.enabled.sort(() => 0.5 - Math.random());
        const idsToDeactivate = shuffledIds.slice(0, count);

        // --- NEU V9.5: Worker Pool ---
        const queue = [...idsToDeactivate];
        let successCount = 0;
        let errorCount = 0;
        let processedCount = 0;
        const totalToProcess = queue.length;

        const worker = async () => {
            while (queue.length > 0) {
                const id = queue.shift();
                if (!id) continue;

                try {
                    await toggleBuildingState(id);
                    successCount++;
                } catch (e) {
                    console.error(`[LSS-Statistik V9.5] Fehler bei Deaktivierung von ${id}:`, e);
                    errorCount++;
                }

                processedCount++;

                // UI-Update (thread-safe, da JS single-threaded)
                const percent = ((processedCount / totalToProcess) * 100).toFixed(0);
                statusDiv.innerHTML = `<span class="text-info">Arbeite... Wache ${processedCount} von ${totalToProcess} (${percent}%)</span>`;
            }
        };

        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
            workerPromises.push(worker());
        }

        await Promise.all(workerPromises);
        // --- ENDE Worker Pool ---

        statusDiv.innerHTML = `<span class="text-success">Aktion abgeschlossen: ${successCount} Wachen deaktiviert.</span>`;
        if (errorCount > 0) {
            statusDiv.innerHTML += ` <span class="text-danger">${errorCount} Fehler (siehe Konsole).</span>`;
        }
        statusDiv.innerHTML += `<br><span class="text-warning">Bitte "Statistik neu laden" klicken, um die Änderungen zu sehen.</span>`;
        if (errorCount > 0) {
            statusDiv.innerHTML += ` <span class="text-danger">${errorCount} Fehler (siehe Konsole).</span>`;
        }
        statusDiv.innerHTML += `<br><span class="text-warning">Bitte "Statistik neu laden" klicken, um die Änderungen zu sehen.</span>`;

        // Button nicht re-aktivieren, da die Daten veraltet sind
    }
/**
     * Event-Handler für den Aktivieren-Button (V9.4)
     */
    async function handleActivation(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const lsIdRaw = button.dataset.lsIdRaw === 'null' ? null : parseInt(button.dataset.lsIdRaw, 10);
        const lsIdDom = button.dataset.lsIdDom;

        // NEU: IDs für Aktivieren
        const select = document.getElementById(`gemini_act_type_${lsIdDom}`);
        const input = document.getElementById(`gemini_act_count_${lsIdDom}`);
        const statusDiv = document.getElementById(`gemini_action_status_act_${lsIdDom}`);

        if (!select || !input) {
            statusDiv.innerHTML = '<span class="text-danger">Fehler: UI-Elemente nicht gefunden.</span>';
            return;
        }

        const buildingType = parseInt(select.value, 10);
        const selectedOption = select.options[select.selectedIndex];
        const maxCount = parseInt(selectedOption.dataset.max, 10);
        let count = parseInt(input.value, 10);

        // Validierung
        if (isNaN(count) || count <= 0) {
            statusDiv.innerHTML = '<span class="text-danger">Bitte eine gültige Anzahl > 0 eingeben.</span>';
            return;
        }
        if (count > maxCount) {
            statusDiv.innerHTML = `<span class="text-danger">Anzahl zu groß. Es sind nur ${maxCount} Wachen dieses Typs deaktiviert.</span>`;
            return;
        }

        const lsBuildingLists = scriptDataStore.leitstelleBuildingLists.get(lsIdRaw);
        const buildingList = lsBuildingLists ? lsBuildingLists.get(buildingType) : null;

        // NEU: 'disabled' Liste prüfen
        if (!buildingList || !buildingList.disabled || buildingList.disabled.length === 0) {
            statusDiv.innerHTML = '<span class="text-danger">Fehler: Keine deaktivierten Wachen für diesen Typ gefunden.</span>';
            return;
        }

        button.disabled = true;
        input.disabled = true;
        select.disabled = true;
        statusDiv.innerHTML = '<span class="text-info">Starte Aktivierung...</span>';

        // 'disabled' Liste als Quelle
        const shuffledIds = buildingList.disabled.sort(() => 0.5 - Math.random());
        const idsToToggle = shuffledIds.slice(0, count);

        // --- NEU V9.5: Worker Pool ---
        const queue = [...idsToToggle];
        let successCount = 0;
        let errorCount = 0;
        let processedCount = 0;
        const totalToProcess = queue.length;

        const worker = async () => {
            while (queue.length > 0) {
                const id = queue.shift();
                if (!id) continue;

                try {
                    await toggleBuildingState(id);
                    successCount++;
                } catch (e) {
                    console.error(`[LSS-Statistik V9.5] Fehler bei Aktivierung von ${id}:`, e);
                    errorCount++;
                }

                processedCount++;

                // UI-Update
                const percent = ((processedCount / totalToProcess) * 100).toFixed(0);
                statusDiv.innerHTML = `<span class="text-info">Arbeite... Wache ${processedCount} von ${totalToProcess} (${percent}%)</span>`;
            }
        };

        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
            workerPromises.push(worker());
        }

        await Promise.all(workerPromises);
        // --- ENDE Worker Pool ---

        statusDiv.innerHTML = `<span class="text-success">Aktion abgeschlossen: ${successCount} Wachen aktiviert.</span>`;
        if (errorCount > 0) {
            statusDiv.innerHTML += ` <span class="text-danger">${errorCount} Fehler (siehe Konsole).</span>`;
        }
        statusDiv.innerHTML += `<br><span class="text-warning">Bitte "Statistik neu laden" klicken, um die Änderungen zu sehen.</span>`;
        if (errorCount > 0) {
            statusDiv.innerHTML += ` <span class="text-danger">${errorCount} Fehler (siehe Konsole).</span>`;
        }
        statusDiv.innerHTML += `<br><span class="text-warning">Bitte "Statistik neu laden" klicken, um die Änderungen zu sehen.</span>`;
    }
// NEU V9.6: Event-Handler für manuellen Scan-Start
    async function handleStartScan(event) {
        event.preventDefault();

        const controlBox = document.getElementById('gemini-scan-control-box');
        const progressWrapper = document.getElementById('gemini-progress-wrapper');
        const trainingWrapper = document.getElementById('gemini-training-stats-wrapper');
        const roleWrapper = document.getElementById('gemini-role-stats-wrapper');
        const trainingDiv = document.getElementById('gemini-training-stats');
        const roleDiv = document.getElementById('gemini-role-stats');

        if (!controlBox || !progressWrapper || !trainingWrapper || !roleWrapper || !scriptDataStore.tasks) {
            console.error('[LSS-Statistik V9.6] Scan-Startelemente nicht gefunden.');
            return;
        }

        // UI umschalten
        controlBox.style.display = 'none';
        progressWrapper.style.display = 'block';
        trainingWrapper.style.display = 'block';
        roleWrapper.style.display = 'block';

        try {
            await scanPersonnelPages(
                scriptDataStore.tasks,
                progressWrapper,
                trainingDiv,
                roleDiv
            );
        } catch (e) {
            console.error('[LSS-Statistik V9.6] Fehler während des manuellen Scans:', e);
            progressWrapper.innerHTML = `<div class="alert alert-danger">Fehler beim Personal-Scan: ${e.message}</div>`;
        }
    }
    // --- Modal- & Menü-Helferfunktionen ---

    function showModal(modalBodyHtml) {
        let modal = document.getElementById('gemini_building_stats_modal');
        if (modal) {
            $(modal).modal('hide');
            // $(modal).remove() wird jetzt im 'hidden.bs.modal' Event gemacht
        }

        modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'gemini_building_stats_modal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.innerHTML = `
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                        <h4 class="modal-title" id="gemini_stats_modal_title">Statistik</h4>
                    </div>
                    <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
                        ${modalBodyHtml}
                        <hr style="border-color: #444;">
                        <p><small>Alle Gebäude-IDs wurden zur weiteren Verwendung in der Browser-Konsole (F12) geloggt.</small></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-info" id="gemini_stats_refresh_btn" style="float: left; margin: 0 15px 15px;">Statistik neu laden</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal" style="margin: 0 15px 15px;">Schließen</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Event-Listener (V9.4)
        // WICHTIG: Event-Delegation für dynamisch geladene Inhalte
        $(modal).on('click', '#gemini_stats_refresh_btn', showBuildingStats);

        // Aktionen
        $(modal).on('click', '.gemini-deactivate-btn', handleDeactivation);
        $(modal).on('click', '.gemini-activate-btn', handleActivation); // NEU
        $(modal).on('click', '#gemini_start_scan_btn', handleStartScan);

        // NEU V9.4: Geteilte Event-Listener für Dropdowns

        // Für Deaktivieren-Dropdown
        $(modal).on('change', 'select[id^="gemini_deact_type_"]', function() {
            try {
                const lsIdDom = $(this).attr('id').replace('gemini_deact_type_', '');
                const selectedOption = $(this).find('option:selected');
                const max = selectedOption.data('max');

                const input = $(`#gemini_deact_count_${lsIdDom}`);
                const label = $(`#gemini_deact_max_label_${lsIdDom}`);

                if (input.length) {
                    input.attr('max', max);
                    input.attr('placeholder', `Anzahl (Max: ${max})`);
                    input.val('');
                }
                if (label.length) {
                    label.text(`(Max: ${max} aktiv)`);
                }
            } catch (e) {
                console.error("Fehler bei Update des Deact-Inputs:", e);
            }
        });

        // Für Aktivieren-Dropdown
        $(modal).on('change', 'select[id^="gemini_act_type_"]', function() {
            try {
                const lsIdDom = $(this).attr('id').replace('gemini_act_type_', '');
                const selectedOption = $(this).find('option:selected');
                const max = selectedOption.data('max');

                const input = $(`#gemini_act_count_${lsIdDom}`);
                const label = $(`#gemini_act_max_label_${lsIdDom}`);

                if (input.length) {
                    input.attr('max', max);
                    input.attr('placeholder', `Anzahl (Max: ${max})`);
                    input.val('');
                }
                if (label.length) {
                    label.text(`(Max: ${max} deaktiviert)`);
                }
            } catch (e) {
                console.error("Fehler bei Update des Act-Inputs:", e);
            }
        });

        $(modal).modal('show');

        // NEU V9.4: Trigger change event für BEIDE Dropdowns
        $(modal).on('shown.bs.modal', function () {
            $('select[id^="gemini_deact_type_"]').trigger('change');
            $('select[id^="gemini_act_type_"]').trigger('change');
        });

        // NEU V9.3: Trigger change event, um initialen Max-Wert zu setzen
        // Muss nach .modal('show') passieren, damit Elemente da sind
        $(modal).on('shown.bs.modal', function () {
            $('select[id^="gemini_deact_type_"]').trigger('change');
        });
        $(modal).on('hidden.bs.modal', function () {
            $(this).remove(); // Modal komplett aus dem DOM entfernen, wenn es geschlossen wird
        });
    }

    function addMenuItem() {
        const logoutButton = document.getElementById('logout_button');
        if (logoutButton) {
            const logoutLi = logoutButton.closest('li');
            if (logoutLi) {
                const newLi = document.createElement('li');
                newLi.setAttribute('role', 'presentation');
                newLi.innerHTML = `<a href="#" id="gemini_building_stats_link"><span class="glyphicon glyphicon-stats" aria-hidden="true" style="margin-right: 5px;"></span> Erweiterte Statistik (V9.6)</a>`;
                logoutLi.after(newLi);
                document.getElementById('gemini_building_stats_link').addEventListener('click', showBuildingStats);
            }
        }
    }

    // --- Start ---
    if (typeof $ === 'function') {
        $(document).ready(addMenuItem);
    } else {
        document.addEventListener('DOMContentLoaded', addMenuItem);
    }

})();
