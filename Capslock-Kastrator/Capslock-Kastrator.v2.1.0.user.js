// ==UserScript==
// @name         Capslock-Kastrator (Erweitert V2)
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Wandelt im LSS-Verbandschat Namen und Nachrichten, die übermäßig in Großbuchstaben geschrieben sind, in eine lesbarere Form um und kürzt Wortlängungen.
// @author       B&M (Erweiterung durch Gemini)
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

    // Funktion zum Verarbeiten des Nachrichteninhalts (angepasst)
    const processMessageContent = (messageListItem) => {
        for (let i = messageListItem.childNodes.length - 1; i >= 0; i--) {
            const node = messageListItem.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                const originalMessage = node.textContent;
                const words = originalMessage.split(' ');

                const newMessage = words.map(word => {
                    if (word.length > 4 && word === word.toUpperCase() && !/^\d+$/.test(word)) {
                        let processedWord = word.charAt(0) + word.slice(1).toLowerCase();
                        // NEUE ÄNDERUNG HIER: Ersetze 3 oder mehr gleiche aufeinanderfolgende Buchstaben durch einen einzigen.
                        // Aus "Ohaaaaaaaaaa" wird "Oha".
                        return processedWord.replace(/([a-zA-Z])\1{2,}/g, '$1');
                    }
                    return word;
                }).join(' ');

                node.textContent = newMessage;
                break;
            }
        }
    };

    // Die Funktion, die alle bereits geladenen Nachrichten prüft (unverändert)
    const checkAllExistingMessages = () => {
        const messages = document.querySelectorAll('#mission_chat_messages > li');
        messages.forEach(message => {
            const userLink = message.querySelector('.chat-username');
            if (userLink) {
                processUsername(userLink);
            }
            processMessageContent(message);
        });
    };

    // Der MutationObserver für neue Nachrichten (unverändert)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.tagName === 'LI') {
                        const userLink = node.querySelector('.chat-username');
                        if (userLink) {
                            processUsername(userLink);
                        }
                        processMessageContent(node);
                    }
                });
            }
        });
    });

    // Warten, bis der Chat-Container geladen ist (unverändert)
    const initInterval = setInterval(() => {
        const chatContainer = document.getElementById('mission_chat_messages');
        if (chatContainer) {
            clearInterval(initInterval);
            checkAllExistingMessages();
            observer.observe(chatContainer, { childList: true, subtree: true });
        }
    }, 250);

})();
