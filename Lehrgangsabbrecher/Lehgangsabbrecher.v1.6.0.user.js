// ==UserScript==
// @name         Lehrgangsabbrecher
// @namespace    http://tampermonkey.net/
// @version      1.6.0
// @description  Sammelt und bricht gezielt Lehrgänge mit 10 freien Plätzen ab. Bietet globale, schul-spezifische und einzelne Abbruchfunktionen mit Fortschrittsanzeige.
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

    // --- Konfiguration ---
    const TARGET_FREE_SLOTS = '10';
    const UI_PANEL_ID = 'lss-schooling-crawler-control-panel';
    const STORAGE_KEY_INITIATE_FULL_PROCESS = 'lss_initiate_full_schooling_process';

    // --- Globale Variablen ---
    let uiPanel = null;
    let progressBar = null;
    let progressText = null;

    // --- IndexedDB Hilfsfunktionen ---
    const DB_NAME = 'LssLehrgangsAbbrecherDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'script_data';
    let dbPromise = null;

    function getDb() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onerror = () => reject("IndexedDB Error");
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
        return new Promise((resolve) => {
            const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
            request.onerror = () => resolve(defaultValue);
        });
    }
    async function dbSetValue(key, value) {
        const db = await getDb();
        return new Promise((resolve) => {
            const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }


    // --- UI & Fortschrittsbalken ---
    function resetProgressBar(totalCalls) {
        if (!progressBar || !progressText) return;
        progressBar.style.width = '0%';
        progressBar.classList.remove('progress-bar-success', 'progress-bar-danger');
        progressBar.classList.add('active', 'progress-bar-striped');
        progressText.textContent = `Vorbereitung... (0/${totalCalls})`;
        uiPanel.querySelector('.progress').style.display = 'block';
    }

    function updateProgressBar(current, total) {
        if (!progressBar || !progressText) return;
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Fortschritt: ${current}/${total}`;
        if (current === total) {
            progressBar.classList.remove('active', 'progress-bar-striped');
            progressBar.classList.add(progressBar.getAttribute('data-has-failed') === 'true' ? 'progress-bar-danger' : 'progress-bar-success');
        }
    }

    function createUIPanel() {
        if (document.getElementById(UI_PANEL_ID)) return;

        uiPanel = document.createElement('div');
        uiPanel.id = UI_PANEL_ID;
        uiPanel.className = 'container-fluid';
        uiPanel.style.display = 'none';
        uiPanel.innerHTML = `
            <div class="panel panel-default">
                <div class="panel-heading">
                    <h3 class="panel-title">Lehrgangsabbrecher Steuerung</h3>
                </div>
                <div class="panel-body">
                    <button id="collectAndCancelBtn" class="btn btn-warning btn-block">Alle offenen Lehrgänge global abbrechen</button>
                    <small class="help-block">Dieser Button lädt die Seite neu, um alle Schulen zu erfassen, und bricht dann alle Lehrgänge mit ${TARGET_FREE_SLOTS} freien Plätzen im Hintergrund ab.</small>
                    <div class="progress" style="margin-top: 10px; display: none;">
                        <div id="lssProgressBar" class="progress-bar progress-bar-striped active" role="progressbar" style="width: 0%;">
                            <span id="lssProgressText">Vorbereitung...</span>
                        </div>
                    </div>
                </div>
            </div>`;

        progressBar = uiPanel.querySelector('#lssProgressBar');
        progressText = uiPanel.querySelector('#lssProgressText');
        uiPanel.querySelector('#collectAndCancelBtn').addEventListener('click', initiateFullSchoolingProcess);
        const tabs = document.getElementById('tabs');
        if (tabs) {
            tabs.parentNode.insertBefore(uiPanel, tabs);
        }
    }


    // --- Kernfunktionen ---
    async function callCancelLinks(linksToProcess) {
        if (linksToProcess.length === 0) {
            GM_notification({ title: 'Lehrgangsabbrecher', text: 'Keine passenden Lehrgänge zum Abbrechen gefunden.' });
            return;
        }

        const totalCalls = linksToProcess.length;
        resetProgressBar(totalCalls);
        progressBar.setAttribute('data-has-failed', 'false');

        let callsCompleted = 0;
        let callsFailed = 0;

        for (const link of linksToProcess) {
            const match = link.match(/\/schoolings\/(\d+)/);
            if (match && match[1]) {
                const schoolingId = match[1];
                const success = await new Promise(resolve => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: `https://www.leitstellenspiel.de/schoolings/${schoolingId}/education/cancel`,
                        onload: response => resolve(response.status === 200),
                        onerror: () => resolve(false),
                    });
                });

                if (success) callsCompleted++;
                else {
                    callsFailed++;
                    progressBar.setAttribute('data-has-failed', 'true');
                }
                updateProgressBar(callsCompleted + callsFailed, totalCalls);
                await new Promise(resolve => setTimeout(resolve, 100)); // Kurze Pause
            }
        }
        GM_notification({
            title: 'Lehrgangsabbrecher',
            text: `Aktion abgeschlossen. Erfolgreich: ${callsCompleted}, Fehlgeschlagen: ${callsFailed}. Seite wird in 5s neu geladen.`,
            timeout: 5000
        });

        await dbSetValue(STORAGE_KEY_INITIATE_FULL_PROCESS, false);
        setTimeout(() => window.location.reload(), 5000);
    }

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

    async function initiateFullSchoolingProcess() {
        if (confirm(`Möchtest du die Seite wirklich neu laden und danach ALLE offenen Lehrgänge in ALLEN Schulen abbrechen?`)) {
            await dbSetValue(STORAGE_KEY_INITIATE_FULL_PROCESS, true);
            window.location.hash = 'tab_schooling';
            window.location.reload();
        }
    }


    // --- DOM-Manipulationen ---
    function addActionButtons() {
        const schoolingTab = document.getElementById('tab_schooling');
        if (!schoolingTab || !schoolingTab.classList.contains('active')) {
            if (uiPanel) uiPanel.style.display = 'none';
            return;
        }
        if (uiPanel) uiPanel.style.display = 'block';

        // 1. Buttons in den Schul-Überschriften
        document.querySelectorAll('#tab_schooling h3').forEach(header => {
            if (header.querySelector('.lss-cancel-school-btn')) return; // Bereits verarbeitet

            const schoolContainer = header.closest('.panel');
            if (!schoolContainer) return;

            const linksInSchool = collectLinks(schoolContainer);
            if (linksInSchool.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-xs btn-danger lss-cancel-school-btn';
                btn.textContent = `${linksInSchool.length} offene Lehrg. abbrechen`;
                btn.style.marginLeft = '10px';
                btn.onclick = (e) => {
                    e.preventDefault();
                    if (confirm(`Möchtest du ${linksInSchool.length} Lehrgänge in dieser Schule abbrechen?`)) {
                        callCancelLinks(linksInSchool);
                    }
                };
                header.appendChild(btn);
            }
        });

        // 2. Buttons in den Tabellenzeilen
        document.querySelectorAll('#tab_schooling .building_schooling_table').forEach(table => {
            if (table.dataset.actionsAdded) return;
            table.dataset.actionsAdded = 'true';

            let headerRow = table.querySelector('thead tr');
            if (headerRow && !headerRow.querySelector('.lss-action-header')) {
                const th = document.createElement('th');
                th.textContent = 'Aktion';
                th.classList.add('lss-action-header');
                headerRow.appendChild(th);
            }

            table.querySelectorAll('tbody tr').forEach(row => {
                if (row.querySelector('.lss-action-cell')) return;

                const actionCell = row.insertCell(-1);
                actionCell.classList.add('lss-action-cell');

                const freeSlotsCell = row.cells[2];
                if (freeSlotsCell && freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                    const link = row.cells[0].querySelector('a[href*="/schoolings/"]');
                    if (link) {
                        const btn = document.createElement('button');
                        btn.className = 'btn btn-xs btn-danger';
                        btn.textContent = 'Abbrechen';
                        btn.onclick = (e) => {
                            e.preventDefault();
                            btn.disabled = true;
                            callCancelLinks([link.href]);
                        };
                        actionCell.appendChild(btn);
                    }
                }
            });
        });
    }


    // --- Skript-Start und Beobachtung ---
    if (window.top === window.self && window.location.pathname.startsWith('/buildings/')) {
        createUIPanel();

        const tabContentContainer = document.querySelector('.tab-content');
        if (tabContentContainer) {
            const observer = new MutationObserver(() => {
                addActionButtons();
            });
            observer.observe(tabContentContainer, { childList: true, subtree: true });
        }

        // Initiale Ausführung und Handling des globalen Abbruchs
        (async () => {
            addActionButtons();
            const shouldStartFullProcess = await dbGetValue(STORAGE_KEY_INITIATE_FULL_PROCESS, false);
            if (shouldStartFullProcess) {
                const allLinks = collectLinks();
                await callCancelLinks(allLinks);
            }
        })();
    }
})();
