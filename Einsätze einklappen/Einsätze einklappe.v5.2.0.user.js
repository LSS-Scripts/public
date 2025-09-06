// ==UserScript==
// @name         Einsätze einklappen (Angepasste Version)
// @namespace    http://tampermonkey.net/
// @version      5.2.0
// @description  Platziert Einklappen-Knöpfe links in der Einsatzzeile und einen "Alle umschalten"-Knopf in der Hauptleiste. Verhindert Zeilenumbrüche korrekt.
// @author       Masklin & Gemini & Hendrik
// @match        https://www.leitstellenspiel.de/
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[LSS Collapse] Skript V5.2 wird geladen.');

    // 1. CSS-Stile
    GM_addStyle(`
        /* Versteckt den Einsatz-Inhalt */
        .mission-collapsed .panel-body { display: none !important; }
        .collapse-button-tm { margin-right: 4px !important; }
        #toggleAllMissionsBtn-tm { margin-right: 5px !important; }

        /* --- Layout für den Header --- */
        div[id^="mission_"] .panel-heading {
            display: flex !important;
            align-items: center;
            gap: 4px;
        }

        /* --- NEU: Wrapper für Titel und Adresse --- */
        /* Dieser Container nimmt den verfügbaren Platz ein */
        .mission-text-wrapper {
            flex-grow: 1;
            min-width: 0;
            line-height: 1.2; /* Verringert den Zeilenabstand etwas */
        }

        /* --- NEU: Regeln für Titel und Adresse getrennt --- */
        /* Beide Zeilen werden bei Bedarf mit "..." gekürzt */
        .mission-text-wrapper > a,
        .mission-text-wrapper > small {
            display: block; /* Stellt sicher, dass sie untereinander stehen */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* --- Blendet die Adresse im eingeklappten Zustand aus --- */
        .mission-collapsed .mission-text-wrapper > small {
            display: none;
        }
    `);

    // 2. Funktion für den Knopf am einzelnen Einsatz
    const addCollapseButton = (missionNode) => {
        const alarmButton = missionNode.querySelector('.mission-alarm-button');
        const heading = missionNode.querySelector('.panel-heading');
        if (!alarmButton || !heading || heading.querySelector('.collapse-button-tm')) return;

        const missionPanel = missionNode.querySelector('.panel');
        if (!missionPanel) return;

        const collapseBtn = document.createElement('a');
        collapseBtn.innerHTML = '🤏';
        collapseBtn.title = 'Einklappen/Ausklappen';
        collapseBtn.className = 'btn btn-default btn-xs collapse-button-tm';
        collapseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            missionPanel.classList.toggle('mission-collapsed');
            collapseBtn.innerHTML = missionPanel.classList.contains('mission-collapsed') ? '📖' : '🤏';
        });
        heading.insertBefore(collapseBtn, alarmButton);

        // --- HIER IST DIE NEUE LOGIK IM JAVASCRIPT ---
        // Passt die HTML-Struktur an, um Titel und Adresse zu trennen
        const missionCaptionLink = heading.querySelector('a[id^="mission_caption"]');
        const missionAddressSmall = missionCaptionLink ? missionCaptionLink.querySelector('small') : null;

        // Nur ausführen, wenn die Struktur noch nicht angepasst wurde
        if (missionCaptionLink && missionAddressSmall && !heading.querySelector('.mission-text-wrapper')) {
            // 1. Einen neuen Container (div) für Text erstellen
            const textWrapper = document.createElement('div');
            textWrapper.className = 'mission-text-wrapper';

            // 2. Den Container vor dem originalen Link einfügen
            heading.insertBefore(textWrapper, missionCaptionLink);

            // 3. Den Link und die Adresse in den neuen Container VERSCHIEBEN
            textWrapper.appendChild(missionCaptionLink);
            textWrapper.appendChild(missionAddressSmall); // Dieser Befehl entfernt die Adresse automatisch aus dem Link
        }
    };

    // 3. Funktion für den "Alle umschalten"-Knopf
    const addToggleAllButton = (mainPanel) => {
        if (document.getElementById('toggleAllMissionsBtn-tm')) return;
        const filterControl = mainPanel.querySelector('.filters-display-control');
        if (!filterControl) return;

        const toggleAllBtn = document.createElement('a');
        toggleAllBtn.id = 'toggleAllMissionsBtn-tm';
        toggleAllBtn.innerHTML = 'Alle 🤏/📖';
        toggleAllBtn.title = 'Alle Einsätze umschalten';
        toggleAllBtn.className = 'btn btn-default btn-xs';
        toggleAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const missions = document.querySelectorAll('#mission_list > .missionSideBarEntry');
            const shouldCollapse = Array.from(missions).some(m => !m.querySelector('.panel').classList.contains('mission-collapsed'));
            missions.forEach(missionNode => {
                const panel = missionNode.querySelector('.panel');
                const btn = missionNode.querySelector('.collapse-button-tm');
                if (panel) panel.classList.toggle('mission-collapsed', shouldCollapse);
                if (btn) btn.innerHTML = shouldCollapse ? '📖' : '🤏';
            });
        });
        filterControl.insertAdjacentElement('beforebegin', toggleAllBtn);
    };

    // 4. Der Observer, der alles steuert
    const observer = new MutationObserver(()_ => {
        const mainPanel = document.getElementById('missions-panel-main');
        if (mainPanel) addToggleAllButton(mainPanel);

        document.querySelectorAll('div[id^="mission_"]:not([data-collapse-processed])').forEach(node => {
            if (node.matches('div[id^="mission_"]:not([id*="panel"]):not([id*="caption"]):not([id*="address"])')) {
                addCollapseButton(node);
                node.setAttribute('data-collapse-processed', 'true');
            }
        });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
