// ==UserScript==
// @name         Leitstellenspiel Gebäude-, Personal- & Fahrzeugstatistik (V9.9)
// @namespace    http://tampermonkey.net/
// @version      9.9
// @description  Statistik mit Suche, Sortierung (A-Z/Anzahl) und FMS-Status für Gebäude & Fahrzeuge (Blaues Theme)
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
        122: 'LKW 7 Lbw (FGr E)', 123: 'LKW 7 Lbw (FGr WP)', 124: 'MTW-OV',
        125: 'MTW-Tr UL', 126: 'MTF Drohne', 127: 'GW UAS', 128: 'ELW Drohne',
        129: 'ELW2 Drohne', 130: 'GW-Bt', 131: 'Bt-Kombi', 132: 'FKH',
        133: 'Bt LKW', 134: 'Pferdetransporter klein', 135: 'Pferdetransporter groß',
        136: 'Anh Pferdetransport', 137: 'Zugfahrzeug Pferdetransport', 138: 'GW-Verpflegung',
        139: 'GW-Küche', 140: 'MTW-Verpflegung', 142: 'AB-Küche', 143: 'Anh Schlauch',
        144: 'FüKW (THW)', 145: 'FüKomKW', 146: 'Anh FüLa', 147: 'FmKW',
        148: 'MTW-FGr K', 149: 'GW-Bergrettung (NEF)', 150: 'GW-Bergrettung',
        151: 'ELW Bergrettung', 152: 'ATV', 153: 'Hundestaffel (Bergrettung)',
        154: 'Schneefahrzeug', 155: 'Anh Höhenrettung (Bergrettung)',
        156: 'Polizeihubschrauber mit verbauter Winde', 157: 'RTH Winde',
        158: 'GW-Höhenrettung (Bergrettung)', 159: 'Seenotrettungskreuzer',
        160: 'Seenotrettungsboot', 161: 'Hubschrauber (Seenotrettung)',
        162: 'RW-Schiene', 163: 'HLF Schiene', 164: 'AB-Schiene', 165: 'LauKw',
        166: 'PTLF 4000', 167: 'SLF', 168: 'Anh Sonderlöschmittel',
        169: 'AB-Sonderlöschmittel', 170: 'AB-Wasser/Schaum', 171: 'GW TeSi',
        172: 'LKW Technik (Notstrom)', 173: 'MTW TeSi', 174: 'Anh TeSi',
        175: 'NEA50', 176: 'LKW 7 Lbw (FGr Log-V)', 177: 'MTW-FGr Log-V',
        178: 'Anh 12 Lbw (FGr Log-V)'
    };

    const FMS_COLORS = {
        1: '#3498db', 2: '#5cb85c', 3: '#f0ad4e', 4: '#d9534f',
        5: '#5bc0de', 6: '#000000', 7: '#f0ad4e', 9: '#999999'
    };

    const getBuildingName = (type) => BUILDING_TYPE_MAP[type] || `Unbekannter Typ (${type})`;
    const getVehicleName = (type) => VEHICLE_TYPE_MAP[type] || `Fahrzeug-Typ ID ${type}`;

    // Globaler Speicher für Daten (Getrennt von UI)
    let scriptDataStore = {
        leitstelleBuildingLists: new Map(),
        leitstellenMap: new Map(),
        tasks: [],
        stats: {
            buildings: new Map(), // Type -> Count
            vehicles: new Map(),  // Type -> { count, fms }
            personnel: new Map(), // Type -> Count
            training: { total: 0, courses: new Map() },
            roles: { total: 0, roles: new Map() }
        }
    };

    // --- CSS ---
    const customCss = `
        #gemini_building_stats_modal .modal-dialog { width: 90%; max-width: 1600px; min-width: 1000px; }
        .gemini-stat-box { display: flex; justify-content: space-between; align-items: center; background-color: #3a3a3a; padding: 10px 15px; margin-bottom: 10px; border-radius: 6px; color: #f1f1f1; font-weight: 500; }
        .gemini-stat-badge { background-color: #3498db; color: #ffffff; padding: 5px 10px; font-size: 14px; font-weight: bold; border-radius: 10px; min-width: 30px; text-align: center; }
        #gemini_building_stats_modal h4 { color: #5bc0de; margin-top: 25px; margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 5px; }
        .gemini-ls-stat-box { background-color: #3a3a3a; padding: 10px; margin-bottom: 10px; border-radius: 6px; color: #f1f1f1; border-left: 4px solid #3498db; height: 95%; }
        .gemini-ls-stat-box-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; margin-bottom: 8px; }
        .gemini-ls-stat-box-details { font-size: 12px; }
        .gemini-ls-stat-box-details span { margin-right: 15px; }
        .text-success { color: #5cb85c; }
        .text-danger { color: #d9534f; }
        .text-info { color: #5bc0de; }
        .text-warning { color: #f0ad4e; }
        .gemini-action-box { background-color: #2f2f2f; border: 1px solid #444; padding: 15px; border-radius: 6px; margin-top: 10px; }
        .gemini-action-box .form-control { width: 100px; display: inline-block; margin-right: 10px; background-color: #555; color: #fff; border: 1px solid #666; }
        .gemini-action-box h5 { margin-top: 0; color: #f1f1f1; font-weight: bold; }
        .fms-mini-stat { font-size: 11px; color: #ccc; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fms-badge-inline { padding: 2px 5px; border-radius: 4px; font-size: 10px; margin-right: 3px; color: #fff; font-weight: bold; background-color: #555; }

        /* NEU V9.9: Controls */
        .gemini-controls-row { display: flex; align-items: center; margin-bottom: 15px; background: #2f2f2f; padding: 10px; border-radius: 4px; }
        .gemini-search-input { flex-grow: 1; background: #444; border: 1px solid #555; color: white; padding: 6px 10px; border-radius: 4px; margin-right: 15px; }
        .gemini-sort-select { background: #444; border: 1px solid #555; color: white; padding: 6px 10px; border-radius: 4px; width: 200px; }
        .gemini-control-label { margin-right: 10px; color: #ccc; font-weight: normal; }
    `;
    GM_addStyle(customCss);

    // --- Main Logic ---

    async function showBuildingStats(event) {
        if(event) event.preventDefault();
        console.log('[LSS-Statistik V9.9] Starte Statistik-Erhebung...');

        showModal('<h4 id="gemini_stats_title">Lade Daten...</h4><div id="gemini_stats_body"><div class="progress"><div class="progress-bar progress-bar-striped active" style="width: 100%">Lade API Daten...</div></div></div>');
        const modalBody = document.getElementById('gemini_stats_body');
        const modalTitle = document.getElementById('gemini_stats_title');

        // Reset Data
        scriptDataStore = {
            leitstelleBuildingLists: new Map(), leitstellenMap: new Map(), tasks: [],
            stats: { buildings: new Map(), vehicles: new Map(), personnel: new Map(), training: { total: 0, courses: new Map() }, roles: { total: 0, roles: new Map() } }
        };

        try {
            const [buildingsResponse, vehiclesResponse] = await Promise.all([
                fetch('https://www.leitstellenspiel.de/api/buildings'),
                fetch('https://www.leitstellenspiel.de/api/vehicles')
            ]);

            if (!buildingsResponse.ok || !vehiclesResponse.ok) throw new Error(`API Fehler`);
            const buildings = await buildingsResponse.json();
            const vehicles = await vehiclesResponse.json();

            // --- Process Buildings ---
            const leitstellenMap = new Map();
            leitstellenMap.set(null, "Ohne Leitstelle");
            const leitstelleBuildingCounts = new Map();
            const leitstelleBuildingLists = new Map();
            let totalPersonnel = 0;
            const globalBuildingStats = { total: 0, enabled: 0, disabled: 0 };

            for (const building of buildings) {
                if (building.building_type === 7) leitstellenMap.set(building.id, building.caption);
                const type = building.building_type;
                const pCount = building.personal_count;

                globalBuildingStats.total++;
                building.enabled ? globalBuildingStats.enabled++ : globalBuildingStats.disabled++;

                scriptDataStore.stats.buildings.set(type, (scriptDataStore.stats.buildings.get(type) || 0) + 1);
                scriptDataStore.stats.personnel.set(type, (scriptDataStore.stats.personnel.get(type) || 0) + pCount);
                totalPersonnel += pCount;

                if (type !== 7) {
                    const lsId = building.leitstelle_building_id || null;
                    if (!leitstelleBuildingLists.has(lsId)) leitstelleBuildingLists.set(lsId, new Map());
                    if (!leitstelleBuildingCounts.has(lsId)) leitstelleBuildingCounts.set(lsId, new Map());

                    const lsTypeLists = leitstelleBuildingLists.get(lsId);
                    if (!lsTypeLists.has(type)) lsTypeLists.set(type, { enabled: [], disabled: [] });
                    building.enabled ? lsTypeLists.get(type).enabled.push(building.id) : lsTypeLists.get(type).disabled.push(building.id);

                    const statsForThisLS = leitstelleBuildingCounts.get(lsId);
                    const typeStats = statsForThisLS.get(type) || { total: 0, enabled: 0, disabled: 0 };
                    typeStats.total++;
                    building.enabled ? typeStats.enabled++ : typeStats.disabled++;
                    statsForThisLS.set(type, typeStats);
                }
                if (pCount > 0) scriptDataStore.tasks.push({ id: building.id, url: `https://www.leitstellenspiel.de/buildings/${building.id}/personals` });
            }
            scriptDataStore.leitstellenMap = leitstellenMap;
            scriptDataStore.leitstelleBuildingLists = leitstelleBuildingLists;

            // --- Process Vehicles ---
            const vehicleGlobalStats = { total: 0, fmsGlobal: {} };
            for (const v of vehicles) {
                vehicleGlobalStats.total++;
                const fms = v.fms_real;
                vehicleGlobalStats.fmsGlobal[fms] = (vehicleGlobalStats.fmsGlobal[fms] || 0) + 1;
                const typeId = v.vehicle_type;

                if (!scriptDataStore.stats.vehicles.has(typeId)) scriptDataStore.stats.vehicles.set(typeId, { count: 0, fms: {} });
                const entry = scriptDataStore.stats.vehicles.get(typeId);
                entry.count++;
                entry.fms[fms] = (entry.fms[fms] || 0) + 1;
            }

            // --- Render UI ---
            modalTitle.textContent = 'Statistik V9.9';
            modalBody.innerHTML = '';

            // 1. Übersicht
            const overviewHtml = `
                <div class="row">
                    <div class="col-md-4"><div class="gemini-stat-box"><strong>Gesamtgebäude</strong><span class="gemini-stat-badge">${globalBuildingStats.total.toLocaleString()}</span></div></div>
                    <div class="col-md-4"><div class="gemini-stat-box" style="border-left: 4px solid #5cb85c;"><strong>Aktiv</strong><span class="gemini-stat-badge">${globalBuildingStats.enabled.toLocaleString()}</span></div></div>
                    <div class="col-md-4"><div class="gemini-stat-box" style="border-left: 4px solid #d9534f;"><strong>Deaktiviert</strong><span class="gemini-stat-badge">${globalBuildingStats.disabled.toLocaleString()}</span></div></div>
                </div>
                <div class="row"><div class="col-md-12"><div class="gemini-stat-box"><strong>Gesamtpersonal</strong><span class="gemini-stat-badge">${totalPersonnel.toLocaleString()}</span></div></div></div>
            `;
            $(modalBody).append('<h4>Gesamtstatistik</h4>' + overviewHtml);

            // 2. Buildings Grid
            $(modalBody).append('<h4>Gebäude-Typen</h4>');
            $(modalBody).append(createControls('buildings'));
            $(modalBody).append('<div id="grid-buildings" class="row"></div>');
            renderGrid('buildings', 'name'); // Initial render (Alphabetical)

            // 3. Vehicles Grid
            const fmsBar = Object.keys(vehicleGlobalStats.fmsGlobal).sort().map(s => `<span class="badge" style="background-color: ${FMS_COLORS[s] || '#777'}; padding: 5px 8px;">S${s}: ${vehicleGlobalStats.fmsGlobal[s]}</span>`).join(' ');
            $(modalBody).append(`<h4>Fahrzeuge (Gesamt: ${vehicleGlobalStats.total})</h4>`);
            $(modalBody).append(`<div style="background:#2f2f2f; padding:10px; margin-bottom:10px; border-radius:6px;">${fmsBar}</div>`);
            $(modalBody).append(createControls('vehicles'));
            $(modalBody).append('<div id="grid-vehicles" class="row"></div>');
            renderGrid('vehicles', 'name'); // Initial render

            // 4. Leitstellen
            const leitstellenHtml = generateLeitstellenStatsHtml(leitstelleBuildingCounts, leitstellenMap);
            $(modalBody).append('<hr>' + leitstellenHtml);

            // 5. Scan Section
            const scanHtml = `
                <div id="gemini-personnel-scan-section">
                    <hr><div class="gemini-action-box" id="gemini-scan-control-box">
                        <h5 style="margin-top: 0;">Personal-Detailscan</h5>
                        <p style="color: #ccc;">Sammelt Details zu Ausbildungen und Rollen.</p>
                        <button class="btn btn-primary" id="gemini_start_scan_btn"><span class="glyphicon glyphicon-play"></span> Scan starten</button>
                    </div>
                    <div id="gemini-progress-wrapper" style="display: none;"></div>
                    <div id="gemini-training-stats-wrapper" style="display: none;">
                        <h4>Personal in Ausbildung</h4>
                        ${createControls('training')}
                        <div id="grid-training" class="row"></div>
                    </div>
                    <div id="gemini-role-stats-wrapper" style="display: none;">
                        <h4>Ausgebildetes Personal</h4>
                        ${createControls('roles')}
                        <div id="grid-roles" class="row"></div>
                    </div>
                </div>`;
            $(modalBody).append(scanHtml);

        } catch (error) {
            console.error(error);
            modalBody.innerHTML = `<div class="alert alert-danger">Fehler: ${error.message}</div>`;
        }
    }

    // --- Helper: Controls & Rendering ---

    function createControls(type) {
        return `
            <div class="gemini-controls-row">
                <span class="gemini-control-label">Suche:</span>
                <input type="text" class="gemini-search-input" data-target="grid-${type}" placeholder="Namen eingeben...">
                <span class="gemini-control-label">Sortierung:</span>
                <select class="gemini-sort-select" data-target="grid-${type}" data-type="${type}">
                    <option value="name">Name (A-Z)</option>
                    <option value="count">Anzahl (9-0)</option>
                </select>
            </div>
        `;
    }

    // Haupt-Render-Funktion für Grids
    function renderGrid(type, sortMode) {
        const container = $(`#grid-${type}`);
        container.empty();

        let dataMap;
        let nameResolver;
        let isVehicle = false;

        // Datenquelle wählen
        if (type === 'buildings') {
            dataMap = scriptDataStore.stats.buildings;
            nameResolver = getBuildingName;
        } else if (type === 'vehicles') {
            dataMap = scriptDataStore.stats.vehicles;
            nameResolver = getVehicleName;
            isVehicle = true;
        } else if (type === 'training') {
            dataMap = scriptDataStore.stats.training.courses;
            nameResolver = (k) => k;
        } else if (type === 'roles') {
            dataMap = scriptDataStore.stats.roles.roles;
            nameResolver = (k) => k;
        }

        if (!dataMap || dataMap.size === 0) {
            container.html('<div class="col-md-12 text-info">Keine Daten vorhanden.</div>');
            return;
        }

        // Map zu Array konvertieren
        let items = [];
        for (const [key, value] of dataMap.entries()) {
            const count = isVehicle ? value.count : value;
            const name = nameResolver(key);
            items.push({ key, name, count, raw: value });
        }

        // Sortieren
        items.sort((a, b) => {
            if (sortMode === 'name') return a.name.localeCompare(b.name);
            return b.count - a.count;
        });

        // HTML bauen
        let html = '';
        items.forEach(item => {
            let extraInfo = '';
            if (isVehicle) {
                let fmsString = '';
                Object.keys(item.raw.fms).sort().forEach(s => {
                    const c = item.raw.fms[s];
                    const color = FMS_COLORS[s] || '#555';
                    fmsString += `<span class="fms-badge-inline" style="background-color:${color}">S${s}: ${c}</span>`;
                });
                extraInfo = `<div class="fms-mini-stat">${fmsString}</div>`;
            }

            html += `
                <div class="col-md-3 col-sm-6 col-xs-12 gemini-grid-item">
                    <div class="gemini-stat-box" style="flex-direction: column; align-items: flex-start;">
                        <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 5px;">
                            <span class="gemini-item-name">${item.name}</span>
                            <span class="gemini-stat-badge">${item.count.toLocaleString()}</span>
                        </div>
                        ${extraInfo}
                    </div>
                </div>`;
        });
        container.html(html);
    }

    // --- Event Handlers for Interaction ---

    // Suche (Live-Filter)
    $(document).on('input', '.gemini-search-input', function() {
        const term = $(this).val().toLowerCase();
        const targetId = $(this).data('target');
        $(`#${targetId} .gemini-grid-item`).each(function() {
            const name = $(this).find('.gemini-item-name').text().toLowerCase();
            $(this).toggle(name.indexOf(term) > -1);
        });
    });

    // Sortierung (Re-Render)
    $(document).on('change', '.gemini-sort-select', function() {
        const type = $(this).data('type');
        const sortMode = $(this).val();
        renderGrid(type, sortMode);
        // Suche erneut anwenden, falls Text im Feld steht
        const searchInput = $(`.gemini-search-input[data-target="grid-${type}"]`);
        if(searchInput.val()) searchInput.trigger('input');
    });

    // --- Other Functions (Legacy/Unchanged Logic) ---

    function generateLeitstellenStatsHtml(leitstelleBuildingCounts, leitstellenMap) {
        let html = '<h4>Wachenverhältnis pro Leitstelle</h4>';
        const sortedLeitstellen = [...leitstelleBuildingCounts.entries()].sort((a, b) => (leitstellenMap.get(a[0])||'').localeCompare(leitstellenMap.get(b[0])||''));

        for (const [lsIdRaw, buildingCountsMap] of sortedLeitstellen) {
            const lsIdDom = lsIdRaw === null ? 'null' : lsIdRaw;
            const lsName = leitstellenMap.get(lsIdRaw) || `Unbekannte LS (${lsIdRaw})`;
            let lsTotal = 0, lsEnabled = 0, lsDisabled = 0;
            for (const s of buildingCountsMap.values()) { lsTotal += s.total; lsEnabled += s.enabled; lsDisabled += s.disabled; }

            html += `<h4>${lsName}</h4><div class="row">
                <div class="col-md-4"><div class="gemini-stat-box"><strong>Gesamt</strong><span class="gemini-stat-badge">${lsTotal}</span></div></div>
                <div class="col-md-4"><div class="gemini-stat-box" style="border-left:4px solid #5cb85c;"><strong>Aktiv</strong><span class="gemini-stat-badge">${lsEnabled}</span></div></div>
                <div class="col-md-4"><div class="gemini-stat-box" style="border-left:4px solid #d9534f;"><strong>Deaktiviert</strong><span class="gemini-stat-badge">${lsDisabled}</span></div></div>
            </div><div class="row">`;

            const sortedCounts = new Map([...buildingCountsMap.entries()].sort((a, b) => a[0] - b[0]));
            for (const [type, stats] of sortedCounts) {
                html += `<div class="col-md-4 col-sm-6"><div class="gemini-ls-stat-box"><div class="gemini-ls-stat-box-header"><span>${getBuildingName(type)}</span><span class="gemini-stat-badge">${stats.total}</span></div><div class="gemini-ls-stat-box-details"><span class="text-success">Aktiv: ${stats.enabled}</span><span class="text-danger">Aus: ${stats.disabled}</span></div></div></div>`;
            }
            html += '</div>';
            
            // Action Box (Kurzfassung für Übersicht)
            let optsOff = '', optsOn = '';
            for (const [type, stats] of sortedCounts) {
                if(stats.enabled > 0) optsOff += `<option value="${type}" data-max="${stats.enabled}">${getBuildingName(type)}</option>`;
                if(stats.disabled > 0) optsOn += `<option value="${type}" data-max="${stats.disabled}">${getBuildingName(type)}</option>`;
            }
            if(optsOff || optsOn) {
                 html += `<div class="row"><div class="col-md-12"><div class="gemini-action-box">
                 ${optsOff ? `<div>Deaktivieren: <select id="gemini_deact_type_${lsIdDom}" class="form-control" style="width:auto;display:inline;">${optsOff}</select> <input type="number" id="gemini_deact_count_${lsIdDom}" class="form-control" placeholder="Anzahl"> <button class="btn btn-warning gemini-deactivate-btn" data-ls-id-raw="${lsIdRaw}" data-ls-id-dom="${lsIdDom}">Go</button><span id="gemini_deact_max_label_${lsIdDom}" style="margin-left:5px;color:#999;"></span><div id="gemini_action_status_deact_${lsIdDom}"></div></div>` : ''}
                 ${optsOn ? `<div style="margin-top:10px;">Aktivieren: <select id="gemini_act_type_${lsIdDom}" class="form-control" style="width:auto;display:inline;">${optsOn}</select> <input type="number" id="gemini_act_count_${lsIdDom}" class="form-control" placeholder="Anzahl"> <button class="btn btn-success gemini-activate-btn" data-ls-id-raw="${lsIdRaw}" data-ls-id-dom="${lsIdDom}">Go</button><span id="gemini_act_max_label_${lsIdDom}" style="margin-left:5px;color:#999;"></span><div id="gemini_action_status_act_${lsIdDom}"></div></div>` : ''}
                 </div></div></div>`;
            }
        }
        return html;
    }

    // --- Worker & API ---
    async function scanPersonnelPages(tasks, progressWrapper, trainingDiv, roleDiv) {
        progressWrapper.innerHTML = `<h4>Scan läuft...</h4><div class="progress"><div id="gemini_stats_progressbar" class="progress-bar progress-bar-info progress-bar-striped active" style="width: 0%;">0 / ${tasks.length}</div></div>`;
        const progressBar = document.getElementById('gemini_stats_progressbar');
        
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
                    
                    scriptDataStore.stats.training.total += coursesFound.length;
                    coursesFound.forEach(c => scriptDataStore.stats.training.courses.set(c, (scriptDataStore.stats.training.courses.get(c) || 0) + 1));
                    
                    scriptDataStore.stats.roles.total += rolesFound.length;
                    rolesFound.forEach(r => scriptDataStore.stats.roles.roles.set(r, (scriptDataStore.stats.roles.roles.get(r) || 0) + 1));
                } catch (e) {}
                
                processedCount++;
                const pct = ((processedCount / totalTasks) * 100).toFixed(1);
                progressBar.style.width = `${pct}%`;
                progressBar.textContent = `${processedCount} / ${totalTasks}`;

                if (processedCount % UPDATE_UI_EVERY_X_BUILDINGS === 0 || processedCount === totalTasks) {
                   renderGrid('training', 'count'); // Live update sorted by count
                   renderGrid('roles', 'count');
                }
            }
        };

        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) workerPromises.push(worker());
        await Promise.all(workerPromises);
        progressWrapper.innerHTML = '<div class="alert alert-success">Scan abgeschlossen!</div>';
    }

    function fetchPage(url) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({ method: "GET", url: url, onload: (r) => r.status >= 200 ? resolve(r.responseText) : reject(), onerror: reject });
        });
    }

    function parsePersonnelHtml(html) {
        const coursesFound = [], rolesFound = [];
        try {
            const doc = new DOMParser().parseFromString(html, "text/html");
            doc.querySelectorAll('tr[data-filterable-by]').forEach(row => {
                const link = row.querySelector('span.label > a[href*="/schoolings/"]');
                if (link) coursesFound.push(link.textContent.trim());
                else {
                    const roleCell = row.querySelector('td:nth-child(2)');
                    if (roleCell && roleCell.textContent.trim()) roleCell.textContent.trim().split(',').forEach(r => { if(r.trim()) rolesFound.push(r.trim()); });
                }
            });
        } catch (e) {}
        return { coursesFound, rolesFound };
    }

    // --- Action Handlers (Deactivate/Activate) ---
    function toggleBuildingState(id) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({ method: "GET", url: `https://www.leitstellenspiel.de/buildings/${id}/active`, onload: resolve, onerror: reject });
        });
    }

    async function handleAction(event, mode) { // mode = 'deact' or 'act'
        event.preventDefault();
        const btn = $(event.currentTarget);
        const lsIdDom = btn.data('ls-id-dom');
        const lsIdRaw = btn.data('ls-id-raw') === 'null' ? null : parseInt(btn.data('ls-id-raw')); // Fix type conversion
        
        const select = $(`#gemini_${mode}_type_${lsIdDom}`);
        const input = $(`#gemini_${mode}_count_${lsIdDom}`);
        const status = $(`#gemini_action_status_${mode}_${lsIdDom}`);
        
        const count = parseInt(input.val());
        const type = parseInt(select.val());
        const max = parseInt(select.find('option:selected').data('max'));
        
        if(isNaN(count) || count <= 0 || count > max) { status.html('<span class="text-danger">Ungültige Anzahl</span>'); return; }
        
        const list = scriptDataStore.leitstelleBuildingLists.get(lsIdRaw).get(type);
        const queue = (mode === 'deact' ? list.enabled : list.disabled).sort(() => 0.5 - Math.random()).slice(0, count);
        
        btn.prop('disabled', true);
        status.html('<span class="text-info">Arbeite...</span>');
        
        let done = 0;
        const worker = async () => { while(queue.length) { const id = queue.shift(); try { await toggleBuildingState(id); done++; } catch(e){} status.text(`${done} / ${count}`); }};
        const threads = [];
        for(let i=0; i<8; i++) threads.push(worker());
        await Promise.all(threads);
        status.html(`<span class="text-success">Fertig (${done}). Bitte neu laden.</span>`);
    }

    // --- Modal Boilerplate ---
    function showModal(content) {
        let modal = $('#gemini_building_stats_modal');
        if(modal.length) modal.modal('hide'); // Bootstrap hide
        $('#gemini_building_stats_modal').remove(); // Clean DOM

        const modalHtml = `
            <div class="modal fade" id="gemini_building_stats_modal" tabindex="-1" role="dialog">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header"><button type="button" class="close" data-dismiss="modal">&times;</button><h4 class="modal-title">Erweiterte Statistik</h4></div>
                        <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">${content}</div>
                        <div class="modal-footer"><button class="btn btn-info" id="gemini_stats_refresh_btn" style="float:left;">Neu laden</button><button class="btn btn-default" data-dismiss="modal">Schließen</button></div>
                    </div>
                </div>
            </div>`;
        $('body').append(modalHtml);
        modal = $('#gemini_building_stats_modal');
        
        modal.on('click', '#gemini_stats_refresh_btn', showBuildingStats);
        modal.on('click', '#gemini_start_scan_btn', async (e) => {
            e.preventDefault();
            $('#gemini-scan-control-box').hide();
            $('#gemini-progress-wrapper, #gemini-training-stats-wrapper, #gemini-role-stats-wrapper').show();
            await scanPersonnelPages(scriptDataStore.tasks, document.getElementById('gemini-progress-wrapper'), document.getElementById('gemini-training-stats'), document.getElementById('gemini-role-stats'));
        });
        
        modal.on('click', '.gemini-deactivate-btn', function(e) { handleAction(e, 'deact'); });
        modal.on('click', '.gemini-activate-btn', function(e) { handleAction(e, 'act'); });
        
        // Dropdown limits update
        modal.on('change', 'select[id^="gemini_"]', function() {
            const id = $(this).attr('id');
            if(id.includes('type')) {
               const max = $(this).find('option:selected').data('max');
               const target = id.replace('type', 'max_label');
               const input = id.replace('type', 'count');
               $(`#${target}`).text(`(Max: ${max})`);
               $(`#${input}`).attr('max', max).attr('placeholder', `Max: ${max}`).val('');
            }
        });
        
        modal.modal('show');
        setTimeout(() => modal.find('select[id^="gemini_"]').trigger('change'), 500);
    }

    function addMenuItem() {
        const link = $('#logout_button').closest('li');
        if(link.length) link.after('<li role="presentation"><a href="#" id="gemini_building_stats_link"><span class="glyphicon glyphicon-stats" style="margin-right:5px;"></span> Statistik V9.9</a></li>');
        $('#gemini_building_stats_link').click(showBuildingStats);
    }

    if (typeof $ === 'function') $(document).ready(addMenuItem); else document.addEventListener('DOMContentLoaded', addMenuItem);
})();
