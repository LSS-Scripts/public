// ==UserScript==
// @name         Leitstellenspiel Globaler Online-Status (v4.0 - IndexedDB & Queue)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Zeigt den Online-Status von Spielern überall an (mit IndexedDB-Cache & 5 parallelen Anfragen)
// @author       DeinName (angepasst von Gemini)
// @match        https://*.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      leitstellenspiel.de
// ==/UserScript==

// Wir packen alles in eine 'async' Funktion,
// damit wir 'await' für die Datenbank nutzen können.
(async function() {
    'use strict';

    // === KONFIGURATION ===
    const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 Minuten
    const MAX_CONCURRENT_REQUESTS = 5;       // Max. 5 parallele Abfragen
    // =====================


    // ====================================================================
    // 1. IndexedDB Cache-Helfer
    //    Ein kleiner Wrapper für IndexedDB, um das Ganze lesbar zu halten.
    // ====================================================================
    const CacheDB = {
        DB_NAME: 'LSSStatusCacheDB',
        STORE_NAME: 'userStatus',
        db: null,

        /**
         * Öffnet (oder erstellt) die IndexedDB.
         */
        init: function() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.DB_NAME, 1);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                        db.createObjectStore(this.STORE_NAME, { keyPath: 'profileId' });
                    }
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(this.db);
                };

                request.onerror = (event) => {
                    console.error('LSS-Status: IndexedDB Fehler:', event.target.error);
                    reject(event.target.error);
                };
            });
        },

        /**
         * Lädt den *gesamten* Cache aus der DB in ein Objekt.
         * Das machen wir einmal beim Start, um schnellen Zugriff im RAM zu haben.
         */
        loadAll: function() {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject('DB not initialized');
                const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.getAll();

                request.onsuccess = () => {
                    const cacheObj = {};
                    request.result.forEach(item => {
                        cacheObj[item.profileId] = item;
                    });
                    resolve(cacheObj);
                };
                request.onerror = () => reject(request.error);
            });
        },

        /**
         * Speichert einen einzelnen Eintrag in der DB.
         * @param {object} entry - { profileId, status, timestamp }
         */
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
    //    Verwaltet die Warteschlange für parallele Anfragen
    // ====================================================================
    let activeRequests = 0;
    const requestQueue = [];        // Warteschlange: [{ profileId, profileUrl }]
    const pendingRequests = new Set(); // IDs, die gerade ODER in der Queue sind: Set('123', '456')


    /**
     * Verarbeitet die Warteschlange.
     * Wird aufgerufen, wenn ein Job hinzugefügt wird oder einer fertig ist.
     */
    function processQueue() {
        while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
            activeRequests++;
            const { profileId, profileUrl } = requestQueue.shift(); // Job aus der Queue nehmen

            // Führe die eigentliche Anfrage aus
            GM_xmlhttpRequest({
                method: 'GET',
                url: profileUrl,
                onload: async function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const onlineIcon = doc.querySelector('img.online_icon[src*="user_"]');

                        let status = 'offline';
                        if (onlineIcon && onlineIcon.src.includes('user_green.png')) {
                            status = 'online';
                        }

                        // Status im Cache (RAM & DB) speichern
                        const cacheEntry = { profileId, status, timestamp: Date.now() };
                        statusCache[profileId] = cacheEntry;
                        await CacheDB.set(cacheEntry);

                        // UI für *alle* Links dieses Users aktualisieren
                        updateAllBubblesForId(profileId, status);

                    } catch (e) {
                        console.error('LSS-Status: Fehler beim Parsen:', e);
                        updateAllBubblesForId(profileId, 'offline'); // Im Fehlerfall als offline markieren
                    } finally {
                        // Job ist fertig, egal ob Erfolg oder Fehler
                        jobFinished(profileId);
                    }
                },
                onerror: function(error) {
                    console.error('LSS-Status: Fehler beim Abrufen:', error);
                    updateAllBubblesForId(profileId, 'offline');
                    jobFinished(profileId);
                },
                ontimeout: function() {
                    console.error('LSS-Status: Timeout beim Abrufen:', profileUrl);
                    updateAllBubblesForId(profileId, 'offline');
                    jobFinished(profileId);
                }
            });
        }
    }

    /**
     * Hilfsfunktion, die aufräumt, wenn ein Job fertig ist.
     */
    function jobFinished(profileId) {
        activeRequests--;
        pendingRequests.delete(profileId);
        processQueue(); // Nächsten Job aus der Queue starten
    }

    /**
     * Aktualisiert *alle* Bubbles für eine bestimmte User-ID auf der Seite.
     * Wichtig, da ein User mehrfach verlinkt sein kann.
     */
    function updateAllBubblesForId(profileId, status) {
        // Finde alle Links zu diesem Profil
        document.querySelectorAll(`a[href="/profile/${profileId}"]`).forEach(userLink => {
            // Finde den "checking" Bubbel *davor*
            let bubble = userLink.previousSibling;
            if (bubble && bubble.nodeType === Node.ELEMENT_NODE && bubble.classList.contains('chat-status-checking')) {
                // Update den Bubbel
                bubble.className = `chat-status-bubble chat-status-${status}`;
                bubble.title = status === 'online' ? 'Online' : 'Offline';
            }
            userLink.dataset.statusChecked = 'done';
        });
    }


    // ====================================================================
    // 3. Skript-Hauptlogik
    // ====================================================================

    // CSS-Stile hinzufügen
    GM_addStyle(`
        .chat-status-bubble {
            display: inline-block; width: 10px; height: 10px;
            border-radius: 50%; margin-right: 5px; vertical-align: middle;
            border: 1px solid #555; pointer-events: none;
        }
        .chat-status-online { background-color: #28a745; border-color: #1e7e34; }
        .chat-status-offline { background-color: #dc3545; border-color: #b21f2d; }
        .chat-status-checking { background-color: #ffc107; border-color: #d39e00; }
    `);

    // Erstelle Bubbel-Element
    function createStatusBubble(status) {
        const bubble = document.createElement('span');
        bubble.className = `chat-status-bubble chat-status-${status}`;
        bubble.title = status === 'online' ? 'Online' : (status === 'offline' ? 'Offline' : 'Prüfe Status...');
        return bubble;
    }

    // --- Start des Skripts ---

    // 1. Datenbank initialisieren
    await CacheDB.init();

    // 2. Cache aus DB in den RAM laden für schnellen Zugriff
    let statusCache = await CacheDB.loadAll();

    /**
     * Kernfunktion: Prüft einen einzelnen Link, den der Observer findet.
     * Diese Funktion ruft *nicht* mehr GM_xmlhttpRequest auf, sondern fügt
     * den Job nur noch der Warteschlange hinzu.
     */
    function checkUserStatus(userLink) {
        if (userLink.dataset.statusChecked) {
            return;
        }

        const profileHref = userLink.getAttribute('href');
        if (!profileHref || !profileHref.startsWith('/profile/')) {
            userLink.dataset.statusChecked = 'not_profile';
            return;
        }

        const profileId = profileHref.split('/').pop();
        if (!/^\d+$/.test(profileId)) {
            userLink.dataset.statusChecked = 'not_profile_id';
            return;
        }

        userLink.dataset.statusChecked = 'pending'; // Markieren als "in Bearbeitung"

        // 4. Cache-Prüfung
        if (statusCache[profileId]) {
            const cachedEntry = statusCache[profileId];
            const age = Date.now() - cachedEntry.timestamp;

            if (age < CACHE_DURATION_MS) {
                // Cache ist gültig!
                userLink.parentNode.insertBefore(createStatusBubble(cachedEntry.status), userLink);
                userLink.dataset.statusChecked = 'done_from_cache';
                return;
            }
        }

        // 5. Job-Prüfung
        // Ist dieser User *bereits* in der Queue oder wird gerade abgefragt?
        if (pendingRequests.has(profileId)) {
            // Ja -> Nur "checking" Bubbel setzen und warten, bis
            // updateAllBubblesForId() von dem laufenden Job aufgerufen wird.
            userLink.parentNode.insertBefore(createStatusBubble('checking'), userLink);
            userLink.dataset.statusChecked = 'waiting_for_pending';
            return;
        }

        // 6. Neu zur Queue hinzufügen
        // "checking" Bubbel setzen
        userLink.parentNode.insertBefore(createStatusBubble('checking'), userLink);

        // Job blockieren und zur Queue hinzufügen
        pendingRequests.add(profileId);
        requestQueue.push({ profileId, profileUrl: userLink.href });
        userLink.dataset.statusChecked = 'queued';

        // Queue-Verarbeitung anstoßen
        processQueue();
    }

    /**
     * Verarbeitet alle Links in einem neuen Knoten
     */
    function processLinksInNode(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const links = node.querySelectorAll('a[href^="/profile/"]');
        links.forEach(checkUserStatus);

        if (node.matches('a[href^="/profile/"]')) {
             checkUserStatus(node);
        }
    }

    // 5. Globaler MutationObserver, der auf *alle* Änderungen im body wartet
    const globalObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(processLinksInNode);
        });
    });

    // 6. Starte das Skript
    // 6.1. Verarbeite alle Links, die *bereits* beim Laden auf der Seite sind
    try {
        processLinksInNode(document.body);
    } catch (e) {
        console.error("LSS-Status: Fehler beim initialen Scan.", e);
    }

    // 6.2. Beobachte die gesamte Seite für *neue* Elemente
    globalObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // console.log('LSS Globaler Online-Status-Observer (v4.0) ist aktiv. Cache geladen.');

})();
