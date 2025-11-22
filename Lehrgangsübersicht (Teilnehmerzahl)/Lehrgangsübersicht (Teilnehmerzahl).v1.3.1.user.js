// ==UserScript==
// @name         Leitstellenspiel Lehrgangsübersicht (Teilnehmerzahl) - Dark/Light Mode
// @namespace    http://tampermonkey.net/
// @version      1.3.1
// @description  Zeigt eine Zusammenfassung der Teilnehmerzahlen für jeden Lehrgangstyp auf leitstellenspiel.de/schoolings an (mit Dark/Light Mode Support, nutzt feste Tabellen-ID). Inklusive Gesamtsumme.
// @author       Gemini & Dein Name
// @match        https://www.leitstellenspiel.de/schoolings
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Fügt benutzerdefinierte CSS-Stile hinzu.
     * @param {boolean} isDarkMode - True, wenn der Dark Mode aktiv ist.
     */
    function addStyles(isDarkMode) {
        let styles = `
            /* --- Base Styles --- */
            #schooling-summary-container {
                border-radius: 8px; padding: 20px; margin-bottom: 25px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                box-shadow: 0 4px 8px rgba(0,0,0,0.05);
            }
            #schooling-summary-container h3 {
                margin-top: 0; margin-bottom: 15px; padding-bottom: 10px;
                font-size: 1.4em; font-weight: 600;
            }
            #schooling-summary-list {
                list-style: none; padding: 0; margin: 0;
                max-height: 400px; overflow-y: auto;
            }
            #schooling-summary-list li {
                padding: 10px 5px; display: flex; justify-content: space-between; align-items: center;
                transition: background-color 0.2s ease-in-out;
            }
             #schooling-summary-list li:last-child { border-bottom: none; }
            #schooling-summary-container .course-name { font-weight: 500; }
            #schooling-summary-container .course-count {
                background-color: #007bff; color: #fff; padding: 4px 10px;
                border-radius: 12px; font-size: 0.9em; font-weight: bold;
                min-width: 30px; text-align: center;
            }
             #summary-loading-message { font-style: italic; padding: 10px 0; }
            #schooling-summary-list::-webkit-scrollbar { width: 8px; }
            #schooling-summary-list::-webkit-scrollbar-thumb { border-radius: 10px; }
             #schooling-summary-list::-webkit-scrollbar-track { border-radius: 10px; }

            /* --- Light Mode (Default) --- */
            #schooling-summary-container { background-color: #f8f9fa; border: 1px solid #dee2e6; color: #495057; }
            #schooling-summary-container h3 { border-bottom: 2px solid #007bff; color: #343a40; }
            #schooling-summary-list li { border-bottom: 1px solid #e9ecef; }
            #schooling-summary-list li:hover { background-color: #e9ecef; }
            #schooling-summary-container .course-name { color: #212529; }
            #summary-loading-message { color: #6c757d; }
            #schooling-summary-list::-webkit-scrollbar-track { background: #f1f1f1; }
            #schooling-summary-list::-webkit-scrollbar-thumb { background: #ced4da; }
            #schooling-summary-list::-webkit-scrollbar-thumb:hover { background: #adb5bd; }
        `;

        // --- Dark Mode Overrides ---
        if (isDarkMode) {
            styles += `
                #schooling-summary-container { background-color: #2b3035; border: 1px solid #495057; color: #ced4da; }
                #schooling-summary-container h3 { border-bottom-color: #0d6efd; color: #f8f9fa; }
                #schooling-summary-list li { border-bottom-color: #495057; }
                #schooling-summary-list li:hover { background-color: #495057; }
                #schooling-summary-container .course-name { color: #f8f9fa; }
                 #summary-loading-message { color: #adb5bd; }
                #schooling-summary-list::-webkit-scrollbar-track { background: #343a40; }
                #schooling-summary-list::-webkit-scrollbar-thumb { background: #6c757d; }
                #schooling-summary-list::-webkit-scrollbar-thumb:hover { background: #adb5bd; }
            `;
        }
        GM_addStyle(styles);
    }

    /**
     * Ruft die Teilnehmerzahl von einer Lehrgangsdetailseite ab.
     * @param {string} url - Die URL der Lehrgangsdetailseite.
     * @returns {Promise<number>} Die Anzahl der Teilnehmer.
     */
    async function getParticipantCount(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Lehrgangsübersicht] Fehler beim Abrufen von ${url}: ${response.statusText}`);
                return 0;
            }
            const htmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            // Robusterer Selektor: sucht nach der Tabelle *innerhalb* des div.col-md-9
            const participantTable = doc.querySelector('.col-md-9 table.table-striped');

            if (participantTable && participantTable.tBodies.length > 0) {
                return participantTable.tBodies[0].querySelectorAll('tr').length;
            } else {
                 // Versuch mit einem allgemeineren Selektor als Fallback
                 const fallbackTable = doc.querySelector('table.table-striped');
                 if (fallbackTable && fallbackTable.tBodies.length > 0) {
                    return fallbackTable.tBodies[0].querySelectorAll('tr').length;
                 }
                 return 0;
            }
        } catch (error) {
            console.error(`[Lehrgangsübersicht] Fehler bei der Verarbeitung von ${url}:`, error);
            return 0;
        }
    }

     /**
     * Findet ein Element anhand seines Textinhalts (Groß-/Kleinschreibung und Leerzeichen ignorierend).
     */
    function findElementByText(selector, text) {
        const normalizedText = text.trim().toLowerCase();
        const elements = document.querySelectorAll(selector);
        for (let element of elements) {
            const directText = Array.from(element.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join('')
                .toLowerCase();
            if (directText === normalizedText) {
                return element;
            }
        }
        for (let element of elements) {
             if (element.textContent.trim().toLowerCase().includes(normalizedText)) {
                 return element;
             }
        }
        return null;
    }


    /**
     * Hauptfunktion: Sammelt Lehrgangsdaten, ruft Teilnehmerzahlen ab und zeigt die Zusammenfassung an.
     */
    async function displaySchoolingSummary() {
        const isDarkMode = document.body.classList.contains('dark');

        // 1. Container erstellen
        const summaryContainer = document.createElement('div');
        summaryContainer.id = 'schooling-summary-container';
        summaryContainer.innerHTML = `
            <h3>Lehrgangsübersicht</h3>
            <div id="summary-loading-message">Lade Teilnehmerzahlen... <span id="progress-counter">(0/?)</span></div>
            <ul id="schooling-summary-list"></ul>
        `;

        // 2. Einfügepunkt finden
        const mainTable = document.getElementById('schooling_own_table');
        let insertionSuccessful = false;

        if (mainTable) {
            let parentWrapper = mainTable.closest('div[data-v-8b206cce]') || mainTable.closest('.vue-tabpanel') || mainTable.parentNode;
            if (parentWrapper && parentWrapper.parentNode) {
                parentWrapper.parentNode.insertBefore(summaryContainer, parentWrapper);
                insertionSuccessful = true;
            }
        }

        // Fallback
        if (!insertionSuccessful) {
             const heading = findElementByText('h3', 'Lehrgänge mit eigenen Teilnehmern');
             if (heading && heading.closest('div[data-v-05a96bb1]')) {
                 const insertionTarget = heading.closest('div[data-v-05a96bb1]');
                 insertionTarget.prepend(summaryContainer);
                 insertionSuccessful = true;
             } else {
                 document.body.prepend(summaryContainer);
             }
        }

        // 3. Stile anwenden
        addStyles(isDarkMode);

        if (!mainTable) {
            document.getElementById('summary-loading-message').textContent = 'Fehler: Haupt-Lehrgangstabelle mit ID "schooling_own_table" nicht gefunden.';
            return;
        }
        if (mainTable.tBodies.length === 0) {
             document.getElementById('summary-loading-message').textContent = 'Fehler: Haupt-Lehrgangstabelle hat keinen tbody.';
             return;
        }


        // 5. Daten sammeln und verarbeiten
        const courses = {};
        const fetchTasks = [];
        const rows = mainTable.tBodies[0].querySelectorAll('tr');
        const totalCoursesToFetch = rows.length;
        let coursesFetched = 0;
        const progressCounter = document.getElementById('progress-counter');
        progressCounter.textContent = `(0/${totalCoursesToFetch})`;

        rows.forEach(row => {
            const linkElement = row.querySelector('td:first-child a.btn');
            if (linkElement) {
                const courseName = linkElement.textContent.trim();
                const courseUrl = linkElement.href;

                if (!courses[courseName]) {
                    courses[courseName] = 0;
                }

                const task = getParticipantCount(courseUrl)
                    .then(count => {
                        courses[courseName] += count;
                        coursesFetched++;
                        progressCounter.textContent = `(${coursesFetched}/${totalCoursesToFetch})`;
                    })
                    .catch(error => {
                        console.error(`[Lehrgangsübersicht] Fehler beim Verarbeiten des Links ${courseUrl}:`, error);
                    });
                fetchTasks.push(task);
            }
        });

        if (fetchTasks.length === 0) {
            document.getElementById('summary-loading-message').textContent = 'Keine auswertbaren Lehrgänge in der Tabelle gefunden.';
            return;
        }

        // 6. Warten und Ergebnisse anzeigen
        try {
            await Promise.all(fetchTasks);
            const summaryList = document.getElementById('schooling-summary-list');
            summaryList.innerHTML = '';
            const sortedCourseNames = Object.keys(courses).sort();

            // --- NEU: Gesamtsumme berechnen ---
            let totalParticipants = 0;
            Object.values(courses).forEach(count => totalParticipants += count);

            // --- NEU: Überschrift aktualisieren ---
            const headerElement = summaryContainer.querySelector('h3');
            headerElement.textContent = `Lehrgangsübersicht (Gesamt: ${totalParticipants})`;


             if (sortedCourseNames.length === 0 && coursesFetched === totalCoursesToFetch) {
                 summaryList.innerHTML = '<li>Keine Teilnehmerdaten gefunden oder Fehler beim Zählen.</li>';
            } else if (sortedCourseNames.length === 0 && coursesFetched < totalCoursesToFetch) {
                 summaryList.innerHTML = '<li>Fehler beim Abrufen der Teilnehmerzahlen.</li>';
            } else {
                 sortedCourseNames.forEach(courseName => {
                    const count = courses[courseName];
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <span class="course-name">${courseName}</span>
                        <span class="course-count">${count}</span>
                    `;
                    summaryList.appendChild(listItem);
                });
            }
            document.getElementById('summary-loading-message').style.display = 'none';

        } catch (error) {
            console.error("[Lehrgangsübersicht] Fehler:", error);
            document.getElementById('summary-loading-message').textContent = 'Ein Fehler ist aufgetreten.';
        }
    }

    setTimeout(displaySchoolingSummary, 300);

})();
