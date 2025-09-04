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
  }
]
--*/

// ==UserScript==
// @name         B&M Script-Manager: Auto-Teilen (Public)
// @namespace    B & M
// @version      1.6.8
// @description  Teilt Einsätze, die über einem Kreditlimit liegen und noch nicht abgeschlossen sind.
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

    const SKRIPT_NAME = 'B&M Script-Manager: Auto-Teilen (Public)';

    // --- Konfiguration & Konstanten ---
    let CREDIT_THRESHOLD, NOTIZ_ZEIT_IN_MINUTEN, NOTIZ_VORLAGE;
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 500;

    // --- State-Variablen ---
    const processedMissions = new Set();
    let isProcessing = false;
    let availableToShareCount = 0;

    function isDarkMode() {
        return document.body.classList.contains('dark');
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    function isTextFieldActive() {
        return document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
    }

    function createControlPanel() {
        const header = document.querySelector('#mission_list + .panel-body') || document.querySelector('#mission_list')?.parentElement;
        if (!header || document.getElementById('bm-share-panel')) return;

        const styles = `
            .bm-indicators-container { display: flex; gap: 6px; }
            .bm-panel-control { display: flex; align-items: center; gap: 6px; }
            .bm-panel-control input[type="number"] {
                width: 65px;
                padding: 4px; border-radius: 4px; text-align: center;
                background-color: #fff; color: #333; border: 1px solid #ddd;
            }
            .bm-panel-control button {
                padding: 4px 8px; border: none; border-radius: 5px; color: white;
                font-weight: bold; cursor: pointer; transition: background-color 0.2s;
                background-color: #3498db;
            }
            .bm-panel-control button:hover { background-color: #2980b9; }
            .bm-panel-control button:disabled { background-color: #95a5a6; cursor: not-allowed; }
            .bm-progress-indicator, .bm-completed-indicator {
                color: #fff; padding: 4px 8px; border-radius: 5px;
                font-weight: bold; min-width: 100px; text-align: center;
            }
            .bm-progress-indicator { background-color: #2ecc71; }
            .bm-completed-indicator { background-color: #3498db; }

            [data-theme="dark"] .bm-panel-control input[type="number"] {
                background-color: #34495e; color: #ecf0f1; border: 1px solid #2c3e50;
            }
            [data-theme="dark"] .bm-panel-control button:disabled { background-color: #7f8c8d; }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'bm-share-panel';

        Object.assign(panel.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '12px', padding: '6px', borderRadius: '6px', marginBottom: '10px',
            boxShadow: '0 0 4px rgba(0,0,0,0.4)', border: '1px solid #c0392b',
            background: isDarkMode() ? '#1e1e1e' : '#ffffff', color: isDarkMode() ? '#fff' : '#000'
        });

        const controls = document.createElement('div');
        controls.className = 'bm-panel-control';

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.id = 'bm-share-amount';
        numberInput.min = '1';
        numberInput.placeholder = 'Anzahl';

        const shareButton = document.createElement('button');
        shareButton.id = 'bm-share-button';
        shareButton.textContent = 'Teilen';

        controls.append(numberInput, shareButton);

        const indicatorsContainer = document.createElement('div');
        indicatorsContainer.className = 'bm-indicators-container';

        const completedIndicator = document.createElement('div');
        completedIndicator.id = 'bm-completed-indicator';
        completedIndicator.className = 'bm-completed-indicator';
        completedIndicator.textContent = '✔ Geteilt: 0';

        const progressIndicator = document.createElement('div');
        progressIndicator.id = 'bm-progress-indicator';
        progressIndicator.className = 'bm-progress-indicator';
        progressIndicator.textContent = 'Bereit: 0';
        
        indicatorsContainer.append(completedIndicator, progressIndicator);
        panel.append(controls, indicatorsContainer);
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
            const payload = { "utf8": "✓", "authenticity_token": authToken, "mission_reply[mission_id]": missionId, "mission_reply[content]": messageText, "mission_reply[alliance_chat]": "0" };
            await $.post('/mission_replies', payload);
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
            if (!missionId || processedMissions.has(missionId) || missionEntry.querySelector(`div[id="mission_panel_${missionId}"]`)?.classList.contains('panel-success')) {
                continue;
            }

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

        updateProgress(`✔ ${sharedCount} Einsätze geteilt.`);
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
        
        let readyCount = 0;
        let completedCount = 0;

        for (const missionEntry of missionContainer.querySelectorAll('.missionSideBarEntry')) {
            const missionId = missionEntry.getAttribute('mission_id');
            if (!missionId) continue;

            if (missionEntry.querySelector(`div[id="mission_panel_${missionId}"]`)?.classList.contains('panel-success')) {
                completedCount++;
                continue;
            }
            
            if (processedMissions.has(missionId)) continue;

            const rawData = missionEntry.getAttribute('data-sortable-by');
            if (!rawData) continue;
            try {
                const avgCredits = JSON.parse(rawData.replace(/&quot;/g, '"')).average_credits;
                if (avgCredits > CREDIT_THRESHOLD) readyCount++;
            } catch (e) { /* Ignorieren */ }
        }

        availableToShareCount = readyCount;
        updateProgress(`Bereit: ${availableToShareCount}`);

        const completedIndicator = document.getElementById('bm-completed-indicator');
        if (completedIndicator) {
            completedIndicator.textContent = `✔ Geteilt: ${completedCount}`;
        }
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
        CREDIT_THRESHOLD = parseInt(settings.param2, 10) || 4999;
        NOTIZ_ZEIT_IN_MINUTEN = parseInt(settings.param4, 10) || 180;
        NOTIZ_VORLAGE = settings.param5 || "ELW/FüKw ab {stunden}:{minuten}";

        createControlPanel();
        timedLoop();
        console.log(`[${SKRIPT_NAME}] Skript gestartet.`);
    }

    try {
        await ensureBMScriptManager();
        init();
    } catch (error) {
        console.error(`[${SKRIPT_NAME}] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "${SKRIPT_NAME}" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
