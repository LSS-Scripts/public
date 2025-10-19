// ==UserScript==
// @name         Leitstellenspiel Lehrgangsübersicht (Teilnehmerzahl) - Dark/Light Mode
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Zeigt eine Zusammenfassung der Teilnehmerzahlen für jeden Lehrgangstyp auf leitstellenspiel.de/schoolings an (mit Dark/Light Mode Support).
// @author       Gemini & Dein Name
// @match        https://www.leitstellenspiel.de/schoolings
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Fügt benutzerdefinierte CSS-Stile zur Seite hinzu, um die Übersicht ansprechend zu gestalten.
     * Passt die Farben basierend auf dem isDarkMode-Parameter an.
     * @param {boolean} isDarkMode - True, wenn der Dark Mode aktiv ist.
     */
    function addStyles(isDarkMode) {
        let styles = `
            /* --- Base Styles --- */
            #schooling-summary-container {
                border-radius: 8px; /* Abgerundete Ecken */
                padding: 20px;
                margin-bottom: 25px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Moderne Schriftart */
                box-shadow: 0 4px 8px rgba(0,0,0,0.05); /* Leichter Schatten */
            }
            #schooling-summary-container h3 {
                margin-top: 0;
                margin-bottom: 15px;
                padding-bottom: 10px;
                font-size: 1.4em; /* Größere Überschrift */
                font-weight: 600;
            }
            #schooling-summary-list {
                list-style: none;
                padding: 0;
                margin: 0;
                max-height: 400px; /* Begrenzte Höhe mit Scrollbalken bei Bedarf */
                overflow-y: auto; /* Scrollbalken nur vertikal */
            }
            #schooling-summary-list li {
                padding: 10px 5px;
                display: flex; /* Flexbox für bessere Ausrichtung */
                justify-content: space-between; /* Elemente auseinander schieben */
                align-items: center; /* Vertikal zentrieren */
                transition: background-color 0.2s ease-in-out; /* Hover-Effekt */
            }
             #schooling-summary-list li:last-child {
                border-bottom: none;
             }
            #schooling-summary-container .course-name {
                font-weight: 500; /* Etwas dünnere Schrift */
            }
            #schooling-summary-container .course-count {
                background-color: #007bff; /* Blauer Hintergrund für Zähler */
                color: #fff; /* Weiße Schrift */
                padding: 4px 10px;
                border-radius: 12px; /* Pillenform */
                font-size: 0.9em;
                font-weight: bold;
                min-width: 30px; /* Mindestbreite */
                text-align: center; /* Zentrierter Text */
            }
             #summary-loading-message {
                 font-style: italic;
                 padding: 10px 0;
             }
            /* Style für den Scrollbalken (Webkit-Browser) */
            #schooling-summary-list::-webkit-scrollbar {
                width: 8px;
            }
            #schooling-summary-list::-webkit-scrollbar-thumb {
                 border-radius: 10px;
            }
             #schooling-summary-list::-webkit-scrollbar-track {
                 border-radius: 10px;
            }

            /* --- Light Mode (Default) --- */
            #schooling-summary-container {
                background-color: #f8f9fa; /* Heller Hintergrund */
                border: 1px solid #dee2e6; /* Dezenter Rand */
                color: #495057; /* Standard-Textfarbe */
            }
            #schooling-summary-container h3 {
                border-bottom: 2px solid #007bff; /* Blauer Akzentstrich */
                color: #343a40; /* Dunklere Überschrift */
            }
            #schooling-summary-list li {
                border-bottom: 1px solid #e9ecef; /* Sehr heller Trennstrich */
            }
            #schooling-summary-list li:hover {
                background-color: #e9ecef; /* Leichter Hover-Effekt */
            }
            #schooling-summary-container .course-name {
               color: #212529; /* Fast schwarz */
            }
            #summary-loading-message {
               color: #6c757d; /* Grauer Text */
            }
            #schooling-summary-list::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            #schooling-summary-list::-webkit-scrollbar-thumb {
                background: #ced4da;
            }
            #schooling-summary-list::-webkit-scrollbar-thumb:hover {
                background: #adb5bd;
            }
        `;

        // --- Dark Mode Overrides ---
        if (isDarkMode) {
            styles += `
                #schooling-summary-container {
                    background-color: #2b3035; /* Dunklerer Hintergrund */
                    border: 1px solid #495057; /* Hellerer Rand im Dark Mode */
                    color: #ced4da; /* Hellere Standard-Textfarbe */
                }
                #schooling-summary-container h3 {
                    border-bottom-color: #0d6efd; /* Evtl. etwas helleres Blau */
                    color: #f8f9fa; /* Helle Überschrift */
                }
                #schooling-summary-list li {
                    border-bottom-color: #495057; /* Dunklerer Trennstrich */
                }
                #schooling-summary-list li:hover {
                    background-color: #495057; /* Dunklerer Hover-Effekt */
                }
                #schooling-summary-container .course-name {
                   color: #f8f9fa; /* Helle Schrift */
                }
                 /* .course-count bleibt blau mit weißer Schrift, das passt meistens */
                 #summary-loading-message {
                   color: #adb5bd; /* Helleres Grau für Lade-Text */
                 }
                #schooling-summary-list::-webkit-scrollbar-track {
                    background: #343a40; /* Dunkler Track */
                }
                #schooling-summary-list::-webkit-scrollbar-thumb {
                    background: #6c757d; /* Helleres Grau für Thumb */
                }
                #schooling-summary-list::-webkit-scrollbar-thumb:hover {
                    background: #adb5bd; /* Noch helleres Grau bei Hover */
                }
            `;
        }

        GM_addStyle(styles); // Fügt alle gesammelten Stile hinzu
    }

    /**
     * Ruft die angegebene URL ab, parst das HTML und zählt die Teilnehmer in der Tabelle.
     * @param {string} url - Die URL der Lehrgangsdetailseite.
     * @returns {Promise<number>} Die Anzahl der gefundenen Teilnehmer oder 0 bei Fehlern.
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
            const participantTable = doc.querySelector('table.table.table-striped'); // Annahme: Erste Tabelle ist die Teilnehmerliste

            if (participantTable && participantTable.tBodies.length > 0) {
                return participantTable.tBodies[0].rows.length;
            } else {
                 console.warn(`[Lehrgangsübersicht] Teilnehmertabelle nicht gefunden auf ${url}`);
                 return 0;
            }
        } catch (error) {
            console.error(`[Lehrgangsübersicht] Fehler bei der Verarbeitung von ${url}:`, error);
            return 0;
        }
    }

    /**
     * Hauptfunktion: Sammelt Lehrgangsdaten, ruft Teilnehmerzahlen ab und zeigt die Zusammenfassung an.
     */
    async function displaySchoolingSummary() {
        // Prüfen, ob der Dark Mode aktiv ist
        const isDarkMode = document.body.classList.contains('dark');

        // 1. Container erstellen und einfügen
        const summaryContainer = document.createElement('div');
        summaryContainer.id = 'schooling-summary-container';
        summaryContainer.innerHTML = `
            <h3>Lehrgangsübersicht (Teilnehmerzahl)</h3>
            <div id="summary-loading-message">Lade Teilnehmerzahlen... <span id="progress-counter">(0/?)</span></div>
            <ul id="schooling-summary-list"></ul>
        `;

        const mainTableContainer = document.querySelector('.vue-tabpanel > div[data-v-17feb9f8]');
        if (mainTableContainer) {
            mainTableContainer.parentNode.insertBefore(summaryContainer, mainTableContainer);
        } else {
            console.warn("[Lehrgangsübersicht] Hauptcontainer nicht gefunden, füge Übersicht am Anfang des Body ein.");
            document.body.prepend(summaryContainer); // Fallback
        }

        // 2. Stile basierend auf dem Modus anwenden
        addStyles(isDarkMode);

        // 3. Daten aus der Haupttabelle sammeln
        const courses = {};
        const fetchTasks = [];

        const mainTable = document.querySelector('.vue-tabpanel > div[data-v-17feb9f8] table.table-striped');
         if (!mainTable || mainTable.tBodies.length === 0) {
            document.getElementById('summary-loading-message').textContent = 'Fehler: Haupt-Lehrgangstabelle nicht gefunden.';
            console.error('[Lehrgangsübersicht] Haupt-Lehrgangstabelle nicht gefunden.');
            return;
        }

        const rows = mainTable.tBodies[0].querySelectorAll('tr.schooling_opened_table_searchable');
        const totalCoursesToFetch = rows.length;
        let coursesFetched = 0;
        const progressCounter = document.getElementById('progress-counter');
        progressCounter.textContent = `(0/${totalCoursesToFetch})`; // Initialisiere mit der Gesamtzahl

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
                        // Update Fortschrittsanzeige in Echtzeit
                        progressCounter.textContent = `(${coursesFetched}/${totalCoursesToFetch})`;
                    })
                    .catch(error => {
                        console.error(`[Lehrgangsübersicht] Fehler beim Verarbeiten des Links ${courseUrl}:`, error);
                        // Optional: Fehler im UI anzeigen oder Task einfach überspringen
                    });
                fetchTasks.push(task);
            }
        });

        if (fetchTasks.length === 0) {
            document.getElementById('summary-loading-message').textContent = 'Keine laufenden Lehrgänge gefunden.';
            return;
        }

        // 4. Warten, bis alle Daten da sind
        try {
            await Promise.all(fetchTasks);

            // 5. Ergebnisse anzeigen
            const summaryList = document.getElementById('schooling-summary-list');
            summaryList.innerHTML = ''; // Liste leeren

            const sortedCourseNames = Object.keys(courses).sort();

             if (sortedCourseNames.length === 0 && coursesFetched === totalCoursesToFetch) {
                 // Alle Abrufe waren erfolgreich, aber es gab keine Teilnehmer (oder Fehler beim Zählen)
                 summaryList.innerHTML = '<li>Keine Teilnehmerdaten gefunden oder Fehler beim Zählen.</li>';
            } else if (sortedCourseNames.length === 0 && coursesFetched < totalCoursesToFetch) {
                // Nicht alle Abrufe waren erfolgreich, und keine Daten konnten gesammelt werden
                 summaryList.innerHTML = '<li>Fehler beim Abrufen der Teilnehmerzahlen.</li>';
            }
            else {
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

            // Lade-Nachricht ausblenden
            document.getElementById('summary-loading-message').style.display = 'none';

        } catch (error) {
            console.error("[Lehrgangsübersicht] Ein unerwarteter Fehler ist beim Abrufen aller Teilnehmerzahlen aufgetreten:", error);
            document.getElementById('summary-loading-message').textContent = 'Ein Fehler ist aufgetreten.';
             document.getElementById('summary-loading-message').style.display = 'block'; // Sicherstellen, dass Fehlermeldung sichtbar ist
        }
    }

    // Skript mit einer kleinen Verzögerung starten, um sicherzustellen, dass die Seite (insb. der Body-Tag) geladen ist
    setTimeout(displaySchoolingSummary, 500); // 500ms sind meist ausreichend

})();
