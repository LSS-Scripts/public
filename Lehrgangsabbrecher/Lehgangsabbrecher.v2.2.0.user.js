// ==UserScript==
// @name         Lehrgangsabbrecher (Stabile Version)
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @description  Stabile Version: Bricht gezielt Lehrgänge mit 10 freien Plätzen ab. Bietet globale, schul-spezifische und einzelne Abbruchfunktionen.
// @author       Masklin (Komplettüberholung durch Gemini)
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
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // --- Konfiguration ---
    const TARGET_FREE_SLOTS = '10';
    const UI_PANEL_ID = 'lss-schooling-crawler-control-panel';
    const STORAGE_KEY_INITIATE_FULL_PROCESS = 'lss_initiate_full_schooling_process';

    // --- Globale UI-Referenzen ---
    let uiPanel = null;
    let progressBar = null;
    let progressText = null;

    // --- Eigenes Benachrichtigungssystem (Ersatz für GM_notification) ---
    GM_addStyle(`
        .lss-custom-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            border-radius: 5px;
            color: #fff;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            opacity: 0.95;
        }
        .lss-custom-notification.success { background-color: #28a745; }
        .lss-custom-notification.error { background-color: #dc3545; }
    `);
    function showCustomNotification(text, type = 'success', timeout = 5000) {
        const notification = document.createElement('div');
        notification.className = `lss-custom-notification ${type}`;
        notification.textContent = text;
        document.body.appendChild(notification);
        setTimeout(() => document.body.removeChild(notification), timeout);
    }

    // --- IndexedDB Hilfsfunktionen ---
    const DB_NAME = 'LssLehrgangsAbbrecherDB_v2';
    let dbPromise = null;
    function getDb() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 1);
                request.onerror = () => reject("IndexedDB Error");
                request.onsuccess = event => resolve(event.target.result);
                request.onupgradeneeded = event => {
                    if (!event.target.result.objectStoreNames.contains('script_data')) {
                        event.target.result.createObjectStore('script_data');
                    }
                };
            });
        }
        return dbPromise;
    }
    async function dbGetValue(key, defaultValue) {
        const db = await getDb();
        return new Promise(resolve => {
            const request = db.transaction('script_data', 'readonly').objectStore('script_data').get(key);
            request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
            request.onerror = () => resolve(defaultValue);
        });
    }
    async function dbSetValue(key, value) {
        const db = await getDb();
        return new Promise(resolve => {
            const request = db.transaction('script_data', 'readwrite').objectStore('script_data').put(value, key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    // --- UI & Fortschrittsbalken ---
    function resetProgressBar(totalCalls) { /* ... (unverändert) ... */ }
    function updateProgressBar(current, total) { /* ... (unverändert) ... */ }
    function createUIPanel() { /* ... (unverändert) ... */ }
    resetProgressBar = function(totalCalls) {
        if (!progressBar || !progressText) return;
        progressBar.style.width = '0%';
        progressBar.classList.remove('progress-bar-success', 'progress-bar-danger');
        progressBar.classList.add('active', 'progress-bar-striped');
        progressText.textContent = `Vorbereitung... (0/${totalCalls})`;
        uiPanel.querySelector('.progress').style.display = 'block';
    };
    updateProgressBar = function(current, total) {
        if (!progressBar || !progressText) return;
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `Fortschritt: ${current}/${total}`;
        if (current === total) {
            progressBar.classList.remove('active', 'progress-bar-striped');
            progressBar.classList.add(progressBar.getAttribute('data-has-failed') === 'true' ? 'progress-bar-danger' : 'progress-bar-success');
        }
    };
    createUIPanel = function() {
        if (document.getElementById(UI_PANEL_ID)) return;
        uiPanel = document.createElement('div');
        uiPanel.id = UI_PANEL_ID;
        uiPanel.className = 'container-fluid';
        uiPanel.style.display = 'none';
        uiPanel.innerHTML = `
            <div class="panel panel-default" style="margin-top: 10px;">
                <div class="panel-heading"><h3 class="panel-title">Lehrgangsabbrecher Steuerung</h3></div>
                <div class="panel-body">
                    <button id="collectAndCancelBtn" class="btn btn-warning btn-block">Alle offenen Lehrgänge global abbrechen</button>
                    <small class="help-block">Lädt die Seite neu und bricht dann alle Lehrgänge mit ${TARGET_FREE_SLOTS} freien Plätzen im Hintergrund ab.</small>
                    <div class="progress" style="margin-top: 10px; display: none;">
                        <div id="lssProgressBar" class="progress-bar progress-bar-striped active" role="progressbar" style="width: 0%;"><span id="lssProgressText"></span></div>
                    </div>
                </div>
            </div>`;
        progressBar = uiPanel.querySelector('#lssProgressBar');
        progressText = uiPanel.querySelector('#lssProgressText');
        uiPanel.querySelector('#collectAndCancelBtn').addEventListener('click', initiateFullSchoolingProcess);
        const tabs = document.getElementById('tabs');
        if (tabs) tabs.parentNode.insertBefore(uiPanel, tabs.nextSibling);
    };


    // --- Kernlogik ---
    async function callCancelLinks(linksToProcess, isGlobal = false) {
        if (!linksToProcess || linksToProcess.length === 0) {
            showCustomNotification('Keine passenden Lehrgänge zum Abbrechen gefunden.', 'error');
            return;
        }
        const totalCalls = linksToProcess.length;
        if (isGlobal) resetProgressBar(totalCalls);
        let callsCompleted = 0, callsFailed = 0;
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
                    if (isGlobal) progressBar.setAttribute('data-has-failed', 'true');
                }
                if (isGlobal) updateProgressBar(callsCompleted + callsFailed, totalCalls);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        showCustomNotification(`Aktion abgeschlossen. Erfolgreich: ${callsCompleted}, Fehlgeschlagen: ${callsFailed}. Seite wird in 5s neu geladen.`, 'success', 5000);
        if (isGlobal) await dbSetValue(STORAGE_KEY_INITIATE_FULL_PROCESS, false);
        setTimeout(() => window.location.reload(), 5000);
    }

    function collectLinks(parentElement = document) { /* ... (unverändert) ... */ }
    async function initiateFullSchoolingProcess() { /* ... (unverändert) ... */ }
    collectLinks = function(parentElement = document) {
        const links = new Set();
        parentElement.querySelectorAll(`.building_schooling_table tbody tr`).forEach(row => {
            const freeSlotsCell = row.cells[2];
            if (freeSlotsCell && freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                const linkElement = row.cells[0].querySelector('a[href*="/schoolings/"]');
                if (linkElement) links.add(linkElement.href);
            }
        });
        return Array.from(links);
    };
    initiateFullSchoolingProcess = async function() {
        if (confirm(`Möchtest du die Seite wirklich neu laden und danach ALLE offenen Lehrgänge in ALLEN Schulen abbrechen?`)) {
            await dbSetValue(STORAGE_KEY_INITIATE_FULL_PROCESS, true);
            window.location.hash = 'tab_schooling';
            window.location.reload();
        }
    };


    // --- DOM-Manipulation & Überwachung ---
    function processDOMElements() { /* ... (unverändert, nutzt die korrigierte Logik aus v2.1.0) ... */ }
    processDOMElements = function() {
        const schoolingTab = document.getElementById('tab_schooling');
        if (!schoolingTab || !schoolingTab.classList.contains('active')) {
            if (uiPanel) uiPanel.style.display = 'none';
            return;
        }
        if (uiPanel) uiPanel.style.display = 'block';

        // 1. Buttons in Schul-Überschriften
        schoolingTab.querySelectorAll('h3:not([data-lss-processed="true"])').forEach(header => {
            header.dataset.lssProcessed = 'true';
            let schoolTable = null;
            let nextElement = header.nextElementSibling;
            while (nextElement) {
                if (nextElement.matches('table.building_schooling_table')) {
                    schoolTable = nextElement;
                    break;
                }
                schoolTable = nextElement.querySelector('table.building_schooling_table');
                if (schoolTable) break;
                nextElement = nextElement.nextElementSibling;
            }

            if (schoolTable) {
                const linksInSchool = collectLinks(schoolTable);
                if (linksInSchool.length > 0) {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-xs btn-danger';
                    btn.textContent = `${linksInSchool.length} offene abbrechen`;
                    btn.style.marginLeft = '10px';
                    btn.onclick = e => {
                        e.preventDefault();
                        if (confirm(`Möchtest du ${linksInSchool.length} Lehrgänge in dieser Schule abbrechen?`)) callCancelLinks(linksInSchool);
                    };
                    header.appendChild(btn);
                }
            }
        });

        // 2. Buttons in Tabellenzeilen
        schoolingTab.querySelectorAll('.building_schooling_table:not([data-lss-processed="true"])').forEach(table => {
            table.dataset.lssProcessed = 'true';
            let headerRow = table.querySelector('thead tr');
            if (headerRow && !headerRow.querySelector('.lss-action-header')) {
                headerRow.insertCell(-1).outerHTML = '<th class="lss-action-header" style="width: 120px;">Aktion</th>';
            }
            table.querySelectorAll('tbody tr').forEach(row => {
                const actionCell = row.insertCell(-1);
                const freeSlotsCell = row.cells[2];
                if (freeSlotsCell && freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                    const link = row.cells[0].querySelector('a[href*="/schoolings/"]');
                    if (link) {
                        const btn = document.createElement('button');
                        btn.className = 'btn btn-xs btn-danger';
                        btn.textContent = 'Einzeln abbrechen';
                        btn.onclick = e => {
                            e.preventDefault();
                            btn.disabled = true;
                            callCancelLinks([link.href]);
                        };
                        actionCell.appendChild(btn);
                    }
                }
            });
        });
    };


    // --- Skript-Start ---
    if (window.top === window.self && window.location.pathname.startsWith('/buildings/')) {
        createUIPanel();
        const tabContentContainer = document.querySelector('.tab-content');
        if (tabContentContainer) {
            const observer = new MutationObserver(() => processDOMElements());
            observer.observe(tabContentContainer, { childList: true, subtree: true });
        }
        (async () => {
            processDOMElements(); // Initialer Lauf
            if (window.location.hash === '#tab_schooling') {
                const shouldStartFullProcess = await dbGetValue(STORAGE_KEY_INITIATE_FULL_PROCESS, false);
                if (shouldStartFullProcess) {
                    await callCancelLinks(collectLinks(), true);
                }
            }
        })();
    }
})();
