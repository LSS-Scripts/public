// ==UserScript==
// @name         Massen-Lehrgangszuweiser für Verbandslehrgänge
// @namespace    B&M
// @version      1.3.1
// @description  Ermöglicht die Zuweisung von Personal zu mehreren identischen Verbandslehrgängen gleichzeitig.
// @author       B&M
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
        /* Stellt sicher, dass der Text die richtige, vom Theme vorgegebene Farbe hat */
        .msc-body, .msc-body label {
           color: inherit !important;
        }
        #multiSchoolingList p {
            font-size: 1.1em;
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
                🎓 Massen-Zuweisung für identische Lehrgänge
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
                        </label>
                    </div>
                `).join('');

                listElement.innerHTML = selectAllHTML + coursesHTML;

                // Event-Listener für die neue "Alle auswählen" Checkbox
                const selectAllCheckbox = document.getElementById('selectAllCourses');
                selectAllCheckbox.addEventListener('change', (event) => {
                    const isChecked = event.target.checked;
                    document.querySelectorAll('.multi-schooling-checkbox').forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });
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

            const currentCourseInfo = allAvailableCourses.find(c => c.id === currentCourseId) || { id: currentCourseId, open_spaces: parseInt(document.getElementById('schooling_free').textContent, 10) || 10 };
            const additionalCoursesInfo = Array.from(document.querySelectorAll('.multi-schooling-checkbox:checked'))
                .map(cb => allAvailableCourses.find(c => c.id === parseInt(cb.value, 10)))
                .filter(Boolean);

            const targetCourses = [currentCourseInfo, ...additionalCoursesInfo];

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
