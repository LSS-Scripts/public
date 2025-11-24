// ==UserScript==
// @name         LSS Wachen-Upgrader (Turbo Multi-Thread)
// @namespace    https://www.leitstellenspiel.de/
// @version      4.0
// @description  Baut Kleinwachen massenhaft aus - mit 5 parallelen Workern.
// @author       B&M
// @match        https://www.leitstellenspiel.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (typeof $ === 'undefined') return;

    // --- EINSTELLUNGEN ---
    const CONCURRENT_WORKERS = 5; // Anzahl gleichzeitiger Worker (Empfehlung: max 5-6)
    const SLEEP_TIME_MS = 250;    // Pause pro Worker zwischen Schritten

    // --- CSS ---
    const css = `
        .lss-grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 8px;
            margin-top: 15px;
            max-height: 60vh;
            overflow-y: auto;
            padding: 5px;
            border: 1px solid #ddd;
        }
        .lss-grid-item {
            padding: 10px;
            text-align: center;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: background-color 0.3s;
            cursor: default;
            font-weight: bold;
        }
        .status-white { background-color: #ffffff; color: #333; }
        .status-yellow { background-color: #fff176; color: #333; border-color: #fdd835; }
        .status-green { background-color: #81c784; color: #fff; border-color: #66bb6a; }
        .status-red { background-color: #e57373; color: #fff; border-color: #ef5350; }
    `;
    $('head').append(`<style>${css}</style>`);

    // --- MENÜ ---
    function initMenu() {
        const settingsLink = $("a[href='/settings/index']");
        if (settingsLink.length > 0) {
            const parentLi = settingsLink.parent();
            const newMenuItem = `
                <li>
                    <a href="#" id="lss-small-building-finder">
                        <img class="icon" src="https://img.icons8.com/ios-glyphs/30/000000/upload--v1.png" width="24" height="24" style="filter: invert(1);">
                        Wachen-Upgrader (Turbo)
                    </a>
                </li>
            `;
            parentLi.after(newMenuItem);
            $('#lss-small-building-finder').on('click', function(e) {
                e.preventDefault();
                loadData();
            });
        }
    }

    // --- DATEN LADEN ---
    async function loadData() {
        showModal("Wachen werden gesucht...", "<div class='alert alert-info'>Lade API...</div>", false);
        try {
            const data = await $.getJSON('/api/buildings');
            const smallBuildings = data.filter(b => b.small_building === true);
            renderGrid(smallBuildings);
        } catch (error) {
            console.error(error);
            showModal("Fehler", "<div class='alert alert-danger'>API Fehler.</div>", false);
        }
    }

    // --- GUI ---
    function renderGrid(buildings) {
        if (buildings.length === 0) {
            showModal("Ergebnis", "<div class='alert alert-success'>Keine Kleinwachen gefunden!</div>", false);
            return;
        }

        buildings.sort((a, b) => a.caption.localeCompare(b.caption));

        let html = `
            <div class="alert alert-warning">
                <strong>Turbo-Modus:</strong> ${CONCURRENT_WORKERS} gleichzeitige Worker.<br>
                Gefundene Wachen: <strong>${buildings.length}</strong>
            </div>
            <div class="progress" style="display:none; margin-bottom: 10px;">
                <div id="lss-progress-bar" class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%">
                    0%
                </div>
            </div>
            <button id="btn-start-mass-upgrade" class="btn btn-success btn-block">
                START (Alle ${buildings.length} Wachen)
            </button>
            <div class="lss-grid-container">
        `;

        buildings.forEach(b => {
            html += `<div id="b-box-${b.id}" class="lss-grid-item status-white" title="${b.caption}">${b.caption}</div>`;
        });
        html += `</div>`;

        showModal("Wachen-Upgrader", html, true);

        $('#btn-start-mass-upgrade').on('click', function() {
            $(this).prop('disabled', true).text('Arbeite...');
            $('.progress').show();
            startWorkerPool(buildings);
        });
    }

    // --- WORKER POOL LOGIK ---
    async function startWorkerPool(buildings) {
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        if (!csrfToken) { alert("Kein Token gefunden!"); return; }

        // Wir erstellen eine Kopie der Liste, damit wir Elemente entfernen können (Queue)
        const queue = [...buildings];
        const total = buildings.length;
        let completed = 0;

        // Funktion, die UI updated
        const updateProgress = () => {
            completed++;
            const percent = Math.round((completed / total) * 100);
            $('#lss-progress-bar').css('width', percent + '%').text(percent + '%');
        };

        // Der Worker: Nimmt sich Arbeit, solange welche da ist
        const worker = async (workerId) => {
            while (queue.length > 0) {
                // .shift() nimmt das erste Element und entfernt es aus dem Array (Thread-safe in JS da Single Thread Loop)
                const building = queue.shift();
                if (building) {
                    await processBuilding(building, csrfToken);
                    updateProgress();
                    // Kurze Atempause für den Worker, damit der Browser nicht einfriert
                    await sleep(SLEEP_TIME_MS);
                }
            }
        };

        // Wir starten X Worker gleichzeitig
        const workers = [];
        for (let i = 0; i < CONCURRENT_WORKERS; i++) {
            workers.push(worker(i));
        }

        // Warten bis alle Worker fertig sind
        await Promise.all(workers);

        $('#btn-start-mass-upgrade').text('Alle Worker fertig!');
        $('#lss-progress-bar').removeClass('active').addClass('progress-bar-success');
    }

    // --- EINZELNER PROZESS ---
    async function processBuilding(building, token) {
        const box = $(`#b-box-${building.id}`);
        box.removeClass('status-white').addClass('status-yellow');

        try {
            const postUrl = `/buildings/${building.id}/small_expand`;

            // 1. POST Request (Bauen)
            await $.post(postUrl, { _method: 'post', authenticity_token: token });

            // 2. Verifizierung (Check)
            // Wir warten kurz, bevor wir prüfen, da der Server bei vielen parallelen Requests laggen könnte
            await sleep(100);

            // GET Request zur Prüfung
            const checkUrl = `/buildings/${building.id}`;
            const pageContent = await $.get(checkUrl);

            if (pageContent.includes(`/buildings/${building.id}/small_expand_cancel`)) {
                box.removeClass('status-yellow').addClass('status-green');
            } else {
                box.removeClass('status-yellow').addClass('status-red');
            }

        } catch (e) {
            console.error(e);
            box.removeClass('status-yellow').addClass('status-red');
        }
    }

    // --- HELPER ---
    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function showModal(title, content, isUpdate) {
        let modalId = 'lss-upgrader-modal-v4';
        if ($('#' + modalId).length === 0) {
            const modalHtml = `
                <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" aria-hidden="true" style="z-index: 5000;">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <button type="button" class="close" data-dismiss="modal">&times;</button>
                                <h4 class="modal-title">${title}</h4>
                            </div>
                            <div class="modal-body"></div>
                            <div class="modal-footer"><button class="btn btn-default" data-dismiss="modal">Schließen</button></div>
                        </div>
                    </div>
                </div>`;
            $('body').append(modalHtml);
        }
        if (isUpdate && $(`#${modalId}`).hasClass('in')) {
            $(`#${modalId} .modal-body`).html(content);
        } else {
            $(`#${modalId} .modal-title`).text(title);
            $(`#${modalId} .modal-body`).html(content);
            $(`#${modalId}`).modal('show');
        }
    }

    initMenu();
})();
