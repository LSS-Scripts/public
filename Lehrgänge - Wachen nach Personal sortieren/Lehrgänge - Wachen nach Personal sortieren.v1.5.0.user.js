// ==UserScript==
// @name         Lehrgänge - Wachen nach Personal sortieren
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Fügt Buttons hinzu, um alle Wachen nach Personal (auf/absteigend) zu sortieren.
// @author       B&M
// @match        *://www.leitstellenspiel.de/buildings*
// @grant        none
// ==/UserScript==

(function() {
    'useSrict';

    /**
     * Die Hauptfunktion, die die Wachen sortiert.
     * @param {string} direction - 'asc' (aufsteigend) oder 'desc' (absteigend)
     */
    function sortBuildings(direction) {
        // 1. Alle Wachen-Elemente auf der Seite finden
        const buildingElements = document.querySelectorAll('div.building_list');

        if (buildingElements.length === 0) {
            console.log("Keine Wachen zum Sortieren gefunden.");
            return;
        }

        // 2. Den übergeordneten Container finden
        const parentContainer = buildingElements[0].parentNode;

        // 3. Ein Array erstellen, das die Elemente und ihre Personalanzahl enthält
        const buildingsData = [];
        buildingElements.forEach(el => {
            const span = el.querySelector('.panel-heading .pull-right span.label.label-default');
            let count = 0;

            if (span && span.textContent.includes('Angestellte')) {
                count = parseInt(span.textContent, 10);
            }

            buildingsData.push({ element: el, count: count });
        });

        // 4. Das Array nach der Personalanzahl sortieren
        buildingsData.sort((a, b) => {
            if (direction === 'asc') {
                return a.count - b.count; // Aufsteigend
            } else {
                return b.count - a.count; // Absteigend
            }
        });

        // 5. Die Elemente in der sortierten Reihenfolge wieder in das DOM einfügen
        buildingsData.forEach(item => {
            parentContainer.appendChild(item.element);
        });
    }

    /**
     * Erstellt die Sortier-Buttons und fügt sie über der ersten Wache ein.
     */
    function createSortButtons() {
        const containerId = 'gemini-sort-container';

        if (document.getElementById(containerId)) {
            return;
        }

        const firstBuilding = document.querySelector('div.building_list');
        if (!firstBuilding) {
            return;
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.id = containerId;
        buttonContainer.style.marginBottom = '15px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';

        // 3. Button "Aufsteigend"
        const buttonAsc = document.createElement('button');
        buttonAsc.textContent = 'Personal Aufsteigend (Wenig zuerst)';
        buttonAsc.className = 'btn btn-success btn-sm';
        buttonAsc.type = 'button'; // <<< DER WICHTIGE FIX
        buttonAsc.addEventListener('click', (e) => {
            sortBuildings('asc');
        });

        // 4. Button "Absteigend"
        const buttonDesc = document.createElement('button');
        buttonDesc.textContent = 'Personal Absteigend (Viel zuerst)';
        buttonDesc.className = 'btn btn-primary btn-sm';
        buttonDesc.type = 'button'; // <<< DER WICHTIGE FIX
        buttonDesc.addEventListener('click', (e) => {
            sortBuildings('desc');
        });

        // 5. Buttons zum Container hinzufügen
        buttonContainer.appendChild(buttonAsc);
        buttonContainer.appendChild(buttonDesc);

        // 6. Container VOR der ersten Wache in die Seite einfügen
        firstBuilding.parentNode.insertBefore(buttonContainer, firstBuilding);
    }

    // Das Skript starten
    setTimeout(createSortButtons, 500);

})();
