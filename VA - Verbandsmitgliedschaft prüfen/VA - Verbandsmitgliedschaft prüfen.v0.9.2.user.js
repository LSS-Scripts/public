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
// @version      0.9.3
// @description
// @author       Masklin
// @license      MIT
// @match        https://www.leitstellenspiel.de/alliance_threads/*
// @grant        GM_xmlhttpRequest
// @connect      leitstellenspiel.de
// ==/UserScript==

(async function() {
    'use strict';

    /**
     * Gibt ein Promise zurück, das erfüllt wird, sobald der BMScriptManager bereit ist.
     * @param {number} [timeout=10000] Die maximale Wartezeit in Millisekunden.
     * @returns {Promise<boolean>} Ein Promise, das bei Erfolg zu `true` auflöst.
     */
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

    // #################################################################################
    // NEUE HAUPTFUNKTION, die die GESAMTE Skriptlogik enthält
    // #################################################################################
    function startScriptLogic(settings) {

        // #################################################################################
        // HIER IST JETZT DIE KONFIGURATION - GANZ OBEN, WIE GEWÜNSCHT!
        // #################################################################################
        const OK_ALLIANCE_ID = settings.param1 ?? '24';
        const OK_ALLIANCE_LINK_PART = `/alliances/${OK_ALLIANCE_ID}`;
        const OK_ALLIANCE_NAME = settings.param2 ?? 'FLORIAN HAMBURG';
        // #################################################################################


        // Ab hier folgt der Rest des ursprünglichen Skripts,
        // unverändert, aber innerhalb dieser Funktion.

        // Konstanten für localStorage-Schlüssel
        const LS_KEY_PREFIX = 'lss_alliance_checker_profil_pruefung_fix_';
        const LS_KEY_FORUM_PARSING_ACTIVE = LS_KEY_PREFIX + 'forum_parsing_active';
        // ... (alle anderen Konstanten und Variablen wie zuvor)
        const REQUEST_DELAY = 100;
        let currentThreadId = null;
        // ... (usw.)


        // Hier folgen ALLE anderen Funktionen des Skripts:
        // initialCheckForPersistentResults(), addUIElements(), updateButtonStates(), ...
        // ... (der gesamte Codeblock wurde hier zur Übersichtlichkeit gekürzt)
        function initialCheckForPersistentResults() {
             const storedResults = localStorage.getItem(LS_KEY_PROFILE_CHECK_RESULTS);
             if (storedResults && Object.keys(JSON.parse(storedResults)).length > 0) {
                 console.log('[LSS] Vorherige Scan-Ergebnisse gefunden.');
             }
        }

        function addUIElements() {
            // ... (komplette UI-Logik wie zuvor)
        }
        
        // ... alle weiteren Funktionen ...
        
        function processFetchedProfilePage(profileUrl, htmlContent, index) {
            // Diese Funktion kann jetzt direkt auf die oben definierten Konstanten
            // OK_ALLIANCE_LINK_PART und OK_ALLIANCE_NAME zugreifen.
            // ...
        }

        // ... (der gesamte Rest des Skripts bis zum ursprünglichen Startpunkt)


        // Der ursprüngliche Startpunkt wird jetzt zum Ende unserer Hauptfunktion:
        console.log('[LSS] Skriptlogik wird initialisiert...');
        currentThreadId = getThreadIdFromUrl();
        initialCheckForPersistentResults();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addUIElements);
        } else {
            addUIElements();
        }
    }


    // #################################################################################
    // DER STARTPUNKT: Warten, Einstellungen holen, Hauptfunktion starten.
    // #################################################################################
    try {
        await ensureBMScriptManager(); // 1. Warten, bis der Manager bereit ist

        const skriptName = 'VA - Verbandsmitgliedschaft prüfen';
        const settings = window.BMScriptManager.getSettings(skriptName); // 2. Einstellungen holen

        startScriptLogic(settings); // 3. Die gesamte Skriptlogik mit den Einstellungen starten

    } catch (error) {
        console.error(`[VA - Verbandsmitgliedschaft prüfen] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "VA - Verbandsmitgliedschaft prüfen" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
