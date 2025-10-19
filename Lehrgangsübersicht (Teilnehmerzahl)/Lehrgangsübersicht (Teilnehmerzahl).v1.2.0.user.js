// ==UserScript==
// @name         Leitstellenspiel Lehrgangsübersicht (Teilnehmerzahl) - Dark/Light Mode
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Zeigt eine Zusammenfassung der Teilnehmerzahlen für jeden Lehrgangstyp auf leitstellenspiel.de/schoolings an (mit Dark/Light Mode Support).
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
            // Robusterer Selektor: sucht nach der Tabelle *innerhalb* des div.col-md-9, das wahrscheinlich den Hauptinhalt enthält.
            const participantTable = doc.querySelector('.col-md-9 table.table-striped');

            if (participantTable && participantTable.tBodies.length > 0) {
                // Zähle nur die <tr>-Elemente im ersten <tbody>
                return participantTable.tBodies[0].querySelectorAll('tr').length;
            } else {
                 console.warn(`[Lehrgangsübersicht] Teilnehmertabelle nicht gefunden auf ${url}. Selektor: '.col-md-9 table.table-striped'`);
                 // Versuch mit einem allgemeineren Selektor als Fallback
                 const fallbackTable = doc.querySelector('table.table-striped');
                 if (fallbackTable && fallbackTable.tBodies.length > 0) {
                    console.warn(`[Lehrgangsübersicht] Fallback-Tabelle gefunden auf ${url}.`);
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
     * @param {string} selector - Der CSS-Selektor für die zu durchsuchenden Elemente (z.B. 'h3').
     * @param {string} text - Der gesuchte Textinhalt.
     * @returns {HTMLElement|null} Das gefundene Element oder null.
     */
    function findElementByText(selector, text) {
        const normalizedText = text.trim().toLowerCase();
        const elements = document.querySelectorAll(selector);
        for (let element of elements) {
            if (element.textContent.trim().toLowerCase() === normalizedText) {
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
            <h3>Lehrgangsübersicht (Teilnehmerzahl)</h3>
            <div id="summary-loading-message">Lade Teilnehmerzahlen... <span id="progress-counter">(0/?)</span></div>
            <ul id="schooling-summary-list"></ul>
        `;

        // 2. Robusteren Einfügepunkt finden (basierend auf der Überschrift)
        const heading = findElementByText('h3', 'Lehrgänge mit eigenen Teilnehmern');
        let insertionTarget = null;

        if (heading && heading.closest('div[data-v-05a96bb1]')) {
             // Den Hauptcontainer für diesen Abschnitt finden
             insertionTarget = heading.closest('div[data-v-05a96bb1]');
             // Füge die Übersicht als erstes Kind dieses Containers ein
             insertionTarget.prepend(summaryContainer);
        } else {
            // Fallback: Einfügen vor dem ersten Vue-Tabpanel, falls die Überschrift nicht gefunden wird
            console.warn("[Lehrgangsübersicht] Überschrift nicht gefunden, versuche Fallback-Einfügepunkt.");
            insertionTarget = document.querySelector('.vue-tabpanel');
            if (insertionTarget && insertionTarget.parentNode) {
                 insertionTarget.parentNode.insertBefore(summaryContainer, insertionTarget);
            } else {
                 console.error("[Lehrgangsübersicht] Konnte keinen geeigneten Einfügepunkt finden. Füge am Anfang des Body ein.");
                 document.body.prepend(summaryContainer); // Letzter Fallback
            }
        }

        // 3. Stile anwenden
        addStyles(isDarkMode);

        // 4. Robusteren Selektor für die Haupttabelle verwenden
        // Sucht die erste Tabelle innerhalb des Vue-Tabpanels, das dem Einfügepunkt folgt (oder darin enthalten ist)
        let mainTable = null;
        if (insertionTarget) {
             mainTable = insertionTarget.querySelector('.vue-tabpanel table.table-striped');
        }
        // Fallback, falls insertionTarget nicht korrekt gefunden wurde oder die Struktur anders ist
        if (!mainTable) {
            mainTable = document.querySelector('.vue-tabpanel table.table-striped');
        }


         if (!mainTable || mainTable.tBodies.length === 0) {
            document.getElementById('summary-loading-message').textContent = 'Fehler: Haupt-Lehrgangstabelle nicht gefunden (aktualisierter Selektor).';
            console.error('[Lehrgangsübersicht] Haupt-Lehrgangstabelle auch mit aktualisiertem Selektor nicht gefunden.');
            return;
        }

        // 5. Daten sammeln und verarbeiten (Rest des Codes bleibt gleich)
        const courses = {};
        const fetchTasks = [];
        const rows = mainTable.tBodies[0].querySelectorAll('tr.schooling_opened_table_searchable');
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
            document.getElementById('summary-loading-message').textContent = 'Keine laufenden Lehrgänge gefunden.';
            return;
        }

        // 6. Warten und Ergebnisse anzeigen (Rest bleibt gleich)
        try {
            await Promise.all(fetchTasks);
            const summaryList = document.getElementById('schooling-summary-list');
            summaryList.innerHTML = '';
            const sortedCourseNames = Object.keys(courses).sort();

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
            console.error("[Lehrgangsübersicht] Ein unerwarteter Fehler ist beim Abrufen aller Teilnehmerzahlen aufgetreten:", error);
            document.getElementById('summary-loading-message').textContent = 'Ein Fehler ist aufgetreten.';
            document.getElementById('summary-loading-message').style.display = 'block';
        }
    }

    // Skriptstart mit Verzögerung
    setTimeout(displaySchoolingSummary, 500);

})();
