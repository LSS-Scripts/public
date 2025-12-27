// ==UserScript==
// @name         LSS Credits Daily Stats (CSS Chart V14.2 - Tooltip & Grid)
// @namespace    http://tampermonkey.net/
// @version      14.2
// @description  Statistik ohne Libraries. Fix: Tooltip überdeckt Balken nicht mehr. Neu: 25% & 75% Rasterlinien.
// @author       Gemini
// @match        https://www.leitstellenspiel.de/credits/daily*
// @match        https://www.missionchief.com/credits/daily*
// @match        https://www.meldkamerspel.com/credits/daily*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- KONFIGURATION ---
    const CONFIG = {
        own:       { label: "Eigene Einsätze", color: "#5bc0de" },
        verband:   { label: "Verband [V]",     color: "#5cb85c" },
        patients:  { label: "Patienten",       color: "#f0ad4e" },
        transport: { label: "KH-Transp.",      color: "#d9534f" },
        buildings: { label: "Ausbau/Gebäude",  color: "#9b59b6" },
        devices:   { label: "Neues Gerät",     color: "#34495e" },
        total:     { label: "Netto-Gewinn",    color: "#777" }
    };

    function formatAxis(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + " Mio";
        if (num >= 1000) return (num / 1000).toFixed(0) + " k";
        return num;
    }

    function formatFull(num) {
        return new Intl.NumberFormat('de-DE').format(num);
    }

    function getDateLabel(offset) {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        let label = `${day}.${month}.`;
        if (offset === 0) label += " (Heute)";
        return label;
    }

    function addStyles() {
        const css = `
            .lss-chart-container-flex { display: flex; height: 500px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: rgba(30,30,30,0.9); padding: 10px; border-radius: 5px; margin-top: 15px; position: relative; }

            /* Y-Achse */
            .lss-y-axis-col { width: 70px; display: flex; flex-direction: column; margin-right: 10px; border-right: 1px solid #666; z-index: 10; }
            .lss-y-box-upper, .lss-y-box-lower { flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: right; padding-right: 8px; color: #ccc; font-size: 11px; font-weight: bold; position: relative; }

            /* Chart Area */
            .lss-bars-area { flex: 1; display: flex; gap: 8px; position: relative; }

            /* Spalte pro Tag - Hoher Z-Index beim Hovern */
            .lss-day-col {
                flex: 1;
                display: flex;
                flex-direction: column;
                position: relative;
                height: 100%;
                z-index: 1;
            }
            .lss-day-col:hover {
                z-index: 1000;
            }

            /* Boxen */
            .lss-chart-box-upper { display: flex; flex-direction: column-reverse; justify-content: flex-start; position: relative; border-bottom: 2px solid #fff; }
            .lss-chart-box-lower { display: flex; flex-direction: column; justify-content: flex-start; position: relative; }

            /* Grid Linien */
            .lss-grid-line { position: absolute; left: 0; right: 0; height: 1px; pointer-events: none; z-index: 0; }

            /* Basis Linien */
            .lss-grid-top { top: 0; background: rgba(255,255,255,0.25); }
            .lss-grid-bot { bottom: 0; background: rgba(255,255,255,0.25); }

            /* Gestrichelte Zwischenlinien */
            .lss-grid-dash { border-top: 1px dashed rgba(255,255,255,0.25); background: none; }

            /* Positionen */
            .pos-25 { top: 25%; }
            .pos-50 { top: 50%; }
            .pos-75 { top: 75%; }

            /* Bars */
            .lss-bar-segment { width: 100%; transition: height 0.3s ease; position: relative; min-height: 0px; z-index: 2; }
            .lss-bar-segment:hover { opacity: 0.9; cursor: help; filter: brightness(1.2); }

            /* Label */
            .lss-date-label { text-align: center; font-size: 13px; margin-top: 8px; font-weight: bold; color: #ccc; }
            .dark .lss-date-label { color: #eee; }

            /* Tooltip - Höchster Z-Index innerhalb der Spalte */
            .lss-tooltip {
                visibility: hidden;
                background-color: rgba(15, 15, 15, 0.98);
                color: #fff;
                border: 1px solid #aaa;
                text-align: left;
                border-radius: 4px;
                padding: 10px;
                position: absolute;
                bottom: 50%;
                left: 50%;
                transform: translateX(-50%);
                width: 240px;
                font-size: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.9);
                pointer-events: none;
                white-space: nowrap;
                z-index: 9999; /* Sehr hoch */
            }
            .lss-day-col:hover .lss-tooltip { visibility: visible; }
            .lss-tooltip-row { display: flex; justify-content: space-between; margin-bottom: 3px; gap: 10px; }
            .lss-tooltip-header { text-align:center; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #666; padding-bottom:4px; font-size:13px;}
            .lss-tooltip-total { border-top: 1px solid #666; margin-top: 5px; padding-top: 4px; font-weight: bold; font-size:13px; }
        `;
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    function parseRows(rows) {
        let stats = {
            own:       { count: 0, credits: 0 },
            verband:   { count: 0, credits: 0 },
            patients:  { count: 0, credits: 0 },
            transport: { count: 0, credits: 0 },
            buildings: { count: 0, credits: 0 },
            devices:   { count: 0, credits: 0 },
            total:     { count: 0, credits: 0 }
        };

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) return;
            let credits = parseInt(cells[0].getAttribute('sortValue')) || 0;
            let count = parseInt(cells[2].getAttribute('sortValue')) || 0;
            let desc = cells[3].textContent.trim().toLowerCase();

            stats.total.credits += credits;
            stats.total.count += count;

            if (credits < 0) {
                if (desc.includes("gebäude") || desc.includes("gebaut") || desc.includes("erweitert") || desc.includes("ausgebaut") || desc.includes("abriss") || desc.includes("rückbau")) {
                    stats.buildings.credits += credits;
                    stats.buildings.count += count;
                } else {
                    stats.devices.credits += credits;
                    stats.devices.count += count;
                }
            } else {
                if (desc.includes("verbandseinlieferung")) {
                    stats.transport.credits += credits;
                    stats.transport.count += count;
                } else if (desc.includes("patienten")) {
                    stats.patients.credits += credits;
                    stats.patients.count += count;
                } else if (desc.includes("[verband]")) {
                    stats.verband.credits += credits;
                    stats.verband.count += count;
                } else {
                    stats.own.credits += credits;
                    stats.own.count += count;
                }
            }
        });
        return stats;
    }

    async function fetchHistory() {
        const progressBar = document.getElementById('lss-history-progress');
        const progressContainer = document.getElementById('lss-history-progress-container');
        const chartContainer = document.getElementById('lss-chart-output');

        chartContainer.innerHTML = '';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.innerText = 'Initialisiere...';

        let historyData = [];
        const maxPages = 8;

        for (let i = 0; i <= maxPages; i++) {
            try {
                let percent = Math.round(((i + 1) / (maxPages + 1)) * 100);
                progressBar.style.width = `${percent}%`;
                let label = getDateLabel(i);
                progressBar.innerText = `Lade ${label}...`;

                let url = i === 0 ? '/credits/daily' : `/credits/daily?page=-${i}`;
                let response = await fetch(url);
                if (!response.ok) throw new Error("HTTP " + response.status);

                let text = await response.text();
                let parser = new DOMParser();
                let doc = parser.parseFromString(text, 'text/html');
                let rows = doc.querySelectorAll('#daily_table tbody tr');

                if(rows.length > 0) {
                    historyData.push({ dayOffset: -i, label: label, stats: parseRows(rows) });
                }
            } catch (e) {
                console.warn(`Skip Tag -${i}`, e);
            }
        }

        historyData.reverse();
        renderCSSChart(historyData);
        progressContainer.style.display = 'none';
        chartContainer.style.display = 'block';
    }

    function renderCSSChart(data) {
        const container = document.getElementById('lss-chart-output');
        let maxIncome = 0;
        let maxExpense = 0;

        data.forEach(d => {
            let dailyIncome = d.stats.own.credits + d.stats.verband.credits + d.stats.patients.credits + d.stats.transport.credits;
            let dailyExpense = Math.abs(d.stats.buildings.credits + d.stats.devices.credits);
            if (dailyIncome > maxIncome) maxIncome = dailyIncome;
            if (dailyExpense > maxExpense) maxExpense = dailyExpense;
        });

        if (maxIncome === 0) maxIncome = 1000;
        if (maxExpense === 0) maxExpense = 1000;

        const totalFlow = maxIncome + maxExpense;
        const flexTop = (maxIncome / totalFlow) * 100;
        const flexBottom = (maxExpense / totalFlow) * 100;

        let html = `
            <div class="lss-chart-container-flex">
                <div class="lss-y-axis-col">
                    <div class="lss-y-box-upper" style="height:${flexTop}%;">
                        <div>+${formatAxis(maxIncome)}</div>
                        <div>+${formatAxis(maxIncome / 2)}</div>
                        <div style="color:#fff; transform:translateY(50%);">0</div>
                    </div>
                    <div class="lss-y-box-lower" style="height:${flexBottom}%;">
                        <div></div>
                        <div>-${formatAxis(maxExpense / 2)}</div>
                        <div>-${formatAxis(maxExpense)}</div>
                    </div>
                </div>
                <div class="lss-bars-area">
        `;

        data.forEach(day => {
            const incOwn = day.stats.own.credits;
            const incVerb = day.stats.verband.credits;
            const incPat = day.stats.patients.credits;
            const incTrans = day.stats.transport.credits;
            const expBuild = Math.abs(day.stats.buildings.credits);
            const expDev = Math.abs(day.stats.devices.credits);

            const pOwn = (incOwn / maxIncome) * 100;
            const pVerb = (incVerb / maxIncome) * 100;
            const pPat = (incPat / maxIncome) * 100;
            const pTrans = (incTrans / maxIncome) * 100;
            const pBuild = (expBuild / maxExpense) * 100;
            const pDev = (expDev / maxExpense) * 100;

            const tooltip = `
                <div class="lss-tooltip">
                    <div class="lss-tooltip-header">${day.label}</div>
                    <div class="lss-tooltip-row"><span style="color:${CONFIG.own.color}">Eigene:</span> <span>${formatFull(incOwn)}</span></div>
                    <div class="lss-tooltip-row"><span style="color:${CONFIG.verband.color}">Verb.:</span> <span>${formatFull(incVerb)}</span></div>
                    <div class="lss-tooltip-row"><span style="color:${CONFIG.patients.color}">Pat.:</span> <span>${formatFull(incPat)}</span></div>
                    <div class="lss-tooltip-row"><span style="color:${CONFIG.transport.color}">Trans.:</span> <span>${formatFull(incTrans)}</span></div>
                    ${(expBuild > 0 || expDev > 0) ? '<div style="margin:5px 0; border-top:1px dashed #555;"></div>' : ''}
                    ${expBuild > 0 ? `<div class="lss-tooltip-row"><span style="color:${CONFIG.buildings.color}">Geb.:</span> <span>-${formatFull(expBuild)}</span></div>` : ''}
                    ${expDev > 0 ? `<div class="lss-tooltip-row"><span style="color:${CONFIG.devices.color}">Gerät:</span> <span>-${formatFull(expDev)}</span></div>` : ''}
                    <div class="lss-tooltip-row lss-tooltip-total"><span>Netto:</span> <span>${formatFull(day.stats.total.credits)}</span></div>
                </div>
            `;

            html += `
                <div class="lss-day-col">

                    <div class="lss-chart-box-upper" style="height:${flexTop}%;">
                        <div class="lss-grid-line lss-grid-top"></div>
                        <div class="lss-grid-line lss-grid-dash pos-25"></div>
                        <div class="lss-grid-line lss-grid-dash pos-50"></div>
                        <div class="lss-grid-line lss-grid-dash pos-75"></div>

                        ${pOwn > 0 ? `<div class="lss-bar-segment" style="height:${pOwn}%; background:${CONFIG.own.color};"></div>` : ''}
                        ${pVerb > 0 ? `<div class="lss-bar-segment" style="height:${pVerb}%; background:${CONFIG.verband.color};"></div>` : ''}
                        ${pPat > 0 ? `<div class="lss-bar-segment" style="height:${pPat}%; background:${CONFIG.patients.color};"></div>` : ''}
                        ${pTrans > 0 ? `<div class="lss-bar-segment" style="height:${pTrans}%; background:${CONFIG.transport.color};"></div>` : ''}
                    </div>

                    <div class="lss-chart-box-lower" style="height:${flexBottom}%;">
                        <div class="lss-grid-line lss-grid-bot"></div>
                        <div class="lss-grid-line lss-grid-dash pos-25"></div>
                        <div class="lss-grid-line lss-grid-dash pos-50"></div>
                        <div class="lss-grid-line lss-grid-dash pos-75"></div>

                        ${pBuild > 0 ? `<div class="lss-bar-segment" style="height:${pBuild}%; background:${CONFIG.buildings.color};"></div>` : ''}
                        ${pDev > 0 ? `<div class="lss-bar-segment" style="height:${pDev}%; background:${CONFIG.devices.color};"></div>` : ''}
                    </div>

                    <div class="lss-date-label">${day.label}</div>
                    ${tooltip} </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    }

    function init() {
        addStyles();
        const table = document.getElementById('daily_table');
        if (!table) return;
        if (document.getElementById('lss-daily-wrapper')) document.getElementById('lss-daily-wrapper').remove();

        const wrapper = document.createElement('div');
        wrapper.id = 'lss-daily-wrapper';
        wrapper.style.marginBottom = '20px';

        const currentStats = parseRows(table.querySelectorAll('tbody tr'));
        const badgeContainer = document.createElement('div');
        badgeContainer.style.display = 'flex';
        badgeContainer.style.flexWrap = 'wrap';
        badgeContainer.style.gap = '8px';
        badgeContainer.style.marginBottom = '15px';
        badgeContainer.style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';

        const keys = ['own', 'verband', 'patients', 'transport', 'buildings', 'devices', 'total'];
        keys.forEach(key => {
            const s = currentStats[key];
            if (s.count === 0 && key !== 'total') return;
            const badge = document.createElement('div');
            badge.style.border = `1px solid ${CONFIG[key].color}`;
            badge.style.borderLeft = `5px solid ${CONFIG[key].color}`;
            badge.style.padding = '4px 10px';
            badge.style.borderRadius = '4px';
            badge.style.backgroundColor = document.body.classList.contains('dark') ? '#222' : '#fff';
            badge.style.color = document.body.classList.contains('dark') ? '#ddd' : '#333';
            badge.style.minWidth = '100px';
            badge.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            badge.innerHTML = `
                <div style="font-weight:bold; color:${CONFIG[key].color}; font-size:12px; text-transform:uppercase; margin-bottom:2px;">${CONFIG[key].label}</div>
                <div style="font-size:14px; line-height:1.2;">
                    <b>${formatFull(s.count)}</b> <small style="opacity:0.7">x</small> | <b>${formatFull(s.credits)}</b> <small style="opacity:0.7">Cr</small>
                </div>
            `;
            badgeContainer.appendChild(badge);
        });

        const btnContainer = document.createElement('div');
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-sm btn-default';
        loadBtn.innerHTML = '📊 Bilanz laden (9 Tage)';
        loadBtn.onclick = (e) => { e.preventDefault(); fetchHistory(); };
        btnContainer.appendChild(loadBtn);

        const chartArea = document.createElement('div');
        chartArea.innerHTML = `
            <div id="lss-history-progress-container" style="display:none; margin-top:10px; background:#ddd; height:20px; border-radius:4px; overflow:hidden;">
                <div id="lss-history-progress" style="width:0%; height:100%; background:#5cb85c; text-align:center; color:white; line-height:20px; font-size:12px;"></div>
            </div>
            <div id="lss-chart-output" style="display:none;"></div>
        `;

        wrapper.appendChild(badgeContainer);
        wrapper.appendChild(btnContainer);
        wrapper.appendChild(chartArea);
        table.parentNode.insertBefore(wrapper, table);
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
