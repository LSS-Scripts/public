// ==UserScript==
// @name         Lehrgangsabbrecher
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  Sammelt Links zu Lehrgängen mit 10 freien Plätzen auf Leitstellenspiel.de und ruft deren Abbruch-URLs im Hintergrund auf, mit Fortschrittsanzeige und Einzel-Abbrechfunktion.
// @author       Masklin (Umbau & Fix von Gemini)
// @match        https://www.leitstellenspiel.de/buildings/*
// @match        https://leitstellenspiel.de/buildings/*
// @match        https://missionchief.com/buildings/*
// @match        https://www.missionchief.com/buildings/*
// @match        https://missionchief.co.uk/buildings/*
// @match        https://www.missionchief.co.uk/buildings/*
// @match        https://leitstellenspiel.com/buildings/*
// @match        https://www.leitstellenspiel.com/buildings/*
// @exclude      *://*/*missions*
// @exclude      *://*/*vehicles*
// @exclude      *://*/*patient*
// @exclude      *://*/*alliance*
// @exclude      *://*/*profile*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_info
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // --- Konfiguration ---
    const TARGET_FREE_SLOTS = '10'; // Der Wert für 'freie Plätze', nach dem gesucht wird

    /**
     * Fügt Einzel-Abbrechen-Buttons zu den Lehrgangszeilen hinzu.
     */
    function addSingleCancelAndFinishButtons() {
        const schoolingTabContent = document.getElementById('tab_schooling');
        if (!schoolingTabContent || !schoolingTabContent.classList.contains('active')) {
            return;
        }

        const schoolingTables = schoolingTabContent.querySelectorAll('.building_schooling_table');
        if (schoolingTables.length === 0) {
            return;
        }

        schoolingTables.forEach(table => {
            let headerRow = table.querySelector('thead tr');
            if (headerRow && !headerRow.querySelector('.lss-action-header')) {
                let th = document.createElement('th');
                th.textContent = 'Aktion';
                th.classList.add('lss-action-header');
                th.style.width = '15%'; // Spaltenbreite für Aktionen
                headerRow.appendChild(th);
            }

            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                if (row.querySelector('.lss-action-cell')) {
                    return; // Überspringen, wenn bereits verarbeitet
                }

                const cells = row.querySelectorAll('td');
                if (cells.length < 3) {
                    return;
                }

                const freeSlotsCell = cells[2];
                const linkCell = cells[0];

                // Erstelle immer die Aktions-Zelle, um das Layout nicht zu verschieben
                const actionCell = document.createElement('td');
                actionCell.classList.add('lss-action-cell');
                row.appendChild(actionCell);

                if (freeSlotsCell && freeSlotsCell.getAttribute('sortvalue') === TARGET_FREE_SLOTS) {
                    const linkElement = linkCell.querySelector('a');
                    if (linkElement && linkElement.href) {
                        const match = linkElement.href.match(/\/schoolings\/(\d+)/);
                        if (match && match[1]) {
                            const schoolingId = match[1];

                            const cancelButton = document.createElement('button');
                            cancelButton.textContent = 'Abbrechen';
                            cancelButton.classList.add('btn', 'btn-xs', 'btn-danger', 'lss-cancel-single-btn');
                            cancelButton.style.width = '100%';

                            cancelButton.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelButton.textContent = 'Breche ab...';
                                cancelButton.disabled = true;
                                GM_xmlhttpRequest({
                                    method: "GET",
                                    url: `https://www.leitstellenspiel.de/schoolings/${schoolingId}/education/cancel`,
                                    onload: function(response) {
                                        if (response.status === 200) {
                                            row.style.backgroundColor = '#dff0d8'; // Grün für Erfolg
                                            cancelButton.textContent = 'Abgebrochen';
                                            cancelButton.classList.remove('btn-danger');
                                            cancelButton.classList.add('btn-success');
                                        } else {
                                            row.style.backgroundColor = '#f2dede'; // Rot für Fehler
                                            cancelButton.textContent = 'Fehler';
                                        }
                                    },
                                    onerror: function() {
                                        row.style.backgroundColor = '#f2dede';
                                        cancelButton.textContent = 'Netzwerkfehler';
                                    }
                                });
                            });
                            actionCell.appendChild(cancelButton);
                        }
                    }
                }
            });
        });
    }

    // --- Skript-Start und Beobachtung ---
    if (window.top === window.self && window.location.pathname.startsWith('/buildings/')) {
        const tabContentContainer = document.querySelector('.tab-content');

        if (tabContentContainer) {
            const observer = new MutationObserver(() => {
                // Bei jeder Änderung im Tab-Container prüfen wir, ob die Buttons hinzugefügt werden müssen.
                addSingleCancelAndFinishButtons();
            });

            observer.observe(tabContentContainer, { childList: true, subtree: true });

            // Führe die Funktion einmal initial aus, falls der Inhalt schon da ist.
            addSingleCancelAndFinishButtons();
        }
    }
})();
