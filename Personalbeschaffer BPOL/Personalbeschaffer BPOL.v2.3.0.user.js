// ==UserScript==
// @name        BePo Personalbeschaffer V.2.3 (Multi-Training Support)
// @namespace   bos-ernie.leitstellenspiel.de
// @version     2.3
// @license     BSD-3-Clause
// @author      BOS-Ernie (Original), Verändert BAHendrik, Masklin & KI
// @description Bekämpft den Personalnotstand der BePo. Jetzt mit Unterstützung für spezifische Ausbildungen im Einstellungsmenü.
// @match       https://www.leitstellenspiel.de/buildings/*/hire
// @run-at      document-idle
// @grant       none
// ==/UserScript==

/* global $, loadedBuildings, GM_info */

(function () {
  "use strict";

  // --- STANDARDWERTE ---
  const DEFAULT_CONFIG = {
      targets: {},            // Speichert Ziele pro Typ (key: anzahl)
      minRemaining: 200,      // Mindestpersonal pro Wache
      maxTake: 50,            // Maximale Entnahme pro Wache
      exclusions: "BPOL",     // Wachen ausschließen (Kommagetrennt)
      delay: 10               // Klick-Verzögerung
  };

  const STORAGE_KEY = "BePo_Recruiter_Config_V2_3";

  // Konfiguration laden
  let config = JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_CONFIG;
  // Migrationshilfe für alte Config-Struktur (falls nur target existiert)
  if (config.target && !config.targets) {
      config.targets = { "null": config.target }; // "null" ist der Key für Unausgebildete
      delete config.target;
  }

  const TARGET_PERSONNEL_TYPE_KEY = null; // null steht für "Ohne Ausbildung"
  const TARGET_PERSONNEL_CAPTION = "Ohne Ausbildung";
  const HOTKEY_TO_START_RECRUITMENT = "s";
  const HOTKEY_FOR_GAME_SUBMIT_BUTTON = "x";
  const NOTIFICATION_DURATION = 5000;

  const GLOBAL_RECRUIT_BUTTON_ID = "global-recruit-button";
  const SETTINGS_BUTTON_ID = "global-recruit-settings-button";
  const LOG_PREFIX = "[BePo Recruiter] ";

  const DELAY_AFTER_AJAX_LOAD = 20;
  const DELAY_AFTER_STATION_PROCESSED = 10;

  // Hier definieren wir die Typen. Diese Liste bestimmt auch das Settings-Menü.
  const personnelSettingsInternal = [
    { caption: TARGET_PERSONNEL_CAPTION, key: TARGET_PERSONNEL_TYPE_KEY, numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0, },
    { caption: "Hundeführer (Schutzhund)", key: "k9", numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0 },
    { caption: "Hundertschaftsführer (FüKw)", key: "police_fukw", numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0 },
    { caption: "MEK", key: "police_mek", numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0 },
    { caption: "SEK", key: "police_sek", numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0 },
    { caption: "Wasserwerfer", key: "police_wasserwerfer", numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0 },
    { caption: "Zugführer (leBefKw)", key: "police_einsatzleiter", numberOfRequiredPersonnel: 0, numberOfSelectedPersonnel: 0 },
  ];

  // Initialisierung der Zielwerte aus der Config
  personnelSettingsInternal.forEach(setting => {
      const configKey = setting.key === null ? "null" : setting.key;
      setting.numberOfRequiredPersonnel = parseInt(config.targets[configKey]) || 0;
  });

  const personnelSettingsProxy = personnelSettingsInternal.map(setting => {
    return new Proxy(setting, {
      set: function (target, key, value) {
        target[key] = value;
        if (key === "numberOfSelectedPersonnel") updateFooter(target.key, target.numberOfSelectedPersonnel);
        return true;
      },
    });
  });

  function initPanelBodies() { const elements = document.getElementsByClassName("panel-body"); for (let i = 0; i < elements.length; i++) elements[i].classList.add("hidden"); };
  function removePanelHeadingClickEvent() { const elements = document.getElementsByClassName("personal-select-heading"); for (let i = 0; i < elements.length; i++) { const clone = elements[i].cloneNode(true); elements[i].parentNode.replaceChild(clone, elements[i]); clone.addEventListener("click", panelHeadingClickEvent); } };

  function addFooter() {
    const wrapper = document.createElement("div"); wrapper.style = "display: flex; flex-wrap: wrap; flex-direction: row; column-gap: 15px; align-items: center;";
    const list = document.createElement("ul"); list.classList.add("list-inline"); list.style = "color: #fff;padding-top: 8px; margin-bottom: 0;";
    for (let i = 0; i < personnelSettingsProxy.length; i++) list.appendChild(createTotalSummaryElement(personnelSettingsProxy[i]));
    wrapper.appendChild(list);

    // Start Button
    const globalRecruitButton = document.createElement("button");
    globalRecruitButton.setAttribute("id", GLOBAL_RECRUIT_BUTTON_ID);
    globalRecruitButton.setAttribute("type", "button");
    globalRecruitButton.classList.add("btn", "btn-xs", "btn-info");
    globalRecruitButton.style.marginLeft = "20px";

    const hotkeyRecruitDisplay = HOTKEY_TO_START_RECRUITMENT.toUpperCase();
    globalRecruitButton.innerHTML = `<span class="glyphicon glyphicon-user"></span> Rekrutierung (Auto) [${hotkeyRecruitDisplay}]`;
    globalRecruitButton.addEventListener("click", (e) => {
        e.preventDefault();
        startGlobalRecruitment();
    });
    wrapper.appendChild(globalRecruitButton);

    // Settings Button
    const settingsButton = document.createElement("button");
    settingsButton.setAttribute("id", SETTINGS_BUTTON_ID);
    settingsButton.setAttribute("type", "button");
    settingsButton.classList.add("btn", "btn-xs", "btn-default");
    settingsButton.style.marginLeft = "5px";
    settingsButton.innerHTML = `<span class="glyphicon glyphicon-cog"></span>`;

    settingsButton.addEventListener("click", (e) => {
        e.preventDefault();
        openSettingsModal();
    });
    wrapper.appendChild(settingsButton);

    const nav = document.querySelector(".navbar.navbar-default.navbar-fixed-bottom");
    if (nav && nav.children[0] && nav.children[0].children[0]) nav.children[0].children[0].insertAdjacentElement("afterend", wrapper);
    else console.error(LOG_PREFIX + "Konnte Footer-Navigation nicht finden.");
  };

  // --- UI & SETTINGS LOGIC ---
  function openSettingsModal() {
      const existing = document.getElementById("bepo-settings-modal");
      if(existing) existing.remove();

      // Dynamische Inputs generieren basierend auf personnelSettingsInternal
      let personnelInputsHTML = '';
      personnelSettingsInternal.forEach(setting => {
          const configKey = setting.key === null ? "null" : setting.key;
          const currentVal = config.targets[configKey] || 0;
          personnelInputsHTML += `
            <div class="form-group" style="margin-bottom: 5px;">
                <label style="font-size: 12px;">Ziel: ${setting.caption}</label>
                <input type="number" data-config-key="${configKey}" class="form-control input-sm bepo-target-input" value="${currentVal}">
            </div>
          `;
      });

      const modalHTML = `
        <div id="bepo-settings-modal" style="position:fixed; top:10%; left:50%; transform:translate(-50%, 0); width: 450px; max-height: 80vh; overflow-y: auto; background: #333; color: #fff; z-index: 10005; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.5); border: 1px solid #555;">
            <h4 style="margin-top:0; border-bottom: 1px solid #555; padding-bottom: 10px;">BePo Einstellungen</h4>
            
            <div style="display:flex; gap: 10px;">
                <div style="flex: 1;">
                    <h5 style="text-decoration: underline;">Generell</h5>
                    <div class="form-group">
                        <label>Min. Bestand auf Wache lassen</label>
                        <input type="number" id="bepo_cfg_min" class="form-control" value="${config.minRemaining}">
                    </div>
                    <div class="form-group">
                        <label>Max. Entnahme pro Durchlauf</label>
                        <input type="number" id="bepo_cfg_max" class="form-control" value="${config.maxTake}">
                    </div>
                    <div class="form-group">
                        <label>Ignorierte Wachen (Namensteil)</label>
                        <input type="text" id="bepo_cfg_excl" class="form-control" value="${config.exclusions}">
                    </div>
                </div>
                <div style="flex: 1; border-left: 1px solid #555; padding-left: 10px;">
                    <h5 style="text-decoration: underline;">Personal Ziele (Global)</h5>
                    ${personnelInputsHTML}
                </div>
            </div>

            <div style="text-align:right; margin-top:10px; border-top: 1px solid #555; padding-top: 10px;">
                <button id="bepo_btn_cancel" type="button" class="btn btn-danger btn-sm">Abbrechen</button>
                <button id="bepo_btn_save" type="button" class="btn btn-success btn-sm">Speichern</button>
            </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);

      document.getElementById("bepo_btn_cancel").addEventListener("click", (e) => {
          e.preventDefault();
          document.getElementById("bepo-settings-modal").remove();
      });
      document.getElementById("bepo_btn_save").addEventListener("click", (e) => {
          e.preventDefault();
          saveSettings();
      });
  }

  function saveSettings() {
      // Generelle Settings speichern
      config.minRemaining = parseInt(document.getElementById("bepo_cfg_min").value) || 200;
      config.maxTake = parseInt(document.getElementById("bepo_cfg_max").value) || 50;
      config.exclusions = document.getElementById("bepo_cfg_excl").value || "";

      // Personal Ziele speichern
      const targetInputs = document.querySelectorAll(".bepo-target-input");
      config.targets = {};
      targetInputs.forEach(input => {
          const key = input.getAttribute("data-config-key");
          config.targets[key] = parseInt(input.value) || 0;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

      // Laufzeit-Werte aktualisieren
      personnelSettingsProxy.forEach(setting => {
          const configKey = setting.key === null ? "null" : setting.key;
          setting.numberOfRequiredPersonnel = config.targets[configKey] || 0;
          
          const reqElem = document.getElementById("number-of-required-personnel-" + setting.key);
          if(reqElem) reqElem.innerHTML = setting.numberOfRequiredPersonnel;
          updateFooter(setting.key, setting.numberOfSelectedPersonnel);
      });

      document.getElementById("bepo-settings-modal").remove();
      showTemporaryNotification("Einstellungen gespeichert!", "success");
  }
  // --- ENDE UI LOGIC ---

  function updateFooter(key, selectedPersonnel) { 
      const selectedElement = document.getElementById("number-of-selected-personnel-" + key); 
      if (selectedElement) selectedElement.innerHTML = selectedPersonnel; 
      const S = personnelSettingsProxy.find(s => s.key === key); 
      if (!S) return; 
      const R = S.numberOfRequiredPersonnel; 
      // Farben Logik
      const P = document.getElementById("personnel-" + key); 
      if (P) { 
          P.classList.remove("label-success", "label-warning", "label-danger", "label-default"); 
          if (R === 0) {
               // Wenn Bedarf 0, aber Leute ausgewählt -> Info/Warning, sonst Default
               P.classList.add(selectedPersonnel > 0 ? "label-info" : "label-default");
          } else {
               P.classList.add(selectedPersonnel >= R ? "label-success" : (selectedPersonnel > 0 ? "label-warning" : "label-danger")); 
          }
      } 
  };
  
  function addClickEventHandlerToCheckboxes() { const E = document.getElementsByClassName("schooling_checkbox"); for (let i = 0; i < E.length; i++) { E[i].removeEventListener("change", updateNumberOfSelectedPersonnelOnCheckboxClick); E[i].addEventListener("change", updateNumberOfSelectedPersonnelOnCheckboxClick); } };
  
  function updateNumberOfSelectedPersonnelOnCheckboxClick(event) { 
      const C_ = event.target; 
      let K = null; 
      // Ermitteln, was für ein Typ das ist
      for (const S_ of personnelSettingsInternal) {
          if (S_.key && C_.hasAttribute(S_.key) && C_.getAttribute(S_.key) === "true") { 
              K = S_.key; 
              break; 
          } 
      }
      // Wenn keine Ausbildung gefunden, Check ob wirklich unskilled
      if(K === null){ 
          const isUnskilled = !Object.values(C_.attributes).some(attr => personnelSettingsInternal.find(s_ => s_.key === attr.name && s_.key !== null) && attr.value === "true"); 
          if(isUnskilled) K = null;
          else return; // Es ist eine Ausbildung, die wir nicht tracken
      } 
      
      const U = personnelSettingsProxy.find(s => s.key === K); 
      if (U) U.numberOfSelectedPersonnel += C_.checked ? 1 : -1; 
  };

  function addPersonnelSelector() { let E = document.getElementsByClassName("panel-heading personal-select-heading"); for (let i = 0; i < E.length; i++) { const L = E[i], B = L.getAttribute("building_id"), O = L.querySelector(".btn-group.bepo-controls"); if (O) O.remove(); const G = createPersonnelSelectorButtons(B), R_ = L.querySelector('span[style="float:right"]'); if (R_) R_.prepend(G); else { const N = document.createElement('span'); N.style.float = "right"; N.appendChild(G); const F = L.querySelector('span:not([style="float:right"])'); if (F && F.nextSibling) L.insertBefore(N, F.nextSibling); else L.appendChild(N); } } };
  function createPersonnelSelectorButtons(B) { const G = document.createElement("div"); G.classList.add("btn-group", "btn-group-xs", "bepo-controls"); G.setAttribute("role", "group"); const T = document.createElement("span"); T.classList.add("glyphicon", "glyphicon-trash"); const R_ = document.createElement("button"); R_.classList.add("btn", "btn-xs", "btn-default", "personnel-reset-button"); R_.setAttribute("type", "button"); R_.setAttribute("data-building-id", B); R_.addEventListener("click", resetPersonnelClick); R_.appendChild(T); G.appendChild(R_); const S_ = document.createElement("span"); S_.setAttribute("id", `personnel-status-${B}`); S_.classList.add("label", "label-info"); S_.style.marginLeft = "5px"; S_.style.padding = "4px 6px"; S_.textContent = "0"; G.appendChild(S_); return G; };
  function createTotalSummaryElement(s) { const l = document.createElement("li"), c = document.createElement("span"); c.innerHTML = s.caption + ": "; const S_ = document.createElement("span"); S_.setAttribute("id", "number-of-selected-personnel-" + s.key); S_.innerHTML = s.numberOfSelectedPersonnel; const R__ = document.createElement("span"); R__.setAttribute("id", "number-of-required-personnel-" + s.key); R__.innerHTML = s.numberOfRequiredPersonnel; const P_ = document.createElement("span"); P_.setAttribute("id", "personnel-" + s.key); P_.classList.add("label"); if (s.numberOfRequiredPersonnel > 0) P_.classList.add(s.numberOfSelectedPersonnel >= s.numberOfRequiredPersonnel ? "label-success" : (s.numberOfSelectedPersonnel > 0 ? "label-warning" : "label-danger")); else P_.classList.add("label-default"); P_.appendChild(S_); P_.appendChild(document.createTextNode("/")); P_.appendChild(R__); l.appendChild(c); l.appendChild(P_); return l; };
  
  async function resetPersonnelClick(event) { event.preventDefault(); const b = event.target.closest("button"), B_ = b.dataset.buildingId; const P_ = getPanelBody(B_); if (!P_) return; const H = getPanelHeading(B_), M = H?.outerHTML.match(/href="([^"]+)"/); if (M && !loadedBuildings.includes(M[1])) await panelHeadingClick(B_, false); const I = P_.querySelectorAll("input.schooling_checkbox:checked"); for (const c_ of I) c_.click(); updateWacheStatus(B_, 0); };
  function updateWacheStatus(B_, c_) { const s_ = document.getElementById(`personnel-status-${B_}`); if (s_) { s_.textContent = `${c_}`; s_.classList.toggle("label-success", c_ > 0); s_.classList.toggle("label-info", c_ === 0); } };
  async function panelHeadingClickEvent(event) { if (event.target.closest(".personnel-reset-button")) return; let b_ = event.target.outerHTML.match(/building_id="(\d+)"/); if (b_ === null && event.target.parentElement) { let c_ = event.target.parentElement; while (c_ && !b_) { if (c_.getAttribute("building_id")) { b_ = ["", c_.getAttribute("building_id")]; break; } c_ = c_.parentElement; } } if (b_ && b_[1]) await panelHeadingClick(b_[1], true); };
  function togglePanelBody(p_) { p_.classList.toggle("hidden"); };
  function showPanelBody(p_) { p_.classList.remove("hidden"); };
  function getPanelHeading(B_) { return document.querySelector(`.personal-select-heading[building_id='${B_}']`); };
  function getPanelBody(B_) { return document.querySelector(`.panel-body[building_id='${B_}']`); };
  function hidePanelBody(p_) { p_.classList.add("hidden"); };

  async function panelHeadingClick(buildingId, toggle = false) {
    const panelHeading = getPanelHeading(buildingId); const panelBody = getPanelBody(buildingId);
    if (!panelHeading || !panelBody) return;
    const hrefMatch = panelHeading.outerHTML.match(/href="([^"]+)"/); if (!hrefMatch) return;
    const href = hrefMatch[1];
    if (loadedBuildings.includes(href)) {
      if (toggle) togglePanelBody(panelBody);
      else if (panelBody.classList.contains("hidden")) showPanelBody(panelBody);
      return;
    }
    panelBody.innerHTML = '<img src="/images/ajax-loader.gif" class="ajaxLoader" style="display:block; margin:10px auto;">';
    showPanelBody(panelBody);
    loadedBuildings.push(href);
    try {
        const data = await $.get(href); panelBody.innerHTML = data;
        const schoolingSelectAvailableButtons = panelBody.getElementsByClassName("schooling_select_available");
        while (schoolingSelectAvailableButtons.length > 0) schoolingSelectAvailableButtons[0].parentElement.remove();
        addClickEventHandlerToCheckboxes();
    } catch (error) { console.error(LOG_PREFIX + `Fehler Laden Personaldaten Wache ${buildingId}:`, error); panelBody.innerHTML = `<p style="color:red;">Fehler Laden Personaldaten.</p>`;}
  };

  /**
   * Rekrutiert Personal einer bestimmten Ausbildungsart (targetTypeKey) von einer Wache.
   * Wenn targetTypeKey === null, wird nach Personal OHNE Ausbildung gesucht.
   */
  async function recruitPersonnelFromStation(panelBodyElement, amountToTarget, targetTypeKey) {
    if (!panelBodyElement || amountToTarget <= 0) return 0; let recruitedCount = 0;
    const personnelRows = panelBodyElement.querySelectorAll("tbody > tr");

    for (const row of personnelRows) {
      if (recruitedCount >= amountToTarget) break;

      const checkbox = row.querySelector("input.schooling_checkbox");
      if (!checkbox || checkbox.checked) continue;

      // Fahrzeug-Zuweisung Check
      const vehicleCell = row.cells[3];
      if (vehicleCell && (vehicleCell.textContent.trim().length > 0 || vehicleCell.querySelector('a'))) {
          continue; // Überspringe zugewiesenes Personal
      }

      // Check auf Ausbildung
      let matchesTarget = false;

      if (targetTypeKey === null) {
          // Wir suchen Unausgebildete
          let isTrulyUnskilled = true; 
          const inputAttributes = checkbox.attributes;
          for(let i = 0; i < inputAttributes.length; i++){ 
              const attr = inputAttributes[i]; 
              // Ein Attribut das "true" ist (ausser den Standarddingern) bedeutet: Hat Ausbildung
              if (!attr.name.startsWith("data-") && attr.name !== "building_id" && attr.name !== "class" && attr.name !== "type" && attr.name !== "value" && attr.name !== "id" && attr.value === "true"){ 
                  isTrulyUnskilled = false; 
                  break; 
              } 
          }
          // Sicherstellen, dass auch der Text in der Tabelle leer ist oder "Keine" sagt
          const schoolingCell = row.cells[2];
          if (schoolingCell) { 
              const schoolingCellContent = schoolingCell.innerHTML.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim(); 
              if (schoolingCellContent.length > 0 && schoolingCellContent !== "-" && schoolingCellContent.toLowerCase() !== "keine") isTrulyUnskilled = false; 
          }
          matchesTarget = isTrulyUnskilled;
      } else {
          // Wir suchen eine spezifische Ausbildung (z.B. "police_mek")
          if (checkbox.getAttribute(targetTypeKey) === "true") {
              matchesTarget = true;
          }
      }

      if (matchesTarget) {
          checkbox.click();
          recruitedCount++;
          if (config.delay > 0) await new Promise(resolve => setTimeout(resolve, config.delay));
      }
    }
    return recruitedCount;
  };

  function showTemporaryNotification(message, type = 'success', duration = NOTIFICATION_DURATION) {
    const notificationId = 'temporary-script-notification';
    document.getElementById(notificationId)?.remove();
    const notificationDiv = document.createElement('div');
    notificationDiv.setAttribute('id', notificationId);
    notificationDiv.style.position = 'fixed'; notificationDiv.style.top = '20px'; notificationDiv.style.left = '50%';
    notificationDiv.style.transform = 'translateX(-50%)'; notificationDiv.style.padding = '12px 20px';
    notificationDiv.style.borderRadius = '5px'; notificationDiv.style.color = 'white';
    notificationDiv.style.zIndex = '10001'; notificationDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    notificationDiv.style.opacity = '0'; notificationDiv.style.transition = 'opacity 0.5s ease-in-out';
    notificationDiv.style.textAlign = 'center'; notificationDiv.style.fontSize = '14px';
    if (type === 'success') notificationDiv.style.backgroundColor = '#4CAF50';
    else if (type === 'error') notificationDiv.style.backgroundColor = '#f44336';
    else notificationDiv.style.backgroundColor = '#2196F3';
    notificationDiv.innerHTML = message.replace(/\n/g, '<br>');
    document.body.appendChild(notificationDiv);
    setTimeout(() => { notificationDiv.style.opacity = '1'; }, 10);
    setTimeout(() => { notificationDiv.style.opacity = '0'; setTimeout(() => { notificationDiv.remove(); }, 500); }, duration - 500);
  }

  async function startGlobalRecruitment() {
    const globalButton = document.getElementById(GLOBAL_RECRUIT_BUTTON_ID);
    globalButton.disabled = true;
    globalButton.innerHTML = '<span class="glyphicon glyphicon-hourglass"></span> Arbeite...';
    console.log(LOG_PREFIX + "Start: Globale Rekrutierung (Multi-Target).");

    // UI Reset
    personnelSettingsProxy.forEach(s => s.numberOfSelectedPersonnel = 0);
    document.querySelectorAll(`[id^="personnel-status-"]`).forEach(span => {
        const bid = span.id.replace("personnel-status-", "");
        updateWacheStatus(bid, 0);
    });

    // Welche Ziele sind gesetzt? (Filtere alle mit Ziel > 0)
    const activeSettings = personnelSettingsProxy.filter(s => s.numberOfRequiredPersonnel > 0);
    
    if (activeSettings.length === 0) {
      showTemporaryNotification(`Keine Personal-Ziele definiert (alles auf 0). Bitte Einstellungen prüfen.`, 'error');
      globalButton.disabled = false;
      globalButton.innerHTML = `<span class="glyphicon glyphicon-user"></span> Rekrutierung (Auto) [${HOTKEY_TO_START_RECRUITMENT.toUpperCase()}]`;
      return;
    }

    const allPanelHeadings = document.querySelectorAll(".panel-heading.personal-select-heading");
    let stationInfoList = [];
    for (const panelHeading of allPanelHeadings) {
        const buildingId = panelHeading.getAttribute("building_id");
        if (!buildingId) continue;
        const stationNameElement = panelHeading.querySelector('span:not([style="float:right"])');
        const stationName = stationNameElement ? stationNameElement.textContent.trim() : "Unbekannter Name";
        let stationTotalPersonnel = 0;
        const headingText = panelHeading.innerText || panelHeading.textContent || "";
        const matchTotalPersonnel = headingText.match(/Derzeit:\s*(\d+)/);
        if (matchTotalPersonnel && matchTotalPersonnel[1]) {
            stationTotalPersonnel = parseInt(matchTotalPersonnel[1], 10);
        }
        stationInfoList.push({ buildingId, stationName, stationTotalPersonnel, panelHeadingElement: panelHeading });
    }
    // Sortieren nach Wachengröße
    stationInfoList.sort((a, b) => b.stationTotalPersonnel - a.stationTotalPersonnel);
    
    const excludeKeywords = config.exclusions.split(",").map(s => s.trim().toLowerCase()).filter(s => s !== "");

    // --- HAUPTSCHLEIFE ÜBER ALLE ZIELE ---
    // Wir arbeiten die Ziele nacheinander ab (z.B. erst alle MEK, dann alle Unskilled)
    for (const setting of activeSettings) {
        let totalRecruitedForThisType = 0;
        const requiredTotal = setting.numberOfRequiredPersonnel;
        const typeKey = setting.key; // null = unskilled, "police_mek" etc.
        const typeCaption = setting.caption;

        console.log(LOG_PREFIX + `Starte Durchlauf für: ${typeCaption} (Ziel: ${requiredTotal})`);

        for (const stationInfo of stationInfoList) {
            if (totalRecruitedForThisType >= requiredTotal) break;

            const { buildingId, stationName, stationTotalPersonnel, panelHeadingElement } = stationInfo;
            
            // Exclusions prüfen
            if (excludeKeywords.some(keyword => stationName.toLowerCase().includes(keyword))) continue;
            // Min Bestand prüfen
            if (stationTotalPersonnel <= config.minRemaining) continue;

            const panelBody = getPanelBody(buildingId);
            if (!panelBody) continue;

            // Wache laden falls nötig
            const hrefMatch = panelHeadingElement.outerHTML.match(/href="([^"]+)"/);
            if (hrefMatch && !loadedBuildings.includes(hrefMatch[1])) {
                await panelHeadingClick(buildingId, false);
                if (DELAY_AFTER_AJAX_LOAD > 0) await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_AJAX_LOAD));
            } else {
                if (panelBody.classList.contains("hidden")) showPanelBody(panelBody);
            }

            // Berechnen Limit
            const maxPersonalToTakeBasedOnStationMinimum = stationTotalPersonnel - config.minRemaining;
            const amountToRequestForThisStation = Math.min( 
                config.maxTake, 
                maxPersonalToTakeBasedOnStationMinimum, 
                requiredTotal - totalRecruitedForThisType 
            );

            if (amountToRequestForThisStation <= 0) continue;

            // HIER die spezifische Rekrutierung aufrufen
            const actuallyRecruited = await recruitPersonnelFromStation(panelBody, amountToRequestForThisStation, typeKey);

            if (actuallyRecruited > 0) {
                const stationStatusSpan = document.getElementById(`personnel-status-${buildingId}`);
                const currentStationCount = stationStatusSpan ? parseInt(stationStatusSpan.textContent, 10) || 0 : 0;
                updateWacheStatus(buildingId, currentStationCount + actuallyRecruited);
                
                totalRecruitedForThisType += actuallyRecruited;
                setting.numberOfSelectedPersonnel = totalRecruitedForThisType;
            }
            if (DELAY_AFTER_STATION_PROCESSED > 0) await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_STATION_PROCESSED));
        }
    }

    globalButton.disabled = false;
    const hotkeyRecruitDisplay = HOTKEY_TO_START_RECRUITMENT.toUpperCase();
    globalButton.innerHTML = `<span class="glyphicon glyphicon-ok"></span> Fertig [${hotkeyRecruitDisplay}]`;
    setTimeout(() => {
         globalButton.innerHTML = `<span class="glyphicon glyphicon-user"></span> Rekrutierung (Auto) [${hotkeyRecruitDisplay}]`;
    }, NOTIFICATION_DURATION);

    showTemporaryNotification(`Rekrutierungs-Durchläufe beendet.`, 'success', NOTIFICATION_DURATION);
  }

  function main() {
    if (!window.location.href.match(/\/buildings\/\d+\/hire/)) return;
    if (typeof window.loadedBuildings === 'undefined') window.loadedBuildings = [];

    initPanelBodies();
    removePanelHeadingClickEvent();
    addPersonnelSelector();
    addFooter();
    personnelSettingsProxy.forEach(setting => setting.numberOfSelectedPersonnel = 0);

    document.addEventListener('keydown', function(event) {
        const activeElement = document.activeElement;
        const isTyping = activeElement && (activeElement.tagName.toLowerCase() === 'input' ||
                                       activeElement.tagName.toLowerCase() === 'textarea' ||
                                       activeElement.isContentEditable);
        if (isTyping) return;
        const pressedKey = event.key.toLowerCase();
        if (pressedKey === HOTKEY_TO_START_RECRUITMENT.toLowerCase()) {
            event.preventDefault();
            const globalButton = document.getElementById(GLOBAL_RECRUIT_BUTTON_ID);
            if (globalButton && !globalButton.disabled) startGlobalRecruitment();
        } else if (pressedKey === HOTKEY_FOR_GAME_SUBMIT_BUTTON.toLowerCase()) {
            const gameSubmitButton = document.querySelector('input.navbar-btn[name="commit"][type="submit"][value="Personal übernehmen"]');
            if (gameSubmitButton) {
                event.preventDefault(); gameSubmitButton.click();
            }
        }
    });
    console.log(LOG_PREFIX + `Skript v${GM_info.script.version} init.`);
  }
  main();
})();
