/*--BMScriptConfig
[
  {
    "param": 2,
    "label": "Kreditlimit zum Teilen",
    "type": "number",
    "default": 4999,
    "min": 0,
    "max": 99999,
    "info": "Das Limit, ab wie vielen Credits Einsätze geteilt werden sollen."
  },
  {
    "param": 4,
    "label": "Endzeit für geteilte Einsätze (in Minuten)",
    "type": "number",
    "default": "180",
    "info": "Wie viele Minuten nach dem Teilen der Einsatz offen bleiben soll."
  },
  {
    "param": 5,
    "label": "Text für Notiz",
    "type": "text",
    "default": "ELW/FüKw ab {stunden}:{minuten}",
    "info": "Platzhalter: {stunden} und {minuten} für die berechnete Endzeit."
  },
  {
    "param": 6,
    "label": "Text für Rückmeldung im Chat",
    "type": "text",
    "default": "Habe {anzahl} Einsätze für euch freigegeben.",
    "info": "Rückmeldung für den Verbands-Chat. Platzhalter: {anzahl}."
  }
]
--*/

// ==UserScript==
// @name         B&M Script-Manager: Auto-Teilen (Public)
// @namespace    Hendrik & Masklin
// @version      1.1.0 // NEU: Versionsnummer erhöht
// @description  Teilt eine festgelegte Anzahl an Einsätzen und gibt eine Rückmeldung im Verbands-Chat.
// @match        https://www.leitstellenspiel.de/
// @grant        none
// @license      MIT
// ==/UserScript==

