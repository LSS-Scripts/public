// ==UserScript==
// @name        Lehrgangszuweiser - Erweitert (Sicherheits-Bremse)
// @version     2.10.0
// @license     BSD-3-Clause
// @author      B&M & BOS-Ernie (Hybrid by Gemini)
// @description Fügt Buttons hinzu, um Personen einer Wache auf einmal einem Lehrgang zuzuweisen. Version 2.10.0: Scroll-Tempo gedrosselt (250ms Zwangspause), um Ladefehler bei schnellen Browsern zu verhindern.
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
  let cachedBuildingData = null;

  const BUILDING_TYPE_NAMES = {
    0: "Feuerwache", 1: "Feuerwehrschule", 2: "Rettungswache", 3: "Rettungsschule", 4: "Krankenhaus",
    5: "Rettungshubschrauber-Station", 6: "Polizeiwache", 7: "Leitstelle", 8: "Polizeischule", 9: "THW",
    10: "THW Bundesschule", 11: "Bereitschaftspolizei", 12: "Schnelleinsatzgruppe (SEG)", 13: "Polizeihubschrauberstation",
    14: "Bereitstellungsraum", 15: "Wasserrettung", 16: "Verbandszellen", 17: "Polizei-Sondereinheiten",
    18: "Feuerwache (Kleinwache)", 19: "Polizeiwache (Kleinwache)", 20: "Rettungswache (Kleinwache)",
    21: "Rettungshundestaffel", 22: "Großer Komplex", 23: "Kleiner Komplex", 24: "Reiterstaffel",
    25: "Bergrettungswache", 26: "Seenotrettungswache", 27: "Schule für Seefahrt und Seenotrettung",
    28: "Hubschrauberstation (Seenotrettung)"
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // *** STATUS BAR FUNKTIONEN ***
  function injectStatusBar() {
      const freeCounter = $("#schooling_free");
      if (freeCounter.length === 0 || $("#lss-assigner-status").length > 0) return;
      freeCounter.parent().prepend($('<span id="lss-assigner-status" class="label label-warning" style="margin-right: 15px; font-size: 110%; display:none; padding: .4em .8em;">Bereit</span>'));
  }

  function updateStatus(text, colorClass = "label-warning") {
      const statusEl = $("#lss-assigner-status");
      if (statusEl.length === 0) return;
      statusEl.text(text).removeClass("label-warning label-danger label-success label-info").addClass(colorClass).show();
  }

  function hideStatus() { $("#lss-assigner-status").fadeOut(2000); }

  // *** API Handling ***
  async function getBuildingApiData() {
      if (cachedBuildingData) return cachedBuildingData;
      const storageKey = "lss_lehrgangszuweiser_building_data";
      const storedData = sessionStorage.getItem(storageKey);

      if (storedData) {
          try {
              cachedBuildingData = mapBuildingsById(JSON.parse(storedData));
              return cachedBuildingData;
          } catch (e) { console.warn("Cache error"); }
      }

      updateStatus("Lade API...", "label-info");
      const extSelect = document.getElementById('extensionFilterSelect');
      if(extSelect) extSelect.options[0].text = "Lade API Daten...";

      return new Promise((resolve, reject) => {
          $.getJSON('/api/buildings', (data) => {
              sessionStorage.setItem(storageKey, JSON.stringify(data));
              cachedBuildingData = mapBuildingsById(data);
              resolve(cachedBuildingData);
          }).fail((err) => reject(err));
      });
  }

  function mapBuildingsById(data) {
      const map = {};
      data.forEach(building => map[building.id] = building);
      return map;
  }

  function extractRelevantExtensions(buildingMap) {
      const visibleBuildingElements = document.querySelectorAll('.panel-heading.personal-select-heading');
      const uniqueExtensions = new Set();

      visibleBuildingElements.forEach(element => {
          const buildingId = element.getAttribute('building_id');
          const buildingData = buildingMap[buildingId];

          if (buildingData && buildingData.extensions) {
              buildingData.extensions.forEach(ext => {
                  uniqueExtensions.add(ext.caption);
              });
          }
      });
      return Array.from(uniqueExtensions).sort();
  }

  async function populateExtensionDropdown() {
      const select = document.getElementById('extensionFilterSelect');
      if (!select) return;
      try {
          const data = await getBuildingApiData();
          const extensions = extractRelevantExtensions(data);

          select.innerHTML = '<option value="none">Keine Filterung (Erweiterung)</option>';
          if (extensions.length === 0) {
              const option = document.createElement('option');
              option.text = "(Keine Erweiterungen bei diesen Wachen)";
              option.disabled = true;
              select.appendChild(option);
          } else {
              extensions.forEach(extName => {
                  const option = document.createElement('option');
                  option.value = extName;
                  option.textContent = extName;
                  select.appendChild(option);
              });
          }
          select.disabled = false;
          updateStatus("API Bereit", "label-success");
          setTimeout(() => $("#lss-assigner-status").hide(), 1000);
      } catch (e) { if (select) select.options[0].text = "Fehler (API)"; }
  }

  // *** UI Styling ***
  function injectModernStyles() {
      if (document.getElementById('lehrgangszuweiser-modern-styles')) return;
      const css = `
          body.dark #schooling-advanced-options { background: linear-gradient(to bottom, #3a4a5a, #2c3a4a) !important; border: 1px solid #556677 !important; border-radius: 8px !important; padding: 15px !important; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.05); display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 10px !important; }
          body.dark #schooling-advanced-options label { color: #e1e8ed !important; font-weight: normal !important; margin: 0 !important; cursor: pointer; }
          body.dark #schooling-advanced-options .form-control { background-color: rgba(0, 0, 0, 0.25) !important; border: 1px solid #556677 !important; color: #e1e8ed !important; width: auto !important; }
          body.dark #schooling-advanced-options select option { background-color: #2c3a4a !important; color: #e1e8ed !important; }
          body.dark #schooling-advanced-options select:focus option:checked { background-color: #00bcd4 !important; color: #ffffff !important; }
          body.dark #schooling-type-filter-container { background: #2c3a4a !important; border: 1px solid #556677 !important; }
          body.dark #schooling-type-filter-container label { color: #e1e8ed !important; }
      `;
      const style = document.createElement('style');
      style.id = 'lehrgangszuweiser-modern-styles';
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
  }

  // *** Helper ***
  function updateFreeCounterDisplay(newValue) {
      const freeCounterElement = $("#schooling_free");
      freeCounterElement.text(newValue);
      newValue >= 0 ? freeCounterElement.removeClass('label-danger').addClass('label-success') : freeCounterElement.removeClass('label-success').addClass('label-danger');
  }

  function getTargetEducationKey() {
      const educationSelect = document.getElementById('education_select');
      if (educationSelect && educationSelect.value) return educationSelect.value.split(':')[0];
      const radio = $("input[name=education]:checked");
      if (radio.length > 0) return radio.attr("education_key");
      if (typeof globalEducationKey !== 'undefined') return globalEducationKey;
      return null;
  }

  async function ensurePanelLoadedAndReady(buildingId) {
      const panelHeading = document.querySelector(`.personal-select-heading[building_id='${buildingId}']`);
      const panelBody = document.querySelector(`.panel-body[building_id='${buildingId}']`);
      if (!panelHeading || !panelBody) return;
      const href = panelHeading.getAttribute('href');
      if (!href) return;

      if (typeof window.loadedBuildings === 'undefined') window.loadedBuildings = [];
      if (!window.loadedBuildings.includes(href) || panelBody.innerHTML.trim() === "") {
          if (!window.loadedBuildings.includes(href)) window.loadedBuildings.push(href);
          await $.get(href, (data) => {
              $(panelBody).html(data);
              const educationKey = getTargetEducationKey();
              if (educationKey) {
                  if (typeof schooling_disable === 'function') schooling_disable(educationKey);
                  if (typeof update_schooling_free === 'function') update_schooling_free();
              }
          });
          await sleep(100);
      }
  }

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

  function renderPersonnelSelectors() {
      let elements = document.getElementsByClassName("panel-heading personal-select-heading");
      for (let i = 0; i < elements.length; i++) {
        let buildingId = elements[i].getAttribute("building_id");
        if (buildingId && !elements[i].querySelector(`#schooling-assigner-${buildingId}`)) {
            elements[i].children[0].appendChild(createPersonnelSelector(buildingId));
        }
      }
      $(".personal-select-heading").off("click", panelHeadingClickEvent).on("click", panelHeadingClickEvent);
  }

  async function selectPersonnel(buildingId, capacity, requiredEducationKey = 'none', targetEducationKey = null) {
      await ensurePanelLoadedAndReady(buildingId);
      let free = parseInt($("#schooling_free").text() || '0', 10);
      let assignedInThisRun = 0;

      const checkboxes = $(`.schooling_checkbox[building_id='${buildingId}']`).get();
      for (const checkbox of checkboxes) {
          if (assignedInThisRun >= capacity) break;
          const $checkbox = $(checkbox);
          if ($checkbox.is(":checked") || $checkbox.is(":disabled")) continue;
          if (targetEducationKey && $checkbox.attr(targetEducationKey) === 'true') continue;

          let shouldSelect = false;
          if (requiredEducationKey === 'none') {
              const educationCell = $(`#school_personal_education_${$checkbox.val()}`);
              const vehicleCell = educationCell.next();
              const eduText = educationCell.text().replace(/\s|&nbsp;/g, '').trim();
              const vehText = vehicleCell.text().replace(/\s|&nbsp;/g, '').trim();
              if (eduText === "" && vehText === "") shouldSelect = true;
          } else {
              if ($checkbox.attr(requiredEducationKey) === 'true') shouldSelect = true;
          }

          if (shouldSelect) {
              $checkbox.prop("checked", true);
              free--;
              assignedInThisRun++;
          }
      }

      updateFreeCounterDisplay(free);
      if (typeof update_costs === 'function') update_costs();
      updateSelectionCounter(buildingId);
  }

  async function resetPersonnel(buildingId) {
      await ensurePanelLoadedAndReady(buildingId);
      let free = parseInt($("#schooling_free").text() || '0', 10);
      $(`.schooling_checkbox[building_id='${buildingId}']:checked`).each(function () {
          $(this).prop("checked", false);
          free++;
      });
      updateFreeCounterDisplay(free);
      if (typeof update_costs === 'function') update_costs();
      updateSelectionCounter(buildingId);
  }

  async function selectPersonnelClick(event) {
      event.preventDefault();
      event.stopPropagation();
      await selectPersonnel(event.target.dataset.buildingId, event.target.dataset.capacity, 'none');
  }

  async function resetPersonnelClick(event) {
      event.preventDefault();
      event.stopPropagation();
      await resetPersonnel(event.target.dataset.buildingId);
  }

  async function panelHeadingClickEvent(event) {
      if ($(event.target).closest(".schooling-personnel-select-button, .schooling-personnel-reset-button, #schooling-advanced-options").length > 0) {
          event.stopPropagation();
          return;
      }
      let buildingId = $(event.target).closest('.panel-heading').attr('building_id');
      if (buildingId && $(event.target).closest('.panel-heading').next('.panel-body').is(':hidden')) {
          await ensurePanelLoadedAndReady(buildingId);
      }
  }

  function countSelectedPersonnel(buildingId) {
      return $(`.schooling_checkbox[building_id='${buildingId}']:checked`).length;
  }

  function updateSelectionCounter(buildingId) {
      const element_id = `personnel-selection-counter-${buildingId}`;
      let counterSpan = $(`#${element_id}`);
      if (counterSpan.length === 0) {
          counterSpan = $("<span>", { id: element_id, class: "label label-primary", style: "margin-left: 5px;" });
          $(`#schooling-assigner-${buildingId}`).parent().prepend(counterSpan);
      }
      counterSpan.text(`${countSelectedPersonnel(buildingId)} ausgewählt`);
  }

  function injectBuildingTypeFilter() {
      if (!window.location.href.includes('/schoolings/')) return;
      const oldContainer = document.getElementById('schooling-type-filter-container');
      if (oldContainer) oldContainer.remove();
      const buildingPanels = document.querySelectorAll('.building_list.buildings_searchable');
      const uniqueTypeIds = new Set();
      buildingPanels.forEach(panel => {
          const typeId = panel.getAttribute('building_type_id');
          if (typeId) uniqueTypeIds.add(typeId);
      });
      if (uniqueTypeIds.size === 0) return;
      const filterContainer = document.createElement('div');
      filterContainer.id = "schooling-type-filter-container";
      filterContainer.style.cssText = 'margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;';
      const filterLabel = document.createElement('label');
      filterLabel.textContent = "Wachentyp-Filter:";
      filterLabel.style.cssText = 'font-weight: bold; margin: 0;';
      filterContainer.appendChild(filterLabel);
      const sortedTypeIds = Array.from(uniqueTypeIds).sort((a, b) => parseInt(a) - parseInt(b));
      sortedTypeIds.forEach(typeId => {
          const typeName = BUILDING_TYPE_NAMES[typeId] || `Unbekannt (ID: ${typeId})`;
          const button = document.createElement('button');
          button.type = "button";
          button.className = "btn btn-success btn-xs active";
          button.dataset.buildingTypeId = typeId;
          button.textContent = typeName;
          button.style.transition = "all 0.2s ease";
          filterContainer.appendChild(button);
      });
      const advancedOptionsPanel = document.getElementById('schooling-advanced-options');
      if (advancedOptionsPanel) advancedOptionsPanel.parentNode.insertBefore(filterContainer, advancedOptionsPanel.nextSibling);
      else { const firstBuilding = document.querySelector('.building_list'); if (firstBuilding) firstBuilding.parentNode.insertBefore(filterContainer, firstBuilding); }
      filterContainer.addEventListener('click', (event) => {
          if (event.target.tagName === 'BUTTON') {
              event.preventDefault();
              event.stopPropagation();
              event.target.classList.toggle('active');
              event.target.classList.toggle('btn-success');
              event.target.classList.toggle('btn-danger');
              const inactiveButtons = filterContainer.querySelectorAll('button:not(.active)');
              const inactiveTypeIds = new Set();
              inactiveButtons.forEach(btn => inactiveTypeIds.add(btn.dataset.buildingTypeId));
              const allBuildingPanels = document.querySelectorAll('.building_list.buildings_searchable');
              allBuildingPanels.forEach(panel => {
                  if (inactiveTypeIds.size === 0) { panel.style.display = 'block'; }
                  else {
                      const panelTypeId = panel.getAttribute('building_type_id');
                      if (inactiveTypeIds.has(panelTypeId)) panel.style.display = 'none';
                      else panel.style.display = 'block';
                  }
              });
          }
      });
  }

  // --- AUTO ASSIGN LOGIC ---

  function addMinPersonnelInputField() {
    let targetHeader = null;
    const h3Elements = document.querySelectorAll('h3');
    for (const h3 of h3Elements) {
        if (h3.textContent.trim() === "Personal auswählen") { targetHeader = h3; break; }
    }
    if (targetHeader) {
        if (document.getElementById('schooling-advanced-options')) return;
        let inputContainer = document.createElement('div');
        inputContainer.id = "schooling-advanced-options";
        inputContainer.style.cssText = 'margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;';

        const originalDropdown = document.getElementById('education_select');
        let customDropdownHTML = `<select id="requiredEducationSelect" class="form-control" style="width: auto;"><option value="none">Ohne andere Ausbildung</option>`;
        if (originalDropdown) {
            for (let i = 1; i < originalDropdown.options.length; i++) {
                const option = originalDropdown.options[i];
                const educationKey = option.value.split(':')[0];
                const educationName = option.text.replace(/\s\(\d+\sTage\)/, '');
                if (educationKey) customDropdownHTML += `<option value="${educationKey}">${educationName}</option>`;
            }
        }
        customDropdownHTML += `</select>`;

        const extensionDropdownHTML = `<select id="extensionFilterSelect" class="form-control" style="width: auto;" disabled><option value="none">Lade Erweiterungen...</option></select>`;

        inputContainer.innerHTML = `
            <label for="minPersonnelPerBuilding" style="font-weight: bold;">Anzahl:</label>
            <input type="number" id="minPersonnelPerBuilding" min="0" value="0" class="form-control" style="width: 70px;">
            <div class="checkbox" style="margin: 0; padding: 0;">
                <label style="font-size: 11px; margin-left: 5px;" title="Wenn angehakt, wird vorhandenes Personal ignoriert und immer X NEUE Leute ausgewählt.">
                    <input type="checkbox" id="ignoreExistingCount"> Vorhandene ignorieren
                </label>
            </div>
            <div style="flex-basis: 100%; height: 5px;"></div>
            <label for="requiredEducationSelect" style="font-weight: bold;">Vorwissen:</label>
            ${customDropdownHTML}
            <label for="extensionFilterSelect" style="font-weight: bold;">Gebäude-Erw.:</label>
            ${extensionDropdownHTML}
            <div style="flex-basis: 100%; height: 5px;"></div>
            <label for="stationNameFilter" style="font-weight: bold;">Name:</label>
            <input type="text" id="stationNameFilter" class="form-control" placeholder="Wachenname..." style="width: 150px;">
            <label for="stationNumberFilter" style="font-weight: bold;">Nr ab:</label>
            <input type="number" id="stationNumberFilter" class="form-control" min="0" placeholder="100" style="width: 80px;">
            <button id="applyMinPersonnel" class="btn btn-primary btn-sm" style="margin-left: auto;">Auto Zuweisen</button>
        `;
        targetHeader.parentNode.insertBefore(inputContainer, targetHeader.nextSibling);
        document.getElementById('applyMinPersonnel').addEventListener('click', autoAssignPersonnel);
        populateExtensionDropdown();
    }
  }

  async function loadAllBuildingsByScrolling() {
      const scrollableElement = document.documentElement;
      let lastScrollTop = -1;
      let noProgressCounter = 0;
      let hardStopCounter = 0;
      const maxNoProgressAttempts = 10;
      const maxTotalScrolls = 300;
      let currentScrolls = 0;
      updateStatus("Scrolle... (Seite wird länger)", "label-info");

      while (noProgressCounter < maxNoProgressAttempts && currentScrolls < maxTotalScrolls) {
          let previousBuildingCount = document.getElementsByClassName("panel-heading personal-select-heading").length;
          lastScrollTop = scrollableElement.scrollTop;
          scrollableElement.scrollTop += window.innerHeight * 0.7;

          // *** BREMSE ***
          await sleep(250); // Pause für Render-Engine

          const isAtBottom = (scrollableElement.scrollTop + scrollableElement.clientHeight >= scrollableElement.scrollHeight - 10);
          if (isAtBottom) scrollableElement.scrollTop = scrollableElement.scrollHeight;

          await sleep(500);
          let currentBuildingCount = document.getElementsByClassName("panel-heading personal-select-heading").length;

          if (currentBuildingCount > previousBuildingCount) {
              noProgressCounter = 0;
              hardStopCounter = 0;
              updateStatus(`Lade... (${currentBuildingCount} Wachen)`, "label-info");
          } else {
              if (isAtBottom) {
                  hardStopCounter++;
                  if (hardStopCounter >= 3) break;
              } else if (scrollableElement.scrollTop > lastScrollTop) noProgressCounter = 0;
              else noProgressCounter++;
          }
          currentScrolls++;
      }
      window.scrollTo(0, 0);
  }

  async function autoAssignPersonnel(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (isAutoAssignmentRunning) return;
    isAutoAssignmentRunning = true;

    const userInputNumber = parseInt($("#minPersonnelPerBuilding").val(), 10);
    const requiredEducationKey = $("#requiredEducationSelect").val();
    const targetEducationKey = getTargetEducationKey();
    const stationNameFilter = $("#stationNameFilter").val().trim().toLowerCase();
    const stationNumberFilter = parseInt($("#stationNumberFilter").val(), 10);
    const extensionFilterValue = $("#extensionFilterSelect").val();
    const ignoreExisting = $("#ignoreExistingCount").is(":checked");
    const button = $(event.target);

    if (!targetEducationKey) { alert("Fehler: Ziel-Lehrgang nicht erkannt."); isAutoAssignmentRunning = false; return; }
    if (isNaN(userInputNumber) || userInputNumber < 0) { alert("Bitte gültige Zahl eingeben."); isAutoAssignmentRunning = false; return; }
    if (userInputNumber === 0) { alert("Anzahl ist 0."); isAutoAssignmentRunning = false; return; }

    let buildingApiMap = null;
    if (extensionFilterValue && extensionFilterValue !== 'none') {
         button.text("Lade API...");
         updateStatus("Prüfe Erweiterungen...", "label-warning");
         try {
             buildingApiMap = await getBuildingApiData();
         } catch(e) {
             alert("Fehler API"); isAutoAssignmentRunning = false; button.text("Auto Zuweisen"); updateStatus("Fehler", "label-danger"); return;
         }
    }

    const originalButtonText = button.text();
    button.text("Aktiv...").prop('disabled', true);

    await loadAllBuildingsByScrolling();
    updateStatus("Verarbeite Daten...", "label-warning");
    button.text("Filtere...");
    await sleep(200);

    injectBuildingTypeFilter();
    button.text("Weise zu...");

    let totalAssignedInRun = 0;
    const visiblePanelHeadings = $(".panel-heading.personal-select-heading:visible").get();
    const totalPanels = visiblePanelHeadings.length;
    updateStatus(`Starte Zuweisung (0/${totalPanels})`, "label-warning");

    for (let i = 0; i < totalPanels; i++) {
        if (i % 10 === 0) {
            updateStatus(`Prüfe Wache ${i+1}/${totalPanels}...`, "label-warning");
            await sleep(0);
        }

        let schoolingFree = parseInt($("#schooling_free").text() || '0', 10);
        if (schoolingFree <= 0) break;

        const $panelHeading = $(visiblePanelHeadings[i]);
        const buildingId = $panelHeading.attr("building_id");

        const buildingSearchName = $panelHeading.closest('.building_list').attr('search_attribute') || '';
        const nameMatch = buildingSearchName.match(/(.*?)\s*(\d+)$/);
        const buildingName = (nameMatch ? nameMatch[1].trim() : buildingSearchName).toLowerCase();
        const buildingNumber = nameMatch ? parseInt(nameMatch[2], 10) : 0;

        if (stationNameFilter && !buildingName.startsWith(stationNameFilter)) continue;
        if (!isNaN(stationNumberFilter) && buildingNumber < stationNumberFilter) continue;

        // *** STRICT API EXTENSION CHECK (AVAILABLE: TRUE) ***
        if (extensionFilterValue && extensionFilterValue !== 'none' && buildingApiMap) {
            const bData = buildingApiMap[buildingId];
            if (!bData) continue;

            const ext = bData.extensions.find(e => e.caption === extensionFilterValue);

            // FIX: Nur AVAILABLE prüfen, damit auch deaktivierte (aber gebaute) Wachen zählen
            if (!ext || !ext.available) continue;
        }

        const alreadySelected = countSelectedPersonnel(buildingId);
        let neededForThisBuilding = 0;

        if (requiredEducationKey === 'none') {
            if (ignoreExisting) {
                neededForThisBuilding = userInputNumber;
            } else {
                const getCountFromLabel = (selector) => {
                    const text = $panelHeading.find(selector).text();
                    const match = text.match(/\d+/);
                    return match ? parseInt(match[0], 10) : 0;
                };
                const trainedCount = getCountFromLabel(".label-success");
                const trainingCount = getCountFromLabel(".label-info");
                const effectivePersonnel = trainedCount + trainingCount + alreadySelected;
                console.log(`[LSS-Debug] Wache ${buildingId}: Ziel ${userInputNumber} - (Grün ${trainedCount} + Blau ${trainingCount}) = Bedarf ${Math.max(0, userInputNumber - effectivePersonnel)}`);
                if (effectivePersonnel < userInputNumber) neededForThisBuilding = userInputNumber - effectivePersonnel;
            }
        } else {
            await ensurePanelLoadedAndReady(buildingId);
            const availablePersonnelCheckboxes = $(`.schooling_checkbox[building_id='${buildingId}'][${requiredEducationKey}='true']`)
                                                     .not(`[${targetEducationKey}='true']`).not(':checked').not(':disabled');
            const availableWithPrereq = availablePersonnelCheckboxes.length;
            neededForThisBuilding = Math.min(availableWithPrereq, userInputNumber);
        }

        if (neededForThisBuilding > 0) {
            const assignableCount = Math.min(neededForThisBuilding, schoolingFree);
            await selectPersonnel(buildingId, assignableCount, requiredEducationKey, targetEducationKey);
            totalAssignedInRun += (countSelectedPersonnel(buildingId) - alreadySelected);
        }
    }

    updateStatus(`FERTIG! ${totalAssignedInRun} Personen gewählt`, "label-success");
    button.text(originalButtonText).prop('disabled', false);
    isAutoAssignmentRunning = false;
  }

  function initializeScript() {
    if (hasScriptBeenFullyInitialized) return;
    hasScriptBeenFullyInitialized = true;
    injectModernStyles();
    setTimeout(() => {
        renderPersonnelSelectors();
        addMinPersonnelInputField();
        injectBuildingTypeFilter();
        injectStatusBar();
    }, 2000);
  }

  function main() {
    if (window.location.href.match(/\/buildings\/\d+\/hire/)) return;
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeScript); }
    else { initializeScript(); }
  }

  main();
})();
