// ==UserScript==
// @name         Leitstellenspiel Patient Entlassen
// @namespace    http://tampermonkey.net/
// @version      0.91
// @description  Stellt die korrekte, detaillierte ELW-SEG-Prüfung (Anfahrt/Vor Ort) wieder her.
// @author       Gemini & Bearbeitungen
// @match        https://www.leitstellenspiel.de/missions/*
// @grant        GM.xmlHttpRequest
// @run-at       document-start
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/537616/Leitstellenspiel%20Patient%20Entlassen.user.js
// @updateURL https://update.greasyfork.org/scripts/537616/Leitstellenspiel%20Patient%20Entlassen.meta.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('LSS Patient Entlassen Skript geladen (Version 0.91).');

    let checkPerformed = false;

    /**
     * Hauptfunktion zur Verarbeitung der Sprechwünsche.
     */
    async function processPatientRelease(targetTable) {
        if (!targetTable) return;

        const rows = targetTable.querySelectorAll('tr[id^="vehicle_row_"]');
        const collectedLinksByUser = {};
        const allUniqueOwners = new Set();

        rows.forEach(row => {
            const fmsCell = row.querySelector('span.building_list_fms.building_list_fms_5');
            if (fmsCell) {
                const vehicleLink = row.querySelector('td:nth-child(2) a');
                const ownerLink = row.querySelector('td:nth-child(5) a');
                if (vehicleLink && vehicleLink.href) {
                    const ownerName = (ownerLink && ownerLink.textContent) ? ownerLink.textContent.trim() : 'Unbekannt';
                    allUniqueOwners.add(ownerName);
                    const match = vehicleLink.href.match(/\/vehicles\/(\d+)/);
                    if (match && match[1]) {
                        if (!collectedLinksByUser[ownerName]) collectedLinksByUser[ownerName] = { links: [] };
                        collectedLinksByUser[ownerName].links.push({
                            patientRelease: `https://www.leitstellenspiel.de/vehicles/${match[1]}/patient/-1`,
                            vehiclePage: vehicleLink.href
                        });
                    }
                }
            }
        });

        const userNames = Object.keys(collectedLinksByUser);
        const totalLinksToProcess = userNames.reduce((acc, name) => acc + collectedLinksByUser[name].links.length, 0);
        if (totalLinksToProcess === 0) {
            showCustomModal('Keine passenden Sprechwünsche (FMS 5) zum Entlassen gefunden.');
            return;
        }

        showCustomModal(`Prüfe ${totalLinksToProcess} Sprechwünsche...`, true);

        const preCheckDetails = {};
        allUniqueOwners.forEach(ownerName => {
            preCheckDetails[ownerName] = {
                totalFMS5: collectedLinksByUser[ownerName] ? collectedLinksByUser[ownerName].links.length : 0,
                foundButton: 0,
                // KORREKTUR: Wiederherstellung der detaillierten Status
                hasElwSegOnRoute: false,
                hasElwSegOnScene: false
            };
        });

        // KORREKTUR: Wiederherstellung der getrennten ELW-SEG Prüfungen
        // Prüfung 1: Fahrzeuge auf Anfahrt
        const drivingTable = document.getElementById('mission_vehicle_driving');
        if (drivingTable) {
            drivingTable.querySelectorAll('tr a[vehicle_type_id="59"]').forEach(elwLink => {
                const ownerLink = elwLink.closest('tr')?.querySelector('a[href*="/profile/"]');
                if (ownerLink && ownerLink.textContent) {
                    const ownerName = ownerLink.textContent.trim();
                    allUniqueOwners.add(ownerName);
                    if (!preCheckDetails[ownerName]) {
                         preCheckDetails[ownerName] = { totalFMS5: 0, foundButton: 0, hasElwSegOnRoute: false, hasElwSegOnScene: false };
                    }
                    preCheckDetails[ownerName].hasElwSegOnRoute = true;
                }
            });
        }

        // Prüfung 2: Fahrzeuge vor Ort
        const atMissionTable = document.getElementById('mission_vehicle_at_mission');
        if (atMissionTable) {
            atMissionTable.querySelectorAll('tr a[vehicle_type_id="59"]').forEach(elwLink => {
                const ownerLink = elwLink.closest('tr')?.querySelector('a[href*="/profile/"]');
                if (ownerLink && ownerLink.textContent) {
                    const ownerName = ownerLink.textContent.trim();
                    allUniqueOwners.add(ownerName);
                    if (!preCheckDetails[ownerName]) {
                         preCheckDetails[ownerName] = { totalFMS5: 0, foundButton: 0, hasElwSegOnRoute: false, hasElwSegOnScene: false };
                    }
                    preCheckDetails[ownerName].hasElwSegOnScene = true;
                }
            });
        }


        let preCheckFoundButtons = 0;
        for (const userName of userNames) {
            for (const linkData of collectedLinksByUser[userName].links) {
                try {
                    const response = await fetch(linkData.vehiclePage);
                    if (response.ok) {
                        const htmlText = await response.text();
                        if (htmlText.includes('/patient/-1')) {
                            preCheckDetails[userName].foundButton++;
                            preCheckFoundButtons++;
                        }
                    }
                } catch (e) { /* Fehler bei Fetch ignorieren */ }
            }
        }

        const getSprechwunschText = count => count === 1 ? 'Sprechwunsch' : 'Sprechwünsche';
        let confirmationMessage = `Es wurden ${totalLinksToProcess} ${getSprechwunschText(totalLinksToProcess)} (FMS 5) gefunden.\n\n` +
                                  `Bereit zum Entlassen: <b>${preCheckFoundButtons} ${getSprechwunschText(preCheckFoundButtons)}</b>\n\n`;

        let hasElwSegFoundOverall = false;
        Array.from(allUniqueOwners).sort().forEach(userName => {
            const details = preCheckDetails[userName];
            if (!details || (details.totalFMS5 === 0 && !details.hasElwSegOnRoute && !details.hasElwSegOnScene)) return;

            let userSummaryLine = `@${userName}: `;
            if (details.totalFMS5 > 0) {
                userSummaryLine += `${details.totalFMS5} ${getSprechwunschText(details.totalFMS5)} (${details.foundButton} entlassbar)`;
            } else {
                userSummaryLine += `Keine FMS 5 Sprechwünsche`;
            }

            // KORREKTUR: Wiederherstellung der detaillierten Anzeige-Logik
            if ((details.hasElwSegOnRoute || details.hasElwSegOnScene) && details.totalFMS5 > 0) {
                hasElwSegFoundOverall = true;
                let elwStatus = '';
                if (details.hasElwSegOnRoute && details.hasElwSegOnScene) {
                    elwStatus = 'Auf Anfahrt & Vor Ort';
                } else if (details.hasElwSegOnRoute) {
                    elwStatus = 'Auf Anfahrt';
                } else {
                    elwStatus = 'Vor Ort';
                }
                userSummaryLine += ` (<span style="color:red; font-weight:bold;">ELW-SEG: ${elwStatus}</span>)`;
            }
            confirmationMessage += `${userSummaryLine}\n`;
        });

        const performReleaseActions = async () => {
            showCustomModal(`Verarbeite ${preCheckFoundButtons} ${getSprechwunschText(preCheckFoundButtons)}...`, true);
            let processedCount = 0;
            for (const userName of userNames) {
                for (const linkData of collectedLinksByUser[userName].links) {
                    try {
                        await fetch(linkData.patientRelease);
                        processedCount++;
                    } catch (e) { /* Fehler ignorieren */ }
                }
            }
            showCustomModal(`<b>Verarbeitung abgeschlossen:</b>\n${processedCount} von ${totalLinksToProcess} Sprechwünschen bearbeitet.`);
        };

        const firstModalConfirmCallback = preCheckFoundButtons > 0 ? () => {
            if (hasElwSegFoundOverall) {
                showCustomModal(`<b>Achtung:</b> Ein ELW-SEG ist am Einsatz beteiligt. Patienten trotzdem entlassen?`, false, performReleaseActions, 'Ja, trotzdem entlassen', 'Abbrechen');
            } else {
                performReleaseActions();
            }
        } : null;

        showCustomModal(confirmationMessage, false, firstModalConfirmCallback, 'Entlassung starten');
    }

    /**
     * Erstellt und platziert den Button auf der Seite.
     */
    function setupButton(targetTable, placementTarget) {
        if (checkPerformed) return;
        checkPerformed = true;

        let foundFMS5Vehicles = false;
        const rows = targetTable.querySelectorAll('tr[id^="vehicle_row_"]');
        for (const row of rows) {
            if (row.querySelector('span.building_list_fms.building_list_fms_5')) {
                foundFMS5Vehicles = true;
                break;
            }
        }

        if (foundFMS5Vehicles) {
            const button = document.createElement('button');
            button.id = 'sprechwuenscheEntlassenButton';
            button.textContent = 'Sprechwünsche gesammelt entlassen';
            button.className = 'btn btn-success';
            button.style.cssText = `margin: 10px 0; display: block; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);`;
            button.addEventListener('click', () => processPatientRelease(targetTable));

            if (placementTarget.querySelector('br')) {
                placementTarget.insertBefore(button, placementTarget.querySelector('br'));
            } else {
                placementTarget.appendChild(document.createElement('br'));
                placementTarget.appendChild(button);
            }
        }
    }

    /**
     * Zeigt ein modales Fenster an.
     */
    function showCustomModal(message, showLoadingSpinner = false, confirmCallback = null, confirmButtonText = 'OK', cancelButtonText = 'Schließen') {
        let styleTagAdded = document.getElementById('lss-modal-style');
        if (!styleTagAdded) {
            const style = document.createElement('style');
            style.id = 'lss-modal-style';
            style.textContent = `.lss-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10001; } .lss-modal-content { background: #fff; color: #333; padding: 20px; border-radius: 5px; min-width: 300px; max-width: 500px; text-align: center; } .lss-modal-content p { text-align: left; white-space: pre-wrap; } .lss-modal-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }`;
            document.head.appendChild(style);
        }

        const existingModal = document.getElementById('customLSSModal');
        if (existingModal) existingModal.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'customLSSModal';
        modalOverlay.className = 'lss-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.className = 'lss-modal-content';
        const messageP = document.createElement('p');
        messageP.innerHTML = message;
        modalContent.appendChild(messageP);

        if (showLoadingSpinner) {
            const spinner = document.createElement('div');
            spinner.style.cssText = `border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto 0;`;
            modalContent.appendChild(spinner);
        } else {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'lss-modal-buttons';
            const closeBtn = document.createElement('button');
            closeBtn.textContent = cancelButtonText;
            closeBtn.className = 'btn btn-default';
            closeBtn.onclick = () => modalOverlay.remove();
            btnContainer.appendChild(closeBtn);
            if (confirmCallback) {
                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = confirmButtonText;
                confirmBtn.className = 'btn btn-success';
                confirmBtn.onclick = () => { modalOverlay.remove(); confirmCallback(); };
                btnContainer.appendChild(confirmBtn);
            }
            modalContent.appendChild(btnContainer);
        }
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }

    /**
     * Startlogik, die wartet, bis alle Bedingungen erfüllt sind.
     */
    function initializeScript() {
        let attempts = 0;
        const maxAttempts = 40; // 20 Sekunden

        const interval = setInterval(() => {
            if (checkPerformed || attempts++ > maxAttempts) {
                clearInterval(interval);
                return;
            }

            const targetTable = document.getElementById('mission_vehicle_at_mission');
            let sprechwunschBanner = null;

            if (targetTable) {
                 document.querySelectorAll('div.alert.alert-danger').forEach(alertDiv => {
                    if (alertDiv.textContent.includes('Sprechwunsch')) {
                        sprechwunschBanner = alertDiv;
                    }
                });
            }

            if (targetTable && sprechwunschBanner) {
                clearInterval(interval);
                setupButton(targetTable, sprechwunschBanner);
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript);
    } else {
        initializeScript();
    }

})();
