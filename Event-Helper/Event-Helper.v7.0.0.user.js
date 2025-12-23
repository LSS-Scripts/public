// ==UserScript==
// @name         LSS Event Begrenzer (Time & Limit)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Limitierung auf 300 Einsätze UND Zeitfenster 07:00 - 20:00 Uhr (Hamburg Zeit).
// @author       Gemini AI
// @match        https://www.leitstellenspiel.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- EINSTELLUNGEN ---
    const LIMIT = 300;
    const START_HOUR = 7; // Ab 07:00 Uhr erlaubt
    const END_HOUR =20;  // Bis 20:00 Uhr erlaubt (also ab 20:00:00 gesperrt)
    const UPDATE_INTERVAL = 60000;
    // ---------------------

    function safeEval(str) {
        try {
            return new Function("return " + str)();
        } catch (e) {
            return [];
        }
    }

    async function runAnalysis() {
        if (typeof user_id === 'undefined') return;
        const myUserId = user_id;

        const urls = [
            '/map/mission_markers_own.js.erb',
            '/map/mission_markers_alliance.js.erb'
        ];

        let combinedMissions = [];

        for (const url of urls) {
            try {
                const response = await fetch(url + '?_=' + new Date().getTime());
                const text = await response.text();

                const regexMList = /const\s+mList\s*=\s*(\[[\s\S]*?\]);/;
                let match = text.match(regexMList);

                if (match && match[1]) {
                    const missions = safeEval(match[1]);
                    if (Array.isArray(missions)) combinedMissions = combinedMissions.concat(missions);
                } else {
                    const regexPush = /mission_markers\.push\(([\s\S]*?)\);/;
                    match = text.match(regexPush);
                    if (match && match[1]) {
                        const rawString = "[" + match[1] + "]";
                        const missions = safeEval(rawString);
                        if (Array.isArray(missions)) combinedMissions = combinedMissions.concat(missions);
                    }
                }
            } catch (e) {
                console.error("LSS Script: Download-Fehler bei " + url, e);
            }
        }

        let ownSharedCount = 0;
        let allianceSharedCount = 0;

        for (const mission of combinedMissions) {
            if (mission.alliance_shared_at) {
                if (mission.user_id == myUserId) ownSharedCount++;
                else allianceSharedCount++;
            }
        }

        updateButton(ownSharedCount + allianceSharedCount, ownSharedCount, allianceSharedCount);
    }

    function updateButton(total, own, alliance) {
        const eventButton = document.getElementById('btn-alliance-new-event');
        if (!eventButton) return;

        // --- ZEIT PRÜFUNG (HAMBURG) ---
        // Wir holen die aktuelle Stunde in der Zeitzone Berlin/Hamburg
        const nowString = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false });
        const currentHour = parseInt(nowString, 10);

        // Ist es Tag? (Größer/Gleich 7 UND Kleiner 20)
        const isDayTime = (currentHour >= START_HOUR && currentHour < END_HOUR);

        // --- BACKUP & CLEANUP ---
        if (!eventButton.getAttribute('data-href-backup') && eventButton.getAttribute('href')) {
            eventButton.setAttribute('data-href-backup', eventButton.getAttribute('href'));
        }
        if (!eventButton.getAttribute('data-original-text')) {
            eventButton.setAttribute('data-original-text', eventButton.innerText.trim());
        }
        const oldWarning = document.getElementById('lss-event-limit-warning');
        if (oldWarning) oldWarning.remove();

        // Details HTML
        const detailHtml = `<div style="font-size: 0.85em; font-weight: normal; margin-top: 2px; opacity: 0.9;">
            Gesamt: <b>${total}</b> (Eigene: ${own} | Verb.: ${alliance})
        </div>`;

        eventButton.style.display = '';
        eventButton.classList.remove('btn-default');

        // --- LOGIK ENTSCHEIDUNG ---

        if (total < LIMIT && isDayTime) {
            // >>> GRÜN: ALLES ERLAUBT <<<

            // Link wiederherstellen
            if (!eventButton.getAttribute('href') && eventButton.getAttribute('data-href-backup')) {
                eventButton.setAttribute('href', eventButton.getAttribute('data-href-backup'));
            }
            eventButton.onclick = null;

            // Style
            eventButton.classList.remove('btn-danger');
            eventButton.classList.add('btn-success');
            eventButton.style.cursor = 'pointer';
            eventButton.style.opacity = '1';

            eventButton.innerHTML = `<i class="glyphicon glyphicon-bullhorn"></i> Verbands-Event starten${detailHtml}`;

        } else {
            // >>> ROT: GESPERRT <<<

            // Grund ermitteln für den Text
            let reasonText = "Event gesperrt!";
            if (!isDayTime) {
                reasonText = `Nachtruhe (${START_HOUR}-${END_HOUR} Uhr)`;
            } else if (total >= LIMIT) {
                reasonText = `Limit erreicht (${LIMIT})`;
            }

            // Link töten
            eventButton.removeAttribute('href');
            eventButton.onclick = function(e) { e.preventDefault(); e.stopPropagation(); return false; };

            // Style
            eventButton.classList.remove('btn-success');
            eventButton.classList.add('btn-danger');
            eventButton.style.cursor = 'not-allowed';
            eventButton.style.opacity = '0.8';

            eventButton.innerHTML = `<i class="glyphicon glyphicon-ban-circle"></i> <b>${reasonText}</b>${detailHtml}`;
        }
    }

    setTimeout(runAnalysis, 1000);
    setInterval(runAnalysis, UPDATE_INTERVAL);

})();
