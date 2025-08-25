/*--BMScriptConfig
[
  {
    "param": 1,
    "label": "Text-Einstellung",
    "type": "text",
    "default": "Standardwert",
    "info": "Ein freies Textfeld für beliebige Eingaben."
  },
  {
    "param": 2,
    "label": "Zahlen-Einstellung",
    "type": "number",
    "default": 100,
    "min": 0,
    "max": 1000,
    "info": "Ein reines Zahlenfeld, optional mit Minimum und Maximum."
  },
  {
    "param": 3,
    "label": "Checkbox-Einstellung",
    "type": "checkbox",
    "default": true,
    "info": "Eine einfache An/Aus-Option."
  },
  {
    "param": 4,
    "label": "Dropdown-Auswahl",
    "type": "select",
    "default": "wert2",
    "options": [
      { "value": "wert1", "text": "Option 1" },
      { "value": "wert2", "text": "Option 2" },
      { "value": "wert3", "text": "Option 3" }
    ],
    "info": "Lässt den Nutzer aus vordefinierten Optionen wählen."
  },
  { "param": 5, "label": "Parameter 5 (Zahl)", "type": "number", "default": 5 },
  { "param": 6, "label": "Parameter 6 (Text)", "type": "text", "default": "" },
  { "param": 7, "label": "Parameter 7 (Checkbox)", "type": "checkbox", "default": false },
  { "param": 8, "label": "Parameter 8 (Zahl)", "type": "number", "default": 80 },
  { "param": 9, "label": "Parameter 9 (Text)", "type": "text", "default": "Standardtext 9" },
  { "param": 10, "label": "Parameter 10 (Checkbox)", "type": "checkbox", "default": true },
  { "param": 11, "label": "Parameter 11 (Zahl)", "type": "number", "default": 11 },
  { "param": 12, "label": "Parameter 12 (Text)", "type": "text", "default": "" },
  { "param": 13, "label": "Parameter 13 (Checkbox)", "type": "checkbox", "default": false },
  { "param": 14, "label": "Parameter 14 (Zahl)", "type": "number", "default": 1400 },
  { "param": 15, "label": "Parameter 15 (Text)", "type": "text", "default": "Standardtext 15" },
  { "param": 16, "label": "Parameter 16 (Checkbox)", "type": "checkbox", "default": true },
  { "param": 17, "label": "Parameter 17 (Zahl)", "type": "number", "default": 17 },
  { "param": 18, "label": "Parameter 18 (Text)", "type": "text", "default": "" },
  { "param": 19, "label": "Parameter 19 (Checkbox)", "type": "checkbox", "default": false },
  { "param": 20, "label": "Parameter 20 (Zahl)", "type": "number", "default": 20 }
]
--*/

// ==UserScript==
// @name         Mein Tolles Skript
// @version      1.0.0
// @description  Eine Beschreibung, was dieses Skript tut.
// @author       Ein Entwickler
// ==/UserScript==

(function() {
    'use strict';

    const SKRIPT_NAME = 'Mein Tolles Skript'; // WICHTIG: Muss mit dem @name oben übereinstimmen!

    // Hole die vom Nutzer gespeicherten Einstellungen vom Manager ab.
    const settings = window.BMScriptManager?.getSettings(SKRIPT_NAME) || {};

    // Lese die einzelnen Werte aus. Wenn ein Wert nicht vom Nutzer gesetzt wurde,
    // wird der Standardwert aus der Konfiguration oben verwendet.
    // (Hierzu muss der Entwickler die Defaults aus dem JSON manuell übertragen)
    const textEinstellung   = settings.param1 ?? "Standardwert";
    const zahlEinstellung   = settings.param2 ?? 100;
    const checkboxEinstellung = settings.param3 ?? true;
    const dropdownEinstellung = settings.param4 ?? "wert2";

    // Ab hier kann das Skript mit den Variablen `textEinstellung`, `zahlEinstellung` etc. arbeiten.
    console.log(`${SKRIPT_NAME}: Die Texteinstellung ist '${textEinstellung}'.`);

})();
