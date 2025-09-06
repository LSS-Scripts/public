// ==UserScript==
// @name         Einsätze einklappen (Angepasste Version)
// @namespace    http://tampermonkey.net/
// @version      5.1.0
// @description  Platziert Einklappen-Knöpfe links in der Einsatzzeile und einen "Alle umschalten"-Knopf in der Hauptleiste. Verhindert Zeilenumbrüche.
// @author       Masklin & Gemini & Hendrik
// @match        https://www.leitstellenspiel.de/
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[LSS Collapse] Skript V5.1 wird geladen.');

    // 1. CSS-Stile anpassen (HIER SIND DIE ÄNDERUNGEN)
    GM_addStyle(`
        /* Versteckt den Einsatz-Inhalt */
        .mission-collapsed .panel-body {
            display: none !important;
        }
        /* Abstand für den Knopf links vom Alarm-Button */
        .collapse-button-tm {
            margin-right: 4px !important;
        }
        /* Abstand für den "Alle umschalten"-Knopf */
        #toggleAllMissionsBtn-tm {
            margin-right: 5px !important;
        }

        /* --- NEU: Verhindert den Zeilenumbruch im Header --- */
        div[id^="mission_"] .panel-heading {
            display: flex !important; /* Ordnet alle Elemente (Knöpfe, Text, Uhrzeit) in einer Reihe an */
            align-items: center; /* Zentriert alles vertikal für eine saubere Optik */
            gap: 4px; /* Kleiner Abstand zwischen den Elementen */
        }

        /* --- NEU: Kürzt zu langen Text mit "..." --- */
        a[id^="mission_caption"] {
            white-space: nowrap; /* Verhindert den Umbruch innerhalb des Links */
            overflow: hidden; /* Versteckt überstehenden Text */
            text-overflow: ellipsis; /* Fügt "..." am Ende hinzu */
            flex-grow: 1; /* Der Link füllt den verfügbaren Platz */
            min-width: 0; /* Wichtiger Trick, damit das Kürzen zuverlässig funktioniert */
        }

        /* --- NEU: Blendet die Adresse im eingeklappten Zustand aus --- */
        .mission-collapsed a[id^="mission_caption"] small {
            display: none;
        }
    `);

    // 2. Funktion für den Knopf am einzelnen Einsatz (jetzt LINKS)
    const addCollapseButton = (missionNode) => {
        const alarmButton = missionNode.querySelector('.mission-alarm-button');
        const heading = missionNode.querySelector('.panel-heading');

        if (!alarmButton || !heading || heading.querySelector('.collapse-button-tm')) {
            return;
        }

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
    };

    // 3. Funktion für den "Alle umschalten"-Knopf (neue Position)
    const addToggleAllButton = (mainPanel) => {
        if (document.getElementById('toggleAllMissionsBtn-tm')) return;

        const filterControl = mainPanel.querySelector('.filters-display-control');
        if (!filterControl) return;

        console.log('[LSS Collapse] "Alle umschalten"-Knopf wird hinzugefügt.');

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
    const observer = new MutationObserver(() => {
        const mainPanel = document.getElementById('missions-panel-main');
        if (mainPanel) {
            addToggleAllButton(mainPanel);
        }

        document.querySelectorAll('div[id^="mission_"]:not([data-collapse-processed])').forEach(node => {
            if (node.matches('div[id^="mission_"]:not([id*="panel"]):not([id*="caption"]):not([id*="address"])')) {
                addCollapseButton(node);
                node.setAttribute('data-collapse-processed', 'true');
            }
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
})();
