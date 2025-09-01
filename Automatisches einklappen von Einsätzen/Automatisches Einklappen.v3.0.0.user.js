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
// @name         Automatisches Einklappen (Kompatibel)
// @namespace    B&M
// @version      3.0
// @description  Klappt Einsätze ein. Kompatibel mit LSSMv4 und manuellem Fallback-Skript.
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

    let missionLists = [];
    const eingeklappteMissionen = new Set();
    const manuallyExpandedTimers = new Map();

    // NEU: Eine Hilfsfunktion, die beide Knopf-Arten erkennt
    function getCollapseInfo(missionEntry) {
        // 1. Suche nach dem LSSMv4-Knopf
        const lssmBtn = missionEntry.querySelector('button.lssmv4-extendedCallList_collapsable-missions_btn');
        if (lssmBtn) {
            const svgIcon = lssmBtn.querySelector('svg[data-icon]');
            if (svgIcon) {
                const isExpanded = svgIcon.getAttribute('data-icon') === 'down-left-and-up-right-to-center';
                return { button: lssmBtn, isExpanded: isExpanded };
            }
        }

        // 2. Wenn nicht gefunden, suche nach dem manuellen Fallback-Knopf
        const fallbackBtn = missionEntry.querySelector('.collapse-button-tm');
        const missionPanel = missionEntry.querySelector('.panel');
        if (fallbackBtn && missionPanel) {
            const isExpanded = !missionPanel.classList.contains('mission-collapsed');
            return { button: fallbackBtn, isExpanded: isExpanded };
        }

        // 3. Keinen passenden Knopf gefunden
        return null;
    }

    function isTextFieldActive() {
        return document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
    }

    // ANGEPASST: Nutzt jetzt die neue Hilfsfunktion
    function attemptReCollapse(missionId, missionEntry) {
        manuallyExpandedTimers.delete(missionId);
        if (!document.body.contains(missionEntry)) return;

        const collapseInfo = getCollapseInfo(missionEntry);
        if (collapseInfo && collapseInfo.isExpanded) {
            collapseInfo.button.click();
            eingeklappteMissionen.add(missionId);
        }
    }

    function scheduleReCollapse(missionId, missionEntry) {
        if (manuallyExpandedTimers.has(missionId)) clearTimeout(manuallyExpandedTimers.get(missionId).timerId);
        const timerId = setTimeout(() => attemptReCollapse(missionId, missionEntry), 15000);
        manuallyExpandedTimers.set(missionId, { timerId, entry: missionEntry });
    }

    // ANGEPASST: Nutzt jetzt die neue Hilfsfunktion
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
                const shouldManage = isUserMission && !isAsteriskMission;

                if (shouldManage) {
                    const collapseInfo = getCollapseInfo(missionEntry);
                    if (!collapseInfo) continue; // Wenn kein Knopf da ist, nichts tun

                    // Fall 1: Wir dachten, er ist eingeklappt, aber er ist es nicht mehr (User hat ihn geöffnet)
                    if (eingeklappteMissionen.has(missionId) && collapseInfo.isExpanded && !manuallyExpandedTimers.has(missionId)) {
                        eingeklappteMissionen.delete(missionId);
                        scheduleReCollapse(missionId, missionEntry);
                    }
                    // Fall 2: Er ist noch nicht in unserer Liste und ist offen (soll eingeklappt werden)
                    else if (!eingeklappteMissionen.has(missionId) && collapseInfo.isExpanded && !manuallyExpandedTimers.has(missionId)) {
                        if (!textFieldCurrentlyActive) {
                            collapseInfo.button.click();
                            eingeklappteMissionen.add(missionId);
                        }
                    }
                    // Fall 3: Er ist bereits eingeklappt (nur den Status synchronisieren)
                    else if (!collapseInfo.isExpanded) {
                        eingeklappteMissionen.add(missionId);
                    }
                } else {
                    // Aufräumen, falls der Einsatz die Bedingungen nicht mehr erfüllt
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
        const settings = window.BMScriptManager.getSettings(SKRIPT_NAME);
        missionLists = [
            { id: 'mission_list', enabled: settings.param1 ?? true },
            { id: 'mission_list_krankentransporte', enabled: settings.param2 ?? true },
            { id: 'mission_list_krankentransporte_alliance', enabled: settings.param3 ?? true },
            { id: 'mission_list_sicherheitswache', enabled: settings.param4 ?? true },
            { id: 'mission_list_sicherheitswache_alliance', enabled: settings.param5 ?? true },
            { id: 'mission_list_alliance', enabled: settings.param6 ?? true },
            { id: 'mission_list_alliance_event', enabled: settings.param7 ?? true }
        ];
        timedLoop();
        console.log(`[${SKRIPT_NAME}] Skript gestartet.`);
    }

    try {
        await ensureBMScriptManager();
        init();
    } catch (error) {
        console.error(`[${SKRIPT_NAME}] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "${SKRIPT_NAME}" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }
})();
