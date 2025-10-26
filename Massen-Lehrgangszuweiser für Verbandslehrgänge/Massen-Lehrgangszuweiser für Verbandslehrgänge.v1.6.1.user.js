// ==UserScript==
// @name         Massen-Lehrgangszuweiser für Verbandslehrgänge
// @namespace    B&M
// @version      1.6.1
// @description  Ermöglicht die Zuweisung von Personal zu mehreren identischen Verbandslehrgängen gleichzeitig.
// @author       B&M (mit Anpassungen)
// @match        https://www.leitstellenspiel.de/schoolings/*
// @match        https://polizei.leitstellenspiel.de/schoolings/*
// @match        https://www.meldkamerspel.com/schoolings/*
// @match        https://politie.meldkamerspel.com/schoolings/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function init() {
        const style = document.createElement('style');
    style.textContent = `
        #multiSchoolingContainer {
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            /* NEU: Randfarbe, die auf beiden Themes gut aussieht */
            border: 1px solid #5a6268;
            overflow: hidden;
            /* WICHTIG: Es wird kein eigener Hintergrund gesetzt, um den des Spiels zu übernehmen */
        }
        .msc-header {
            background: linear-gradient(to right, #34495e, #2c3e50);
            color: white;
            padding: 12px 18px;
            font-size: 1.2em;
            font-weight: bold;
        }
        .msc-body {
            padding: 18px;
            /* KORREKTUR: Die feste Hintergrundfarbe wurde entfernt. Das war die Hauptursache! */
        }
        .msc-course-item, .msc-select-all-container {
            padding: 12px;
            border-radius: 4px;
            transition: background-color 0.2s ease-in-out;
            cursor: pointer;
            display: flex;
            align-items: center;
        }
        .msc-course-item:hover, .msc-select-all-container:hover {
            /* KORREKTUR: Ein semi-transparenter Hintergrund, der auf hell & dunkel funktioniert */
            background-color: rgba(120, 120, 120, 0.15);
        }
        .msc-course-item input[type="checkbox"], .msc-select-all-container input[type="checkbox"] {
            margin-right: 12px;
            transform: scale(1.2);
        }
        .msc-select-all-container {
            /* KORREKTUR: Eine semi-transparente Trennlinie, die auf beiden Themes passt */
            border-bottom: 2px solid rgba(140, 140, 140, 0.3);
            margin-bottom: 10px;
            font-weight: bold;
        }

        /* NEU: Grid-Container für die Lehrgangsliste (Wunsch 1) */
        #msc-course-grid {
            display: grid;
            /* Zeigt so viele Spalten wie möglich an, die mind. 350px breit sind */
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 8px; /* Kleiner Abstand zwischen den Kacheln */
            margin-top: 10px; /* Abstand zur "Alle auswählen"-Box */
        }

        /* Stellt sicher, dass der Text die richtige, vom Theme vorgegebene Farbe hat */
        .msc-body, .msc-body label {
           color: inherit !important;
        }
        #multiSchoolingList p {
            font-size: 1.1em;
        }
        /* --------------------------------- */
        /* --- NEU: Stile für Preis-Button & Anzeige --- */
        /* --------------------------------- */
        
        /* Sorgt dafür, dass der Header-Text und der Button nebeneinander passen */
        .msc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* Stil für den neuen "Preise laden"-Button */
        #msc-fetch-costs-btn {
            font-size: 0.8em; /* Etwas kleiner als der Header-Text */
            padding: 4px 8px;
            /* Neutrale Farben, die auf beiden Themes funktionieren */
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            color: #212529; /* Dunkler Text */
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        #msc-fetch-costs-btn:hover {
            background-color: #e9ecef;
        }
        #msc-fetch-costs-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background-color: #f8f9fa; /* Farbe im deaktivierten Zustand beibehalten */
        }

        /* Stile für die Kostenanzeige bei jedem Lehrgang */
        .msc-course-cost {
            font-weight: bold;
            margin-left: 10px;
            font-size: 1.0em;
        }
        /* Lade-Spinner für die Kosten */
        .msc-course-cost img {
            height: 14px;
            width: 14px;
            vertical-align: text-bottom;
            margin-left: 5px;
        }
        
        /* Die von dir gewünschten Farbregeln */
        .msc-cost-green { color: #28a745 !important; } /* Helles Grün */
        .msc-cost-orange { color: #fd7e14 !important; } /* Helles Orange */
        .msc-cost-red { color: #dc3545 !important; } /* Helles Rot */
        /* ------------------------------------------- */
        /* --- NEU: Hintergrundfarben für Kurs-Items --- */
        /* ------------------------------------------- */

        /* Wir verwenden RGBA-Farben (mit Transparenz), 
           damit sie auf hellen & dunklen Themes funktionieren. */

        .msc-item-green {
            background-color: rgba(40, 167, 69, 0.15) !important;
        }
        .msc-item-green:hover {
            background-color: rgba(40, 167, 69, 0.3) !important;
        }

        .msc-item-orange {
            background-color: rgba(253, 126, 20, 0.15) !important;
        }
        .msc-item-orange:hover {
            background-color: rgba(253, 126, 20, 0.3) !important;
        }

        .msc-item-red {
            background-color: rgba(220, 53, 69, 0.15) !important;
        }
        .msc-item-red:hover {
            background-color: rgba(220, 53, 69, 0.3) !important;
        }
    `;
    document.head.appendChild(style);
        // *** KORRIGIERTER SELEKTOR ***
        // Sucht jetzt wieder zuverlässig nach dem Button, ohne eine Formular-ID vorauszusetzen.
        const assignButton = document.querySelector('input[name="commit"][value="Ausbilden"]');
        if (!assignButton) {
            console.log("Massen-Lehrgangszuweiser: 'Ausbilden'-Button nicht gefunden. Skript wird auf dieser Seite nicht aktiviert.");
            return;
        }

        const currentCourseTitleElement = document.querySelector('h2');
        if (!currentCourseTitleElement) return;
        const currentCourseTitle = currentCourseTitleElement.textContent.trim();
        const currentCourseId = parseInt(window.location.pathname.split('/')[2], 10);
        let allAvailableCourses = [];

        const container = document.createElement('div');
        container.id = 'multiSchoolingContainer';
        // Die alte `className` und `style` werden nicht mehr gebraucht, das macht jetzt alles der CSS-Block.
        container.style.marginTop = '20px';
        container.innerHTML = `
            <div class="msc-header">
                <span>🎓 Massen-Zuweisung für identische Lehrgänge</span>
                <button id="msc-fetch-costs-btn" title="Kosten für alle gelisteten Lehrgänge abrufen">
                    Preise laden
                </button>
            </div>
            <div class="msc-body" id="multiSchoolingList">
                <p>Suche nach identischen Lehrgängen mit freien Plätzen...</p>
                <img src="/images/ajax-loader.gif" class="ajax-loader" style="display: block; margin-top: 10px;">
            </div>
        `;
        // Fügt die Box vor der Liste der Wachen ein
        document.querySelector("#accordion").parentNode.insertBefore(container, document.querySelector("#accordion"));


        try {
            const response = await fetch('/api/alliance_schoolings');
            if (!response.ok) throw new Error(`API-Fehler: ${response.statusText}`);
            const data = await response.json();
            allAvailableCourses = data.result;

            const similarCourses = allAvailableCourses.filter(course =>
                course.education_title === currentCourseTitle &&
                course.id !== currentCourseId &&
                !course.running && // Nur Lehrgänge, die noch nicht gestartet sind
                course.open_spaces > 0
            );

            const listElement = document.getElementById('multiSchoolingList');
            if (similarCourses.length > 0) {
                // NEU: Berechne die Gesamtanzahl der zusätzlichen Plätze (Wunsch 2)
                const totalExtraSpaces = similarCourses.reduce((sum, course) => sum + course.open_spaces, 0);

                // NEU: HTML für die Zusammenfassung (Wunsch 2)
                const summaryHTML = `
                    <p style="font-weight: bold; margin-bottom: 15px;">
                        ℹ️ ${similarCourses.length} weitere Lehrgänge mit ${totalExtraSpaces} zusätzlichen Plätzen gefunden.
                    </p>
                `;

                // HTML für die "Alle auswählen" Checkbox
                const selectAllHTML = `
                    <div class="form-check msc-select-all-container">
                        <input class="form-check-input" type="checkbox" id="selectAllCourses">
                        <label class="form-check-label" for="selectAllCourses">
                            Alle verfügbaren Lehrgänge auswählen
                        </label>
                    </div>
                `;

                // HTML für die einzelnen Lehrgänge mit neuen Klassen
                const coursesHTML = similarCourses.map(course => `
                    <div class="form-check msc-course-item">
                        <input class="form-check-input multi-schooling-checkbox" type="checkbox" value="${course.id}" id="course-${course.id}" data-spaces="${course.open_spaces}">
                        <label class="form-check-label" for="course-${course.id}" style="cursor:pointer; width: 100%;">
                            ID: ${course.id} | Freie Plätze: <strong>${course.open_spaces}</strong> | Start: ${new Date(course.finish_time).toLocaleString('de-DE')}
                            <span class="msc-course-cost" id="cost-for-${course.id}"></span>
                        </label>
                    </div>
                `).join('');
                // NEU: Wrapper für das Grid-Layout (Wunsch 1)
                const coursesContainerHTML = `<div id="msc-course-grid">${coursesHTML}</div>`;

                // GEÄNDERT: Füge Zusammenfassung, "Alle auswählen" und das Grid zusammen
                listElement.innerHTML = summaryHTML + selectAllHTML + coursesContainerHTML;

                const fetchCostsButton = document.getElementById('msc-fetch-costs-btn');
                if (fetchCostsButton) {
                    
                    // Hilfsfunktion, um die Kosten von einer einzelnen Lehrgangsseite zu holen
                    const getCourseCost = async (courseId) => {
                        try {
                            // Die normale HTML-Seite des Lehrgangs abrufen
                            const response = await fetch(`/schoolings/${courseId}`);
                            if (!response.ok) return null;

                            const text = await response.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(text, 'text/html');

                            // Die Info-Box finden
                            const infoDiv = doc.querySelector('.alert.alert-info');
                            if (!infoDiv) return null;

                            const infoText = infoDiv.innerText;
                            // Regex, um "XXX Credits" zu finden
                            const costMatch = infoText.match(/Die Kosten betragen (\d+) Credits/);

                            if (costMatch && costMatch[1]) {
                                return parseInt(costMatch[1], 10);
                            }
                            return null; // Nichts gefunden
                        } catch (err) {
                            console.error(`Fehler beim Abrufen der Kosten für ID ${courseId}:`, err);
                            return null;
                        }
                    };

                    // Event-Listener an den Button hängen
                    fetchCostsButton.addEventListener('click', async () => {
                        fetchCostsButton.disabled = true;
                        fetchCostsButton.textContent = 'Lade Preise...';

                        // Durch alle angezeigten, ähnlichen Kurse iterieren
                        for (const course of similarCourses) {
                            const costSpan = document.getElementById(`cost-for-${course.id}`);
                            if (!costSpan) continue;

                            // Lade-Spinner anzeigen
                            costSpan.innerHTML = `<img src="/images/ajax-loader.gif" alt="lädt...">`;

                            const cost = await getCourseCost(course.id);
                            // Kurze Pause, um den Server nicht zu überlasten
                            await sleep(100); 

                            const courseItemElement = costSpan.closest('.msc-course-item');

                            if (cost !== null) {
                                // Kosten gefunden -> Farbe bestimmen
                                let costClass = '';
                                let itemCostClass = ''; // NEUE Variable für die Hintergrund-Klasse

                                if (cost <= 200) {
                                    costClass = 'msc-cost-green';
                                    itemCostClass = 'msc-item-green'; // NEU
                                } else if (cost <= 400) {
                                    costClass = 'msc-cost-orange';
                                    itemCostClass = 'msc-item-orange'; // NEU
                                } else { // Bis 500 (und alles darüber)
                                    costClass = 'msc-cost-red';
                                    itemCostClass = 'msc-item-red'; // NEU
                                }
                                
                                costSpan.className = `msc-course-cost ${costClass}`;
                                costSpan.textContent = `(${cost} C)`;
                                
                                // NEU: Dem ganzen Element die Hintergrund-Klasse geben
                                if (courseItemElement) {
                                    courseItemElement.classList.add(itemCostClass);
                                }
                            } else {
                                // Fehler oder Preis nicht gefunden
                                costSpan.className = 'msc-course-cost msc-cost-red';
                                costSpan.textContent = '(Preis?)';

                                // NEU: Dem ganzen Element die rote Hintergrund-Klasse geben
                                if (courseItemElement) {
                                    courseItemElement.classList.add('msc-item-red');
                                }
                            }
                        }

                        fetchCostsButton.textContent = 'Preise geladen';
                    });
                }
                // --- ENDE: NEUER Code zum Abrufen der Lehrgangskosten ---
                
                // --- ANFANG: Code für Zählung der freien Plätze ---

                // Das Element finden, das die Zahl anzeigt
                const baseSpacesElement = document.getElementById('schooling_free');
                // Die ursprüngliche Zahl der freien Plätze auslesen (oder 0, falls nicht gefunden)
                const baseSpaces = baseSpacesElement ? (parseInt(baseSpacesElement.textContent, 10) || 0) : 0;

                // Diese Funktion berechnet die Plätze neu und aktualisiert die Anzeige
                function updateAvailableSpaces() {
                    let totalSpaces = baseSpaces; // Starte mit den Plätzen des aktuellen Lehrgangs

                    // Finde alle ZUSÄTZLICH ausgewählten Checkboxen
                    const checkedCourses = document.querySelectorAll('.multi-schooling-checkbox:checked');

                    // Zähle deren freie Plätze (aus dem 'data-spaces' Attribut) hinzu
                    checkedCourses.forEach(checkbox => {
                        const spaces = parseInt(checkbox.dataset.spaces, 10);
                        if (!isNaN(spaces)) {
                            totalSpaces += spaces;
                        }
                    });

                    // Aktualisiere die Zahl im HTML
                    if (baseSpacesElement) {
                        baseSpacesElement.textContent = totalSpaces;
                    }
                }

                // Hänge die Update-Funktion an JEDE einzelne Lehrgangs-Checkbox
                document.querySelectorAll('.multi-schooling-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', updateAvailableSpaces);
                });

                // --- ENDE: Code für Zählung der freien Plätze ---


                // Event-Listener für die neue "Alle auswählen" Checkbox
                const selectAllCheckbox = document.getElementById('selectAllCourses');
                selectAllCheckbox.addEventListener('change', (event) => {
                    const isChecked = event.target.checked;
                    document.querySelectorAll('.multi-schooling-checkbox').forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });
                    updateAvailableSpaces(); // <-- HINZUGEFÜGT: Zähler aktualisieren
                });

            } else {
                listElement.innerHTML = '<p>Keine weiteren, noch nicht gestarteten, identischen Lehrgänge mit freien Plätzen gefunden.</p>';
            }
        } catch (error) {
            console.error("Fehler beim Abrufen oder Verarbeiten der Lehrgangsdaten:", error);
            document.getElementById('multiSchoolingList').innerHTML = '<p class="text-danger">Fehler beim Laden der Lehrgangsliste.</p>';
        }

        assignButton.addEventListener('click', async (event) => {
            event.preventDefault();

            let personnelQueue = Array.from(document.querySelectorAll('.schooling_checkbox:checked')).map(cb => cb.value);
            const authToken = document.querySelector('input[name="authenticity_token"]').value;

            if (personnelQueue.length === 0) {
                alert("Bitte wähle zuerst Personal aus.");
                return;
            }

            // HINWEIS: Hier wurde die Logik zur Ermittlung der Plätze angepasst,
            // um die Plätze aus der API zu nutzen, falls verfügbar.
            const apiCourseInfo = allAvailableCourses.find(c => c.id === currentCourseId);
            const currentCourseInfo = apiCourseInfo || {
                id: currentCourseId,
                open_spaces: parseInt(document.getElementById('schooling_free').textContent, 10) || 10
            };

            // Wenn die API-Info da war, aber die Plätze durch die Zähl-Logik überschrieben wurden,
            // stellen wir hier die *ursprünglichen* Plätze des aktuellen Kurses wieder her.
            if(apiCourseInfo) {
                currentCourseInfo.open_spaces = apiCourseInfo.open_spaces;
            }

            const additionalCoursesInfo = Array.from(document.querySelectorAll('.multi-schooling-checkbox:checked'))
                .map(cb => allAvailableCourses.find(c => c.id === parseInt(cb.value, 10)))
                .filter(Boolean);

            const targetCourses = [currentCourseInfo, ...additionalCoursesInfo];

            // Die Gesamtzahl wird jetzt aus den tatsächlich ausgewählten Kursen berechnet
            const totalSlots = targetCourses.reduce((sum, course) => sum + course.open_spaces, 0);

            if (personnelQueue.length > totalSlots) {
                if (!confirm(`Du hast ${personnelQueue.length} Personen ausgewählt, aber nur ${totalSlots} Plätze sind in den gewählten Lehrgängen verfügbar. Nur die ersten ${totalSlots} Personen werden zugewiesen. Fortfahren?`)) {
                    return;
                }
            }

            const originalButtonText = assignButton.value;
            assignButton.disabled = true;
            let assignedCount = 0;

            for (let i = 0; i < targetCourses.length; i++) {
                const course = targetCourses[i];
                if (personnelQueue.length === 0) break;

                const personnelForThisCourse = personnelQueue.splice(0, course.open_spaces);
                if (personnelForThisCourse.length === 0) continue;

                assignButton.value = `Zuweisung (${i + 1}/${targetCourses.length}) läuft...`;

                const params = new URLSearchParams();
                params.append('utf8', '✓');
                params.append('authenticity_token', authToken);
                personnelForThisCourse.forEach(personId => {
                    params.append('personal_ids[]', personId);
                });
                params.append('commit', 'Ausbilden');

                try {
                    await fetch(`/schoolings/${course.id}/education`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    });
                    console.log(`${personnelForThisCourse.length} Personen zu Lehrgang ${course.id} zugewiesen.`);
                    assignedCount += personnelForThisCourse.length;
                    await sleep(400);
                } catch (error) {
                    console.error(`Fehler bei Zuweisung zu Lehrgang ${course.id}:`, error);
                    alert(`Bei der Zuweisung für Lehrgang ${course.id} ist ein Fehler aufgetreten.`);
                }
            }

            assignButton.value = "Fertig!";
            alert(`${assignedCount} Personen wurden den ausgewählten Lehrgängen zugewiesen. Die Seite wird jetzt neu geladen.`);
            setTimeout(() => window.location.href = `https://www.leitstellenspiel.de/schoolings`, 500);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
