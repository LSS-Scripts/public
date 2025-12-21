// ==UserScript==
// @name         LSS Gebäude-Erweiterungs-Manager (Modern Blue)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Statistik + Turbo-Aktivierer (Modernes Design & Abbruch-Funktion)
// @author       Gemini
// @match        https://www.leitstellenspiel.de/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=leitstellenspiel.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const buildingTypeNames = {
        0: 'Feuerwache', 1: 'Feuerwehrschule', 2: 'Rettungswache', 3: 'Rettungsschule',
        4: 'Krankenhaus', 5: 'Rettungshubschrauber-Station', 6: 'Polizeiwache', 7: 'Leitstelle',
        8: 'Polizeischule', 9: 'THW', 10: 'THW Bundesschule', 11: 'Bereitschaftspolizei',
        12: 'Schnelleinsatzgruppe (SEG)', 13: 'Polizeihubschrauberstation', 14: 'Bereitstellungsraum',
        15: 'Wasserrettung', 17: 'Polizei-Sondereinheiten', 18: 'Feuerwache (Kleinwache)',
        19: 'Polizeiwache (Kleinwache)', 20: 'Rettungswache (Kleinwache)', 21: 'Rettungshundestaffel',
        22: 'Großwache (FW)', 23: 'Großwache (Pol)', 24: 'Großwache (RD)',
        25: 'Bergrettungswache', 26: 'Seenotrettungswache',
        27: 'Schule für Seefahrt und Seenotrettung', 28: 'Hubschrauberstation (Seenotrettung)'
    };

    let currentStats = {};
    let globalTasks = { activate: [], deactivate: [] };
    let isWorking = false;
    let isCancelled = false; // Flag für Abbruch

    function init() {
        const menuProfile = document.querySelector('ul[aria-labelledby="menu_profile"]');
        if (menuProfile) {
            const separator = document.createElement('li');
            separator.className = "divider";
            separator.setAttribute("role", "presentation");
            menuProfile.appendChild(separator);

            const li = document.createElement('li');
            li.setAttribute("role", "presentation");
            li.innerHTML = `
                <a href="#" id="gemini_building_stats_link">
                    <span class="glyphicon glyphicon-stats" style="margin-right:5px;"></span> Erweiterungs-Manager V2.0
                </a>
            `;
            menuProfile.appendChild(li);

            document.getElementById('gemini_building_stats_link').addEventListener('click', function(e) {
                e.preventDefault();
                showModal();
                fetchData();
            });
        }
    }

    function showModal() {
        const modalId = 'gemini_stats_modal';
        if(document.getElementById(modalId)) {
            document.getElementById(modalId).remove();
        }

        const modalHtml = `
            <div id="${modalId}" class="modal fade" tabindex="-1" role="dialog" aria-hidden="true">
                <div class="modal-dialog modal-lg custom-dialog" role="document">
                    <div class="modal-content custom-content">
                        <div class="modal-header custom-header">
                            <button type="button" class="close" onclick="document.getElementById('${modalId}').remove()" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                            <h4 class="modal-title"><span class="glyphicon glyphicon-tasks"></span> Gebäude- & Erweiterungs-Manager</h4>
                        </div>

                        <div class="modal-body custom-body" id="gemini_stats_body_container">

                            <div id="gemini_action_area" class="custom-panel" style="display:none;">
                                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
                                    <h4 style="margin:0; font-weight: bold; color: #e2e8f0;">Globale Aktionen</h4>
                                    <div class="btn-group">
                                        <button id="gemini_global_activate_btn" class="btn btn-success btn-sm" style="display:none; margin-right: 5px;">
                                            <span class="glyphicon glyphicon-play"></span> ALLES Aktivieren (<span id="gemini_global_act_count">0</span>)
                                        </button>
                                        <button id="gemini_global_deactivate_btn" class="btn btn-danger btn-sm" style="display:none;">
                                            <span class="glyphicon glyphicon-pause"></span> ALLES Deaktivieren (<span id="gemini_global_deact_count">0</span>)
                                        </button>
                                    </div>
                                </div>

                                <div id="gemini_progress_wrapper" style="margin-top: 20px; display:none;">
                                    <div style="display:flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                        <div class="progress" style="background: #334155; height: 25px; border-radius: 6px; flex-grow: 1; margin:0;">
                                            <div id="gemini_progress_bar" class="progress-bar progress-bar-info" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%; line-height:24px; font-weight:bold; font-size: 14px;">
                                                0 / 0
                                            </div>
                                        </div>
                                        <button id="gemini_cancel_btn" class="btn btn-warning btn-sm" style="height: 25px; line-height: 12px; font-weight:bold;">
                                            <span class="glyphicon glyphicon-stop"></span> STOPP
                                        </button>
                                    </div>
                                    <div id="gemini_status_text" class="status-text">Bereit...</div>
                                </div>
                            </div>

                            <div id="gemini_stats_content">
                                <div class="loader">
                                    <span class="glyphicon glyphicon-refresh spin-anim"></span><br><br>
                                    Lade Daten...
                                </div>
                            </div>
                        </div>

                        <div class="modal-footer custom-footer">
                            <button type="button" class="btn btn-default" onclick="document.getElementById('${modalId}').remove()">Schließen</button>
                        </div>
                    </div>
                </div>
                <style>
                    /* --- MODERN BLUE DARK THEME --- */
                    /* Farben: Slate 900 (#0f172a), Slate 800 (#1e293b), Slate 700 (#334155) */

                    #${modalId} {
                        display: flex !important;
                        align-items: center;
                        justify-content: center;
                        background: rgba(15, 23, 42, 0.85);
                        backdrop-filter: blur(5px);
                    }

                    .custom-dialog {
                        width: 95%; max-width: 1400px;
                        height: 90vh;
                        margin: 0;
                        display: flex; flex-direction: column;
                        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    }

                    .custom-content {
                        background: #0f172a; /* Deep Slate Base */
                        color: #f1f5f9;
                        border: 1px solid #334155;
                        border-radius: 12px;
                        display: flex; flex-direction: column;
                        max-height: 100%;
                        overflow: hidden;
                    }

                    .custom-header {
                        background: #1e293b; /* Header Panel */
                        border-bottom: 1px solid #334155;
                        padding: 15px 25px;
                        flex-shrink: 0;
                        display: flex; align-items: center; justify-content: space-between;
                    }
                    .modal-title { font-weight: 700; color: #60a5fa; /* Light Blue Accent */ text-transform: uppercase; letter-spacing: 1px; }

                    .custom-body {
                        overflow-y: auto;
                        flex: 1;
                        padding: 25px;
                        background: #0f172a;
                    }

                    /* Scrollbar Styling Modern */
                    .custom-body::-webkit-scrollbar { width: 12px; }
                    .custom-body::-webkit-scrollbar-track { background: #0f172a; }
                    .custom-body::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 6px; border: 3px solid #0f172a; }
                    .custom-body::-webkit-scrollbar-thumb:hover { background-color: #64748b; }

                    .custom-footer {
                        background: #1e293b;
                        border-top: 1px solid #334155;
                        padding: 15px 25px;
                        flex-shrink: 0;
                    }

                    .close { color: #94a3b8; opacity: 0.8; text-shadow: none; font-size: 2em; margin-top: -5px; }
                    .close:hover { opacity: 1; color: #fff; }

                    /* Panels */
                    .custom-panel {
                        background: #1e293b;
                        border: 1px solid #334155;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 25px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }

                    /* Tables */
                    .custom-table {
                        width: 100%; border-collapse: separate; border-spacing: 0;
                        font-size: 14px; margin-bottom: 30px;
                        border: 1px solid #334155;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .custom-table th {
                        background: #334155;
                        color: #f8fafc;
                        font-weight: 600;
                        padding: 15px;
                        text-align: left;
                        border-bottom: 2px solid #475569;
                        position: sticky; top: 0; z-index: 10;
                    }
                    .custom-table td {
                        padding: 12px 15px;
                        border-bottom: 1px solid #334155;
                        color: #cbd5e1;
                        vertical-align: middle;
                        background: #1e293b;
                    }
                    .custom-table tr:last-child td { border-bottom: none; }
                    .custom-table tr:nth-child(even) td { background: #263346; } /* Zebra striped darker */
                    .custom-table tr:hover td { background: #334155; color: #fff; transition: background 0.1s; }

                    /* Type Headers */
                    .type-header {
                        display: flex; justify-content: space-between; align-items: center;
                        background: linear-gradient(90deg, #1e3a8a 0%, #1e293b 100%); /* Blue Gradient */
                        padding: 12px 20px;
                        border-left: 5px solid #60a5fa;
                        border-radius: 6px;
                        margin-top: 35px; margin-bottom: 15px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                    }
                    .type-title { font-size: 1.3em; font-weight: 700; color: #fff; }
                    .count-badge { background: rgba(255,255,255,0.2); color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 0.7em; margin-left: 10px; }

                    /* Text / Status helpers */
                    .text-warning { color: #fbbf24; font-weight: bold; } /* Amber */
                    .text-active { color: #4ade80; font-weight: bold; } /* Green */
                    .text-inactive { color: #f87171; font-weight: bold; } /* Red */
                    .status-text { text-align: center; color: #94a3b8; margin-top: 8px; font-size: 0.9em; }

                    .loader { text-align: center; color: #60a5fa; padding: 40px; }
                    .spin-anim { animation: spin 1s linear infinite; font-size: 3em; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                    /* Button Overrides */
                    .btn-xs { padding: 2px 8px; border-radius: 4px; }
                    .btn-success { background-color: #059669; border-color: #047857; }
                    .btn-success:hover { background-color: #10b981; }
                    .btn-danger { background-color: #dc2626; border-color: #b91c1c; }
                    .btn-danger:hover { background-color: #ef4444; }
                </style>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => document.getElementById(modalId).classList.add('in'), 10);

        // Globale Button Listener
        document.getElementById('gemini_global_activate_btn').addEventListener('click', function() {
            startTurboHorde(globalTasks.activate, "ALLE Erweiterungen Aktivieren");
        });
        document.getElementById('gemini_global_deactivate_btn').addEventListener('click', function() {
            if(confirm("ACHTUNG: Möchtest du wirklich ALLE Erweiterungen deaktivieren?")) {
                startTurboHorde(globalTasks.deactivate, "ALLE Erweiterungen Deaktivieren");
            }
        });

        // Abbruch Button Listener
        document.getElementById('gemini_cancel_btn').addEventListener('click', function() {
            if(isWorking) {
                isCancelled = true;
                const btn = document.getElementById('gemini_cancel_btn');
                btn.innerHTML = '<span class="glyphicon glyphicon-hourglass"></span> Stoppe...';
                btn.disabled = true;
                console.warn("[LSS Manager] Abbruch vom Benutzer angefordert. Warte auf laufende Worker...");
            }
        });

        // Delegation Event Listener
        document.getElementById('gemini_stats_content').addEventListener('click', function(e) {
            const btn = e.target.closest('button');
            if (!btn) return;

            // --- ACTIVATE ---
            if (btn.classList.contains('btn-act-ext')) {
                const typeId = btn.dataset.typeid;
                const extName = btn.dataset.extname;
                const tasks = currentStats[typeId].extensions[extName].tasks.activate;
                startTurboHorde(tasks, `Aktivieren: ${extName}`);
            }
            if (btn.classList.contains('btn-act-type')) {
                const typeId = btn.dataset.typeid;
                const tasks = currentStats[typeId].tasks.activate;
                startTurboHorde(tasks, `Alle Aktivieren: ${currentStats[typeId].name}`);
            }

            // --- DEACTIVATE ---
            if (btn.classList.contains('btn-deact-ext')) {
                const typeId = btn.dataset.typeid;
                const extName = btn.dataset.extname;
                const tasks = currentStats[typeId].extensions[extName].tasks.deactivate;
                startTurboHorde(tasks, `Deaktivieren: ${extName}`);
            }
            if (btn.classList.contains('btn-deact-type')) {
                const typeId = btn.dataset.typeid;
                const tasks = currentStats[typeId].tasks.deactivate;
                startTurboHorde(tasks, `Alle Deaktivieren: ${currentStats[typeId].name}`);
            }
        });
    }

    function fetchData() {
        globalTasks = { activate: [], deactivate: [] };
        currentStats = {};

        const actionArea = document.getElementById('gemini_action_area');
        if(actionArea) actionArea.style.display = 'none';
        document.getElementById('gemini_progress_wrapper').style.display = 'none';

        fetch('https://www.leitstellenspiel.de/api/buildings/')
            .then(response => response.json())
            .then(data => {
                processData(data);
            })
            .catch(error => {
                console.error('Error fetching buildings:', error);
                document.getElementById('gemini_stats_content').innerHTML = '<div style="text-align:center; color:#f87171; font-size: 1.2em; font-weight:bold; padding: 20px;">Fehler beim Laden der API-Daten!</div>';
            });
    }

    function processData(buildings) {
        let stats = {};

        buildings.forEach(building => {
            const typeId = building.building_type;

            if (!stats[typeId]) {
                stats[typeId] = {
                    count: 0,
                    name: buildingTypeNames[typeId] || `Typ ID: ${typeId}`,
                    extensions: {},
                    tasks: { activate: [], deactivate: [] }
                };
            }

            stats[typeId].count++;

            if (building.extensions) {
                building.extensions.forEach(ext => {
                    const caption = ext.caption;

                    if (!stats[typeId].extensions[caption]) {
                        stats[typeId].extensions[caption] = {
                            total: 0,
                            enabled: 0,
                            available: 0,
                            in_construction: 0,
                            tasks: { activate: [], deactivate: [] }
                        };
                    }

                    stats[typeId].extensions[caption].total++;
                    if (ext.enabled) stats[typeId].extensions[caption].enabled++;

                    if (ext.available) {
                        stats[typeId].extensions[caption].available++;

                        const task = {
                            buildingId: building.id,
                            buildingName: building.caption,
                            typeId: ext.type_id,
                            extName: caption,
                            action: ext.enabled ? 'deactivate' : 'activate'
                        };

                        if (!ext.enabled) {
                            stats[typeId].extensions[caption].tasks.activate.push(task);
                            stats[typeId].tasks.activate.push(task);
                            globalTasks.activate.push(task);
                        } else {
                            stats[typeId].extensions[caption].tasks.deactivate.push(task);
                            stats[typeId].tasks.deactivate.push(task);
                            globalTasks.deactivate.push(task);
                        }

                    } else if (ext.available_at) {
                        stats[typeId].extensions[caption].in_construction++;
                    }
                });
            }
        });

        currentStats = stats;
        renderStats(stats);
    }

    function renderStats(stats) {
        const hasActions = globalTasks.activate.length > 0 || globalTasks.deactivate.length > 0;

        if (hasActions) {
            document.getElementById('gemini_action_area').style.display = 'block';

            const btnAct = document.getElementById('gemini_global_activate_btn');
            if (globalTasks.activate.length > 0) {
                btnAct.style.display = 'inline-block';
                document.getElementById('gemini_global_act_count').innerText = globalTasks.activate.length;
            } else {
                btnAct.style.display = 'none';
            }

            const btnDeact = document.getElementById('gemini_global_deactivate_btn');
            if (globalTasks.deactivate.length > 0) {
                btnDeact.style.display = 'inline-block';
                document.getElementById('gemini_global_deact_count').innerText = globalTasks.deactivate.length;
            } else {
                btnDeact.style.display = 'none';
            }
        }

        let html = '';

        Object.keys(stats).sort((a,b) => parseInt(a) - parseInt(b)).forEach(typeId => {
            const group = stats[typeId];

            let headerBtns = '<div class="btn-group">';
            if (group.tasks.activate.length > 0) {
                headerBtns += `<button class="btn btn-success btn-xs btn-act-type" data-typeid="${typeId}" style="margin-right:5px;">
                                ▶️ Alle An (${group.tasks.activate.length})
                               </button>`;
            }
            if (group.tasks.deactivate.length > 0) {
                headerBtns += `<button class="btn btn-danger btn-xs btn-deact-type" data-typeid="${typeId}">
                                ⏸️ Alle Aus (${group.tasks.deactivate.length})
                               </button>`;
            }
            headerBtns += '</div>';

            html += `<div class="type-header">
                        <div class="type-title">${group.name} <span class="count-badge">${group.count}</span></div>
                        ${headerBtns}
                     </div>`;

            const extNames = Object.keys(group.extensions).sort();

            if (extNames.length === 0) {
                html += '<div class="custom-panel" style="padding:10px; text-align:center; color:#94a3b8;">Keine Erweiterungen gefunden.</div>';
            } else {
                html += `
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Erweiterung</th>
                                <th style="width: 15%;">Gesamt</th>
                                <th style="width: 15%;">Aktiv</th>
                                <th style="width: 35%;">Steuerung</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                extNames.forEach(extName => {
                    const extData = group.extensions[extName];
                    const isInactive = extData.total !== extData.enabled;

                    // Klares Farb-Coding
                    const countClass = isInactive ? 'text-inactive' : 'text-active';

                    let totalString = `${extData.total}`;
                    if(extData.in_construction > 0) {
                        totalString += ` <span class="text-warning" style="font-size:0.9em">(${extData.in_construction} Bau)</span>`;
                    }

                    // Row Buttons
                    let rowBtns = '<div class="btn-group">';
                    if (extData.tasks.activate.length > 0) {
                        rowBtns += `<button class="btn btn-success btn-xs btn-act-ext" data-typeid="${typeId}" data-extname="${extName}" style="margin-right:5px;">
                                        ▶️ (${extData.tasks.activate.length})
                                      </button>`;
                    }
                    if (extData.tasks.deactivate.length > 0) {
                        rowBtns += `<button class="btn btn-danger btn-xs btn-deact-ext" data-typeid="${typeId}" data-extname="${extName}">
                                        ⏸️ (${extData.tasks.deactivate.length})
                                      </button>`;
                    }
                    rowBtns += '</div>';

                    html += `
                        <tr>
                            <td style="font-weight:600;">${extName}</td>
                            <td>${totalString}</td>
                            <td class="${countClass}">${extData.enabled}</td>
                            <td>${rowBtns}</td>
                        </tr>
                    `;
                });

                html += `</tbody></table>`;
            }
        });

        document.getElementById('gemini_stats_content').innerHTML = html;
    }

    function startTurboHorde(taskList, contextName) {
        if (isWorking) { alert("Warte, bis der aktuelle Vorgang fertig ist!"); return; }
        if (!taskList || taskList.length === 0) return;

        let queue = [...taskList];
        isWorking = true;
        isCancelled = false; // Reset Cancel flag

        // UI Prep
        document.getElementById('gemini_progress_wrapper').style.display = 'block';
        document.getElementById('gemini_status_text').innerText = `Starte: ${contextName}`;

        // Reset & Show Cancel Button
        const cancelBtn = document.getElementById('gemini_cancel_btn');
        cancelBtn.style.display = 'inline-block';
        cancelBtn.disabled = false;
        cancelBtn.innerHTML = '<span class="glyphicon glyphicon-stop"></span> STOPP';
        cancelBtn.className = 'btn btn-warning btn-sm'; // Reset Class

        const allBtns = document.querySelectorAll('.btn-act-type, .btn-deact-type, .btn-act-ext, .btn-deact-ext, #gemini_global_activate_btn, #gemini_global_deactivate_btn');
        allBtns.forEach(b => b.disabled = true);

        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        let activeWorkers = 0;
        const maxWorkers = 50;
        let totalTasks = queue.length;
        let processedTasks = 0;

        const progressBar = document.getElementById('gemini_progress_bar');
        progressBar.style.width = '0%';
        progressBar.className = "progress-bar progress-bar-info progress-bar-striped active";

        console.group(`[LSS Manager] Starte Batch: ${contextName}`);
        console.log(`Anzahl Aufgaben: ${totalTasks}`);

        function updateProgress() {
            const percent = Math.round((processedTasks / totalTasks) * 100);
            progressBar.style.width = `${percent}%`;
            progressBar.innerText = `${processedTasks} / ${totalTasks}`;
        }

        function nextTask() {
            // Check Cancel
            if (isCancelled) {
                if(activeWorkers === 0) {
                    finishWork(true);
                } else {
                    activeWorkers--; // Worker retires
                }
                return;
            }

            if (queue.length === 0) {
                if (activeWorkers === 0) {
                    finishWork(false);
                }
                return;
            }

            activeWorkers++;
            const task = queue.shift();
            const url = `/buildings/${task.buildingId}/extension_ready/${task.typeId}/${task.buildingId}`;

            console.log(`[LSS Manager] Sende Request: Gebäude ${task.buildingId} (${task.buildingName}) -> ${task.action === 'activate' ? 'Aktivieren' : 'Deaktivieren'}: ${task.extName}`);

            fetch(url, {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                }
            })
            .then(res => {
                 if(!res.ok) console.error(`[LSS Manager] Fehler bei ID ${task.buildingId}: ${res.status}`);
            })
            .catch(err => {
                 console.error(`[LSS Manager] Netzwerkfehler bei ID ${task.buildingId}`, err);
            })
            .finally(() => {
                processedTasks++;
                updateProgress();
                activeWorkers--;
                nextTask();
            });
        }

        const initialWorkers = Math.min(maxWorkers, queue.length);
        for (let i = 0; i < initialWorkers; i++) {
            nextTask();
        }
    }

    function finishWork(wasCancelled) {
        isWorking = false;
        isCancelled = false;
        console.groupEnd();

        const progressBar = document.getElementById('gemini_progress_bar');
        progressBar.classList.remove('progress-bar-striped', 'active', 'progress-bar-info');

        const statusText = document.getElementById('gemini_status_text');
        const cancelBtn = document.getElementById('gemini_cancel_btn');
        cancelBtn.style.display = 'none';

        if(wasCancelled) {
            progressBar.classList.add('progress-bar-warning'); // Orange
            statusText.innerText = "Vorgang abgebrochen. Aktualisiere Daten...";
            console.warn("[LSS Manager] Vorgang durch Benutzer abgebrochen.");
        } else {
            progressBar.classList.add('progress-bar-success'); // Grün
            statusText.innerText = "Vorgang abgeschlossen. Aktualisiere...";
            console.log("[LSS Manager] Batch erfolgreich beendet.");
        }

        setTimeout(() => {
            fetchData();
        }, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
