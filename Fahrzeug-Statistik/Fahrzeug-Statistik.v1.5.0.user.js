// ==UserScript==
// @name         LSS Kilometerkönig "Dark Polish"
// @namespace    www.leitstellenspiel.de
// @version      1.5.0
// @description  Statistik-Dashboard Dark Mode. Fixes für Button- und Textkontraste im Header.
// @author       Gemini
// @match        https://www.leitstellenspiel.de/*
// @icon         https://www.leitstellenspiel.de/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // === DATEN & KONFIGURATION ===
    const aircraftTypeIds = [31, 61, 65, 96, 127, 156, 157, 161];
    let cachedVehicleData = [];

    // Referenzwerte für den "Gimmick-Vergleich"
    const EARTH_CIRCUMFERENCE = 40075;
    const MOON_DISTANCE = 384400;
    const SUN_DISTANCE = 149600000;

    const vehicleTypes = {
        '0': 'LF 20', '1': 'LF 10', '2': 'DLK 23', '3': 'ELW 1',
        '4': 'RW', '5': 'GW-A', '6': 'LF 8/6', '7': 'LF 20/16',
        '8': 'LF 10/6', '9': 'LF 16-TS', '10': 'GW-Öl', '11': 'GW-L2-Wasser',
        '12': 'GW-Messtechnik', '13': 'SW 1000', '14': 'SW 2000', '15': 'SW 2000-Tr',
        '16': 'SW Kats', '17': 'TLF 2000', '18': 'TLF 3000', '19': 'TLF 8/8',
        '20': 'TLF 8/18', '21': 'TLF 16/24-Tr', '22': 'TLF 16/25', '23': 'TLF 16/45',
        '24': 'TLF 20/40', '25': 'TLF 20/40-SL', '26': 'TLF 16', '27': 'GW-Gefahrgut',
        '28': 'RTW', '29': 'NEF', '30': 'HLF 20', '31': 'RTH',
        '32': 'FuStW', '33': 'GW-Höhenrettung', '34': 'ELW 2', '35': 'leBefKw',
        '36': 'MTW', '37': 'TSF-W', '38': 'KTW', '39': 'GKW',
        '40': 'MTW-TZ', '41': 'MzGW (FGr N)', '42': 'LKW K 9', '43': 'BRmG R',
        '44': 'Anh DLE', '45': 'MLW 5', '46': 'WLF', '47': 'AB-Rüst',
        '48': 'AB-Atemschutz', '49': 'AB-Öl', '50': 'GruKw', '51': 'FüKW (Polizei)',
        '52': 'GefKw', '53': 'Dekon-P', '54': 'AB-Dekon-P', '55': 'KdoW-LNA',
        '56': 'KdoW-OrgL', '57': 'FwK', '58': 'KTW Typ B', '59': 'ELW 1 (SEG)',
        '60': 'GW-San', '61': 'Polizeihubschrauber', '62': 'AB-Schlauch', '63': 'GW-Taucher',
        '64': 'GW-Wasserrettung', '65': 'LKW 7 Lkr 19 tm', '66': 'Anh MzB', '67': 'Anh SchlB',
        '68': 'Anh MzAB', '69': 'Tauchkraftwagen', '70': 'MZB', '71': 'AB-MZB',
        '72': 'WaWe 10', '73': 'GRTW', '74': 'NAW', '75': 'FLF', '76': 'Rettungtreppe',
        '77': 'AB-Gefahrgut', '78': 'AB-Einsatzleitung', '79': 'SEK - ZF', '80': 'SEK - MTF',
        '81': 'MEK - ZF', '82': 'MEK - MTF', '83': 'GW-Werkfeuerwehr', '84': 'ULF mit Löscharm',
        '85': 'TM 50', '86': 'Turbolöscher', '87': 'TLF 4000', '88': 'KLF', '89': 'MLF',
        '90': 'HLF 10', '91': 'Rettungshundefahrzeug', '92': 'Anh Hund', '93': 'MTW-O',
        '94': 'DHuFüKW', '95': 'Polizeimotorrad', '96': 'Außenlastbehälter (allgemein)',
        '97': 'ITW', '98': 'Zivilstreifenwagen', '100': 'MLW 4', '101': 'Anh SwPu',
        '102': 'Anh 7', '103': 'FuStW (DGL)', '104': 'GW-L1', '105': 'GW-L2', '106': 'MTF-L',
        '107': 'LF-L', '108': 'AB-L', '109': 'MzGW SB', '110': 'NEA50', '112': 'NEA200',
        "114": 'GW-Lüfter', "115": 'Anh Lüfter', "116": 'AB-Lüfter', "117": 'AB-Tank',
        "118": 'Kleintankwagen', "119": 'AB-Lösch', "120": 'Tankwagen', "121": 'GTLF',
        "122": "LKW 7 Lbw (FGr E)", "123": "LKW 7 Lbw (FGr WP)", "124": "MTW-OV",
        "125": "MTW-Tr UL", "126": "MTF Drohne", "127": "GW UAS", "128": "ELW Drohne",
        "129": "ELW2 Drohne", "130": "GW-Bt", "131": "Bt-Kombi", "132": "FKH",
        "133": "Bt LKW", "134": "Pferdetransporter klein", "135": "Pferdetransporter groß",
        "136": "Anh Pferdetransport", "137": "Zugfahrzeug Pferdetransport",
        "138": "GW-Verpflegung", "139": "GW-Küche", "140": "MTW-Verpflegung", "142": "AB-Küche",
        "143": "Anh Schlauch", '144': 'FüKW (THW)', '145': 'FüKomKW', '146': 'Anh FüLa',
        '147': 'FmKW', '148': 'MTW-FGr K', '149': 'GW-Bergrettung (NEF)', '150': 'GW-Bergrettung',
        '151': 'ELW Bergrettung', '152': 'ATV', '153': 'Hundestaffel (Bergrettung)',
        '154': 'Schneefahrzeug', '155': 'Anh Höhenrettung (Bergrettung)',
        '156': 'Polizeihubschrauber (Winde)', '157': 'RTH Winde', '158': 'GW-Höhenrettung (Berg)',
        '159': 'Seenotrettungskreuzer', '160': 'Seenotrettungsboot', '161': 'Hubschrauber (See)',
        '162': 'RW-Schiene', '163': 'HLF Schiene', '164': 'AB-Schiene', '165': 'LauKw',
        '166': 'PTLF 4000', '167': 'SLF', '168': 'Anh Sonderlöschmittel', '169': 'AB-Sonderlöschmittel',
        '170': 'AB-Wasser/Schaum', '171': 'GW TeSi', '172': 'LKW Technik', '173': 'MTW TeSi',
        '174': 'Anh TeSi', '175': 'NEA50 (TeSi)', '176': 'LKW 7 Lbw (Log-V)',
        '177': 'MTW-FGr Log-V', '178': 'Anh 12 Lbw (Log-V)'
    };

    // === MENÜ ===
    const menuHtml = `
      <li id="km_king_li">
          <a href="#" id="km_king_btn" title="Fahrzeugstatistik öffnen">
              <span class="glyphicon glyphicon-stats" style="font-size: 18px;"></span>
              <span class="visible-xs">Statistik</span>
          </a>
      </li>
    `;
    $('#help_menu').before(menuHtml);

    // === STYLE INJECTION (DARK MODE FIXED) ===
    const css = `
        @keyframes spin { 100% { transform:rotate(360deg); } }

        /* Modal Grundstruktur - DARK */
        .km-modal-dialog { width: 95%; max-width: 1300px; height: 90vh; display: flex; flex-direction: column; justify-content: center; margin: 30px auto;}
        .km-modal-content { max-height: 100%; display: flex; flex-direction: column; overflow: hidden; background-color: #222 !important; color: #eee !important; border: 1px solid #444; }
        .km-modal-body { padding: 0; display: flex; flex: 1; overflow: hidden; background: #1a1a1a !important; }
        .modal-header { border-bottom: 1px solid #444 !important; background-color: #2b2b2b !important; }

        /* FOOTER */
        .modal-footer {
            border-top: 1px solid #444 !important;
            background-color: #2b2b2b !important;
            display: flex; justify-content: space-between; align-items: center;
        }
        .close { color: #fff !important; opacity: 0.8; }

        /* Sidebar (Filter) - DARK */
        .km-sidebar {
            width: 280px;
            background: #2a2a2a !important;
            border-right: 1px solid #444;
            display: flex; flex-direction: column; z-index: 10;
            box-shadow: 2px 0 5px rgba(0,0,0,0.2);
            color: #eee !important;
        }
        .km-sidebar-header { padding: 15px; background: #333 !important; border-bottom: 1px solid #444; color: #fff !important;}
        .km-sidebar-list { flex: 1; overflow-y: auto; padding: 10px 15px; scrollbar-width: thin; scrollbar-color: #555 #222;}

        /* FIX: Eigene Dark-Buttons für Alle/Keine, damit sie nicht matschig aussehen */
        .km-sidebar-header .btn-default {
            background-color: #444 !important; border-color: #555 !important; color: #eee !important;
        }
        .km-sidebar-header .btn-default:hover { background-color: #555 !important; border-color: #666 !important; }

        .km-filter-item label { font-weight: normal; cursor: pointer; width: 100%; display:block; padding: 2px 0; color: #ddd !important; }
        .km-filter-item label:hover { color: #fff !important; }

        /* Main Content - DARK */
        .km-content { flex: 1; display: flex; flex-direction: column; background: #222 !important; overflow: hidden; color: #eee !important;}
        .km-tabs { padding: 10px 15px 0 15px; background: #2a2a2a !important; border-bottom: 1px solid #444; }

        /* Tabs Anpassung FIX: Besserer Kontrast */
        .nav-tabs { border-bottom: 1px solid #444 !important; }
        .nav-tabs>li>a { color: #888 !important; background-color: #2a2a2a !important; border-color: transparent !important; }
        .nav-tabs>li.active>a, .nav-tabs>li.active>a:focus, .nav-tabs>li.active>a:hover {
            color: #fff !important; font-weight: bold;
            background-color: #222 !important;
            border: 1px solid #444 !important; border-bottom-color: transparent !important;
        }
        .nav-tabs>li>a:hover { background-color: #333 !important; color: #ddd !important; }

        /* Daten Bereich */
        .km-data-area { flex: 1; overflow-y: auto; padding: 15px; background: #222 !important; scrollbar-width: thin; scrollbar-color: #555 #222; }

        /* Tabelle Styles - DARK MODE */
        .km-data-area table { color: #ddd !important; background-color: transparent !important; }
        .km-data-area table thead th {
            position: sticky; top: 0; background: #333 !important; color: #fff !important;
            z-index: 5; box-shadow: 0 1px 2px rgba(0,0,0,0.5); border-bottom: 2px solid #555 !important;
        }
        .km-data-area table tbody tr { background-color: #222 !important; color: #ddd !important; border-top: 1px solid #333; }
        .km-data-area table tbody tr:nth-of-type(odd) { background-color: #2a2a2a !important; }
        .km-data-area table tbody tr:hover { background-color: #444 !important; }
        .km-data-area table td { border-top: 1px solid #333 !important; }

        .label-default { background-color: #555; }
        .km-data-area a { color: #8ecae6 !important; text-decoration: none; font-weight: bold; }
        .km-data-area a:hover { text-decoration: underline; color: #bde0fe !important; }

        /* Summen Statistik Style */
        .km-total-stat { font-size: 16px; color: #ddd; }
        .km-total-highlight { color: #ffcc00; font-weight: bold; font-family: monospace; }
        .km-total-fun { font-size: 12px; color: #aaa; margin-left: 10px; font-style: italic; }
    `;
    $('head').append(`<style>${css}</style>`);

    // === LOGIK ===
    $('#km_king_btn').on('click', async function(e) {
        e.preventDefault();
        const btn = $(this);
        const originalIcon = btn.html();
        btn.html('<span class="glyphicon glyphicon-refresh" style="font-size: 18px; animation: spin 1s infinite linear;"></span>');

        try {
            const [distData, vehiclesData] = await Promise.all([
                $.getJSON('/api/v1/vehicle_distances'),
                $.getJSON('/api/vehicles')
            ]);

            if (!distData.result || vehiclesData.length === 0) {
                alert("Keine Daten erhalten.");
                return;
            }

            const vehicleMap = {};
            vehiclesData.forEach(v => vehicleMap[v.id] = v);

            cachedVehicleData = [];
            distData.result.forEach(d => {
                const vDetails = vehicleMap[d.vehicle_id];
                if (vDetails) {
                    cachedVehicleData.push({
                        id: d.vehicle_id,
                        caption: vDetails.caption,
                        typeId: vDetails.vehicle_type,
                        typeName: vehicleTypes[vDetails.vehicle_type] || `Typ ${vDetails.vehicle_type}`,
                        km: d.distance_km
                    });
                }
            });

            const availableTypes = [...new Set(cachedVehicleData.map(v => v.typeId))];
            availableTypes.sort((a, b) => (vehicleTypes[a] || '').localeCompare(vehicleTypes[b] || ''));

            createAndShowModal(availableTypes);
            renderTables(availableTypes);

        } catch (err) {
            console.error(err);
            alert("Fehler: " + err);
        } finally {
            btn.html(originalIcon);
        }
    });

    function createAndShowModal(availableTypes) {
        let filterHtml = availableTypes.map(typeId => {
            const name = vehicleTypes[typeId] || 'Unbekannt ' + typeId;
            return `
                <div class="km-filter-item">
                    <label>
                        <input type="checkbox" class="lss-km-filter" value="${typeId}" checked>
                        ${name}
                    </label>
                </div>
            `;
        }).join('');

        // FIX: Helle Überschrift (color: #eee)
        const modalHtml = `
            <div class="modal fade" id="km_stats_modal" tabindex="-1" role="dialog">
                <div class="modal-dialog km-modal-dialog" role="document">
                    <div class="modal-content km-modal-content">
                        <div class="modal-header">
                            <button type="button" class="close" data-dismiss="modal">&times;</button>
                            <h4 class="modal-title" style="color: #eee !important;">📊 Fuhrpark-Statistik (Dark Mode)</h4>
                        </div>
                        <div class="modal-body km-modal-body">
                            <div class="km-sidebar">
                                <div class="km-sidebar-header">
                                    <div class="btn-group btn-group-sm btn-group-justified" style="margin-bottom: 5px;">
                                        <a href="#" class="btn btn-default" id="btn-check-all">Alle</a>
                                        <a href="#" class="btn btn-default" id="btn-uncheck-all">Keine</a>
                                    </div>
                                    <button class="btn btn-warning btn-sm btn-block" id="btn-no-air">Keine Fluggeräte</button>
                                </div>
                                <div class="km-sidebar-list">
                                    ${filterHtml}
                                </div>
                            </div>

                            <div class="km-content">
                                <div class="km-tabs">
                                    <ul class="nav nav-tabs" role="tablist">
                                        <li role="presentation" class="active"><a href="#tab_top20" role="tab" data-toggle="tab">Top 20</a></li>
                                        <li role="presentation"><a href="#tab_champs" role="tab" data-toggle="tab">Hall of Fame (Pro Typ)</a></li>
                                    </ul>
                                </div>
                                <div class="km-data-area">
                                    <div class="tab-content">
                                        <div role="tabpanel" class="tab-pane active" id="tab_top20">
                                            <table class="table table-striped table-hover">
                                                <thead><tr><th>#</th><th>Name</th><th>Typ</th><th class="text-right">Distanz</th></tr></thead>
                                                <tbody id="table-body-top20"></tbody>
                                            </table>
                                        </div>
                                        <div role="tabpanel" class="tab-pane" id="tab_champs">
                                            <table class="table table-striped table-hover">
                                                <thead><tr><th>Fahrzeugtyp</th><th>Der König</th><th class="text-right">Distanz</th></tr></thead>
                                                <tbody id="table-body-champs"></tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <div id="km-total-display" class="km-total-stat">
                                Berechne...
                            </div>
                            <button type="button" class="btn btn-default" data-dismiss="modal" style="color: #333 !important;">Schließen</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#km_stats_modal').remove();
        $('body').append(modalHtml);
        $('#km_stats_modal').modal('show');

        // Events
        $('.lss-km-filter').on('change', updateFromCheckboxes);
        $('#btn-check-all').on('click', (e) => { e.preventDefault(); $('.lss-km-filter').prop('checked', true); updateFromCheckboxes(); });
        $('#btn-uncheck-all').on('click', (e) => { e.preventDefault(); $('.lss-km-filter').prop('checked', false); updateFromCheckboxes(); });
        $('#btn-no-air').on('click', (e) => {
            e.preventDefault();
            $('.lss-km-filter').each(function() {
                const val = parseInt($(this).val());
                $(this).prop('checked', !aircraftTypeIds.includes(val));
            });
            updateFromCheckboxes();
        });
    }

    function updateFromCheckboxes() {
        const activeIds = [];
        $('.lss-km-filter:checked').each(function() { activeIds.push(parseInt($(this).val())); });
        renderTables(activeIds);
    }

    function renderTables(activeTypeIds) {
        const filteredList = cachedVehicleData.filter(v => activeTypeIds.includes(v.typeId));

        // 1. Gesamtsumme berechnen
        const totalKm = filteredList.reduce((sum, v) => sum + v.km, 0);
        let funFact = "";

        if (totalKm > SUN_DISTANCE) {
             funFact = `☀️ ${(totalKm / SUN_DISTANCE).toFixed(4)}x zur Sonne`;
        } else if (totalKm > MOON_DISTANCE) {
             funFact = `🌑 ${(totalKm / MOON_DISTANCE).toFixed(2)}x zum Mond`;
        } else if (totalKm > EARTH_CIRCUMFERENCE) {
             funFact = `🌍 ${(totalKm / EARTH_CIRCUMFERENCE).toFixed(2)}x um die Erde`;
        } else if (totalKm > 0) {
             funFact = "🚲 Einmal quer durchs Dorf";
        }

        const totalString = totalKm.toLocaleString('de-DE', {maximumFractionDigits: 0});
        $('#km-total-display').html(`
            Gesamt: <span class="km-total-highlight">${totalString} km</span>
            <span class="km-total-fun">${funFact}</span>
        `);


        // 2. Top 20
        const top20 = filteredList.sort((a, b) => b.km - a.km).slice(0, 20);
        let htmlTop20 = top20.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">Keine Auswahl</td></tr>' :
            top20.map((v, i) => `
                <tr>
                    <td>${i+1}.</td>
                    <td><a href="/vehicles/${v.id}" target="_blank" class="lightbox-open" style="font-weight:bold;">${v.caption}</a></td>
                    <td><span class="label label-default">${v.typeName}</span></td>
                    <td class="text-right">${v.km.toLocaleString('de-DE', {maximumFractionDigits: 1})} km</td>
                </tr>
            `).join('');
        $('#table-body-top20').html(htmlTop20);

        // 3. Champions
        const typeChampions = {};
        filteredList.forEach(v => {
            if (!typeChampions[v.typeId] || v.km > typeChampions[v.typeId].km) { typeChampions[v.typeId] = v; }
        });
        const sortedChampions = Object.values(typeChampions).sort((a, b) => b.km - a.km);

        let htmlChamps = sortedChampions.length === 0 ? '<tr><td colspan="3" class="text-center text-muted">Keine Auswahl</td></tr>' :
            sortedChampions.map(v => `
                <tr>
                    <td>${v.typeName}</td>
                    <td><a href="/vehicles/${v.id}" target="_blank" class="lightbox-open">${v.caption}</a></td>
                    <td class="text-right"><strong>${v.km.toLocaleString('de-DE', {maximumFractionDigits: 0})} km</strong></td>
                </tr>
            `).join('');
        $('#table-body-champs').html(htmlChamps);
    }
})();
