// ==UserScript==
// @name         Benötigte Fahrzeuge WIRKLICH verschönern
// @namespace    http://tampermonkey.net/
// @version      18.2.0
// @description  Stabile und schnelle Anzeige der benötigten Fahrzeuge mit allen Features.
// @author       B&M & KI
// @match        https://www.leitstellenspiel.de/missions/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        /* Versteckt den originalen Text */
        #missing_text.hidden-by-script { display: none !important; }

        /* Hauptcontainer im neuen Design */
        #missing-vehicles-container-custom {
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
        #missing-vehicles-container-custom.all-vehicles-ok {
            background: linear-gradient(145deg, #193829, #204b36);
            border-color: #28a745;
            box-shadow: 0 0 15px rgba(40, 167, 69, 0.5);
        }

        /* Titel für den Container */
        #missing-vehicles-container-custom .custom-container-title {
            width: 100%;
            text-align: center;
            font-size: 1.5em;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 10px;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
        }

        /* Flexbox-Wrapper für die Tabellen */
        #missing-vehicles-container-custom .tables-flex-wrapper {
            display: flex;
            gap: 20px;
            width: 100%;
            flex-wrap: wrap;
        }

        /* Wrapper für eine einzelne Tabelle (3-Spalten-Layout) */
        #missing-vehicles-container-custom .missing-vehicles-table-wrapper {
            flex: 1;
            min-width: 31%;
        }

        /* Die Tabelle selbst */
        #missing-vehicles-container-custom .missing-vehicles-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 8px;
        }

        /* Tabellenüberschriften */
        #missing-vehicles-container-custom .missing-vehicles-table th {
            padding: 10px 15px;
            text-align: left;
            font-weight: bold;
            color: #8892b0;
            font-size: 0.8em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Tabellenzellen */
        #missing-vehicles-container-custom .missing-vehicles-table td {
            padding: 12px 15px;
            background-color: rgba(255, 255, 255, 0.05);
            vertical-align: middle;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Abgerundete Ecken für die Zeilen */
        #missing-vehicles-container-custom .missing-vehicles-table td:first-child { border-radius: 8px 0 0 8px; }
        #missing-vehicles-container-custom .missing-vehicles-table td:last-child { border-radius: 0 8px 8px 0; }

        /* Stil für erfüllte Zeilen */
        #missing-vehicles-container-custom .missing-vehicles-table tr.vehicle-row-ok td {
            background-color: rgba(40, 167, 69, 0.2);
            color: #98e0ab;
        }

        /* Fortschrittsbalken-Container */
        #missing-vehicles-container-custom .progress-bar-container {
            width: 100%;
            height: 22px;
            background-color: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        }

        /* Der Fortschrittsbalken selbst */
        #missing-vehicles-container-custom .progress-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #d9534f, #f0ad4e, #5cb85c);
            background-size: 300% 100%;
            border-radius: 5px;
            transition: width 0.5s ease-out, background-position 0.5s ease-out, background 0.5s ease;
        }

        /* Text auf dem Fortschrittsbalken */
        #missing-vehicles-container-custom .progress-bar-text {
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
        #missing-vehicles-container-custom .missing-vehicles-table tr.vehicle-row-ok .progress-bar {
            background: linear-gradient(90deg, #2eac53, #28a745);
        }

        /* REGELN FÜR DIE (JETZT PERMANENTE) KOMPAKTE ANSICHT */
        #missing-vehicles-container-custom.compact-view {
            padding: 12px;
            gap: 10px;
        }
        #missing-vehicles-container-custom.compact-view .custom-container-title {
            font-size: 1.2em;
            margin-bottom: 8px;
        }
        #missing-vehicles-container-custom.compact-view .missing-vehicles-table {
            border-spacing: 0 4px;
        }
        #missing-vehicles-container-custom.compact-view .missing-vehicles-table td {
            padding: 7px 12px;
        }
        #missing-vehicles-container-custom.compact-view .progress-bar-container {
            height: 20px;
        }
        #missing-vehicles-container-custom.compact-view .progress-bar-text {
            font-size: 0.8em;
        }
        /* Bereich für fehlendes Personal */
        #missing-vehicles-container-custom .personnel-requirements-wrapper {
            width: 100%;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        #missing-vehicles-container-custom .missing-vehicles-table-wrapper.personnel {
            min-width: 100%; /* Sorgt dafür, dass die Personal-Tabelle die volle Breite hat */
        }
        #missing-vehicles-container-custom .personnel-title {
            text-align: center;
            font-weight: bold;
            color: #8892b0;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
       /* NEU: Farbliche Markierung für Gewerke */
        #missing-vehicles-container-custom .missing-vehicles-table tr.department-feuerwehr td:first-child {
            border-left: 4px solid #ff2d2d; /* Rot */
        }
        #missing-vehicles-container-custom .missing-vehicles-table tr.department-rettungsdienst td:first-child {
            border-left: 4px solid #ffa500; /* Orange */
        }
        #missing-vehicles-container-custom .missing-vehicles-table tr.department-polizei td:first-child {
            border-left: 4px solid #0d6efd; /* Blau */
        }
        #missing-vehicles-container-custom .missing-vehicles-table tr.department-thw td:first-child {
            border-left: 4px solid #0000ff; /* Dunkelblau */
        }
        #missing-vehicles-container-custom .missing-vehicles-table tr.department-wasserrettung td:first-child {
            border-left: 4px solid #02a18c; /* Türkis */
        }
        #missing-vehicles-container-custom .missing-vehicles-table tr.department-seenotrettung td:first-child {
            border-left: 4px solid #ac640a; /* Braun */
        }
    `);

    const LSS_VEHICLE_TYPE_DEFINITIONS = [
    { id: '0', name: 'LF 20' }, { id: '1', name: 'LF 10' }, { id: '2', name: 'DLK 23' }, { id: '3', name: 'ELW 1' },
    { id: '4', name: 'RW' }, { id: '5', 'name': 'GW-A' }, { id: '6', name: 'LF 8/6' }, { id: '7', name: 'LF 20/16' },
    { id: '8', name: 'LF 10/6' }, { id: '9', name: 'LF 16-TS' }, { id: '10', name: 'GW-Öl' }, { id: '11', name: 'GW-L2-Wasser' },
    { id: '12', name: 'GW-Messtechnik' }, { id: '13', name: 'SW 1000' }, { id: '14', name: 'SW 2000' }, { id: '15', name: 'SW 2000-Tr' },
    { id: '16', name: 'SW Kats' }, { id: '17', name: 'TLF 2000' }, { id: '18', name: 'TLF 3000' }, { id: '19', name: 'TLF 8/8' },
    { id: '20', name: 'TLF 8/18' }, { id: '21', name: 'TLF 16/24-Tr' }, { id: '22', name: 'TLF 16/25' }, { id: '23', name: 'TLF 16/45' },
    { id: '24', name: 'TLF 20/40' }, { id: '25', name: 'TLF 20/40-SL' }, { id: '26', name: 'TLF 16' }, { id: '27', name: 'GW-Gefahrgut' },
    { id: '28', name: 'RTW' }, { id: '29', name: 'NEF' }, { id: '30', name: 'HLF 20' }, { id: '31', name: 'RTH' },
    { id: '32', name: 'FuStW' }, { id: '33', name: 'GW-Höhenrettung' }, { id: '34', name: 'ELW 2' }, { id: '35', name: 'leBefKw' },
    { id: '36', name: 'MTW' }, { id: '37', name: 'TSF-W' }, { id: '38', name: 'KTW' }, { id: '39', name: 'GKW' },
    { id: '40', name: 'MTW-TZ' }, { id: '41', name: 'MzGW (FGr N)' }, { id: '42', name: 'LKW K 9' }, { id: '43', 'name': 'BRmG R' },
    { id: '44', name: 'Anh DLE' }, { id: '45', name: 'MLW 5' }, { id: '46', name: 'WLF' }, { id: '47', name: 'AB-Rüst' },
    { id: '48', name: 'AB-Atemschutz' }, { id: '49', name: 'AB-Öl' }, { id: '50', name: 'GruKw' }, { id: '51', name: 'FüKW (Polizei)' },
    { id: '52', 'name': 'GefKw' }, { id: '53', name: 'Dekon-P' }, { id: '54', name: 'AB-Dekon-P' }, { id: '55', name: 'KdoW-LNA' },
    { id: '56', name: 'KdoW-OrgL' }, { id: '57', name: 'FwK' }, { id: '58', name: 'KTW Typ B' }, { id: '59', name: 'ELW 1 (SEG)' },
    { id: '60', name: 'GW-San' }, { id: '61', name: 'Polizeihubschrauber' }, { id: '62', name: 'AB-Schlauch' }, { id: '63', name: 'GW-Taucher' },
    { id: '64', name: 'GW-Wasserrettung' }, { id: '65', name: 'LKW 7 Lkr 19 tm' }, { id: '66', name: 'Anh MzB' }, { id: '67', name: 'Anh SchlB' },
    { id: '68', name: 'Anh MzAB' }, { id: '69', name: 'Tauchkraftwagen' }, { id: '70', name: 'MZB' }, { id: '71', name: 'AB-MZB' },
    { id: '72', name: 'WaWe 10' }, { id: '73', name: 'GRTW' }, { id: '74', name: 'NAW' }, { id: '75', 'name': 'FLF' },
    { id: '76', name: 'Rettungstreppe' },
    { id: '77', name: 'AB-Gefahrgut' }, { id: '78', name: 'AB-Einsatzleitung' }, { id: '79', name: 'SEK - ZF' },
    { id: '80', name: 'SEK - MTF' }, { id: '81', name: 'MEK - ZF' }, { id: '82', name: 'MEK - MTF' }, { id: '83', 'name': 'GW-Werkfeuerwehr' },
    { id: '84', name: 'ULF mit Löscharm' }, { id: '85', name: 'TM 50' }, { id: '86', 'name': 'Turbolöscher' }, { id: '87', name: 'TLF 4000' },
    { id: '88', name: 'KLF' }, { id: '89', name: 'MLF' }, { id: '90', 'name': 'HLF 10' }, { id: '91', name: 'Rettungshundefahrzeug' },
    { id: '92', name: 'Anh Hund' }, { id: '93', name: 'MTW-O' }, { id: '94', name: 'DHuFüKW' }, { id: '95', name: 'Polizeimotorrad' },
    { id: '96', name: 'Außenlastbehälter (allgemein)' }, { id: '97', name: 'ITW' }, { id: '98', name: 'Zivilstreifenwagen' },
    { id: '100', name: 'MLW 4' }, { id: '101', name: 'Anh SwPu' }, { id: '102', name: 'Anh 7' }, { id: '103', name: 'FuStW (DGL)' },
    { id: '104', name: 'GW-L1' }, { id: '105', name: 'GW-L2' }, { id: '106', name: 'MTF-L' }, { id: '107', name: 'LF-L' },
    { id: '108', name: 'AB-L' }, { id: '109', name: 'MzGW SB' }, { id: '110', name: 'NEA50' }, { id: '111', name: 'NEA50' },
    { id: '112', name: 'NEA200' }, { id: '113', name: 'NEA200' },
    { id: '114', name: 'GW-Lüfter' }, { id: '115', name: 'Anh Lüfter' }, { id: '116', name: 'AB-Lüfter' }, { id: '117', name: 'AB-Tank' },
    { id: '118', name: 'Kleintankwagen' }, { id: '119', name: 'AB-Lösch' }, { id: '120', name: 'Tankwagen' }, { id: '121', name: 'GTLF' },
    { id: '122', name: 'LKW 7 Lbw (FGr E)' }, { id: '123', name: 'LKW 7 Lbw (FGr WP)' }, { id: '124', name: 'MTW-OV' },
    { id: '125', name: 'MTW-Tr UL' }, { id: '126', name: 'MTF Drohne' }, { id: '127', name: 'GW UAS' }, { id: '128', name: 'ELW Drohne' },
    { id: '129', name: 'ELW2 Drohne' }, { id: '130', name: 'GW-Bt' }, { id: '131', name: 'Bt-Kombi' }, { id: '132', name: 'FKH' },
    { id: '133', name: 'Bt LKW' }, { id: '134', name: 'Pferdetransporter klein' }, { id: '135', name: 'Pferdetransporter groß' },
    { id: '136', name: 'Anh Pferdetransport' }, { id: '137', name: 'Zugfahrzeug Pferdetransport' }, { id: '138', name: 'GW-Verpflegung' },
    { id: '139', name: 'GW-Küche' }, { id: '140', name: 'MTW-Verpflegung' }, { id: '141', name: 'FKH' },
    { id: '142', name: 'AB-Küche' }, { id: '143', name: 'Anh Schlauch' }, { id: '144', name: 'FüKW (THW)' }, { id: '145', name: 'FüKomKW' },
    { id: '146', name: 'Anh FüLa' }, { id: '147', name: 'FmKW' }, { id: '148', name: 'MTW-FGr K' },
    { id: '149', name: 'GW-Bergrettung (NEF)' }, { id: '150', name: 'GW-Bergrettung' }, { id: '151', name: 'ELW Bergrettung' },
    { id: '152', name: 'ATV' }, { id: '153', name: 'Hundestaffel (Bergrettung)' }, { id: '154', name: 'Schneefahrzeug' },
    { id: '155', name: 'Anh Höhenrettung (Bergrettung)' }, { id: '156', name: 'Polizeihubschrauber mit verbauter Winde' },
    { id: '157', name: 'RTH Winde' }, { id: '158', name: 'GW-Höhenrettung (Bergrettung)' }, { id: '159', name: 'Seenotrettungskreuzer' },
    { id: '160', name: 'Seenotrettungsboot' }, { id: '161', name: 'Hubschrauber (Seenotrettung)' }, { id: '162', name: 'RW-Schiene' },
    { id: '163', name: 'HLF Schiene' }, { id: '164', name: 'AB-Schiene' }, { id: '165', name: 'LauKw' }, { id: '166', name: 'PTLF 4000' },
    { id: '167', name: 'SLF' }, { id: '168', name: 'Anh Sonderlöschmittel' }, { id: '169', name: 'AB-Sonderlöschmittel' },
    { id: '170', name: 'AB-Wasser/Schaum' },
    { id: '171', name: 'GW TeSi' }, { id: '172', name: 'LKW Technik (Notstrom)' }, { id: '173', name: 'MTW TeSi' },
    { id: '174', name: 'Anh TeSi' }, { id: '175', name: 'NEA50' },
    ];

    const VEHICLE_CATEGORIES = {"Feuerwehr":{"vehicles":{"Löschfahrzeuge":[0,1,6,7,8,9,30,37,88,89,90],"Tanklöschfahrzeuge":[17,18,19,20,21,22,23,24,25,26,87,121],"Schlauchwagen":[11,13,14,15,16],"Sonderfahrzeuge":[2,3,4,5,10,12,27,33,34,36,53,57,114,118,120,126,128,129,166,167],"WLF & Abrollbehälter":[46,47,48,49,54,62,71,77,78,108,116,117,119,142,169,170],"Anhänger":[115,143,168],"Flughafenfeuerwehr":[75,76],"Werkfeuerwehr":[83,84,85,86],"Logistikfahrzeuge":[104,105,106,107],"Netzersatzanlagen":[111,113],"Verpflegung":[138,139,140,141],"Bahnrettung":[162,163,164]},"color":"#ff2d2d"},"Rettungsdienst":{"vehicles":{"Rettungsdienstfahrzeuge":[28,29,55,56,73,74,97],"Rettungshubschrauber":[31],"KTW":[38],"SEG-Fahrzeuge":[58,59,60],"Rettungshundefahrzeuge":[91],"Drohne":[127],"BT & VPF":[130,131,132,133],"Bergrettung":[149,150,151,152,153,154,155,156,157,158],"TeSi":[171,172,173,174,175]},"color":"#ffa500"},"Polizei":{"vehicles":{"Funkstreifenwagen":[32,95,98,103],"Bereitschaftspolizei-Fahrzeuge":[35,50,51,52,72,165],"Polizeihubschrauber":[61,96],"SEK":[79,80],"MEK":[81,82],"Diensthunde":[94],"Reiterstaffel":[134,135,136,137]},"color":"#00ac00"},"THW":{"vehicles":{"GKW":[39],"Notversorgung":[41,110],"Zugtrupp":[40],"Fachgruppe Räumen":[42,43,44,45],"Fachgruppe Ortung":[92,93],"Fachgruppe Wasserschaden/Pumpen":[100,101,102,123],"Schwere Bergung":[109],"Netzersatzanlagen":[112,122],"MTW-OV":[124],"Tr UL":[125],"Fachzug Führung und Kommunikation":[144,145,146,147,148]},"color":"#0000ff"},"Wasserrettung":{"vehicles":{"Rettungsdienst & Feuerwehr":[63,64,70],"THW":[65,66,67,68,69]},"color":"#02a18c"},"Seenotrettung":{"vehicles":{"Boote":[159,160],"Hubschrauber":[161]},"color":"#ac640a"}};

    // Erstelle eine Map von Fahrzeug-ID zu Gewerk für schnelle Zugriffe
    const VEHICLE_ID_TO_DEPARTMENT_MAP = {};
    for (const department in VEHICLE_CATEGORIES) {
        for (const category in VEHICLE_CATEGORIES[department].vehicles) {
            for (const vehicleId of VEHICLE_CATEGORIES[department].vehicles[category]) {
                VEHICLE_ID_TO_DEPARTMENT_MAP[vehicleId] = department;
            }
        }
    }

    // Definiere die gewünschte Reihenfolge der Gewerke
    const DEPARTMENT_ORDER = ['Feuerwehr', 'Rettungsdienst', 'Polizei', 'THW', 'Wasserrettung', 'Seenotrettung'];

    const REQUIREMENT_MAP = {
        'gw-tesi':['171'],'mtw-tesi':['173'],'anh-tesi':['174'],'lkw-technik-(notstrom)':['172','175'],'ambulance':['28','73'],'anh-dle':['44'],'laukw':['165'],
        'anhänger-drucklufterzeugung':['44'],'anhänger-drucklufterzeugung-':['44'],'außenlastbehälter-(allgemein)':['96'],'boot':['70'],'boote':['70'],
        'dekon-p':['53','54'],'dhufükw':['94'],'drehleiter':['2','85'],'drehleiter-(dlk-23)':['2','85'],'drehleitern':['2','85'],'drehleitern-(dlk-23)':['2','85'],
        'drehleitern-(dlk-3)':['2','85'],'dlk':['2','85'],'elw':['3','128','129'],'elw-1':['3','34','78','128','129'],'elw-drohne':['128'],'elw-1-(seg)':['59'],
        'elw1_seg':['59'],'elw-2':['34','78','129'],'fachgruppen-sb':['109'], 'höhenrettung-(bergrettung)':['155','158'],
        'feuerlöschpumpe':['0','1','101','102','17','18','19','20','21','22','23','24','25','26','30','37','6','7','8','87','88','89','9','90','163','166','121','167'],
        'feuerlöschpumpen':['0','1','101','102','17','18','19','20','21','22','23','24','25','26','30','37','6','7','8','87','88','89','9','90','163','166','121','167'],
        'feuerlöschpumpen-(z.-b.-lf)':['0','1','101','102','17','18','19','20','21','22','23','24','25','26','30','37','6','7','8','87','88','89','9','90','163','166','121','167'],
        'feuerwehrkräne-(fwk)':['57'],'feuerwehrleute':['0','1','10','12','17','18','19','2','20','21','22','23','24','25','26','27','30','33','36','37','46','5','57','6','7','75','8','84','87','88','89','9','90','126'],
        'feuerwehrmann':['0','1','10','12','17','18','19','2','20','21','22','23','24','25','26','27','30','33','36','37','46','5','57','6','7','75','8','84','87','88','89','9','90','126'],
        'flugfeldlöschfahrzeug':['75'],'flugfeldlöschfahrzeuge':['75'],'funkstreifenwagen':['32','98','103'],'funkstreifenwagen-(dienstgruppenleitung)':['103'],
        'fustw':['32','103'],'fwk':['57'],'fükw':['51'],'gefahrgut':['27','77'],'gefkw':['52'],'gefangenenkraftwagen':['52'],'gerätekraftwagen':['39'],
        'gerätekraftwagen-(gkw)':['39'],'gkw':['39'],'grukw':['50'],'gw-l-2-wasser':['11','13','14','15','16','62','101','102'],'gw-a':['5','48'],
        'gw-a-oder-ab-atemschutz':['5','48'],'gw-atemschutz':['5','48'],'gw-gefahrgut':['27'],'person-mit-gw-gefahrgut-ausbildung':['27'],
        'personen-mit-gw-gefahrgut-ausbildung':['27'],'person-mit-gw-gefahrgut-ausbildung':['27'],'gw-höhenrettung':['33','158'],'gw-mess':['12'],'gw-messtechnik':['12'],'gw-san':['60'],
        'gw-taucher':['63','69'],'gw-wasserrettung':['70'],'gw-werkfeuerwehr':['83'],'gw-öl':['10','49'],'itw':['97'],'kdow-lna':['55'],
        'kdow-orgl':['56'],'ktw':['38'],'ktw-typ-b':['58'],'lebefkw':['35'],'leiter':['2','85'],
        'lkw-7-lkr-19-tm':['65'],'lkw-k-9':['42'],'lkw-kipper':['42'],'lna':['55'],'orgl':['56'],
        'löschfahrzeuge':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','163','166'],
        'löschfahrzeug-oder-rüstwagen':['0','1','4','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','163','166'],
        'löschfahrzeuge-oder-rüstwagen':['0','1','4','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','163','166'],
        'löschfahrzeug':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','163','166'],
        'löschfahrzeug-(lf)':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','163','166'],
        'löschfahrzeuge-(lf)':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','163','166'],
        'lüfter':['114','115','116'],'lüfter-erweiterungen':['114','115','116'],'mannschaftstransport-wagen':['36','126'],'maximale-patientenanzahl':['28','74'],
        'mek-fahrzeug':['81','82'],'mek-fahrzeuge':['81','82'],'mek-mtf':['82'],'mek-zf':['81'],'mlw-5':['45'],'mtw-o':['93'],'mtz-ov':['124'],
        'mtw-tz':['40'],'mzgw':['41'],'mzkw-(fgr-n)':['41'],'mzgw-(fgr-n)':['41'],'mzgw-sb':['109'],'mzkw':['41'],'nea200':['112','113'],
        'nea200-erweiterungen':['112','113'],'nea50':['110','111','112','113','175'],'nea50-erweiterungen':['110','111','112','113','175'],
        'nef':['29','31','149','157'],'nef,-lna,-orgl':['55','56'],'nef,-lna,-orgl,-rtw':['55','56'],'nef,-rtw':['28','29','31','149','157'],
        'personal':['0','1','2','5','6','7','8','9','10','12','17','18','19','20','21','22','23','24','25','26','27','30','33','36','37','46','57','75','84','87','88','89','90','126'],
        'polizeihubschrauber':['61','156'],'polizeimotorrad':['95'],'polizeimotorräder':['95'],'polizisten':['32','98'],'pumpenleistung':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','101','102'],
        'radlader':['43'],'radlader-(brmg-r)':['43'],'rettung':['29','31'],'rettungshundefahrzeug':['91','92'],'rettungshundestaffel':['91','92'],
        'rettungshundestaffel/n':['91','92'],'rettungshundestaffeln':['91','92'],'rettungstreppe':['76'],'rettungstreppen':['76'],'rettungswache':['38','74'],
        'rth':['31','157'],'rtw':['28'],'rtw-oder-ktw-oder-ktw-b':['28','38','58','73'],'rtw-oder-ktw-typ-b':['28','58'],'rtw,-ktw':['28','38'],
        'rtw,-naw':['28','74'],'rw':['4','30','47','90'],'rüstwagen':['4','30','47','90'],'rüstwagen-oder-hlf':['4','30','47','90'],
        'hlf-20':['30','4','47','90'],'hlf':['30','4','47','90'],'hlf-10':['30','4','47','90'],'schlauchwagen':['11','13','14','15','16','62','101','102'],
        'schlauchwagen-(gw-l2-wasser,-sw-1000,-sw-2000-oder-ähnliches)':['11','13','14','15','16','62','101','102'],
        'schlauchwagen-(gw-l2-wasser-oder-sw)':['11','13','14','15','16','62','101','102'],'schlauchwagen-(gw-l-wasser-oder-sw)':['11','13','14','15','16','62','101','102'],
        'schmutzwasserpumpe':['101','102'],'schmutzwasserpumpen':['101','102'],'sek-fahrzeug':['79','80'],'sek-fahrzeuge':['79','80'],'sek-mtf':['80'],
        'sek-zf':['79'],'streifenwagen':['32'],'tauchkraftwagen':['69'],'teleskopmast':['85'],'teleskopmasten':['85'],'thw-einsatzleitung':['40'],
        'thw-einsatzleitung-(mtw-tz)':['40'],'thw-mehrzweckkraftwagen':['41'],'thw-mehrzweckkraftwagen-(mzkw)':['41'],
        'tragehilfe-(z.b.-durch-ein-lf)':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','36','37','87','88','89','90'],
        'turbolöscher':['86'],'ulf':['84'],'ulf-mit-löscharm':['84'],'wasser':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','117','118','119','120','121'],
        'wasserwerfer':['72'],'wlf':['46'],'zivilstreifenwagen':['98'],'zivilstreifenwagen,-streifenwagen':['32','98'],'mtf-drohne':['126'],
        'drohneneinheit':['125','126','127','128','129'],'drohneneinheiten':['125','126','127','128','129'],
        'drohnen-erweiterungen-(fw,-thw,-seg)':['125','126','127','128','129'],'einsatzleiter-2':['34','78','129'],'gw-uas':['127'],
        'gw-bt':['130'],'gw-bt':['130'],'bt-kombi':['131'],'bt-kombi':['131'],'bt-kombis':['131'],'bt-kombis':['131'],'fkh':['141'],
        'bt-lkw':['133'],'betreuungshelfer':['130','131','133'],'verpflegungshelfer':['130','131','133','138','139'],
        'betreuungs--und-verpflegungsausstattung':['130'],'betreuungs--und-verpflegungsausstattungen':['130'],'polizeipferde':['134','135','136'],'polizeipferd':['134','135','136'],
        'reiterstaffeln':['135'],'s-personal-mit-ausbildung':['134','135','136','137'],'fükw-(thw)':['144'],'fükomkw':['145'],'anh-füla':['146'],
        'fmkw':['147'],'mtw-fgr-k':['148'],'höhenrettung-(bergrettung)':['158'],'bergrettungsfahrzeuge':['149'],'hubschrauber-mit-winde':['156','157'],
        'gw-bergrettung':['150'],'gw-bergrettung-(nef)':['149'],'bergrettung':['149','154','158'],
        'elw-bergrettung':['151'],'atv':['152'],'hundestaffel-(bergrettung)':['153'],'schneefahrzeug':['154'],'schneefahrzeuge':['154'],
        'anh-höhenrettung-(bergrettung)':['155'],'polizeihubschrauber-mit-winde':['156'],'rettungsdienstler':['91','130','138'],'fükw-(polizei)':['51'],
        'gw-verpflegung':['138','139'],'gw-küche':['139'],'mtw-verpflegung':['140'],'lkw-kipper-(lkw-k-9)':['42'],'brmg-r':['43'],'reiterstaffel':['134'],
        'tankwagen':['118','120','121'],'seenotrettungsboote-oder-seenotrettungskreuzer':['160'],'seenotrettungsboote':['160'],'seenotrettungsboot':['160'],
        'seenotrettungskreuzer':['159'],'bahnrettungsfahrzeug':['162','163'],'bahnrettungsfahrzeuge':['162','163'],'hubschrauber-(seenotrettung)':['161'],
        'thw-einsatzkräfte':['39','40','41','124'],'streifenwagen-oder-polizeimotorräder':['32','95','103'], 'funkstreifenwagen-oder-polizeimotorrad':['32','95','103'],
        'funkstreifenwagen-oder-polizeimotorräder':['32','95','103'],'l/min':['0','1','6','7','8','9','17','18','19','20','21','22','23','24','25','26','30','37','87','88','89','90','101','102']
    };

    const PERSONNEL_TO_VEHICLE_MAPPING = {
        'Betreuungshelfer': {'Bt-Kombi': 9,},
        'Verpflegungshelfer': {'GW-Bt': 2},
        'LNA': { 'KdoW-LNA': 1 },
        'OrgL': { 'KdoW-OrgL': 1 },
        'Einsatzleiter 2': {'ELW 2':1, 'AB-Einsatzleitung':0, 'ELW2 Drohne':1},
        'Feuerwehrleute': { 'HLF 20': 9, 'HLF 10': 9, 'LF 20': 9, 'LF 10': 9, 'DLK 23': 3, 'ELW 1': 3, 'LF 8/6': 9, 'LF 20/16': 9, 'LF 10/6':6, 'LF 16-TS': 9, 'TLF 2000': 3, 'TLF 3000': 3, 'TLF 8/8': 3, 'TLF 8/18': 3, 'TLF 16/24-Tr': 6, 'TLF 16/25': 6, 'TLF 16/45':3, 'TLF 20/40':3, 'TLF 20/40-SL':3, 'TLF 16':6, 'GW-A':3, 'RW':3, 'TSF-W':6, 'KLF':6, 'MLF':6, 'MTW':9, 'GW-Messtechnik':3, 'GW-Gefahrgut':3, 'GW-Öl':3, 'FLF':3, 'ULF mit Löscharm':3, 'TLF 4000':3, 'PTLF 4000':3, 'SLF':3, 'GTLF':3, 'MTF Drohne': 3, 'ELW 2':3, 'AB-Einsatzleitung':0, 'ELW Drohne':3, 'ELW2 Drohne':3, 'Rettungtreppe': 2, 'GW-Bergrettung': 6 },
        'Feuerwehrmann': { 'HLF 20': 9, 'HLF 10': 9, 'LF 20': 9, 'LF 10': 9, 'DLK 23': 3, 'ELW 1': 3, 'LF 8/6': 9, 'LF 20/16': 9, 'LF 10/6':6, 'LF 16-TS': 9, 'TLF 2000': 3, 'TLF 3000': 3, 'TLF 8/8': 3, 'TLF 8/18': 3, 'TLF 16/24-Tr': 6, 'TLF 16/25': 6, 'TLF 16/45':3, 'TLF 20/40':3, 'TLF 20/40-SL':3, 'TLF 16':6, 'GW-A':3, 'RW':3, 'TSF-W':6, 'KLF':6, 'MLF':6, 'MTW':9, 'GW-Messtechnik':3, 'GW-Gefahrgut':3, 'GW-Öl':3, 'FLF':3, 'ULF mit Löscharm':3, 'TLF 4000':3, 'PTLF 4000':3, 'SLF':3, 'GTLF':3, 'MTF Drohne': 3, 'ELW 2':3, 'AB-Einsatzleitung':0, 'ELW Drohne':3, 'ELW2 Drohne':3, 'Rettungtreppe': 2, 'GW-Bergrettung': 6 },
        'THW-Einsatzkräfte': { 'GKW': 9, 'MTW-TZ': 8, 'MzGW (FGr N)': 9, 'BRmG R': 2, 'LKW K 9':3, 'MLW 5':6, 'MLW 4':6, 'FüKW (THW)':3, 'FüKomKW':3, 'MTW-OV':6, 'MTW-Tr UL':6, 'MTW-FGr K':6 },
        'Polizisten': {'FuStW': 2, 'GruKw': 9, 'leBefKw': 3, 'FüKW (Polizei)': 3, 'GefKw':3, 'Polizeihubschrauber':3, 'Polizeimotorrad':1, 'FuStW (DGL)':2, 'Zivilstreifenwagen':2},
        'Polizist': {'FuStW': 2, 'GruKw': 9, 'leBefKw': 3, 'FüKW (Polizei)': 3, 'GefKw':3, 'Polizeihubschrauber':3, 'Polizeimotorrad':1, 'FuStW (DGL)':2, 'Zivilstreifenwagen':2},
        'Reiterstaffel': { 'Pferdetransporter klein': 4, 'Pferdetransporter groß': 2, 'Zugfahrzeug Pferdetransport': 2 },
        'Rettungsdienstler': {'RTW':2, 'NEF':2, 'KTW':2, 'KTW Typ B':2, 'GRTW':3, 'NAW':3, 'ITW':3, 'RTH':3, 'KdoW-LNA':1, 'KdoW-OrgL':1, 'GW-San':9, 'ELW 1 (SEG)':2 },
        'Personen mit GW-Gefahrgut-Ausbildung': { 'GW-Gefahrgut': 1 },
        'Person mit GW-Gefahrgut-Ausbildung': { 'GW-Gefahrgut': 1 },
        'Personen mit Dekon-P-Ausbildung': { 'Dekon-P': 6 }, // Added for Dekon-P personnel
        'GW-Wasserrettung': {
            'GW-Wasserrettung': 4, // Das Fahrzeug selbst stellt auch Personal
            'MZB': 4,
            'AB-MZB': 4,
            'Anh MzB': 4,
            'Anh SchlB': 4,
            'Anh MzAB': 4,
            'Tauchkraftwagen': 4
        }
    };

    const VEHICLE_SHORT_NAME_BY_ID = {};
    LSS_VEHICLE_TYPE_DEFINITIONS.forEach(def => {
        if (!VEHICLE_SHORT_NAME_BY_ID[def.id]) {
            VEHICLE_SHORT_NAME_BY_ID[def.id] = def.name;
        }
    });
    let requirementsState = {};
    let personnelRequirements = {};
    let mainInterval = null;

    function initialize() {
        const missingTextDiv = document.getElementById('missing_text');

        // HIER IST DIE WICHTIGE ÄNDERUNG:
        // Wir prüfen, ob die Box überhaupt existiert ODER ob sie unsichtbar ist.
        if (!missingTextDiv || missingTextDiv.style.display === 'none') {
            // Wenn ja, beenden wir das Skript für diesen Durchlauf sofort.
            return;
        }

        // Fahrzeug-Anforderungen auslesen
        requirementsState = {};
        const vehicleReqDiv = missingTextDiv.querySelector('div[data-requirement-type="vehicles"]');
        if (vehicleReqDiv) {
            const requirementText = vehicleReqDiv.innerHTML;
            const regex = /(\d+)\s*&nbsp;(.+?)(?=<br>|,|$)/g;
            let match;
            while ((match = regex.exec(requirementText)) !== null) {
                const reqName = match[2].trim().replace(/&nbsp;/g, ' ');
                let cleanName = reqName.toLowerCase().replace(/ /g, '-');
                const vehicleTypeIds = REQUIREMENT_MAP[cleanName] || [];
                requirementsState[reqName] = { needed: parseInt(match[1], 10), fulfilled: 0, vehicleTypeIds: vehicleTypeIds };
            }
        }

        // Personal-Anforderungen auslesen
        personnelRequirements = {};
        const personnelDiv = missingTextDiv.querySelector('div[data-requirement-type="personnel"]');
        if (personnelDiv) {
            const personnelText = personnelDiv.textContent.replace('Fehlendes Personal:', '');
            // HIER IST DER FIX: Die Regex akzeptiert jetzt auch Zahlen im Namen (z.B. "Einsatzleiter 2")
            const personnelRegex = /(\d+)\s*[xX]?\s*([a-zA-Z0-9\s-üäöÜÄÖß]+)/g;
            let pMatch;
            while ((pMatch = personnelRegex.exec(personnelText)) !== null) {
                const needed = parseInt(pMatch[1], 10);
                const name = pMatch[2].trim();
                if (name) {
                    personnelRequirements[name] = { needed: needed, fulfilled: 0 };
                }
            }
        }

        if (Object.keys(requirementsState).length === 0 && Object.keys(personnelRequirements).length === 0) return;

        // Führe die Zählung und Anzeige einmalig beim Start aus
        updateCountsAndRedraw();

        // Stoppe einen eventuell alten Intervall, um Doppelungen zu vermeiden
        if (mainInterval) clearInterval(mainInterval);
        mainInterval = setInterval(updateCountsAndRedraw, 250);
    }
    function updateCountsAndRedraw() {
        if (!requirementsState && !personnelRequirements) return;

        const vehiclePool = {};
        document.querySelectorAll('#mission_vehicle_driving tbody tr a[href*="/vehicles/"][vehicle_type_id]').forEach(link => {
            const vehicleTypeId = link.getAttribute('vehicle_type_id');
            if (vehicleTypeId) vehiclePool[vehicleTypeId] = (vehiclePool[vehicleTypeId] || 0) + 1;
        });

        document.querySelectorAll('.vehicle_checkbox:checked').forEach(checkbox => {
            const row = checkbox.closest('tr');
            if (!row) return;
            const tdWithId = row.querySelector('td[vehicle_type_id]');
            const vehicleTypeId = tdWithId?.getAttribute('vehicle_type_id');
            if (vehicleTypeId) vehiclePool[vehicleTypeId] = (vehiclePool[vehicleTypeId] || 0) + 1;
            const tractiveId = checkbox.getAttribute('tractive_vehicle_id');
            if (tractiveId && tractiveId !== '0') {
                const tractiveCheckbox = document.querySelector(`.vehicle_checkbox[value="${tractiveId}"]`);
                if (tractiveCheckbox) {
                    const tractiveRow = tractiveCheckbox.closest('tr');
                    const tractiveTdWithId = tractiveRow?.querySelector('td[vehicle_type_id]');
                    const tractiveVehicleTypeId = tractiveTdWithId?.getAttribute('vehicle_type_id');
                    if (tractiveVehicleTypeId) vehiclePool[tractiveVehicleTypeId] = (vehiclePool[tractiveVehicleTypeId] || 0) + 1;
                }
            }
        });

        // Fahrzeug-Erfüllung berechnen (unverändert)
        for (const reqName in requirementsState) {
            const requirement = requirementsState[reqName];
            let fulfilledCount = 0;
            for (const vehicleId in vehiclePool) {
                if (requirement.vehicleTypeIds.includes(vehicleId)) {
                    fulfilledCount += vehiclePool[vehicleId];
                }
            }
            requirement.fulfilled = fulfilledCount;
        }

        // Personal-Erfüllung berechnen (NEUE LOGIK)
        const personnelPool = {};
        for (const vehicleTypeId in vehiclePool) {
            const vehicleCount = vehiclePool[vehicleTypeId];
            const shortName = VEHICLE_SHORT_NAME_BY_ID[vehicleTypeId];
            if (shortName) {
                for (const personnelType in PERSONNEL_TO_VEHICLE_MAPPING) {
                    const providedByVehicle = PERSONNEL_TO_VEHICLE_MAPPING[personnelType][shortName];
                    if (providedByVehicle) {
                        personnelPool[personnelType] = (personnelPool[personnelType] || 0) + (providedByVehicle * vehicleCount);
                    }
                }
            }
        }

        for (const name in personnelRequirements) {
            personnelRequirements[name].fulfilled = personnelPool[name] || 0;
        }

        renderTable();
    }

    function renderTable() {
        const missingTextDiv = document.getElementById('missing_text');
        let customContainer = document.getElementById('missing-vehicles-container-custom');

        if (!customContainer) {
            customContainer = document.createElement('div');
            customContainer.id = 'missing-vehicles-container-custom';
            missingTextDiv.parentNode.insertBefore(customContainer, missingTextDiv);
            missingTextDiv.classList.add('hidden-by-script');
        }

        const vehicleEntries = Object.entries(requirementsState || {});
        const personnelEntries = Object.entries(personnelRequirements || {});

        // Komplette Fahrzeugliste VOR dem Aufteilen sortieren
        vehicleEntries.sort((a, b) => {
            const getDepartmentIndex = (entry) => {
                const firstVehicleId = entry[1].vehicleTypeIds?.[0];
                if (firstVehicleId === undefined) return DEPARTMENT_ORDER.length;
                const department = VEHICLE_ID_TO_DEPARTMENT_MAP[firstVehicleId];
                const index = DEPARTMENT_ORDER.indexOf(department);
                return index === -1 ? DEPARTMENT_ORDER.length : index;
            };
            const indexA = getDepartmentIndex(a);
            const indexB = getDepartmentIndex(b);
            if (indexA !== indexB) {
                return indexA - indexB;
            }
            return a[0].localeCompare(b[0]);
        });

        if (vehicleEntries.length === 0 && personnelEntries.length === 0) {
            customContainer.style.display = 'none';
            return;
        }
        customContainer.style.display = 'flex';
        customContainer.classList.add('compact-view');

        // Prüfen, ob ALLE Anforderungen (Fahrzeuge UND Personal) erfüllt sind
        const allRequirementsMet = vehicleEntries.every(([, counts]) => counts.fulfilled >= counts.needed) &&
                                 personnelEntries.every(([, counts]) => counts.fulfilled >= counts.needed);

        // Titel basierend auf dem Status festlegen
        let vehicleTitle = 'Benötigte Fahrzeuge'; // Standard-Titel

        if (allRequirementsMet) {
            // Wenn alles erfüllt ist, prüfe, ob eine Checkbox am Einsatzort ausgewählt ist
            const anyCheckboxChecked = document.querySelectorAll('.vehicle_checkbox:checked').length > 0;
            vehicleTitle = anyCheckboxChecked
                ? 'Alle Fahrzeuge auf Anfahrt oder ausgewählt!'
                : 'Alle Fahrzeuge auf Anfahrt!';
        }

        const displayVehicleTitle = vehicleEntries.length > 0 ? `<div class="custom-container-title">${vehicleTitle}</div>` : '';

        // Helfer-Funktion zur Generierung der Tabellenzeilen (jetzt ohne Sortierung)
        const generateBody = (entries) => {
            let bodyHtml = '';
            for (const [name, counts] of entries) {
                const { needed, fulfilled } = counts;
                const isMet = fulfilled >= needed;
                const progress = needed > 0 ? Math.min((fulfilled / needed) * 100, 100) : 100;
                const backgroundPosition = 100 - progress;

                const firstVehicleId = counts.vehicleTypeIds?.[0];
                const department = firstVehicleId !== undefined ? VEHICLE_ID_TO_DEPARTMENT_MAP[firstVehicleId] : '';
                const departmentClass = department ? `department-${department.toLowerCase().replace(/\s/g, '-')}` : '';

                bodyHtml += `<tr class="${isMet ? 'vehicle-row-ok' : ''} ${departmentClass}"><td>${name}</td><td><div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%; background-position: ${backgroundPosition}% 0;"></div><div class="progress-bar-text">${fulfilled} / ${needed}</div></div></td></tr>`;
            }
            return bodyHtml;
        };

        // --- Fahrzeug-Anforderungen ---
        const vehicleHeader = `<thead><tr><th>Fahrzeugtyp</th><th>Status</th></tr></thead>`;
        const totalVehicleEntries = vehicleEntries.length;
        const vSplit1 = Math.ceil(totalVehicleEntries / 3);
        const vSplit2 = Math.ceil(totalVehicleEntries * 2 / 3);
        const table1 = vehicleEntries.length > 0 ? `<div class="missing-vehicles-table-wrapper"><table class="missing-vehicles-table">${vehicleHeader}<tbody>${generateBody(vehicleEntries.slice(0, vSplit1))}</tbody></table></div>` : '';
        const table2 = vSplit1 < totalVehicleEntries ? `<div class="missing-vehicles-table-wrapper"><table class="missing-vehicles-table">${vehicleHeader}<tbody>${generateBody(vehicleEntries.slice(vSplit1, vSplit2))}</tbody></table></div>` : '';
        const table3 = vSplit2 < totalVehicleEntries ? `<div class="missing-vehicles-table-wrapper"><table class="missing-vehicles-table">${vehicleHeader}<tbody>${generateBody(vehicleEntries.slice(vSplit2))}</tbody></table></div>` : '';

        // --- Personal-Anforderungen ---
        const personnelHeader = `<thead><tr><th>Personal-Typ</th><th>Status</th></tr></thead>`;
        let personnelSection = ''; // Leerer String, falls kein Personal benötigt wird

        if (personnelEntries.length > 0) {
            personnelEntries.sort((a, b) => a[0].localeCompare(b[0]));
            const totalPersonnelEntries = personnelEntries.length;
            const pSplit1 = Math.ceil(totalPersonnelEntries / 3);
            const pSplit2 = Math.ceil(totalPersonnelEntries * 2 / 3);
            const pTable1 = `<div class="missing-vehicles-table-wrapper"><table class="missing-vehicles-table">${personnelHeader}<tbody>${generateBody(personnelEntries.slice(0, pSplit1))}</tbody></table></div>`;
            const pTable2 = pSplit1 < totalPersonnelEntries ? `<div class="missing-vehicles-table-wrapper"><table class="missing-vehicles-table">${personnelHeader}<tbody>${generateBody(personnelEntries.slice(pSplit1, pSplit2))}</tbody></table></div>` : '';
            const pTable3 = pSplit2 < totalPersonnelEntries ? `<div class="missing-vehicles-table-wrapper"><table class="missing-vehicles-table">${personnelHeader}<tbody>${generateBody(personnelEntries.slice(pSplit2))}</tbody></table></div>` : '';

            personnelSection = `
                <div class="personnel-requirements-wrapper">
                    <div class="personnel-title">Fehlendes Personal</div>
                    <div class="tables-flex-wrapper">
                        ${pTable1}
                        ${pTable2}
                        ${pTable3}
                    </div>
                </div>`;
        }

        // Finales HTML zusammensetzen
        customContainer.innerHTML = `
            ${displayVehicleTitle}
            <div class="tables-flex-wrapper">
                ${table1}
                ${table2}
                ${table3}
            </div>
            ${personnelSection}
        `;

        customContainer.classList.toggle('all-vehicles-ok', allRequirementsMet);
    }
setTimeout(initialize, 1);
})();
