// ==UserScript==
// @name         Leitstellenspiel - Schnellauswahl Schulräume
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Automatischer Reset vor Neuauswahl. Setzt Verbandsfreigabe & wählt Räume (optional mit Auto-Start).
// @author       Masklin & Gemini
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
    const CHECKBOX_ID = 'lss_direct_start_checkbox';
    const STORAGE_KEY_DIRECT_START = 'lss_direct_start_enabled';
    const ALLIANCE_DURATION_ID = 'alliance_duration';
    const ALLIANCE_DURATION_VALUE = '172800'; // "2 Tage"

    // --- Logik-Funktionen ---

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
     * Setzt Verbandsfreigabe, resettet alle Räume auf 0, und setzt dann den neuen Wert.
     */
    function selectAllRooms(numberToSelect) {
        
        // --- Schritt 1: Verbandsfreigabe immer auf "2 Tage" setzen ---
        const allianceDurationSelect = document.getElementById(ALLIANCE_DURATION_ID);
        if (allianceDurationSelect) {
            allianceDurationSelect.value = ALLIANCE_DURATION_VALUE;
            allianceDurationSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const allSelects = document.querySelectorAll(`select.empty_rooms_education_selector`);

        // --- Schritt 2: RESET-SCHLEIFE ---
        // Setze ZUERST alle auf 0, damit die Zählung der Seite zurückgesetzt wird.
        allSelects.forEach(select => {
            const educationKey = select.dataset.educationKey;
            if (!educationKey) return;
            const zeroValue = `${educationKey}:0`;
            const zeroOption = select.querySelector(`option[value="${zeroValue}"]`);
            if (zeroOption) {
                if (select.value !== zeroValue) { // Nur ändern, wenn nicht schon 0
                    select.value = zeroValue;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        
        // --- Schritt 3: AUSWAHL-SCHLEIFE ---
        // Setze jetzt den gewünschten Wert (z.B. 30).
        // (Wenn "0 (Reset)" geklickt wurde, ist numberToSelect 0,
        // und dieser Block setzt einfach alles nochmal auf 0, was OK ist)
        allSelects.forEach(select => {
            const educationKey = select.dataset.educationKey;
            if (!educationKey) return;
            const targetValue = `${educationKey}:${numberToSelect}`;
            const targetOption = select.querySelector(`option[value="${targetValue}"]`);

            if (targetOption) {
                // Wert (z.B. 30) ist verfügbar
                select.value = targetValue;
            } else if (numberToSelect > 0) { 
                // Wert ist nicht verfügbar (z.B. 300 geklickt, aber nur 100 max)
                // Wähle den höchsten verfügbaren Wert (die letzte Option)
                const lastOption = select.querySelector('option:last-child');
                if (lastOption) select.value = lastOption.value;
            }
            // (Der 'else'-Fall für numberToSelect === 0 ist bereits durch Reset-Schleife abgedeckt)
            
            // Sende das Change-Event für den neuen Wert
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    /**
     * Erstellt die komplette UI
     */
    function addQuickSelectButtons(insertionPoint) {
        const mainContainer = document.createElement('div');
        mainContainer.id = BUTTON_CONTAINER_ID;
        mainContainer.style.marginBottom = '20px';
        mainContainer.style.padding = '10px';
        mainContainer.style.border = '1.5px solid #444';
        mainContainer.style.borderRadius = '4px';

        const containerPart1 = document.createElement('div');
        containerPart1.innerHTML = '<h4 style="margin-bottom: 5px;">Schnellauswahl (setzt Freigabe immer auf 2 Tage):</h4>';

        BUTTON_VALUES.forEach(value => {
            const button = document.createElement('button');
            button.innerText = value;
            button.type = 'button';
            button.className = 'btn btn-default btn-xs';
            button.style.margin = '2px';
            button.addEventListener('click', () => {
                // Führt Reset + Neuauswahl aus
                selectAllRooms(value);
                
                // Prüft, ob Auto-Start aktiv ist
                const checkbox = document.getElementById(CHECKBOX_ID);
                if (checkbox && checkbox.checked) {
                    clickAusbildenButton();
                }
            });
            containerPart1.appendChild(button);
        });

        // "Zurücksetzen"-Button (führt nur selectAllRooms(0) aus)
        const zeroButton = document.createElement('button');
        zeroButton.innerText = '0 (Reset)';
        zeroButton.type = 'button';
        zeroButton.className = 'btn btn-danger btn-xs';
        zeroButton.style.margin = '2px 4px';
        zeroButton.addEventListener('click', () => selectAllRooms(0));
        containerPart1.appendChild(zeroButton);

        // Geklonter "Ausbilden"-Button
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

        // Checkbox für Auto-Start
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.margin = '15px 0 5px 0';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = CHECKBOX_ID;
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

        checkbox.addEventListener('change', () => {
            localStorage.setItem(STORAGE_KEY_DIRECT_START, checkbox.checked);
        });

        insertionPoint.parentNode.insertBefore(mainContainer, insertionPoint);
    }

    // --- Observer-Logik (unverändert) ---

    let targetObserver = null; 

    function controlButtonsVisibility(targetElement) {
        let buttons = document.getElementById(BUTTON_CONTAINER_ID);
        const isVisible = (targetElement.style.display === 'block');
        const hasSelects = targetElement.querySelector('select.empty_rooms_education_selector');

        if (isVisible && hasSelects) {
            if (!buttons) {
                addQuickSelectButtons(targetElement);
            } else {
                buttons.style.display = 'block';
            }
        } else {
            if (buttons) {
                buttons.style.display = 'none';
            }
        }
    }

    const targetObserverCallback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                controlButtonsVisibility(mutation.target);
            }
        }
    };

    const bodyObserverCallback = (mutationsList, observer) => {
        const insertionPoint = document.getElementById(INSERTION_POINT_ID);
        
        if (insertionPoint) {
            observer.disconnect();
            controlButtonsVisibility(insertionPoint);
            targetObserver = new MutationObserver(targetObserverCallback);
            targetObserver.observe(insertionPoint, { 
                attributes: true, 
                attributeFilter: ['style']
            });
        }
    };

    const bodyObserver = new MutationObserver(bodyObserverCallback);
    bodyObserver.observe(document.body, { childList: true, subtree: true });

})();
