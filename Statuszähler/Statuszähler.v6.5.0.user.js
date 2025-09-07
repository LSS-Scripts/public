// ==UserScript==
// @name         Leitstellenspiel FMS Zähler (V6.5 - Start-Bugfix)
// @namespace    http://tampermonkey.net/
// @version      6.5
// @description  Zählt FMS-Status zuverlässig. Startet korrekt und aktualisiert die Zahlen nahtlos im Hintergrund.
// @author       Dein Name
// @match        https://www.leitstellenspiel.de/
// @grant        GM_xmlhttpRequest
// @connect      leitstellenspiel.de
// ==/UserScript==

(function() {
    'use strict';

    const updateInterval = 60000;

    const fmsColors = {
        0: '#6c757d', 1: '#007bff', 2: '#28a745', 3: '#ffc107', 4: '#fd7e14',
        5: '#dc3545', 6: '#000000', 7: '#fd7e14', 8: '#007bff', 9: '#007bff'
    };

    let fmsCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    let isLoading = false;

    const targetElement = document.getElementById('map_adress_search_form');
    if (!targetElement) return;

    const fmsContainer = document.createElement('div');
    fmsContainer.id = 'fms-counter-container';
    fmsContainer.className = 'navbar-text navbar-left';
    fmsContainer.style.display = 'flex';
    fmsContainer.style.alignItems = 'center';
    fmsContainer.style.marginRight = '15px';

    const fmsDisplay = document.createElement('div');
    fmsDisplay.id = 'fms-counter-navbar';
    fmsDisplay.style.display = 'flex';
    fmsDisplay.style.alignItems = 'center';
    fmsDisplay.style.fontSize = '12px';
    fmsDisplay.style.fontWeight = 'bold';
    fmsDisplay.innerHTML = '<span style="margin-right: 5px; color: #fff;">FMS:</span><span style="color: #ccc;">Initialisiere...</span>';
    fmsContainer.appendChild(fmsDisplay);

    const refreshButton = document.createElement('a');
    refreshButton.innerHTML = '&#x21bb;';
    refreshButton.title = 'FMS-Zähler manuell aktualisieren';
    refreshButton.style.marginLeft = '8px';
    refreshButton.style.color = '#fff';
    refreshButton.style.cursor = 'pointer';
    refreshButton.style.fontSize = '16px';
    refreshButton.addEventListener('click', () => {
        // Ruft die Ladefunktion nur auf, wenn sie nicht schon läuft.
        fetchAndCountFms();
    });
    fmsContainer.appendChild(refreshButton);

    targetElement.parentNode.insertBefore(fmsContainer, targetElement);

    // Diese Funktion ist jetzt nur noch für das reine Anzeigen der Zahlen zuständig.
    function updateDisplay(error = null) {
        let html = '<span style="margin-right: 5px; color: #fff;">FMS:</span>';
        if (error) {
             html += `<span style="color: #ff5555;">${error}</span>`;
        } else {
            const sortedKeys = Object.keys(fmsCounts).sort((a, b) => a - b);
            let count = 0;
            for (const status of sortedKeys) {
                if (fmsCounts[status] > 0) {
                    count++;
                    html += `<span style="background-color: ${fmsColors[status] || '#ccc'}; color: white; padding: 2px 6px; margin-right: 3px; border-radius: 3px; white-space: nowrap;">${status}: ${fmsCounts[status].toLocaleString('de-DE')}</span>`;
                }
            }
            if(count === 0) html += '<span style="color: #ccc;">Keine Fahrzeuge gefunden.</span>';
        }
        fmsDisplay.innerHTML = html;
    }

    // KORRIGIERTE Ladefunktion
    function fetchAndCountFms() {
        if (isLoading) return; // Verhindert überlappende Ausführungen
        isLoading = true;
        refreshButton.style.cursor = 'wait';

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
                        updateDisplay(); // Anzeige mit neuen Zahlen aktualisieren
                    } catch (e) {
                        console.error("Fehler beim Verarbeiten der Fahrzeug-API:", e);
                        updateDisplay('Parse-Fehler!'); // Optional: Fehler anzeigen
                    }
                } else {
                    console.error(`API-Fehler: ${response.status}`);
                    updateDisplay('API-Fehler!'); // Optional: Fehler anzeigen
                }
                // Wichtig: Ladezustand in jedem Fall zurücksetzen
                isLoading = false;
                refreshButton.style.cursor = 'pointer';
            },
            onerror: function(error) {
                console.error("Fehler bei der API-Anfrage:", error);
                updateDisplay('Netzwerkfehler!'); // Optional: Fehler anzeigen
                // Wichtig: Ladezustand in jedem Fall zurücksetzen
                isLoading = false;
                refreshButton.style.cursor = 'pointer';
            }
        });
    }

    // Starte den Prozess
    fetchAndCountFms(); // Direkter erster Aufruf
    setInterval(fetchAndCountFms, updateInterval); // Und dann im Intervall

})();
