// ==UserScript==
// @name         Leitstellenspiel Patient Entlassen
// @namespace    http://tampermonkey.net/
// @version      0.8.2
// @description  Robuste Tabellensuche: Findet die Fahrzeuge auch dann, wenn die Tabellen-ID Probleme macht.
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

    console.log('LSS Patient Entlassen Skript geladen (Version 0.82).');

    let buttonSetupCompleted = false; // Flag, um sicherzustellen, dass der Button nur einmal hinzugefügt wird
    let styleTagAdded = false; // Flag, um sicherzustellen, dass der Style-Tag nur einmal hinzugefügt wird
    let checkPerformed = false; // Stellt sicher, dass die Prüfung nur einmal läuft.

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
     * Diese Funktion verarbeitet die Tabelle, sobald der Button geklickt wird.
     * Sie sammelt die Patient-Entlassen-Links, gruppiert sie nach Benutzer und zeigt eine Bestätigungsübersicht an.
     * Die Prüfung der Fahrzeugseite erfolgt nun VOR der endgültigen Bestätigung zum Entlassen.
     */
    async function processPatientRelease(targetTable) {
        if (!targetTable) {
            console.error("processPatientRelease wurde ohne gültige Tabelle aufgerufen.");
            return;
        }

        const rows = targetTable.querySelectorAll('tbody tr');
        const collectedLinksByUser = {}; // Objekt zum Sammeln der Links, gruppiert nach Benutzer
        const allUniqueOwners = new Set(); // Set zum Sammeln aller einzigartigen Besitzer

        rows.forEach((row, index) => {
            const firstCell = row.querySelector('td:nth-child(1)'); // Erste Spalte (FMS-Status)
            if (firstCell) {
                const spanWithExactClasses = firstCell.querySelector('span.building_list_fms.building_list_fms_5');

                if (spanWithExactClasses) {
                    const vehicleLink = row.querySelector('td:nth-child(2) a'); // Link zum Fahrzeug
                    const ownerCell = row.querySelector('td:nth-child(5)'); // Die gesamte 5. Zelle (Besitzer)
                    let ownerLink = null;
                    if (ownerCell) {
                        ownerLink = ownerCell.querySelector('a');
                    }

                    if (vehicleLink && vehicleLink.href) {
                        const vehiclePageUrl = vehicleLink.href;
                        let ownerName = 'Unbekannter Benutzer';
                        let ownerProfileUrl = '#';

                        if (ownerLink && ownerLink.textContent) {
                            ownerName = ownerLink.textContent.trim();
                            ownerProfileUrl = ownerLink.href;
                        }
                        allUniqueOwners.add(ownerName); // Besitzer zu den einzigartigen Besitzern hinzufügen

                        const match = vehiclePageUrl.match(/\/vehicles\/(\d+)/);
                        if (match && match[1]) {
                            const vehicleId = match[1];
                            const patientReleaseLink = `https://www.leitstellenspiel.de/vehicles/${vehicleId}/patient/-1`;

                            if (!collectedLinksByUser[ownerName]) {
                                collectedLinksByUser[ownerName] = {
                                    count: 0,
                                    links: [],
                                    profileUrl: ownerProfileUrl
                                };
                            }
                            collectedLinksByUser[ownerName].count++;
                            collectedLinksByUser[ownerName].links.push({
                                patientRelease: patientReleaseLink,
                                vehiclePage: vehiclePageUrl
                            });

                        }
                    }
                }
            }
        });

        const userNames = Object.keys(collectedLinksByUser);
        let totalLinksToProcess = 0;
        userNames.forEach(userName => {
            totalLinksToProcess += collectedLinksByUser[userName].links.length;
        });

        if (totalLinksToProcess === 0) {
            showCustomModal('Keine passenden Sprechwünsche (FMS 5) zum Entlassen gefunden.');
            return; // Skript beenden, wenn keine Links gefunden wurden
        }

        // Vorabprüfung der Fahrzeugseiten und ELW-SEG-Status
        let preCheckSuccessPages = 0;
        let preCheckFailedPages = 0;
        let preCheckFoundButtons = 0;
        let preCheckDetails = {}; // Speichert die Ergebnisse der Vorabprüfung pro Benutzer

        // Initialisiere preCheckDetails für alle einzigartigen Besitzer, die bereits aus FMS5-Fahrzeugen gesammelt wurden
        allUniqueOwners.forEach(ownerName => {
            preCheckDetails[ownerName] = {
                totalFMS5: collectedLinksByUser[ownerName] ? collectedLinksByUser[ownerName].links.length : 0,
                successPage: 0,
                failPage: 0,
                foundButton: 0,
                hasElwSegOnRoute: false,
                elwSegArrivalTime: null,
                hasElwSegOnScene: false
            };
        });


        showCustomModal(`Fahrzeugseiten und ELW-SEG-Status werden im Hintergrund geprüft...`, true);

        // --- ELW-SEG Prüfung (Anfahrt - direkt auf der aktuellen Seite) ---
        const drivingTable = document.getElementById('mission_vehicle_driving');
        if (drivingTable) {
            const drivingRows = drivingTable.querySelectorAll('tbody tr');
            drivingRows.forEach(row => {
                const vehicleLink = row.querySelector('a[vehicle_type_id="59"]'); // ELW-SEG (Fahrzeug-ID 59)
                if (vehicleLink) {
                    const ownerLink = row.querySelector('a[href*="/profile/"]'); // Suche nach einem Link zum Profil
                    if (ownerLink && ownerLink.textContent) {
                        const ownerName = ownerLink.textContent.trim();
                        allUniqueOwners.add(ownerName);
                        if (!preCheckDetails[ownerName]) {
                            preCheckDetails[ownerName] = {
                                totalFMS5: 0, successPage: 0, failPage: 0, foundButton: 0,
                                hasElwSegOnRoute: false, elwSegArrivalTime: null, hasElwSegOnScene: false
                            };
                        }
                        preCheckDetails[ownerName].hasElwSegOnRoute = true;
                    }
                }
            });
        }

        // --- ELW-SEG Prüfung (Vor Ort, aktuelle Missionsseite) ---
        const atMissionTable = document.getElementById('mission_vehicle_at_mission');
        if (atMissionTable) {
            const atMissionRows = atMissionTable.querySelectorAll('tbody tr');
            atMissionRows.forEach(row => {
                const vehicleLink = row.querySelector('a[vehicle_type_id="59"]'); // ELW-SEG (Fahrzeug-ID 59)
                if (vehicleLink) {
                    const ownerCell = row.querySelector('td:nth-child(5) a'); // Besitzer in Spalte 5
                    if (ownerCell && ownerCell.textContent) {
                        const ownerName = ownerCell.textContent.trim();
                        allUniqueOwners.add(ownerName);
                        if (!preCheckDetails[ownerName]) {
                            preCheckDetails[ownerName] = {
                                totalFMS5: 0, successPage: 0, failPage: 0, foundButton: 0,
                                hasElwSegOnRoute: false, elwSegArrivalTime: null, hasElwSegOnScene: false
                            };
                        }
                        preCheckDetails[ownerName].hasElwSegOnScene = true;
                    }
                }
            });
        }


        // Schleife zur Prüfung der FMS 5 Fahrzeugseiten (Patient entlassen Link)
        try {
            const fms5UserNames = Object.keys(collectedLinksByUser);
            for (const userName of fms5UserNames) {
                const userData = collectedLinksByUser[userName];
                for (const linkData of userData.links) {
                    await new Promise(resolve => {
                        GM.xmlHttpRequest({
                            method: "GET",
                            url: linkData.vehiclePage,
                            onload: function(response) {
                                if (response.status === 200) {
                                    const htmlText = response.responseText;
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(htmlText, 'text/html');

                                    const patientReleaseButtonSpecific = doc.querySelector('a[href*="/patient/-1"][class*="btn"][class*="btn-sm"][class*="btn-default"]');
                                    if (patientReleaseButtonSpecific) {
                                        preCheckFoundButtons++;
                                        if (preCheckDetails[userName]) {
                                            preCheckDetails[userName].foundButton++;
                                        }
                                    }
                                    if (preCheckDetails[userName]) {
                                        preCheckSuccessPages++;
                                        preCheckDetails[userName].successPage++;
                                    }
                                } else {
                                    if (preCheckDetails[userName]) {
                                        preCheckFailedPages++;
                                        preCheckDetails[userName].failPage++;
                                    }
                                }
                                resolve();
                            },
                            onerror: function(error) {
                                if (preCheckDetails[userName]) {
                                    preCheckFailedPages++;
                                    preCheckDetails[userName].failPage++;
                                }
                                resolve();
                            }
                        });
                    });
                }
            } catch (e) {
                showCustomModal(`Ein Fehler ist während der Vorabprüfung aufgetreten: ${e.message}.`);
                return;
            } finally {
                const currentModal = document.getElementById('customLSSModal');
                if (currentModal) {
                    currentModal.remove();
                }
            }


            const getSprechwunschText = (count) => count === 1 ? 'Sprechwunsch' : 'Sprechwünsche';

            let confirmationMessage = `Es wurden ${totalLinksToProcess} ${getSprechwunschText(totalLinksToProcess)} (FMS 5) gefunden.\n\n`;
            confirmationMessage += `--- Vorabprüfung der Fahrzeugseiten ---\n`;
            confirmationMessage += `Fahrzeuge erfolgreich geprüft: ${preCheckSuccessPages}\n`;
            if (preCheckFailedPages > 0) {
                confirmationMessage += `Seiten fehlgeschlagen: ${preCheckFailedPages}\n`;
            }
            confirmationMessage += `Bereit zum Entlassen: ${preCheckFoundButtons} ${getSprechwunschText(preCheckFoundButtons)}\n\n`;

            let hasElwSegFoundOverall = false;
            Array.from(allUniqueOwners).sort((a,b) => a.localeCompare(b)).forEach(userName => {
                const details = preCheckDetails[userName];
                if (!details) {
                    return;
                }

                const totalFMS5Count = details.totalFMS5;
                const entlassbarCount = details.foundButton;
                const failedPagesCount = details.failPage;

                let userSummaryLine = `@${userName}: `;

                if (totalFMS5Count > 0) {
                    userSummaryLine += `${totalFMS5Count} ${getSprechwunschText(totalFMS5Count)}`;
                    userSummaryLine += ` (${entlassbarCount} entlassbar)`;
                } else {
                    userSummaryLine += `Keine FMS 5 Sprechwünsche`;
                }


                // ELW-SEG Warnung nur anzeigen, wenn der Benutzer auch FMS-5-Sprechwünsche hat.
                if ((details.hasElwSegOnRoute || details.hasElwSegOnScene) && details.totalFMS5 > 0) {
                    hasElwSegFoundOverall = true;
                    let elwSegDisplayContent = '';
                    if (details.hasElwSegOnRoute && details.hasElwSegOnScene) {
                        elwSegDisplayContent = `ELW-SEG auf Anfahrt, Vor Ort`;
                        userSummaryLine += ` (<span class="blink-red-bold">${elwSegDisplayContent}</span>)`;
                    } else if (details.hasElwSegOnRoute) {
                        elwSegDisplayContent = `ELW-SEG auf Anfahrt`;
                        userSummaryLine += ` (<span class="blink-red-bold">${elwSegDisplayContent}</span>)`;
                    } else if (details.hasElwSegOnScene) {
                        elwSegDisplayContent = `ELW-SEG: Vor Ort`;
                        userSummaryLine += ` (<span class="blink-red-bold">${elwSegDisplayContent}</span>)`;
                    }
                }


                if (failedPagesCount > 0) {
                    userSummaryLine += ` (${failedPagesCount} Seitenprüfung fehlgeschlagen)`;
                }
                confirmationMessage += `${userSummaryLine}\n`;
            });

            if (preCheckFoundButtons > 0) {
                confirmationMessage += `\nSoll die Entlassung der Patienten gestartet werden?`;
            }

            // Funktion, die die tatsächliche Entlassung durchführt
            const performReleaseActions = async () => {
                let processedReleaseLinks = 0;
                let failedReleaseLinks = 0;
                let finalProcessingDetails = {};

                userNames.forEach(userName => {
                    finalProcessingDetails[userName] = { successRelease: 0, failRelease: 0, profileUrl: collectedLinksByUser[userName].profileUrl };
                });

                showCustomModal(`Verarbeite ${totalLinksToProcess} ${getSprechwunschText(totalLinksToProcess)} im Hintergrund...`, true);

                try {
                    for (const userName of userNames) {
                        const userData = collectedLinksByUser[userName];
                        for (const linkData of userData.links) {
                            try {
                                await fetch(linkData.patientRelease, { method: 'GET', mode: 'no-cors' });
                                processedReleaseLinks++;
                                if (finalProcessingDetails[userName]) {
                                    finalProcessingDetails[userName].successRelease++;
                                }
                            } catch (error) {
                                failedReleaseLinks++;
                                if (finalProcessingDetails[userName]) {
                                    finalProcessingDetails[userName].failRelease++;
                                }
                            }
                        }
                    }
                } catch (e) {
                    showCustomModal(`Ein unerwarteter Fehler ist aufgetreten: ${e.message}.`);
                    return;
                } finally {
                    const currentModal = document.getElementById('customLSSModal');
                    if (currentModal) {
                        currentModal.remove();
                    }
                }

                let summaryMessage = `Verarbeitung abgeschlossen:\n\n`;
                summaryMessage += `Gesamt "Patient entlassen" Links verarbeitet: ${processedReleaseLinks}\n`;
                if (failedReleaseLinks > 0) {
                    summaryMessage += `Fehlgeschlagen "Patient entlassen" Links: ${failedReleaseLinks}\n`;
                }
                summaryMessage += `\n--- Ergebnisse der Entlassung ---\n`;

                userNames.forEach(userName => {
                    const details = finalProcessingDetails[userName];
                    const userSummaryText = getSprechwunschText(details.successRelease);
                    summaryMessage += `${details.successRelease} erfolgreich ${userSummaryText} von ${userName}`;
                    if (details.failRelease > 0) {
                        summaryMessage += `, ${details.failRelease} fehlgeschlagen`;
                    }
                    summaryMessage += `\n`;
                });

                showCustomModal(summaryMessage);
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

    /**
     * Zeigt ein benutzerdefiniertes modales Fenster anstelle von alert().
     */
    function showCustomModal(message, showLoadingSpinner = false, confirmCallback = null, confirmButtonText = 'OK', cancelButtonText = 'Schließen') {
        const existingModal = document.getElementById('customLSSModal');
        if (existingModal) {
            existingModal.remove();
        }

        if (!styleTagAdded) {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes blink-red { 0%, 100% { color: red; } 50% { color: inherit; } }
                .blink-red-bold { animation: blink-red 1s infinite; font-weight: bold; }
            `;
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
                confirmButton.onclick = () => {
                    modalOverlay.remove();
                    confirmCallback();
                };
                buttonContainer.appendChild(confirmButton);
            }
            modalContent.appendChild(buttonContainer);
        }

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }


    /**
     * Erstellt und platziert den Button auf der Seite.
     */
    function setupButton() {
        if (checkPerformed) return;
        checkPerformed = true;

        // KORREKTUR: Robuste Tabellensuche
        const vehicleRow = document.querySelector('tr[id^="vehicle_row_"]');
        if (!vehicleRow) {
            console.log("Keine Fahrzeug-Zeilen gefunden. Button-Setup abgebrochen.");
            return;
        }
        const targetTable = vehicleRow.closest('table');
        if (!targetTable) {
            console.log("Konnte keine übergeordnete Tabelle für Fahrzeug-Zeilen finden. Button-Setup abgebrochen.");
            return;
        }

        let foundFMS5Vehicles = false;
        const rows = targetTable.querySelectorAll('tbody tr');
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
            button.style.cssText = `margin-top: 10px; margin-bottom: 10px; display: block; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);`;
            button.addEventListener('click', () => processPatientRelease(targetTable));

            const allAlerts = document.querySelectorAll('div.alert.alert-danger');
            let preferredTarget = null;
            for (const alertDiv of allAlerts) {
                if (alertDiv.textContent.includes('Sprechwunsch')) {
                    preferredTarget = alertDiv;
                    break;
                }
            }

            if (preferredTarget) {
                const referenceElement = preferredTarget.querySelector('br');
                if (referenceElement) {
                    preferredTarget.insertBefore(button, referenceElement);
                } else {
                    preferredTarget.appendChild(document.createElement('br'));
                    preferredTarget.appendChild(button);
                }
                console.log('Button im Sprechwunsch-Banner eingefügt.');
            } else {
                const targetHeading = document.getElementById('vehicles-at-mission-heading');
                if (targetHeading) {
                    targetHeading.insertAdjacentElement('afterend', button);
                } else {
                    targetTable.parentNode.insertBefore(button, targetTable);
                }
            }
            buttonSetupCompleted = true;
        } else {
            console.log('Keine Fahrzeuge mit FMS Status 5 gefunden. Button wird nicht angezeigt.');
        }
    }

    const observer = new MutationObserver((mutationsList, observerInstance) => {
        if (document.querySelector('tr[id^="vehicle_row_"]')) {
            observerInstance.disconnect();
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
