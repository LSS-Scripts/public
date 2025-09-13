// ==UserScript==
// @name         Leitstellenspiel - Modernes Verbands-Scoreboard
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Die definitive, B&M-Manager-kompatible Version mit allen Features, basierend auf dem funktionierenden Omega-Parser.
// @author       B&M
// @match        https://www.leitstellenspiel.de/*
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. KONFIGURATION & GLOBALE VARIABLEN ---
    const OWN_MISSIONS_URL = "/map/mission_markers_own.js.erb";
    const ALLIANCE_MISSIONS_URL = "/map/mission_markers_alliance.js.erb";
    const ALLIANCE_INFO_URL = "/api/allianceinfo";
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 Minuten

    const STATS_STORAGE_KEY = 'scoreboard_stats_data_v3';
    const IDS_STORAGE_KEY = 'scoreboard_processed_ids_v3';
    const SYNC_INFO_KEY = 'scoreboard_sync_info_v3';

    let MY_USER_ID;
    let modalCreated = false;
    let currentMissions = [];

    // --- 2. HILFSFUNKTIONEN ---

    function addStyle(css) {
        if (document.getElementById('scoreboard-styles')) return;
        const style = document.createElement('style');
        style.id = 'scoreboard-styles';
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    function timeAgo(timestamp) {
        const seconds = Math.floor((new Date() - timestamp) / 1000);
        if (seconds < 60) return "gerade eben";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `vor ${minutes} Minute${minutes > 1 ? 'n' : ''}`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
        const days = Math.floor(hours / 24);
        return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
    }

    function formatTimestamp(unixTimestamp) {
        if (!unixTimestamp) return '-';
        const date = new Date(unixTimestamp * 1000);
        return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
    }

    // --- 3. KERNLOGIK ---

    async function extractMissions(responseText) {
        const modifiedScriptText = responseText.replace('const mList =', 'window.tempMissionList =');
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.textContent = modifiedScriptText;
            const cleanup = () => {
                if (window.tempMissionList) delete window.tempMissionList;
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
            };
            script.onload = () => {
                resolve(window.tempMissionList || []);
                cleanup();
            };
            script.onerror = (e) => {
                cleanup();
                reject(new Error("Fehler beim Ausführen des Missions-Skripts via Injection: " + e));
            };
            document.body.appendChild(script);
        });
    }

    function analyzeAndMergeMissions(liveMissions, existingStats, processedMissionIds) {
        const stats = JSON.parse(JSON.stringify(existingStats));
        liveMissions.forEach(mission => {
            if (!mission.id || !mission.alliance_shared_at || processedMissionIds.has(mission.id)) return;
            const userId = mission.user_id;
            const credits = mission.average_credits || 0;
            if (!userId) return;
            if (!stats[userId]) {
                stats[userId] = { total: { count: 0, credits: 0 }};
            }
            stats[userId].total.count++;
            stats[userId].total.credits += credits;
            processedMissionIds.add(mission.id);
        });
        return { updatedStats: stats, newIdsSet: processedMissionIds };
    }

    function calculateLiveStats(stats, liveMissions) {
        const now = new Date();
        const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday_start = new Date(today_start);
        yesterday_start.setDate(yesterday_start.getDate() - 1);
        const displayStats = JSON.parse(JSON.stringify(stats));
        Object.values(displayStats).forEach(userStat => {
            userStat.today = { count: 0, credits: 0 };
            userStat.yesterday = { count: 0, credits: 0 };
        });
        liveMissions.forEach(mission => {
             const userId = mission.user_id;
             const credits = mission.average_credits || 0;
             const sharedAt = mission.alliance_shared_at;
             if (!userId || !sharedAt) return;
             if (!displayStats[userId]) {
                 displayStats[userId] = { total: { count: 0, credits: 0 }, today: { count: 0, credits: 0 }, yesterday: { count: 0, credits: 0 }};
             }
             const sharedDate = new Date(sharedAt * 1000);
             if (sharedDate >= today_start) {
                displayStats[userId].today.count++;
                displayStats[userId].today.credits += credits;
             } else if (sharedDate >= yesterday_start) {
                displayStats[userId].yesterday.count++;
                displayStats[userId].yesterday.credits += credits;
             }
        });
        return displayStats;
    }

    async function syncDataInBackground() {
        try {
            const savedStats = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY)) || {};
            const savedIdsArray = JSON.parse(localStorage.getItem(IDS_STORAGE_KEY)) || [];
            const processedMissionIds = new Set(savedIdsArray);

            const [ownResponseText, allianceResponseText] = await Promise.all([
                fetch(OWN_MISSIONS_URL).then(res => res.text()),
                fetch(ALLIANCE_MISSIONS_URL).then(res => res.text())
            ]);

            const [ownMissions, allianceMissions] = await Promise.all([
                extractMissions(ownResponseText),
                extractMissions(allianceResponseText)
            ]);
            const liveMissions = [...ownMissions, ...allianceMissions];
            const { updatedStats, newIdsSet } = analyzeAndMergeMissions(liveMissions, savedStats, processedMissionIds);

            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));
            localStorage.setItem(IDS_STORAGE_KEY, JSON.stringify(Array.from(newIdsSet)));
            const newMissionsFound = newIdsSet.size > savedIdsArray.length;
            localStorage.setItem(SYNC_INFO_KEY, JSON.stringify({ timestamp: Date.now(), newMissionsFound }));

            updateButtonDisplay();
        } catch (error) {
            console.error('[Scoreboard] Fehler bei der Hintergrund-Aktualisierung:', error);
        }
    }

    async function displayDataFromStorage() {
        const contentDiv = document.getElementById('scoreboard-content');
        contentDiv.innerHTML = '<div class="scoreboard-loader"><div class="loader"></div></div>';
        try {
            MY_USER_ID = parseInt(document.getElementById('navbar_profile_link').getAttribute('href').split('/').pop(), 10);
            const stats = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY)) || {};

            const [userMapResponse, ownText, allianceText] = await Promise.all([
                fetch(ALLIANCE_INFO_URL).then(res => res.json()),
                fetch(OWN_MISSIONS_URL).then(res => res.text()),
                fetch(ALLIANCE_MISSIONS_URL).then(res => res.text())
            ]);
            const [ownMissions, allianceMissions] = await Promise.all([
                extractMissions(ownText),
                extractMissions(allianceText)
            ]);
            currentMissions = [...ownMissions, ...allianceMissions].filter(m => m.alliance_shared_at);
            const userMap = userMapResponse.users.reduce((acc, user) => { acc[user.id] = user.name; return acc; }, {});
            const savedIdsArray = JSON.parse(localStorage.getItem(IDS_STORAGE_KEY)) || [];
            const tempProcessedIds = new Set(savedIdsArray);
            const { updatedStats: tempTotalStats } = analyzeAndMergeMissions(currentMissions, stats, tempProcessedIds);
            const finalDisplayStats = calculateLiveStats(tempTotalStats, currentMissions);
            renderScoreboard(finalDisplayStats, userMap);
        } catch (error) {
            console.error('Fehler beim Anzeigen der Daten:', error);
            contentDiv.innerHTML = `<p style="color: #f04747;">Fehler beim Anzeigen der Daten: ${error.message}</p>`;
        }
    }

    // --- 4. UI-FUNKTIONEN ---

    async function resetStats() {
        if (confirm('Bist du sicher, dass du alle gespeicherten Scoreboard-Statistiken unwiderruflich löschen möchtest?')) {
            localStorage.removeItem(STATS_STORAGE_KEY);
            localStorage.removeItem(IDS_STORAGE_KEY);
            localStorage.removeItem(SYNC_INFO_KEY);
            alert('Statistiken zurückgesetzt.');
            toggleModal(true);
        }
    }

    function createCardHtml(userId, data, isOwn, userMap, rank) {
        const f = (num) => (num || 0).toLocaleString('de-DE');
        const displayName = userMap[userId] || `User-ID: ${userId}`;
        let rankIcon = '';
        if (rank === 0) rankIcon = '🥇';
        else if (rank === 1) rankIcon = '🥈';
        else if (rank === 2) rankIcon = '🥉';
        let header = isOwn ? `${rank < 3 ? rankIcon : '⭐'} ${displayName} (Deine Statistik)` : `${rankIcon} ${displayName}`.trim();
        const total = data.total || { count: 0, credits: 0 };
        const today = data.today || { count: 0, credits: 0 };
        const yesterday = data.yesterday || { count: 0, credits: 0 };
        return `<div class="stat-card ${isOwn ? 'is-own' : ''} rank-${rank + 1}"><div class="stat-card-header">${header}<button class="details-btn" title="Live-Einsätze anzeigen" data-user-id="${userId}">📄</button></div><div class="stat-grid"><div class="stat-item"><div class="stat-item-label">Insgesamt</div><div class="stat-item-value">${f(total.count)} Einsätze</div><div class="stat-item-subvalue">${f(total.credits)} Credits</div></div><div class="stat-item"><div class="stat-item-label">Heute</div><div class="stat-item-value">${f(today.count)} Einsätze</div><div class="stat-item-subvalue">${f(today.credits)} Credits</div></div><div class="stat-item"><div class="stat-item-label">Gestern</div><div class="stat-item-value">${f(yesterday.count)} Einsätze</div><div class="stat-item-subvalue">${f(yesterday.credits)} Credits</div></div></div></div><div class="details-container" id="details-for-${userId}" style="display: none;"></div></div>`;
    }

    function renderScoreboard(stats, userMap) {
        const contentDiv = document.getElementById('scoreboard-content');
        const sortedUsers = Object.entries(stats).sort((a, b) => (b[1].total?.count || 0) - (a[1].total?.count || 0));
        let html = '';
        sortedUsers.forEach(([userId, userStats], index) => {
            const isOwn = (userId == MY_USER_ID);
            html += createCardHtml(userId, userStats, isOwn, userMap, index);
        });
        contentDiv.innerHTML = html || '<p>Noch keine Daten gesammelt. Spiele weiter, um die Statistik aufzubauen!</p>';
    }

    async function updateButtonDisplay() {
        const scoreboardBtn = document.getElementById('scoreboard-trigger');
        const indicator = document.getElementById('scoreboard-status-indicator');
        if (!scoreboardBtn || !indicator) return;
        const syncInfo = JSON.parse(localStorage.getItem(SYNC_INFO_KEY)) || null;
        if (!syncInfo) {
            scoreboardBtn.title = 'Noch keine Daten synchronisiert.';
            return;
        }
        const timeString = timeAgo(syncInfo.timestamp);
        const foundNewString = syncInfo.newMissionsFound ? 'Neue Einsätze gefunden.' : 'Keine neuen Einsätze.';
        scoreboardBtn.title = `Zuletzt aktualisiert: ${timeString}\n${foundNewString}`;
        indicator.className = syncInfo.newMissionsFound ? 'status-new' : 'status-synced';
    }

    function generateDetailsTableHTML(userId) {
        const userMissions = currentMissions.filter(m => m.user_id == userId).sort((a,b) => b.alliance_shared_at - a.alliance_shared_at);
        if (userMissions.length === 0) {
            return '<p class="details-no-missions">Keine aktuell sichtbaren Einsätze für diesen User gefunden.</p>';
        }
        let tableHTML = '<div class="details-table-wrapper"><table><thead><tr><th>Einsatz</th><th>Geteilt am</th><th>Credits</th></tr></thead><tbody>';
        userMissions.forEach(m => {
            tableHTML += `<tr><td>${m.caption}</td><td>${formatTimestamp(m.alliance_shared_at)}</td><td>${(m.average_credits || 0).toLocaleString('de-DE')}</td></tr>`;
        });
        tableHTML += '</tbody></table></div>';
        return tableHTML;
    }

    function toggleDetailsView(userId) {
        const container = document.getElementById(`details-for-${userId}`);
        if (!container) return;
        if (container.style.display === 'none') {
            if (container.innerHTML === '') {
                container.innerHTML = generateDetailsTableHTML(userId);
            }
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }

    function createModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'scoreboard-modal-overlay';
        modalOverlay.innerHTML = `<div id="scoreboard-modal"><div id="scoreboard-modal-header"><h2>📊 Verbands-Scoreboard</h2><div><button id="scoreboard-modal-reset" title="Statistik zurücksetzen">🗑️</button><button id="scoreboard-modal-refresh" title="Neu laden">&#x21bb;</button><button id="scoreboard-modal-close" title="Schließen">&times;</button></div></div><div id="scoreboard-content"></div></div>`;
        document.body.appendChild(modalOverlay);
        modalOverlay.addEventListener('click', (e) => (e.target.id === 'scoreboard-modal-overlay') && toggleModal(false));
        document.getElementById('scoreboard-modal-close').addEventListener('click', () => toggleModal(false));
        document.getElementById('scoreboard-modal-refresh').addEventListener('click', () => toggleModal(true));
        document.getElementById('scoreboard-modal-reset').addEventListener('click', resetStats);
        document.getElementById('scoreboard-content').addEventListener('click', (e) => {
            if (e.target.matches('.details-btn')) {
                toggleDetailsView(e.target.dataset.userId);
            }
        });
    }

    function toggleModal(show) {
        const modalOverlay = document.getElementById('scoreboard-modal-overlay');
        if (show) {
            modalOverlay.classList.add('visible');
            displayDataFromStorage();
        } else {
            modalOverlay.classList.remove('visible');
        }
    }
    
    function createButtonAndAttachListener(anchorElement) {
        if (document.getElementById('scoreboard-trigger')) return;
        const scoreboardBtn = document.createElement('button');
        scoreboardBtn.id = 'scoreboard-trigger';
        scoreboardBtn.className = 'btn btn-primary btn-sm';
        scoreboardBtn.style.margin = '8px 0 0 15px';
        scoreboardBtn.style.float = 'left';
        scoreboardBtn.style.display = 'flex';
        scoreboardBtn.style.alignItems = 'center';
        scoreboardBtn.innerHTML = `📊 Scoreboard <span id="scoreboard-status-indicator"></span>`;
        scoreboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!modalCreated) {
                createModal();
                modalCreated = true;
            }
            toggleModal(true);
        });
        anchorElement.after(scoreboardBtn);
        addStyle(`
            #scoreboard-trigger #scoreboard-status-indicator { margin-left: 8px; font-size: 14px; }
            .status-new::before { content: '●'; color: #43b581; } .status-synced::before { content: '●'; color: #747f8d; }
            #scoreboard-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); z-index: 10000; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
            #scoreboard-modal-overlay.visible { opacity: 1; pointer-events: auto; }
            #scoreboard-modal { background: #2c2f33; color: #fff; padding: 25px; border-radius: 12px; width: 90%; max-width: 800px; max-height: 85vh; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; transform: scale(0.9); transition: transform 0.3s ease; display: flex; flex-direction: column; border-top: 3px solid #7289da; }
            #scoreboard-modal-overlay.visible #scoreboard-modal { transform: scale(1); }
            #scoreboard-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #4a4e54; padding-bottom: 15px; margin-bottom: 20px; }
            #scoreboard-modal-header h2 { margin: 0; font-size: 24px; color: #fff; }
            #scoreboard-modal-close, #scoreboard-modal-refresh, #scoreboard-modal-reset { background: #4a4e54; border: none; color: #fff; font-size: 20px; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; transition: background-color 0.2s ease, transform 0.2s ease; margin-left: 10px; display: flex; justify-content: center; align-items: center; }
            #scoreboard-modal-close:hover, #scoreboard-modal-refresh:hover, #scoreboard-modal-reset:hover { background: #7289da; transform: rotate(90deg); }
            #scoreboard-content { overflow-y: auto; padding-right: 15px; }
            .scoreboard-loader { display: flex; justify-content: center; align-items: center; height: 200px; }
            .loader { border: 5px solid #4a4e54; border-top: 5px solid #7289da; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .stat-card { background: #36393f; padding: 15px 20px; margin-bottom: 12px; border-radius: 8px; border-left: 5px solid #4a4e54; }
            .stat-card.is-own { border-left-color: #7289da !important; }
            .stat-card.rank-1 { border-left-color: #ffd700; } .stat-card.rank-2 { border-left-color: #c0c0c0; } .stat-card.rank-3 { border-left-color: #cd7f32; }
            .stat-card-header { font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .details-btn { background: none; border: none; color: #b9bbbe; cursor: pointer; font-size: 20px; padding: 0 5px; } .details-btn:hover { color: #fff; }
            .details-container { margin-top: 15px; border-top: 1px solid #4a4e54; padding-top: 15px; }
            .details-table-wrapper { max-height: 200px; overflow-y: auto; }
            .details-container table { width: 100%; border-collapse: collapse; }
            .details-container th { text-align: left; padding: 8px; border-bottom: 2px solid #7289da; }
            .details-container td { padding: 8px; border-bottom: 1px solid #4a4e54; }
            .details-container tr:last-child td { border-bottom: none; }
            .details-no-missions { color: #b9bbbe; font-style: italic; }
            .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
            .stat-item { background: #40444b; padding: 10px; border-radius: 5px; } .stat-item-label { font-size: 12px; color: #b9bbbe; text-transform: uppercase; }
            .stat-item-value { font-size: 16px; font-weight: bold; } .stat-item-subvalue { font-size: 13px; color: #b9bbbe; }
        `);
        updateButtonDisplay();
    }

    // --- 5. SKRIPT STARTEN ---
    const initInterval = setInterval(() => {
        if (document.querySelector('a.navbar-brand') && document.getElementById('navbar_profile_link')) {
            clearInterval(initInterval);
            createButtonAndAttachListener(document.querySelector('a.navbar-brand'));
            syncDataInBackground();
            setInterval(syncDataInBackground, REFRESH_INTERVAL);
        }
    }, 500);

})();
