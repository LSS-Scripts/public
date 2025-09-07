// ==UserScript==
// @name         Leitstellenspiel FMS Zähler (V8.6 - Tooltips & Perfekte Breite)
// @namespace    http://tampermonkey.net/
// @version      8.6
// @description  Zählt FMS-Status. Mit Tooltips für Statusnamen und exakt gleicher Breite der Boxen.
// @author       Masklin
// @match        https://www.leitstellenspiel.de/
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- Konfiguration via localStorage ---
    const CONFIG_KEY = 'fmsCounterLocation';
    const updateInterval = 30000;

    let displayLocation = localStorage.getItem(CONFIG_KEY) || 'navbar';

    const fmsColors = {
        0: '#6c757d', 1: '#007bff', 2: '#28a745', 3: '#ffc107', 4: '#fd7e14',
        5: '#dc3545', 6: '#000000', 7: '#fd7e14', 8: '#007bff', 9: '#007bff'
    };
    
    // NEU: Namen für die Tooltips
    const fmsNames = {
        0: 'Status 0: Unterwegs zur Wache',
        1: 'Status 1: Frei auf Funk',
        2: 'Status 2: Auf Wache',
        3: 'Status 3: Auf Anfahrt',
        4: 'Status 4: Am Einsatzort',
        5: 'Status 5: Sprechwunsch',
        6: 'Status 6: Nicht einsatzbereit',
        7: 'Status 7: Patient aufgenommen',
        8: 'Status 8: Auf dem Weg zum KH',
        9: 'Status 9: Am Krankenhaus / AB wartet'
    };

    let fmsCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    let isLoading = false;

    // --- UI-Erstellung ---
    const fmsContainer = document.createElement('div');
    fmsContainer.id = 'fms-counter-container';
    fmsContainer.style.display = 'flex';
    fmsContainer.style.alignItems = 'center';
    fmsContainer.style.justifyContent = 'space-between';

    const fmsDisplay = document.createElement('div');
    fmsDisplay.id = 'fms-counter-display';
    fmsDisplay.style.display = 'flex';
    fmsDisplay.style.alignItems = 'center';
    fmsDisplay.style.flexWrap = 'wrap';
    fmsDisplay.style.gap = '3px';
    fmsDisplay.style.fontSize = '12px';
    fmsDisplay.style.fontWeight = 'bold';
    fmsDisplay.innerHTML = '<span style="color: #ccc;">Initialisiere...</span>';
    fmsContainer.appendChild(fmsDisplay);

    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'flex';
    controlsContainer.style.alignItems = 'center';
    controlsContainer.style.marginLeft = '8px';
    fmsContainer.appendChild(controlsContainer);

    const refreshButton = document.createElement('a');
    refreshButton.innerHTML = '&#x21bb;';
    refreshButton.title = 'FMS-Zähler manuell aktualisieren';
    refreshButton.style.color = '#fff';
    refreshButton.style.cursor = 'pointer';
    refreshButton.style.fontSize = '16px';
    refreshButton.addEventListener('click', () => { fetchAndCountFms(); });
    controlsContainer.appendChild(refreshButton);

    const settingsButton = document.createElement('a');
    settingsButton.innerHTML = '&#9881;';
    settingsButton.title = 'Position der FMS-Anzeige wechseln';
    settingsButton.style.color = '#fff';
    settingsButton.style.cursor = 'pointer';
    settingsButton.style.fontSize = '16px';
    settingsButton.style.marginLeft = '5px';
    settingsButton.addEventListener('click', () => {
        const newLocation = (displayLocation === 'navbar') ? 'radio' : 'navbar';
        localStorage.setItem(CONFIG_KEY, newLocation);
        window.location.reload();
    });
    controlsContainer.appendChild(settingsButton);

    // --- Positionslogik ---
    if (displayLocation === 'navbar') {
        const targetElement = document.getElementById('map_adress_search_form');
        if (targetElement) {
            fmsContainer.className = 'navbar-text navbar-left';
            fmsContainer.style.marginRight = '15px';
            fmsDisplay.style.flexGrow = '1';
            targetElement.parentNode.insertBefore(fmsContainer, targetElement);
        }
    } else {
        const radioHeader = document.querySelector('#radio .panel-heading');
        if (radioHeader) {
            fmsContainer.style.marginTop = '5px';
            fmsContainer.style.paddingTop = '5px';
            fmsContainer.style.borderTop = '1px solid #444';
            fmsDisplay.style.flexGrow = '1';
            radioHeader.appendChild(fmsContainer);
        }
    }

    // --- Datenlogik ---
    function updateDisplay(totalVehicles = 0) {
        let html = '';
        const sortedKeys = Object.keys(fmsCounts).sort((a, b) => a - b);
        let found = false;
        for (const status of sortedKeys) {
            const count = fmsCounts[status];
            if (count > 0) {
                found = true;
                const percentage = totalVehicles > 0 ? (count / totalVehicles) * 100 : 0;
                // HIER IST DIE ÄNDERUNG: title-Attribut für Tooltip, "Status:" entfernt
                html += `<span title="${fmsNames[status] || 'Status ' + status}" style="flex: 1; background-color: ${fmsColors[status] || '#ccc'}; color: white; padding: 2px 6px; border-radius: 3px; white-space: nowrap; text-align: center; line-height: 1.2;">
                            ${count.toLocaleString('de-DE')}
                            <br>
                            <span style="font-size: 9px; opacity: 0.7;">(${percentage.toFixed(1)}%)</span>
                         </span>`;
            }
        }
        if (!found && !isLoading) html += '<span style="color: #ccc;">-</span>';
        fmsDisplay.innerHTML = html;
    }

    function fetchAndCountFms() {
        if (isLoading) return;
        isLoading = true;
        refreshButton.style.cursor = 'wait';
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.leitstellenspiel.de/api/vehicle_states",
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const newCounts = JSON.parse(response.responseText);
                        let totalVehicles = 0;
                        Object.keys(fmsCounts).forEach(key => fmsCounts[key] = 0);
                        for (const status in newCounts) {
                            if (status in fmsCounts) {
                                fmsCounts[status] = newCounts[status];
                                totalVehicles += newCounts[status];
                            }
                        }
                        updateDisplay(totalVehicles);
                    } catch (e) { console.error("LSS FMS Zähler: API-Daten konnten nicht verarbeitet werden.", e); }
                }
                isLoading = false;
                refreshButton.style.cursor = 'pointer';
            },
            onerror: function(error) {
                console.error("LSS FMS Zähler: API-Anfrage fehlgeschlagen.", error);
                isLoading = false;
                refreshButton.style.cursor = 'pointer';
            }
        });
    }

    // --- Start ---
    fetchAndCountFms();
    setInterval(fetchAndCountFms, updateInterval);

})();
