// ==UserScript==
// @name         Auto-Nachladen
// @namespace    www.leitstellenspiel.de
// @version      9.0
// @description  
// @author       Masklin / MissSobol / Gemini
// @match        https://www.leitstellenspiel.de/missions/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("LSS Auto-Nachladen [v9.0 Finale Prüfung] ist aktiv.");

    let activeReloadName = null;
    let observer = null;
    let startTimerId = null;

    const stopReloadProcess = (reason) => {
        if (reason) console.log(`%cSTOP: ${reason}`, 'color: orange;');
        if (observer) observer.disconnect();
        observer = null;
        activeReloadName = null;
    };

    const findAaoByName = (name) => {
        for (const aao of document.querySelectorAll('a.aao')) {
            if (aao.textContent.trim() === name) return aao;
        }
        return null;
    };

    const checkAndReload = (name, maxRetries, retryCount) => {
        if (activeReloadName !== name) return;
        if (retryCount >= maxRetries) {
            stopReloadProcess("Maximale Versuche erreicht.");
            return;
        }
        const aaoEntry = findAaoByName(name);
        const reloadButton = document.querySelector('.missing_vehicles_load.btn-warning');
        if (!aaoEntry || !aaoEntry.querySelector('.label.label-danger')) {
            stopReloadProcess("AAO ist verfügbar oder wurde nicht gefunden.");
            return;
        }
        observer = new MutationObserver((mutations, obs) => {
            const currentAao = findAaoByName(name);
            const currentReloadButton = document.querySelector('.missing_vehicles_load.btn-warning');
            if (currentAao && currentAao.querySelector('.label.label-danger') && currentReloadButton) {
                console.log("Observer: Stabiler Zustand nach dem Laden erkannt.");
                obs.disconnect();
                observer = null;
                checkAndReload(name, maxRetries, retryCount + 1);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        if (reloadButton) {
            console.log(`%c[${name}] Versuch ${retryCount + 1}: Klicke Nachladen...`, 'color: green; font-weight: bold;');
            reloadButton.click();
        } else {
            console.log(`%c[${name}] Versuch ${retryCount + 1}: Button fehlt, warte...`, 'color: blue;');
        }
    };

    const aaoGroup = document.getElementById('mission-aao-group');
    if (!aaoGroup) return;

    aaoGroup.addEventListener('mouseover', (e) => {
        const aaoEntry = e.target.closest('a.aao');

        clearTimeout(startTimerId);

        if (!aaoEntry || !aaoEntry.querySelector('.label.label-danger') || activeReloadName) {
            return;
        }

        const name = aaoEntry.textContent.trim();
        if (!name) return;

        startTimerId = setTimeout(() => {
            // FINALE PRÜFUNG: Ist die Maus immer noch über dem ursprünglichen Ziel?
            const currentlyHovered = aaoGroup.querySelector("a.aao:hover");
            if (currentlyHovered && currentlyHovered.textContent.trim() === name) {
                console.log(`START: Maus war 1s auf '${name}'. Prozess wird initiiert.`);
                activeReloadName = name;
                checkAndReload(name, 20, 0);
            } else {
                console.log("Timer abgelaufen, aber Maus ist nicht mehr auf dem Ziel. Breche Start ab.");
            }
        }, 1000);
    });

    aaoGroup.addEventListener('mouseleave', () => {
        clearTimeout(startTimerId);
        if (activeReloadName) {
            stopReloadProcess("Maus hat Container verlassen.");
        }
    });
})();
