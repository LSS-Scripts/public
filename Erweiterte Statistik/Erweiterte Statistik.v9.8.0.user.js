// ==UserScript==
// @name         Leitstellenspiel Gebäude-, Personal- & Fahrzeugstatistik (V9.8)
// @namespace    http://tampermonkey.net/
// @version      9.8
// @description  Zählt Personal, Wachen & Fahrzeuge (inkl. FMS & Typen) mit % und Status, inkl. Deaktivierungs-Aktion (Blaues Theme)
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

    // --- Mappings ---

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

    // Aktualisierte Liste V9.8
    const VEHICLE_TYPE_MAP = {
        0: 'LF 20', 1: 'LF 10', 2: 'DLK 23', 3: 'ELW 1',
        4: 'RW', 5: 'GW-A', 6: 'LF 8/6', 7: 'LF 20/16',
        8: 'LF 10/6', 9: 'LF 16-TS', 10: 'GW-Öl', 11: 'GW-L2-Wasser',
        12: 'GW-Messtechnik', 13: 'SW 1000', 14: 'SW 2000', 15: 'SW 2000-Tr',
        16: 'SW Kats', 17: 'TLF 2000', 18: 'TLF 3000', 19: 'TLF 8/8',
        20: 'TLF 8/18', 21: 'TLF 16/24-Tr', 22: 'TLF 16/25', 23: 'TLF 16/45',
        24: 'TLF 20/40', 25: 'TLF 20/40-SL', 26: 'TLF 16', 27: 'GW-Gefahrgut',
        28: 'RTW', 29: 'NEF', 30: 'HLF 20', 31: 'RTH',
        32: 'FuStW', 33: 'GW-Höhenrettung', 34: 'ELW 2', 35: 'leBefKw',
        36: 'MTW', 37: 'TSF-W', 38: 'KTW', 39: 'GKW',
        40: 'MTW-TZ', 41: 'MzGW (FGr N)', 42: 'LKW K 9', 43: 'BRmG R',
        44: 'Anh DLE', 45: 'MLW 5', 46: 'WLF', 47: 'AB-Rüst',
        48: 'AB-Atemschutz', 49: 'AB-Öl', 50: 'GruKw', 51: 'FüKW (Polizei)',
        52: 'GefKw', 53: 'Dekon-P', 54: 'AB-Dekon-P', 55: 'KdoW-LNA',
        56: 'KdoW-OrgL', 57: 'FwK', 58: 'KTW Typ B', 59: 'ELW 1 (SEG)',
        60: 'GW-San', 61: 'Polizeihubschrauber', 62: 'AB-Schlauch', 63: 'GW-Taucher',
        64: 'GW-Wasserrettung',
        65: 'LKW 7 Lkr 19 tm', 66: 'Anh MzB', 67: 'Anh SchlB',
        68: 'Anh MzAB', 69: 'Tauchkraftwagen', 70: 'MZB', 71: 'AB-MZB',
        72: 'WaWe 10', 73: 'GRTW', 74: 'NAW', 75: 'FLF',
        76: 'Rettungtreppe', 77: 'AB-Gefahrgut', 78: 'AB-Einsatzleitung', 79: 'SEK - ZF',
        80: 'SEK - MTF',
        81: 'MEK - ZF', 82: 'MEK - MTF', 83: 'GW-Werkfeuerwehr',
        84: 'ULF mit Löscharm', 85: 'TM 50', 86: 'Turbolöscher', 87: 'TLF 4000',
        88: 'KLF', 89: 'MLF', 90: 'HLF 10', 91: 'Rettungshundefahrzeug',
        92: 'Anh Hund', 93: 'MTW-O', 94: 'DHuFüKW', 95: 'Polizeimotorrad',
        96: 'Außenlastbehälter (allgemein)', 97: 'ITW', 98: 'Zivilstreifenwagen',
        100: 'MLW 4', 101: 'Anh SwPu', 102: 'Anh 7', 103: 'FuStW (DGL)',
        104: 'GW-L1', 105: 'GW-L2', 106: 'MTF-L', 107: 'LF-L',
        108: 'AB-L', 109: 'MzGW SB', 110: 'NEA50',
        112: 'NEA200',
        114: 'GW-Lüfter', 115: 'Anh Lüfter', 116: 'AB-Lüfter', 117: 'AB-Tank',
        118: 'Kleintankwagen', 119: 'AB-Lösch', 120: 'Tankwagen', 121: 'GTLF',
        122: 'LKW 7 Lbw (FGr E)',
        123: 'LKW 7 Lbw (FGr WP)',
        124: 'MTW-OV',
        125: 'MTW-Tr UL',
        126: 'MTF Drohne',
        127: 'GW UAS',
        128: 'ELW Drohne',
        129: 'ELW2 Drohne',
        130: 'GW-Bt',
        131: 'Bt-Kombi',
        132: 'FKH',
        133: 'Bt LKW',
        134: 'Pferdetransporter klein',
        135: 'Pferdetransporter groß',
        136: 'Anh Pferdetransport',
        137: 'Zugfahrzeug Pferdetransport',
        138: 'GW-Verpflegung',
        139: 'GW-Küche',
        140: 'MTW-Verpflegung',
        142: 'AB-Küche',
        143: 'Anh Schlauch',
        144: 'FüKW (THW)',
        145: 'FüKomKW',
        146: 'Anh FüLa',
        147: 'FmKW',
        148: 'MTW-FGr K',
        149: 'GW-Bergrettung (NEF)',
        150: 'GW-Bergrettung',
        151: 'ELW Bergrettung',
        152: 'ATV',
        153: 'Hundestaffel (Bergrettung)',
        154: 'Schneefahrzeug',
        155: 'Anh Höhenrettung (Bergrettung)',
        156: 'Polizeihubschrauber mit verbauter Winde',
        157: 'RTH Winde',
        158: 'GW-Höhenrettung (Bergrettung)',
        159: 'Seenotrettungskreuzer',
        160: 'Seenotrettungsboot',
        161: 'Hubschrauber (Seenotrettung)',
        162: 'RW-Schiene',
        163: 'HLF Schiene',
        164: 'AB-Schiene',
        165: 'LauKw',
        166: 'PTLF 4000',
        167: 'SLF',
        168: 'Anh Sonderlöschmittel',
        169: 'AB-Sonderlöschmittel',
        170: 'AB-Wasser/Schaum',
        171: 'GW TeSi',
        172: 'LKW Technik (Notstrom)',
        173: 'MTW TeSi',
        174: 'Anh TeSi',
        175: 'NEA50',
        176: 'LKW 7 Lbw (FGr Log-V)',
        177: 'MTW-FGr Log-V',
        178: 'Anh 12 Lbw (FGr Log-V)'
    };

    const FMS_COLORS = {
        1: '#3498db', // Blau (Frei Funk)
        2: '#5cb85c', // Grün (Frei Wache)
        3: '#f0ad4e', // Orange (Anfahrt)
        4: '#d9534f', // Rot (Einsatzort)
        5: '#5bc0de', // Hellblau (Sprechwunsch)
        6: '#000000', // Schwarz (Nicht einsatzbereit)
        7: '#f0ad4e', // Orange (Patient aufgenommen)
        9: '#999999'  // Grau (Dringend/Sonstiges)
    };

    const getBuildingName = (type) => BUILDING_TYPE_MAP[type] || `Unbekannter Typ (${type})`;
    const getVehicleName = (type) => VEHICLE_TYPE_MAP[type] || `Fahrzeug-Typ ID ${type}`;

    // Globaler Speicher
    let scriptDataStore = {
        leitstelleBuildingLists: new Map(),
        leitstellenMap: new Map(),
        tasks: []
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
            background-color: #3a3a3a;
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            color: #f1f1f1;
            font-weight: 500;
        }
        /* Zähler (Badge) */
        .gemini-stat-badge {
            background-color: #3498db;
            color: #ffffff;
            padding: 5px 10px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 10px;
            min-width: 30px;
            text-align: center;
        }
        /* Überschriften */
        #gemini_building_stats_modal h4 {
            color: #5bc0de;
            margin-top: 25px;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
            padding-bottom: 5px;
        }

        /* LS Stat Box */
        .gemini-ls-stat-box {
            background-color: #3a3a3a;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 6px;
            color: #f1f1f1;
            border-left: 4px solid #3498db;
            height: 95%;
        }
        .gemini-ls-stat-box-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .gemini-ls-stat-box-details {
            font-size: 12px;
        }
        .gemini-ls-stat-box-details span {
            margin-right: 15px;
        }
        .text-success { color: #5cb85c; }
        .text-danger { color: #d9534f; }
        .text-info { color: #5bc0de; }
        .text-warning { color: #f0ad4e; }

        /* Action Box */
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

        /* NEU V9.7: FMS Badges */
        .fms-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 3px;
        }
        .fms-mini-stat {
            font-size: 11px;
            color: #ccc;
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .fms-badge-inline {
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 10px;
            margin-right: 3px;
            color: #fff;
            font-weight: bold;
            background-color: #555;
        }
    `;
    GM_addStyle(customCss);


    // --- Haupt-Statistik-Funktion ---

    async function showBuildingStats(event) {
        if(event) event.preventDefault();
        console.log('[LSS-Statistik V9.8] Starte Statistik-Erhebung...');

        showModal('<h4 id="gemini_stats_title">Lade Daten (Gebäude & Fahrzeuge)...</h4><div id="gemini_stats_body"><div class="progress"><div class="progress-bar progress-bar-striped active" style="width: 100%">Lade API Daten...</div></div></div>');
        const modalTitle = document.getElementById('gemini_stats_title');
        const modalBody = document.getElementById('gemini_stats_body');

        scriptDataStore = { leitstelleBuildingLists: new Map(), leitstellenMap: new Map(), tasks: [] };

        try {
            // --- API Calls (Parallel für Performance) ---
            const [buildingsResponse, vehiclesResponse] = await Promise.all([
                fetch('https://www.leitstellenspiel.de/api/buildings'),
                fetch('https://www.leitstellenspiel.de/api/vehicles')
            ]);

            if (!buildingsResponse.ok) throw new Error(`Building API Error: ${buildingsResponse.status}`);
            if (!vehiclesResponse.ok) throw new Error(`Vehicle API Error: ${vehiclesResponse.status}`);

            const buildings = await buildingsResponse.json();
            const vehicles = await vehiclesResponse.json();

            console.log(`[LSS-Statistik V9.8] ${buildings.length} Gebäude und ${vehicles.length} Fahrzeuge geladen.`);

            // --- 1. GEBÄUDE VERARBEITUNG ---
            const leitstellenMap = new Map();
            leitstellenMap.set(null, "Ohne Leitstelle");
            for (const building of buildings) {
                if (building.building_type === 7) {
                    leitstellenMap.set(building.id, building.caption);
                }
            }
            scriptDataStore.leitstellenMap = leitstellenMap;

            const buildingCounts = new Map();
            const personnelCounts = new Map();
            const leitstelleBuildingCounts = new Map();
            const leitstelleBuildingLists = new Map();
            const globalBuildingStats = { total: 0, enabled: 0, disabled: 0 };
            let totalPersonnel = 0;
            const tasks = [];

            for (const building of buildings) {
                const type = building.building_type;
                const pCount = building.personal_count;

                globalBuildingStats.total++;
                building.enabled ? globalBuildingStats.enabled++ : globalBuildingStats.disabled++;

                buildingCounts.set(type, (buildingCounts.get(type) || 0) + 1);
                personnelCounts.set(type, (personnelCounts.get(type) || 0) + pCount);
                totalPersonnel += pCount;

                if (type !== 7) {
                    const leitstelle_id = building.leitstelle_building_id || null;
                    if (!leitstelleBuildingLists.has(leitstelle_id)) leitstelleBuildingLists.set(leitstelle_id, new Map());
                    if (!leitstelleBuildingCounts.has(leitstelle_id)) leitstelleBuildingCounts.set(leitstelle_id, new Map());

                    const lsTypeLists = leitstelleBuildingLists.get(leitstelle_id);
                    if (!lsTypeLists.has(type)) lsTypeLists.set(type, { enabled: [], disabled: [] });

                    const typeLists = lsTypeLists.get(type);
                    building.enabled ? typeLists.enabled.push(building.id) : typeLists.disabled.push(building.id);

                    const statsForThisLS = leitstelleBuildingCounts.get(leitstelle_id);
                    const typeStats = statsForThisLS.get(type) || { total: 0, enabled: 0, disabled: 0 };
                    typeStats.total++;
                    building.enabled ? typeStats.enabled++ : typeStats.disabled++;
                    statsForThisLS.set(type, typeStats);
                }
                if (pCount > 0) {
                    tasks.push({ id: building.id, url: `https://www.leitstellenspiel.de/buildings/${building.id}/personals` });
                }
            }
            scriptDataStore.leitstelleBuildingLists = leitstelleBuildingLists;
            scriptDataStore.tasks = tasks;

            // --- 2. FAHRZEUG VERARBEITUNG (NEU V9.7) ---
            const vehicleStats = {
                total: 0,
                fmsGlobal: {}, // { 2: 500, 4: 100 ... }
                types: new Map() // TypeID -> { count: 0, fms: {} }
            };

            for (const v of vehicles) {
                vehicleStats.total++;

                // FMS Global
                const fms = v.fms_real;
                vehicleStats.fmsGlobal[fms] = (vehicleStats.fmsGlobal[fms] || 0) + 1;

                // Type Stats
                const typeId = v.vehicle_type;
                if (!vehicleStats.types.has(typeId)) {
                    vehicleStats.types.set(typeId, { count: 0, fms: {} });
                }
                const typeEntry = vehicleStats.types.get(typeId);
                typeEntry.count++;
                typeEntry.fms[fms] = (typeEntry.fms[fms] || 0) + 1;
            }


            // --- HTML GENERIEREN ---
            const buildingsHtml = generateBaseStatsHtml(buildingCounts, personnelCounts, globalBuildingStats.total, totalPersonnel, globalBuildingStats);
            const vehiclesHtml = generateVehicleStatsHtml(vehicleStats); // NEU
            const leitstellenHtml = generateLeitstellenStatsHtml(leitstelleBuildingCounts, scriptDataStore.leitstellenMap);

            modalTitle.textContent = 'Gebäude-, Personal- & Fahrzeugstatistik';
            modalBody.innerHTML = buildingsHtml + "<hr>" + vehiclesHtml + "<hr>" + leitstellenHtml;

            // Scan-Section anhängen
            modalBody.innerHTML += `
                <div id="gemini-personnel-scan-section">
                    <hr style="border-color: #444;">
                    <div class="gemini-action-box" id="gemini-scan-control-box">
                        <h5 style="margin-top: 0;">Personal-Detailscan (Optional)</h5>
                        <p style="color: #ccc; margin-bottom: 15px;">Sammelt Details zu Ausbildungen und Rollen. Starten Sie dies erst, NACHDEM Sie (De-)Aktivierungen vorgenommen haben.</p>
                        <button class="btn btn-primary" id="gemini_start_scan_btn">
                            <span class="glyphicon glyphicon-play" aria-hidden="true" style="margin-right: 5px;"></span> Personal-Scan jetzt starten
                        </button>
                    </div>
                    <div id="gemini-progress-wrapper" style="display: none;"></div>
                    <div id="gemini-training-stats-wrapper" style="display: none;"><h4>Personal in Ausbildung</h4><div id="gemini-training-stats"></div></div>
                    <div id="gemini-role-stats-wrapper" style="display: none;"><h4>Ausgebildetes Personal (Rollen)</h4><div id="gemini-role-stats"></div></div>
                </div>
            `;

        } catch (error) {
            console.error('[LSS-Statistik V9.8] Fehler:', error);
            modalBody.innerHTML = `<div class="alert alert-danger">Fehler beim Abrufen der Daten: ${error.message}</div>`;
        }
    }

    /**
     * Generiert das HTML für Fahrzeuge (NEU V9.7)
     */
    function generateVehicleStatsHtml(vehicleStats) {
        let html = '<h4>Fahrzeugstatistik (Global)</h4>';

        // 1. Übersicht Boxen
        html += '<div class="row">';
        html += `<div class="col-md-12"><div class="gemini-stat-box"><strong>Gesamtfahrzeuge</strong><span class="gemini-stat-badge">${vehicleStats.total.toLocaleString()}</span></div></div>`;
        html += '</div>';

        // 2. FMS Status Leiste
        html += '<div style="margin-bottom: 15px; background-color: #2f2f2f; padding: 10px; border-radius: 6px;">';
        html += '<strong style="color: #ccc; display: block; margin-bottom: 5px;">Status Verteilung:</strong>';
        html += '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';

        // Sortieren nach Status ID (1, 2, 3...)
        Object.keys(vehicleStats.fmsGlobal).sort().forEach(status => {
            const count = vehicleStats.fmsGlobal[status];
            const color = FMS_COLORS[status] || '#777';
            html += `<span class="badge" style="background-color: ${color}; font-size: 12px; padding: 5px 8px;">S${status}: ${count.toLocaleString()}</span>`;
        });
        html += '</div></div>';

        // 3. Grid für Fahrzeugtypen
        html += '<h5>Fahrzeugtypen</h5><div class="row">';
        const sortedTypes = [...vehicleStats.types.entries()].sort((a, b) => b[1].count - a[1].count);

        for (const [typeId, stats] of sortedTypes) {
            // Mini FMS Stats string bauen
            let fmsString = '';
            Object.keys(stats.fms).sort().forEach(s => {
               const c = stats.fms[s];
               const color = FMS_COLORS[s] || '#555';
               fmsString += `<span class="fms-badge-inline" style="background-color:${color}">S${s}: ${c}</span>`;
            });

            html += `<div class="col-md-3 col-sm-6 col-xs-12">
                <div class="gemini-stat-box" style="flex-direction: column; align-items: flex-start;">
                    <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 5px;">
                        <span>${getVehicleName(typeId)}</span>
                        <span class="gemini-stat-badge">${stats.count.toLocaleString()}</span>
                    </div>
                    <div class="fms-mini-stat">${fmsString}</div>
                </div>
            </div>`;
        }
        html += '</div>'; // End row

        return html;
    }

    function generateBaseStatsHtml(buildingCounts, personnelCounts, totalBuildings, totalPersonnel, globalBuildingStats) {
        let totalHtml = '<h4>Gesamtstatistik (Gebäude & Personal)</h4>';
        totalHtml += '<div class="row">';
        totalHtml += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box"><strong>Gesamtgebäude</strong><span class="gemini-stat-badge">${totalBuildings.toLocaleString()}</span></div></div>`;
        totalHtml += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #5cb85c;"><strong>Aktiv</strong><span class="gemini-stat-badge">${globalBuildingStats.enabled.toLocaleString()}</span></div></div>`;
        totalHtml += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #d9534f;"><strong>Deaktiviert</strong><span class="gemini-stat-badge">${globalBuildingStats.disabled.toLocaleString()}</span></div></div>`;
        totalHtml += '</div>';
        totalHtml += '<div class="row">';
        totalHtml += `<div class="col-md-12 col-sm-12 col-xs-12"><div class="gemini-stat-box"><strong>Gesamtpersonal (API)</strong><span class="gemini-stat-badge">${totalPersonnel.toLocaleString()}</span></div></div>`;
        totalHtml += '</div>';

        let buildingGridHtml = '<h5>Gebäudeanzahl (Global)</h5><div class="row">';
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

        return totalHtml + buildingGridHtml;
    }

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
            const leitstelle_id_dom = leitstelle_id_raw === null ? 'null' : leitstelle_id_raw;
            const lsName = leitstellenMap.get(leitstelle_id_raw) || `Unbekannte LS (ID: ${leitstelle_id_raw})`;

            let lsTotalBuildings = 0;
            let lsTotalEnabled = 0;
            let lsTotalDisabled = 0;
            for (const stats of buildingCountsMap.values()) {
                lsTotalBuildings += stats.total;
                lsTotalEnabled += stats.enabled;
                lsTotalDisabled += stats.disabled;
            }

            html += `<h4>${lsName}</h4>`;
            html += '<div class="row">';
            html += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box"><strong>Gesamt (LS)</strong><span class="gemini-stat-badge">${lsTotalBuildings}</span></div></div>`;
            html += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #5cb85c;"><strong>Aktiv</strong><span class="gemini-stat-badge">${lsTotalEnabled}</span></div></div>`;
            html += `<div class="col-md-4 col-sm-4 col-xs-12"><div class="gemini-stat-box" style="border-left: 4px solid #d9534f;"><strong>Deaktiviert</strong><span class="gemini-stat-badge">${lsTotalDisabled}</span></div></div>`;
            html += '</div>';

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
            html += '</div>';

            let optionsHtmlDeactivate = '';
            let optionsHtmlActivate = '';
            const sortedTypesForDropdown = [...buildingCountsMap.entries()].sort((a, b) => a[0] - b[0]);

            for (const [type, stats] of sortedTypesForDropdown) {
                if (stats.enabled > 0) optionsHtmlDeactivate += `<option value="${type}" data-max="${stats.enabled}">${getBuildingName(type)} (Max: ${stats.enabled})</option>`;
                if (stats.disabled > 0) optionsHtmlActivate += `<option value="${type}" data-max="${stats.disabled}">${getBuildingName(type)} (Max: ${stats.disabled})</option>`;
            }

            html += `
                <div class="row">
                    <div class="col-md-12">
                        <div class="gemini-action-box">
                            <h5 style="margin-bottom: 15px;">Aktionen für ${lsName}</h5>
                            <h6 style="color: #f0ad4e;">Zufällig Deaktivieren</h6>
                            ${ optionsHtmlDeactivate.length > 0 ? `
                            <div>
                                <select id="gemini_deact_type_${leitstelle_id_dom}" class="form-control" style="width: 250px; margin-right: 10px; display: inline-block;">${optionsHtmlDeactivate}</select>
                                <input type="number" id="gemini_deact_count_${leitstelle_id_dom}" class="form-control" placeholder="Anzahl" min="1">
                                <button class="btn btn-warning gemini-deactivate-btn" data-ls-id-raw="${leitstelle_id_raw}" data-ls-id-dom="${leitstelle_id_dom}">Deaktivieren</button>
                                <span id="gemini_deact_max_label_${leitstelle_id_dom}" style="margin-left: 10px; color: #999; font-size: 12px;"></span>
                            </div>
                            <div id="gemini_action_status_deact_${leitstelle_id_dom}" style="margin-top: 10px; min-height: 1.5em;"></div>
                            ` : `<div class="text-info" style="margin-bottom: 15px;">Keine aktivierten Wachen zum Deaktivieren vorhanden.</div>`}

                            <hr style="border-color: #444;">
                            <h6 style="color: #5cb85c;">Zufällig Aktivieren</h6>
                            ${ optionsHtmlActivate.length > 0 ? `
                            <div>
                                <select id="gemini_act_type_${leitstelle_id_dom}" class="form-control" style="width: 250px; margin-right: 10px; display: inline-block;">${optionsHtmlActivate}</select>
                                <input type="number" id="gemini_act_count_${leitstelle_id_dom}" class="form-control" placeholder="Anzahl" min="1">
                                <button class="btn btn-success gemini-activate-btn" data-ls-id-raw="${leitstelle_id_raw}" data-ls-id-dom="${leitstelle_id_dom}">Aktivieren</button>
                                <span id="gemini_act_max_label_${leitstelle_id_dom}" style="margin-left: 10px; color: #999; font-size: 12px;"></span>
                            </div>
                            <div id="gemini_action_status_act_${leitstelle_id_dom}" style="margin-top: 10px; min-height: 1.5em;"></div>
                            ` : `<div class="text-info">Keine deaktivierten Wachen zum Aktivieren vorhanden.</div>`}
                        </div>
                    </div>
                </div>
            `;
        }
        return html;
    }


    // --- Worker & API Helper ---

    async function scanPersonnelPages(tasks, progressWrapper, trainingDiv, roleDiv) {
        progressWrapper.innerHTML = `
            <h4>Personal-Scan (wird geladen...)</h4>
            <div class="progress" style="background-color: #555;">
                <div id="gemini_stats_progressbar" class="progress-bar progress-bar-info progress-bar-striped active" role="progressbar" style="width: 0%; min-width: 2em;">0 / ${tasks.length}</div>
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
                    console.warn(`[LSS-Statistik V9.8] Fehler bei Gebäude ${task.id}:`, error);
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
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) workerPromises.push(worker());
        await Promise.all(workerPromises);
        progressWrapper.remove();
    }

    function renderLiveStats(trainingStats, trainedRoleStats, trainingDiv, roleDiv) {
        let trainingHtml = `<div class="row"><div class="col-md-12"><div class="gemini-stat-box"><strong>Gesamt in Ausbildung</strong><span class="gemini-stat-badge">${trainingStats.total.toLocaleString()}</span></div></div></div>`;
        trainingHtml += '<div class="row">';
        const sortedCourses = new Map([...trainingStats.courses.entries()].sort((a, b) => b[1] - a[1]));
        for (const [course, count] of sortedCourses.entries()) {
            trainingHtml += `<div class="col-md-3 col-sm-6 col-xs-12"><div class="gemini-stat-box"><span>${course}</span><span class="gemini-stat-badge">${count.toLocaleString()}</span></div></div>`;
        }
        trainingHtml += '</div>';
        trainingDiv.innerHTML = trainingHtml;

        let roleHtml = `<div class="row"><div class="col-md-12"><div class="gemini-stat-box"><strong>Gesamt zugewiesene Rollen</strong><span class="gemini-stat-badge">${trainedRoleStats.total.toLocaleString()}</span></div></div></div>`;
        roleHtml += '<div class="row">';
        const sortedRoles = new Map([...trainedRoleStats.roles.entries()].sort((a, b) => b[1] - a[1]));
        for (const [role, count] of sortedRoles.entries()) {
            roleHtml += `<div class="col-md-3 col-sm-6 col-xs-12"><div class="gemini-stat-box"><span>${role}</span><span class="gemini-stat-badge">${count.toLocaleString()}</span></div></div>`;
        }
        roleHtml += '</div>';
        roleDiv.innerHTML = roleHtml;
    }

    function fetchPage(url) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: "GET", url: url,
                onload: function(response) { response.status >= 200 && response.status < 300 ? resolve(response.responseText) : reject(new Error(`HTTP ${response.status}`)); },
                onerror: function(error) { reject(new Error(`Fehler ${error.statusText}`)); },
                ontimeout: function() { reject(new Error(`Timeout`)); }
            });
        });
    }

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
                    if (courseName) coursesFound.push(courseName);
                } else {
                    const roleCell = row.querySelector('td:nth-child(2)');
                    if (roleCell) {
                        const roleNamesString = roleCell.textContent.trim();
                        if (roleNamesString) {
                            roleNamesString.split(',').forEach(role => {
                                const cleanRole = role.trim();
                                if (cleanRole) rolesFound.push(cleanRole);
                            });
                        }
                    }
                }
            });
        } catch (e) { console.error(e); }
        return { coursesFound, rolesFound };
    }

    // --- Aktionen ---
    function toggleBuildingState(buildingId) {
        const url = `https://www.leitstellenspiel.de/buildings/${buildingId}/active`;
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: "GET", url: url,
                onload: (response) => response.status >= 200 && response.status < 300 ? resolve(response.responseText) : reject(new Error(`HTTP ${response.status}`)),
                onerror: (error) => reject(new Error(error.statusText)),
                ontimeout: () => reject(new Error('Timeout'))
            });
        });
    }

    async function handleDeactivation(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const lsIdRaw = button.dataset.lsIdRaw === 'null' ? null : parseInt(button.dataset.lsIdRaw, 10);
        const lsIdDom = button.dataset.lsIdDom;
        const select = document.getElementById(`gemini_deact_type_${lsIdDom}`);
        const input = document.getElementById(`gemini_deact_count_${lsIdDom}`);
        const statusDiv = document.getElementById(`gemini_action_status_deact_${lsIdDom}`);

        if (!select || !input) return;
        const buildingType = parseInt(select.value, 10);
        const maxCount = parseInt(select.options[select.selectedIndex].dataset.max, 10);
        let count = parseInt(input.value, 10);

        if (isNaN(count) || count <= 0) { statusDiv.innerHTML = '<span class="text-danger">Ungültige Anzahl.</span>'; return; }
        if (count > maxCount) { statusDiv.innerHTML = '<span class="text-danger">Anzahl zu groß.</span>'; return; }

        const lsBuildingLists = scriptDataStore.leitstelleBuildingLists.get(lsIdRaw);
        const buildingList = lsBuildingLists ? lsBuildingLists.get(buildingType) : null;
        if (!buildingList || !buildingList.enabled.length) { statusDiv.innerHTML = '<span class="text-danger">Keine Wachen gefunden.</span>'; return; }

        button.disabled = input.disabled = select.disabled = true;
        statusDiv.innerHTML = '<span class="text-info">Starte Deaktivierung...</span>';

        const queue = buildingList.enabled.sort(() => 0.5 - Math.random()).slice(0, count);
        let processedCount = 0, successCount = 0, errorCount = 0, totalToProcess = queue.length;

        const worker = async () => {
            while (queue.length > 0) {
                const id = queue.shift();
                if(!id) continue;
                try { await toggleBuildingState(id); successCount++; } catch(e) { errorCount++; }
                processedCount++;
                const percent = ((processedCount / totalToProcess) * 100).toFixed(0);
                statusDiv.innerHTML = `<span class="text-info">Arbeite... ${processedCount}/${totalToProcess} (${percent}%)</span>`;
            }
        };
        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) workerPromises.push(worker());
        await Promise.all(workerPromises);

        statusDiv.innerHTML = `<span class="text-success">Fertig: ${successCount} deaktiviert.</span>` + (errorCount ? ` <span class="text-danger">${errorCount} Fehler.</span>` : '') + '<br><span class="text-warning">Bitte neu laden.</span>';
    }

    async function handleActivation(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const lsIdRaw = button.dataset.lsIdRaw === 'null' ? null : parseInt(button.dataset.lsIdRaw, 10);
        const lsIdDom = button.dataset.lsIdDom;
        const select = document.getElementById(`gemini_act_type_${lsIdDom}`);
        const input = document.getElementById(`gemini_act_count_${lsIdDom}`);
        const statusDiv = document.getElementById(`gemini_action_status_act_${lsIdDom}`);

        if (!select || !input) return;
        const buildingType = parseInt(select.value, 10);
        const maxCount = parseInt(select.options[select.selectedIndex].dataset.max, 10);
        let count = parseInt(input.value, 10);

        if (isNaN(count) || count <= 0) { statusDiv.innerHTML = '<span class="text-danger">Ungültige Anzahl.</span>'; return; }
        if (count > maxCount) { statusDiv.innerHTML = '<span class="text-danger">Anzahl zu groß.</span>'; return; }

        const lsBuildingLists = scriptDataStore.leitstelleBuildingLists.get(lsIdRaw);
        const buildingList = lsBuildingLists ? lsBuildingLists.get(buildingType) : null;
        if (!buildingList || !buildingList.disabled.length) { statusDiv.innerHTML = '<span class="text-danger">Keine Wachen gefunden.</span>'; return; }

        button.disabled = input.disabled = select.disabled = true;
        statusDiv.innerHTML = '<span class="text-info">Starte Aktivierung...</span>';

        const queue = buildingList.disabled.sort(() => 0.5 - Math.random()).slice(0, count);
        let processedCount = 0, successCount = 0, errorCount = 0, totalToProcess = queue.length;

        const worker = async () => {
            while (queue.length > 0) {
                const id = queue.shift();
                if(!id) continue;
                try { await toggleBuildingState(id); successCount++; } catch(e) { errorCount++; }
                processedCount++;
                const percent = ((processedCount / totalToProcess) * 100).toFixed(0);
                statusDiv.innerHTML = `<span class="text-info">Arbeite... ${processedCount}/${totalToProcess} (${percent}%)</span>`;
            }
        };
        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) workerPromises.push(worker());
        await Promise.all(workerPromises);

        statusDiv.innerHTML = `<span class="text-success">Fertig: ${successCount} aktiviert.</span>` + (errorCount ? ` <span class="text-danger">${errorCount} Fehler.</span>` : '') + '<br><span class="text-warning">Bitte neu laden.</span>';
    }

    async function handleStartScan(event) {
        event.preventDefault();
        const controlBox = document.getElementById('gemini-scan-control-box');
        const progressWrapper = document.getElementById('gemini-progress-wrapper');
        const trainingWrapper = document.getElementById('gemini-training-stats-wrapper');
        const roleWrapper = document.getElementById('gemini-role-stats-wrapper');
        const trainingDiv = document.getElementById('gemini-training-stats');
        const roleDiv = document.getElementById('gemini-role-stats');

        if (!controlBox) return;
        controlBox.style.display = 'none';
        progressWrapper.style.display = 'block';
        trainingWrapper.style.display = 'block';
        roleWrapper.style.display = 'block';

        try {
            await scanPersonnelPages(scriptDataStore.tasks, progressWrapper, trainingDiv, roleDiv);
        } catch (e) {
            progressWrapper.innerHTML = `<div class="alert alert-danger">Fehler: ${e.message}</div>`;
        }
    }


    // --- Modal ---
    function showModal(modalBodyHtml) {
        let modal = document.getElementById('gemini_building_stats_modal');
        if (modal) $(modal).modal('hide');

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
                        <h4 class="modal-title">Statistik</h4>
                    </div>
                    <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">${modalBodyHtml}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-info" id="gemini_stats_refresh_btn" style="float: left;">Neu laden</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal">Schließen</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        $(modal).on('click', '#gemini_stats_refresh_btn', showBuildingStats);
        $(modal).on('click', '.gemini-deactivate-btn', handleDeactivation);
        $(modal).on('click', '.gemini-activate-btn', handleActivation);
        $(modal).on('click', '#gemini_start_scan_btn', handleStartScan);

        // Dropdown Handler
        const updateInput = (select, prefix) => {
            try {
                const lsIdDom = select.attr('id').replace(prefix, '');
                const max = select.find('option:selected').data('max');
                const type = prefix.includes('deact') ? 'deact' : 'act';
                $(`#gemini_${type}_count_${lsIdDom}`).attr({max: max, placeholder: `Max: ${max}`}).val('');
                $(`#gemini_${type}_max_label_${lsIdDom}`).text(`(Max: ${max})`);
            } catch (e) {}
        };

        $(modal).on('change', 'select[id^="gemini_deact_type_"]', function() { updateInput($(this), 'gemini_deact_type_'); });
        $(modal).on('change', 'select[id^="gemini_act_type_"]', function() { updateInput($(this), 'gemini_act_type_'); });
        $(modal).on('shown.bs.modal', function () {
            $('select[id^="gemini_deact_type_"]').trigger('change');
            $('select[id^="gemini_act_type_"]').trigger('change');
        });
        $(modal).on('hidden.bs.modal', function () { $(this).remove(); });
        $(modal).modal('show');
    }

    function addMenuItem() {
        const logoutButton = document.getElementById('logout_button');
        if (logoutButton) {
            const logoutLi = logoutButton.closest('li');
            if (logoutLi) {
                const newLi = document.createElement('li');
                newLi.setAttribute('role', 'presentation');
                newLi.innerHTML = `<a href="#" id="gemini_building_stats_link"><span class="glyphicon glyphicon-stats" aria-hidden="true" style="margin-right: 5px;"></span> Erweiterte Statistik (V9.8)</a>`;
                logoutLi.after(newLi);
                document.getElementById('gemini_building_stats_link').addEventListener('click', showBuildingStats);
            }
        }
    }

    if (typeof $ === 'function') $(document).ready(addMenuItem);
    else document.addEventListener('DOMContentLoaded', addMenuItem);

})();
