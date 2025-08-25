/*--BMScriptConfig
[
  {
    "param": 1,
    "label": "Verbands-ID",
    "type": "number",
    "default": "24",
    "info": "Die eindeutige Verbands-ID"
  },
  {
    "param": 2,
    "label": "Verbands-Name",
    "type": "Text",
    "default": "FLORIAN HAMBURG",
    "info": "Der eindeutige Verbands-Name"
  }

]
--*/

// ==UserScript==
// @name         VA - Verbandsmitgliedschaft prüfen
// @namespace    http://tampermonkey.net/
// @version      0.9.5
// @description
// @author       Masklin
// @license      MIT
// @match        https://www.leitstellenspiel.de/alliance_threads/*
// @grant        GM_xmlhttpRequest
// @connect      leitstellenspiel.de
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

    // =================================================================================
    // START der Hauptlogik: Fast das gesamte ursprüngliche Skript lebt jetzt hier drin.
    // =================================================================================
    function startScriptLogic(settings) {

        // Konfiguration - GANZ OBEN, WIE GEWÜNSCHT!
        const OK_ALLIANCE_ID = settings.param1 ?? '24';
        const OK_ALLIANCE_LINK_PART = `/alliances/${OK_ALLIANCE_ID}`;
        const OK_ALLIANCE_NAME = settings.param2 ?? 'FLORIAN HAMBURG';

        // Alle Konstanten und Variablen, die für das Skript benötigt werden
        const LS_KEY_PREFIX = 'lss_alliance_checker_profil_pruefung_fix_';
        const LS_KEY_FORUM_PARSING_ACTIVE = LS_KEY_PREFIX + 'forum_parsing_active';
        const LS_KEY_PROFILE_CHECKING_ACTIVE = LS_KEY_PREFIX + 'profile_checking_active';
        const LS_KEY_COLLECTED_FORUM_LINKS = LS_KEY_PREFIX + 'collected_forum_links';
        const LS_KEY_PROFILE_CHECK_RESULTS = LS_KEY_PREFIX + 'profile_check_results';
        const LS_KEY_PROFILE_CHECK_QUEUE = LS_KEY_PREFIX + 'profile_check_queue';
        const LS_KEY_CURRENT_FORUM_PAGE = LS_KEY_PREFIX + 'current_forum_page';
        const LS_KEY_CURRENT_PROFILE_INDEX = LS_KEY_PREFIX + 'current_profile_index';
        const LS_KEY_STOP_REQUESTED = LS_KEY_PREFIX + 'stop_requested';
        const LS_KEY_TOTAL_FORUM_PAGES = LS_KEY_PREFIX + 'total_forum_pages';
        const LS_KEY_IS_CURRENT_PAGE_ONLY_SCAN_TEMP = LS_KEY_PREFIX + 'is_current_page_only_temp';

        const THREAD_ID_REGEX = /\/alliance_threads\/(\d+)/;
        const REQUEST_DELAY = 100;

        let currentThreadId = null;
        let estimatedTotalForumPages = 1;

        let processButton = null;
        let stopButton = null;
        let currentPageOnlyCheckbox = null;
        let statusDiv = null;
        let progressBar = null;

        let resultModal = null;
        let resultModalContent = null;
        let resultModalCloseButton = null;

        // Alle Funktionsdefinitionen des Skripts
        function getThreadIdFromUrl() {
            const match = window.location.pathname.match(THREAD_ID_REGEX);
            return match ? match[1] : null;
        }
        
        // ... (hier folgen alle anderen Funktionen: initialCheckForPersistentResults, addUIElements, usw. unverändert)
        function initialCheckForPersistentResults() { /* ... */ }
        function addUIElements() { /* ... */ }
        // ... und so weiter für alle Funktionen

        // Der Code, der ursprünglich lose im Skript stand, ist jetzt hier
        console.log('[LSS] Skriptstart: Aggressives Zurücksetzen relevanter localStorage-Flags.');
        localStorage.removeItem(LS_KEY_FORUM_PARSING_ACTIVE);
        localStorage.removeItem(LS_KEY_PROFILE_CHECKING_ACTIVE);
        localStorage.removeItem(LS_KEY_STOP_REQUESTED);
        localStorage.removeItem(LS_KEY_COLLECTED_FORUM_LINKS);
        localStorage.removeItem(LS_KEY_PROFILE_CHECK_QUEUE);
        localStorage.removeItem(LS_KEY_CURRENT_FORUM_PAGE);
        localStorage.removeItem(LS_KEY_CURRENT_PROFILE_INDEX);
        localStorage.removeItem(LS_KEY_TOTAL_FORUM_PAGES);
        localStorage.removeItem(LS_KEY_IS_CURRENT_PAGE_ONLY_SCAN_TEMP);

        currentThreadId = getThreadIdFromUrl();

        // Der ursprüngliche Startpunkt wird zum Ende unserer Hauptfunktion:
        initialCheckForPersistentResults();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addUIElements);
        } else {
            addUIElements();
        }
        
        // (Platzhalter für den Rest der vielen Funktionen, die hier reingehören)
        // An dieser Stelle müssten alle Funktionen aus dem Originalskript stehen,
        // die ich aus Übersichtlichkeitsgründen hier nicht alle reinkopiert habe.
    }
    // =================================================================================
    // ENDE der Hauptlogik
    // =================================================================================


    // =================================================================================
    // START des Skript-Startpunkts: Warten, Einstellungen holen, Hauptfunktion starten.
    // =================================================================================
    try {
        await ensureBMScriptManager();

        const skriptName = 'VA - Verbandsmitgliedschaft prüfen';
        const settings = window.BMScriptManager.getSettings(skriptName);

        startScriptLogic(settings); // Die gesamte, jetzt gekapselte Logik starten

    } catch (error) {
        console.error(`[VA - Verbandsmitgliedschaft prüfen] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "VA - Verbandsmitgliedschaft prüfen" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
