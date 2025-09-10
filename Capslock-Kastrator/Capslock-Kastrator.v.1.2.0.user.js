// ==UserScript==
// @name         Capslock-Kastrator
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Wandelt im LSS-Verbandschat Namen, die komplett in Großbuchstaben geschrieben sind, in Kleinbuchstaben um.
// @author       B&M
// @match        https://*.leitstellenspiel.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Die Funktion zum Verarbeiten der Namen (unverändert)
    const processUsername = (userLink) => {
        const originalText = userLink.textContent;
        const username = originalText.slice(0, -1);
        if (username.length > 2 && username === username.toUpperCase() && !/^\d+$/.test(username)) {
            userLink.textContent = username.toLowerCase() + ':';
        }
    };

    // Die Funktion, die alle bereits geladenen Nachrichten prüft (unverändert)
    const checkAllUsernames = () => {
        const userLinks = document.querySelectorAll('#mission_chat_messages .chat-username');
        userLinks.forEach(processUsername);
    };

    // Der MutationObserver für neue Nachrichten (unverändert)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const userLink = node.querySelector('.chat-username');
                        if (userLink) {
                            processUsername(userLink);
                        }
                    }
                });
            }
        });
    });

    // NEU: Statt eines festen Timers, wird aktiv gewartet, bis der Chat da ist.
    const initInterval = setInterval(() => {
        const chatContainer = document.getElementById('mission_chat_messages');
        // Wenn der Chat-Container gefunden wurde...
        if (chatContainer) {
            // ...stoppen wir das Intervall, damit es nicht ewig läuft.
            clearInterval(initInterval);
            // Führen die Aktionen aus, die vorher im Timer waren.
            checkAllUsernames();
            observer.observe(chatContainer, { childList: true });
        }
    }, 250); // Prüft alle 250 Millisekunden, ob der Chat da ist.

})();
