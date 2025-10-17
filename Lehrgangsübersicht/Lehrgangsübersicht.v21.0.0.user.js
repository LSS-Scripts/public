// ==UserScript==
// @name         Leitstellenspiel - Schul-Manager (Ampel & Übersicht)
// @namespace    http://tampermonkey.net/
// @version      22.0
// @description  Kombiniert: Zeigt eine Ampel (frei/belegt) auf der Hauptseite UND eine detaillierte Schulungsübersicht in Gebäuden.
// @author       Gemini (fusioniert)
// @match        https://www.leitstellenspiel.de/
// @match        *://*.leitstellenspiel.de/buildings/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    /**
     * ========================================================================
     * LOGIK FÜR SCHULUNGSÜBERSICHT (WIRD NUR AUF /buildings/* AUSGEFÜHRT)
     * ========================================================================
     */
    function initBuildingUebersicht() {
        const targetTabPaneId = 'tab_schooling';
        const summaryId = 'schooling-summary-container';

        function waitForContent(selector, callback) {
            let attempts = 0;
            const interval = setInterval(() => {
                const el = document.querySelector(selector);
                const loading = document.querySelector(`#${targetTabPaneId} .loading_dot`);
                if (el && !loading) {
                    clearInterval(interval);
                    setTimeout(callback, 300);
                } else if (attempts > 70) {
                    clearInterval(interval);
                }
                attempts++;
            }, 100);
        }

        function generateAndShowSummary() {
            if (document.getElementById(summaryId)) {
                document.getElementById(summaryId).remove();
            }

            const targetTab = document.getElementById(targetTabPaneId);
            if (!targetTab) return;

            const schoolHeaders = targetTab.querySelectorAll('h3');
            if (schoolHeaders.length === 0) return;

            const schoolData = {};

            schoolHeaders.forEach(header => {
                const img = header.querySelector('img[alt*="Building"]');
                if (!img) return;

                const schoolInstanceLink = header.querySelector('a[href*="/buildings/"]');
                const schoolInstanceHref = schoolInstanceLink ? schoolInstanceLink.getAttribute('href') : null;
                if (!schoolInstanceHref) return;

                let schoolTypeName = "Unbekannte Schule";
                const altText = img.alt.toLowerCase();
                if (altText.includes('coastal rescue school')) schoolTypeName = "Seenotrettungsschule";
                else if (altText.includes('water_rescue_school')) schoolTypeName = "Wasserrettungsschule";
                else if (altText.includes('rettungsschule') || altText.includes('rescueteam')) schoolTypeName = "Rettungsschule";
                else if (altText.includes('polizeischule')) schoolTypeName = "Polizeischule";
                else if (altText.includes('thw_school') || altText.includes('thw')) schoolTypeName = "THW-Schule";
                else if (altText.includes('fireschool')) schoolTypeName = "Feuerwehrschule";

                if (!schoolData[schoolTypeName]) {
                    schoolData[schoolTypeName] = { count: 0, occupied: 0, startLink: null };
                }
                schoolData[schoolTypeName].count++;

                let occupiedInThisSchool = 0;

                // Finde die Tabelle NACH dem Header
                let nextElement = header.nextElementSibling;
                while (nextElement && nextElement.tagName !== 'H3') {
                    if (nextElement.tagName === 'TABLE') {
                        occupiedInThisSchool = nextElement.querySelectorAll('tbody > tr > td > span[id*="education_schooling_"]').length;
                        break; // Tabelle gefunden, wir können aufhören
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                schoolData[schoolTypeName].occupied += occupiedInThisSchool;

                // KORREKTE LOGIK: Schaue auf das Element VOR dem Header
                const prevElement = header.previousElementSibling;
                if (prevElement && prevElement.tagName === 'A' && prevElement.textContent.includes('Neuen Lehrgang starten')) {
                    // Verifiziere, dass der Link des Buttons mit dem Link der Schule übereinstimmt
                    if (prevElement.getAttribute('href') === schoolInstanceHref) {
                        // Speichere den Link, wenn für diesen Schultyp noch keiner existiert
                        if (schoolData[schoolTypeName].startLink === null) {
                            schoolData[schoolTypeName].startLink = schoolInstanceHref;
                        }
                    }
                }
            });

            // --- HTML-ERSTELLUNG ---
            let totalSchools = 0;
            let totalOccupied = 0;

            let tableBodyHTML = '';
            for (const schoolType of Object.keys(schoolData).sort()) {
                const data = schoolData[schoolType];
                totalSchools += data.count;
                totalOccupied += data.occupied;
                const roomsForType = data.count * 4; // Diese Logik nimmt 4 Räume pro Schule an
                const freeForType = roomsForType - data.occupied;

                let actionCell = '<td></td>';
                if (freeForType > 0 && data.startLink) {
                    actionCell = `<td><a class="btn btn-xs btn-success" href="${data.startLink}">Starten</a></td>`;
                }

                tableBodyHTML += `<tr>
                    <td><strong>${schoolType}</strong></td>
                    <td>${data.count}</td>
                    <td style="color: #d9534f;">${data.occupied}</td>
                    <td style="color: #5cb85c;">${freeForType}</td>
                    <td>${roomsForType}</td>
                    ${actionCell}
                </tr>`;
            }

            const totalRooms = totalSchools * 4;
            const totalFree = totalRooms - totalOccupied;

            const summaryDiv = document.createElement('div');
            summaryDiv.id = summaryId;
            summaryDiv.style.cssText = 'margin-bottom: 20px;';
            summaryDiv.innerHTML = `
                <h3 style="margin-top: 0;">Übersicht der Ausbildungen</h3>
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Schultyp</th>
                            <th>Anzahl</th>
                            <th>Belegt</th>
                            <th>Frei</th>
                            <th>Gesamt</th>
                            <th>Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableBodyHTML}
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 2px solid #666;">
                            <td><strong>GESAMT</strong></td>
                            <td><strong>${totalSchools}</strong></td>
                            <td><strong style="color: #d9534f;">${totalOccupied}</strong></td>
                            <td><strong style="color: #5cb85c;">${totalFree}</strong></td>
                            <td><strong>${totalRooms}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>`;

            targetTab.prepend(summaryDiv);
        }

        function runAnalysis() {
            const contentSelector = `#${targetTabPaneId} h3`;
            waitForContent(contentSelector, generateAndShowSummary);
        }

        // Start-Logik für /buildings/*
        const targetLink = document.querySelector(`a[href="#${targetTabPaneId}"]`);
        if (targetLink) {
            targetLink.addEventListener('click', runAnalysis);
            if (targetLink.parentElement.classList.contains('active')) {
                 runAnalysis();
            }
        }
    }

    /**
     * ========================================================================
     * LOGIK FÜR SCHUL-AMPEL (WIRD NUR AUF / AUSGEFÜHRT)
     * ========================================================================
     */
    function initHomepageAmpel() {
        let isFetching = false;

        function addCustomStyles() {
            if (document.getElementById('school-ampel-styles')) return;
            const style = document.createElement('style');
            style.id = 'school-ampel-styles';
            style.innerHTML = `
                .school-status-indicator {
                    display: inline-block; width: 14px; height: 14px; border-radius: 50%;
                    margin-right: 6px; vertical-align: middle; border: 1px solid #333;
                    box-shadow: 0 0 3px rgba(0,0,0,0.5);
                }
                .school-status-indicator.green { background-color: #28a745; }
                .school-status-indicator.red { background-color: #dc3545; }
            `;
            document.head.appendChild(style);
        }

        async function fetchAndProcessSchoolStatus() {
            if (isFetching) return;
            isFetching = true;
            console.log("Schul-Ampel: Starte direkte API-Anfrage an /api/buildings...");

            try {
                const response = await fetch('/api/buildings');
                if (!response.ok) {
                    throw new Error(`Netzwerk-Antwort war nicht ok: ${response.statusText}`);
                }
                const buildings = await response.json();
                console.log(`Schul-Ampel: API-Antwort mit ${buildings.length} Gebäuden erhalten.`);

                let schoolsFound = 0;
                for (const building of buildings) {
                    if (building.hasOwnProperty('schoolings')) {
                        schoolsFound++;
                        // Diese Logik nutzt die API-Daten (1 Basisraum + Erweiterungen)
                        const totalRooms = 1 + (building.extensions ? building.extensions.length : 0);
                        const occupiedRooms = building.schoolings ? building.schoolings.length : 0;
                        const isAvailable = occupiedRooms < totalRooms;

                        const buildingElement = document.getElementById(`building_list_caption_${building.id}`);

                        if (buildingElement) {
                            buildingElement.querySelector('.school-status-indicator')?.remove();

                            const indicator = document.createElement('span');
                            indicator.classList.add('school-status-indicator', isAvailable ? 'green' : 'red');
                            indicator.title = `${occupiedRooms} / ${totalRooms} Räume belegt`;
                            buildingElement.prepend(indicator);
                        }
                    }
                }

                if (schoolsFound > 0) {
                    console.log(`✅ Schul-Ampel: ${schoolsFound} Schulen gefunden und Anzeigen erfolgreich aktualisiert.`);
                } else {
                    console.warn("Schul-Ampel: Keine Schulen in den Gebäudedaten gefunden.");
                }

            } catch (error) {
                console.error('❌ Schul-Ampel: Fehler beim Abrufen oder Verarbeiten der Gebäudedaten:', error);
            } finally {
                setTimeout(() => { isFetching = false; }, 500);
            }
        }

        function initializeScript(buildingListElement) {
            console.log("Schul-Ampel: Gebäudeliste gefunden. Initialisiere Script.");
            addCustomStyles();
            fetchAndProcessSchoolStatus();

            const observer = new MutationObserver(() => {
                console.log("Schul-Ampel: Änderung in der Gebäudeliste erkannt. Aktualisiere Status...");
                fetchAndProcessSchoolStatus();
            });

            observer.observe(buildingListElement, { childList: true });
        }

        function waitForElement(selector) {
            return new Promise(resolve => {
                if (document.querySelector(selector)) {
                    return resolve(document.querySelector(selector));
                }

                const observer = new MutationObserver(() => {
                    if (document.querySelector(selector)) {
                        observer.disconnect();
                        resolve(document.querySelector(selector));
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        }

        // Start-Logik für /
        waitForElement('#building_list').then(initializeScript);
    }

    /**
     * ========================================================================
     * ROUTER: Entscheidet, welche Logik basierend auf der URL ausgeführt wird.
     * ========================================================================
     */
    const path = window.location.pathname;

    if (path === '/') {
        // Wir sind auf der Hauptseite -> Schul-Ampel
        console.log("Schul-Manager: Hauptseite erkannt. Lade Schul-Ampel.");
        initHomepageAmpel();
    } else if (path.startsWith('/buildings/')) {
        // Wir sind auf einer Gebäude-Seite -> Schulungsübersicht
        console.log("Schul-Manager: Gebäudeseite erkannt. Lade Schulungsübersicht.");
        initBuildingUebersicht();
    }

})();
