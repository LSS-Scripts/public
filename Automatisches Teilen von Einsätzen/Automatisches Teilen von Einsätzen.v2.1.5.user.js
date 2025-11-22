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
    "label": "Normale Endzeit (in Minuten)",
    "type": "number",
    "default": 180,
    "info": "Die Zeit, die bei 'Chaos: AUS' verwendet wird."
  },
  {
    "param": 6,
    "label": "Chaos-Endzeit (in Minuten)",
    "type": "number",
    "default": 90,
    "info": "Die Zeit, die bei 'Chaos: AN' verwendet wird."
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
// @version      2.1.5
// @description  Teilt Einsätze über Kreditlimit. Angepasstes Design (Dark Mode Match).
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

    const SKRIpt_NAME = 'Automatisches Teilen von Einsätzen';
    const ANZEIGE_NAME = 'B&M Script-Manager: Auto-Teilen (Public)';

    // --- Konfiguration & Konstanten ---
    let CREDIT_THRESHOLD, NOTIZ_VORLAGE;
    let NOTIZ_ZEIT_IN_MINUTEN;
    let NORMAL_TIME, CHAOS_TIME;
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 500;
    
    // --- State-Variablen ---
    const processedMissions = new Set();
    let isProcessing = false;
    let isInternalChaosMode = false;

    function isDarkMode() {
        return document.body.classList.contains('dark');
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    function isTextFieldActive() {
        return document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
    }
    
    function updateTimeDisplay() {
        const display = document.getElementById('bm-time-display');
        if (display) display.textContent = `⏰ ${NOTIZ_ZEIT_IN_MINUTEN} min`;
    }

    function updateChaosButtonLook() {
        const button = document.getElementById('bm-chaos-toggle');
        if (!button) return;

        if (isInternalChaosMode) {
            button.textContent = 'Chaos: AN';
            button.style.backgroundColor = '#e74c3c'; // Rot
            button.style.boxShadow = '0 0 6px rgba(231,76,60,0.8)';
        } else {
            button.textContent = 'Chaos: AUS';
            button.style.backgroundColor = '#27ae60'; // Grün
            button.style.boxShadow = '0 0 6px rgba(39,174,96,0.8)';
        }
    }

    function createControlPanel() {
        const targetElement = document.getElementById('missions-panel-body') || document.querySelector('#mission_list')?.parentElement;
        
        if (!targetElement || document.getElementById('bm-share-panel')) return;

        const styles = `
            .bm-indicators-container { display: flex; gap: 6px; }
            .bm-panel-control { display: flex; align-items: center; gap: 6px; }
            #bm-time-display { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; background-color: ${isDarkMode() ? '#2c3e50' : '#ecf0f1'}; }
            .bm-panel-control input[type="number"] {
                width: 65px; padding: 4px; border-radius: 4px; text-align: center;
                background-color: #fff; color: #333; border: 1px solid #ddd;
            }
            .bm-panel-control button {
                padding: 4px 8px; border: none; border-radius: 5px; color: white;
                font-weight: bold; cursor: pointer; transition: background-color 0.2s, box-shadow 0.2s;
                font-size: 11px;
            }
            #bm-share-button { background-color: #3498db; }
            #bm-share-button:hover { background-color: #2980b9; }
            #bm-share-button:disabled { background-color: #95a5a6; cursor: not-allowed; }
            .bm-progress-indicator, .bm-completed-indicator {
                color: #fff; padding: 4px 8px; border-radius: 5px;
                font-weight: bold; min-width: 100px; text-align: center;
            }
            .bm-progress-indicator { background-color: #2ecc71; }
            .bm-completed-indicator { background-color: #3498db; }
            [data-theme="dark"] .bm-panel-control input[type="number"] {
                background-color: #34495e; color: #ecf0f1; border: 1px solid #2c3e50;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const panel = document.createElement('div');
        panel.id = 'bm-share-panel';
        
        // --- HIER WURDEN DIE FARBEN ANGEPASST ---
        Object.assign(panel.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', padding: '4px 8px', borderRadius: '4px', marginBottom: '5px',
            background: isDarkMode() ? 'rgb(45, 45, 45)' : '#ffffff', 
            color: isDarkMode() ? 'rgb(224, 224, 224)' : '#000',
            border: isDarkMode() ? '1px solid rgb(85, 85, 85)' : '1px solid #ccc'
        });

        const controls = document.createElement('div');
        controls.className = 'bm-panel-control';
        
        const timeDisplay = document.createElement('div');
        timeDisplay.id = 'bm-time-display';

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.id = 'bm-share-amount';
        numberInput.min = '1';
        numberInput.placeholder = 'Anzahl';

        const chaosToggleButton = document.createElement('button');
        chaosToggleButton.id = 'bm-chaos-toggle';
        chaosToggleButton.title = 'Wechselt zwischen Normal- und Chaos-Zeit';
        chaosToggleButton.addEventListener('click', () => {
            isInternalChaosMode = !isInternalChaosMode;
            NOTIZ_ZEIT_IN_MINUTEN = isInternalChaosMode ? CHAOS_TIME : NORMAL_TIME;
            updateChaosButtonLook();
            updateTimeDisplay();
        });

        const shareButton = document.createElement('button');
        shareButton.id = 'bm-share-button';
        shareButton.textContent = 'Teilen';
        
        controls.append(timeDisplay, numberInput, shareButton, chaosToggleButton);

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
        
        targetElement.before(panel);

        shareButton.addEventListener('click', () => {
            const limit = parseInt(numberInput.value, 10);
            handleMissionProcessing(isNaN(limit) || limit <= 0 ? Infinity : limit);
        });
        
        updateTimeDisplay();
        updateChaosButtonLook();
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
            console.error(`[${ANZEIGE_NAME}] Fehler bei Mission ${missionId}:`, error);
            missionEntry.style.backgroundColor = '#f2dede';
            missionEntry.title = `Fehler beim Teilen oder Notiz setzen für Mission ${missionId}.`;
            return 0;
        }
    }

    async function handleMissionProcessing(shareLimit) {
        if (!NOTIZ_ZEIT_IN_MINUTEN || NOTIZ_ZEIT_IN_MINUTEN <= 0) {
            alert("Fehler: Keine gültige Endzeit festgelegt!");
            return;
        }
        if (isProcessing) return;
        const shareButton = document.getElementById('bm-share-button');
        const numberInput = document.getElementById('bm-share-amount');
        const authToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!authToken) { alert("Fehler: Authentifizierungs-Token nicht gefunden."); return; }

        const eligibleMissions = Array.from(document.querySelectorAll('#mission_list .missionSideBarEntry'))
            .filter(entry => {
                const missionId = entry.getAttribute('mission_id');
                if (!missionId || processedMissions.has(missionId) || entry.querySelector(`div[id="mission_panel_${missionId}"]`)?.classList.contains('panel-success')) return false;
                try {
                    const rawData = entry.getAttribute('data-sortable-by');
                    return JSON.parse(rawData.replace(/&quot;/g, '"')).average_credits > CREDIT_THRESHOLD;
                } catch (e) { return false; }
            });

        const missionsToProcess = eligibleMissions.slice(0, shareLimit);
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
            const results = await Promise.all(batch.map(entry => processSingleMission(entry, authToken)));
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
        let readyCount = 0, completedCount = 0;
        document.querySelectorAll('#mission_list .missionSideBarEntry').forEach(entry => {
            const missionId = entry.getAttribute('mission_id');
            if (!missionId) return;
            if (entry.querySelector(`div[id="mission_panel_${missionId}"]`)?.classList.contains('panel-success')) {
                completedCount++; return;
            }
            if (processedMissions.has(missionId)) return;
            try {
                const rawData = entry.getAttribute('data-sortable-by');
                if (JSON.parse(rawData.replace(/&quot;/g, '"')).average_credits > CREDIT_THRESHOLD) readyCount++;
            } catch (e) {}
        });
        updateProgress(`Bereit: ${readyCount}`);
        const completedIndicator = document.getElementById('bm-completed-indicator');
        if (completedIndicator) completedIndicator.textContent = `✔ Geteilt: ${completedCount}`;
    }

    function timedLoop() {
        try { updateAvailableCount(); } catch (e) { console.error(`[${ANZEIGE_NAME}] Fehler im timedLoop:`, e); }
        setTimeout(timedLoop, 5000);
    }
    
    async function init() {
        const settings = window.BMScriptManager.getSettings(SKRIpt_NAME);
        CREDIT_THRESHOLD = parseInt(settings.param2, 10) || 4999;
        NOTIZ_VORLAGE = settings.param5 || "ELW/FüKw ab {stunden}:{minuten}";

        NORMAL_TIME = parseInt(settings.param4, 10) || 180;
        CHAOS_TIME = parseInt(settings.param6, 10) || 90;

        NOTIZ_ZEIT_IN_MINUTEN = isInternalChaosMode ? CHAOS_TIME : NORMAL_TIME;

        createControlPanel();
        timedLoop();
        console.log(`[${ANZEIGE_NAME}] Skript gestartet. Normal: ${NORMAL_TIME}min, Chaos: ${CHAOS_TIME}min.`);
    }

    try {
        await ensureBMScriptManager();
        init();
    } catch (error) {
        console.error(`[${ANZEIGE_NAME}] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "${ANZEIGE_NAME}" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
