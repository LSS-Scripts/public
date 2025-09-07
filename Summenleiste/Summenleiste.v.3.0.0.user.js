/*--BMScriptConfig
[
  {
    "param": 1,
    "type": "number",
    "label": "Warnung ab Stunde (0-23)",
    "info": "Ab welcher vollen Stunde sollen gefährdete Einsätze für den Rest des Tages markiert werden?",
    "default": 19,
    "min": 0,
    "max": 23
  }
]
--*/

// ==UserScript==
// @name         LSS - Summenleiste mit Warnfunktion
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Zählt Einsätze, Credits, Patienten etc. und hebt Einsätze hervor, die bald gelöscht werden. Inkl. Zähler für gefährdete Einsätze. Konfigurierbar via B&M Scriptmanager.
// @author       Masklin, DeinName & Gemini
// @match        https://www.leitstellenspiel.de/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ============== KONFIGURATION via B&M Scriptmanager ==============
    const SCRIPT_NAME = 'LSS - Summenleiste mit Warnfunktion';
    const settings = window.BMScriptManager?.getSettings(SCRIPT_NAME) || {};
    // Die Stunde (0-23), ab der die Warnung angezeigt wird. Standard: 19 Uhr.
    const ACTIVATION_HOUR = settings.param1 ?? 19;
    // =================================================================

    const DELETION_BAR_CLASS = 'mission-deletion-bar-warning';

    const missionListIds = [
        'mission_list', 'mission_list_alliance', 'mission_list_event',
        'mission_list_sicherheitswache', 'mission_list_sicherheitswache_alliance',
        'mission_list_krankentransporte', 'mission_list_alliance_event'
    ];

    const mainMissionList = document.getElementById('mission_list');
    if (!mainMissionList) return;

    // Erstelle Container für die Summenleiste, falls nicht vorhanden
    let sumDisplayContainer = document.getElementById('tm-sum-display-container');
    if (!sumDisplayContainer) {
        sumDisplayContainer = document.createElement('div');
        sumDisplayContainer.id = 'tm-sum-display-container';
        sumDisplayContainer.innerHTML = `
            <span id="mission-count-display" title="Sichtbare Einsätze"></span>
            <span id="credit-sum-display" title="Durchschnittliche Credits"></span>
            <span id="patient-sum-display" title="Patienten"></span>
            <span id="prisoner-sum-display" title="Gefangene"></span>
            <span id="endangered-mission-count-display" title="Gefährdete Einsätze (älter als 24h)"></span>
        `;
        mainMissionList.parentNode.insertBefore(sumDisplayContainer, mainMissionList);
    }

    // Füge die CSS-Stile für die Warnleiste hinzu
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

        style.display = 'flex';
        style.justifyContent = 'space-around';
        style.alignItems = 'center';
        style.padding = '4px 8px';
        style.marginBottom = '5px';
        style.borderRadius = '4px';
        style.fontSize = '13px';
        style.fontWeight = 'normal';
        style.transition = 'background-color 0.3s, color 0.3s, border-color 0.3s';
        sumDisplayContainer.querySelectorAll('span').forEach(span => {
            span.style.display = 'flex';
            span.style.alignItems = 'center';
        });

        if (isDarkMode) {
            style.backgroundColor = '#2d2d2d';
            style.border = '1px solid #555';
            style.color = '#e0e0e0';
        } else {
            style.backgroundColor = '#f5f5f5';
            style.border = '1px solid #ddd';
            style.color = 'black';
        }
    }

    function calculateAndDisplaySums() {
        let totalCredits = 0, totalPatients = 0, totalPrisoners = 0, visibleMissions = 0, endangeredMissions = 0;

        // Zeit-Logik für die Warnung
        const now = new Date();
        const currentHour = now.getHours();
        const isTimeForWarning = currentHour >= ACTIVATION_HOUR;
        let nextDeletionCheck = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0));
        if (now.getTime() > nextDeletionCheck.getTime()) nextDeletionCheck.setUTCDate(nextDeletionCheck.getUTCDate() + 1);
        const deletionThresholdTimestamp = (nextDeletionCheck.getTime() / 1000) - (24 * 3600);

        const missionSelector = missionListIds.map(id => `#${id} .missionSideBarEntry`).join(', ');
        const missions = document.querySelectorAll(missionSelector);

        missions.forEach(mission => {
            // Entferne immer zuerst die Markierung, um veraltete Zustände zu korrigieren
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

                        // Prüfe, ob der Einsatz gefährdet ist
                        if (data.created_at < deletionThresholdTimestamp) {
                            endangeredMissions++;
                            // Markiere den Einsatz, wenn die Uhrzeit erreicht ist
                            if (isTimeForWarning && heading) {
                                heading.classList.add(DELETION_BAR_CLASS);
                            }
                        }
                    } catch (e) {
                        console.error('Fehler beim Parsen der JSON-Daten für einen Einsatz:', e);
                    }
                }
            }
        });

        const missionCountElement = document.getElementById('mission-count-display');
        const creditValueElement = document.getElementById('credit-sum-display');
        const patientValueElement = document.getElementById('patient-sum-display');
        const prisonerValueElement = document.getElementById('prisoner-sum-display');
        const endangeredValueElement = document.getElementById('endangered-mission-count-display');

        const createHtml = (icon, value) => `${icon} ${value.toLocaleString('de-DE')}`;
        const createPatientHtml = (value) => `<img src="/images/icons8-dizzy_person_2.svg" style="height: 18px; margin-right: 5px; vertical-align: middle;"> ${value.toLocaleString('de-DE')}`;

        if (missionCountElement && creditValueElement && patientValueElement && prisonerValueElement && endangeredValueElement) {
             missionCountElement.innerHTML = createHtml('🚩', visibleMissions);
             creditValueElement.innerHTML = createHtml('💰', totalCredits);
             patientValueElement.innerHTML = createPatientHtml(totalPatients);
             prisonerValueElement.innerHTML = createHtml('⛓️', totalPrisoners);
             endangeredValueElement.innerHTML = createHtml('⚠️', endangeredMissions);
        }
    }

    const missionObserver = new MutationObserver(calculateAndDisplaySums);
    const missionObserverConfig = { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] };
    missionListIds.forEach(id => {
        const listElement = document.getElementById(id);
        if (listElement) missionObserver.observe(listElement, missionObserverConfig);
    });

    const themeObserver = new MutationObserver(applyThemeStyles);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    applyThemeStyles();
    calculateAndDisplaySums();

})();
