// ==UserScript==
// @name         LSS Statistik: Fahrzeuge unterwegs (v1.2 - ID-Priorisierung)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Zeigt die Anzahl der fahrenden Fahrzeuge in der Navigationsleiste an.
// @author       Dein Helferlein & Gemini
// @match        https://www.leitstellenspiel.de/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Ein Set, um die IDs der fahrenden Fahrzeuge ohne Duplikate zu speichern.
    const drivingVehicleIds = new Set();

    // 1. Erstelle das Anzeige-Element
    const displayElement = document.createElement('li');
    displayElement.innerHTML = `<a><span class="glyphicon glyphicon-road" style="margin-right: 5px;"></span>Fzg. auf Karte: <span id="driving-vehicle-count-span">0</span></a>`;

    // 2. Füge das Element in die Navigationsleiste ein
    const targetNavbar = document.querySelector('#navbar-main-collapse .navbar-right');
    if (targetNavbar) {
        targetNavbar.prepend(displayElement);
    }

    const countSpan = document.getElementById('driving-vehicle-count-span');

    // Funktion, um die Anzeige zu aktualisieren
    const updateCount = () => {
        if (countSpan) {
            countSpan.textContent = drivingVehicleIds.size;
        }
    };

    // --- Wir haken uns in die Spielfunktionen ein ---

    // Originale Spielfunktionen zwischenspeichern
    const originalVehicleDrive = window.vehicleDrive;
    const originalVehicleDelete = window.vehicleDelete;

    /**
     * Helper-Funktion, um die korrekte, eindeutige Fahrzeug-ID aus dem Datenobjekt zu extrahieren.
     * Priorisiert 'id', nutzt 'mid' als Fallback.
     * @param {Object} vehicleData - Die Daten, die von vehicleDrive/vehicleDelete übergeben werden.
     * @returns {number|null} Die eindeutige Fahrzeug-ID als Zahl oder null.
     */
    const getVehicleId = (vehicleData) => {
        if (!vehicleData) return null;

        // 1. Priorität: Das Feld 'id' (scheint die eindeutige Fahrzeug-ID zu sein)
        if (vehicleData.id) {
            return vehicleData.id;
        }

        // 2. Fallback: Das Feld 'mid' (Marker-ID, falls es als ID verwendet wird)
        if (vehicleData.mid) {
            // Sicherstellen, dass es eine Zahl ist
            return parseInt(vehicleData.mid, 10);
        }

        return null;
    };


    // 3. Neue Definition für 'vehicleDrive' (Fahrzeug fährt los)
    window.vehicleDrive = function(vehicleData) {
        const vehicleId = getVehicleId(vehicleData);

        if (vehicleId) {
            // Set-Logik verhindert Duplikate derselben ID, auch wenn vehicleDrive mehrmals für dasselbe Fzg. aufgerufen wird.
            drivingVehicleIds.add(vehicleId);
        }

        updateCount();

        // Die originale Funktion aufrufen
        return originalVehicleDrive.apply(this, arguments);
    };

    // 4. Neue Definition für 'vehicleDelete' (Fahrzeug kommt an / wird gelöscht)
    window.vehicleDelete = function(vehicleData) {
        const vehicleId = getVehicleId(vehicleData);

        if (vehicleId) {
            // Nur das Fahrzeug entfernen, dessen ID wir zuvor hinzugefügt haben
            drivingVehicleIds.delete(vehicleId);
        }

        updateCount();

        // Die originale Funktion aufrufen
        return originalVehicleDelete.apply(this, arguments);
    };

    // 5. Initialer Check beim Laden der Seite (nur Vehicle-Marker IDs verwenden)
    if (window.vehicle_markers) {
        Object.keys(window.vehicle_markers).forEach(id => {
            drivingVehicleIds.add(parseInt(id, 10));
        });
        updateCount();
    }
})();
