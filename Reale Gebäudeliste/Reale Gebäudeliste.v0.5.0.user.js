// ==UserScript==
// @name         Reale Gebäudeliste
// @namespace    http://tampermonkey.net/
// @version      0.5.0
// @description  Zeigt eine Liste von realen Gebäuden an und gleicht sie mit den eigenen ab. Lädt die Liste von einer externen Quelle.
// @author       Whice + Masklin
// @match        https://*.leitstellenspiel.de/
// @connect      bosmap.de
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

(async function() {
    'use strict';

    const projectName = '🏢 Reale Gebäudeliste';
    const wachenlisteBaseUrl = 'https://bosmap.de/export.php'; // Basis-URL zur externen Wachenliste

    // Definition der Gebäudetypen
    const building_type = {
        0: 'Feuerwache',
        1: 'Feuerwehrschule',
        2: 'Rettungswache',
        3: 'Rettungsschule',
        4: 'Krankenhaus',
        5: 'Rettungshubschrauber-Station',
        6: 'Polizeiwache',
        7: 'Leitstelle',
        8: 'Polizeischule',
        9: 'THW',
        10: 'THW Bundesschule',
        11: 'Bereitschaftspolizei',
        12: 'Schnelleinsatzgruppe (SEG)',
        13: 'Polizeihubschrauberstation',
        14: 'Bereitstellungsraum',
        15: 'Wasserrettung',
        17: 'Polizei-Sondereinheiten',
        18: 'Feuerwache (Kleinwache)',
        19: 'Polizeiwache (Kleinwache)',
        20: 'Rettungswache (Kleinwache)',
        21: 'Rettungshundestaffel',
        24: 'Reiterstaffel',
        25: 'Bergrettungswache',
        26: 'Seenotrettungswache',
        27: 'Schule für Seefahrt und Seenotrettung',
        28: 'Hubschrauberstation (Seenotrettung)'
    };


    // Globale Variablen für die Wachenlisten
    let wachen = []; // Externe Wachenliste
    let playerWachen = []; // Wachen des Spielers
    let uniqueRegions = []; // Eindeutige Regionen aus der externen Wachenliste
    let dataLoaded = false; // Flag, um zu verfolgen, ob die Daten bereits geladen wurden


    // UI-Elemente im Profil-Menü erstellen
    const menuProfile = document.getElementById('menu_profile');
    if (menuProfile) {
        const menuProfileUl = menuProfile.nextElementSibling;

        // Trennlinie hinzufügen
        const dividerForMenu = document.createElement('li');
        dividerForMenu.classList.add('divider');
        dividerForMenu.role = 'presentation';
        menuProfileUl.appendChild(dividerForMenu);

        // Menüpunkt für die Gebäudeliste hinzufügen
        const menuProfileAddMenuButton = document.createElement("li");
        menuProfileAddMenuButton.style = 'cursor: pointer;';
        const menuProfileAddMenuButtonA = document.createElement("a");
        menuProfileAddMenuButtonA.classList.add('project-name');
        menuProfileAddMenuButtonA.onclick = function() {
            closeOrOpenMenuList(); // Funktion zum Öffnen/Schließen des Menüs
        };

        menuProfileAddMenuButtonA.textContent = projectName;
        menuProfileAddMenuButton.appendChild(menuProfileAddMenuButtonA);
        menuProfileUl.appendChild(menuProfileAddMenuButton);
    }

    /**
     * Erstellt das Hauptfenster für die Gebäudeliste und fügt es in die Seite ein.
     */
    function createBuildingMenu() {
        const buildingMenuList = document.createElement('div');

        // Styles für das Menüfenster
        const styleElement = document.createElement('style');
        styleElement.textContent = `
        .building-menu {
            display: flex;
            flex-direction: column;
            width: 80%;
            max-width: 1200px;
            height: 80vh;
            background: white;
            box-shadow: 0 0 15px rgba(0,0,0,0.2);
            position: fixed;
            top: 10%;
            left: 10%;
            z-index: 1000;
            border-radius: 8px;
            overflow: hidden;
        }
        .menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: #f8f9fa;
        }
        .close-btn {
            background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d; margin-top: -30px;
        }
        .divider { border: 0; height: 1px; background: #dee2e6; margin: 10px 0; }
        .filter-section { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 15px; }
        .filter-btn { padding: 5px 10px; background: #e9ecef; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
        .filter-btn.active { background: #0d6efd; color: white; }
        .wachen-list { flex: 1; overflow-y: auto; padding: 0 15px; }
        .building-menu-page-content > .wache-entry:nth-child(even) { background-color: #f8f9fa; }
        .wache-entry { display: grid; grid-template-columns: 1fr auto auto; align-items: center; padding: 10px; border-bottom: 1px solid #eee; gap: 15px; }
        .wache-name { flex: 1; }
        .additional-info { font-size: 0.9em; color: #666; margin-top: 2px; }
        .label { padding: 3px 8px; border-radius: 4px; font-size: 12px; color: white; text-align: center; }
        .label.success { background: #28a745; }
        .label.danger { background: #dc3545; }
        .map-btn, .map-btn-place { background: none; border: 1px solid #0d6efd; color: #0d6efd; padding: 5px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
        .map-btn-place { border-color: orange; color: orange; }
        .map-btn:hover { background: #0d6efd; color: white; }
        .map-btn-place:hover { background: orange; color: white; }
        .project-name::first-letter { font-size: 1.5em; margin-right: 5px; }
        #region-filter-select { padding: 5px; border-radius: 4px; border: 1px solid #ced4da; }
        .loading-text { padding: 20px; text-align: center; font-size: 1.2em; color: #6c757d; }
        `;
        document.head.appendChild(styleElement); // Styles zum head hinzufügen

        buildingMenuList.id = 'buildingMenuList';
        buildingMenuList.style.display = 'none'; // Standardmäßig ausgeblendet
        buildingMenuList.className = 'building-menu';
        buildingMenuList.innerHTML = `
            <div class="menu-header">
                <h2 class="project-name">${projectName}</h2>
                <button class="close-btn">×</button>
            </div>
            <div class="filter-section" id="building-type-filters">
                <button class="filter-btn active" data-filter-group="wachen" data-filter-value='-1'>Alle</button>
                <button class="filter-btn" data-filter-group="wachen" data-filter-value='0'>Feuerwache</button>
                <button class="filter-btn" data-filter-group="wachen" data-filter-value='6'>Polizeiwachen</button>
                <button class="filter-btn" data-filter-group="wachen" data-filter-value='2'>Rettungswachen</button>
                <button class="filter-btn" data-filter-group="wachen" data-filter-value='9'>THW</lsa </button>
                <button class="filter-btn" data-filter-group="wachen" data-filter-value='11'>BePo</button>
                <button class="filter-btn" data-filter-group="wachen" data-filter-value='15'>Wasserrettung</button>
            </div>
            <div class="filter-section" id="region-filters">
                 <select id="region-filter-select">
                    <option value="all">Alle Regionen</option>
                 </select>
            </div>
            <hr class="divider">
            <div class="building-menu-page-content wachen-list" id="building-menu-page-content">
                <div class="loading-text">Lade Wachenliste...</div>
            </div>`;
        document.body.appendChild(buildingMenuList); // Menü zum Body hinzufügen
    }

    /**
     * Schaltet die Sichtbarkeit des Menüs um.
     * Startet den Ladevorgang, falls die Daten noch nicht geladen wurden.
     * Löscht alle zwischengespeicherten Daten, wenn das Menü geschlossen wird.
     */
    async function closeOrOpenMenuList() {
        const menu = document.getElementById('buildingMenuList');
        if (menu) {
            if (menu.style.display === 'none') {
                // Menü wird geöffnet
                menu.style.display = 'flex';
                if (!dataLoaded) {
                    // Daten nur beim ersten Öffnen laden
                    await main();
                    dataLoaded = true;
                }
            } else {
                // Menü wird geschlossen
                menu.style.display = 'none';
                // Daten und Listen löschen, wenn das Menü geschlossen wird
                wachen = [];
                playerWachen = [];
                uniqueRegions = [];
                dataLoaded = false; // Setze Flag zurück, damit beim nächsten Öffnen neu geladen wird
                console.log(`${projectName}: Daten wurden gelöscht.`);
                // Setze die Ladeanzeige zurück, wenn das Menü geschlossen wird
                const pageContent = document.getElementById('building-menu-page-content');
                if (pageContent) {
                    pageContent.innerHTML = `<div class="loading-text">Lade Wachenliste...</div>`;
                }
                // Filter zurücksetzen (optional, aber sinnvoll, wenn Daten gelöscht werden)
                regionFilter = 'all';
                wachenFilter = -1;
                // UI-Filter-Buttons zurücksetzen
                document.querySelectorAll(`[data-filter-group="wachen"]`).forEach(b => b.classList.remove('active'));
                document.querySelector(`[data-filter-group="wachen"][data-filter-value="-1"]`).classList.add('active');
                const regionSelect = document.getElementById('region-filter-select');
                if (regionSelect) {
                    regionSelect.innerHTML = '<option value="all">Alle Regionen</option>'; // Optionen löschen
                }
            }
        }
    }

    // Aktuelle Filterwerte
    let regionFilter = 'all';
    let wachenFilter = -1;

    /**
     * Verarbeitet Klicks auf die Filter-Buttons und das Dropdown.
     */
    document.addEventListener('click', function(event) {
        if (event.target.matches('.filter-btn')) {
            const group = event.target.getAttribute('data-filter-group');
            const groupValue = event.target.getAttribute('data-filter-value');

            // Aktiven Button hervorheben
            document.querySelectorAll(`[data-filter-group="${group}"]`).forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');

            if (group === 'wachen') {
                wachenFilter = parseInt(groupValue, 10);
            }
            updateBuildingMenuListList(regionFilter, wachenFilter); // Liste aktualisieren
        }
    });

    document.addEventListener('change', function(event) {
        if (event.target.matches('#region-filter-select')) {
             regionFilter = event.target.value;
             updateBuildingMenuListList(regionFilter, wachenFilter); // Liste aktualisieren
        }
    });

    /**
     * Aktualisiert die angezeigte Liste basierend auf den aktiven Filtern.
     * @param {string} region - Der ausgewählte Regionsfilter.
     * @param {number} wacheTyp - Der ausgewählte Gebäudetyp-Filter.
     */
    function updateBuildingMenuListList(region = 'all', wacheTyp = -1) {
        const pageContent = document.getElementById('building-menu-page-content');
        if (!pageContent) return;
        pageContent.innerHTML = ''; // Vorherige Einträge löschen

        let filteredList = wachen;
        // Filter nach Region anwenden
        if (region !== 'all') {
            filteredList = filteredList.filter(w => w.region === region);
        }
        // Filter nach Gebäudetyp anwenden
        if (wacheTyp !== -1) {
            filteredList = filteredList.filter(w => w.building_type === wacheTyp);
        }

        // Wenn keine Daten vorhanden sind, Ladeanzeige anzeigen (wichtig nach dem Löschen)
        if (filteredList.length === 0 && dataLoaded === false) {
             pageContent.innerHTML = `<div class="loading-text">Lade Wachenliste...</div>`;
             return;
        } else if (filteredList.length === 0 && dataLoaded === true) {
             pageContent.innerHTML = `<div class="loading-text">Keine passenden Wachen gefunden.</div>`;
             return;
        }


        // Einträge für die gefilterte Liste erstellen
        filteredList.forEach(w => {
            const playerWache = getPlayerWacheFromRealWache(w); // Prüfen, ob der Spieler die Wache besitzt
            const el = document.createElement("div");
            el.className = "wache-entry";
            el.innerHTML = `
                <div class="wache-name">${w.name}
                    <div class="additional-info">${building_type[w.building_type] || 'Unbekannt'}</div>
                </div>
                <span class="label ${playerWache ? "success" : "danger"}">${playerWache ? "Vorhanden" : "Fehlt"}</span>
                <button class="${playerWache ? "map-btn" : "map-btn-place"}">${playerWache ? "Auf Karte" : "Platzieren"}</button>
            `;

            const button = el.querySelector('button');
            // Event Listener für den Button hinzufügen
            if (playerWache) {
                 // Wenn Wache vorhanden, auf Karte zentrieren
                 button.addEventListener("click", () => {
                    if (typeof map !== 'undefined' && map.setView) {
                        map.invalidateSize(); // Karte neu initialisieren
                        map.setView([playerWache.latitude, playerWache.longitude], 17); // Karte zentrieren und zoomen
                        closeOrOpenMenuList(); // Menü schließen
                    }
                });
            } else {
                 // Wenn Wache fehlt, Bau-Dialog öffnen und Karte zentrieren
                 button.addEventListener("click", () => {
                    document.querySelector('#build_new_building')?.click(); // Button zum Bauen eines neuen Gebäudes klicken
                     if (typeof map !== 'undefined' && map.setView) {
                        map.invalidateSize();
                        map.setView([w.latitude, w.longitude], 17); // Karte zentrieren
                    }
                    closeOrOpenMenuList(); // Menü schließen
                    // Gebäudedaten in die Formularfelder eintragen (mit leichter Verzögerung)
                    setTimeout(() => {
                        const nameInput = document.querySelector('#building_name');
                        const typSelect = document.querySelector('#building_building_type');
                        if (nameInput) nameInput.value = w.name;
                        if (typSelect) typSelect.value = w.building_type;
                    }, 500);
                });
            }
            pageContent.appendChild(el); // Eintrag zur Liste hinzufügen
        });
    }

    /**
     * Vergleicht eine reale Wache mit den Wachen des Spielers.
     * @param {object} realWache - Das Objekt der realen Wache.
     * @returns {object|null} - Die gefundene Spielerwache oder null.
     */
    function getPlayerWacheFromRealWache(realWache) {
        // Toleranz für Koordinatenabweichungen, um Ungenauigkeiten auszugleichen
        const latTolerance = 0.0027;
        const lonTolerance = 0.0043;

        return playerWachen.find(playerWache =>
            playerWache.latitude <= realWache.latitude + latTolerance &&
            playerWache.latitude >= realWache.latitude - latTolerance &&
            playerWache.longitude <= realWache.longitude + lonTolerance &&
            playerWache.longitude >= realWache.longitude - lonTolerance &&
            playerWache.building_type === realWache.building_type
        );
    }

     /**
     * Füllt das Dropdown-Menü für die Regionen.
     */
    function populateRegionFilter() {
        const select = document.getElementById('region-filter-select');
        if (!select) return;

        // Vorhandene Optionen löschen (außer der "Alle Regionen"-Option)
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Eindeutige Regionen sammeln und sortieren
        uniqueRegions = [...new Set(wachen.map(w => w.region))].sort();
        uniqueRegions.forEach(region => {
            if (region) { // Nur gültige Regionen hinzufügen
                const option = document.createElement('option');
                option.value = region;
                option.textContent = region;
                select.appendChild(option);
            }
        });
    }

    /**
     * Hauptfunktion, die nach dem Laden der Seite ausgeführt wird.
     * Lädt die Gebäude des Spielers und die externe Wachenliste.
     */
    async function main() {
        const pageContent = document.getElementById('building-menu-page-content');
        if (pageContent) {
            pageContent.innerHTML = `<div class="loading-text">Lade Wachenliste...</div>`; // Ladeanzeige
        }

        try {
            // Lade die Gebäude des Spielers
            const playerBuildingsResponse = await fetch('/api/buildings');
            if (!playerBuildingsResponse.ok) {
                throw new Error(`Fehler beim Laden der Spielergebäude: ${playerBuildingsResponse.status}`);
            }
            playerWachen = await playerBuildingsResponse.json();

            // Lade die externe Wachenliste mittels GM_xmlhttpRequest für Cross-Domain-Anfragen
            await new Promise((resolve, reject) => {
                // Füge einen Cache-Buster-Parameter zur URL hinzu
                const wachenlisteUrlWithCacheBuster = `${wachenlisteBaseUrl}?_=${new Date().getTime()}`;

                GM_xmlhttpRequest({
                    method: "GET",
                    url: wachenlisteUrlWithCacheBuster, // Verwende die URL mit Cache-Buster
                    onload: function(response) {
                        console.log("GM_xmlhttpRequest - Response Status:", response.status); // Debugging
                        const rawText = response.responseText.trim();
                        console.log("GM_xmlhttpRequest - Raw Response Text (first 500 chars):", rawText.substring(0, 500)); // Debugging

                        // Überprüfen, ob der Inhalt aussieht wie ein User-Skript (als Fallback)
                        if (rawText.startsWith('// ==UserScript==')) {
                            const errorMsg = `Fehler: Die URL für die Wachenliste (${wachenlisteBaseUrl}) liefert eine User-Skript-Datei anstelle der erwarteten Daten. Bitte überprüfen Sie die Quelle.`;
                            if (pageContent) {
                                pageContent.innerHTML = `<div class="loading-text" style="color: red;">${errorMsg}</div>`;
                            }
                            console.error(errorMsg);
                            reject(new Error(errorMsg));
                            return;
                        }

                        // Daten zeilenweise verarbeiten
                        const lines = rawText.split('\n').filter(line => line.trim() !== ''); // Leere Zeilen filtern

                        wachen = lines.map(line => {
                            try {
                                // Konvertiere single-quoted Strings zu double-quoted und füge Anführungszeichen zu unquoted Keys hinzu
                                // Ersetzt einfache Anführungszeichen in Werten durch doppelte Anführungszeichen
                                let jsonString = line.replace(/'([^']+)'/g, '"$1"');
                                // Fügt Anführungszeichen zu Keys hinzu, die keine haben
                                jsonString = jsonString.replace(/([a-zA-Z_][a-zA-Z0-9_]*):/g, '"$1":');

                                // Parsen des modifizierten Strings als JSON
                                const parsedObject = JSON.parse(jsonString);

                                // Validierung der Struktur des geparsten Objekts
                                if (typeof parsedObject.name === 'string' &&
                                    typeof parsedObject.latitude === 'number' &&
                                    typeof parsedObject.longitude === 'number' &&
                                    typeof parsedObject.building_type === 'number' &&
                                    typeof parsedObject.region === 'string') {
                                    return parsedObject;
                                } else {
                                    console.warn("Skipping malformed object structure after parsing:", line, parsedObject);
                                    return null;
                                }
                            } catch (e) {
                                console.warn("Skipping malformed line (JSON parsing error):", line, e);
                                return null;
                            }
                        }).filter(w => w); // Einträge, die null sind (Fehler beim Parsen), entfernen

                        console.log("Parsed Wachen data:", wachen); // Debugging: Geparsste Daten anzeigen
                        resolve();
                    },
                    onerror: function(response) {
                        const errorMsg = `${projectName}: Fehler beim Laden der CSV-Datei: Status ${response.status}`;
                        if (pageContent) {
                            pageContent.innerHTML = `<div class="loading-text" style="color: red;">${errorMsg}. Bitte die Konsole prüfen.</div>`;
                        }
                        console.error(errorMsg, response); // Debugging
                        reject(new Error(errorMsg));
                    }
                });
            });


            // Sobald beide Datenquellen geladen sind, UI initialisieren
            populateRegionFilter();
            updateBuildingMenuListList();

        } catch (err) {
            console.error(`${projectName}: Fehler beim Laden der Daten:`, err);
            const pageContent = document.getElementById('building-menu-page-content');
            if (pageContent) {
                pageContent.innerHTML = `<div class="loading-text" style="color: red;">Fehler beim Laden der Wachenliste. Bitte die Konsole prüfen.</div>`;
            }
        }
    }

    // Initialisierung des Skripts
    createBuildingMenu(); // Menü erstellen
    document.querySelector('.close-btn')?.addEventListener('click', closeOrOpenMenuList); // Event Listener für den Schließen-Button

    // Der Start des Ladevorgangs erfolgt jetzt über closeOrOpenMenuList beim ersten Öffnen des Menüs.
    // main(); // Entfernt, da der Ladevorgang nun explizit über das Menü gesteuert wird

})();
