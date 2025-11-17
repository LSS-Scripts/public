// ==UserScript==
// @name         LSS Statistik: Fahrzeuge unterwegs (v1.1 - Korrigiert)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Zeigt die Anzahl der fahrenden Fahrzeuge in der Navigationsleiste an.
// @author       Dein Helferlein & Gemini
// @match        https://www.leitstellenspiel.de/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Ein Set, um die IDs der fahrenden Fahrzeuge ohne Duplikate zu speichern.
    // Das Set speichert die IDs der Fahrzeuge, die auf dem Weg sind.
    const drivingVehicleIds = new Set();

    // 1. Erstelle das Anzeige-Element für die Navigationsleiste
    const displayElement = document.createElement('li');
    // Wir fügen ein kleines Icon für die Optik hinzu (glyphicon-road)
    displayElement.innerHTML = `<a><span class="glyphicon glyphicon-road" style="margin-right: 5px;"></span>Fzg. auf Karte: <span id="driving-vehicle-count-span">0</span></a>`;

    // 2. Finde die Navigationsleiste und füge unser neues Element am Anfang ein
    const targetNavbar = document.querySelector('#navbar-main-collapse .navbar-right');
    if (targetNavbar) {
        // 'prepend' fügt das Element ganz nach links in der rechten Leiste ein
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

    // Originale Spielfunktionen zwischenspeichern, damit wir sie nicht kaputtmachen
    const originalVehicleDrive = window.vehicleDrive;
    const originalVehicleDelete = window.vehicleDelete;

    // 3. Neue Definition für 'vehicleDrive'
    // Diese Funktion wird immer aufgerufen, wenn ein Fahrzeug losfährt.
    window.vehicleDrive = function(vehicleData) {
        let vehicleId;

        // Versuche zuerst, die Haupt-ID zu bekommen
        if (vehicleData && vehicleData.id) {
            vehicleId = vehicleData.id;
        // Wenn die Haupt-ID fehlt, versuche die Marker-ID (mid), die oft verwendet wird.
        } else if (vehicleData && vehicleData.mid) {
            // mid ist oft ein String, wir parsen es zu einer Zahl
            vehicleId = parseInt(vehicleData.mid, 10);
        }

        if (vehicleId) {
            drivingVehicleIds.add(vehicleId);
        }

        updateCount(); // Zähler aktualisieren

        // Die originale Funktion aufrufen, damit das Spiel normal weiterläuft
        return originalVehicleDrive.apply(this, arguments);
    };

    // 4. Neue Definition für 'vehicleDelete'
    // Diese Funktion wird aufgerufen, wenn ein Fahrzeug von der Karte entfernt wird (z.B. am Einsatzort angekommen).
    window.vehicleDelete = function(vehicleData) {
        let vehicleId;

        // Wie oben, versuchen wir id oder mid zu finden, damit das Set korrekt gelöscht wird.
        if (vehicleData && vehicleData.id) {
            vehicleId = vehicleData.id;
        } else if (vehicleData && vehicleData.mid) {
            vehicleId = parseInt(vehicleData.mid, 10);
        }

        if (vehicleId) {
            drivingVehicleIds.delete(vehicleId);
        }

        updateCount(); // Zähler aktualisieren

        // Die originale Funktion aufrufen
        return originalVehicleDelete.apply(this, arguments);
    };

    // 5. Initialer Check beim Laden der Seite
    // Wir lesen die globalen `vehicle_markers` aus, um den Startwert zu setzen.
    if (window.vehicle_markers) {
        // Die Schlüssel von vehicle_markers sind die IDs der fahrenden Fahrzeuge
        Object.keys(window.vehicle_markers).forEach(id => {
            drivingVehicleIds.add(parseInt(id, 10));
        });
        updateCount();
    }
})();
