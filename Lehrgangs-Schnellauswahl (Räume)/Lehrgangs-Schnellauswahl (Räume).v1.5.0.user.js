// ==UserScript==
// @name         Leitstellenspiel - Schnellauswahl Schulräume
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Setzt Verbandsfreigabe auf 2 Tage & fügt Buttons hinzu, die per Checkbox Räume auswählen ODER Räume auswählen & Ausbildung starten.
// @author       Masklin
// @match        https://www.leitstellenspiel.de/buildings/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Konfiguration ---
    const BUTTON_VALUES = [1, 10, 15, 20, 30, 50, 100, 150, 200, 250, 300];
    const BUTTON_CONTAINER_ID = 'lss_room_quick_selector';
    const INSERTION_POINT_ID = 'empty_rooms_education_selection';
    const SUBMIT_BUTTON_SELECTOR = 'input.btn.btn-success[name="commit"][value="Ausbilden"]';
    
    // ID und Storage-Key für die Checkbox
    const CHECKBOX_ID = 'lss_direct_start_checkbox';
    const STORAGE_KEY_DIRECT_START = 'lss_direct_start_enabled';
    
    // ID für die Verbandsfreigabe
    const ALLIANCE_DURATION_ID = 'alliance_duration';
    const ALLIANCE_DURATION_VALUE = '172800'; // "2 Tage"

    // --- Logik-Funktionen ---

    /**
     * Setzt Verbandsfreigabe UND alle Raum-Select-Boxen auf einen Wert.
     */
    function selectAllRooms(numberToSelect) {
        
        // --- NEU: Verbandsfreigabe immer auf "2 Tage" setzen ---
        const allianceDurationSelect = document.getElementById(ALLIANCE_DURATION_ID);
        if (allianceDurationSelect) {
            allianceDurationSelect.value = ALLIANCE_DURATION_VALUE;
            // Event auslösen, falls die Seite darauf reagiert
            allianceDurationSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Nur zur Info im Log, falls die ID sich mal ändert
            console.info("LSS Quick Selector: 'alliance_duration' Select nicht gefunden (vielleicht keine Verbandsschule?).");
        }
        // --- Ende NEU ---

        // Setze die Räume für die einzelnen Lehrgänge
        const allSelects = document.querySelectorAll(`select.empty_rooms_education_selector`);
        allSelects.forEach(select => {
            const educationKey = select.dataset.educationKey;
            if (!educationKey) return;
            const targetValue = `${educationKey}:${numberToSelect}`;
            const targetOption = select.querySelector(`option[value="${targetValue}"]`);

            if (targetOption) {
                select.value = targetValue;
            } else if (numberToSelect > 0) { // Höchsten Wert wählen, falls z.B. 300 geklickt, aber nur 50 verfügbar
                const lastOption = select.querySelector('option:last-child');
                if (lastOption) select.value = lastOption.value;
            } else { // 0 (Reset)
                const firstOption = select.querySelector('option:first-child');
                 if(firstOption) select.value = firstOption.value;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    /**
     * Klickt den originalen "Ausbilden"-Button.
     */
    function clickAusbildenButton() {
        const originalAusbildenButton = document.querySelector(SUBMIT_BUTTON_SELECTOR);
        if (originalAusbildenButton) {
            originalAusbildenButton.click();
        } else {
            console.error("LSS Quick Selector: Original 'Ausbilden'-Button nicht gefunden!");
            alert("Konnte den 'Ausbilden'-Button nicht finden!");
        }
    }

    /**
     * Erstellt die komplette UI und fügt sie ein.
     */
    function addQuickSelectButtons(insertionPoint) {
        // 1. Haupt-Container
        const mainContainer = document.createElement('div');
        mainContainer.id = BUTTON_CONTAINER_ID;
        mainContainer.style.marginBottom = '20px';
        mainContainer.style.padding = '10px';
        mainContainer.style.border = '1.5px solid #444';
        mainContainer.style.borderRadius = '4px';

        // --- TEIL 1: Button-Leiste (Auswählen) ---
        const containerPart1 = document.createElement('div');
        containerPart1.innerHTML = '<h4 style="margin-bottom: 5px;">Schnellauswahl (setzt Freigabe immer auf 2 Tage):</h4>';

        // Die Zahlen-Buttons
        BUTTON_VALUES.forEach(value => {
            const button = document.createElement('button');
            button.innerText = value;
            button.type = 'button';
            button.className = 'btn btn-default btn-xs';
            button.style.margin = '2px';
            
            button.addEventListener('click', () => {
                // Schritt 1: Immer Räume + Verbandsfreigabe auswählen
                selectAllRooms(value);
                
                // Schritt 2: Prüfen, ob die Checkbox aktiv ist
                const checkbox = document.getElementById(CHECKBOX_ID);
                if (checkbox && checkbox.checked) {
                    // Schritt 3: Wenn ja, "Ausbilden" klicken
                    clickAusbildenButton();
                }
            });
            containerPart1.appendChild(button);
        });

        // "Zurücksetzen"-Button (setzt auch Freigabe auf 2 Tage, aber startet nie)
        const zeroButton = document.createElement('button');
        zeroButton.innerText = '0 (Reset)';
        zeroButton.type = 'button';
        zeroButton.className = 'btn btn-danger btn-xs';
        zeroButton.style.margin = '2px 4px';
        zeroButton.addEventListener('click', () => selectAllRooms(0));
        containerPart1.appendChild(zeroButton);

        // Geklonter "Ausbilden"-Button (für manuellen Klick)
        const originalButton = document.querySelector(SUBMIT_BUTTON_SELECTOR);
        if (originalButton) {
            const clonedButton = originalButton.cloneNode(true);
            clonedButton.value = "Ausbilden (Schnellzugriff)";
            clonedButton.className = 'btn btn-success btn-xs';
            clonedButton.style.margin = '2px';
            clonedButton.style.marginLeft = '10px';
            containerPart1.appendChild(clonedButton);
        }
        mainContainer.appendChild(containerPart1);

        // --- TEIL 2: Checkbox zur Verhaltenssteuerung ---
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.margin = '15px 0 5px 0';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = CHECKBOX_ID;
        
        // Gespeicherten Wert laden
        let directStartEnabled = localStorage.getItem(STORAGE_KEY_DIRECT_START) === 'true';
        checkbox.checked = directStartEnabled;

        const label = document.createElement('label');
        label.htmlFor = CHECKBOX_ID;
        label.innerText = ' Nach Auswahl direkt starten (klickt "Ausbilden" automatisch)';
        label.style.marginLeft = '5px';
        label.style.fontWeight = 'normal';

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        mainContainer.appendChild(checkboxContainer);

        // Event Listener, um die Einstellung zu speichern
        checkbox.addEventListener('change', () => {
            localStorage.setItem(STORAGE_KEY_DIRECT_START, checkbox.checked);
        });

        // Alles final einfügen
        insertionPoint.parentNode.insertBefore(mainContainer, insertionPoint);
    }

    // --- MutationObserver (Startpunkt) ---
    const observerCallback = (mutationsList, observer) => {
        const insertionPoint = document.getElementById(INSERTION_POINT_ID);
        const buttonsExist = document.getElementById(BUTTON_CONTAINER_ID);

        if (insertionPoint && !buttonsExist) {
            if (insertionPoint.querySelector('select.empty_rooms_education_selector')) {
                addQuickSelectButtons(insertionPoint);
            }
        }
    };

    const config = { childList: true, subtree: true };
    const observer = new MutationObserver(observerCallback);
    observer.observe(document.body, config);

})();
