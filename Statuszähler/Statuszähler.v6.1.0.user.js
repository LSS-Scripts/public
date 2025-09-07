// ==UserScript==
// @name         Leitstellenspiel FMS Zähler (V6.1 - Position korrigiert)
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  Zählt FMS-Status zuverlässig per API-Polling. Performance-optimiert durch langes Intervall und manuellen Refresh.
// @author       Masklin
// @match        https://www.leitstellenspiel.de/
// @grant        GM_xmlhttpRequest
// @connect      leitstellenspiel.de
// ==/UserScript==

(function() {
    'use strict';

    // Konfiguration: Wie oft sollen die Daten automatisch aktualisiert werden (in Millisekunden)?
    // 60000 = 60 Sekunden. Ein höherer Wert schont die Performance.
    const updateInterval = 60000;

    const fmsColors = {
        0: '#6c757d', 1: '#007bff', 2: '#28a745', 3: '#ffc107', 4: '#fd7e14',
        5: '#dc3545', 6: '#000000', 7: '#fd7e14', 8: '#007bff', 9: '#007bff'
    };

    let fmsCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    let isLoading = false;

    const targetElement = document.getElementById('map_adress_search_form');
    if (!targetElement) return;

    // Erstelle das Haupt-Container-Element
    const fmsContainer = document.createElement('div');
    fmsContainer.id = 'fms-counter-container';
    fmsContainer.style.display = 'flex';
    fmsContainer.style.alignItems = 'center';
    fmsContainer.style.marginRight = '15px';
    fmsContainer.style.float = 'left'; // KORREKTUR: Richte dich links aus
    fmsContainer.style.marginTop = '8px'; // KORREKTUR: Vertikaler Abstand wie die Suchleiste
    fmsContainer.style.marginBottom = '8px'; // KORREKTUR: Vertikaler Abstand wie die Suchleiste

    // Erstelle die Anzeige für die FMS-Zahlen
    const fmsDisplay = document.createElement('div');
    fmsDisplay.id = 'fms-counter-navbar';
    fmsDisplay.style.display = 'flex';
    fmsDisplay.style.alignItems = 'center';
    fmsDisplay.style.fontSize = '12px';
    fmsDisplay.style.fontWeight = 'bold';
    fmsDisplay.innerHTML = '<span style="margin-right: 5px; color: #fff;">FMS:</span><span style="color: #ccc;">Initialisiere...</span>';
    fmsContainer.appendChild(fmsDisplay);

    // Erstelle den Refresh-Button
    const refreshButton = document.createElement('a');
    refreshButton.innerHTML = '&#x21bb;'; // Unicode für Refresh-Pfeil
    refreshButton.title = 'FMS-Zähler manuell aktualisieren';
    refreshButton.style.marginLeft = '8px';
    refreshButton.style.color = '#fff';
    refreshButton.style.cursor = 'pointer';
    refreshButton.style.fontSize = '16px';
    refreshButton.addEventListener('click', () => {
        if (!isLoading) {
            fetchAndCountFms();
        }
    });
    fmsContainer.appendChild(refreshButton);

    targetElement.parentNode.insertBefore(fmsContainer, targetElement);

    function updateDisplay(loading = false, error = null) {
        isLoading = loading;
        fmsContainer.style.opacity = loading ? '0.5' : '1';
        refreshButton.style.cursor = loading ? 'wait' : 'pointer';

        let html = '<span style="margin-right: 5px; color: #fff;">FMS:</span>';
        if (loading) {
            html += '<span style="color: #ccc;">Lade Daten...</span>';
        } else if (error) {
            html += `<span style="color: #ff5555;">${error}</span>`;
        } else {
            const sortedKeys = Object.keys(fmsCounts).sort((a, b) => a - b);
            let count = 0;
            for (const status of sortedKeys) {
                if (fmsCounts[status] > 0) {
                    count++;
                    html += `<span style="background-color: ${fmsColors[status] || '#ccc'}; color: white; padding: 2px 6px; margin-right: 3px; border-radius: 3px; white-space: nowrap;">${status}: ${fmsCounts[status]}</span>`;
                }
            }
            if(count === 0) html += '<span style="color: #ccc;">Keine Fahrzeuge gefunden.</span>';
        }
        fmsDisplay.innerHTML = html;
    }

    function fetchAndCountFms() {
        if (isLoading) return;
        updateDisplay(true); // Ladezustand anzeigen

        GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.leitstellenspiel.de/api/vehicles",
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const vehicles = JSON.parse(response.responseText);
                        Object.keys(fmsCounts).forEach(key => fmsCounts[key] = 0);
                        for (const vehicle of vehicles) {
                            if (vehicle.fms_real in fmsCounts) {
                                fmsCounts[vehicle.fms_real]++;
                            }
                        }
                        updateDisplay(false); // Ladezustand beenden, Daten anzeigen
                    } catch (e) {
                        updateDisplay(false, 'Parse-Fehler!');
                    }
                } else {
                    updateDisplay(false, `API-Fehler: ${response.status}`);
                }
            },
            onerror: function(error) {
                updateDisplay(false, 'Netzwerkfehler!');
            }
        });
    }

    // Starte den Prozess
    fetchAndCountFms(); // Einmal direkt beim Start
    setInterval(fetchAndCountFms, updateInterval); // Und dann im Intervall

})();
