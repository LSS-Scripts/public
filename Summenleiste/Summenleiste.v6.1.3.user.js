// ==UserScript==
// @name         LSS - Summenleiste (Version 6.1.3 - Abschlussreife Einsätze)
// @namespace    http://tampermonkey.net/
// @version      6.1.3
// @description  Stabile, eigenständige Version der Summenleiste mit Warnfunktion. Zählt zusätzlich abschlussreife Einsätze.
// @author       Masklin, BAHendrik & Gemini
// @match        https://www.leitstellenspiel.de/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    try {
        const ACTIVATION_HOUR = 19;
        const UPDATE_INTERVAL_MS = 2500;

        const missionsPanelBody = document.getElementById('missions-panel-body');
        if (!missionsPanelBody) {
            console.error("[Summenleiste] Das Element #missions-panel-body wurde nicht gefunden. Skript wird beendet.");
            return;
        }

        const DELETION_BAR_CLASS = 'mission-deletion-bar-warning';

        const missionListIds = [
            'mission_list', 'mission_list_alliance', 'mission_list_event',
            'mission_list_sicherheitswache', 'mission_list_sicherheitswache_alliance',
            'mission_list_krankentransporte', 'mission_list_krankentransporte_alliance',
            'mission_list_alliance_event'
        ];

        let sumDisplayContainer = document.getElementById('tm-sum-display-container');
        if (!sumDisplayContainer) {
            sumDisplayContainer = document.createElement('div');
            sumDisplayContainer.id = 'tm-sum-display-container';
            // ### ANPASSUNG: Text-Label geändert ###
            sumDisplayContainer.innerHTML = `
                <span id="mission-count-display" title="Sichtbare Einsätze"></span>
                <span id="due-mission-count-display" title="Abschlussreife Einsätze"></span>
                <span id="credit-sum-display" title="Summe Ø-Credits"></span>
                <span id="patient-sum-display" title="Patienten"></span>
                <span id="prisoner-sum-display" title="Gefangene"></span>
                <span id="endangered-mission-count-display" title="Einsätze, die in der nächsten Nacht gelöscht werden"></span>
            `;
            missionsPanelBody.parentNode.insertBefore(sumDisplayContainer, missionsPanelBody);
        }

        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .${DELETION_BAR_CLASS} {
                position: relative;
                overflow: hidden;
            }
            .${DELETION_BAR_CLASS}::after {
                content: '';
                position: absolute;
                left: 0;
                bottom: 0;
                width: 100%;
                height: 4px;
                background-image: linear-gradient(to right, #EEFF00, #FFC300, #FF8C00);
            }
        `;
        document.head.appendChild(styleElement);

        function applyThemeStyles() {
            if (!sumDisplayContainer) return;
            const isDarkMode = document.body.classList.contains('dark');
            const style = sumDisplayContainer.style;
            style.display = 'flex'; style.justifyContent = 'space-around'; style.alignItems = 'center'; style.padding = '4px 8px';
            style.marginBottom = '5px'; style.borderRadius = '4px'; style.fontSize = '13px'; style.fontWeight = 'normal';
            style.transition = 'background-color 0.3s, color 0.3s, border-color 0.3s';
            sumDisplayContainer.querySelectorAll('span').forEach(span => { span.style.display = 'flex'; span.style.alignItems = 'center'; });
            if (isDarkMode) {
                style.backgroundColor = '#2d2d2d'; style.border = '1px solid #555'; style.color = '#e0e0e0';
            } else {
                style.backgroundColor = '#f5f5f5'; style.border = '1px solid #ddd'; style.color = 'black';
            }
        }

        function calculateAndDisplaySums() {
            let totalCredits = 0, totalPatients = 0, totalPrisoners = 0, visibleMissions = 0, endangeredMissions = 0, dueMissions = 0;
            const now = new Date();
            const currentHour = now.getHours();
            const isTimeForWarning = currentHour >= ACTIVATION_HOUR;
            let nextDeletionCheck = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0));
            if (now.getTime() > nextDeletionCheck.getTime()) nextDeletionCheck.setUTCDate(nextDeletionCheck.getUTCDate() + 1);
            const deletionThresholdTimestamp = (nextDeletionCheck.getTime() / 1000) - (24 * 3600);
            const missionSelector = missionListIds.map(id => `#${id} .missionSideBarEntry`).join(', ');
            const missions = document.querySelectorAll(missionSelector);
            missions.forEach(mission => {
                const heading = mission.querySelector('.panel-heading');
                if (heading) heading.classList.remove(DELETION_BAR_CLASS);
                if (!mission.classList.contains('hidden') && !mission.classList.contains('searchHelperInvisble')) {
                    visibleMissions++;
                    const sortableData = mission.getAttribute('data-sortable-by');
                    if (sortableData) {
                        try {
                            const data = JSON.parse(sortableData);
                            if (data?.average_credits) totalCredits += data.average_credits;
                            if (data?.patients_count?.[0]) totalPatients += data.patients_count[0];
                            if (data?.prisoners_count?.[0]) totalPrisoners += data.prisoners_count[0];
                            if (data.created_at < deletionThresholdTimestamp) {
                                endangeredMissions++;
                                if (isTimeForWarning && heading) heading.classList.add(DELETION_BAR_CLASS);
                            }
                        } catch (e) { console.error('[Summenleiste] Fehler beim Parsen der JSON-Daten:', e); }
                    }

                    const endTimeDisplay = mission.querySelector('.endzeit-anzeige');
                    if (!endTimeDisplay || window.getComputedStyle(endTimeDisplay).backgroundColor !== 'rgb(255, 0, 0)') {
                        dueMissions++;
                    }
                }
            });
            const createHtml = (icon, value) => `${icon} ${value.toLocaleString('de-DE')}`;
            const createPatientHtml = (value) => `<img src="/images/icons8-dizzy_person_2.svg" style="height: 18px; margin-right: 5px; vertical-align: middle;"> ${value.toLocaleString('de-DE')}`;
            document.getElementById('mission-count-display').innerHTML = createHtml('🚩', visibleMissions);
            document.getElementById('due-mission-count-display').innerHTML = createHtml('✅', dueMissions);
            document.getElementById('credit-sum-display').innerHTML = createHtml('💰', totalCredits);
            document.getElementById('patient-sum-display').innerHTML = createPatientHtml(totalPatients);
            document.getElementById('prisoner-sum-display').innerHTML = createHtml('⛓️', totalPrisoners);
            document.getElementById('endangered-mission-count-display').innerHTML = createHtml('⚠️', endangeredMissions);
        }

        applyThemeStyles();
        calculateAndDisplaySums();
        setInterval(calculateAndDisplaySums, UPDATE_INTERVAL_MS);

        const themeObserver = new MutationObserver(applyThemeStyles);
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    } catch (e) {
        console.error("[Summenleiste] Ein kritischer Fehler ist aufgetreten:", e);
        alert("Ein Fehler in der Summenleiste ist aufgetreten. Prüfe die F12-Konsole.");
    }
})();
