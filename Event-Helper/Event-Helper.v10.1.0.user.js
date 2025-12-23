// ==UserScript==
// @name         LSS Event Begrenzer (The Dictator v10.1)
// @namespace    http://tampermonkey.net/
// @version      10.1
// @description  Limit 300, 07-20 Uhr, HH-Mitte, Auto-Klick (Klein, Kreis, 30s), Event-ID konfigurierbar.
// @author       B&M
// @match        https://www.leitstellenspiel.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- EINSTELLUNGEN ---
    const LIMIT = 300;           // Ab wie vielen Einsätzen ist Schluss?
    const START_HOUR = 7;        // Ab wann gehts los? (07:00)
    const END_HOUR = 20;         // Wann ist Feierabend? (20:00)
    const UPDATE_INTERVAL = 60000;

    // WELCHES EVENT SOLL ES SEIN?
    const EVENT_ID = 4;          // <--- Hier einfach die ID ändern (z.B. 4, 11, etc.)

    // WO SOLL ES STATTFINDEN? (Hamburg Mittelpunkt)
    const HH_LAT = 53.568577;
    const HH_LNG = 10.029910;
    const HH_ZOOM = 13;
    // ---------------------

    function safeEval(str) {
        try {
            return new Function("return " + str)();
        } catch (e) {
            return [];
        }
    }

    function autoClickModalButtons() {
        let attempts = 0;
        const maxAttempts = 60;

        const clickerInterval = setInterval(() => {
            attempts++;

            // SELECTORS
            const btnSmall = document.querySelector('.btn-event_expansion[expansion_id="0"]');
            const btnCircle = document.querySelector('.btn-event_shape[data-shape="circle"]');
            const btnTime = document.querySelector('.btn-event_amount[amount_id="0"]');

            // Nutzt jetzt die Variable von oben
            const radioEvent = document.getElementById(`event_${EVENT_ID}`);

            const checkCare = document.querySelector('input[name="event_precondition_4_care_service_count"]'); // Name könnte sich bei anderen IDs ändern, Vorsicht.

            let successCount = 0;

            if (btnSmall) { btnSmall.click(); successCount++; }
            if (btnCircle) { btnCircle.click(); successCount++; }
            if (btnTime) { btnTime.click(); successCount++; }

            if (radioEvent) {
                if (!radioEvent.checked) {
                    radioEvent.click();
                }
                successCount++;
            }

            if (checkCare) {
                if (checkCare.checked) checkCare.click();
                if (!checkCare.checked) successCount++;
            }

            if (successCount >= 4 || attempts >= maxAttempts) {
                clearInterval(clickerInterval);
                if(successCount >= 4) console.log(`LSS Script: Event ${EVENT_ID} Settings gesetzt.`);
            }
        }, 100);
    }

    async function runAnalysis() {
        if (typeof user_id === 'undefined') return;
        const myUserId = user_id;
        const urls = ['/map/mission_markers_own.js.erb', '/map/mission_markers_alliance.js.erb'];
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
            } catch (e) { console.error(e); }
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

        const nowString = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false });
        const currentHour = parseInt(nowString, 10);
        const isDayTime = (currentHour >= START_HOUR && currentHour < END_HOUR);

        if (!eventButton.getAttribute('data-href-backup') && eventButton.getAttribute('href')) {
            eventButton.setAttribute('data-href-backup', eventButton.getAttribute('href'));
        }
        if (!eventButton.getAttribute('data-original-text')) {
            eventButton.setAttribute('data-original-text', eventButton.innerText.trim());
        }
        const oldWarning = document.getElementById('lss-event-limit-warning');
        if (oldWarning) oldWarning.remove();

        const detailHtml = `<div style="font-size: 0.85em; font-weight: normal; margin-top: 2px; opacity: 0.9;">
            Gesamt: <b>${total}</b> (Eigene: ${own} | Verb.: ${alliance})
        </div>`;

        eventButton.style.display = '';
        eventButton.classList.remove('btn-default');

        if (total < LIMIT && isDayTime) {
            if (!eventButton.getAttribute('href') && eventButton.getAttribute('data-href-backup')) {
                eventButton.setAttribute('href', eventButton.getAttribute('data-href-backup'));
            }
            eventButton.onclick = function() {
                if (typeof map !== 'undefined') map.setView([HH_LAT, HH_LNG], HH_ZOOM);
                autoClickModalButtons();
                return true;
            };
            eventButton.classList.remove('btn-danger');
            eventButton.classList.add('btn-success');
            eventButton.style.cursor = 'pointer';
            eventButton.style.opacity = '1';
            eventButton.innerHTML = `<i class="glyphicon glyphicon-king"></i> Auto-Event (ID ${EVENT_ID}) starten${detailHtml}`;
        } else {
            let reasonText = "Event gesperrt!";
            if (!isDayTime) reasonText = `Nachtruhe (${START_HOUR}-${END_HOUR} Uhr)`;
            else if (total >= LIMIT) reasonText = `Limit erreicht (${LIMIT})`;

            eventButton.removeAttribute('href');
            eventButton.onclick = function(e) { e.preventDefault(); e.stopPropagation(); return false; };
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
