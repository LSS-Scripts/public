// ==UserScript==
// @name         Leitstellenspiel - Schulungsübersicht (Finale Version)
// @namespace    http://tampermonkey.net/
// @version      16.0
// @description  Zeigt eine detaillierte Übersicht pro Schultyp als Tabelle mit "Lehrgang starten"-Button.
// @author       Masklin
// @match        *://*.leitstellenspiel.de/buildings/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const targetTabPaneId = 'tab_schooling';
    const summaryId = 'schooling-summary-container';

    function waitForContent(selector, callback) {
        let attempts = 0;
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            const loading = document.querySelector(`#${targetTabPaneId} .loading_dot`);
            if (el && !loading) {
                clearInterval(interval);
                setTimeout(callback, 200);
            } else if (attempts > 60) {
                clearInterval(interval);
            }
            attempts++;
        }, 100);
    }

    function generateAndShowSummary() {
        if (document.getElementById(summaryId)) {
            document.getElementById(summaryId).remove();
        }

        const targetTab = document.getElementById(targetTabPaneId);
        if (!targetTab) return;

        const schoolHeaders = targetTab.querySelectorAll('h3');
        if (schoolHeaders.length === 0) return;

        const schoolData = {};

        schoolHeaders.forEach(header => {
            const img = header.querySelector('img[alt*="Building"]');
            if (!img) return;

            let schoolTypeName = "Unbekannte Schule";
            const altText = img.alt.toLowerCase();

            if (altText.includes('fireschool')) schoolTypeName = "Feuerwehrschule";
            else if (altText.includes('rettungsschule')) schoolTypeName = "Rettungsschule";
            else if (altText.includes('polizeischule')) schoolTypeName = "Polizeischule";
            else if (altText.includes('thw_school') || altText.includes('thw')) schoolTypeName = "THW-Schule";
            else if (altText.includes('water_rescue_school')) schoolTypeName = "Wasserrettungsschule";
            else if (altText.includes('coastal rescue school')) schoolTypeName = "Seenotrettungsschule";
            else if (altText.includes('rescueteam')) schoolTypeName = "Rettungsschule";

            if (schoolTypeName === "Unbekannte Schule") {
                console.log(`[LSS-Diagnose] Unbekannter Schultyp: "${img.alt}"`);
            }

            if (!schoolData[schoolTypeName]) {
                schoolData[schoolTypeName] = { count: 0, occupied: 0, startLink: null };
            }
            schoolData[schoolTypeName].count++;

            let occupiedInThisSchool = 0;
            let nextElement = header.nextElementSibling;

            while (nextElement) {
                // Stoppe die Suche, wenn die nächste Schule beginnt
                if (nextElement.tagName === 'H3') break;

                // Finde die Tabelle und zähle die belegten Räume
                if (nextElement.tagName === 'TABLE') {
                    occupiedInThisSchool = nextElement.querySelectorAll('tbody > tr > td > span[id*="education_schooling_"]').length;
                }

                // NEU: Finde den "Neuen Lehrgang starten"-Button
                if (nextElement.tagName === 'A' && nextElement.classList.contains('btn-success') && nextElement.textContent.includes('Neuen Lehrgang starten')) {
                    // Speichere den Link nur, wenn für diesen Schultyp noch keiner gespeichert wurde
                    if (schoolData[schoolTypeName].startLink === null) {
                        schoolData[schoolTypeName].startLink = nextElement.getAttribute('href');
                    }
                }
                nextElement = nextElement.nextElementSibling;
            }
            schoolData[schoolTypeName].occupied += occupiedInThisSchool;
        });

        // --- HTML-ERSTELLUNG ---
        let totalSchools = 0;
        let totalOccupied = 0;

        let tableBodyHTML = '';
        for (const schoolType of Object.keys(schoolData).sort()) {
            const data = schoolData[schoolType];
            totalSchools += data.count;
            totalOccupied += data.occupied;
            const roomsForType = data.count * 4;
            const freeForType = roomsForType - data.occupied;

            // Erstelle die "Aktion"-Zelle
            let actionCell = '<td></td>'; // Leere Zelle als Standard
            if (freeForType > 0 && data.startLink) {
                actionCell = `<td><a class="btn btn-xs btn-success" href="${data.startLink}">Starten</a></td>`;
            }

            tableBodyHTML += `<tr>
                <td><strong>${schoolType}</strong></td>
                <td>${data.count}</td>
                <td style="color: #d9534f;">${data.occupied}</td>
                <td style="color: #5cb85c;">${freeForType}</td>
                <td>${roomsForType}</td>
                ${actionCell}
            </tr>`;
        }

        const totalRooms = totalSchools * 4;
        const totalFree = totalRooms - totalOccupied;

        const summaryDiv = document.createElement('div');
        summaryDiv.id = summaryId;
        summaryDiv.style.cssText = 'margin-bottom: 20px;';
        summaryDiv.innerHTML = `
            <h3 style="margin-top: 0;">Übersicht der Ausbildungen</h3>
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Schultyp</th>
                        <th>Anzahl</th>
                        <th>Belegt</th>
                        <th>Frei</th>
                        <th>Gesamt</th>
                        <th>Aktion</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableBodyHTML}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #666;">
                        <td><strong>GESAMT</strong></td>
                        <td><strong>${totalSchools}</strong></td>
                        <td><strong style="color: #d9534f;">${totalOccupied}</strong></td>
                        <td><strong style="color: #5cb85c;">${totalFree}</strong></td>
                        <td><strong>${totalRooms}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>`;

        targetTab.prepend(summaryDiv);
    }

    function runAnalysis() {
        const contentSelector = `#${targetTabPaneId} h3, #${targetTabPaneId} .alert.alert-info`;
        waitForContent(contentSelector, generateAndShowSummary);
    }

    const targetLink = document.querySelector(`a[href="#${targetTabPaneId}"]`);
    if (targetLink) {
        targetLink.addEventListener('click', runAnalysis);
        if (targetLink.parentElement.classList.contains('active')) {
             runAnalysis();
        }
    }
})();
