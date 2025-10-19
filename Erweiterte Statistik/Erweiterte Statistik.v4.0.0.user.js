// ==UserScript==
// @name         Leitstellenspiel Gebäude- & Personalstatistik (V4.0)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Zählt Gebäude, Personal (API), Personal in Ausbildung (HTML) und ausgebildetes Personal (HTML)
// @author       Gemini
// @match        https://www.leitstellenspiel.de/*
// @grant        GM.xmlHttpRequest
// @connect      leitstellenspiel.de
// ==/UserScript==

(function() {
    'use strict';

    // --- Konstanten ---
    const MAX_CONCURRENT_WORKERS = 8; // 8 parallele Anfragen

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

    // --- Haupt-Statistik-Funktion ---

    /**
     * Wird aufgerufen, wenn der Menüpunkt geklickt wird.
     */
    async function showBuildingStats(event) {
        event.preventDefault();
        console.log('[LSS-Statistik V4.0] Starte Statistik-Erhebung...');

        // 1. Modal sofort anzeigen mit Lade-Status
        showModal('<h4 id="gemini_stats_title">Lade Gebäudeliste...</h4><div id="gemini_stats_body"></div>');
        const modalTitle = document.getElementById('gemini_stats_title');
        const modalBody = document.getElementById('gemini_stats_body');

        try {
            // 2. Basis-Daten von der API abrufen
            const response = await fetch('https://www.leitstellenspiel.de/api/buildings');
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            const buildings = await response.json();

            // 3. Basis-Daten verarbeiten
            const allBuildingIds = [];
            const buildingCounts = new Map();
            const personnelCounts = new Map();
            let totalBuildings = 0;
            let totalPersonnel = 0;
            const tasks = []; // Aufgaben-Queue für die Worker

            for (const building of buildings) {
                allBuildingIds.push(building.id);
                const type = building.building_type;
                const pCount = building.personal_count;

                buildingCounts.set(type, (buildingCounts.get(type) || 0) + 1);
                totalBuildings++;
                personnelCounts.set(type, (personnelCounts.get(type) || 0) + pCount);
                totalPersonnel += pCount;

                if (pCount > 0) { // Nur Gebäude mit Personal müssen wir scannen
                    tasks.push({
                        id: building.id,
                        url: `https://www.leitstellenspiel.de/buildings/${building.id}/personals`
                    });
                }
            }

            console.log(`[LSS-Statistik V4.0] ${buildings.length} Gebäude gefunden. ${tasks.length} Gebäude mit Personal werden gescannt.`);
            console.log('[LSS-Statistik V4.0] Gesammelte Gebäude-IDs:', allBuildingIds);

            // 4. HTML für Basis-Statistiken generieren
            modalBody.innerHTML = generateBaseStatsHtml(buildingCounts, personnelCounts, totalBuildings, totalPersonnel);
            modalTitle.textContent = 'Gebäude- & Personalstatistik';

            // 5. Worker-Pool für Ausbildungs- & Rollen-Scan starten
            const detailedStatsHtml = await scanPersonnelPages(tasks, modalBody);
            modalBody.innerHTML += detailedStatsHtml; // Finale Statistik hinzufügen

        } catch (error) {
            console.error('[LSS-Statistik V4.0] Fehler:', error);
            modalBody.innerHTML = `<div class="alert alert-danger">Fehler beim Abrufen der Daten: ${error.message}</div>`;
        }
    }

    /**
     * Generiert das HTML für die (schnellen) API-Basierten Statistiken
     */
    function generateBaseStatsHtml(buildingCounts, personnelCounts, totalBuildings, totalPersonnel) {
        let totalHtml = '<h4>Gesamtstatistik</h4><div class="row">';
        totalHtml += `<div class="col-md-6 col-sm-6 col-xs-12"><strong>Gesamtgebäude:</strong> ${totalBuildings.toLocaleString()}</div>`;
        totalHtml += `<div class="col-md-6 col-sm-6 col-xs-12"><strong>Gesamtpersonal (aus API):</strong> ${totalPersonnel.toLocaleString()}</div>`;
        totalHtml += '</div><hr>';

        let buildingGridHtml = '<h4>Gebäudeanzahl</h4><div class="row">';
        const sortedBuildingCounts = new Map([...buildingCounts.entries()].sort((a, b) => a[0] - b[0]));
        for (const [type, count] of sortedBuildingCounts.entries()) {
            buildingGridHtml += `<div class="col-md-4 col-sm-6 col-xs-12"><strong>${getBuildingName(type)}:</strong> ${count}</div>`;
        }
        buildingGridHtml += '</div><hr>';

        let personnelGridHtml = '<h4>Personalanzahl (aus API)</h4><div class="row">';
        const sortedPersonnelCounts = new Map([...personnelCounts.entries()].sort((a, b) => a[0] - b[0]));
        for (const [type, count] of sortedPersonnelCounts.entries()) {
            personnelGridHtml += `<div class="col-md-4 col-sm-6 col-xs-12"><strong>${getBuildingName(type)}:</strong> ${count.toLocaleString()}</div>`;
        }
        personnelGridHtml += '</div><hr>';

        return totalHtml + buildingGridHtml + personnelGridHtml;
    }

    // --- Worker-Pool & HTML-Parsing ---

    /**
     * Startet den Worker-Pool, um alle Personal-Seiten zu scannen.
     * @param {Array} tasks - Liste von {id, url} Objekten
     * @param {HTMLElement} modalBody - Das Modal-Body-Element zur Fortschrittsanzeige
     * @returns {Promise<string>} Das HTML für die Ausbildungs- & Rollen-Statistik
     */
    async function scanPersonnelPages(tasks, modalBody) {
        // 6. Fortschrittsanzeige im Modal erstellen
        const progressWrapper = document.createElement('div');
        progressWrapper.innerHTML = `
            <h4>Personal-Scan (wird geladen...)</h4>
            <div class="progress">
                <div id="gemini_stats_progressbar" class="progress-bar progress-bar-info progress-bar-striped active" role="progressbar" style="width: 0%; min-width: 2em;">
                    0 / ${tasks.length}
                </div>
            </div>
            <div id="gemini_stats_progress_details" style="text-align: center; margin-bottom: 15px;">Starte Scan...</div>
        `;
        modalBody.appendChild(progressWrapper);
        const progressBar = document.getElementById('gemini_stats_progressbar');
        const progressDetails = document.getElementById('gemini_stats_progress_details');

        // 7. Globale Zähler für die Worker
        const trainingStats = { total: 0, courses: new Map() }; // "Im Unterricht"
        const trainedRoleStats = { total: 0, roles: new Map() }; // "Ausgebildete Rolle"

        let processedCount = 0;
        const totalTasks = tasks.length;
        const queue = [...tasks]; // Kopie der Tasks als Warteschlange

        // 8. Worker-Funktion
        const worker = async () => {
            while (queue.length > 0) {
                const task = queue.shift();
                if (!task) continue;

                try {
                    const html = await fetchPage(task.url);
                    // Parse liefert jetzt BEIDE Listen zurück
                    const { coursesFound, rolesFound } = parsePersonnelHtml(html);

                    // Ergebnisse für "In Ausbildung" synchronisieren
                    trainingStats.total += coursesFound.length;
                    for (const courseName of coursesFound) {
                        trainingStats.courses.set(courseName, (trainingStats.courses.get(courseName) || 0) + 1);
                    }

                    // Ergebnisse für "Ausgebildete Rollen" synchronisieren
                    trainedRoleStats.total += rolesFound.length;
                     for (const roleName of rolesFound) {
                        trainedRoleStats.roles.set(roleName, (trainedRoleStats.roles.get(roleName) || 0) + 1);
                    }

                } catch (error) {
                    console.warn(`[LSS-Statistik V4.0] Fehler bei Gebäude ${task.id}:`, error);
                }

                // Fortschritt aktualisieren
                processedCount++;
                const percentage = ((processedCount / totalTasks) * 100).toFixed(1);
                progressBar.style.width = `${percentage}%`;
                progressBar.textContent = `${processedCount} / ${totalTasks}`;
                progressDetails.textContent = `Scanne Gebäude ${task.id}...`;
            }
        };

        // 9. Worker-Pool starten
        console.log(`[LSS-Statistik V4.0] Starte ${MAX_CONCURRENT_WORKERS} Worker für ${totalTasks} Aufgaben.`);
        const workerPromises = [];
        for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
            workerPromises.push(worker());
        }

        // 10. Warten, bis alle Worker fertig sind
        await Promise.all(workerPromises);

        console.log('[LSS-Statistik V4.0] Scan abgeschlossen. In Ausbildung:', trainingStats);
        console.log('[LSS-Statistik V4.0] Ausgebildete Rollen:', trainedRoleStats);

        // 11. Fortschrittsanzeige aufräumen
        progressWrapper.remove();

        // 12. Finale HTML-Statistiken generieren
        let htmlOutput = "";

        // HTML für "In Ausbildung"
        htmlOutput += '<h4>Personal in Ausbildung</h4><div class="row">';
        htmlOutput += `<div class="col-md-12 col-sm-12 col-xs-12"><strong>Gesamt in Ausbildung:</strong> ${trainingStats.total.toLocaleString()}</div>`;
        htmlOutput += '</div><br><div class="row">';
        const sortedCourses = new Map([...trainingStats.courses.entries()].sort((a, b) => b[1] - a[1]));
        for (const [course, count] of sortedCourses.entries()) {
            htmlOutput += `<div class="col-md-4 col-sm-6 col-xs-12"><strong>${course}:</strong> ${count.toLocaleString()}</div>`;
        }
        htmlOutput += '</div><hr>'; // Trennlinie

        // HTML für "Ausgebildetes Personal"
        htmlOutput += '<h4>Ausgebildetes Personal (Rollen)</h4><div class="row">';
        htmlOutput += `<div class="col-md-12 col-sm-12 col-xs-12"><strong>Gesamt mit zugewiesener Rolle:</strong> ${trainedRoleStats.total.toLocaleString()}</div>`;
        htmlOutput += '</div><br><div class="row">';
        const sortedRoles = new Map([...trainedRoleStats.roles.entries()].sort((a, b) => b[1] - a[1]));
        for (const [role, count] of sortedRoles.entries()) {
            htmlOutput += `<div class="col-md-4 col-sm-6 col-xs-12"><strong>${role}:</strong> ${count.toLocaleString()}</div>`;
        }
        htmlOutput += '</div>';

        return htmlOutput;
    }

    /**
     * Ruft eine Seite mit GM.xmlHttpRequest ab.
     * @param {string} url - Die abzurufende URL
     * @returns {Promise<string>} Der HTML-Inhalt der Seite
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
     * Parst das HTML einer Personal-Seite und extrahiert Ausbildungen UND Rollen.
     * @param {string} html - Der HTML-String
     * @returns {Object} { coursesFound: Array<string>, rolesFound: Array<string> }
     */
    function parsePersonnelHtml(html) {
        const coursesFound = [];
        const rolesFound = [];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Alle Personal-Zeilen finden
            const rows = doc.querySelectorAll('tr[data-filterable-by]');

            rows.forEach(row => {
                // 1. Check: "Im Unterricht"
                // <span class="label ...">Im Unterricht: <a href="/schoolings/...">LEHRGANGSNAME</a></span>
                const trainingLink = row.querySelector('span.label > a[href*="/schoolings/"]');
                if (trainingLink) {
                    const courseName = trainingLink.textContent.trim();
                    if (courseName) {
                        coursesFound.push(courseName);
                    }
                } else {
                    // 2. Check: "Ausgebildete Rolle" (nur wenn nicht in Ausbildung)
                    // <td>Notarzt</td>
                    const roleCell = row.querySelector('td:nth-child(2)');
                    if (roleCell) {
                        const roleName = roleCell.textContent.trim();
                        if (roleName) { // Nur hinzufügen, wenn die Zelle nicht leer ist
                            rolesFound.push(roleName);
                        }
                    }
                }
            });
        } catch (e) {
            console.error('[LSS-Statistik V4.0] Fehler beim Parsen von HTML:', e);
        }
        return { coursesFound, rolesFound };
    }


    // --- Modal- & Menü-Helferfunktionen ---

    /**
     * Erstellt und zeigt ein Bootstrap-Modal an.
     * NEU: .modal-body ist jetzt scrollbar.
     * @param {string} modalBodyHtml - Der initiale HTML-Inhalt für den Body.
     */
    function showModal(modalBodyHtml, totalIds = 0) {
        let modal = document.getElementById('gemini_building_stats_modal');
        if (modal) {
            $(modal).modal('hide');
            modal.remove();
        }

        modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'gemini_building_stats_modal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                        <h4 class="modal-title" id="gemini_stats_modal_title">Statistik</h4>
                    </div>
                    <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
                        ${modalBodyHtml}
                        <hr>
                        <p><small>Alle Gebäude-IDs wurden zur weiteren Verwendung in der Browser-Konsole (F12) geloggt.</small></p>
                    </div>
                    <div classs="modal-footer">
                        <button type="button" class="btn btn-default" data-dismiss="modal" style="margin: 0 15px 15px;">Schließen</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        $('#gemini_building_stats_modal').modal('show');
        $('#gemini_building_stats_modal').on('hidden.bs.modal', function () {
            $(this).remove();
        });
    }

    /**
     * Findet den "Logout"-Button und fügt den Statistik-Link darunter ein.
     */
    function addMenuItem() {
        const logoutButton = document.getElementById('logout_button');
        if (logoutButton) {
            const logoutLi = logoutButton.closest('li');
            if (logoutLi) {
                const newLi = document.createElement('li');
                newLi.setAttribute('role', 'presentation');
                // Text angepasst auf V4.0
                newLi.innerHTML = `<a href="#" id="gemini_building_stats_link"><span class="glyphicon glyphicon-stats" aria-hidden="true" style="margin-right: 5px;"></span> Erweiterte Statistik (V4.0)</a>`;
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
