// ==UserScript==
// @name         Leitstellenspiel Gebäude- & Personalstatistik (V9.0)
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  Zählt Personal-Details mit Live-Update, 4-Spalten-Design und breitem Modal (Blaues Theme)
// @author       Gemini
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

    // --- Eigene CSS-Stile ---
    const customCss = `
        /* Modal breiter und feste Mindestbreite */
        #gemini_building_stats_modal .modal-dialog {
            width: 90%;
            max-width: 1600px;
            min-width: 1000px;
        }
        /* Statistik-Box (ehem. well) */
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
        /* NEU: Zähler (Badge) in warmem Blau */
        .gemini-stat-badge {
            background-color: #3498db; /* Helles Blau */
            color: #ffffff;
            padding: 5px 10px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 10px;
        }
        /* NEU: Überschriften in einem passenden Blauton */
        #gemini_building_stats_modal h4 {
            color: #5bc0de; /* Ein hellerer Blauton für Überschriften */
            margin-top: 15px;
            margin-bottom: 15px;
            border-bottom: 1px solid #444;
            padding-bottom: 5px;
        }
    `;
    GM_addStyle(customCss);


    // --- Haupt-Statistik-Funktion ---

    async function showBuildingStats(event) {
        event.preventDefault();
        console.log('[LSS-Statistik V9.0] Starte Statistik-Erhebung...');

        showModal('<h4 id="gemini_stats_title">Lade Gebäudeliste...</h4><div id="gemini_stats_body"></div>');
        const modalTitle = document.getElementById('gemini_stats_title');
        const modalBody = document.getElementById('gemini_stats_body');

        try {
            const response = await fetch('https://www.leitstellenspiel.de/api/buildings');
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            const buildings = await response.json();

            const allBuildingIds = [];
            const buildingCounts = new Map();
            const personnelCounts = new Map();
            let totalBuildings = 0;
            let totalPersonnel = 0;
            const tasks = [];

            for (const building of buildings) {
                allBuildingIds.push(building.id);
                const type = building.building_type;
                const pCount = building.personal_count;

                buildingCounts.set(type, (buildingCounts.get(type) || 0) + 1);
                totalBuildings++;
                personnelCounts.set(type, (personnelCounts.get(type) || 0) + pCount);
                totalPersonnel += pCount;

                if (pCount > 0) {
                    tasks.push({
                        id: building.id,
                        url: `https://www.leitstellenspiel.de/buildings/${building.id}/personals`
                    });
                }
            }

            console.log(`[LSS-Statistik V9.0] ${buildings.length} Gebäude gefunden. ${tasks.length} Gebäude mit Personal werden gescannt.`);
            console.log('[LSS-Statistik V9.0] Gesammelte Gebäude-IDs:', allBuildingIds);

            modalBody.innerHTML = generateBaseStatsHtml(buildingCounts, personnelCounts, totalBuildings, totalPersonnel);
            modalTitle.textContent = 'Gebäude- & Personalstatistik';

            modalBody.innerHTML += `
                <div id="gemini-progress-wrapper"></div>
                <div id="gemini-training-stats-wrapper"><h4>Personal in Ausbildung</h4><div id="gemini-training-stats"></div></div>
                <div id="gemini-role-stats-wrapper"><h4>Ausgebildetes Personal (Rollen)</h4><div id="gemini-role-stats"></div></div>
            `;

            await scanPersonnelPages(
                tasks,
                document.getElementById('gemini-progress-wrapper'),
                document.getElementById('gemini-training-stats'),
                document.getElementById('gemini-role-stats')
            );

        } catch (error) {
            console.error('[LSS-Statistik V9.0] Fehler:', error);
            modalBody.innerHTML = `<div class="alert alert-danger">Fehler beim Abrufen der Daten: ${error.message}</div>`;
        }
    }

    /**
     * Generiert das HTML für die (schnellen) API-Basierten Statistiken
     * 4-Spalten-Layout (col-md-3)
     */
    function generateBaseStatsHtml(buildingCounts, personnelCounts, totalBuildings, totalPersonnel) {
        let totalHtml = '<h4>Gesamtstatistik</h4><div class="row">';
        totalHtml += `<div class="col-md-6 col-sm-6 col-xs-12"><div class="gemini-stat-box"><strong>Gesamtgebäude</strong><span class="gemini-stat-badge">${totalBuildings.toLocaleString()}</span></div></div>`;
        totalHtml += `<div class="col-md-6 col-sm-6 col-xs-12"><div class="gemini-stat-box"><strong>Gesamtpersonal (aus API)</strong><span class="gemini-stat-badge">${totalPersonnel.toLocaleString()}</span></div></div>`;
        totalHtml += '</div>';

        let buildingGridHtml = '<h4>Gebäudeanzahl</h4><div class="row">';
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

        let personnelGridHtml = '<h4>Personalanzahl (aus API)</h4><div class="row">';
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

    // --- Worker-Pool & HTML-Parsing ---

    async function scanPersonnelPages(tasks, progressWrapper, trainingDiv, roleDiv) {
        // NEU: Progressbar in Blau
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
                    console.warn(`[LSS-Statistik V9.0] Fehler bei Gebäude ${task.id}:`, error);
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

        console.log('[LSS-Statistik V9.0] Scan abgeschlossen. In Ausbildung:', trainingStats);
        console.log('[LSS-Statistik V9.0] Ausgebildete Rollen:', trainedRoleStats);

        progressWrapper.remove();
    }

    /**
     * Rendert die Zähler für Ausbildung und Rollen in ihre Ziel-DIVs.
     * 4-Spalten-Layout (col-md-3)
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
            console.error('[LSS-Statistik V9.0] Fehler beim Parsen von HTML:', e);
        }
        return { coursesFound, rolesFound };
    }


    // --- Modal- & Menü-Helferfunktionen ---

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

    function addMenuItem() {
        const logoutButton = document.getElementById('logout_button');
        if (logoutButton) {
            const logoutLi = logoutButton.closest('li');
            if (logoutLi) {
                const newLi = document.createElement('li');
                newLi.setAttribute('role', 'presentation');
                newLi.innerHTML = `<a href="#" id="gemini_building_stats_link"><span class="glyphicon glyphicon-stats" aria-hidden="true" style="margin-right: 5px;"></span> Erweiterte Statistik (V9.0)</a>`;
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
