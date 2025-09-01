/*--BMScriptConfig
[
  {
    "param": 1,
    "label": "Eigene Einsätze",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das automatische Einklappen für deine eigenen Einsätze."
  },
  {
    "param": 2,
    "label": "Eigene Krankentransporte",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das Einklappen für deine eigenen Krankentransporte."
  },
  {
    "param": 3,
    "label": "Verbands-Krankentransporte",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das Einklappen für Krankentransporte des Verbands."
  },
  {
    "param": 4,
    "label": "Eigene Sicherheitswachen",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das Einklappen für deine eigenen Sicherheitswachen."
  },
  {
    "param": 5,
    "label": "Verbands-Sicherheitswachen",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das Einklappen für Sicherheitswachen des Verbands."
  },
  {
    "param": 6,
    "label": "Verbandseinsätze",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das Einklappen für allgemeine Verbandseinsätze."
  },
  {
    "param": 7,
    "label": "Verbands-Events",
    "type": "checkbox",
    "default": true,
    "info": "Aktiviert das Einklappen für Verbands-Events."
  }
]
--*/

// ==UserScript==
// @name         Automatisches Einklappen
// @namespace    B&M
// @version      2.0.0
// @description  Klappt Einsätze mit "User"-Icon ein, basierend auf den Einstellungen im B&M Scriptmanager.
// @match        https://www.leitstellenspiel.de/
// @grant        none
// @license      MIT
// ==/UserScript==

(async function() {
    'use strict';

    function ensureBMScriptManager(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (window.BMScriptManager && typeof window.BMScriptManager.getSettings === 'function') {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error(`B&M Scriptmanager wurde nach ${timeout / 1000}s nicht gefunden.`));
                }
            }, 50);
        });
    }

    const SKRIPT_NAME = 'Automatisches Einklappen';

    // Globale Variablen für das Skript
    let missionLists = [];
    const eingeklappteMissionen = new Set();
    const manuallyExpandedTimers = new Map();
    const collapseIconName = 'down-left-and-up-right-to-center';
    const expandIconName = 'up-right-and-down-left-from-center';

    function isTextFieldActive() {
        return document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
    }

    function attemptReCollapse(missionId, missionEntry) {
        manuallyExpandedTimers.delete(missionId);
        if (!document.body.contains(missionEntry)) return;
        const collapseBtn = missionEntry.querySelector('button.lssmv4-extendedCallList_collapsable-missions_btn');
        if (collapseBtn) {
            const svgIcon = collapseBtn.querySelector('svg[data-icon]');
            if (svgIcon && svgIcon.getAttribute('data-icon') === collapseIconName) {
                collapseBtn.click();
                eingeklappteMissionen.add(missionId);
            }
        }
    }

    function scheduleReCollapse(missionId, missionEntry) {
        if (manuallyExpandedTimers.has(missionId)) clearTimeout(manuallyExpandedTimers.get(missionId).timerId);
        const timerId = setTimeout(() => attemptReCollapse(missionId, missionEntry), 15000);
        manuallyExpandedTimers.set(missionId, { timerId, entry: missionEntry });
    }

    function handleMissionCollapse() {
        const textFieldCurrentlyActive = isTextFieldActive();

        for (const list of missionLists) {
            if (!list.enabled) continue;

            const missionContainer = document.querySelector(`#${list.id}`);
            if (!missionContainer) continue;

            for (const missionEntry of missionContainer.querySelectorAll('.missionSideBarEntry')) {
                const missionId = missionEntry.getAttribute('mission_id');
                if (!missionId) continue;

                const isUserMission = missionEntry.querySelector('.glyphicon.glyphicon-user');
                const isAsteriskMission = missionEntry.querySelector('.glyphicon.glyphicon-asterisk:not(.hidden)');

                const shouldAttemptToManageCollapse = isUserMission && !isAsteriskMission;

                if (shouldAttemptToManageCollapse) {
                    const collapseBtn = missionEntry.querySelector('button.lssmv4-extendedCallList_collapsable-missions_btn');
                    if (collapseBtn) {
                        const svgIcon = collapseBtn.querySelector('svg[data-icon]');
                        if (svgIcon) {
                            const currentIcon = svgIcon.getAttribute('data-icon');
                            if (eingeklappteMissionen.has(missionId) && currentIcon === collapseIconName && !manuallyExpandedTimers.has(missionId)) {
                                eingeklappteMissionen.delete(missionId);
                                scheduleReCollapse(missionId, missionEntry);
                            } else if (!eingeklappteMissionen.has(missionId) && !manuallyExpandedTimers.has(missionId)) {
                                if (currentIcon === collapseIconName && !textFieldCurrentlyActive) {
                                    collapseBtn.click();
                                    eingeklappteMissionen.add(missionId);
                                } else if (currentIcon === expandIconName) {
                                    eingeklappteMissionen.add(missionId);
                                }
                            }
                        }
                    }
                } else {
                    if (manuallyExpandedTimers.has(missionId)) {
                        clearTimeout(manuallyExpandedTimers.get(missionId).timerId);
                        manuallyExpandedTimers.delete(missionId);
                    }
                }
            }
        }
    }

    function timedLoop() {
        try {
            handleMissionCollapse();
        } catch (e) {
            console.error(`[${SKRIPT_NAME}] Fehler:`, e);
        }
        setTimeout(timedLoop, 2000);
    }

    async function init() {
        // Einstellungen aus dem Manager laden
        const settings = window.BMScriptManager.getSettings(SKRIPT_NAME);

        // Die missionLists-Array mit den Werten aus den Einstellungen füllen
        missionLists = [
            { id: 'mission_list', enabled: settings.param1 ?? true },
            { id: 'mission_list_krankentransporte', enabled: settings.param2 ?? true },
            { id: 'mission_list_krankentransporte_alliance', enabled: settings.param3 ?? true },
            { id: 'mission_list_sicherheitswache', enabled: settings.param4 ?? true },
            { id: 'mission_list_sicherheitswache_alliance', enabled: settings.param5 ?? true },
            { id: 'mission_list_alliance', enabled: settings.param6 ?? true },
            { id: 'mission_list_alliance_event', enabled: settings.param7 ?? true }
        ];

        // Hauptschleife starten
        timedLoop();
        console.log(`[${SKRIPT_NAME}] Skript gestartet.`);
    }

    // Startpunkt des Skripts
    try {
        await ensureBMScriptManager();
        init();
    } catch (error) {
        console.error(`[${SKRIPT_NAME}] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "${SKRIPT_NAME}" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
