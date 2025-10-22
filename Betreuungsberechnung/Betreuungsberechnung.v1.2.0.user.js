// ==UserScript==
// @name         LSS Betreuungsberechnung
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Berechnet und zeigt den benötigten Betreuungsbedarf für Einsätze an, basierend auf Betroffenen und der tatsächlichen Anzahl aller eingesetzten Kräfte, unter Berücksichtigung der Spielmeldung zum Personal-Versorgungsbedarf. Das Skript wird nur bei Einsätzen mit Betreuungsbedarf aktiv. Entwickelt für Greasy Fork.
// @author       Masklin (in Zusammenarbeit mit Gemini)
// @match        https://www.leitstellenspiel.de/missions/*
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

// Zusätzliche IIFE für maximale Scope-Isolation und um Konflikte zu vermeiden
(function(window) {
    'use strict';
    GM_addStyle(`
        /* Hauptcontainer für Betreuungsbedarf */
        #lss-care-container-custom {
            display: flex;
            flex-direction: column;
            gap: 15px;
            width: 100%;
            margin-bottom: 15px;
            padding: 20px;
            border-radius: 12px;
            background: linear-gradient(145deg, #2a2d35, #1f2128);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #e0e0e0;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            transition: all 0.4s ease-in-out;
            flex-wrap: wrap;
        }

        /* "Alles erledigt"-Zustand mit grünem Leuchten */
        #lss-care-container-custom.all-vehicles-ok {
            background: linear-gradient(145deg, #193829, #204b36);
            border-color: #28a745;
            box-shadow: 0 0 15px rgba(40, 167, 69, 0.5);
        }

        /* Titel für den Container */
        #lss-care-container-custom .custom-container-title {
            width: 100%;
            text-align: center;
            font-size: 1.5em;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 10px;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
        }

        /* Flexbox-Wrapper für die Tabellen */
        #lss-care-container-custom .tables-flex-wrapper {
            display: flex;
            gap: 20px;
            width: 100%;
            flex-wrap: wrap;
        }

        /* Wrapper für eine einzelne Tabelle (flexibel) */
        #lss-care-container-custom .missing-vehicles-table-wrapper {
            flex: 1;
            min-width: 45%; /* Mindestbreite für 2 Spalten-Layout */
        }

        /* Die Tabelle selbst */
        #lss-care-container-custom .missing-vehicles-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 8px;
        }

        /* Tabellenüberschriften */
        #lss-care-container-custom .missing-vehicles-table th {
            padding: 10px 15px;
            text-align: left;
            font-weight: bold;
            color: #8892b0;
            font-size: 0.8em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Tabellenzellen */
        #lss-care-container-custom .missing-vehicles-table td {
            padding: 12px 15px;
            background-color: rgba(255, 255, 255, 0.05);
            vertical-align: middle;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Abgerundete Ecken für die Zeilen */
        #lss-care-container-custom .missing-vehicles-table td:first-child { border-radius: 8px 0 0 8px; }
        #lss-care-container-custom .missing-vehicles-table td:last-child { border-radius: 0 8px 8px 0; }

        /* Stil für erfüllte Zeilen */
        #lss-care-container-custom .missing-vehicles-table tr.vehicle-row-ok td {
            background-color: rgba(40, 167, 69, 0.2);
            color: #98e0ab;
        }

        /* Fortschrittsbalken-Container */
        #lss-care-container-custom .progress-bar-container {
            width: 100%;
            height: 22px;
            background-color: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        }

        /* Der Fortschrittsbalken selbst */
        #lss-care-container-custom .progress-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #d9534f, #f0ad4e, #5cb85c);
            background-size: 300% 100%;
            border-radius: 5px;
            transition: width 0.5s ease-out, background-position 0.5s ease-out, background 0.5s ease;
        }

        /* Text auf dem Fortschrittsbalken */
        #lss-care-container-custom .progress-bar-text {
            position: absolute;
            width: 100%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #fff;
            font-weight: bold;
            font-size: 0.9em;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
            text-align: center;
        }

        /* Balken wird grün, wenn Zeile "ok" ist */
        #lss-care-container-custom .missing-vehicles-table tr.vehicle-row-ok .progress-bar {
            background: linear-gradient(90deg, #2eac53, #28a745);
        }

        /* Kompakt-Ansicht-Regeln (permanent) */
        #lss-care-container-custom.compact-view {
            padding: 12px;
            gap: 10px;
        }
        #lss-care-container-custom.compact-view .custom-container-title {
            font-size: 1.2em;
            margin-bottom: 8px;
        }
        #lss-care-container-custom.compact-view .missing-vehicles-table {
            border-spacing: 0 4px;
        }
        #lss-care-container-custom.compact-view .missing-vehicles-table td {
            padding: 7px 12px;
        }
        #lss-care-container-custom.compact-view .progress-bar-container {
            height: 20px;
        }
        #lss-care-container-custom.compact-view .progress-bar-text {
            font-size: 0.8em;
        }

        /* Bereich für "Personal" (hier für "zu versorgende Personen") */
        #lss-care-container-custom .personnel-requirements-wrapper {
            width: 100%;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        #lss-care-container-custom .personnel-title {
            text-align: center;
            font-weight: bold;
            color: #8892b0;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
    `);

    // Prüfen, ob das Skript bereits geladen wurde, um doppelte Ausführung zu verhindern
    if (window.LSSPersonnelOverviewLoaded) {
        // console.log("LSS Betreuungsberechnung: Skript bereits geladen (Version 1.0.4). Überspringe erneute Initialisierung.");
        return;
    }
    window.LSSPersonnelOverviewLoaded = true;

    // Bestätigung der geladenen Skript-Version
    console.log("LSS Betreuungsberechnung: Skript-Version 1.0.4 geladen.");

    // Konstanten für die Personalstärke von Betreuungsfahrzeugen
    const CARE_HELPER_PER_KITCHEN = 1; // Betreuungshelfer, die EINE Küche mitbringt
    const TOTAL_PERSONNEL_PER_KITCHEN = 3; // Gesamtpersonal (Betreuungshelfer + Verpfleger), das EINE Küche mitbringt und versorgt werden muss
    const CARE_HELPER_PER_BT_KOMBI = 9; // Betreuungshelfer, die EIN BT-Kombi mitbringt
    const TOTAL_PERSONNEL_PER_BT_KOMBI = 9; // Gesamtpersonal, das EIN BT-Kombi mitbringt und versorgt werden muss

    // Karte der Personalstärke pro Fahrzeugtyp.
    // Diese wird verwendet, wenn das Personal nicht direkt aus der Tabelle ausgelesen werden kann (z.B. für ausgewählte Fahrzeuge).
    // HINWEIS: Für "vor Ort" und "auf Anfahrt" wird das Personal direkt aus der Tabelle gelesen.
    let LSS_PO_VEHICLE_PERSONNEL_MAP = {
        "LF": 9, "LF 8": 9, "LF 10": 9, "LF 16": 9, "LF 20": 9, "HLF 10": 9, "HLF 16": 9, "HLF 20": 9,
        "TLF": 3, "TLF 16": 3, "TLF 20/40": 3, "TLF 3000": 3, "TLF 4000": 3, "TLF 8/18": 3,
        "DLK": 3, "DLK 23": 3,
        "RW": 3,
        "ELW": 3, // Generischer ELW-Eintrag
        "ELW 1": 3, "ELW 2": 2, "ELW 3": 3,
        "ELW 1 (SEG)": 3, // Expliziter Eintrag für ELW 1 (SEG)
        "GW-A": 3, "GW-L": 3, "GW-M": 3, "GW-Öl": 3, "GW-Schiene": 3, "GW-Taucher": 3, "GW-Messtechnik": 3, "GW-Gefahrgut": 3,
        "MTW": 1,
        "RTW": 2, "NEF": 1, "KTW": 2, "NAW": 3, "RTH": 2, "LNA": 1, "OrgL": 1,
        "GW-San": 6, "KTW Typ B": 2,
        "WLF": 1, "AB-ABC": 1, "AB-Atemschutz": 1, "AB-Dekon": 1, "AB-Gefahrgut": 1, "AB-Logistik": 1, "AB-Rüst": 1, "AB-Schlauch": 1, "AB-SoS": 1, "AB-Tank": 1, "AB-Universal": 1, "AB-V-Dekon": 1, "AB-Wasserförderung": 1,
        "FwK": 2, "FwK 25": 2, "FwK 40": 2, "FwK 100": 2,
        "Gelenkmast": 3,
        "KdoW": 1,
        "Anhänger": 0, // Anhänger haben kein Personal
        "Wechselladerfahrzeug": 1, // Synonym für WLF
        "AB-Brandbekämpfung": 1,
        "AB-Rettungsdienst": 1,
        "AB-MANV": 1,
        "AB-Einsatzleitung": 1,
        "AB-Sondertechnik": 1,
        "AB-Wasserrettung": 1,
        "AB-Verpflegung": 1,
        "AB-Betreuung": 1,
        "AB-Führung": 1,
        "AB-Logistik-Gefahrgut": 1,
        "AB-Rüst-Gefahrgut": 1,
        "AB-Schlauch-Gefahrgut": 1,
        "AB-Tunnel": 1,
        "AB-Hochwasser": 1,
        "AB-Sturm": 1,
        "AB-Waldbrand": 1,
        "AB-Bahn": 1,
        "AB-Flugfeld": 1,
        "AB-Drohne": 1,
        "AB-Rettungshundestaffel": 1,
        "AB-Verletztenablage": 1,
        "AB-Notfallversorgung": 1,
        "AB-Patiententransport": 1,
        "AB-Sanitätsdienst": 1,
        "AB-Betriebsstoffe": 1,
        "AB-Gefahrstoff": 1,
        "AB-Strahlenschutz": 1,
        "AB-Umwelt": 1,
        "AB-Spezial": 1,
        "AB-Technik": 1,
        "AB-Katastrophenschutz": 1,
        // Hinzugefügte Polizei- und THW-Fahrzeuge mit Standard-Personalwerten
        "FuStW": 2, "LKW K 9": 3, "BRmG R": 3, "GKW": 9, "Dekon-P": 3, "MTF-THW": 1, "MzKW": 9,
        "Anh. DLE": 0, "Anh. NEA": 0, "Anh. Hzg": 0, "Anh. WLF": 0, "Anh. MzB": 0, "Anh. Schlauch": 0,
        "Anh. Tauch": 0, "Anh. Öl": 0, "Anh. Atemschutz": 0, "Anh. Licht": 0, "Anh. Strom": 0,
        "Anh. Gefahrgut": 0, "Anh. Absperr": 0, "Anh. Sandsack": 0, "Anh. Pumpe": 0, "Anh. WaPu": 0,
        "Anh. Radlader": 0, "Anh. Tieflader": 0, "Anh. Feldkochherd": 0, "Anh. Betreuung": 0,
        "Anh. Verpflegung": 0, "Anh. Beleuchtung": 0, "Anh. Notstrom": 0,
        "SEK-MTF": 9,
        "MEK-MTF": 2, "DGL": 1, "GruKw": 10, "WaWe 10": 3, "leBefKw": 3,
        "GefKw": 2, "KdoW-Pol": 1, "Zivilfahrzeug": 2,
        "FüKw": 2, "Streifenwagen": 2,
        "LF 8/6": 9,
        "LF 16-TS": 9,
        "GW-L2-Wasser": 3,
        "SW 1000": 3, "SW 2000": 3, "SW 2000-Tr": 3, "SW Kats": 3,
        "TLF 2000": 3, "TLF 8/8": 3, "TLF 16/24-Tr": 3, "TLF 16/25": 3, "TLF 16/45": 3, "TLF 20/40-SL": 3,
        "GW-Höhenrettung": 3,
        "TSF-W": 6,
        "MTW-TZ": 1,
        "MzGW (FGr N)": 6, // THW MzGW, oft 6 Personal
        "MLW 5": 2,
        "AB-Öl": 1,
        "AB-Dekon-P": 1,
        "KdoW-LNA": 1,
        "KdoW-OrgL": 1,
        "Polizeihubschrauber": 2,
        "LKW 7 Lkr 19 tm": 2,
        "Anh MzB": 0, "Anh SchlB": 0, "Anh MzAB": 0,
        "Tauchkraftwagen": 2,
        "MZB": 2,
        "AB-MZB": 1,
        "GRTW": 6,
        "FLF": 3,
        "Rettungtreppe": 2,
        "AB-Gefahrgut": 1, "AB-Einsatzleitung": 1,
        "SEK - ZF": 2, "MEK - ZF": 2,
        "GW-Werkfeuerwehr": 3,
        "ULF mit Löscharm": 3,
        "TM 50": 3,
        "Turbolöscher": 2,
        "KLF": 6,
        "MLF": 6,
        "Rettungshundefahrzeug": 2,
        "Anh Hund": 0,
        "MTW-O": 1,
        "DHuFüKW": 1,
        "Polizeimotorrad": 1,
        "Außenlastbehälter (allgemein)": 0,
        "ITW": 3,
        "MLW 4": 2,
        "Anh SwPu": 0, "Anh 7": 0,
        "GW-L1": 3, "GW-L2": 3,
        "MTF-L": 1,
        "LF-L": 9,
        "AB-L": 1,
        "MzGW SB": 6,
        "NEA50": 0, "NEA200": 0,
        "GW-Lüfter": 3,
        "Anh Lüfter": 0,
        "AB-Lüfter": 1,
        "Kleintankwagen": 2,
        "AB-Lösch": 1,
        "Tankwagen": 2,
        "GTLF": 3,
        "LKW 7 Lbw (FGr E)": 2, "LKW 7 Lbw (FGr WP)": 2,
        "MTW-OV": 1, "MTW-Tr UL": 1,
        "MTF Drohne": 1, "GW UAS": 2, "ELW Drohne": 2, "ELW2 Drohne": 2,
        "GW-Bt": 2, "Bt-Kombi": 2,
        "FKH": 0, "Bt LKW": 2,
        "Pferdetransporter klein": 1, "Pferdetransporter groß": 1, "Anh Pferdetransport": 0, "Zugfahrzeug Pferdetransport": 1,
        "GW-Verpflegung": 2, "GW-Küche": 2, "MTW-Verpflegung": 1, "AB-Küche": 1,
        "FüKW (THW)": 2, "FüKomKW": 2, "Anh FüLa": 0, "FmKW": 2, "MTW-FGr K": 1,
        "GW-Bergrettung (NEF)": 1, "GW-Bergrettung": 2, "ELW Bergrettung": 2, "ATV": 1,
        "Hundestaffel (Bergrettung)": 2,
        "Schneefahrzeug": 1,
        "Anh Höhenrettung (Bergrettung)": 0,
        "Polizeihubschrauber mit verbauter Winde": 2,
        "RTH Winde": 2,
        "GW-Höhenrettung (Bergrettung)": 2,
        "Seenotrettungskreuzer": 6,
        "Seenotrettungsboot": 3,
        "Hubschrauber (Seenotrettung)": 2,
        "RW-Schiene": 3,
        "HLF Schiene": 9,
        "AB-Schiene": 1,
        "LauKw": 2,
        "PTLF 4000": 3,
        "SLF": 3,
        "Anh Sonderlöschmittel": 0,
        "AB-Sonderlöschmittel": 1,
        "AB-Wasser/Schaum": 1,
        "FuStW (DGL)": 2,
        "FüKW (Polizei)": 3,
        "GW-Wasserrettung": 6,
        "GW TeSi": 5,
        "LKW Technik (Notstrom)": 6,
        "MTW TeSi": 7,
        "Anh TeSi": 0,
        "LKW 7 Lbw (FGr Log-V)": 2,
        "MTW-FGr Log-V": 5,
        "Anh 12 Lbw (FGr Log-V)": 0,
    };

    // Die vom Nutzer bereitgestellte Fahrzeug-ID-Liste
    let LSS_PO_SCRIPT_VEHICLE_TYPE_MAPPING = {
        '0': 'LF 20', '1': 'LF 10', '2': 'DLK 23', '3': 'ELW 1',
        '4': 'RW', '5': 'GW-A', '6': 'LF 8/6', '7': 'LF 20/16',
        '8': 'LF 10/6', '9': 'LF 16-TS', '10': 'GW-Öl', '11': 'GW-L2-Wasser',
        '12': 'GW-Messtechnik', '13': 'SW 1000', '14': 'SW 2000', '15': 'SW 2000-Tr',
        '16': 'SW Kats', '17': 'TLF 2000', '18': 'TLF 3000', '19': 'TLF 8/8',
        '20': 'TLF 8/18', '21': 'TLF 16/24-Tr', '22': 'TLF 16/25', '23': 'TLF 16/45',
        '24': 'TLF 20/40', '25': 'TLF 20/40-SL', '26': 'TLF 16', '27': 'GW-Gefahrgut',
        '28': 'RTW', '29': 'NEF', '30': 'HLF 20', '31': 'RTH',
        '32': 'FuStW', '33': 'GW-Höhenrettung', '34': 'ELW 2', '35': 'leBefKw',
        '36': 'MTW', '37': 'TSF-W', '38': 'KTW', '39': 'GKW',
        '40': 'MTW-TZ', '41': 'MzGW (FGr N)', '42': 'LKW K 9', '43': 'BRmG R',
        '44': 'Anh DLE', '45': 'MLW 5', '46': 'WLF', '47': 'AB-Rüst',
        '48': 'AB-Atemschutz', '49': 'AB-Öl', '50': 'GruKw', '51': 'FüKW (Polizei)',
        '52': 'GefKw', '53': 'Dekon-P', '54': 'AB-Dekon-P', '55': 'KdoW-LNA',
        '56': 'KdoW-OrgL', '57': 'FwK', '58': 'KTW Typ B', '59': 'ELW 1 (SEG)',
        '60': 'GW-San', '61': 'Polizeihubschrauber', '62': 'AB-Schlauch', '63': 'GW-Taucher',
        '64': 'GW-Wasserrettung',
        '65': 'LKW 7 Lkr 19 tm', '66': 'Anh MzB', '67': 'Anh SchlB',
        '68': 'Anh MzAB', '69': 'Tauchkraftwagen', '70': 'MZB', '71': 'AB-MZB',
        '72': 'WaWe 10', '73': 'GRTW', '74': 'NAW', '75': 'FLF',
        '76': 'Rettungtreppe', '77': 'AB-Gefahrgut', '78': 'AB-Einsatzleitung', '79': 'SEK - ZF',
        '80': 'SEK - MTF',
        '81': 'MEK - ZF', '82': 'MEK - MTF', '83': 'GW-Werkfeuerwehr',
        '84': 'ULF mit Löscharm', '85': 'TM 50', '86': 'Turbolöscher', '87': 'TLF 4000',
        '88': 'KLF', '89': 'MLF', '90': 'HLF 10', '91': 'Rettungshundefahrzeug',
        '92': 'Anh Hund', '93': 'MTW-O', '94': 'DHuFüKW', '95': 'Polizeimotorrad',
        '96': 'Außenlastbehälter (allgemein)','97': 'ITW', '98': 'Zivilstreifenwagen',
        '100': 'MLW 4', '101': 'Anh SwPu', '102': 'Anh 7', '103': 'FuStW (DGL)',
        '104': 'GW-L1', '105': 'GW-L2', '106': 'MTF-L', '107': 'LF-L',
        '108': 'AB-L', '109': 'MzGW SB', '110': 'NEA50',
        '112': 'NEA200',
        "114": 'GW-Lüfter', "115": 'Anh Lüfter', "116": 'AB-Lüfter', "117": 'AB-Tank',
        "118": 'Kleintankwagen', "119": 'AB-Lösch', "120": 'Tankwagen', "121": 'GTLF',
        "122": "LKW 7 Lbw (FGr E)",
        "123": "LKW 7 Lbw (FGr WP)",
        "124": "MTW-OV",
        "125": "MTW-Tr UL",
        "126": "MTF Drohne",
        "127": "GW UAS",
        "128": "ELW Drohne",
        "129": "ELW2 Drohne",
        "130": "GW-Bt", // GW-Bt -> Betreuungsdienst Fahrzeug (kann Personal mitbringen)
        "131": "Bt-Kombi", // Bt-Kombi -> Betreuungsdienst Fahrzeug (kann Personal mitbringt)
        "132": "FKH", // Feldkochherd -> Küche (kann Personal mitbringt)
        "133": "Bt LKW",
        "134": "Pferdetransporter klein",
        "135": "Pferdetransporter groß",
        "136": "Anh Pferdetransport",
        "137": "Zugfahrzeug Pferdetransport",
        "138": "GW-Verpflegung",
        "139": "GW-Küche", // GW-Küche -> Küche (kann Personal mitbringt)
        "140": "MTW-Verpflegung",
        "142": "AB-Küche", // AB-Küche -> Küche (kann Personal mitbringt)
        "143": "Anh Schlauch",
        '144': 'FüKW (THW)',
        '145': 'FüKomKW',
        '146': 'Anh FüLa',
        '147': 'FmKW',
        '148': 'MTW-FGr K',
        '149': 'GW-Bergrettung (NEF)',
        '150': 'GW-Bergrettung',
        '151': 'ELW Bergrettung',
        '152': 'ATV',
        '153': 'Hundestaffel (Bergrettung)',
        '154': 'Schneefahrzeug',
        '155': 'Anh Höhenrettung (Bergrettung)',
        '156': 'Polizeihubschrauber mit verbauter Winde',
        '157': 'RTH Winde',
        '158': 'GW-Höhenrettung (Bergrettung)', // Korrigiert
        '159': 'Seenotrettungskreuzer',
        '160': 'Seenotrettungsboot',
        '161': 'Hubschrauber (Seenotrettung)',
        '162': 'RW-Schiene',
        '163': 'HLF Schiene',
        '164': 'AB-Schiene',
        '165': 'LauKw',
        '166': 'PTLF 4000',
        '167': 'SLF',
        '168': 'Anh Sonderlöschmittel',
        '169': 'AB-Sonderlöschmittel',
        '170': 'AB-Wasser/Schaum',
        '171': 'GW TeSi',
        '172': 'LKW Technik (Notstrom)',
        '173': 'MTW TeSi',
        '174': 'Anh TeSi',
        '175': 'NEA50',
        '176': 'LKW 7 Lbw (FGr Log-V)',
        '177': 'MTW-FGr Log-V',
        '178': 'Anh 12 Lbw (FGr Log-V)',
    };

    // Cache für Spaltenindizes, um Neuberechnungen zu vermeiden
    const personnelColumnIndexCache = {};

    // Flag, um zu verfolgen, ob die Skript-Features bereits aktiviert wurden
    let scriptFeaturesActivated = false;

    // Speichert einen Verweis auf das neu erstellte Ausgabe-Div
    let lssCareSummaryOutputDiv = null;

    /**
     * Gibt die Personalstärke für einen gegebenen standardisierten Fahrzeugtyp zurück.
     * Diese Funktion erwartet einen bereits bereinigten, standardisierten Fahrzeugnamen.
     * @param {string} standardizedVehicleType - Der standardisierte Typ des Fahrzeugs (z.B. "LF 20", "RTW", "Bt-Kombi").
     * @returns {number} Die Personalstärke des Fahrzeugs, oder 0, wenn unbekannt.
     */
    function getPersonnelForVehicleType(standardizedVehicleType) {
        const personnel = LSS_PO_VEHICLE_PERSONNEL_MAP[standardizedVehicleType];
        if (personnel !== undefined) {
            return personnel;
        }
        // console.warn(`LSS Betreuungsberechnung: Unbekannter standardisierter Fahrzeugtyp "${standardizedVehicleType}" - Personal auf 0 gesetzt. Bitte Mappings prüfen.`);
        return 0;
    }

    /**
     * Gibt den Fahrzeugnamen anhand der ID aus dem LSS_PO_SCRIPT_VEHICLE_TYPE_MAPPING zurück.
     * @param {string} vehicleTypeId - Die ID des Fahrzeugtyps.
     * @returns {string} Der standardisierte Fahrzeugtyp-Name oder ein leerer String, wenn nicht gefunden.
     */
    function getVehicleTypeNameById(vehicleTypeId) {
        return LSS_PO_SCRIPT_VEHICLE_TYPE_MAPPING[vehicleTypeId] || "";
    }


    /**
     * Parst Fahrzeuge und deren Personal aus einer HTML-Tabelle oder Checkbox-Liste.
     * @param {string} tableId - Die ID der Tabelle (z.B. 'mission_vehicle_at_mission', 'mission_vehicle_driving', 'mission_vehicles_to_send').
     * @param {boolean} filterByOwn - Ob nur Fahrzeuge mit "Rückalarmieren"-Button berücksichtigt werden sollen (relevant für 'at_mission' und 'driving' Tabellen).
     * @returns {Array<Object>} Ein Array von Objekten, jedes mit { type: string, personnel: number }.
     */
    function parseVehiclesAndPersonnel(tableId, filterByOwn = true) {
        const vehiclesData = [];

        // --- Spezialfall: mission_vehicles_to_send (Ausgewählte Fahrzeuge) ---
        // Hier kommen die Fahrzeuge aus den Checkboxen, die vehicle_type_id ist direkt an der Checkbox
        if (tableId === 'mission_vehicles_to_send') {
            // WICHTIG: Die Checkboxen befinden sich in '#vehicle_show_table_all', nicht direkt in 'mission_vehicles_to_send'
            const vehicleCheckboxes = document.querySelectorAll('#vehicle_show_table_all .vehicle_checkbox:checked');
            vehicleCheckboxes.forEach(checkbox => {
                const vehicleTypeId = checkbox.getAttribute('vehicle_type_id') || checkbox.dataset.vehicleTypeId;
                if (vehicleTypeId) {
                    const standardizedVehicleType = getVehicleTypeNameById(vehicleTypeId);
                    // Für ausgewählte Fahrzeuge nehmen wir das Personal aus der Map, da es nicht direkt in der Tabelle steht
                    const personnelCount = getPersonnelForVehicleType(standardizedVehicleType);
                    if (standardizedVehicleType) {
                        vehiclesData.push({ type: standardizedVehicleType, personnel: personnelCount });
                    }
                } else {
                    // console.warn(`LSS Betreuungsberechnung: Ausgewählte Checkbox ohne 'vehicle_type_id' gefunden:`, checkbox.outerHTML);
                }
            });
            return vehiclesData;
        }

        // --- Standard-Logik für mission_vehicle_at_mission und mission_vehicle_driving ---
        // Hier lesen wir Personal direkt aus der Tabelle und filtern ggf. nach eigenen Fahrzeugen.
        const table = document.getElementById(tableId);
        if (!table) {
            return vehiclesData;
        }

        let personnelColumnIndex = -1;
        if (personnelColumnIndexCache[tableId] !== undefined) {
            personnelColumnIndex = personnelColumnIndexCache[tableId];
        } else {
            const headerRow = table.querySelector('thead tr');
            if (headerRow) {
                const headers = headerRow.querySelectorAll('th, td');
                headers.forEach((header, index) => {
                    if (header.querySelector('img[title="Besatzung"]')) {
                        personnelColumnIndex = index;
                        personnelColumnIndexCache[tableId] = personnelColumnIndex;
                    }
                });
            }
            if (personnelColumnIndex === -1) {
                // console.warn(`LSS Betreuungsberechnung: Konnte Personalspalte (Besatzung-Icon) für Tabelle '${tableId}' nicht finden. Fallback für mission_vehicle_driving auf 4.`);
                if (tableId === 'mission_vehicle_driving') {
                    personnelColumnIndex = 4;
                    personnelColumnIndexCache[tableId] = personnelColumnIndex;
                }
            }
        }

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // Filterung nach eigenen Fahrzeugen (nur relevant für mission_vehicle_at_mission und mission_vehicle_driving)
            if (filterByOwn) {
                const backalarmButton = row.querySelector('.btn-backalarm-ajax');
                if (!backalarmButton) {
                    return; // Überspringe Fahrzeuge ohne Rückalarmieren-Button, wenn nur eigene gewünscht sind
                }
            }

            const vehicleNameLink = row.querySelector('td:nth-child(2) a');
            if (!vehicleNameLink) {
                return;
            }

            const vehicleTypeId = vehicleNameLink.getAttribute('vehicle_type_id') || vehicleNameLink.dataset.vehicleTypeId;
            let standardizedVehicleType = "";
            let personnelCount = 0;

            if (vehicleTypeId) {
                standardizedVehicleType = getVehicleTypeNameById(vehicleTypeId);
                const allTdsInRow = row.querySelectorAll('td');
                const personnelElement = (personnelColumnIndex !== -1 && allTdsInRow[personnelColumnIndex]) ? allTdsInRow[personnelColumnIndex] : null;
                if (personnelElement) {
                    personnelCount = parseInt(personnelElement.textContent.trim()) || 0;
                } else {
                    // Fallback: Wenn Personal nicht direkt lesbar, nutze die Map (sollte bei diesen Tabellen selten sein)
                    personnelCount = getPersonnelForVehicleType(standardizedVehicleType);
                    // console.warn(`LSS Betreuungsberechnung: Personal für "${standardizedVehicleType}" (ID: ${vehicleTypeId}) in Tabelle '${tableId}' nicht direkt lesbar, nutze Wert aus Map: ${personnelCount}`);
                }
            } else {
                // console.warn(`LSS Betreuungsberechnung: Fahrzeug in Tabelle '${tableId}' ohne 'vehicle_type_id' gefunden. Überspringe:`, row.outerHTML);
                return;
            }

            if (standardizedVehicleType) {
                vehiclesData.push({ type: standardizedVehicleType, personnel: personnelCount });
            }
        });
        return vehiclesData;
    }

    /**
     * Parst die Informationen zum Betreuungsbedarf aus dem entsprechenden Div.
     * @returns {Object} Ein Objekt mit 'affectedPeople' und 'personnelToCareForInGame'.
     */
    function parseCareNeeds() {
        // Selektiert entweder das rote oder das grüne Alert-Div im spezifischen Container
        const careDiv = document.querySelector('div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-danger, div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-success');

        if (!careDiv) {
            return { affectedPeople: 0, personnelToCareForInGame: 0 };
        }

        const textContent = careDiv.textContent;
        // Zusätzliche Prüfung, ob der Text wirklich den Betreuungsbedarf enthält
        if (!textContent.includes('Betroffene') || !textContent.includes('Einsatzkräfte müssen versorgt werden')) {
            return { affectedPeople: 0, personnelToCareForInGame: 0 };
        }

        const affectedMatch = textContent.match(/(\d+)\s*Betroffene/);
        const personnelMatch = textContent.match(/(\d+)\s*Einsatzkräfte/); // Erfasst die Anzahl der zu versorgenden Einsatzkräfte

        const affectedPeople = affectedMatch ? parseInt(affectedMatch[1]) : 0;
        const personnelToCareForInGame = personnelMatch ? parseInt(personnelMatch[1]) : 0;

        return { affectedPeople: affectedPeople, personnelToCareForInGame: personnelToCareForInGame };
    }

    /**
     * Berechnet die Gesamtpersonalstärke aus einem Array von Fahrzeugdaten.
     * @param {Array<Object>} vehiclesData - Ein Array von Objekten, jedes mit { type: string, personnel: number }.
     * @returns {number} Die gesamte Personalstärke.
     */
    function calculateTotalPersonnelFromArray(vehiclesData) {
        let totalPersonnel = 0;
        vehiclesData.forEach(vehicle => {
            totalPersonnel += vehicle.personnel;
        });
        return totalPersonnel;
    }

    /**
     * Zählt und summiert die Beiträge von Betreuungsfahrzeugen.
     * @param {Array<Object>} vehiclesData - Ein Array von Objekten, jedes mit { type: string, personnel: number },
     * repräsentierend die Fahrzeuge.
     * @returns {Object} Ein Objekt mit Zählungen und bereitgestelltem Personal.
     */
    function getCareVehicleContributions(vehiclesData) {
        let currentKitchens = 0;
        let currentBtKombis = 0;
        let providedCareHelpers = 0;
        let providedTotalPersonnel = 0; // Personal auf diesen Fahrzeugen, das ebenfalls versorgt werden muss

        vehiclesData.forEach(vehicle => {
            // vehicle.type ist hier bereits der standardisierte Name
            if (vehicle.type === "GW-Küche" || vehicle.type === "FKH" || vehicle.type === "AB-Küche" || vehicle.type === "GW-Bt") {
                currentKitchens++;
                providedCareHelpers += CARE_HELPER_PER_KITCHEN;
                providedTotalPersonnel += TOTAL_PERSONNEL_PER_KITCHEN;
            } else if (vehicle.type === "Bt-Kombi") {
                currentBtKombis++;
                providedCareHelpers += CARE_HELPER_PER_BT_KOMBI;
                providedTotalPersonnel += TOTAL_PERSONNEL_PER_BT_KOMBI;
            }
        });

        return {
            selectedKitchens: currentKitchens,
            selectedBtKombis: currentBtKombis,
            providedCareHelpers: providedCareHelpers,
            providedTotalPersonnel: providedTotalPersonnel
        };
    }

    /**
     * Führt die iterative Berechnung des Betreuungsbedarfs durch.
     * Diese Funktion berechnet den BRUTTO-Bedarf, ohne Berücksichtigung bereits ausgewählter Fahrzeuge.
     * @param {number} totalAffectedPeople - Die Anzahl der Betroffenen.
     * @param {number} actualDeployedPersonnel - Die tatsächliche Anzahl des eingesetzten Personals (eigen oder alle Kräfte).
     * @param {number} personnelToCareForGameLogic - Die Anzahl der vom Spiel gemeldete zu versorgenden Einsatzkräfte (0, wenn das Spiel sagt, es müssen keine versorgt werden).
     * @returns {Object} Ein Objekt mit den berechneten Küchen, BT-Kombis, totalen Betreuungshelfern, Betreuungshelfern für Betroffene, Betreuungshelfern für Gesamtpersonal und Personal auf Betreuungsfahrzeugen.
     * Enthält nun auch hypothetische Küchen für Betroffene und Personal, sowie die finalen effektiven Personal-/Personenzahlen und separate Debug-Log-Strings für Küchen und Betreuer.
     */
    window.LSS_Care_calculateGrossCareRequirements = function(totalAffectedPeople, actualDeployedPersonnel, personnelToCareForGameLogic) {
        let currentCalculatedRequiredKitchens = 0;
        let calculatedBtKombiCount = 0;
        let currentCalculatedRequiredCareHelpers = 0;
        let careHelpersForAffected = 0;
        let careHelpersForPersonnel = 0;
        let personnelOnCareVehicles = 0; // Personal, das auf den *berechneten* Betreuungsfahrzeugen ist

        const maxIterations = 5; // Maximale Iterationen, um Endlosschleifen zu vermeiden
        let iteration = 0;
        let changed = true;

        let kitchensForAffected = 0; // Neu: Hypothetische Küchen nur für Betroffene
        let kitchensForPersonnel = 0; // Neu: Hypothetische Küchen nur für Personal

        let finalEffectivePersonnelForCoverage = 0; // Wird am Ende der Schleife den letzten Wert halten
        let finalTotalPeopleForCoverage = 0; // Wird am Ende der Schleife den letzten Wert halten

        let kitchenTooltipLog = "Berechnung Küchenbedarf:\n";
        let caregiverTooltipLog = "Berechnung Betreuerbedarf:\n";
        // overallPersonnelTooltipLog bleibt für den Fall, dass es später wieder benötigt wird,
        // wird aber hier nicht direkt für Tooltips verwendet.
        let overallPersonnelTooltipLog = "Gesamtpersonal-Berechnung:\n";

        kitchenTooltipLog += `  Initial Betroffene: ${totalAffectedPeople}\n`;
        kitchenTooltipLog += `  Initial eingesetztes Personal (ohne Betreuung): ${actualDeployedPersonnel}\n`;
        kitchenTooltipLog += `  Vom Spiel gemeldetes Personal zur Versorgung: ${personnelToCareForGameLogic}\n`;
        kitchenTooltipLog += `-----------------------------------------------------\n`;

        caregiverTooltipLog += `  Initial Betroffene: ${totalAffectedPeople}\n`;
        caregiverTooltipLog += `  Initial eingesetztes Personal (ohne Betreuung): ${actualDeployedPersonnel}\n`;
        caregiverTooltipLog += `  Vom Spiel gemeldetes Personal zur Versorgung: ${personnelToCareForGameLogic}\n`;
        caregiverTooltipLog += `-----------------------------------------------------\n`;

        while (changed && iteration < maxIterations) {
            changed = false;
            iteration++;

            // Personal auf den aktuell berechneten Betreuungsfahrzeugen
            const currentPersonnelOnCareVehiclesThisIteration = (currentCalculatedRequiredKitchens * TOTAL_PERSONNEL_PER_KITCHEN) + (calculatedBtKombiCount * TOTAL_PERSONNEL_PER_BT_KOMBI);

            // Bestimme das Personal, das für die Versorgungsberechnung herangezogen wird.
            // Wenn das Spiel explizit 0 Einsatzkräfte zur Versorgung meldet, werden nur die Betroffenen
            // berücksichtigt. Das Personal der Einsatzfahrzeuge (auch der Betreuungsfahrzeuge selbst)
            // wird in diesem spezifischen Fall NICHT zur Berechnung des Bedarfs herangezogen,
            // da die Spielmeldung dies explizit ausschließt.
            const effectivePersonnelForCoverageThisIteration = (personnelToCareForGameLogic === 0) ? 0 : (actualDeployedPersonnel + currentPersonnelOnCareVehiclesThisIteration);

            // Gesamtanzahl der Personen, die versorgt werden müssen (Betroffene + effektives Einsatzpersonal)
            const totalPeopleForCoverageThisIteration = totalAffectedPeople + effectivePersonnelForCoverageThisIteration;

            overallPersonnelTooltipLog += `Iteration ${iteration}:\n`;
            overallPersonnelTooltipLog += `  Personal der Betreuungsfahrzeuge (dieser Iteration): ${currentPersonnelOnCareVehiclesThisIteration}\n`;
            overallPersonnelTooltipLog += `  Effektives Personal (inkl. Betreuungspersonal): ${effectivePersonnelForCoverageThisIteration}\n`;
            overallPersonnelTooltipLog += `  Gesamt zu versorgende Personen: ${totalPeopleForCoverageThisIteration}\n`;


            // Berechnung der benötigten Küchen (Gesamt)
            const newRequiredKitchens = Math.ceil(totalPeopleForCoverageThisIteration / 250);
            if (newRequiredKitchens !== currentCalculatedRequiredKitchens) {
                currentCalculatedRequiredKitchens = newRequiredKitchens;
                changed = true;
            }
            kitchenTooltipLog += `Iteration ${iteration}: Benötigte Küchen (akt. Stand): ${currentCalculatedRequiredKitchens}, Neu berechnete Küchen: ${newRequiredKitchens}\n`;

            // Berechnung der benötigten Betreuungshelfer für Betroffene (1 pro 10 Betroffene)
            const newCareHelpersForAffected = Math.ceil(totalAffectedPeople / 10);
            if (newCareHelpersForAffected !== careHelpersForAffected) {
                careHelpersForAffected = newCareHelpersForAffected;
                changed = true;
            }

            // Berechnung der benötigten Betreuungshelfer für ALLE Einsatzkräfte
            const newCareHelpersForPersonnel = Math.ceil(effectivePersonnelForCoverageThisIteration / 25);
            if (newCareHelpersForPersonnel !== careHelpersForPersonnel) {
                careHelpersForPersonnel = newCareHelpersForPersonnel;
                changed = true;
            }

            // Gesamt benötigte Betreuungshelfer ist die Summe dieser beiden Bedarfe
            const newRequiredCareHelpers = careHelpersForAffected + careHelpersForPersonnel;

            if (newRequiredCareHelpers !== currentCalculatedRequiredCareHelpers) {
                currentCalculatedRequiredCareHelpers = newRequiredCareHelpers;
                changed = true;
            }
            caregiverTooltipLog += `Iteration ${iteration}: Benötigte Betreuer (akt. Stand): ${currentCalculatedRequiredCareHelpers}, Neu berechnete Betreuer: ${newRequiredCareHelpers}\n`;


            // Berechnung der benötigten BT-Kombi
            const careHelpersProvidedByKitchens = currentCalculatedRequiredKitchens * CARE_HELPER_PER_KITCHEN;
            const remainingCareHelpersNeededForBtKombi = Math.max(0, newRequiredCareHelpers - careHelpersProvidedByKitchens);
            const newRequiredBtKombi = Math.ceil(remainingCareHelpersNeededForBtKombi / CARE_HELPER_PER_BT_KOMBI);
            if (newRequiredBtKombi !== calculatedBtKombiCount) {
                calculatedBtKombiCount = newRequiredBtKombi;
                changed = true;
            }

            // Aktualisiere personnelOnCareVehicles für die Rückgabe (dies ist das *tatsächliche* Personal auf den berechneten Fahrzeugen)
            personnelOnCareVehicles = currentPersonnelOnCareVehiclesThisIteration;

            // Neu: Hypothetische Küchen für Betroffene und Personal (für die separate Anzeige)
            kitchensForAffected = Math.ceil(totalAffectedPeople / 250);
            kitchensForPersonnel = Math.ceil(effectivePersonnelForCoverageThisIteration / 250);

            // Speichere die finalen Werte der aktuellen Iteration
            finalEffectivePersonnelForCoverage = effectivePersonnelForCoverageThisIteration;
            finalTotalPeopleForCoverage = totalPeopleForCoverageThisIteration;

            overallPersonnelTooltipLog += `  Werte geändert: ${changed}\n`;
            overallPersonnelTooltipLog += `-----------------------------------------------------\n`;
        }
        overallPersonnelTooltipLog += `Iterative Bedarfsberechnung beendet nach ${iteration} Iterationen.\n`;
        kitchenTooltipLog += `Iterative Berechnung beendet. Finale Küchen: ${currentCalculatedRequiredKitchens}.\n`;
        caregiverTooltipLog += `Iterative Berechnung beendet. Finale Betreuer: ${currentCalculatedRequiredCareHelpers}.\n`;

        return {
            kitchens: Math.max(0, currentCalculatedRequiredKitchens), // Gesamt-Küchenbedarf
            btKombis: Math.max(0, calculatedBtKombiCount),
            totalCareHelpers: Math.max(0, currentCalculatedRequiredCareHelpers), // Gesamt-Betreuerbedarf
            careHelpersForAffected: careHelpersForAffected,
            careHelpersForPersonnel: careHelpersForPersonnel, // Hier den Namen beibehalten
            personnelOnCareVehicles: personnelOnCareVehicles,
            kitchensForAffected: kitchensForAffected, // Hypothetische Küchen für Betroffene
            kitchensForPersonnel: kitchensForPersonnel, // Hypothetische Küchen für Personal
            finalEffectivePersonnelForCoverage: finalEffectivePersonnelForCoverage, // Hinzugefügt
            finalTotalPeopleForCoverage: finalTotalPeopleForCoverage, // Hinzugefügt
            overallPersonnelTooltipLog: overallPersonnelTooltipLog, // Hinzugefügt für Mouseover (falls wieder benötigt)
            kitchenTooltipLog: kitchenTooltipLog, // Separate Log für Küchen-Tooltip
            caregiverTooltipLog: caregiverTooltipLog // Separate Log für Betreuer-Tooltip
        };
    }; // Wichtig: Hier ist jetzt ein Semikolon, da es eine Zuweisung ist

    /**
     * Debounced-funktion zum Aufruf von displayPersonnelOverview.
     * Verhindert zu häufige Updates bei schnellen DOM-Änderungen.
     */
    let updateTimeout = null;
    function displayPersonnelOverviewDebounced() {
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(() => {
            displayPersonnelOverview();
            updateTimeout = null;
        }, 50); // Kurze Verzögerung, um DOM-Updates zu ermöglichen
    }

    /**
     * Hilfsfunktion zum Formatieren einer Zahl in Fett (ohne spezielle Farbe, nutzt Standardtextfarbe).
     * @param {any} value - Der zu formatierende Wert.
     * @returns {string} Formatierter HTML-String.
     */
    function formatBold(value) {
        return `<span style="font-weight: bold;">${value}</span>`;
    }

    /**
     * Hilfsfunktion zum Formatieren des Ausgabe-Strings mit Farbe und Fett.
     * @param {number} currentAvailable - Die Anzahl der aktuell verfügbaren Elemente.
     * @param {number} totalNeeded - Die insgesamt benötigte Anzahl von Elementen.
     * @param {string} tooltipText - Der Text für den Tooltip.
     * @param {string} suffix - Ein optionaler Suffix, z.B. ein Sternchen (*).
     * @returns {string} Formatierter HTML-String.
     */
    function formatOutput(currentAvailable, totalNeeded, tooltipText = '', suffix = '') {
        const color = (currentAvailable >= totalNeeded) ? 'green' : 'inherit'; // Grün für erfüllt, Standardtextfarbe für nicht erfüllt
        // Ersetze Zeilenumbrüche durch HTML-Entität für Tooltips
        const escapedTooltipText = tooltipText.replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
        const tooltipAttribute = escapedTooltipText ? `title="${escapedTooltipText}" style="cursor: help;"` : '';
        return `<span style="font-weight: bold; color: ${color};" ${tooltipAttribute}>${currentAvailable}/${totalNeeded}${suffix}</span>`;
    }

    /**
     * Zeigt die Personalübersicht im Alarmfenster an.
     * Diese Funktion wird NUR aufgerufen, wenn ein Betreuungsbedarf erkannt wurde.
     */
    function displayPersonnelOverview() {
        // console.log("LSS Betreuungsberechnung: Aktualisiere Bedarfsanzeige (Neues Design).");

        // Selektiert den roten oder grünen Alert-Div im spezifischen Container
        const careDivElement = document.querySelector('div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-danger, div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-success');

        if (!careDivElement) {
            return; // Wichtig: Wenn kein Betreuungsbedarf, nichts tun.
        }

        // Das originale Alert-Div verstecken
        careDivElement.style.display = 'none';

        // --- Personalberechnungen (BLEIBEN GLEICH) ---
        // Eigene Kräfte
        const vehiclesOnSceneDataOwn = parseVehiclesAndPersonnel('mission_vehicle_at_mission', true); // Nur eigene Fahrzeuge
        const totalPersonnelOnSceneOwn = calculateTotalPersonnelFromArray(vehiclesOnSceneDataOwn);

        const vehiclesDrivingDataOwn = parseVehiclesAndPersonnel('mission_vehicle_driving', true); // Nur eigene Fahrzeuge
        const totalPersonnelEnRouteOwn = calculateTotalPersonnelFromArray(vehiclesDrivingDataOwn);

        // Ausgewählte Fahrzeuge (immer eigene)
        const vehiclesSelectedForDispatchData = parseVehiclesAndPersonnel('mission_vehicles_to_send');
        const totalPersonnelSelectedForDispatch = calculateTotalPersonnelFromArray(vehiclesSelectedForDispatchData);

        // Gesamtpersonal des Spielers (vor Ort, auf Anfahrt, ausgewählt)
        const totalOwnPersonnel = totalPersonnelOnSceneOwn + totalPersonnelEnRouteOwn + totalPersonnelSelectedForDispatch;

        const careNeeds = parseCareNeeds(); // Betroffene und zu versorgende Einsatzkräfte aus dem Div
        const totalAffectedPeople = careNeeds.affectedPeople;
        const personnelToCareForInGame = careNeeds.personnelToCareForInGame; // Die vom Spiel gemeldete Zahl

        // Beiträge der ausgewählten, vor Ort und auf Anfahrt befindlichen Betreuungsfahrzeuge (ALLE)
        const careVehicleContributionsSelected = getCareVehicleContributions(vehiclesSelectedForDispatchData);
        const selectedKitchensCount = careVehicleContributionsSelected.selectedKitchens;
        const selectedBtKombisCount = careVehicleContributionsSelected.selectedBtKombis;
        const providedCareHelpersFromSelected = careVehicleContributionsSelected.providedCareHelpers;

        const vehiclesOnSceneDataAllForCare = parseVehiclesAndPersonnel('mission_vehicle_at_mission', false); // ALLE Fahrzeuge vor Ort
        const careVehicleContributionsOnScene = getCareVehicleContributions(vehiclesOnSceneDataAllForCare);
        const onSceneKitchensCount = careVehicleContributionsOnScene.selectedKitchens;
        const onSceneBtKombisCount = careVehicleContributionsOnScene.selectedBtKombis;
        const providedCareHelpersOnScene = careVehicleContributionsOnScene.providedCareHelpers;

        const vehiclesDrivingDataAllForCare = parseVehiclesAndPersonnel('mission_vehicle_driving', false); // ALLE Fahrzeuge auf Anfahrt
        const careVehicleContributionsDriving = getCareVehicleContributions(vehiclesDrivingDataAllForCare);
        const drivingKitchensCount = careVehicleContributionsDriving.selectedKitchens;
        const drivingBtKombisCount = careVehicleContributionsDriving.selectedBtKombis;
        const providedCareHelpersDriving = careVehicleContributionsDriving.providedCareHelpers;

        // Gesamtes verfügbares Personal von Betreuungsfahrzeugen (vor Ort + auf Anfahrt + ausgewählt)
        const currentAvailableCareHelpers = providedCareHelpersFromSelected + providedCareHelpersOnScene + providedCareHelpersDriving;
        const currentAvailableKitchens = selectedKitchensCount + onSceneKitchensCount + drivingKitchensCount;

        // --- Globale Variablen setzen (verfügbare Werte) ---
        window.LSS_Care_CurrentAvailableKitchens = currentAvailableKitchens;
        window.LSS_Care_CurrentAvailableCareHelpers = currentAvailableCareHelpers;

        // --- Alle Kräfte (eigene + verbündete) ---
        const vehiclesOnSceneDataAll = parseVehiclesAndPersonnel('mission_vehicle_at_mission', false); // ALLE Fahrzeuge vor Ort
        const totalPersonnelOnSceneAll = calculateTotalPersonnelFromArray(vehiclesOnSceneDataAll);

        const vehiclesDrivingDataAll = parseVehiclesAndPersonnel('mission_vehicle_driving', false); // ALLE Fahrzeuge auf Anfahrt
        const totalPersonnelEnRouteAll = calculateTotalPersonnelFromArray(vehiclesDrivingDataAll);

        // Gesamtpersonal (eigene + verbündete + ausgewählte) für die Anzeige "Alle Kräfte"
        const totalAllPersonnel = totalPersonnelOnSceneAll + totalPersonnelEnRouteAll + totalPersonnelSelectedForDispatch;

        // Berechne Fremdpersonal
        const totalPersonnelOnSceneAllied = totalPersonnelOnSceneAll - totalPersonnelOnSceneOwn;
        const totalPersonnelEnRouteAllied = totalPersonnelEnRouteAll - totalPersonnelEnRouteOwn;
        const totalForeignPersonnel = (totalPersonnelOnSceneAllied + totalPersonnelEnRouteAllied);

        // Wenn das Spiel 0 Einsatzkräfte zur Versorgung meldet, werden die Personal-basierten Bedarfe auf 0 gesetzt.
        const effectivePersonnelFactor = (personnelToCareForInGame === 0) ? 0 : 1;

        // --- Berechnung für EIGENE Kräfte + Betroffene (Brutto-Bedarf) ---
        const ownCareResultsGross = window.LSS_Care_calculateGrossCareRequirements(totalAffectedPeople, totalOwnPersonnel, personnelToCareForInGame);

        // --- Berechnung für ALLE Kräfte + Betroffene (Brutto-Bedarf) ---
        const allCareResultsGross = window.LSS_Care_calculateGrossCareRequirements(totalAffectedPeople, totalAllPersonnel, personnelToCareForInGame);

        // --- Globale Variablen setzen (detaillierte Bedarfe) ---
        window.LSS_Care_RequiredKitchensForAffectedOwn = ownCareResultsGross.kitchensForAffected;
        window.LSS_Care_RequiredCareHelpersForAffectedOwn = ownCareResultsGross.careHelpersForAffected;
        window.LSS_Care_RequiredKitchensForOwnPersonnel = ownCareResultsGross.kitchensForPersonnel;
        window.LSS_Care_RequiredCareHelpersForOwnPersonnel = ownCareResultsGross.careHelpersForPersonnel;
        window.LSS_Care_RequiredKitchensOwnTotal = ownCareResultsGross.kitchens;
        window.LSS_Care_RequiredCareHelpersOwnTotal = ownCareResultsGross.totalCareHelpers;

        const requiredKitchensForForeignPersonnelCalculated = Math.ceil(totalForeignPersonnel * effectivePersonnelFactor / 250);
        const requiredCareHelpersForForeignPersonnelCalculated = Math.ceil(totalForeignPersonnel * effectivePersonnelFactor / 25);
        window.LSS_Care_RequiredKitchensForForeignPersonnel = requiredKitchensForForeignPersonnelCalculated;
        window.LSS_Care_RequiredCareHelpersForForeignPersonnel = requiredCareHelpersForForeignPersonnelCalculated;

        window.LSS_Care_RequiredKitchensOverall = allCareResultsGross.kitchens;
        window.LSS_Care_RequiredCareHelpersOverall = allCareResultsGross.totalCareHelpers;

        // --- Bedarfs-Werte für die Anzeige ---
        const requiredKitchensForAffected = Math.ceil(totalAffectedPeople / 250);
        const requiredCareHelpersForAffected = Math.ceil(totalAffectedPeople / 10);
        const requiredKitchensForOwnPersonnelDisplay = Math.ceil(totalOwnPersonnel * effectivePersonnelFactor / 250);
        const requiredCareHelpersForOwnPersonnelDisplay = Math.ceil(totalOwnPersonnel * effectivePersonnelFactor / 25);
        const requiredKitchensForForeignPersonnelDisplay = Math.ceil(totalForeignPersonnel * effectivePersonnelFactor / 250);
        const requiredCareHelpersForForeignPersonnelDisplay = Math.ceil(totalForeignPersonnel * effectivePersonnelFactor / 25);


        // --- NEUE HTML-ERZEUGUNG ---

        // 1. Neuen Container erstellen (falls nicht vorhanden)
        const newContainerId = 'lss-care-container-custom';
        let customContainer = document.getElementById(newContainerId);

        if (!customContainer) {
            customContainer = document.createElement('div');
            customContainer.id = newContainerId;
            // Nach dem (jetzt versteckten) originalen Alert-Div einfügen
            careDivElement.parentNode.insertBefore(customContainer, careDivElement.nextSibling);
        }
        customContainer.classList.add('compact-view'); // Immer kompakte Ansicht

        // 2. Helfer-Funktion zum Erstellen einer Tabellenzeile mit Fortschrittsbalken
        function generateRowHtml(name, fulfilled, needed, tooltip = '') {
            const isMet = fulfilled >= needed;
            const progress = needed > 0 ? Math.min((fulfilled / needed) * 100, 100) : 100;
            const backgroundPosition = 100 - progress;
            // Tooltip-Text escapen
            const tooltipAttr = tooltip ? `title="${tooltip.replace(/"/g, '&quot;').replace(/\n/g, '&#10;')}" style="cursor: help;"` : '';
            return `<tr class="${isMet ? 'vehicle-row-ok' : ''}" ${tooltipAttr}>
                        <td>${name}</td>
                        <td>
                            <div class="progress-bar-container">
                                <div class="progress-bar" style="width: ${progress}%; background-position: ${backgroundPosition}% 0;"></div>
                                <div class="progress-bar-text">${fulfilled} / ${needed}</div>
                            </div>
                        </td>
                    </tr>`;
        }

        // 3. Status und Titel festlegen
        const allCareNeedsMet = (currentAvailableKitchens >= allCareResultsGross.kitchens) &&
                              (currentAvailableCareHelpers >= allCareResultsGross.totalCareHelpers);
        customContainer.classList.toggle('all-vehicles-ok', allCareNeedsMet);
        const title = allCareNeedsMet ? 'Betreuungsbedarf gedeckt' : 'Betreuungsbedarf';
        const tableHeader = '';

        // 4. Tabelle für Küchen
        let kitchenTableBody = '';
        kitchenTableBody += generateRowHtml('Gesamtbedarf Küchen *', currentAvailableKitchens, allCareResultsGross.kitchens, allCareResultsGross.kitchenTooltipLog);
        kitchenTableBody += generateRowHtml('... für Betroffene', currentAvailableKitchens, requiredKitchensForAffected);

        // HINZUGEFÜGT: Zeige Personal-Zeilen nur, wenn Personal auch versorgt werden muss
        if (personnelToCareForInGame !== 0) {
            kitchenTableBody += generateRowHtml('... für eigene Kräfte', currentAvailableKitchens, requiredKitchensForOwnPersonnelDisplay);
            kitchenTableBody += generateRowHtml('... für fremde Kräfte', currentAvailableKitchens, requiredKitchensForForeignPersonnelDisplay);
        }

        const kitchenTable = `
            <div class="missing-vehicles-table-wrapper">
                <table class="missing-vehicles-table">
                    ${tableHeader}
                    <tbody>${kitchenTableBody}</tbody>
                </table>
            </div>`;

        // 5. Tabelle für Betreuer
        let helperTableBody = '';
        helperTableBody += generateRowHtml('Gesamtbedarf Betreuer *', currentAvailableCareHelpers, allCareResultsGross.totalCareHelpers, allCareResultsGross.caregiverTooltipLog);
        helperTableBody += generateRowHtml('... für Betroffene', currentAvailableCareHelpers, requiredCareHelpersForAffected);

        // HINZUGEFÜGT: Zeige Personal-Zeilen nur, wenn Personal auch versorgt werden muss
        if (personnelToCareForInGame !== 0) {
            helperTableBody += generateRowHtml('... für eigene Kräfte', currentAvailableCareHelpers, requiredCareHelpersForOwnPersonnelDisplay);
            helperTableBody += generateRowHtml('... für fremde Kräfte', currentAvailableCareHelpers, requiredCareHelpersForForeignPersonnelDisplay);
        }

        const helperTable = `
            <div class="missing-vehicles-table-wrapper">
                <table class="missing-vehicles-table">
                    ${tableHeader}
                    <tbody>${helperTableBody}</tbody>
                </table>
            </div>`;
        // 7. Finales HTML zusammensetzen (NEUE EINZEILIGE TITEL-LOGIK)

        // 7a. Dynamischen Titel erstellen
        let dynamicTitle = '';
        if (personnelToCareForInGame === 0) {
            // Nur Betroffene anzeigen
            dynamicTitle = `Betreuungsbedarf für ${totalAffectedPeople} Betroffene`;
        } else {
            // Alles anzeigen
            dynamicTitle = `Betreuungsbedarf für ${totalAffectedPeople} Betroffene, ${totalOwnPersonnel} eigene Kräfte & ${totalForeignPersonnel} Fremde Kräfte`;
        }

        // 7b. Finales HTML
        customContainer.innerHTML = `
            <div class="custom-container-title" style="font-size: 1.1em; margin-bottom: 8px;">
                ${dynamicTitle}
            </div>
            <div class="tables-flex-wrapper">
                ${kitchenTable}
                ${helperTable}
            </div>
        `;
        // Alte Log-Meldungen, angepasst
        console.log(`LSS Betreuung: Verfügbar: Küchen ${currentAvailableKitchens}, Helfer ${currentAvailableCareHelpers}.`);
        console.log(`Bedarf (Küchen): Betroffene:${requiredKitchensForAffected} | Eigene:${requiredKitchensForOwnPersonnelDisplay} | Fremde:${requiredKitchensForForeignPersonnelDisplay} | Gesamt:${allCareResultsGross.kitchens}`);
        console.log(`Bedarf (Betreuer): Betroffene:${requiredCareHelpersForAffected} | Eigene:${requiredCareHelpersForOwnPersonnelDisplay} | Fremde:${requiredCareHelpersForForeignPersonnelDisplay} | Gesamt:${allCareResultsGross.totalCareHelpers}`);
    }
    function attachCheckboxListeners() {
        const checkboxes = document.querySelectorAll('#vehicle_show_table_all .vehicle_checkbox');
        checkboxes.forEach(checkbox => {
            if (!checkbox.dataset.hasPersonnelOverviewChangeListener) {
                checkbox.addEventListener('change', function() {
                    displayPersonnelOverviewDebounced();
                });
                checkbox.dataset.hasPersonnelOverviewChangeListener = 'true';
            }
        });
    }

    /**
     * Fügt Event-Listener zu den speziellen Nachalarmierungs-Buttons hinzu.
     */
    function attachNachalarmierungsButtonListeners() {
        const autoAlarmButton = document.getElementById('autoAlarmButton');
        const autoAlarmButtonEMS = document.getElementById('autoAlarmButtonEMS');

        if (autoAlarmButton && !autoAlarmButton.dataset.hasPersonnelOverviewListener) {
            autoAlarmButton.addEventListener('click', () => {
                setTimeout(displayPersonnelOverviewDebounced, 200);
            });
            autoAlarmButton.dataset.hasPersonnelOverviewListener = 'true';
        }
        if (autoAlarmButtonEMS && !autoAlarmButtonEMS.dataset.hasPersonnelOverviewListener) {
            autoAlarmButtonEMS.addEventListener('click', () => {
                setTimeout(displayPersonnelOverviewDebounced, 200);
            });
                autoAlarmButtonEMS.dataset.hasPersonnelOverviewListener = 'true';
        }
    }

    /**
     * Startet einen MutationObserver, der den Container für die Fahrzeugauswahl überwacht.
     * Dieser Observer dient PRIMÄR dazu, neue Checkboxen zu erkennen und Listener anzuhängen.
     */
    let vehicleSelectionObserver = null;
    function startWatchingVehicleSelectionContainer() {
        const targetContainer = document.getElementById('vehicle_show_table_all');
        if (!targetContainer) {
            // console.warn("LSS Betreuungsberechnung: Container 'vehicle_show_table_all' nicht gefunden für Observer. Kann Checkboxen nicht überwachen.");
            return;
        }

        if (vehicleSelectionObserver) {
            vehicleSelectionObserver.disconnect();
        }

        const observerCallback = function(mutationsList, observer) {
            let shouldAttachListeners = false;
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    const hasNewVehicleRows = Array.from(mutation.addedNodes).some(node => node.nodeName === 'TR' && node.classList.contains('vehicle_select_table_tr'));
                    if (hasNewVehicleRows) {
                        shouldAttachListeners = true;
                        break;
                    }
                }
            }
            if (shouldAttachListeners) {
                attachCheckboxListeners();
            }
        };

        vehicleSelectionObserver = new MutationObserver(observerCallback);
        const observerConfig = { childList: true, subtree: true };
        vehicleSelectionObserver.observe(targetContainer, observerConfig);

        // Initial Event-Listener anhängen (für den Fall, dass Checkboxen schon da sind)
        attachCheckboxListeners();
    }

    /**
     * Startet einen MutationObserver für eine spezifische Fahrzeugtabelle,
     * um Änderungen in den Zeilen (Hinzufügen/Entfernen von Fahrzeugen) zu erkennen.
     * @param {string} tableId - Die ID der zu beobachtenden Tabelle.
     */
    function startWatchingVehicleTable(tableId) {
        const targetTable = document.getElementById(tableId);
        if (!targetTable) {
            return;
        }
        const tbody = targetTable.querySelector('tbody');
        if (!tbody) {
            return;
        }

        const observerCallback = function(mutationsList, observer) {
            let relevantChange = false;
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    const hasRelevantNodes = Array.from(mutation.addedNodes).some(node => node.nodeName === 'TR') ||
                                             Array.from(mutation.removedNodes).some(node => node.nodeName === 'TR');
                    if (hasRelevantNodes) {
                        relevantChange = true;
                        break;
                    }
                }
            }

            if (relevantChange) {
                displayPersonnelOverviewDebounced();
            }
        };

        if (!targetTable.dataset.personnelOverviewObserver) {
            const observer = new MutationObserver(observerCallback);
            observer.observe(tbody, { childList: true });
            targetTable.dataset.personnelOverviewObserver = 'true';
        }
    }

    /**
     * Startet einen MutationObserver für das #vehicle_amount Badge.
     * Dies ist der primäre Trigger für die Aktualisierung der Personalübersicht,
     * da es sich ändert, sobald Fahrzeuge ausgewählt/abgewählt werden (manuell, AAO, Skripte).
     */
    let vehicleAmountObserver = null;
    function startWatchingVehicleAmountBadge() {
        const vehicleAmountBadge = document.getElementById('vehicle_amount');
        if (!vehicleAmountBadge) {
            // console.warn("LSS Betreuungsberechnung: '#vehicle_amount' Badge nicht gefunden. Automatische Aktualisierung bei Fahrzeugauswahl könnte eingeschränkt sein.");
            return;
        }

        if (vehicleAmountObserver) {
            vehicleAmountObserver.disconnect();
        }

        const observerCallback = function(mutationsList, observer) {
            for (const mutation of mutationsList) {
                if (mutation.type === 'characterData' || (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0))) {
                    displayPersonnelOverviewDebounced();
                    break;
                }
            }
        };

        vehicleAmountObserver = new MutationObserver(observerCallback);
        vehicleAmountObserver.observe(vehicleAmountBadge, { characterData: true, subtree: true, childList: true });
    }

    /**
     * Fügt Event-Listener zu den Navigations-Tabs der Fahrzeugauswahl hinzu.
     */
    function attachTabListeners() {
        const tabLinks = document.querySelectorAll('.panel-default.vehicle_selection .nav-tabs a[data-toggle="tab"], #vehicle_show_table_all_parent .nav-tabs a[data-toggle="tab"]');
        tabLinks.forEach(tabLink => {
            if (!tabLink.dataset.hasPersonnelOverviewTabListener) {
                tabLink.addEventListener('shown.bs.tab', function() {
                    attachCheckboxListeners();
                    displayPersonnelOverviewDebounced();
                });
                tabLink.dataset.hasPersonnelOverviewTabListener = 'true';
            }
        });
    }

    /**
     * Aktiviert alle Haupt-Features des Skripts (Observer, Initialanzeige).
     * Wird nur aufgerufen, wenn Betreuungsbedarf erkannt wurde.
     */
    function activateScriptFeatures() {
        if (scriptFeaturesActivated) {
            return;
        }
        scriptFeaturesActivated = true;
        // console.log("LSS Betreuungsberechnung: Aktiviere Haupt-Skript-Features.");

        // Sicherstellen, dass die Kernelemente vorhanden sind, bevor Observer gestartet werden
        const vehiclesOnSceneTable = document.getElementById('mission_vehicle_at_mission');
        const vehicleSelectionContainer = document.getElementById('vehicle_show_table_all'); // This is the modal content
        const dispatchButtonsDiv = document.getElementById('dispatch_buttons');
        const vehicleAmountBadge = document.getElementById('vehicle_amount');

        if (!vehiclesOnSceneTable || !vehicleSelectionContainer || !dispatchButtonsDiv || !vehicleAmountBadge) {
            // console.error("LSS Betreuungsberechnung: Kritischer Fehler: Nicht alle Kernelemente für die Aktivierung gefunden. Skript funktioniert möglicherweise nicht vollständig.");
            scriptFeaturesActivated = false; // Reset, da Aktivierung fehlgeschlagen
            return;
        }

        startWatchingVehicleSelectionContainer();
        startWatchingVehicleAmountBadge();
        startWatchingVehicleTable('mission_vehicle_at_mission');
        startWatchingVehicleTable('mission_vehicle_driving');
        attachTabListeners();
        attachNachalarmierungsButtonListeners();

        // Observer für 'dispatch_buttons' muss hier gestartet werden,
        // da die Buttons dynamisch geladen werden können.
        const dispatchButtonsObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    if (Array.from(mutation.addedNodes).some(node => node.id === 'autoAlarmButton' || node.id === 'autoAlarmButtonEMS')) {
                        attachNachalarmierungsButtonListeners();
                        break;
                    }
                }
            }
        });
        dispatchButtonsObserver.observe(dispatchButtonsDiv, { childList: true });

        displayPersonnelOverviewDebounced(); // Initialanzeige der Übersicht
    }

    /**
     * Hauptfunktion zur Initialisierung der Personalübersicht.
     * Prüft einmalig beim Laden der Seite, ob das Betreuungsbedarfs-Div vorhanden ist.
     */
    function initPersonnelOverview() {
        // console.log("LSS Betreuungsberechnung: Initialisierung gestartet.");

        // Observer, der auf das Erscheinen des Betreuungsbedarfs-Divs wartet
        const careDivObserver = new MutationObserver((mutations, observer) => {
            // Selektiert entweder das rote oder das grüne Alert-Div im spezifischen Container
            const careDivElement = document.querySelector('div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-danger, div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-success');

            if (careDivElement && careDivElement.textContent.includes('Betroffene') && careDivElement.textContent.includes('Einsatzkräfte müssen versorgt werden')) {
                // console.log("LSS Betreuungsberechnung: Betreuungsbedarfs-Div gefunden. Aktiviere Skript-Features.");
                observer.disconnect(); // Observer trennen, sobald das Div gefunden wurde
                activateScriptFeatures();
            } else if (document.readyState === 'complete') {
                // Wenn das Dokument vollständig geladen ist und das Div nicht gefunden wurde,
                // gehen wir davon aus, dass kein Betreuungsbedarf besteht.
                // console.log("LSS Betreuungsberechnung: Dokument vollständig geladen, aber KEIN Betreuungsbedarfs-Div. Skript bleibt inaktiv für diese Mission.");
                observer.disconnect(); // Observer trennen, da kein Betreuungsbedarf erwartet wird
            }
            // Ansonsten wartet der Observer weiter
        });

        // Startet den Observer auf dem Body, um Änderungen im gesamten DOM zu erfassen
        careDivObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

        // Zusätzlicher initialer Check, falls das Div bereits vor dem Observer-Callback vorhanden ist
        const initialCareDiv = document.querySelector('div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-danger, div.flex-row.flex-nowrap.justify-between.align-items-center.row > div.alert.alert-success');
        if (initialCareDiv && initialCareDiv.textContent.includes('Betroffene') && initialCareDiv.textContent.includes('Einsatzkräfte müssen versorgt werden')) {
            // console.log("LSS Betreuungsberechnung: Betreuungsbedarfs-Div bereits beim Initialcheck vorhanden. Aktiviere Skript-Features sofort.");
            careDivObserver.disconnect(); // Sicherstellen, dass der Observer getrennt wird
            activateScriptFeatures();
        } else {
            // console.log("LSS Betreuungsberechnung: Betreuungsbedarfs-Div beim Initialcheck NICHT vorhanden. Skript wartet auf Trigger.");
        }
    }

    // Skript starten
    initPersonnelOverview();

})(window);
