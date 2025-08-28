// ==UserScript==
// @name         Leitstellenspiel Patient Entlassen
// @namespace    http://tampermonkey.net/
// @version      0.8.3
// @description  Behebt einen Syntaxfehler (catch without try) und stellt die Funktionalität wieder her.
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

    console.log('LSS Patient Entlassen Skript geladen (Version 0.83).');

    let buttonSetupCompleted = false;
    let styleTagAdded = false;
    let checkPerformed = false;

    /**
     * Formatiert eine Anzahl von Sekunden in das MM:SS Format.
     * @param {number} totalSeconds Die Gesamtzahl der Sekunden.
     * @returns {string} Die formatierte Zeit als MM:SS.
     */
    function formatSecondsToMMSS(totalSeconds) {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            return 'N/A';
        }
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Konvertiert eine Zeit im MM:SS Format in Sekunden.
     * @param {string} mmssString Die Zeit als MM:SS String.
     * @returns {number|null} Die Zeit in Sekunden oder null, wenn das Format ungültig ist.
     */
    function parseMMSS(mmssString) {
        const parts = mmssString.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            if (!isNaN(minutes) && !isNaN(seconds)) {
                return minutes * 60 + seconds;
            }
        }
        return null;
    }

    /**
     * Hauptfunktion zur Verarbeitung der Sprechwünsche.
     */
    async function processPatientRelease(targetTable) {
        if (!targetTable) {
            console.error("processPatientRelease wurde ohne gültige Tabelle aufgerufen.");
            return;
        }

        const rows = targetTable.querySelectorAll('tbody tr');
        const collectedLinksByUser = {};
        const allUniqueOwners = new Set();

        rows.forEach(row => {
            const fmsCell = row.querySelector('td:nth-child(1) span.building_list_fms.building_list_fms_5');
            if (fmsCell) {
                const vehicleLink = row.querySelector('td:nth-child(2) a');
                const ownerLink = row.querySelector('td:nth-child(5) a');

                if (vehicleLink && vehicleLink.href) {
                    const ownerName = (ownerLink && ownerLink.textContent) ? ownerLink.textContent.trim() : 'Unbekannter Benutzer';
                    allUniqueOwners.add(ownerName);

                    const match = vehicleLink.href.match(/\/vehicles\/(\d+)/);
                    if (match && match[1]) {
                        const vehicleId = match[1];
                        if (!collectedLinksByUser[ownerName]) {
                            collectedLinksByUser[ownerName] = { links: [] };
                        }
                        collectedLinksByUser[ownerName].links.push({
                            patientRelease: `https://www.leitstellenspiel.de/vehicles/${vehicleId}/patient/-1`,
                            vehiclePage: vehicleLink.href
                        });
                    }
                }
            }
        });

        const userNames = Object.keys(collectedLinksByUser);
        let totalLinksToProcess = userNames.reduce((acc, name) => acc + collectedLinksByUser[name].links.length, 0);

        if (totalLinksToProcess === 0) {
            showCustomModal('Keine passenden Sprechwünsche (FMS 5) zum Entlassen gefunden.');
            return;
        }

        showCustomModal(`Fahrzeugseiten und ELW-SEG-Status werden im Hintergrund geprüft...`, true);

        let preCheckDetails = {};
        allUniqueOwners.forEach(ownerName => {
            preCheckDetails[ownerName] = {
                totalFMS5: collectedLinksByUser[ownerName] ? collectedLinksByUser[ownerName].links.length : 0,
                foundButton: 0,
                failPage: 0,
                hasElwSegOnRoute: false,
                hasElwSegOnScene: false
            };
        });

        // ELW-SEG Prüfungen
        document.querySelectorAll('#mission_vehicle_driving tr, #mission_vehicle_at_mission tr').forEach(row => {
            const vehicleLink = row.querySelector('a[vehicle_type_id="59"]');
            if (vehicleLink) {
                const ownerLink = row.querySelector('a[href*="/profile/"]');
                if (ownerLink && ownerLink.textContent) {
                    const ownerName = ownerLink.textContent.trim();
                    allUniqueOwners.add(ownerName);
                    if (!preCheckDetails[ownerName]) {
                        preCheckDetails[ownerName] = { totalFMS5: 0, foundButton: 0, failPage: 0, hasElwSegOnRoute: false, hasElwSegOnScene: false };
                    }
                    if (row.closest('#mission_vehicle_driving')) {
                        preCheckDetails[ownerName].hasElwSegOnRoute = true;
                    } else {
                        preCheckDetails[ownerName].hasElwSegOnScene = true;
                    }
                }
            }
        });

        let preCheckFoundButtons = 0;
        let preCheckFailedPages = 0;

        try {
            for (const userName of userNames) {
                for (const linkData of collectedLinksByUser[userName].links) {
                    await new Promise(resolve => {
                        GM.xmlHttpRequest({
                            method: "GET",
                            url: linkData.vehiclePage,
                            onload: function(response) {
                                if (response.status === 200) {
                                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                                    if (doc.querySelector('a[href*="/patient/-1"][class*="btn"]')) {
                                        preCheckDetails[userName].foundButton++;
                                        preCheckFoundButtons++;
                                    }
                                } else {
                                    preCheckDetails[userName].failPage++;
                                    preCheckFailedPages++;
                                }
                                resolve();
                            },
                            onerror: function() {
                                preCheckDetails[userName].failPage++;
                                preCheckFailedPages++;
                                resolve();
                            }
                        });
                    });
                }
            }
        } catch (e) {
            showCustomModal(`Ein Fehler ist während der Vorabprüfung aufgetreten: ${e.message}.`);
            return;
        } finally {
            const currentModal = document.getElementById('customLSSModal');
            if (currentModal) currentModal.remove();
        }

        const getSprechwunschText = (count) => count === 1 ? 'Sprechwunsch' : 'Sprechwünsche';
        let confirmationMessage = `Es wurden ${totalLinksToProcess} ${getSprechwunschText(totalLinksToProcess)} (FMS 5) gefunden.\n\n` +
                                  `--- Vorabprüfung ---\n` +
                                  `Bereit zum Entlassen: ${preCheckFoundButtons} ${getSprechwunschText(preCheckFoundButtons)}\n`;
        if (preCheckFailedPages > 0) {
            confirmationMessage += `Seiten fehlgeschlagen: ${preCheckFailedPages}\n`;
        }
        confirmationMessage += `\n`;

        let hasElwSegFoundOverall = false;
        Array.from(allUniqueOwners).sort().forEach(userName => {
            const details = preCheckDetails[userName];
            if (!details) return;

            let userSummaryLine = `@${userName}: `;
            if (details.totalFMS5 > 0) {
                userSummaryLine += `${details.totalFMS5} ${getSprechwunschText(details.totalFMS5)} (${details.foundButton} entlassbar)`;
            } else {
                userSummaryLine += `Keine FMS 5 Sprechwünsche`;
            }

            if ((details.hasElwSegOnRoute || details.hasElwSegOnScene) && details.totalFMS5 > 0) {
                hasElwSegFoundOverall = true;
                let elwStatus = details.hasElwSegOnRoute ? 'auf Anfahrt' : 'Vor Ort';
                if (details.hasElwSegOnRoute && details.hasElwSegOnScene) elwStatus = 'auf Anfahrt & Vor Ort';
                userSummaryLine += ` (<span class="blink-red-bold">ELW-SEG: ${elwStatus}</span>)`;
            }
            confirmationMessage += `${userSummaryLine}\n`;
        });

        if (preCheckFoundButtons > 0) {
            confirmationMessage += `\nSoll die Entlassung gestartet werden?`;
        }

        const performReleaseActions = async () => {
            showCustomModal(`Verarbeite ${totalLinksToProcess} ${getSprechwunschText(totalLinksToProcess)}...`, true);
            let processedCount = 0;

            // KORREKTUR: Der fehlerhafte try/catch Block wurde repariert
            try {
                for (const userName of userNames) {
                    for (const linkData of collectedLinksByUser[userName].links) {
                        try {
                            await fetch(linkData.patientRelease, { method: 'GET', mode: 'no-cors' });
                            processedCount++;
                        } catch (error) {
                            console.error(`Fehler beim Entlassen für Fahrzeug ${linkData.vehiclePage}:`, error);
                        }
                    }
                }
            } finally {
                 const currentModal = document.getElementById('customLSSModal');
                 if (currentModal) currentModal.remove();
                 showCustomModal(`Verarbeitung abgeschlossen:\n${processedCount} von ${totalLinksToProcess} Sprechwünschen erfolgreich bearbeitet.`);
            }
        };

        const firstModalConfirmCallback = preCheckFoundButtons > 0 ? async () => {
            if (hasElwSegFoundOverall) {
                showCustomModal(`<b>Achtung:</b> Ein ELW-SEG eines betroffenen Verbandsmitglieds ist am Einsatz. Sollen die Patienten trotzdem entlassen werden?`, false, performReleaseActions, 'Ja, trotzdem entlassen', 'Abbrechen');
            } else {
                await performReleaseActions();
            }
        } : null;

        showCustomModal(confirmationMessage, false, firstModalConfirmCallback, 'Entlassung starten');
    }

    function showCustomModal(message, showLoadingSpinner = false, confirmCallback = null, confirmButtonText = 'OK', cancelButtonText = 'Schließen') {
        const existingModal = document.getElementById('customLSSModal');
        if (existingModal) existingModal.remove();

        if (!styleTagAdded) {
            const style = document.createElement('style');
            style.textContent = `@keyframes blink-red { 0%, 100% { color: red; } 50% { color: inherit; } } .blink-red-bold { animation: blink-red 1s infinite; font-weight: bold; }`;
            document.head.appendChild(style);
            styleTagAdded = true;
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'customLSSModal';
        modalOverlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 10000;`;
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `background-color: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); max-width: 90%; max-height: 80%; overflow-y: auto; color: #333; min-width: 300px; text-align: center;`;
        const messageParagraph = document.createElement('p');
        messageParagraph.innerHTML = message;
        messageParagraph.style.cssText = `white-space: pre-wrap; margin-bottom: 20px; font-size: 14px; line-height: 1.5; text-align: left;`;
        modalContent.appendChild(messageParagraph);

        if (showLoadingSpinner) {
            const spinner = document.createElement('div');
            spinner.style.cssText = `border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 20px auto;`;
            modalContent.appendChild(spinner);
        } else {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;`;
            const closeButton = document.createElement('button');
            closeButton.textContent = cancelButtonText;
            closeButton.className = 'btn btn-default';
            closeButton.onclick = () => modalOverlay.remove();
            buttonContainer.appendChild(closeButton);
            if (confirmCallback) {
                const confirmButton = document.createElement('button');
                confirmButton.textContent = confirmButtonText;
                confirmButton.className = 'btn btn-success';
                confirmButton.onclick = () => { modalOverlay.remove(); confirmCallback(); };
                buttonContainer.appendChild(confirmButton);
            }
            modalContent.appendChild(buttonContainer);
        }
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }

    function setupButton() {
        if (checkPerformed) return;
        checkPerformed = true;

        const vehicleRow = document.querySelector('tr[id^="vehicle_row_"]');
        if (!vehicleRow) return;
        const targetTable = vehicleRow.closest('table');
        if (!targetTable) return;

        let foundFMS5Vehicles = !!targetTable.querySelector('span.building_list_fms.building_list_fms_5');

        if (foundFMS5Vehicles) {
            const button = document.createElement('button');
            button.id = 'sprechwuenscheEntlassenButton';
            button.textContent = 'Sprechwünsche gesammelt entlassen';
            button.className = 'btn btn-success';
            button.style.cssText = `margin: 10px 0; display: block; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);`;
            button.addEventListener('click', () => processPatientRelease(targetTable));

            let preferredTarget = null;
            document.querySelectorAll('div.alert.alert-danger').forEach(alertDiv => {
                if (alertDiv.textContent.includes('Sprechwunsch')) preferredTarget = alertDiv;
            });

            if (preferredTarget) {
                if (preferredTarget.querySelector('br')) {
                    preferredTarget.insertBefore(button, preferredTarget.querySelector('br'));
                } else {
                    preferredTarget.appendChild(document.createElement('br'));
                    preferredTarget.appendChild(button);
                }
            } else {
                const targetHeading = document.getElementById('vehicles-at-mission-heading');
                if (targetHeading) {
                    targetHeading.insertAdjacentElement('afterend', button);
                } else {
                    targetTable.parentNode.insertBefore(button, targetTable);
                }
            }
        } else {
            console.log('Keine Fahrzeuge mit FMS Status 5 gefunden. Button wird nicht angezeigt.');
        }
    }

    const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector('tr[id^="vehicle_row_"]')) {
            obs.disconnect();
            setupButton();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('tr[id^="vehicle_row_"]')) {
            setupButton();
        } else {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

})();
