// ==UserScript==
// @name        LSS Lehrgangs-Bedarfsrechner (Mit Räumen)
// @version     3.4.0
// @license     BSD-3-Clause
// @author      B&M
// @description Platziert die Planungs-Box unter dem Dropdown. Berechnet fehlendes Personal und die dafür nötigen Lehrgangsräume (à 10 Plätze).
// @match       https://www.leitstellenspiel.de/buildings/*
// @run-at      document-idle
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    function injectStyles() {
        if (document.getElementById('lss-planner-v3-style')) return;
        const css = `
            #lss-planner-box {
                margin-top: 10px;
                margin-bottom: 20px;
                padding: 10px;
                background-color: #fcfcfc;
                border: 1px solid #ccc;
                border-left: 5px solid #3498db;
                border-radius: 4px;
                clear: both;
            }
            body.dark #lss-planner-box {
                background-color: #2c3e50;
                border-color: #555;
                border-left-color: #3498db;
                color: #ecf0f1;
            }
            .lss-planner-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .lss-planner-input {
                width: 60px;
                padding: 5px;
                text-align: center;
                font-weight: bold;
                border: 1px solid #ccc;
                border-radius: 4px;
            }
            body.dark .lss-planner-input {
                background: #444; color: #fff; border-color: #666;
            }
            /* Das Grid System */
            #lss-planner-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 8px;
                margin-top: 15px;
                max-height: 50vh;
                overflow-y: auto;
                padding-right: 5px;
                display: none;
            }
            .lss-grid-item {
                display: block;
                text-decoration: none !important;
                padding: 8px;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                background: #fff;
                font-size: 0.85em;
                color: #333;
                transition: all 0.1s;
                border-left: 4px solid #e74c3c;
            }
            body.dark .lss-grid-item {
                background: #34495e;
                color: #ecf0f1;
                border-color: #555;
                border-left-color: #e74c3c;
            }
            .lss-grid-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                background: #f9f9f9;
            }
            body.dark .lss-grid-item:hover {
                background: #3d566e;
            }
            .lss-item-name {
                display: block;
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 4px;
            }
            .lss-item-stats {
                display: flex;
                justify-content: space-between;
                color: #666;
            }
            body.dark .lss-item-stats { color: #bbb; }
            .lss-missing-badge {
                background: #e74c3c;
                color: white;
                padding: 1px 5px;
                border-radius: 3px;
                font-weight: bold;
            }
            .lss-room-info {
                margin-top: 5px;
                color: #3498db;
                font-weight: bold;
                display: block;
            }
        `;
        const style = document.createElement('style');
        style.id = 'lss-planner-v3-style';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    async function loadAllHeaders(btn) {
        const scrollable = document.documentElement;
        let lastScrollTop = -1;
        let noProgress = 0;

        if(btn) btn.innerText = "Scrolle Liste...";

        while (noProgress < 5) {
            lastScrollTop = scrollable.scrollTop;
            scrollable.scrollTop += window.innerHeight;
            await new Promise(r => setTimeout(r, 200));

            if (Math.ceil(scrollable.scrollTop) >= Math.ceil(scrollable.scrollHeight - scrollable.clientHeight) || scrollable.scrollTop === lastScrollTop) {
                noProgress++;
            } else {
                noProgress = 0;
            }
        }
        window.scrollTo(0, 0);
    }

    async function calculateNeeds() {
        const btn = document.getElementById('lss-planner-btn');
        const input = document.getElementById('lss-planner-target');
        const grid = document.getElementById('lss-planner-grid');
        const summary = document.getElementById('lss-planner-summary');

        const target = parseInt(input.value, 10);
        if (isNaN(target) || target < 0) { alert("Bitte Zahl eingeben."); return; }

        btn.disabled = true;
        await loadAllHeaders(btn);
        btn.innerText = "Analysiere...";

        // Daten sammeln
        const panels = document.querySelectorAll('.panel-heading.personal-select-heading');
        let missingData = [];
        let totalDeficit = 0;
        let checkedCount = 0;

        panels.forEach(panel => {
            if (panel.offsetParent === null) return; // Unsichtbare ignorieren
            checkedCount++;

            const buildingId = panel.getAttribute('building_id');

            // NAME EXTRAHIEREN
            let clone = panel.cloneNode(true);
            let rightSide = clone.querySelector('.pull-right');
            if(rightSide) rightSide.remove();
            let stationName = clone.textContent.trim();

            // Labels lesen
            const trainedLabel = panel.querySelector('.label-success');
            const trainingLabel = panel.querySelector('.label-info');

            let countTrained = trainedLabel ? (parseInt(trainedLabel.innerText, 10) || 0) : 0;
            let countTraining = trainingLabel ? (parseInt(trainingLabel.innerText, 10) || 0) : 0;
            let current = countTrained + countTraining;

            if (current < target) {
                let missing = target - current;
                totalDeficit += missing;
                missingData.push({
                    id: buildingId,
                    name: stationName,
                    current: current,
                    missing: missing
                });
            }
        });

        // Grid bauen
        grid.innerHTML = "";
        if (missingData.length > 0) {
            missingData.forEach(row => {
                const item = document.createElement('a');
                item.className = 'lss-grid-item';
                item.href = `/buildings/${row.id}`;
                item.target = '_blank';
                item.innerHTML = `
                    <span class="lss-item-name" title="${row.name}">${row.name}</span>
                    <div class="lss-item-stats">
                        <span>Ist: ${row.current} / ${target}</span>
                        <span class="lss-missing-badge">Fehlt: ${row.missing}</span>
                    </div>
                `;
                grid.appendChild(item);
            });

            // Berechnung der Räume (aufrunden)
            const roomsNeeded = Math.ceil(totalDeficit / 10);

            summary.innerHTML = `
                <span style="color:#e74c3c; font-weight:bold;">Gesamt fehlen: ${totalDeficit} Personen</span> (in ${missingData.length} Wachen)<br>
                <span class="lss-room-info">➡ Dafür benötigst du ${roomsNeeded} Lehrgangsräume (bei 10 Plätzen pro Kurs).</span>
            `;
            grid.style.display = "grid";
        } else {
            summary.innerHTML = `<span style="color:#27ae60; font-weight:bold;">✓ Alles erledigt!</span> (bei ${checkedCount} geprüften Wachen)`;
            grid.style.display = "none";
        }

        btn.disabled = false;
        btn.innerText = "Neu berechnen";
    }

    function init() {
        if (document.getElementById('lss-planner-box')) return;

        const dropdown = document.getElementById('education_select');
        if (!dropdown) return;

        injectStyles();

        const box = document.createElement('div');
        box.id = 'lss-planner-box';
        box.innerHTML = `
            <div class="lss-planner-controls">
                <strong style="font-size:1.1em;">📉 Bedarfs-Rechner:</strong>
                <span style="margin-left:auto;">Soll pro Wache:</span>
                <input type="number" id="lss-planner-target" class="lss-planner-input" value="1" min="0">
                <button id="lss-planner-btn" class="btn btn-primary btn-sm">Berechnen</button>
            </div>
            <div id="lss-planner-summary" style="margin-top: 10px;"></div>
            <div id="lss-planner-grid"></div>
        `;

        dropdown.insertAdjacentElement('afterend', box);

        document.getElementById('lss-planner-btn').addEventListener('click', calculateNeeds);
    }

    init();
    setTimeout(init, 1500);

})();
