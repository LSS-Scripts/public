// ==UserScript==
// @name         Lehrgangsabbrecher (DEBUG v2)
// @namespace    http://tampermonkey.net/
// @version      1.6.1-debug
// @description  DEBUG-VERSION - Findet Fehler beim Hinzufügen der Buttons pro Schule.
// @author       Masklin (Umbau & Fix von Gemini)
// @match        https://www.leitstellenspiel.de/buildings/*
// @match        https://leitstellenspiel.de/buildings/*
// @match        https://missionchief.com/buildings/*
// @match        https://www.missionchief.com/buildings/*
// @match        https://missionchief.co.uk/buildings/*
// @match        https://www.missionchief.co.uk/buildings/*
// @match        https://leitstellenspiel.com/buildings/*
// @match        https://www.leitstellenspiel.com/buildings/*
// @exclude      *://*/*missions*
// @exclude      *://*/*vehicles*
// @exclude      *://*/*patient*
// @exclude      *://*/*alliance*
// @exclude      *://*/*profile*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_info
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    function log(message, ...args) {
        console.log(`[Lehrgangsabbrecher DEBUG] ${message}`, ...args);
    }
    log("Skript gestartet.");

    // --- Konfiguration ---
    const TARGET_FREE_SLOTS = '10';

    // (Die globalen UI-Funktionen und IndexedDB bleiben für diesen Test unberührt, aber vorhanden)

    function collectLinks(parentElement = document) {
        const links = new Set();
        parentElement.querySelectorAll('.building_schooling_table tbody tr').forEach(row => {
            const freeSlotsCell = row.cells[2];
            if (freeSlotsCell && freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                const linkElement = row.cells[0].querySelector('a[href*="/schoolings/"]');
                if (linkElement) {
                    links.add(linkElement.href);
                }
            }
        });
        return Array.from(links);
    }

    // --- DOM-Manipulationen ---
    function addActionButtons() {
        log("==== Starte addActionButtons ====");
        const schoolingTab = document.getElementById('tab_schooling');
        if (!schoolingTab || !schoolingTab.classList.contains('active')) {
            log("INFO: 'tab_schooling' ist nicht aktiv. Beende Funktion.");
            return;
        }
        log("INFO: 'tab_schooling' ist aktiv. Fahre fort.");

        // DEBUG: Buttons in den Schul-Überschriften
        const headers = document.querySelectorAll('#tab_schooling h3');
        log(`[H-Buttons] Finde ${headers.length} h3-Elemente.`);
        headers.forEach((header, index) => {
            const headerText = header.textContent.trim().substring(0, 50);
            log(`[H-Buttons] Verarbeite Header #${index + 1}: "${headerText}..."`);

            if (header.querySelector('.lss-cancel-school-btn')) {
                log(`[H-Buttons]  -> Button existiert bereits. Überspringe.`);
                return;
            }

            const schoolContainer = header.closest('.panel, .panel-default');
            if (!schoolContainer) {
                log(`[H-Buttons]  -> FEHLER: Konnte keinen '.panel' Container für diesen Header finden. Überspringe.`);
                return;
            }
            log(`[H-Buttons]  -> Finde Eltern-Container:`, schoolContainer);

            const linksInSchool = collectLinks(schoolContainer);
            log(`[H-Buttons]  -> Finde ${linksInSchool.length} passende Lehrgänge in diesem Container.`);

            if (linksInSchool.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-xs btn-danger lss-cancel-school-btn';
                btn.textContent = `${linksInSchool.length} offene Lehrg. abbrechen`;
                btn.style.marginLeft = '10px';
                header.appendChild(btn);
                log(`[H-Buttons]  -> ERFOLG: Button wurde zum Header hinzugefügt.`);
            } else {
                log(`[H-Buttons]  -> Keine abbrechbaren Lehrgänge gefunden. Füge keinen Button hinzu.`);
            }
        });

        // Die Logik für die einzelnen Zeilen-Buttons (funktioniert bereits, daher keine Logs)
        document.querySelectorAll('#tab_schooling .building_schooling_table').forEach(table => {
            if (table.dataset.actionsAdded) return;
            table.dataset.actionsAdded = 'true';
            let headerRow = table.querySelector('thead tr');
            if (headerRow && !headerRow.querySelector('.lss-action-header')) {
                headerRow.insertCell(-1).outerHTML = '<th class="lss-action-header">Aktion</th>';
            }
            table.querySelectorAll('tbody tr').forEach(row => {
                const actionCell = row.insertCell(-1);
                actionCell.classList.add('lss-action-cell');
                const freeSlotsCell = row.cells[2];
                if (freeSlotsCell && freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                    const link = row.cells[0].querySelector('a[href*="/schoolings/"]');
                    if (link) {
                        const btn = document.createElement('button');
                        btn.className = 'btn btn-xs btn-danger';
                        btn.textContent = 'Abbrechen';
                        actionCell.appendChild(btn);
                    }
                }
            });
        });
         log("==== Beende addActionButtons ====");
    }


    // --- Skript-Start und Beobachtung ---
    if (window.top === window.self && window.location.pathname.startsWith('/buildings/')) {
        const tabContentContainer = document.querySelector('.tab-content');
        if (tabContentContainer) {
            const observer = new MutationObserver(() => {
                addActionButtons();
            });
            observer.observe(tabContentContainer, { childList: true, subtree: true });
            addActionButtons(); // Initialer Lauf
        }
    }
})();
