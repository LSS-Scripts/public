// ==UserScript==
// @name         Leitstellenspiel Globaler Online-Status (v4.5 - Entkoppelt)
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Zeigt den Online-Status von Spielern überall auf der Seite an (ignoriert versteckte Elemente).
// @author       Masklin
// @match        https://*.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      leitstellenspiel.de
// ==/UserScript==

(async function() {
    'use strict';

    // === KONFIGURATION ===
    const CACHE_DURATION_MS = 5 * 60 * 1000;
    const MAX_CONCURRENT_REQUESTS = 5;
    // =====================

    // ====================================================================
    // 1. IndexedDB Cache-Helfer
    // ====================================================================
    const CacheDB = {
        DB_NAME: 'LSSStatusCacheDB',
        STORE_NAME: 'userStatus',
        db: null,
        init: function() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.DB_NAME, 1);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                        db.createObjectStore(this.STORE_NAME, { keyPath: 'profileId' });
                    }
                };
                request.onsuccess = (event) => { this.db = event.target.result; resolve(this.db); };
                request.onerror = (event) => { console.error('LSS-Status: IndexedDB Fehler:', event.target.error); reject(event.target.error); };
            });
        },
        loadAll: function() {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => {
                    const cacheObj = {};
                    request.result.forEach(item => { cacheObj[item.profileId] = item; });
                    resolve(cacheObj);
                };
                request.onerror = () => reject(request.error);
            });
        },
        set: function(entry) {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.put(entry);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    };

    // ====================================================================
    // 2. Request-Queue Logik
    // ====================================================================
    let activeRequests = 0;
    const requestQueue = [];
    const pendingRequests = new Set();
    function processQueue() {
        while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
            activeRequests++;
            const { profileId, profileUrl } = requestQueue.shift();
            GM_xmlhttpRequest({
                method: 'GET',
                url: profileUrl,
                onload: async function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const onlineIcon = doc.querySelector('img.online_icon[src*="user_"]');
                        let status = 'offline';
                        if (onlineIcon && onlineIcon.src.includes('user_green.png')) { status = 'online'; }
                        const cacheEntry = { profileId, status, timestamp: Date.now() };
                        statusCache[profileId] = cacheEntry;
                        await CacheDB.set(cacheEntry);
                        updateAllBubblesForId(profileId, status);
                    } catch (e) { updateAllBubblesForId(profileId, 'offline'); }
                    finally { jobFinished(profileId); }
                },
                onerror: function(error) { updateAllBubblesForId(profileId, 'offline'); jobFinished(profileId); },
                ontimeout: function() { updateAllBubblesForId(profileId, 'offline'); jobFinished(profileId); }
            });
        }
    }
    function jobFinished(profileId) {
        activeRequests--;
        pendingRequests.delete(profileId);
        processQueue();
    }
    function updateAllBubblesForId(profileId, status) {
        document.querySelectorAll(`a[href="/profile/${profileId}"]`).forEach(userLink => {
            if(userLink.id === 'navbar_profile_link') return;
            let bubble = userLink.previousSibling;
            if (bubble && bubble.nodeType === Node.ELEMENT_NODE && bubble.classList.contains('chat-status-checking')) {
                bubble.className = `chat-status-bubble chat-status-${status}`;
                bubble.title = status === 'online' ? 'Online' : 'Offline';
            }
            userLink.dataset.statusChecked = 'done';
        });
    }

    // ====================================================================
    // 3. Skript-Hauptlogik
    // ====================================================================

    GM_addStyle(`
        .chat-status-bubble { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: middle; border: 1px solid #555; pointer-events: none; }
        .chat-status-online { background-color: #28a745; border-color: #1e7e34; }
        .chat-status-offline { background-color: #dc3545; border-color: #b21f2d; }
        .chat-status-checking { background-color: #ffc107; border-color: #d39e00; }
        .profile-page-status-bubble { width: 18px; height: 18px; margin-right: 10px; border-width: 2px; vertical-align: middle; margin-top: -2px; }
    `);

    function createStatusBubble(status) {
        const bubble = document.createElement('span');
        bubble.className = `chat-status-bubble chat-status-${status}`;
        bubble.title = status === 'online' ? 'Online' : (status === 'offline' ? 'Offline' : 'Prüfe Status...');
        return bubble;
    }

    function handleProfilePageIcon() {
        if (window.location.pathname.startsWith('/profile/')) {
            const onlineIcon = document.querySelector('img.online_icon[src*="user_"]');
            if (!onlineIcon) return;
            let status = 'offline';
            if (onlineIcon.src.includes('user_green.png')) { status = 'online'; }
            const largeBubble = document.createElement('span');
            largeBubble.className = `chat-status-bubble profile-page-status-bubble chat-status-${status}`;
            largeBubble.title = onlineIcon.title;
            onlineIcon.parentNode.replaceChild(largeBubble, onlineIcon);
        }
    }

    function checkUserStatus(userLink) {

        // NEU: Ignoriere Links, die (wahrscheinlich vom Blocker) versteckt wurden
        if (userLink.offsetParent === null) {
            return;
        }

        // Ausnahme für den Profil-Link in der Navbar
        if (userLink.id === 'navbar_profile_link') {
            if (!userLink.dataset.statusChecked) userLink.dataset.statusChecked = 'ignored_navbar_link';
            return;
        }

        if (userLink.dataset.statusChecked) return;

        const profileHref = userLink.getAttribute('href');
        if (!profileHref || !profileHref.startsWith('/profile/')) {
            userLink.dataset.statusChecked = 'not_profile'; return;
        }
        const profileId = profileHref.split('/').pop();
        if (!/^\d+$/.test(profileId)) {
            userLink.dataset.statusChecked = 'not_profile_id'; return;
        }

        userLink.dataset.statusChecked = 'pending';
        if (statusCache[profileId]) {
            const cachedEntry = statusCache[profileId];
            const age = Date.now() - cachedEntry.timestamp;
            if (age < CACHE_DURATION_MS) {
                userLink.parentNode.insertBefore(createStatusBubble(cachedEntry.status), userLink);
                userLink.dataset.statusChecked = 'done_from_cache'; return;
            }
        }
        if (pendingRequests.has(profileId)) {
            userLink.parentNode.insertBefore(createStatusBubble('checking'), userLink);
            userLink.dataset.statusChecked = 'waiting_for_pending'; return;
        }
        userLink.parentNode.insertBefore(createStatusBubble('checking'), userLink);
        pendingRequests.add(profileId);
        requestQueue.push({ profileId, profileUrl: userLink.href });
        userLink.dataset.statusChecked = 'queued';
        processQueue();
    }

    function processLinksInNode(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // KORREKTUR (P2): Vorherige Bubbles entfernen, falls das "show" Event sie nicht erwischt hat
        // Dies ist eine Absicherung gegen doppelte Bubbles.
        node.querySelectorAll('a[href^="/profile/"]').forEach(link => {
            while (link.previousSibling &&
                   link.previousSibling.nodeType === Node.ELEMENT_NODE &&
                   link.previousSibling.classList.contains('chat-status-bubble'))
            {
                link.previousSibling.parentNode.removeChild(link.previousSibling);
            }
        });

        const links = node.querySelectorAll('a[href^="/profile/"]');
        links.forEach(checkUserStatus);

        if (node.matches('a[href^="/profile/"]')) {
             checkUserStatus(node);
        }
    }

    const globalObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(processLinksInNode);
        });
    });

    // --- START ---

    handleProfilePageIcon();

    await CacheDB.init();
    let statusCache = await CacheDB.loadAll();

    try {
        processLinksInNode(document.body);
    } catch (e) {
        console.error("LSS-Status: Fehler beim initialen Scan.", e);
    }
    globalObserver.observe(document.body, { childList: true, subtree: true });

})();
