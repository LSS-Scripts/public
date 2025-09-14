// ==UserScript==
// @name         Massen-Lehrgangszuweiser für Verbandslehrgänge
// @namespace    B&M
// @version      1.2.1
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
        container.className = 'panel panel-default';
        container.style.marginTop = '20px';
        container.innerHTML = `
            <div class="panel-heading" style="background-color: #f5f5f5; border-bottom: 1px solid #ddd;">
                <h4>Zusätzliche identische Lehrgänge auswählen</h4>
            </div>
            <div class="panel-body" id="multiSchoolingList">
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
                listElement.innerHTML = similarCourses.map(course => `
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input multi-schooling-checkbox" type="checkbox" value="${course.id}" id="course-${course.id}" data-spaces="${course.open_spaces}">
                        <label class="form-check-label" for="course-${course.id}">
                            ID: ${course.id} | Freie Plätze: <strong>${course.open_spaces}</strong> | Start: ${new Date(course.finish_time).toLocaleString()}
                        </label>
                    </div>
                `).join('');
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
