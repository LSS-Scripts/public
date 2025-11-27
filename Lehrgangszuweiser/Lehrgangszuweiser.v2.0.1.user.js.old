// ==UserScript==
// @name        Lehrgangszuweiser - Erweitert
// @version     2.0.1
// @license     BSD-3-Clause
// @author      B&M & BOS-Ernie (Hybrid by Gemini)
// @description Fügt Buttons hinzu, um Personen einer Wache auf einmal einem Lehrgang zuzuweisen. Erweitert um automatische Zuweisung basierend auf Mindestanzahl, Vorkenntnissen und Wachenfilter.
// @match       https://www.leitstellenspiel.de/buildings/*
// @match       https://polizei.leitstellenspiel.de/buildings/*
// @match       https://www.leitstellenspiel.de/schoolings/*
// @run-at      document-idle
// @grant       none
// ==/UserScript==

/* global loadedBuildings, schooling_disable, update_schooling_free, update_costs, $, globalEducationKey */

(function () {
  // *** Globale Variablen ***
  let isAutoAssignmentRunning = false;
  let hasScriptBeenFullyInitialized = false;

  const BUILDING_TYPE_NAMES = {
    0: "Feuerwache",
    1: "Feuerwehrschule",
    2: "Rettungswache",
    3: "Rettungsschule",
    4: "Krankenhaus",
    5: "Rettungshubschrauber-Station",
    6: "Polizeiwache",
    7: "Leitstelle",
    8: "Polizeischule",
    9: "THW",
    10: "THW Bundesschule",
    11: "Bereitschaftspolizei",
    12: "Schnelleinsatzgruppe (SEG)",
    13: "Polizeihubschrauberstation",
    14: "Bereitstellungsraum",
    15: "Wasserrettung",
    16: "Verbandszellen",
    17: "Polizei-Sondereinheiten",
    18: "Feuerwache (Kleinwache)",
    19: "Polizeiwache (Kleinwache)",
    20: "Rettungswache (Kleinwache)",
    21: "Rettungshundestaffel",
    22: "Großer Komplex",
    23: "Kleiner Komplex",
    24: "Reiterstaffel",
    25: "Bergrettungswache",
    26: "Seenotrettungswache",
    27: "Schule für Seefahrt und Seenotrettung",
    28: "Hubschrauberstation (Seenotrettung)"
    // Ggf. weitere IDs hier hinzufügen, falls neue Typen im Spiel erscheinen
  };

  function applyBuildingTypeFilter() {
      const filterContainer = document.getElementById('schooling-type-filter-container');
      if (!filterContainer) return;

      // Finde alle inaktiven (roten) Buttons
      const inactiveButtons = filterContainer.querySelectorAll('button:not(.active)');
      const inactiveTypeIds = new Set();
      inactiveButtons.forEach(btn => inactiveTypeIds.add(btn.dataset.buildingTypeId));

      const allBuildingPanels = document.querySelectorAll('.building_list.buildings_searchable');

      allBuildingPanels.forEach(panel => {
          // Wenn keine Filter inaktiv sind, alle anzeigen
          if (inactiveTypeIds.size === 0) {
              panel.style.display = 'block';
          } else {
              // Sonst prüfen, ob die ID des Panels im Set der INAKTIVEN IDs ist
              const panelTypeId = panel.getAttribute('building_type_id');
              if (inactiveTypeIds.has(panelTypeId)) {
                  panel.style.display = 'none'; // Ausblenden
              } else {
                  panel.style.display = 'block'; // Anzeigen
              }
          }
      });
  }

  /**
   * (NEU für Hybrid 2.0.2)
   * Fügt einen Filter für Wachentypen hinzu, speziell für die /schoolings/ Seite.
   * Aktualisiert den Filter, falls er schon existiert (z.B. nach loadAllBuildings).
   */
  function injectBuildingTypeFilter() {
      // Nur auf /schoolings/ ausführen
      if (!window.location.href.includes('/schoolings/')) {
          return;
      }

      console.log("Lehrgangszuweiser: injectBuildingTypeFilter() called (Inverted Logic).");

      // 1. Altes Filter-Panel entfernen, falls vorhanden, um Duplikate zu vermeiden
      const oldContainer = document.getElementById('schooling-type-filter-container');
      if (oldContainer) {
          oldContainer.remove();
      }

      // 2. Finde alle einzigartigen Wachentypen auf der Seite
      const buildingPanels = document.querySelectorAll('.building_list.buildings_searchable');
      const uniqueTypeIds = new Set();
      buildingPanels.forEach(panel => {
          const typeId = panel.getAttribute('building_type_id');
          if (typeId) {
              uniqueTypeIds.add(typeId);
          }
      });

      if (uniqueTypeIds.size === 0) {
          console.log("Lehrgangszuweiser: Keine Wachentypen zum Filtern gefunden.");
          return;
      }

      // 3. Erstelle den Filter-Container
      const filterContainer = document.createElement('div');
      filterContainer.id = "schooling-type-filter-container";
      filterContainer.style.cssText = 'margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;';

      const filterLabel = document.createElement('label');
      filterLabel.textContent = "Wachentyp-Filter (Klick zum Ausblenden):"; // Text angepasst
      filterLabel.style.cssText = 'font-weight: bold; margin: 0;';
      filterContainer.appendChild(filterLabel);

      // 4. Erstelle die Buttons
      const sortedTypeIds = Array.from(uniqueTypeIds).sort((a, b) => parseInt(a) - parseInt(b));

      sortedTypeIds.forEach(typeId => {
          const typeName = BUILDING_TYPE_NAMES[typeId] || `Unbekannt (ID: ${typeId})`;
          const button = document.createElement('button');
          button.type = "button";
          // *** NEUER Standard-Zustand: Grün (success) und 'active' ***
          button.className = "btn btn-success btn-xs active";
          button.dataset.buildingTypeId = typeId;
          button.textContent = typeName;
          button.style.transition = "all 0.2s ease";
          filterContainer.appendChild(button);
      });

      // 5. Injiziere den Container (NACH dem #schooling-advanced-options Panel)
      const advancedOptionsPanel = document.getElementById('schooling-advanced-options');
      if (advancedOptionsPanel) {
          advancedOptionsPanel.parentNode.insertBefore(filterContainer, advancedOptionsPanel.nextSibling);
      } else {
          console.warn("Lehrgangszuweiser: Konnte #schooling-advanced-options nicht finden, um Filter danach einzufügen.");
          const firstBuilding = document.querySelector('.building_list');
          if (firstBuilding) {
               firstBuilding.parentNode.insertBefore(filterContainer, firstBuilding);
          }
      }

      // 6. Füge Event-Handler hinzu (Filterlogik)
      filterContainer.addEventListener('click', (event) => {
          if (event.target.tagName === 'BUTTON') {
              event.preventDefault();
              event.stopPropagation();

              // Toggle 'active' state
              event.target.classList.toggle('active');
              // *** NEUE Toggle-Logik: Grün (success) vs Rot (danger) ***
              event.target.classList.toggle('btn-success');
              event.target.classList.toggle('btn-danger');

              // Führe die Filterung aus
              applyBuildingTypeFilter();
          }
      });

      // 7. Filter direkt anwenden (jetzt nicht mehr nötig, da Standard = an)
      // applyBuildingTypeFilter();
  }

  // *** Hilfsfunktionen ***
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * (NEU aus 2.5.0)
   * Injiziert modernes CSS für das Skript, angepasst an Darkmode.
   * IDs wurden auf die von Version 1.9.8 angepasst (#schooling-advanced-options).
   */
  function injectModernStyles() {
      if (document.getElementById('lehrgangszuweiser-modern-styles')) return;

      const css = `
          /* Modernes Redesign für den Lehrgangszuweiser Darkmode (aus 2.5.0) */

          /* Haupt-Container (ID von 1.9.8) */
          body.dark #schooling-advanced-options {
              background: linear-gradient(to bottom, #3a4a5a, #2c3a4a) !important;
              border: 1px solid #556677 !important;
              border-radius: 8px !important;
              padding: 15px !important;
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.05);
              display: flex !important; /* Flexbox für bessere Anordnung */
              flex-wrap: wrap !important;
              align-items: center !important;
              gap: 10px !important;
          }
          body.dark #schooling-advanced-options label {
              color: #e1e8ed !important;
              font-weight: normal !important;
              text-shadow: 0 1px 1px rgba(0,0,0,0.5);
              margin: 0 !important; /* Zurücksetzen für Flexbox */
          }
          body.dark #schooling-advanced-options .form-control {
               background-color: rgba(0, 0, 0, 0.25) !important;
               border: 1px solid #556677 !important;
               border-radius: 6px !important;
               color: #e1e8ed !important;
               transition: all 0.2s ease !important;
               width: auto !important; /* Automatische Breite im Flex-Layout */
          }
          body.dark #schooling-advanced-options .form-control:focus {
              border-color: #00bcd4 !important;
              box-shadow: 0 0 8px rgba(0, 188, 212, 0.5) !important;
          }
          body.dark #schooling-advanced-options .form-control option {
              background: #2c3a4a !important;
              color: #e1e8ed !important;
          }
          body.dark #schooling-advanced-options select option:checked,
          body.dark #schooling-advanced-options select option:hover {
              background: linear-gradient(45deg, #00A8C5, #007A8F) !important;
              color: #ffffff !important;
          }
          body.dark .schooling-personnel-select-button,
          body.dark .schooling-personnel-reset-button {
              background: #40454a !important;
              color: #b0b8c0 !important;
              border: none !important;
              border-radius: 4px !important;
              transition: all 0.2s ease-in-out !important;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              margin: 0 1px !important;
          }
          body.dark .schooling-personnel-select-button:hover,
          body.dark .schooling-personnel-reset-button:hover {
              color: #ffffff !important;
              background: linear-gradient(45deg, #00bcd4, #0096a9) !important;
              transform: translateY(-2px) scale(1.05);
              box-shadow: 0 4px 10px rgba(0, 188, 212, 0.3);
          }
           body.dark #applyMinPersonnel.btn-primary {
               background: linear-gradient(45deg, #00A8C5, #007A8F) !important;
               border: none !important;
               border-radius: 6px !important;
               transition: all 0.2s ease-in-out !important;
               box-shadow: 0 1px 3px rgba(0,0,0,0.3);
               margin-left: auto !important; /* Button nach rechts schieben */
          }
          body.dark #applyMinPersonnel.btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 10px rgba(0, 168, 197, 0.4);
          }
          body.dark #schooling-type-filter-container {
              background: #2c3a4a !important;
              border: 1px solid #556677 !important;
              border-radius: 8px !important;
              padding: 10px !important;
          }
          body.dark #schooling-type-filter-container label {
              color: #e1e8ed !important;
              font-weight: bold !important;
              text-shadow: 0 1px 1px rgba(0,0,0,0.5);
              margin: 0 !important;
          }
          /* Standard-Zustand (GRÜN / Aktiviert) */
          body.dark #schooling-type-filter-container .btn-success.active {
               background: linear-gradient(45deg, #28a745, #218838) !important; /* Standard Bootstrap Grün */
               border-color: #1e7e34 !important;
               color: #ffffff !important;
               box-shadow: 0 0 8px rgba(40, 167, 69, 0.5) !important;
          }
          body.dark #schooling-type-filter-container .btn-success.active:hover {
               background: linear-gradient(45deg, #2ebf4d, #24993e) !important;
          }

          /* Geklickter-Zustand (ROT / Deaktiviert) - .active ist hier weg */
          body.dark #schooling-type-filter-container .btn-danger {
              background: linear-gradient(45deg, #dc3545, #c82333) !important; /* Standard Bootstrap Rot */
              border-color: #b21f2d !important;
              color: #ffffff !important;
          }
           body.dark #schooling-type-filter-container .btn-danger:hover {
               background: linear-gradient(45deg, #e43a4a, #d42a3a) !important;
          }
      `;
      const style = document.createElement('style');
      style.id = 'lehrgangszuweiser-modern-styles';
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
  }

  /**
   * (NEU aus 2.5.0)
   * Aktualisiert die Anzeige der freien Plätze und färbt sie rot/grün.
   */
  function updateFreeCounterDisplay(newValue) {
      const freeCounterElement = $("#schooling_free");
      freeCounterElement.text(newValue);

      if (newValue >= 0) {
          freeCounterElement.removeClass('label-danger').addClass('label-success');
      } else {
          freeCounterElement.removeClass('label-success').addClass('label-danger');
      }
  }

  /**
   * (NEU aus 2.5.0)
   * *** ÜBERARBEITET (Fix für /schoolings/) ***
   * Ermittelt den 'education_key' des aktuell gewählten Lehrgangs.
   * Prüft 'education_select' (für /buildings/), 'input[name=education]' (alt) und 'globalEducationKey' (für /schoolings/).
   */
  function getTargetEducationKey() {
      // 1. Wahl: Dropdown auf /buildings/ Seite
      const educationSelect = document.getElementById('education_select');
      if (educationSelect && educationSelect.value) {
          return educationSelect.value.split(':')[0];
      }

      // 2. Wahl: Radio-Button (Fallback)
      const radio = $("input[name=education]:checked");
      if (radio.length > 0) {
          return radio.attr("education_key");
      }

      // 3. Wahl: globalEducationKey auf /schoolings/ Seite
      if (typeof globalEducationKey !== 'undefined') {
          return globalEducationKey;
      }

      // Nichts gefunden
      return null;
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Stellt sicher, dass die Personal-Daten für ein Panel geladen sind.
   */
  async function ensurePanelLoadedAndReady(buildingId) {
      const panelHeading = document.querySelector(`.personal-select-heading[building_id='${buildingId}']`);
      const panelBody = document.querySelector(`.panel-body[building_id='${buildingId}']`);
      if (!panelHeading || !panelBody) return;

      const href = panelHeading.getAttribute('href');
      if (!href) return;

      // Globale Variable 'loadedBuildings' aus dem LSS-Kontext
      if (typeof window.loadedBuildings === 'undefined') window.loadedBuildings = [];
      if (!window.loadedBuildings.includes(href) || panelBody.innerHTML.trim() === "") {
          if (!window.loadedBuildings.includes(href)) {
              window.loadedBuildings.push(href);
          }
          // $.get ist asynchron, wir warten mit await darauf
          await $.get(href, (data) => {
              $(panelBody).html(data);
              const educationKey = getTargetEducationKey();
              if (educationKey) {
                  // Globale Funktionen aus dem LSS-Kontext
                  if (typeof schooling_disable === 'function') schooling_disable(educationKey);
                  if (typeof update_schooling_free === 'function') update_schooling_free();
              }
          });
      }
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Erstellt die 1-10 Buttons und den Reset-Button für eine Wache.
   */
  function createPersonnelSelector(buildingId) {
      let buttonGroup = document.createElement("div");
      buttonGroup.id = `schooling-assigner-${buildingId}`;
      buttonGroup.className = "btn-group btn-group-xs";
      buttonGroup.style.marginLeft = "10px";

      let resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.className = "btn btn-default btn-sm schooling-personnel-reset-button";
      resetButton.innerHTML = `<span class="glyphicon glyphicon-trash" data-building-id="${buildingId}"></span>`;
      resetButton.addEventListener("click", resetPersonnelClick);
      buttonGroup.appendChild(resetButton);

      [...Array(10).keys()].map(i => i + 1).forEach(capacity => {
          let button = document.createElement("button");
          button.type = "button";
          button.className = "btn btn-default btn-sm schooling-personnel-select-button";
          button.dataset.buildingId = buildingId;
          button.dataset.capacity = capacity;
          button.textContent = capacity;
          button.addEventListener("click", selectPersonnelClick);
          buttonGroup.appendChild(button);
      });
      return buttonGroup;
  }

  /**
   * (Basis aus 1.9.8)
   * Rendert die Buttons für alle Wachen-Überschriften.
   */
  function renderPersonnelSelectors() {
      console.log("renderPersonnelSelectors called.");
      let elements = document.getElementsByClassName("panel-heading personal-select-heading");
      for (let i = 0; i < elements.length; i++) {
        let buildingId = elements[i].getAttribute("building_id");
        if (buildingId && !elements[i].querySelector(`#schooling-assigner-${buildingId}`)) {
            elements[i].children[0].appendChild(createPersonnelSelector(buildingId));
        }
      }
      // Event-Handler von 1.9.8, angepasst an neue Logik
      $(".personal-select-heading").off("click", panelHeadingClickEvent).on("click", panelHeadingClickEvent);
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Wählt eine bestimmte Anzahl an Personal für eine Wache aus.
   * Nutzt 'requiredEducationKey' zur Prüfung von Voraussetzungen via data-Attribut.
   * Nutzt 'targetEducationKey' um Personal, das den Lehrgang schon hat, zu überspringen.
   */
  async function selectPersonnel(buildingId, capacity, requiredEducationKey = 'none', targetEducationKey = null) {
      await ensurePanelLoadedAndReady(buildingId);
      let free = parseInt($("#schooling_free").text() || '0', 10);
      let assignedInThisRun = 0;

      for (const checkbox of $(`.schooling_checkbox[building_id='${buildingId}']`).get()) {
          if (assignedInThisRun >= capacity) break;
          const $checkbox = $(checkbox);
          if ($checkbox.is(":checked") || $checkbox.is(":disabled")) continue;

          // (Logik 2.5.0) Überspringe, wenn Person Ziel-Ausbildung schon hat
          if (targetEducationKey && $checkbox.attr(targetEducationKey) === 'true') {
              continue;
          }

          let shouldSelect = false;
          if (requiredEducationKey === 'none') {
              // (Logik 2.5.0) Strenge Prüfung: Keine Ausbildung UND kein Fahrzeug
              const educationCell = $(`#school_personal_education_${$checkbox.val()}`);
              const vehicleCell = educationCell.next(); // Fahrzeugzelle
              if (educationCell.text().trim() === "" && vehicleCell.text().trim() === "") {
                  shouldSelect = true;
              }
          } else {
              // (Logik 2.5.0) Prüfung auf 'Education Key'
              if ($checkbox.attr(requiredEducationKey) === 'true') {
                  shouldSelect = true;
              }
          }

          if (shouldSelect) {
              $checkbox.prop("checked", true);
              free--;
              assignedInThisRun++;
          }
      }

      updateFreeCounterDisplay(free); // (NEU aus 2.5.0)
      if (typeof update_costs === 'function') update_costs();
      updateSelectionCounter(buildingId);
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Setzt die Auswahl für eine Wache zurück.
   */
  async function resetPersonnel(buildingId) {
      await ensurePanelLoadedAndReady(buildingId);
      let free = parseInt($("#schooling_free").text() || '0', 10);
      $(`.schooling_checkbox[building_id='${buildingId}']:checked`).each(function () {
          $(this).prop("checked", false);
          free++;
      });

      updateFreeCounterDisplay(free); // (NEU aus 2.5.0)
      if (typeof update_costs === 'function') update_costs();
      updateSelectionCounter(buildingId);
  }

  // --- Click-Handler (Logik aus 2.5.0) ---

  async function selectPersonnelClick(event) {
      event.preventDefault();
      event.stopPropagation();
      // 'none' als 'requiredEducationKey' -> wählt nur Personal ohne Ausbildung/Fahrzeug
      await selectPersonnel(event.target.dataset.buildingId, event.target.dataset.capacity, 'none');
  }

  async function resetPersonnelClick(event) {
      event.preventDefault();
      event.stopPropagation();
      await resetPersonnel(event.target.dataset.buildingId);
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0, angepasst an 1.9.8 ID)
   * Verhindert, dass Klicks auf die Buttons das Panel einklappen.
   * Lädt Panel-Inhalt beim Aufklappen.
   */
  async function panelHeadingClickEvent(event) {
      // Prüft auf Klicks innerhalb der Buttons ODER des neuen Control-Panels
      // ID #schooling-advanced-options ist von 1.9.8
      if ($(event.target).closest(".schooling-personnel-select-button, .schooling-personnel-reset-button, #schooling-advanced-options").length > 0) {
          event.stopPropagation();
          return;
      }

      // Logik zum Nachladen des Panel-Inhalts (aus 1.9.8 / 2.5.0)
      let buildingId = $(event.target).closest('.panel-heading').attr('building_id');
      if (buildingId && $(event.target).closest('.panel-heading').next('.panel-body').is(':hidden')) {
          await ensurePanelLoadedAndReady(buildingId);
      }
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Zählt ausgewähltes Personal pro Wache.
   */
  function countSelectedPersonnel(buildingId) {
      return $(`.schooling_checkbox[building_id='${buildingId}']:checked`).length;
  }

  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Zeigt den Zähler "X ausgewählt" an.
   */
  function updateSelectionCounter(buildingId) {
      const element_id = `personnel-selection-counter-${buildingId}`;
      let counterSpan = $(`#${element_id}`);
      if (counterSpan.length === 0) {
          // (Stil von 1.9.8)
          counterSpan = $("<span>", { id: element_id, class: "label label-primary", style: "margin-left: 5px;" });
          $(`#schooling-assigner-${buildingId}`).parent().prepend(counterSpan);
      }
      counterSpan.text(`${countSelectedPersonnel(buildingId)} ausgewählt`);
  }

  function getPanelHeading(buildingId) {
    return document.querySelector(".personal-select-heading[building_id='" + buildingId + "']");
  }

  function isElementVisible(el) {
      if (!el) return false;
      return el.offsetWidth > 0 || el.offsetHeight > 0;
  }

  // --- NEUE FUNKTIONALITÄT (AUTOMATISCHE ZUWEISUNG) ---

  /**
   * (Überarbeitet - UI aus 2.5.0, angepasst an 1.9.8)
   * *** ÜBERARBEITET (Fix für /schoolings/) ***
   * Fügt die Steuerungs-Box für die automatische Zuweisung hinzu.
   * Baut die "Voraussetzungs"-Liste nur auf, wenn 'education_select' vorhanden ist.
   */
  function addMinPersonnelInputField() {
    console.log("addMinPersonnelInputField (Hybrid 2.0.1) called.");
    let targetHeader = null;
    const h3Elements = document.querySelectorAll('h3');
    for (const h3 of h3Elements) {
        if (h3.textContent.trim() === "Personal auswählen") {
            targetHeader = h3;
            break;
        }
    }

    if (targetHeader) {
        if (document.getElementById('schooling-advanced-options')) return; // Verhindert Duplikate

        let inputContainer = document.createElement('div');
        // ID von 1.9.8 behalten, damit CSS-Anpassung funktioniert
        inputContainer.id = "schooling-advanced-options";
        // Basis-Stile von 1.9.8 (wird von injectModernStyles() überschrieben, falls Darkmode)
        inputContainer.style.cssText = 'margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;';

        // (Logik aus 2.5.0) Dropdown mit 'Education Keys' erstellen
        // *** START FIX ***
        const originalDropdown = document.getElementById('education_select');

        let customDropdownHTML = `<select id="requiredEducationSelect" class="form-control" style="width: auto;">
                                    <option value="none">Ohne andere Ausbildung</option>`;

        if (originalDropdown) {
            // Dropdown existiert (z.B. /buildings/ page), fülle es mit Voraussetzungen
            console.log("Lehrgangszuweiser: 'education_select' gefunden. Baue volle Voraussetzungs-Liste.");
            for (let i = 1; i < originalDropdown.options.length; i++) {
                const option = originalDropdown.options[i];
                const educationKey = option.value.split(':')[0];
                const educationName = option.text.replace(/\s\(\d+\sTage\)/, '');
                if (educationKey) {
                    customDropdownHTML += `<option value="${educationKey}">${educationName}</option>`;
                }
            }
        } else {
            // Dropdown existiert NICHT (z.B. /schoolings/ page)
            // Die Liste wird nur "Ohne andere Ausbildung" enthalten.
            console.log("Lehrgangszuweiser: 'education_select' nicht gefunden. Voraussetzungs-Filter ist auf 'Ohne andere Ausbildung' beschränkt.");
        }
        customDropdownHTML += `</select>`;
        // *** END FIX ***


        // (UI-Layout aus 2.5.0)
        // 'minPersonnelPerBuilding' ID von 1.9.8
        inputContainer.innerHTML = `
            <label for="minPersonnelPerBuilding" style="font-weight: bold; margin: 0;">Anzahl Personal:</label>
            <input type="number" id="minPersonnelPerBuilding" min="0" value="0" class="form-control" style="width: 80px;" title="Wie viele Personen sollen pro Wache zugewiesen werden?">
            <label for="requiredEducationSelect" style="font-weight: bold; margin: 0 0 0 10px;">Voraussetzung:</label>
            ${customDropdownHTML}
            <div style="width: 100%; height: 10px;"></div>
            <label for="stationNameFilter" style="font-weight: bold; margin: 0;">Wachenfilter (Text):</label>
            <input type="text" id="stationNameFilter" class="form-control" placeholder="z.B. Feuerwache Hamburg" style="width: 200px;" title="Nur Wachen berücksichtigen, deren Name so beginnt.">
            <label for="stationNumberFilter" style="font-weight: bold; margin: 0 0 0 10px;">Min. Nummer:</label>
            <input type="number" id="stationNumberFilter" class="form-control" min="0" placeholder="z.B. 161" style="width: 100px;" title="Nur Wachen mit dieser oder einer höheren Nummer berücksichtigen.">
            <button id="applyMinPersonnel" class="btn btn-primary btn-sm" style="margin-left: auto;">Automatisch zuweisen</button>
        `;

        targetHeader.parentNode.insertBefore(inputContainer, targetHeader.nextSibling);

        // Event-Listener von 1.9.8
        document.getElementById('applyMinPersonnel').removeEventListener('click', autoAssignPersonnel);
        document.getElementById('applyMinPersonnel').addEventListener('click', autoAssignPersonnel);

    } else {
        console.warn("Could not find the 'Personal auswählen' header to insert the input field.");
    }
  }

  /**
   * (Basis aus 1.9.8)
   * Lädt alle Wachen durch simuliertes, iteratives Scrollen.
   * Diese Funktion ist robuster als die aus 2.5.0.
   */
  async function loadAllBuildingsByScrolling() {
      console.log("Attempting to load all buildings by simulating scroll (1.9.8 method)...");
      const scrollableElement = document.documentElement; // Der scrollbare Bereich

      let lastScrollTop = -1; // Letzte Scroll-Position
      let previousBuildingCount = 0;
      let currentBuildingCount = 0;
      let noProgressCounter = 0;
      const maxNoProgressAttempts = 15; // Max 15 Versuche ohne neuen Gebäude- oder Scroll-Fortschritt
      const maxTotalScrolls = 300; // Schutz gegen Endlosschleifen
      let currentScrolls = 0;
      const scrollAmountPerStep = window.innerHeight * 0.7;

      while (noProgressCounter < maxNoProgressAttempts && currentScrolls < maxTotalScrolls) {
          previousBuildingCount = document.getElementsByClassName("panel-heading personal-select-heading").length;
          lastScrollTop = scrollableElement.scrollTop;

          scrollableElement.scrollTop += scrollAmountPerStep;

          if (scrollableElement.scrollTop + scrollableElement.clientHeight >= scrollableElement.scrollHeight - 5) {
              scrollableElement.scrollTop = scrollableElement.scrollHeight; // Erzwinge Scroll ans Ende
          }

          await sleep(750); // Pause von 1.9.8

          currentBuildingCount = document.getElementsByClassName("panel-heading personal-select-heading").length;

          if (currentBuildingCount > previousBuildingCount || scrollableElement.scrollTop > lastScrollTop) {
              if (currentBuildingCount > previousBuildingCount) {
                  console.log(`Loaded ${currentBuildingCount - previousBuildingCount} new buildings. Total: ${currentBuildingCount}`);
              } else {
                  console.log(`Scrolled down. Total buildings: ${currentBuildingCount}.`);
              }
              noProgressCounter = 0;
          } else {
              noProgressCounter++;
              console.log(`No progress detected: ${noProgressCounter} / ${maxNoProgressAttempts} attempts.`);
          }

          currentScrolls++;

          if (scrollableElement.scrollTop + scrollableElement.clientHeight >= scrollableElement.scrollHeight - 5) {
              if (noProgressCounter >= 3) {
                  console.log("Reached very bottom and no new buildings for a while. Assuming all loaded.");
                  break;
              }
          }
      }
      console.log(`Finished loading buildings. Final count: ${document.getElementsByClassName("panel-heading personal-select-heading").length} after ${currentScrolls} scroll attempts.`);
      window.scrollTo(0, 0); // Scrolle zurück an den Anfang
  }


  /**
   * (Überarbeitet - Logik aus 2.5.0)
   * Führt die automatische Zuweisung basierend auf den neuen UI-Filtern aus.
   */
  async function autoAssignPersonnel(event) {
    console.log("autoAssignPersonnel (Hybrid 2.0.1) called.");
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (isAutoAssignmentRunning) {
        console.log("Auto-assignment is already running. Please wait.");
        return;
    }
    isAutoAssignmentRunning = true;

    // (Logik aus 2.5.0) Lese neue UI-Felder aus
    const userInputNumber = parseInt($("#minPersonnelPerBuilding").val(), 10); // ID von 1.9.8
    const requiredEducationKey = $("#requiredEducationSelect").val();
    const targetEducationKey = getTargetEducationKey(); // *** Verwendet jetzt die gefixte Funktion ***
    const button = $(event.target); // Button-Handling aus 2.5.0

    // (Logik aus 2.5.0) Lese Filter-Felder aus
    const stationNameFilter = $("#stationNameFilter").val().trim().toLowerCase();
    const stationNumberFilter = parseInt($("#stationNumberFilter").val(), 10);

    // Validierung (aus 2.5.0)
    if (!targetEducationKey) {
        alert("Fehler: Konnte den aktuellen Lehrgang nicht bestimmen. ('targetEducationKey' ist null).");
        isAutoAssignmentRunning = false;
        return;
    }

    if (isNaN(userInputNumber) || userInputNumber < 0) {
        alert("Bitte geben Sie eine gültige positive Zahl für 'Anzahl Personal' ein.");
        isAutoAssignmentRunning = false;
        return;
    }
    if (userInputNumber === 0) {
        alert("Anzahl ist 0. Es wird kein Personal zugewiesen.");
        isAutoAssignmentRunning = false;
        return;
    }

    // (Prüfung aus 2.5.0 / 2.0.1)
    // Wenn 'requiredEducationKey' nicht 'none' ist, aber die Dropdown-Box nicht geladen werden konnte
    // (was 'requiredEducationSelect' auf nur 'none' beschränkt), kann die Zuweisung nicht klappen.
    if (requiredEducationKey !== 'none' && !document.getElementById('education_select')) {
         alert("Fehler: Voraussetzungs-Filter kann auf dieser Seite nicht verwendet werden, da die Haupt-Lehrgangsliste fehlt. Bitte 'Ohne andere Ausbildung' wählen.");
         isAutoAssignmentRunning = false;
         return;
    }


    const originalButtonText = button.text();
    button.text("Lade Wachen...").prop('disabled', true);

    // (Logik aus 1.9.8) Robustes Scrollen
    await loadAllBuildingsByScrolling();
    injectBuildingTypeFilter();
    button.text("Weise zu...");

    let totalAssignedInRun = 0;
    // (Logik aus 2.5.0) Hole alle sichtbaren Wachen-Panels
    const visiblePanelHeadings = $(".panel-heading.personal-select-heading:visible").get();
    console.log(`Starting auto-assignment for ${visiblePanelHeadings.length} currently VISIBLE buildings.`);

    for (const panelHeading of visiblePanelHeadings) {
        let schoolingFree = parseInt($("#schooling_free").text() || '0', 10);
        if (schoolingFree <= 0) break;

        const $panelHeading = $(panelHeading);
        const buildingId = $panelHeading.attr("building_id");

        // (Logik aus 2.5.0) Filterlogik für Wachenname und -nummer
        const buildingSearchName = $panelHeading.closest('.building_list').attr('search_attribute') || '';
        const nameMatch = buildingSearchName.match(/(.*?)\s*(\d+)$/);
        const buildingName = (nameMatch ? nameMatch[1].trim() : buildingSearchName).toLowerCase();
        const buildingNumber = nameMatch ? parseInt(nameMatch[2], 10) : 0;

        if (stationNameFilter && !buildingName.startsWith(stationNameFilter)) {
            continue; // Überspringe, wenn der Name nicht passt
        }
        if (!isNaN(stationNumberFilter) && buildingNumber < stationNumberFilter) {
            continue; // Überspringe, wenn die Nummer zu klein ist
        }
        // Ende Filterlogik

        const alreadySelected = countSelectedPersonnel(buildingId);
        let neededForThisBuilding = 0;

        // (Logik aus 2.5.0) Berechne Bedarf
        if (requiredEducationKey === 'none') {
            // Zähle ausgebildetes Personal (grün) und Personal in Ausbildung (blau)
            const getCountFromLabel = (selector) => {
                const text = $panelHeading.find(selector).text();
                const match = text.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            };
            const trainedCount = getCountFromLabel(".label-success");
            const trainingCount = getCountFromLabel(".label-info");
            const effectivePersonnel = trainedCount + trainingCount + alreadySelected;

            if (effectivePersonnel < userInputNumber) {
                neededForThisBuilding = userInputNumber - effectivePersonnel;
            }
        } else {
            // Zähle verfügbares Personal mit Voraussetzung
            await ensurePanelLoadedAndReady(buildingId);
            const availablePersonnelCheckboxes = $(`.schooling_checkbox[building_id='${buildingId}'][${requiredEducationKey}='true']`)
                                                     .not(`[${targetEducationKey}='true']`) // nicht die, die Ziel schon haben
                                                     .not(':checked').not(':disabled');

            const availableWithPrereq = availablePersonnelCheckboxes.length;
            neededForThisBuilding = Math.min(availableWithPrereq, userInputNumber);
        }

        if (neededForThisBuilding > 0) {
            const assignableCount = Math.min(neededForThisBuilding, schoolingFree);
            // Rufe selectPersonnel mit der neuen Signatur auf
            await selectPersonnel(buildingId, assignableCount, requiredEducationKey, targetEducationKey);
            totalAssignedInRun += (countSelectedPersonnel(buildingId) - alreadySelected);
        }
    }

    alert(`Automatische Zuweisung abgeschlossen. ${totalAssignedInRun} Personen wurden neu zugewiesen.`);
    button.text(originalButtonText).prop('disabled', false);
    isAutoAssignmentRunning = false;
  }

  // --- ENDE NEUE FUNKTIONALITÄT ---

  // --- INITIALISIERUNG DES SKRIPTS (Basis 1.9.8) ---
  function initializeScript() {
    console.log("Lehrgangszuweiser Hybrid 2.0.1: initializeScript() called.");
    if (hasScriptBeenFullyInitialized) {
        console.log("Lehrgangszuweiser Hybrid 2.0.1: Script already initialized, skipping.");
        return;
    }
    hasScriptBeenFullyInitialized = true;

    // (NEU) Style-Injektion
    injectModernStyles();

    setTimeout(() => {
        console.log("Lehrgangszuweiser Hybrid 2.0.1: Delayed initialization start.");
        renderPersonnelSelectors(); // Erstellt Buttons
        addMinPersonnelInputField(); // Fügt das Eingabefeld und den Button hinzu
        injectBuildingTypeFilter();

        console.log("Lehrgangszuweiser Hybrid 2.0.1: Initialisation complete.");
    }, 2000); // 2 Sekunden Verzögerung von 1.9.8
  }

  // Die main-Funktion steuert den Startpunkt des Skripts (Basis 1.9.8)
  function main() {
    console.log("Lehrgangszuweiser Hybrid 2.0.1: main() called.");
    if (window.location.href.match(/\/buildings\/\d+\/hire/)) {
      console.log("Lehrgangszuweiser Hybrid 2.0.1: Skipping hire personnel page.");
      return;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript);
        console.log("Lehrgangszuweiser Hybrid 2.0.1: Added DOMContentLoaded listener.");
    } else {
        initializeScript();
        console.log("Lehrgangszuweiser Hybrid 2.0.1: DOM already loaded, initializing directly.");
    }
  }

  main();
})();
