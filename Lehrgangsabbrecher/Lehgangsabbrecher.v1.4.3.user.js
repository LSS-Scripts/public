// ==UserScript==
// @name         Lehrgangsabbrecher (DEBUG Version)
// @namespace    http://tampermonkey.net/
// @version      1.4.3-debug
// @description  DEBUG-VERSION - Sammelt Links zu Lehrgängen mit 10 freien Plätzen auf Leitstellenspiel.de und ruft deren Abbruch-URLs im Hintergrund auf.
// @author       Masklin (Umbau von Gemini)
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

    // --- Start Debug Logging ---
    function log(message, ...args) {
        console.log(`[Lehrgangsabbrecher DEBUG] ${message}`, ...args);
    }
    log("Skript gestartet.");
    // --- Ende Debug Logging ---


    // --- Konfiguration ---
    const TARGET_FREE_SLOTS = '10'; // Der Wert für 'freie Plätze', nach dem gesucht wird
    const UI_PANEL_ID = 'lss-schooling-crawler-control-panel'; // Eindeutige ID für das Panel

    // --- IndexedDB Hilfsfunktionen (bleiben unverändert) ---
    const DB_NAME = 'LssLehrgangsAbbrecherDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'script_data';
    let dbPromise = null;

    function getDb() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onerror = () => reject("IndexedDB konnte nicht geöffnet werden.");
                request.onsuccess = event => resolve(event.target.result);
                request.onupgradeneeded = event => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
            });
        }
        return dbPromise;
    }

    async function dbGetValue(key, defaultValue) {
        const db = await getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onerror = () => reject("Fehler beim Lesen aus IndexedDB.");
            request.onsuccess = () => {
                resolve(request.result !== undefined ? request.result : defaultValue);
            };
        });
    }

    async function dbSetValue(key, value) {
        const db = await getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);
            request.onerror = () => reject("Fehler beim Schreiben in IndexedDB.");
            request.onsuccess = () => resolve(true);
        });
    }


    /**
     * Fügt Einzel-Abbrechen-Buttons zu den Lehrgangszeilen hinzu.
     */
    function addSingleCancelAndFinishButtons() {
        log("Aufruf von addSingleCancelAndFinishButtons.");

        const schoolingTabContent = document.getElementById('tab_schooling');
        if (!schoolingTabContent) {
            log("FEHLER: 'tab_schooling' wurde nicht gefunden. Breche ab.");
            return;
        }
        if (!schoolingTabContent.classList.contains('active')) {
            log("INFO: 'tab_schooling' ist nicht aktiv. Überspringe Button-Erstellung.");
            return;
        }
        log("'tab_schooling' gefunden und ist aktiv.");


        const schoolingTables = schoolingTabContent.querySelectorAll('.building_schooling_table');
        if (schoolingTables.length === 0) {
            log("WARNUNG: Keine '.building_schooling_table' in 'tab_schooling' gefunden.");
            return;
        }
        log(`INFO: ${schoolingTables.length} Tabelle(n) gefunden.`);


        schoolingTables.forEach((table, tableIndex) => {
             log(`Verarbeite Tabelle #${tableIndex + 1}`);
             const rows = table.querySelectorAll('tbody tr');
             log(`  - Finde ${rows.length} Zeilen in tbody.`);

             rows.forEach((row, rowIndex) => {
                 const cells = row.querySelectorAll('td');
                 if (cells.length < 3) {
                     log(`  - Zeile #${rowIndex + 1} hat zu wenige Zellen (${cells.length}). Überspringe.`);
                     return;
                 }

                 const freeSlotsCell = cells[2];
                 const linkCell = cells[0];

                 if (freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                     log(`  - Zeile #${rowIndex + 1} erfüllt die Bedingung '10 freie Plätze'. Versuche Button hinzuzufügen.`);

                     if (row.querySelector('.lss-action-cell')) {
                         log("    - Aktionszelle bereits vorhanden, überspringe.");
                         return;
                     }

                     const linkElement = linkCell.querySelector('a');
                     if (linkElement && linkElement.href) {
                         const match = linkElement.href.match(/\/schoolings\/(\d+)/);
                         if (match && match[1]) {
                             const schoolingId = match[1];
                             const actionCell = document.createElement('td');
                             actionCell.classList.add('lss-action-cell');

                             const cancelButton = document.createElement('button');
                             cancelButton.textContent = 'Abbrechen';
                             cancelButton.classList.add('btn', 'btn-xs', 'btn-danger', 'lss-cancel-single-btn');
                             cancelButton.addEventListener('click', () => alert(`Button für Lehrgang ${schoolingId} geklickt.`));
                             actionCell.appendChild(cancelButton);
                             row.appendChild(actionCell);
                             log(`    - ERFOLG: Button für Lehrgang ${schoolingId} wurde zur Zeile hinzugefügt.`);
                         } else {
                            log(`    - FEHLER: Konnte schoolingId nicht aus href extrahieren: ${linkElement.href}`);
                         }
                     } else {
                         log(`    - FEHLER: Konnte Link-Element in der ersten Zelle nicht finden.`);
                     }
                 }
             });
        });
    }

    // --- Skript-Start und Beobachtung ---
    log("Prüfe, ob das Skript im richtigen Fenster läuft.");
    if (window.top === window.self && window.location.pathname.startsWith('/buildings/')) {
        log("Bedingungen erfüllt. Füge EventListener für 'load' hinzu.");
        window.addEventListener('load', function() {
            log("'load'-Event ausgelöst.");

            const tabContentContainer = document.querySelector('.tab-content');
            if (!tabContentContainer) {
                log("FATAL: '.tab-content' Container wurde nicht gefunden. Skript kann nicht weiterarbeiten.");
                return;
            }
             log("'.tab-content' Container gefunden.");

            const observer = new MutationObserver((mutationsList, observer) => {
                log("MutationObserver hat eine Änderung im DOM festgestellt.");
                for(const mutation of mutationsList) {
                    if (mutation.type === 'childList') {
                        log('  - Typ der Änderung: childList (Elemente wurden hinzugefügt/entfernt).');
                    } else if (mutation.type === 'attributes') {
                         log(`  - Typ der Änderung: attributes (Attribut '${mutation.attributeName}' wurde geändert).`);
                    }
                }
                addSingleCancelAndFinishButtons();
            });

            log("Starte MutationObserver, um auf Änderungen zu warten.");
            observer.observe(tabContentContainer, { attributes: true, childList: true, subtree: true });

            // Initialer Check nach dem Laden
            log("Führe initialen Check nach dem Laden der Seite durch.");
            addSingleCancelAndFinishButtons();

        });
    } else {
        log("Bedingungen nicht erfüllt. Skript wird nicht ausgeführt.");
    }
})();
