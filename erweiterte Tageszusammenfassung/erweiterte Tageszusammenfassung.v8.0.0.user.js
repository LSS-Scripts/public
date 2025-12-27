// ==UserScript==
// @name         LSS Credits Daily Stats (Real Dates)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Strikte Trennung Einnahmen/Ausgaben + Fixierte History (0-8) + Echte Daten.
// @author       Gemini
// @match        https://www.leitstellenspiel.de/credits/daily*
// @match        https://www.missionchief.com/credits/daily*
// @match        https://www.meldkamerspel.com/credits/daily*
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Konfiguration: Farben & Labels
    const CONFIG = {
        // EINNAHMEN (Positiv)
        own:       { label: "Eigene Einsätze", color: "#5bc0de", bg: "rgba(91, 192, 222, 0.7)" },  // Blau
        verband:   { label: "Verband [V]",     color: "#5cb85c", bg: "rgba(92, 184, 92, 0.7)" },   // Grün
        patients:  { label: "Patienten",       color: "#f0ad4e", bg: "rgba(240, 173, 78, 0.7)" },  // Orange
        transport: { label: "KH-Transp.",      color: "#d9534f", bg: "rgba(217, 83, 79, 0.7)" },   // Rot

        // AUSGABEN (Negativ)
        buildings: { label: "Ausbau/Gebäude",  color: "#9b59b6", bg: "rgba(155, 89, 182, 0.7)" },  // Lila
        devices:   { label: "Neues Gerät",     color: "#34495e", bg: "rgba(52, 73, 94, 0.7)" },    // Dunkelgrau

        // SUMME
        total:     { label: "Netto-Gewinn",    color: "#777",    bg: "rgba(119, 119, 119, 0.7)" }  // Grau
    };

    let myChart = null;

    function formatNumber(num) {
        return new Intl.NumberFormat('de-DE').format(num);
    }

    // Hilfsfunktion: Datum berechnen basierend auf Offset
    function getDateLabel(offset) {
        const date = new Date();
        date.setDate(date.getDate() - offset); // Offset abziehen (0 = Heute, 1 = Gestern...)

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');

        let label = `${day}.${month}.`;
        if (offset === 0) label += " (Heute)";
        return label;
    }

    // --- Parsing-Logik ---
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

            // --- HAUPTWEICHE: Einnahme oder Ausgabe? ---
            if (credits < 0) {
                // === AUSGABEN (Negativ) ===
                if (desc.includes("gebäude") ||
                    desc.includes("gebaut") ||
                    desc.includes("erweitert") ||
                    desc.includes("ausgebaut") ||
                    desc.includes("abriss") ||
                    desc.includes("rückbau")) {
                    stats.buildings.credits += credits;
                    stats.buildings.count += count;
                } else {
                    stats.devices.credits += credits;
                    stats.devices.count += count;
                }
            } else {
                // === EINNAHMEN (Positiv) ===
                if (desc.includes("verbandseinlieferung")) {
                    stats.transport.credits += credits;
                    stats.transport.count += count;
                }
                else if (desc.includes("patienten")) {
                    stats.patients.credits += credits;
                    stats.patients.count += count;
                }
                else if (desc.includes("[verband]")) {
                    stats.verband.credits += credits;
                    stats.verband.count += count;
                }
                else {
                    stats.own.credits += credits;
                    stats.own.count += count;
                }
            }
        });
        return stats;
    }

    // --- Datenabruf (Explizit Page 0 bis 8) ---
    async function fetchHistory() {
        const progressBar = document.getElementById('lss-history-progress');
        const progressContainer = document.getElementById('lss-history-progress-container');
        const canvasContainer = document.getElementById('lss-chart-container');

        if(myChart) myChart.destroy();
        canvasContainer.style.display = 'none';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.innerText = 'Initialisiere...';

        let historyData = [];
        const maxPages = 8;

        for (let i = 0; i <= maxPages; i++) {
            try {
                let percent = Math.round(((i + 1) / (maxPages + 1)) * 100);
                progressBar.style.width = `${percent}%`;

                // Datum berechnen
                let label = getDateLabel(i);
                progressBar.innerText = `Lade ${label}...`;

                // URL bauen
                let url = '/credits/daily';
                if (i > 0) url += `?page=-${i}`;

                let response = await fetch(url);
                if (!response.ok) throw new Error("HTTP Fehler " + response.status);

                let text = await response.text();
                let parser = new DOMParser();
                let doc = parser.parseFromString(text, 'text/html');
                let rows = doc.querySelectorAll('#daily_table tbody tr');

                if(rows.length === 0) continue;

                historyData.push({ dayOffset: -i, label: label, stats: parseRows(rows) });

            } catch (e) {
                console.warn(`Konnte Tag -${i} nicht laden:`, e);
            }
        }

        historyData.reverse(); // Chronologisch sortieren
        renderChart(historyData);
        progressContainer.style.display = 'none';
        canvasContainer.style.display = 'block';
    }

    // --- Chart Rendering ---
    function renderChart(data) {
        const ctx = document.getElementById('lss-history-chart').getContext('2d');
        const isDark = document.body.classList.contains('dark');
        const textColor = isDark ? '#ddd' : '#333';
        const gridColor = isDark ? '#444' : '#ddd';

        const labels = data.map(d => d.label);
        const createDataset = (key) => ({
            label: CONFIG[key].label,
            data: data.map(d => d.stats[key].credits),
            backgroundColor: CONFIG[key].bg,
            borderColor: CONFIG[key].color,
            borderWidth: 1
        });

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    createDataset('own'),
                    createDataset('verband'),
                    createDataset('patients'),
                    createDataset('transport'),
                    createDataset('buildings'),
                    createDataset('devices')
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Bilanz Verlauf (9 Tage)', color: textColor },
                    legend: { labels: { color: textColor } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) label += formatNumber(context.parsed.y) + " Cr";
                                return label;
                            },
                            footer: function(tooltipItems) {
                                let total = 0;
                                tooltipItems.forEach(function(tooltipItem) {
                                    total += tooltipItem.parsed.y;
                                });
                                return 'Netto Summe: ' + formatNumber(total) + ' Cr';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: textColor },
                        grid: { color: gridColor, zeroLineColor: textColor, zeroLineWidth: 2 },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // --- UI Init ---
    function init() {
        const table = document.getElementById('daily_table');
        if (!table) return;

        if (document.getElementById('lss-daily-wrapper')) document.getElementById('lss-daily-wrapper').remove();

        const wrapper = document.createElement('div');
        wrapper.id = 'lss-daily-wrapper';
        wrapper.style.marginBottom = '20px';

        // 1. Kacheln (Aktuelle Seite)
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
                    <b>${formatNumber(s.count)}</b> <small style="opacity:0.7">x</small> | <b>${formatNumber(s.credits)}</b> <small style="opacity:0.7">Cr</small>
                </div>
            `;
            badgeContainer.appendChild(badge);
        });

        // 2. Button
        const btnContainer = document.createElement('div');
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-sm btn-default';
        loadBtn.innerHTML = '📊 Bilanz laden (9 Tage)';
        loadBtn.onclick = (e) => {
            e.preventDefault();
            fetchHistory();
        };
        btnContainer.appendChild(loadBtn);

        // 3. Chart Container
        const chartArea = document.createElement('div');
        chartArea.innerHTML = `
            <div id="lss-history-progress-container" style="display:none; margin-top:10px; background:#ddd; height:20px; border-radius:4px; overflow:hidden;">
                <div id="lss-history-progress" style="width:0%; height:100%; background:#5cb85c; text-align:center; color:white; line-height:20px; font-size:12px;"></div>
            </div>
            <div id="lss-chart-container" style="display:none; margin-top:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:5px; height: 400px;">
                <canvas id="lss-history-chart"></canvas>
            </div>
        `;

        wrapper.appendChild(badgeContainer);
        wrapper.appendChild(btnContainer);
        wrapper.appendChild(chartArea);

        table.parentNode.insertBefore(wrapper, table);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