(async function () {
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

    const SKRIPT_NAME = 'Auto-Teilen';

    // --- Konfiguration & Konstanten ---
    let CREDIT_THRESHOLD, NOTIZ_ZEIT_IN_MINUTEN, NOTIZ_VORLAGE, RUECKMELDUNG_VORLAGE; // NEU: RUECKMELDUNG_VORLAGE
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 500;

    // --- State-Variablen ---
    const processedMissions = new Set();
    let isProcessing = false;
    let availableToShareCount = 0;

    const delay = ms => new Promise(res => setTimeout(res, ms));

    function isTextFieldActive() {
        return document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
    }

    // NEU: Funktion zum Posten im Verbands-Chat
    async function postAllianceChat(message) {
        const authToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!authToken || !message) return;

        try {
            const payload = { "utf8": "✓", "authenticity_token": authToken, "alliance_chat[message]": message };
            await $.post('/alliance_chats', payload);
        } catch (error) {
            console.error(`[${SKRIPT_NAME}] Fehler beim Senden der Chat-Nachricht:`, error);
        }
    }

    function createControlPanel() {
        const header = document.querySelector('#mission_list + .panel-body') || document.querySelector('#mission_list')?.parentElement;
        if (!header || document.getElementById('bm-share-panel')) return;

        const styles = `
            :root {
                --bm-panel-bg: #f5f5f5; --bm-panel-border: #ddd; --bm-text-color: #333; --bm-input-bg: #fff; --bm-button-bg: #3498db;
                --bm-button-hover-bg: #2980b9; --bm-button-disabled-bg: #95a5a6; --bm-progress-bg: #2ecc71; --bm-progress-text: #fff;
            }
            [data-theme="dark"] {
                --bm-panel-bg: #2c3e50; --bm-panel-border: #34495e; --bm-text-color: #ecf0f1; --bm-input-bg: #34495e;
            }
            .bm-panel { background-color: var(--bm-panel-bg); border: 1px solid var(--bm-panel-border); border-radius: 8px; padding: 10px; margin-bottom: 10px;
                display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--bm-text-color); }
            .bm-panel-control { display: flex; align-items: center; gap: 6px; }
            .bm-panel label { font-weight: bold; }
            .bm-panel input[type="number"] { width: 60px; padding: 5px; border: 1px solid var(--bm-panel-border); border-radius: 4px;
                background-color: var(--bm-input-bg); color: var(--bm-text-color); text-align: center; }
            .bm-panel button { padding: 6px 12px; border: none; border-radius: 5px; background-color: var(--bm-button-bg); color: white;
                font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
            .bm-panel button:hover { background-color: var(--bm-button-hover-bg); }
            .bm-panel button:disabled { background-color: var(--bm-button-disabled-bg); cursor: not-allowed; }
            .bm-progress-indicator { background-color: var(--bm-progress-bg); color: var(--bm-progress-text); padding: 5px 10px;
                border-radius: 5px; font-weight: bold; min-width: 150px; text-align: center; }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'bm-share-panel';
        panel.className = 'bm-panel';

        const controls = document.createElement('div');
        controls.className = 'bm-panel-control';
        const label = document.createElement('label');
        label.textContent = 'Anzahl teilen:';
        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.id = 'bm-share-amount';
        numberInput.min = '1';
        numberInput.placeholder = 'Alle';
        const shareButton = document.createElement('button');
        shareButton.id = 'bm-share-button';
        shareButton.textContent = 'Teilen';
        controls.append(label, numberInput, shareButton);

        const progressIndicator = document.createElement('div');
        progressIndicator.id = 'bm-progress-indicator';
        progressIndicator.className = 'bm-progress-indicator';
        progressIndicator.textContent = 'Bereit: 0 Einsätze';

        panel.append(controls, progressIndicator);
        header.prepend(panel);

        shareButton.addEventListener('click', () => {
            const limit = parseInt(numberInput.value, 10);
            handleMissionProcessing(isNaN(limit) || limit <= 0 ? Infinity : limit);
        });
    }

    function updateProgress(message) {
        const indicator = document.getElementById('bm-progress-indicator');
        if (indicator) indicator.textContent = message;
    }

    async function processSingleMission(missionEntry, authToken) {
        const missionId = missionEntry.getAttribute('mission_id');
        if (!missionId) return 0;
        try {
            await $.get(`/missions/${missionId}/alliance`);
            const now = new Date();
            now.setMinutes(now.getMinutes() + NOTIZ_ZEIT_IN_MINUTEN);
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const messageText = NOTIZ_VORLAGE.replace('{stunden}', hours).replace('{minuten}', minutes);
            const payload = { "authenticity_token": authToken, "mission_reply[content]": messageText };
            await $.post(`/missions/${missionId}/mission_replies`, payload);
            processedMissions.add(missionId);
            return 1;
        } catch (error) {
            console.error(`[${SKRIPT_NAME}] Fehler bei Mission ${missionId}:`, error);
            missionEntry.style.backgroundColor = '#f2dede';
            missionEntry.title = `Fehler beim Teilen oder Notiz setzen für Mission ${missionId}.`;
            return 0;
        }
    }

    async function handleMissionProcessing(shareLimit) {
        if (isProcessing) return;
        const shareButton = document.getElementById('bm-share-button');
        const numberInput = document.getElementById('bm-share-amount');
        const authToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const missionContainer = document.querySelector('#mission_list');
        if (!authToken || !missionContainer) {
            alert("Fehler: Authentifizierungs-Token oder Einsatzliste nicht gefunden.");
            return;
        }

        const allEligibleMissions = [];
        for (const missionEntry of missionContainer.querySelectorAll('.missionSideBarEntry')) {
            const missionId = missionEntry.getAttribute('mission_id');
            if (!missionId || processedMissions.has(missionId)) continue;
            const rawData = missionEntry.getAttribute('data-sortable-by');
            if (!rawData) continue;
            try {
                const avgCredits = JSON.parse(rawData.replace(/&quot;/g, '"')).average_credits;
                if (avgCredits > CREDIT_THRESHOLD) allEligibleMissions.push(missionEntry);
            } catch (e) { /* Ignorieren */ }
        }

        const missionsToProcess = allEligibleMissions.slice(0, shareLimit);
        if (missionsToProcess.length === 0) {
            updateProgress('Keine Einsätze zu teilen.');
            setTimeout(() => updateAvailableCount(), 2000);
            return;
        }

        isProcessing = true;
        shareButton.disabled = true;
        numberInput.disabled = true;
        shareButton.textContent = 'Teile...';

        let sharedCount = 0;
        for (let i = 0; i < missionsToProcess.length; i += BATCH_SIZE) {
            const batch = missionsToProcess.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(entry => processSingleMission(entry, authToken));
            const results = await Promise.all(batchPromises);
            sharedCount += results.reduce((a, b) => a + b, 0);
            updateProgress(`Geteilt: ${sharedCount} / ${missionsToProcess.length}`);
            if (i + BATCH_SIZE < missionsToProcess.length) await delay(DELAY_BETWEEN_BATCHES);
        }
        
        // GEÄNDERT: Logik nach dem Teilen
        updateProgress(`✔ ${sharedCount} Einsätze geteilt.`);

        // NEU: Rückmeldung im Chat posten
        if (sharedCount > 0 && RUECKMELDUNG_VORLAGE) {
            const chatMessage = RUECKMELDUNG_VORLAGE.replace('{anzahl}', sharedCount);
            await postAllianceChat(chatMessage);
        }

        isProcessing = false;
        shareButton.disabled = false;
        numberInput.disabled = false;
        numberInput.value = '';
        shareButton.textContent = 'Teilen';
        
        setTimeout(() => updateAvailableCount(), 3000);
    }

    function updateAvailableCount() {
        if (isProcessing || isTextFieldActive()) return;
        const missionContainer = document.querySelector('#mission_list');
        if (!missionContainer) return;
        let count = 0;
        for (const missionEntry of missionContainer.querySelectorAll('.missionSideBarEntry')) {
            const missionId = missionEntry.getAttribute('mission_id');
            if (!missionId || processedMissions.has(missionId)) continue;
            const rawData = missionEntry.getAttribute('data-sortable-by');
            if (!rawData) continue;
            try {
                const avgCredits = JSON.parse(rawData.replace(/&quot;/g, '"')).average_credits;
                if (avgCredits > CREDIT_THRESHOLD) count++;
            } catch (e) { /* Ignorieren */ }
        }
        availableToShareCount = count;
        updateProgress(`Bereit: ${availableToShareCount} Einsätze`);
    }

    function timedLoop() {
        try {
            updateAvailableCount();
        } catch (e) {
            console.error(`[${SKRIPT_NAME}] Fehler im timedLoop:`, e);
        }
        setTimeout(timedLoop, 5000);
    }
    
    async function init() {
        const settings = window.BMScriptManager.getSettings(SKRIPT_NAME);
        CREDIT_THRESHOLD = parseInt(settings.param2, 10) ?? 4999;
        NOTIZ_ZEIT_IN_MINUTEN = parseInt(settings.param4, 10) ?? 180;
        NOTIZ_VORLAGE = settings.param5 ?? "ELW/FüKw ab {stunden}:{minuten}";
        RUECKMELDUNG_VORLAGE = settings.param6 ?? ""; // NEU: Einstellung für Rückmeldung laden

        createControlPanel();
        timedLoop();
        console.log(`[${SKRIPT_NAME}] Skript (Public Version) gestartet.`);
    }

    try {
        await ensureBMScriptManager();
        init();
    } catch (error) {
        console.error(`[${SKRIPT_NAME}] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "${SKRIPT_NAME}" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
