// ==UserScript==
// @name         Fahrzeug-Benennungs-Generator
// @namespace    http://tampermonkey.net/
// @version      13.3.0-FINAL
// @description  Finale Version mit allen Modulen, Grammatik-Fix, Worker-Pool, Grid-UI und ETA.
// @author       Masklin (Umbau von Gemini)
// @match        https://www.leitstellenspiel.de/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      self
// ==/UserScript==

(function() {
    'use strict';

    // ========================================================================
    // 1. STYLES
    // ========================================================================
    GM_addStyle(`
        #ng-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); z-index: 9999; display: flex; justify-content: center; align-items: center; }
        #ng-modal-content { background-color: #282c34; color: #fff; padding: 20px; border-radius: 8px; width: 800px; max-width: 90%; max-height: 90vh; border: 1px solid #444; display: flex; flex-direction: column; }
        #ng-modal-content h3 { margin-top: 0; border-bottom: 1px solid #555; padding-bottom: 10px; }
        #ng-modal-body { flex-grow: 1; overflow-y: auto; margin-bottom: 15px; padding-right: 10px; }
        #ng-modal-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; flex-wrap: wrap; border-top: 1px solid #555; padding-top: 20px;}
        .ng-modal-btn { padding: 10px 20px; border: none; color: white; border-radius: 5px; cursor: pointer; }
        .btn-start { background-color: #28a745; }
        .btn-warning { background-color: #ffc107; color: black; }
        .btn-close { background-color: #6c757d; }

        .ng-select-all-line { display: flex; align-items: center; margin-bottom: 15px; font-size: 1.1em; border-bottom: 1px solid #555; padding-bottom: 15px; }
        .ng-select-all-line label { flex-grow: 1; cursor: pointer; display: flex; align-items: center; }
        .ng-select-all-line input { margin-right: 15px; width: 18px; height: 18px; }

        .ng-button-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .ng-module-btn { background-color: #4f545c; border: 1px solid #666; color: #ddd; padding: 8px 12px; border-radius: 5px; cursor: pointer; transition: background-color 0.2s, border-color 0.2s; text-align: left; flex-basis: calc(33.333% - 10px); box-sizing: border-box; display: flex; flex-direction: column; }
        .ng-module-btn:hover { background-color: #616770; border-color: #888; }
        .ng-module-btn.selected { background-color: #007bff; border-color: #0056b3; color: white; font-weight: bold; }
        .ng-btn-content { flex-grow: 1; }
        .ng-module-btn .count { font-size: 0.85em; font-style: italic; color: #ccc; display: block; margin-top: 4px; }
        .ng-module-btn.selected .count { color: #e0e0e0; }

        #ng-progress-status { text-align: center; margin-bottom: 10px; font-size: 1.1em; font-weight: bold; }
        #ng-worker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
            gap: 5px;
            padding: 5px;
            background-color: #1e1e1e;
            border-radius: 4px;
            max-height: 40vh;
            overflow-y: auto;
        }
        .ng-vehicle-cell {
            height: 20px;
            border-radius: 3px;
            transition: background-color 0.3s ease, color 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: monospace;
            font-size: 11px;
            font-weight: bold;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ng-vehicle-cell.status-pending { background-color: #ffffff; color: #111; }
        .ng-vehicle-cell.status-working { background-color: #ffc107; color: #111; }
        .ng-vehicle-cell.status-done { background-color: #28a745; color: #fff; }
        .ng-vehicle-cell.status-error { background-color: #dc3545; color: #fff; }
    `);

    // ========================================================================
    // 2. ZENTRALE KONFIGURATION & MODUL-DATENBANK
    // ========================================================================
    const MARKER = '\u200B';
    const MAX_WORKERS = 10;

    Array.prototype.random = function() {
        return this[Math.floor(Math.random() * this.length)];
    };

    function joinWithSuffix(base, suffix) {
        if (suffix.startsWith('-')) {
            return `${base}${suffix}`;
        }
        return `${base} ${suffix}`;
    }

    // Helper for correct adjective declension
    function declineAdjective(adjective, gender) {
        switch (gender) {
            case 'm': return adjective + 'er';
            case 'f': return adjective + 'e';
            case 'n': return adjective + 'es';
            default:  return adjective; // Fallback for plural or undefined
        }
    }

    const MODULE_CONFIG = {
        bergrettung: {
            name: "Bergrettung", emoji: "🏔️",
            targetVehicleTypes: { 149: 'GW-Bergrettung (NEF)', 150: 'GW-Bergrettung', 151: 'ELW Bergrettung', 152: 'ATV', 154: 'Schneefahrzeug', 155: 'Anh Höhenrettung (Bergrettung)', 158: 'GW-Höhenrettung (Bergrettung)' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Gipfel-", "Gletscher-", "Alpen-", "Fels-", "Schnee-", "Eis-", "Gams-", "Stein-", "Höhen-", "Lawinen-", "Grat-", "Alm-"];
                const adjektive_base = ["Eisig", "Steil", "Schroff", "Standfest", "Mutig", "Schneidig", "Alpin", "Gipfelklar", "Lawinensicher", "Abgehärtet", "Erfahren", "Trittsicher"];
                const namen = [
                    {n: "Reinhold Messner", g:"m"}, {n: "Luis Trenker", g:"m"}, {n: "Hermann Buhl", g:"m"}, {n: "Peter Habeler", g:"m"}, {n: "Gerlinde Kaltenbrunner", g:"f"}, {n: "Hans Kammerlander", g:"m"},
                    {n: "Ötzi", g:"m"}, {n: "Heidi", g:"f"}, {n: "Alm-Öhi", g:"m"}, {n: "Yeti", g:"m"}, {n: "Gletscher-Geist", g:"m"}, {n: "Bergdoktor", g:"m"}, {n: "Andreas Gabalier", g:"m"},
                    {n: "Steinbock", g:"m"}, {n: "Gams", g:"f"}, {n: "Murmeltier", g:"n"}, {n: "Adler", g:"m"}, {n: "Geier", g:"m"}, {n: "Bernhardiner", g:"m"}, {n: "Alpen-Salamander", g:"m"}, {n: "Schneehase", g:"m"}, {n: "Steinadler", g:"m"},
                    {n: "Mount Everest", g:"m"}, {n: "K2", g:"m"}, {n: "Mont Blanc", g:"m"}, {n: "Matterhorn", g:"n"}, {n: "Zugspitze", g:"f"}, {n: "Großglockner", g:"m"}, {n: "Eiger-Nordwand", g:"f"},
                    {n: "Karabiner", g:"m"}, {n: "Eispickel", g:"m"}, {n: "Steigeisen", g:"n"}, {n: "Seilschaft", g:"f"}, {n: "Biwak", g:"n"}, {n: "Lawine", g:"f"}, {n: "Gletscherspalte", g:"f"}, {n: "Klettergurt", g:"m"},
                    {n: "Schneeschuh", g:"m"}, {n: "Pistenraupe", g:"f"}, {n: "Skidoo", g:"n"}, {n: "Quad", g:"n"}, {n: "Unimog", g:"m"}, {n: "Haglund", g:"m"}, {n: "Gipfelkreuz", g:"n"}, {n: "Bergkristall", g:"m"},
                    {n: "Edelweiß", g:"n"}, {n: "Enzian", g:"m"}, {n: "Almrausch", g:"m"}, {n: "Gondel", g:"f"}, {n: "Sessellift", g:"m"}, {n: "Bergführer", g:"m"}, {n: "Hüttenwirt", g:"m"}, {n: "Sherpa", g:"m"},
                    {n: "Gipfelstürmer", g:"m"}, {n: "Alpinist", g:"m"}, {n: "Kletterer", g:"m"}, {n: "Wanderer", g:"m"}, {n: "Gipfel-Taxi", g:"n"}, {n: "Sandalen-Sammler", g:"m"}, {n: "Jodel-Diplom", g:"n"},
                    {n: "Höhen-Rettungs-Held", g:"m"}, {n: "Anti-Absturz-Einheit", g:"f"}, {n: "Gipfel-Gigant", g:"m"}, {n: "Fels-Flüsterer", g:"m"}, {n: "Eis-Eroberer", g:"m"}, {n: "Schnee-Stapfer", g:"m"},
                    {n: "Kraxel-Kommando", g:"n"}, {n: "Wand-Wächter", g:"m"}, {n: "Seil-Spezialist", g:"m"}, {n: "Haken-Held", g:"m"}, {n: "Pickel-Pionier", g:"m"}, {n: "Biwak-Bataillon", g:"n"},
                    {n: "Gurt-Gott", g:"m"}, {n: "Pisten-Polizei", g:"f"}, {n: "Kristall-Kurier", g:"m"}, {n: "Edelweiß-Express", g:"m"}, {n: "Enzian-Einsatz", g:"m"}, {n: "Hütten-Helfer", g:"m"},
                    {n: "Sherpa-Shuttle", g:"n"}, {n: "Gipfel-Gämse", g:"f"}, {n: "Gletscher-Goliath", g:"m"}, {n: "Fels-Fundament", g:"n"}, {n: "Eis-Titan", g:"m"}, {n: "Schnee-Sturm", g:"m"},
                    {n: "Alpen-Apostel", g:"m"}, {n: "Berg-Bulle", g:"m"}, {n: "Grat-Gigant", g:"m"}, {n: "Wand-Wüterich", g:"m"}, {n: "Kletter-König", g:"m"}, {n: "Seil-Souverän", g:"m"},
                    {n: "Gipfel-General", g:"m"}, {n: "Gletscher-Gebieter", g:"m"}, {n: "Fels-Fürst", g:"m"}, {n: "Eis-Imperator", g:"m"}, {n: "Schnee-Sultan", g:"m"}, {n: "Alpen-Admiral", g:"m"},
                    {n: "Berg-Berserker", g:"m"}, {n: "Gipfel-Geist", g:"m"}, {n: "Kletter-Kamikaze", g:"m"}, {n: "Seil-Samurai", g:"m"}, {n: "Haken-Haudegen", g:"m"}, {n: "Pickel-Pirat", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        betreuung: {
            name: "Feldküche", emoji: "🍲",
            targetVehicleTypes: { 130: 'GW-Bt', 131: 'Bt-Kombi', 132: 'FKH', 133: 'Bt LKW', 138: 'GW-Verpflegung', 139: 'GW-Küche', 140: 'MTW-Verpflegung', 141: 'FKH', 142: 'AB-Küche' },
            nameGenerator: function(isLarge = false) {
                const gerichte = [ { name: "Aal Grün", gender: "m" }, { name: "Aalsuppe", gender: "f" }, { name: "Adana Kebab", gender: "m" }, { name: "Ahi-Thunfisch-Steak", gender: "n" }, { name: "Ajvar", gender: "n" }, { name: "Allgäuer Kässpatzen", gender: "p" }, { name: "Amerikaner", gender: "p" }, { name: "Apfel im Schlafrock", gender: "m" }, { name: "Apfelmus", gender: "n" }, { name: "Apfelpfannkuchen", gender: "m" }, { name: "Apfelstrudel", gender: "m" }, { name: "Arme Ritter", gender: "p" }, { name: "Arrabiata", gender: "f" }, { name: "Artischocke", gender: "f" }, { name: "Asiatische Nudelpfanne", gender: "f" }, { name: "Aspik", gender: "n" }, { name: "Aubergine", gender: "f" }, { name: "Auflauf", gender: "m" }, { name: "Austern", gender: "p" }, { name: "Baba Ghanoush", gender: "n" }, { name: "Backfisch", gender: "m" }, { name: "Backkartoffel", gender: "f" }, { name: "Bacon Bomb", gender: "f" }, { name: "Baguette", gender: "n" }, { name: "Bami Goreng", gender: "n" }, { name: "Bananenbrot", gender: "n" }, { name: "Bärlauchsuppe", gender: "f" }, { name: "Bauernfrühstück", gender: "n" }, { name: "Bayerischer Wurstsalat", gender: "m" }, { name: "Beef Brisket", gender: "n" }, { name: "Beef Wellington", gender: "n" }, { name: "Beignet", gender: "m" }, { name: "Berliner", gender: "p" }, { name: "Bienenstich", gender: "m" }, { name: "Bigos", gender: "n" }, { name: "Birnen, Bohnen und Speck", gender: "p" }, { name: "Bismarckhering", gender: "m" }, { name: "Blini", gender: "p" }, { name: "Blumenkohl", gender: "m" }, { name: "Blutwurst", gender: "f" }, { name: "Bockwurst", gender: "f" }, { name: "Boeuf Bourguignon", gender: "n" }, { name: "Bohneneintopf", gender: "m" }, { name: "Bolognese", gender: "f" }, { name: "Borscht", gender: "m" }, { name: "Bouillabaisse", gender: "f" }, { name: "Bratapfel", gender: "m" }, { name: "Bratensoße", gender: "f" }, { name: "Bratkartoffeln", gender: "p" }, { name: "Bratwurst", gender: "f" }, { name: "Brezel", gender: "f" }, { name: "Brokkoli", gender: "m" }, { name: "Brownie", gender: "m" }, { name: "Bruschetta", gender: "f" }, { name: "Bulette", gender: "f" }, { name: "Bulgursalat", gender: "m" }, { name: "Burger", gender: "m" }, { name: "Burrito", gender: "m" }, { name: "Butterbrot", gender: "n" }, { name: "Calzone", gender: "f" }, { name: "Cannelloni", gender: "p" }, { name: "Caprese", gender: "f" }, { name: "Carbonara", gender: "f" }, { name: "Cevapcici", gender: "p" }, { name: "Cheesecake", gender: "m" }, { name: "Chicken Nuggets", gender: "p" }, { name: "Chicken Wings", gender: "p" }, { name: "Chili con Carne", gender: "n" }, { name: "Chili sin Carne", gender: "n" }, { name: "Churros", gender: "p" }, { name: "Clubsandwich", gender: "n" }, { name: "Coleslaw", gender: "m" }, { name: "Corn Dog", gender: "m" }, { name: "Couscous", gender: "m" }, { name: "Crème brûlée", gender: "f" }, { name: "Crepes", gender: "p" }, { name: "Crostini", gender: "p" }, { name: "Crumble", gender: "m" }, { name: "Currywurst", gender: "f" }, { name: "Dal", gender: "n" }, { name: "Dampfnudel", gender: "f" }, { name: "Döner Kebab", gender: "m" }, { name: "Donut", gender: "m" }, { name: "Dürüm", gender: "m" }, { name: "Eier im Glas", gender: "p" }, { name: "Eierkuchen", gender: "m" }, { name: "Eiersalat", gender: "m" }, { name: "Eintopf", gender: "m" }, { name: "Eisbein", gender: "n" }, { name: "Empanada", gender: "f" }, { name: "Enchilada", gender: "f" }, { name: "Erbsensuppe", gender: "f" }, { name: "Erdbeerkuchen", gender: "m" }, { name: "Fajita", gender: "f" }, { name: "Falafel", gender: "p" }, { name: "Falscher Hase", gender: "m" }, { name: "Feuerflecken", gender: "m" }, { name: "Finanztopf", gender: "m" }, { name: "Fish and Chips", gender: "p" }, { name: "Flammkuchen", gender: "m" }, { name: "Frikadelle", gender: "f" }, { name: "Frühlingsrolle", gender: "f" }, { name: "Gaisburger Marsch", gender: "m" }, { name: "Garnelen", gender: "p" }, { name: "Gazpacho", gender: "f" }, { name: "Gebratene Nudeln", gender: "p" }, { name: "Gefillde", gender: "p" }, { name: "Gemüseauflauf", gender: "m" }, { name: "Gemüsepfanne", gender: "f" }, { name: "Germknödel", gender: "m" }, { name: "Geschnetzeltes", gender: "n" }, { name: "Gnocchi", gender: "p" }, { name: "Grießbrei", gender: "m" }, { name: "Grillhähnchen", gender: "n" }, { name: "Grünkohl mit Pinkel", gender: "m" }, { name: "Gulasch", gender: "n" }, { name: "Gulaschkanone", gender: "f" }, { name: "Gurkensalat", gender: "m" }, { name: "Gyros", gender: "n" }, { name: "Hackbraten", gender: "m" }, { name: "Hähnchencurry", gender: "n" }, { name: "Halloumi", gender: "m" }, { name: "Hamburger", gender: "m" }, { name: "Handkäse mit Musik", gender: "m" }, { name: "Haxe", gender: "f" }, { name: "Hefekloß", gender: "m" }, { name: "Heringssalat", gender: "m" }, { name: "Himmel un Ääd", gender: "n" }, { name: "Hot Dog", gender: "m" }, { name: "Hummus", gender: "m" }, { name: "Jägerschnitzel", gender: "n" }, { name: "Jambalaya", gender: "f" }, { name: "Kaiserschmarrn", gender: "m" }, { name: "Käsekuchen", gender: "m" }, { name: "Käsespätzle", gender: "p" }, { name: "Kassler", gender: "n" }, { name: "Kartoffelpuffer", gender: "p" }, { name: "Kartoffelsalat", gender: "m" }, { name: "Kartoffelsuppe", gender: "f" }, { name: "Kebab", gender: "m" }, { name: "Königsberger Klopse", gender: "p" }, { name: "Köttbullar", gender: "p" }, { name: "Krautwickel", gender: "p" }, { name: "Krapfen", gender: "m" }, { name: "Labskaus", gender: "n" }, { name: "Lahmacun", gender: "f" }, { name: "Lasagne", gender: "f" }, { name: "Leberkäse", gender: "m" }, { name: "Linseneintopf", gender: "m" }, { name: "Mac and Cheese", gender: "n" }, { name: "Maultaschen", gender: "p" }, { name: "Mettbrötchen", gender: "n" }, { name: "Milchreis", gender: "m" }, { name: "Minestrone", gender: "f" }, { name: "Moussaka", gender: "n" }, { name: "Mozzarella-Sticks", gender: "p" }, { name: "Muffin", gender: "m" }, { name: "Muscheln", gender: "p" }, { name: "Nasi Goreng", gender: "n" }, { name: "Nudelauflauf", gender: "m" }, { name: "Nudelsalat", gender: "m" }, { name: "Obatzda", gender: "m" }, { name: "Ochsenschwanzsuppe", gender: "f" }, { name: "Onion Rings", gender: "p" }, { name: "Pad Thai", gender: "n" }, { name: "Paella", gender: "f" }, { name: "Pannfisch", gender: "m" }, { name: "Panna Cotta", gender: "f" }, { name: "Peking-Ente", gender: "f" }, { name: "Pellkartoffeln mit Quark", gender: "p" }, { name: "Pesto", gender: "n" }, { name: "Pfannkuchen", gender: "m" }, { name: "Pfefferpotthast", gender: "m" }, { name: "Pho", gender: "f" }, { name: "Pichelsteiner", gender: "m" }, { name: "Pierogi", gender: "p" }, { name: "Pita", gender: "f" }, { name: "Pizza", gender: "f" }, { name: "Pizzabrötchen", gender: "p" }, { name: "Polenta", gender: "f" }, { name: "Pommes Frites", gender: "p" }, { name: "Porridge", gender: "n" }, { name: "Pulled Pork", gender: "n" }, { name: "Quesadilla", gender: "f" }, { name: "Quiche", gender: "f" }, { name: "Raclette", gender: "n" }, { name: "Rahmschnitzel", gender: "n" }, { name: "Ramen", gender: "m" }, { name: "Ratatouille", gender: "n" }, { name: "Ravioli", gender: "p" }, { name: "Reibekuchen", gender: "m" }, { name: "Rinderroulade", gender: "f" }, { name: "Risotto", gender: "n" }, { name: "Rollmops", gender: "m" }, { name: "Rote Grütze", gender: "f" }, { name: "Roulade", gender: "f" }, { name: "Rührei", gender: "n" }, { name: "Samosa", gender: "f" }, { name: "Saumagen", gender: "m" }, { name: "Sauerbraten", gender: "m" }, { name: "Sauerkraut", gender: "n" }, { name: "Schaschlik", gender: "n" }, { name: "Schichtkohl", gender: "m" }, { name: "Schlachtplatte", gender: "f" }, { name: "Schnitzel", gender: "n" }, { name: "Schupfnudeln", gender: "p" }, { name: "Schwarzwälder Kirschtorte", gender: "f" }, { name: "Schweinshaxe", gender: "f" }, { name: "Semmelknödel", gender: "m" }, { name: "Senfeier", gender: "p" }, { name: "Serbische Bohnensuppe", gender: "f" }, { name: "Shakshuka", gender: "f" }, { name: "Shepherd's Pie", gender: "m" }, { name: "Soljanka", gender: "f" }, { name: "Sommerrolle", gender: "f" }, { name: "Spaghetti", gender: "p" }, { name: "Spargel", gender: "m" }, { name: "Spätzle", gender: "p" }, { name: "Spiegelei", gender: "n" }, { name: "Spinat", gender: "m" }, { name: "Steak", gender: "n" }, { name: "Strammer Max", gender: "m" }, { name: "Strudel", gender: "m" }, { name: "Sülze", gender: "f" }, { name: "Sushi", gender: "n" }, { name: "Taboulé", gender: "n" }, { name: "Taco", gender: "m" }, { name: "Tafelspitz", gender: "m" }, { name: "Tagliatelle", gender: "p" }, { name: "Tandoori Chicken", gender: "n" }, { name: "Tapas", gender: "p" }, { name: "Tartar", gender: "n" }, { name: "Tarte", gender: "f" }, { name: "Thüringer Klöße", gender: "p" }, { name: "Tiramisu", gender: "n" }, { name: "Toast Hawaii", gender: "m" }, { name: "Tofu", gender: "m" }, { name: "Tomatensuppe", gender: "f" }, { name: "Tortellini", gender: "p" }, { name: "Tsatsiki", gender: "n" }, { name: "Udon-Nudeln", gender: "p" }, { name: "Vitello Tonnato", gender: "n" }, { name: "Waffel", gender: "f" }, { name: "Weißwurst", gender: "f" }, { name: "Westfälische Rinderwurst", gender: "f" }, { name: "Wiener Schnitzel", gender: "n" }, { name: "Wirsing", gender: "m" }, { name: "Wurstgulasch", gender: "n" }, { name: "Wurstsalat", gender: "m" }, { name: "Zigeunerschnitzel", gender: "n" }, { name: "Zürcher Geschnetzeltes", gender: "n" }, { name: "Zwiebelkuchen", gender: "m" } ];
                const praefixe = ["Rollende", "Mobile", "Heisse", "Feld-", "Einsatz-", "Taktische", "Herzhafte", "Seelen-", "Wohlfühl-", "Mampf-", "Deftige"];
                const suffixe = ["Bude", "Express", "Grill", "Mobil", "Eck", "Hütte", "Kelle", "Pfanne", "Topf", "Küche", "Versorgung", "Oase", "Kombüse", "Station"];
                const personen = ["Smutje", "Küchenchef", "Kombüsen-König", "Suppen-Kasper", "Grillmeister", "Brutzler", "Feldkoch"];
                const humor = ["Futter-Krippe", "Magen-Füller", "Geschmacks-Explosion", "Kalorien-Bomber", "Seelentröster", "Moral-Heber", "Katerfrühstück", "Nervennahrung"];
                while (true) {
                    const gewaehlterTyp = ['praefix_kombi', 'suffix_kombi', 'tour_kombi', 'heiss_kombi', 'lecker_kombi', 'funktion_kombi'].random();
                    const gericht = gerichte.random();
                    switch (gewaehlterTyp) {
                        case 'praefix_kombi': return `${praefixe.random()} ${gericht.name}`;
                        case 'suffix_kombi': return `${gericht.name}-${suffixe.random()}`;
                        case 'tour_kombi': return `${gericht.name} on Tour`;
                        case 'heiss_kombi': if (gericht.gender === 'p') continue; switch (gericht.gender) { case 'm': return `Heißer ${gericht.name}`; case 'f': return `Heiße ${gericht.name}`; case 'n': return `Heißes ${gericht.name}`; } break;
                        case 'lecker_kombi': if (gericht.gender === 'p') continue; switch (gericht.gender) { case 'm': case 'n': return `Zum leckeren ${gericht.name}`; case 'f': return `Zur leckeren ${gericht.name}`; } break;
                        case 'funktion_kombi': const subTyp = ['person', 'humor'].random(); if (subTyp === 'person') { return `${praefixe.random()} ${personen.random()}`; } else { return `${humor.random()}-${suffixe.random()}`; }
                    }
                }
            }
        },
        drohnen: {
            name: "Himmels-Augen", emoji: "👁️",
            targetVehicleTypes: { 125: 'MTW-Tr UL', 126: 'MTF Drohne', 127: 'GW UAS' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Späh-", "Luft-", "Sky-", "Cyber-", "Aero-", "Aufklärungs-", "Sensor-", "Daten-", "Überwachungs-", "Adler-", "Falken-", "Geister-", "Leise-", "Rotor-", "Kamera-", "Zoom-", "Pixel-", "GPS-"];
                const adjektive_base = ["Schwebend", "Leise", "Digital", "Allsehend", "Gestochen-Scharf", "Taktisch", "Unbemerkt", "Summend", "Neugierig", "Pixelig", "Versteckt", "Autonom", "Schwirrend", "Kühl", "Windig"];
                const namen = [
                    {n: "Auge", g:"n"}, {n: "Spion", g:"m"}, {n: "Libelle", g:"f"}, {n: "Kolibri", g:"m"}, {n: "Moskito", g:"m"}, {n: "Wespe", g:"f"}, {n: "Hornisse", g:"f"},
                    {n: "Biene", g:"f"}, {n: "Falke", g:"m"}, {n: "Adler", g:"m"}, {n: "Bussard", g:"m"}, {n: "Habicht", g:"m"}, {n: "Geier", g:"m"}, {n: "Uhu", g:"m"}, {n: "Eule", g:"f"},
                    {n: "Geist", g:"m"}, {n: "Schatten", g:"m"}, {n: "Phantom", g:"n"}, {n: "Späher", g:"m"}, {n: "Beobachter", g:"m"}, {n: "Wächter", g:"m"}, {n: "Vogel", g:"m"},
                    {n: "Kamera", g:"f"}, {n: "Objektiv", g:"n"}, {n: "Sensor", g:"m"}, {n: "Pixel", g:"n"}, {n: "Zoom", g:"m"}, {n: "Gimbal", g:"m"}, {n: "Rotor", g:"m"}, {n: "Propeller", g:"m"},
                    {n: "Akku", g:"m"}, {n: "Satellit", g:"m"}, {n: "GPS", g:"n"}, {n: "Big Brother", g:"m"}, {n: "Auge des Horus", g:"n"}, {n: "Auge Saurons", g:"n"}, {n: "Skynet", g:"n"},
                    {n: "Wanze", g:"f"}, {n: "Lauschangriff", g:"m"}, {n: "UFO", g:"n"}, {n: "Reaper", g:"m"}, {n: "Predator", g:"m"}, {n: "Global Hawk", g:"m"}, {n: "Heron", g:"m"},
                    {n: "Valkyrie", g:"f"}, {n: "Heimdall", g:"m"}, {n: "Argus", g:"m"}, {n: "Cyclops", g:"m"}, {n: "Spy-Copter", g:"m"}, {n: "Nerd-Spielzeug", g:"n"}, {n: "Summ-Summ", g:"n"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        feuerwehr: {
            name: "Löschfahrzeuge", emoji: "🔥",
            targetVehicleTypes: { 0: 'LF 20', 1: 'LF 10', 6: 'LF 8/6', 7: 'LF 20/16', 8: 'LF 10/6', 9: 'LF 16-TS', 17: 'TLF 2000', 18: 'TLF 3000', 19: 'TLF 8/8', 20: 'TLF 8/18', 21: 'TLF 16/24-Tr', 22: 'TLF 16/25', 23: 'TLF 16/45', 24: 'TLF 20/40', 25: 'TLF 20/40-SL', 26: 'TLF 16', 30: 'HLF 20', 37: 'TSF-W', 84: 'ULF mit Löscharm', 86: 'Turbolöscher', 87: 'TLF 4000', 88: 'KLF', 89: 'MLF', 90: 'HLF 10', 107: 'LF-L', 121: 'GTLF', 166: 'PTLF 4000', 167: 'SLF' },
            largeVehicleIds: [121, 87, 24, 25],
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Feuer-", "Brand-", "Lösch-", "Wasser-", "Hydro-", "Sturm-", "Blitz-", "Donner-", "Glut-", "Inferno-", "Flut-", "Höllen-", "Vulkan-", "Magma-", "Asche-", "Pyro-", "Rauch-"];
                const adjektive_base = ["Rot", "Wild", "Zornig", "Rasend", "Stählern", "Mächtig", "Brüllend", "Nass", "Mutig", "Tapfer", "Heldenhaft", "Göttlich", "Legendär", "Glühend", "Sengend", "Unbezwingbar", "Stoisch", "Unaufhaltsam", "Elementar", "Donnernd", "Brachial", "Zischend", "Eiskalt", "Massiv"];
                const namen = [
                    {n: "Bulle", g:"m"}, {n: "Bär", g:"m"}, {n: "Eber", g:"m"}, {n: "Drache", g:"m"}, {n: "Walross", g:"n"}, {n: "Nashorn", g:"n"}, {n: "Elefant", g:"m"}, {n: "Mammut", g:"n"}, {n: "Dachs", g:"m"},
                    {n: "Titan", g:"m"}, {n: "Gigant", g:"m"}, {n: "Zyklop", g:"m"}, {n: "Held", g:"m"}, {n: "Goliath", g:"m"}, {n: "Thor", g:"m"}, {n: "Poseidon", g:"m"}, {n: "Krieger", g:"m"}, {n: "Barbar", g:"m"},
                    {n: "Wächter", g:"m"}, {n: "Retter", g:"m"}, {n: "Jäger", g:"m"}, {n: "Bezwinger", g:"m"}, {n: "Hydra", g:"f"}, {n: "Cerberus", g:"m"}, {n: "Phoenix", g:"m"}, {n: "Balrog", g:"m"},
                    {n: "Hephaistos", g:"m"}, {n: "Erlöser", g:"m"}, {n: "Frontbrecher", g:"m"}, {n: "Behemoth", g:"m"}, {n: "Moloch", g:"m"}, {n: "Leviathan", g:"m"}, {n: "Ifrit", g:"m"}, {n: "Salamander", g:"m"},
                    {n: "Prometheus", g:"m"}, {n: "Vulkan", g:"m"}, {n: "Hammer", g:"m"}, {n: "Amboss", g:"m"}, {n: "Klinge", g:"f"}, {n: "Speer", g:"m"}, {n: "Faust", g:"f"}, {n: "Kolben", g:"m"},
                    {n: "Komet", g:"m"}, {n: "Meteor", g:"m"}, {n: "Gletscher", g:"m"}, {n: "Fels", g:"m"}, {n: "Bohrer", g:"m"}, {n: "Pflug", g:"m"}, {n: "Ramme", g:"f"}, {n: "Brecher", g:"m"}, {n: "Generator", g:"m"},
                    {n: "Reaktor", g:"m"}, {n: "Turbine", g:"f"}, {n: "Lawine", g:"f"}, {n: "Tsunami", g:"m"}, {n: "Orkan", g:"m"}, {n: "Wellenbrecher", g:"m"}, {n: "Hydroschild", g:"n"}, {n: "Wasserwerfer", g:"m"},
                    {n: "Monitor", g:"m"}, {n: "Strahlrohr", g:"n"}, {n: "Halligan-Tool", g:"n"}, {n: "Flammpunkt", g:"m"}, {n: "Rauchgrenze", g:"f"}, {n: "Hitzeschild", g:"n"}, {n: "Maschinist", g:"m"},
                    {n: "Flashover", g:"m"}, {n: "Backdraft", g:"m"}, {n: "Hohlstrahlrohr", g:"n"}, {n: "Zumischer", g:"m"}, {n: "Innenangriff", g:"m"}, {n: "Rettungsplattform", g:"f"}, {n: "Sprungpolster", g:"n"},
                    {n: "Pyromanen-Schreck", g:"m"}, {n: "Grill-Meister", g:"m"}, {n: "BMA-Tourist", g:"m"}, {n: "Katzen-Retter", g:"m"}, {n: "Schlauch-Salat", g:"m"}, {n: "Tatü-Tata", g:"n"},
                    {n: "Feuer-Fighter", g:"m"}, {n: "Glut-Goliath", g:"m"}, {n: "Durst-Löscher", g:"m"}, {n: "Party-Pumpe", g:"f"}, {n: "Schaum-Schläger", g:"m"}, {n: "Hydranten-Hengst", g:"m"},
                    {n: "Hitze-Held", g:"m"}, {n: "Flammen-Fresser", g:"m"}, {n: "Ruß-Ritter", g:"m"}, {n: "Brand-Baron", g:"m"}, {n: "Lösch-Lord", g:"m"}, {n: "Feuer-Wall", g:"m"}, {n: "Wasserbüffel", g:"m"},
                    {n: "Roter Blitz", g:"m"}, {n: "Schaumkanone", g:"f"}, {n: "Glutvernichter 3000", g:"m"}, {n: "Sirenenpony", g:"n"}, {n: "Flammenfresser", g:"m"}, {n: "Drehmomentlöschi", g:"m"}, {n: "Rauchschlucker", g:"m"},
                    {n: "Blaulicht-Bomber", g:"m"}, {n: "Hydrantenfreund", g:"m"}, {n: "Löschinator", g:"m"}, {n: "Feuerwehr-Banane", g:"f"}, {n: "Schlauchmaster", g:"m"}, {n: "Hitzehammer", g:"m"}, {n: "Löschexpress", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                let baseName = patterns.random()();
                if (isLarge) { baseName = joinWithSuffix(baseName, ["Gigant", "Koloss", "Titan", "Goliath", "Leviathan"].random()); }
                return baseName;
            }
        },
        flughafen: {
            name: "Kerosin-Kutscher", emoji: "✈️",
            targetVehicleTypes: { 75: 'FLF', 76: 'Rettungstreppe' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Flugfeld-", "Airport-", "Crash-", "Turbinen-", "Gate-", "Tower-", "Kerosin-", "Runway-", "Vorfeld-", "Terminal-", "Hangar-", "Landebahn-", "Startbahn-", "Follow-Me-", "Pushback-"];
                const adjektive_base = ["Breit", "Schnell", "Schwer", "Schaumig", "Gigantisch", "Donnernd", "International", "Interkontinental", "Regional", "Leuchtend", "Blinkend", "Rollend", "Startklar"];
                const namen = [
                    {n: "Panther", g:"m"}, {n: "Dragon", g:"m"}, {n: "Striker", g:"m"}, {n: "Tiger", g:"m"}, {n: "Simba", g:"m"}, {n: "Ziegler", g:"m"}, {n: "Rosenbauer", g:"m"}, {n: "Oshkosh", g:"m"},
                    {n: "Buffalo", g:"m"}, {n: "Cobra", g:"f"}, {n: "Falcon", g:"m"}, {n: "Viper", g:"f"}, {n: "Puma", g:"m"}, {n: "Leopard", g:"m"}, {n: "Gate-Goliath", g:"m"}, {n: "Runway-Retter", g:"m"},
                    {n: "Turbinen-Tornado", g:"m"}, {n: "Flügel-Flüsterer", g:"m"}, {n: "Boeing-Bezwinger", g:"m"}, {n: "Airbus-Albtraum", g:"m"}, {n: "Concorde-Cop", g:"m"}, {n: "Tower-Titan", g:"m"},
                    {n: "Pushback-Panzer", g:"m"}, {n: "Vorfeld-Vulkan", g:"m"}, {n: "Terminal-Terminator", g:"m"}, {n: "Hangar-Held", g:"m"}, {n: "Landebahn-Legende", g:"f"}, {n: "Startbahn-Stratege", g:"m"},
                    {n: "Kerosin-König", g:"m"}, {n: "Schaum-Schläger", g:"m"}, {n: "Pulver-Prinz", g:"m"}, {n: "Wasser-Werfer", g:"m"}, {n: "Cockpit-Cleaner", g:"m"}, {n: "Triebwerks-Tester", g:"m"},
                    {n: "Reifen-Rächer", g:"m"}, {n: "Winglet-Wächter", g:"m"}, {n: "Fahrwerks-Fighter", g:"m"}, {n: "Leitwerks-Lord", g:"m"}, {n: "Rumpf-Ritter", g:"m"}, {n: "Frachtraum-Freund", g:"m"},
                    {n: "Gepäck-Gott", g:"m"}, {n: "Passagier-Papst", g:"m"}, {n: "Pilot-Pate", g:"m"}, {n: "Fluglotsen-Freund", g:"m"}, {n: "Boden-Crew-Boss", g:"m"}, {n: "Vogel-Schreck", g:"m"},
                    {n: "Roter-Baron", g:"m"}, {n: "Fliegende-Festung", g:"f"}, {n: "Stahl-Adler", g:"m"}, {n: "Schaum-Teppich", g:"m"}, {n: "Pulver-Puster", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        fuehrung: {
            name: "Chef-Kutschen", emoji: "👑",
            targetVehicleTypes: { 3: 'ELW 1', 34: 'ELW 2', 55: 'KdoW-LNA', 56: 'KdoW-OrgL', 35: 'leBefKw', 128: 'ELW Drohne', 129: 'ELW2 Drohne', 144: 'FüKW (THW)', 145: 'FüKomKW', 146: 'Anh FüLa', 147: 'FmKW', 148: 'MTW-FGr K', 51: 'FüKW (Polizei)', 103: 'FuStW (DGL)', 78: 'AB-Einsatzleitung', 59: 'ELW 1 (SEG)' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Chef-", "Einsatzleiter-", "Alpha-", "Kommando-", "Lagezentrum-", "Strategie-", "Master-", "Ober-", "Haupt-", "Krisenstab-", "Taktik-", "Stabs-", "Kontroll-", "Präsidial-", "Generalstabs-"];
                const adjektive_base = ["Leitend", "Dominant", "Entscheidend", "Souverän", "Wichtig", "Final", "Strategisch", "Taktisch", "Autoritär", "Unumstößlich", "Befehlend", "Delegierend", "Charismatisch", "Bürokratisch", "Visionär"];
                const namen = [
                    {n: "Häuptling", g:"m"}, {n: "General", g:"m"}, {n: "Direktor", g:"m"}, {n: "Boss", g:"m"}, {n: "Pate", g:"m"}, {n: "Meister", g:"m"}, {n: "Stratege", g:"m"}, {n: "Koordinator", g:"m"},
                    {n: "Platzhirsch", g:"m"}, {n: "Alphatier", g:"n"}, {n: "Big-Boss", g:"m"}, {n: "Kuttenträger", g:"m"}, {n: "Präsident", g:"m"}, {n: "Imperator", g:"m"}, {n: "Kanzler", g:"m"},
                    {n: "Senator", g:"m"}, {n: "Admiral", g:"m"}, {n: "Befehlshaber", g:"m"}, {n: "Vorstand", g:"m"}, {n: "CEO", g:"m"}, {n: "Aufsichtsrat", g:"m"}, {n: "Feldmarschall", g:"m"},
                    {n: "Patriarch", g:"m"}, {n: "Magnat", g:"m"}, {n: "Strippenzieher", g:"m"}, {n: "Dirigent", g:"m"}, {n: "Zeremonienmeister", g:"m"}, {n: "Caesar", g:"m"}, {n: "Napoleon", g:"m"},
                    {n: "Sun Tzu", g:"m"}, {n: "König", g:"m"}, {n: "Bauer", g:"m"}, {n: "Läufer", g:"m"}, {n: "Springer", g:"m"}, {n: "Turm", g:"m"}, {n: "Dame", g:"f"}, {n: "Rochade", g:"f"}, {n: "Gambit", g:"n"},
                    {n: "Masterplan", g:"m"}, {n: "Direktive", g:"f"}, {n: "Lagekarte", g:"f"}, {n: "Führungsstab", g:"m"}, {n: "Kommando-Brücke", g:"f"}, {n: "Machtwort", g:"n"}, {n: "Veto", g:"n"},
                    {n: "Organigramm", g:"n"}, {n: "Mastermind-Mobil", g:"n"}, {n: "Schachzug", g:"m"}, {n: "Befehlskette", g:"f"}, {n: "Meldekopf", g:"m"}, {n: "Task-Force", g:"f"}, {n: "Synergy", g:"f"},
                    {n: "Kaffee-Beauftragter", g:"m"}, {n: "Plan-Macher", g:"m"}, {n: "Entscheider", g:"m"}, {n: "Taktikfuchs", g:"m"}, {n: "Meeting-Meister", g:"m"}, {n: "Presse-Sprecher", g:"m"},
                    {n: "Westentaschen-General", g:"m"}, {n: "Excel-Tabellen-Fürst", g:"m"}, {n: "PowerPoint-Pirat", g:"m"}, {n: "Dienstwagen-Don", g:"m"}, {n: "Koryphäe", g:"f"}, {n: "Eminenz", g:"f"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        gefahrgut: {
            name: "Giftmischer", emoji: "☣️",
            targetVehicleTypes: { 53: 'Dekon-P', 27: 'GW-Gefahrgut', 12: 'GW-Messtechnik', 5: 'GW-A', 77: 'AB-Gefahrgut', 54: 'AB-Dekon-P', 48: 'AB-Atemschutz' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Chemie-", "Gift-", "Säure-", "Strahlen-", "Deko-", "ABC-", "Atom-", "Bio-", "Gas-", "Mess-", "Spür-", "Analyse-", "Labor-", "Isotopen-", "Molekül-", "Proben-", "Filter-", "Schutz-"];
                const adjektive_base = ["Ätzend", "Giftig", "Radioaktiv", "Dicht", "Sicher", "Hermetisch", "Analytisch", "Gefährlich", "Flüchtig", "Instabil", "Reaktiv", "Gekapselt", "Gemessen", "Gefiltert"];
                const namen = [
                    {n: "Walter White", g:"m"}, {n: "Heisenberg", g:"m"}, {n: "Marie Curie", g:"f"}, {n: "Fritz Haber", g:"m"}, {n: "Paracelsus", g:"m"}, {n: "Dr. No", g:"m"}, {n: "Dr. Poison", g:"f"},
                    {n: "Joker", g:"m"}, {n: "Scarecrow", g:"m"}, {n: "Poison Ivy", g:"f"}, {n: "Pinguin", g:"m"}, {n: "Lex Luthor", g:"m"}, {n: "Green Goblin", g:"m"}, {n: "Pandora's Büchse", g:"f"},
                    {n: "Tschernobyl-Express", g:"m"}, {n: "Fukushima-Taxi", g:"n"}, {n: "Säurefass", g:"n"}, {n: "Atommüll-Transporter", g:"m"}, {n: "Gift-Küche", g:"f"}, {n: "Hexen-Küche", g:"f"},
                    {n: "Drogen-Labor", g:"n"}, {n: "Mobile-Dusche", g:"f"}, {n: "ABC-Schütze", g:"m"}, {n: "Mess-Fuchs", g:"m"}, {n: "Spür-Hund", g:"m"}, {n: "Analyse-Einheit", g:"f"},
                    {n: "Labor-Ratte", g:"f"}, {n: "Isotopen-Jäger", g:"m"}, {n: "Molekül-Magier", g:"m"}, {n: "Proben-Sammler", g:"m"}, {n: "Filter-Freak", g:"m"}, {n: "Geigerzähler", g:"m"},
                    {n: "Dosimeter", g:"n"}, {n: "Prüfröhrchen", g:"n"}, {n: "Lackmus-Papier", g:"n"}, {n: "Explosimeter", g:"n"}, {n: "Spektrometer", g:"n"}, {n: "Chromatograph", g:"m"},
                    {n: "CSA", g:"m"}, {n: "Pressluftatmer", g:"m"}, {n: "Filtermaske", g:"f"}, {n: "Dosis", g:"f"}, {n: "Becquerel", g:"n"}, {n: "Sievert", g:"n"}, {n: "Auffangwanne", g:"f"},
                    {n: "Bindemittel", g:"n"}, {n: "Neutralisationsmittel", g:"n"}, {n: "Erdungs-Stange", g:"f"}, {n: "Dekontamination", g:"f"}, {n: "Uran", g:"n"}, {n: "Plutonium", g:"n"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        hubrettung: {
            name: "Himmelsleitern", emoji: "🪜",
            targetVehicleTypes: { 57: 'FwK', 2: 'DLK 23', 85: 'TM 50' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Leiter-", "Rettungs-", "Gelenk-", "Teleskop-", "Höhen-", "Himmels-", "Turm-", "Wolken-", "Gipfel-", "Dach-", "Balkon-", "Fenster-", "Fassaden-", "Hydraulik-", "Stahl-"];
                const adjektive_base = ["Lang", "Hoch", "Stählern", "Ausgefahren", "Hydraulisch", "Standfest", "Schwindelfrei", "Rettend", "Steil", "Senkrecht", "Gelenkig", "Massiv", "Eisern", "Unbeugsam"];
                const namen = [
                    {n: "Jakobsleiter", g:"f"}, {n: "Turm", g:"m"}, {n: "Giraffe", g:"f"}, {n: "Kranich", g:"m"}, {n: "Langer-Gustav", g:"m"}, {n: "Ikarus", g:"m"}, {n: "Daedalus", g:"m"},
                    {n: "Adlerhorst", g:"m"}, {n: "Falkennest", g:"n"}, {n: "Aussichtsplattform", g:"f"}, {n: "Sprungturm", g:"m"}, {n: "Leuchtturm", g:"m"}, {n: "Gipfelkreuz", g:"n"},
                    {n: "Wolkenkratzer", g:"m"}, {n: "Babylon", g:"n"}, {n: "Eiffelturm", g:"m"}, {n: "Rapunzel", g:"f"}, {n: "Himmelsstürmer", g:"m"}, {n: "Senkrechtstarter", g:"m"},
                    {n: "Hochstapler", g:"m"}, {n: "Aufzug", g:"m"}, {n: "Fahrstuhl", g:"m"}, {n: "Korb", g:"m"}, {n: "Gondel", g:"f"}, {n: "Sessellift", g:"m"}, {n: "Mast", g:"m"},
                    {n: "Pfeiler", g:"m"}, {n: "Träger", g:"m"}, {n: "Ausleger", g:"m"}, {n: "Gelenk", g:"n"}, {n: "Teleskop", g:"n"}, {n: "Hydraulik", g:"f"}, {n: "Stempel", g:"m"},
                    {n: "Stütze", g:"f"}, {n: "Katzen-Retter", g:"m"}, {n: "Feuer-Fahrstuhl", g:"m"}, {n: "Balkon-Taxi", g:"n"}, {n: "Fenster-Gucker", g:"m"}, {n: "Stockwerk-Shuttle", g:"n"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        hunde: {
            name: "Spürnasen", emoji: "🐕",
            targetVehicleTypes: { 91: 'Rettungshundefahrzeug', 92: 'Anh Hund', 94: 'DHuFüKW', 153: 'Hundestaffel (Bergrettung)' },
            largeVehicleIds: [153],
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Spürnasen-", "Fährten-", "Rettungs-", "Leckerli-", "Bello-", "Wuff-", "K-9-", "Hunde-", "Fellnasen-", "Pfoten-", "Knochen-"];
                const adjektive_base = ["Treu", "Wachsam", "Laut", "Fein", "Spitzfindig", "Mutig", "Verfressen", "Verspielt", "Heldenhaft", "Unbestechlich", "Sabbernd", "Loyal"];
                const substantive_hunde = [
                    {n: "Partner", g:"m"}, {n: "Kollege", g:"m"}, {n: "Wächter", g:"m"}, {n: "Spürnase", g:"f"}, {n: "Fährtensucher", g:"m"}, {n: "Retter", g:"m"}, {n: "Held", g:"m"},
                    {n: "Beschützer", g:"m"}, {n: "Ermittler", g:"m"}, {n: "Beißer", g:"m"}, {n: "Kläffer", g:"m"}, {n: "Helfer auf 4 Pfoten", g:"m"}
                ];
                const namen = [
                    {n: "Kommissar Rex", g:"m"}, {n: "Lassie", g:"f"}, {n: "Rin Tin Tin", g:"m"}, {n: "Beethoven", g:"m"}, {n: "Hachiko", g:"m"}, {n: "Cerberus", g:"m"}, {n: "Scooby-Doo", g:"m"},
                    {n: "Struppi", g:"m"}, {n: "Idefix", g:"m"}, {n: "Barry", g:"m"}, {n: "Buddy", g:"m"}, {n: "Chase", g:"m"}, {n: "Marshall", g:"m"}, {n: "Bolt", g:"m"},
                    {n: "Schäferhund", g:"m"}, {n: "Malinois", g:"m"}, {n: "Rottweiler", g:"m"}, {n: "Bernhardiner", g:"m"}, {n: "Golden Retriever", g:"m"}, {n: "Labrador", g:"m"},
                    {n: "Spürhund", g:"m"}, {n: "Bluthund", g:"m"}, {n: "Dobermann", g:"m"}, {n: "Dalmatiner", g:"m"}, {n: "Beagle", g:"m"}, {n: "Border Collie", g:"m"},
                    {n: "Dackel", g:"m"}, {n: "Husky", g:"m"}, {n: "Terrier", g:"m"}, {n: "Dogge", g:"f"}, {n: "Mastiff", g:"m"}, {n: "Schnauzer", g:"m"}, {n: "Boxer", g:"m"},
                    {n: "Leckerli-Bomber", g:"m"}, {n: "Bello-Mobil", g:"n"}, {n: "Spürnasen-Express", g:"m"}, {n: "Fährten-Ferkel", g:"n"}, {n: "K-9-Kutsche", g:"f"}, {n: "Sabber-Shuttle", g:"n"},
                    {n: "Tatort-Taz", g:"m"}, {n: "Wadenbeißer-Wagen", g:"m"}, {n: "Fell-Geschoss", g:"n"}, {n: "Knochen-Jäger", g:"m"}, {n: "Postboten-Schreck", g:"m"}
                ];

                if (isLarge) {
                    const alpin_praefixe = ["Alpen-", "Gletscher-", "Lawinen-", "Gipfel-", "Firn-", "Geröll-", "Schnee-"];
                    const alpin_adjektive_base = ["Trittsicher", "Schneefest", "Alpin", "Kälte-resistent"];
                    const alpin_namen = [ {n:"Lawinen-Wuff", g:"m"}, {n:"Alpen-Bello", g:"m"}, {n:"Gipfel-Kläffer", g:"m"}, {n:"Schnee-Schnauze", g:"f"}, {n:"Geröll-Retriever", g:"m"}, {n:"Yeti-Jäger", g:"m"}, {n:"Murmeltier-Melder", g:"m"}, {n:"Firn-Finder", g:"m"}, {n:"Barry der Held", g:"m"}, {n:"Heidi's Held", g:"m"}, {n: "Alm-Apportierer", g:"m"} ];
                    const hybrid_patterns = [
                        () => alpin_namen.random().n,
                        () => {
                            const nounObj = substantive_hunde.random();
                            if (nounObj.n.includes(' ')) return nounObj.n;
                            return `${alpin_praefixe.random()}${nounObj.n}`;
                        },
                        () => {
                            const adj = alpin_adjektive_base.random();
                            const nounObj = substantive_hunde.random();
                            return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                        }
                    ];
                    return hybrid_patterns.random()();
                } else {
                    const patterns = [
                        () => namen.random().n,
                        () => {
                            const adj = adjektive_base.random();
                            const nounObj = substantive_hunde.random();
                            return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                        },
                        () => {
                            const nounObj = substantive_hunde.random();
                            if (nounObj.n.includes(' ')) return nounObj.n;
                            return `${praefixe.random()}${nounObj.n}`;
                        }
                    ];
                    return patterns.random()();
                }
            }
        },
        luftrettung: {
            name: "Luftrettung", emoji: "🚁",
            targetVehicleTypes: { 31: 'RTH', 61: 'Polizeihubschrauber', 156: 'Polizeihubschrauber mit verbauter Winde', 157: 'RTH Winde', 161: 'Hubschrauber (Seenotrettung)', 96: 'Außenlastbehälter (allgemein)' },
            largeVehicleIds: [96],
            nameGenerator: function(isLarge = false) {
                if (isLarge) {
                    const praefixe = ["Lösch-", "Wasser-", "Waldbrand-", "Flächenbrand-", "Feuer-", "Regen-", "Wolken-", "Sturz-", "Bomben-"];
                    const adjektive_base = ["Nass", "Schwer", "Plötzlich", "Kühlend", "Entscheidend", "Punktgenau", "Großflächig"];
                    const namen = [
                        {n:"Bomber", g:"m"}, {n:"Regenmacher", g:"m"}, {n:"Wolkenbruch", g:"m"}, {n:"Monsun", g:"m"}, {n:"Sintflut", g:"f"}, {n:"Tsunami", g:"m"}, {n:"Wasserfall", g:"m"},
                        {n:"Katarakt", g:"m"}, {n:"Sturzbach", g:"m"}, {n:"Guss", g:"m"}, {n:"Schauer", g:"m"}, {n:"Niederschlag", g:"m"}, {n:"Fontäne", g:"f"}, {n:"Geysir", g:"m"},
                        {n:"Cloudbuster", g:"m"}, {n:"Fire-Bomber", g:"m"}, {n:"Water-Bomber", g:"m"}, {n:"Lösch-Ei", g:"n"}, {n:"Regen-Tanz", g:"m"}
                    ];
                    const patterns = [
                        () => namen.random().n,
                        () => {
                            const adj = adjektive_base.random();
                            const nounObj = namen.random();
                            return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                        },
                        () => `${praefixe.random()}${namen.random().n}`
                    ];
                    return patterns.random()();
                } else {
                    const praefixe = ["Himmels-", "Luft-", "Wolken-", "Rotor-", "Turbinen-", "Götter-", "Engels-", "Sturm-", "Alpen-", "Aero-", "Gipfel-", "Senkrecht-"];
                    const adjektive_base = ["Fliegend", "Schwebend", "Schnell", "Göttlich", "Himmlisch", "Stählern", "Allsehend", "Donnernd", "Windig", "Kreisend", "Steigend", "Majestätisch"];
                    const namen = [
                        {n: "Adler", g:"m"}, {n: "Falke", g:"m"}, {n: "Bussard", g:"m"}, {n: "Kondor", g:"m"}, {n: "Greif", g:"m"}, {n: "Albatros", g:"m"}, {n: "Ikarus", g:"m"},
                        {n: "Pegasus", g:"m"}, {n: "Valkyrie", g:"f"}, {n: "Garuda", g:"m"}, {n: "Erzengel", g:"m"}, {n: "Schutzengel", g:"m"}, {n: "Himmelsbote", g:"m"}, {n: "Retter", g:"m"},
                        {n: "Horus", g:"m"}, {n: "Hermes", g:"m"}, {n: "Milan", g:"m"}, {n: "Sturmvogel", g:"m"}, {n: "Zeus", g:"m"}, {n: "Thor", g:"m"}, {n: "Auge", g:"n"},
                        {n: "Winde", g:"f"}, {n: "Klinge", g:"f"}, {n: "Wirbelsturm", g:"m"}, {n: "Himmels-Auge", g:"n"}, {n: "Rotorblatt", g:"n"}, {n: "Thermik", g:"f"}, {n: "Gipfelstürmer", g:"m"},
                        {n: "Senkrechtstarter", g:"m"}, {n: "Aufwind", g:"m"}, {n: "Föhn", g:"m"}, {n: "Pilot", g:"m"}, {n: "Windenoperator", g:"m"}, {n: "Luft-Taxi", g:"n"}, {n: "Propeller-Prinz", g:"m"},
                        {n: "Knatter-Kiste", g:"f"}, {n: "Himmels-Fahrstuhl", g:"m"}, {n: "Thermik-Tester", g:"m"}, {n: "Ventilator-Deluxe", g:"m"}, {n: "Teuerstes-Taxi", g:"n"}
                    ];
                    const patterns = [
                        () => namen.random().n,
                        () => {
                            const adj = adjektive_base.random();
                            let nounObj;
                            do {
                                nounObj = namen.random();
                            } while (nounObj.n.includes(' '));
                            return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                        },
                        () => {
                            const nounObj = namen.random();
                            if (nounObj.n.includes(' ')) return nounObj.n;
                            return `${praefixe.random()}${nounObj.n}`;
                        }
                    ];
                    return patterns.random()();
                }
            }
        },
        pferde: {
            name: "Hü-Hott-Express", emoji: "🐎",
            targetVehicleTypes: { 134: 'Pferdetransporter klein', 135: 'Pferdetransporter groß', 136: 'Anh Pferdetransport', 137: 'Zugfahrzeug Pferdetransport' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Huf-", "Galopp-", "Reiter-", "Kavallerie-", "Stall-", "Koppel-", "Heu-", "Hafer-", "Sattel-", "Striegel-", "Pferdestärken-"];
                const adjektive_base = ["Stolz", "Edel", "Wild", "Schnaubend", "Trotzig", "Sanft", "Anmutig", "Ungezähmt", "Königlich", "Schwer", "Galoppierend", "Wiehernd"];
                const namen = [
                    {n: "Fury", g:"m"}, {n: "Black Beauty", g:"f"}, {n: "Jolly Jumper", g:"m"}, {n: "Sleipnir", g:"m"}, {n: "Bucephalus", g:"m"}, {n: "Schattenfell", g:"n"}, {n: "Pegasus", g:"m"},
                    {n: "Kleiner Onkel", g:"m"}, {n: "Amigo", g:"m"}, {n: "Tornado", g:"m"}, {n: "Zorro", g:"m"}, {n: "Silver", g:"m"}, {n: "Trigger", g:"m"}, {n: "Champion", g:"m"}, {n: "Maximus", g:"m"},
                    {n: "Spirit", g:"m"}, {n: "Haflinger", g:"m"}, {n: "Friese", g:"m"}, {n: "Andalusier", g:"m"}, {n: "Shire Horse", g:"n"}, {n: "Mustang", g:"m"}, {n: "Araber", g:"m"},
                    {n: "Lipizzaner", g:"m"}, {n: "Kaltblut", g:"n"}, {n: "Warmblut", g:"n"}, {n: "Vollblut", g:"n"}, {n: "Hufschlag", g:"m"}, {n: "Galopp", g:"m"}, {n: "Trab", g:"m"},
                    {n: "Sattel", g:"m"}, {n: "Zaumzeug", g:"n"}, {n: "Pferdestärke", g:"f"}, {n: "Kutsche", g:"f"}, {n: "Kavallerie", g:"f"}, {n: "Hafer-Moped", g:"n"}, {n: "Laser-Pony", g:"n"},
                    {n: "Einsatz-Einhorn", g:"n"}, {n: "Möhren-Mafia", g:"f"}, {n: "Trab-Titan", g:"m"}, {n: "Sattel-Sheriff", g:"m"}, {n: "Amtsschimmel", g:"m"}, {n: "Hengst", g:"m"},
                    {n: "Rappe", g:"m"}, {n: "Schimmel", g:"m"}, {n: "Fuchs", g:"m"}, {n: "Wallach", g:"m"}, {n: "Streitross", g:"n"}, {n: "Husar", g:"m"}, {n: "Ulan", g:"m"}, {n: "Dragoner", g:"m"},
                    {n: "Kürassier", g:"m"}, {n: "Zentaur", g:"m"}, {n: "Gaul", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        polizei: {
            name: "Freund & Helfer", emoji: "🚓",
            targetVehicleTypes: { 32: 'FuStW', 95: 'Polizeimotorrad', 50: 'GruKw', 52: 'GefKw', 98: 'Zivilstreifenwagen' },
            largeVehicleIds: [52, 50],
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Streifen-", "Einsatz-", "Alarm-", "Zivil-", "Sonder-", "Verfolgungs-", "Fahndungs-", "Razzia-", "Blaulicht-", "Beweis-", "Zugriffs-", "Observierungs-", "Protokoll-", "Paragraphen-", "Sicherungs-", "Abschnitts-", "Kripo-", "Soko-"];
                const adjektive_base = ["Streng", "Wachsam", "Schnell", "Unbestechlich", "Eisern", "Gesetzestreu", "Müde", "Hart", "Cool", "Kompromisslos", "Unerbittlich", "Hartnäckig", "Präzis", "Observierend", "Schlaflos", "Bürokratisch", "Unnachgiebig", "Verdeckt", "Ermittelnd"];
                const namen = [
                    {n: "Gesetzeshüter", g:"m"}, {n: "Wachtmeister", g:"m"}, {n: "Kommissar", g:"m"}, {n: "Ermittler", g:"m"}, {n: "Sheriff", g:"m"}, {n: "Richter", g:"m"}, {n: "Ordnungshüter", g:"m"},
                    {n: "Fahnder", g:"m"}, {n: "Detektiv", g:"m"}, {n: "Spürhund", g:"m"}, {n: "Adlerauge", g:"n"}, {n: "Inspektor", g:"m"}, {n: "Marshall", g:"m"}, {n: "Vollstrecker", g:"m"},
                    {n: "Wächter", g:"m"}, {n: "Kopfgeldjäger", g:"m"}, {n: "Spürfuchs", g:"m"}, {n: "Wachhund", g:"m"}, {n: "Bluthund", g:"m"}, {n: "Habicht", g:"m"}, {n: "Hauptmeister", g:"m"},
                    {n: "Zivilfahnder", g:"m"}, {n: "Asphalt-Cowboy", g:"m"}, {n: "Profiler", g:"m"}, {n: "Schatten", g:"m"}, {n: "Ermittlungsrichter", g:"m"}, {n: "Staatsanwalt", g:"m"},
                    {n: "Kriminaltechniker", g:"m"}, {n: "Haftbefehl", g:"m"}, {n: "Alibi", g:"n"}, {n: "Protokoll", g:"n"}, {n: "Indiz", g:"n"}, {n: "Ermittlungsakte", g:"f"}, {n: "Rapport", g:"m"},
                    {n: "Zeugenaussage", g:"f"}, {n: "Täterprofil", g:"n"}, {n: "Gerechtigkeit", g:"f"}, {n: "Ordnung", g:"f"}, {n: "Gesetz", g:"n"}, {n: "Prävention", g:"f"}, {n: "Platzverweis", g:"m"},
                    {n: "Diebstahl", g:"m"}, {n: "Betrug", g:"m"}, {n: "Nötigung", g:"f"}, {n: "Zeugenvernehmung", g:"f"}, {n: "Funkdisziplin", g:"f"}, {n: "Lagebild", g:"n"}, {n: "Schutzweste", g:"f"},
                    {n: "Bodycam", g:"f"}, {n: "Radarpistole", g:"f"}, {n: "Alkomat", g:"m"}, {n: "Strafantrag", g:"m"}, {n: "Sicherstellung", g:"f"}, {n: "Donut-Vernichter", g:"m"},
                    {n: "Kaffee-Kocher", g:"m"}, {n: "Strafzettel-Baron", g:"m"}, {n: "Knöllchen-König", g:"m"}, {n: "Akten-Schlepper", g:"m"}, {n: "Kaffee-Junkie", g:"m"}, {n: "Donut-Inspektor", g:"m"},
                    {n: "Feierabend-Jäger", g:"m"}, {n: "Blitzer-Baron", g:"m"}, {n: "Krapfen-Kommando", g:"n"}, {n: "Schicht-Schieber", g:"m"}, {n: "Freund und Helfer", g:"m"},
                    {n: "Sherlock Holmes", g:"m"}, {n: "Columbo", g:"m"}, {n: "Kojak", g:"m"}, {n: "Derrick", g:"m"}, {n: "Schimanski", g:"m"}, {n: "Bulle von Tölz", g:"m"}, {n: "CSI", g:"m"}, {n: "FBI", g:"n"}, {n: "BKA", g:"n"}, {n: "LKA", g:"n"}, {n: "Interpol", g:"f"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                let baseName = patterns.random()();
                if (isLarge) { baseName = `${baseName} ${["(Transport)", "(Schwerlast)", "(Zellenblock)", "(Mannschaft)"].random()}`; }
                return baseName;
            }
        },
        rettung: {
            name: "Blaulicht-Taxis", emoji: "🚑",
            targetVehicleTypes: { 28: 'RTW', 73: 'GRTW', 29: 'NEF', 74: 'NAW', 38: 'KTW', 58: 'KTW Typ B', 97: 'ITW', 60: 'GW-San' },
            largeVehicleIds: [73, 60],
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Notfall-", "Rettungs-", "Pflaster-", "Pillen-", "Blaulicht-", "Kaffee-", "Herz-", "Klinik-", "Intensiv-", "Trauma-", "EKG-", "Defi-", "Adrenalin-", "Lebens-", "Aua-"];
                const adjektive_base = ["Schnell", "Eilig", "Müde", "Geduldig", "Piepsend", "Desinfiziert", "Lebensrettend", "Stabil", "Ruhig", "Hektisch", "Pulsierend", "Steril", "Diagnostisch", "Beruhigend"];
                const namen = [
                    {n: "Samariter", g:"m"}, {n: "Lebensretter", g:"m"}, {n: "Schutzengel", g:"m"}, {n: "Notarzt", g:"m"}, {n: "Sanitäter", g:"m"}, {n: "Ersthelfer", g:"m"}, {n: "Chirurg", g:"m"},
                    {n: "Anästhesist", g:"m"}, {n: "Erstversorger", g:"m"}, {n: "Schutzpatron", g:"m"}, {n: "Weißer Ritter", g:"m"}, {n: "Desinfektor", g:"m"}, {n: "Seelentröster", g:"m"},
                    {n: "Florence Nightingale", g:"f"}, {n: "Puls", g:"m"}, {n: "Trauma-Team", g:"n"}, {n: "Diagnose", g:"f"}, {n: "Lebensfunke", g:"m"}, {n: "Hoffnung", g:"f"}, {n: "Zweite-Chance", g:"f"},
                    {n: "Adrenalin-Stoß", g:"m"}, {n: "Infusion", g:"f"}, {n: "Venenkatheter", g:"m"}, {n: "Herzkammer", g:"f"}, {n: "Aorta", g:"f"}, {n: "Sinusknoten", g:"m"}, {n: "Stethoskop", g:"n"},
                    {n: "Blutdruck-Manager", g:"m"}, {n: "EKG-Schreiber", g:"m"}, {n: "Defibrillator", g:"m"}, {n: "Atropin", g:"n"}, {n: "Intubation", g:"f"}, {n: "Thoraxdrainage", g:"f"},
                    {n: "Glukose", g:"f"}, {n: "Schockraum", g:"m"}, {n: "Intensivstation", g:"f"}, {n: "Vakuummatratze", g:"f"}, {n: "Schaufeltrage", g:"f"}, {n: "Pillen-Taxi", g:"n"},
                    {n: "Aua-Wagen", g:"m"}, {n: "Schnupfen-Express", g:"m"}, {n: "Blaulicht-Bote", g:"m"}, {n: "Herzensbrecher", g:"m"}, {n: "Schock-Therapeut", g:"m"}, {n: "Kaffee-Kurier", g:"m"},
                    {n: "Pulsschubser", g:"m"}, {n: "Husten-Taxi", g:"n"}, {n: "Männer-Schnupfen-Mobil", g:"n"}, {n: "Jammer-Lappen-Jäger", g:"m"}, {n: "Wehwehchen-Wagen", g:"m"},
                    {n: "Hypochonder-Heiland", g:"m"}, {n: "Bettenschubser", g:"m"}, {n: "Asphalt-Ambulanz", g:"f"}, {n: "Heftpflaster-Held", g:"m"}, {n: "Kaffee-Infusion", g:"f"}, {n: "Legebatterie", g:"f"},
                    {n: "Simulanten-Scanner", g:"m"}, {n: "Aspirin-Apostel", g:"m"}, {n: "RTW-Chauffeur", g:"m"}, {n: "Pflaster-Kleber", g:"m"}, {n: "Rettungs-Rambo", g:"m"}, {n: "Notfall-Nanny", g:"f"}, {n: "Blaulicht-Baron", g:"m"}
                ];
                 const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                let baseName = patterns.random()();
                if (isLarge) { baseName = `${baseName} ${["Klinik-Shuttle", "Maxi-Ambulanz", "Betten-Transporter", "Katastrophen-Helfer"].random()}`; }
                return baseName;
            }
        },
        schienenfahrzeuge: {
            name: "Lokomotuffen", emoji: "🚂",
            targetVehicleTypes: { 162: 'RW-Schiene', 163: 'HLF Schiene' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Schienen-", "Gleis-", "Zug-", "Bahn-", "Tunnel-", "Weichen-", "Stellwerks-", "ICE-", "Express-", "Güter-", "Regional-", "Signal-", "Waggon-", "Schwellen-", "Oberleitungs-"];
                const adjektive_base = ["Eisern", "Ratternd", "Schwer", "Unaufhaltsam", "Pünktlich", "Verspätet", "Entgleist", "Rostig", "Quietschend", "Dampfend", "Elektrisch", "Dieselnd"];
                const namen = [
                    {n: "Emma", g:"f"}, {n: "Thomas", g:"m"}, {n: "Adler", g:"m"}, {n: "Rocket", g:"f"}, {n: "Big Boy", g:"m"}, {n: "Mallard", g:"f"}, {n: "Flying Scotsman", g:"m"},
                    {n: "Rheingold", g:"n"}, {n: "Orient-Express", g:"m"}, {n: "Hogwarts-Express", g:"m"}, {n: "Polar-Express", g:"m"}, {n: "Geister-Zug", g:"m"}, {n: "Bummel-Zug", g:"m"},
                    {n: "Rasender-Roland", g:"m"}, {n: "Molly", g:"f"}, {n: "Lokführer-Lukas", g:"m"}, {n: "Jim Knopf", g:"m"}, {n: "Schaffner", g:"m"}, {n: "Heizer", g:"m"}, {n: "Rangierer", g:"m"},
                    {n: "Fahrdienstleiter", g:"m"}, {n: "Schienen-Sheriff", g:"m"}, {n: "Gleis-Goliath", g:"m"}, {n: "Tunnel-Terror", g:"m"}, {n: "Weichen-Willi", g:"m"}, {n: "ICE", g:"m"},
                    {n: "TGV", g:"m"}, {n: "Shinkansen", g:"m"}, {n: "Dampflok", g:"f"}, {n: "Diesellok", g:"f"}, {n: "E-Lok", g:"f"}, {n: "Triebwagen", g:"m"}, {n: "Waggon", g:"m"}, {n: "Bahnhof", g:"m"},
                    {n: "Stellwerk", g:"n"}, {n: "Weiche", g:"f"}, {n: "Signal", g:"n"}, {n: "Gleis", g:"n"}, {n: "Schiene", g:"f"}, {n: "Schwelle", g:"f"}, {n: "Stromabnehmer", g:"m"},
                    {n: "Puffer", g:"m"}, {n: "Kupplung", g:"f"}, {n: "Bremse", g:"f"}, {n: "Rad", g:"n"}, {n: "Tender", g:"m"}, {n: "Kessel", g:"m"}, {n: "Schornstein", g:"m"}, {n: "Zylinder", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        schlauchwagen: {
            name: "Wasser-Autobahn", emoji: "💧",
            targetVehicleTypes: { 13: 'SW 1000', 14: 'SW 2000', 15: 'SW 2000-Tr', 16: 'SW Kats', 11: 'GW-L2-Wasser', 143: 'Anh Schlauch', 62: 'AB-Schlauch' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Schlauch-", "Wasser-", "Leitungs-", "Hydranten-", "Pumpen-", "Druck-", "Förder-", "Nudel-", "Spaghetti-", "Makkaroni-", "Endlos-", "Meter-", "Kilometer-", "Verlege-"];
                const adjektive_base = ["Nass", "Lang", "Rollend", "Durstig", "Prall", "Gefüllt", "Undicht", "Gekuppelt", "Verknotet", "Schwer", "Flexibel", "Unendlich", "Blau", "Rot", "Gelb"];
                const namen = [
                    {n: "Pipeline", g:"f"}, {n: "Aquädukt", g:"n"}, {n: "Wasser-Ader", g:"f"}, {n: "Lebens-Ader", g:"f"}, {n: "Nudel-Express", g:"m"}, {n: "Spaghetti-Monster", g:"n"},
                    {n: "Durst-Löscher", g:"m"}, {n: "Hydranten-Freund", g:"m"}, {n: "Feld-Bewässerer", g:"m"}, {n: "Pool-Füller", g:"m"}, {n: "Schlauch-Salat", g:"m"},
                    {n: "Knoten-König", g:"m"}, {n: "Kupplungs-Künstler", g:"m"}, {n: "Verleger-Veteran", g:"m"}, {n: "Aufroller-Ass", g:"n"}, {n: "Meter-Macher", g:"m"},
                    {n: "Kilometer-Kavalier", g:"m"}, {n: "Wasser-Spender", g:"m"}, {n: "Flut-Fighter", g:"m"}, {n: "Anaconda", g:"f"}, {n: "Python", g:"m"}, {n: "Boa", g:"f"},
                    {n: "Nessie", g:"f"}, {n: "Leviathan", g:"m"}, {n: "Wasserschlange", g:"f"}, {n: "Schlauch-Paket", g:"n"}, {n: "Schlauch-Haspel", g:"f"}, {n: "Standrohr", g:"n"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        seenotrettung: {
            name: "Seenotrettung", emoji: "🚢",
            targetVehicleTypes: { 159: 'Seenotrettungskreuzer', 160: 'Seenotrettungsboot' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Küsten-", "Hochsee-", "Sturm-", "Wellen-", "See-", "Meeres-", "Orkan-", "Hafen-", "Tiden-", "Brandungs-", "Salzwasser-", "Gischt-"];
                const adjektive_base = ["Salzig", "Stürmisch", "Unsinkbar", "Verwegen", "Rostig", "Heldenhaft", "Wellenbrechend", "Seetüchtig", "Tapfer", "Standhaft"];
                const namen = [
                    {n: "Seebär", g:"m"}, {n: "Kapitän", g:"m"}, {n: "Pirat", g:"m"}, {n: "Freibeuter", g:"m"}, {n: "Klabautermann", g:"m"}, {n: "Neptun", g:"m"}, {n: "Poseidon", g:"m"},
                    {n: "Hafenmeister", g:"m"}, {n: "Leuchtturmwärter", g:"m"}, {n: "Triton", g:"m"}, {n: "Störtebeker", g:"m"}, {n: "Nautilus", g:"f"}, {n: "Kolumbus", g:"m"},
                    {n: "Kraken", g:"m"}, {n: "Leviathan", g:"m"}, {n: "Moby Dick", g:"m"}, {n: "Fliegender Holländer", g:"m"}, {n: "Sextant", g:"m"}, {n: "Kompass", g:"m"},
                    {n: "Brandung", g:"f"}, {n: "Gischt", g:"f"}, {n: "Tide", g:"f"}, {n: "Welle", g:"f"}, {n: "Düne", g:"f"}, {n: "Boje", g:"f"}, {n: "Fender", g:"m"}, {n: "Poller", g:"m"},
                    {n: "Kiel", g:"m"}, {n: "Sturmflut", g:"f"}, {n: "Orkanböe", g:"f"}, {n: "Kreuzsee", g:"f"}, {n: "Titanic", g:"f"}, {n: "Bismarck", g:"f"}, {n: "Calypso", g:"f"},
                    {n: "Gorck Fock", g:"f"}, {n: "Passat", g:"m"}, {n: "Pamir", g:"f"}, {n: "Rost-Ritter", g:"m"}, {n: "Wellen-Bezwinger", g:"m"}, {n: "Möwen-Schreck", g:"m"},
                    {n: "Fischkutter-Freund", g:"m"}, {n: "Eiserner-Wal", g:"m"}, {n: "Nasser-Held", g:"m"}, {n: "Hafen-Hirte", g:"m"}, {n: "Deich-Defender", g:"m"}, {n: "Albatros", g:"m"}, {n: "Kormoran", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        sonstige: {
            name: "Mädchen für Alles", emoji: "⚙️",
            targetVehicleTypes: { 4: 'RW', 10: 'GW-Öl', 83: 'GW-Werkfeuerwehr', 36: 'MTW', 104: 'GW-L1', 105: 'GW-L2', 106: 'MTF-L', 46: 'WLF', 47: 'AB-Rüst', 49: 'AB-Öl', 117: 'AB-Tank', 119: 'AB-Lösch', 164: 'AB-Schiene', 169: 'AB-Sonderlöschmittel', 170: 'AB-Wasser/Schaum', 108: 'AB-L', 165: 'LauKw' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Universal-", "Logistik-", "Allzweck-", "Sonder-", "Basis-", "Reserve-", "Transport-", "Material-", "Geräte-", "Stab-", "Unterstützungs-", "Service-", "Pionier-", "Joker-"];
                const adjektive_base = ["Zuverlässig", "Stabil", "Beladen", "Praktisch", "Unverzichtbar", "Flexibel", "Robust", "Solid", "Eisern", "Müde", "Fleißig", "Stoisch", "Unauffällig", "Essentiell"];
                const namen = [
                    {n: "Arbeitstier", g:"n"}, {n: "Lastenesel", g:"m"}, {n: "Packpferd", g:"n"}, {n: "Sherpa", g:"m"}, {n: "Kuli", g:"m"}, {n: "Faktotum", g:"n"}, {n: "Gerät", g:"n"},
                    {n: "Platzhalter", g:"m"}, {n: "Eiserne-Reserve", g:"f"}, {n: "Schweizer-Taschenmesser", g:"n"}, {n: "Alleskönner", g:"m"}, {n: "Kümmerer", g:"m"},
                    {n: "Rechte-Hand", g:"f"}, {n: "Hans-Dampf", g:"m"}, {n: "Material-Magier", g:"m"}, {n: "Chaos-Bändiger", g:"m"}, {n: "Problemlöser", g:"m"}, {n: "Backup", g:"n"},
                    {n: "Plan B", g:"m"}, {n: "Ass im Ärmel", g:"n"}, {n: "Stiller-Held", g:"m"}, {n: "Heinzelmännchen", g:"n"}, {n: "Wasserträger", g:"m"}, {n: "Adjutant", g:"m"},
                    {n: "Gehilfe", g:"m"}, {n: "Azubi", g:"m"}, {n: "Praktikant", g:"m"}, {n: "Mädchen-für-Alles", g:"n"}, {n: "Hausmeister", g:"m"}, {n: "Macher", g:"m"}, {n: "Zupacker", g:"m"},
                    {n: "Organisator", g:"m"}, {n: "Stratege", g:"m"}, {n: "Versorger", g:"m"}, {n: "Stütze", g:"f"}, {n: "Rückgrat", g:"n"}, {n: "Fels", g:"m"}, {n: "Anker", g:"m"}, {n: "Joker", g:"m"},
                    {n: "Werkzeugkiste", g:"f"}, {n: "Lagerhalle", g:"f"}, {n: "Werkstatt", g:"f"}, {n: "Brummi", g:"m"}, {n: "Koloss", g:"m"}, {n: "Gigant", g:"m"}, {n: "Titan", g:"m"}, {n: "Moloch", g:"m"},
                    {n: "Dino", g:"m"}, {n: "Elefant", g:"m"}, {n: "Bulle", g:"m"}, {n: "Bär", g:"m"}, {n: "Büffel", g:"m"}, {n: "Eber", g:"m"}, {n: "Brocken", g:"m"}, {n: "Klotz", g:"m"}, {n: "Monolith", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        spezialeinheiten: {
            name: "SEK / MEK", emoji: "💀",
            targetVehicleTypes: { 79: 'SEK - ZF', 80: 'SEK - MTF', 81: 'MEK - ZF', 82: 'MEK - MTF', 72: 'WaWe 10' },
            largeVehicleIds: [72],
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Zugriffs-", "Taktik-", "Schatten-", "Sturm-", "Alpha-", "Omega-", "Nacht-", "Kobra-", "Phantom-", "Kommando-", "Delta-", "Zero-", "Stahl-", "Titan-", "Wolfs-"];
                const adjektive_base = ["Still", "Präzis", "Eisern", "Scharf", "Chirurgisch", "Unerbittlich", "Kompromisslos", "Getarnt", "Gepanzert", "Lautlos", "Skrupellos", "Final", "Letzt"];
                const namen = [
                    {n: "Jäger", g:"m"}, {n: "Greifer", g:"m"}, {n: "Vollstrecker", g:"m"}, {n: "Brecher", g:"m"}, {n: "Phantom", g:"n"}, {n: "Schatten", g:"m"}, {n: "Operator", g:"m"},
                    {n: "Kommando", g:"n"}, {n: "Scharfschütze", g:"m"}, {n: "Geist", g:"m"}, {n: "Henker", g:"m"}, {n: "Wächter", g:"m"}, {n: "Wolf", g:"m"}, {n: "Hyäne", g:"f"},
                    {n: "Schakal", g:"m"}, {n: "Viper", g:"f"}, {n: "Kobra", g:"f"}, {n: "Cerberus", g:"m"}, {n: "Nighthawk", g:"m"}, {n: "Valkyrie", g:"f"}, {n: "Chimäre", g:"f"},
                    {n: "Mantikor", g:"m"}, {n: "Gorgone", g:"f"}, {n: "Hydra", g:"f"}, {n: "Spectre", g:"m"}, {n: "Reaper", g:"m"}, {n: "Nemesis", g:"f"}, {n: "Thanatos", g:"m"},
                    {n: "Ares", g:"m"}, {n: "Charon", g:"m"}, {n: "Zugriff", g:"m"}, {n: "Observation", g:"f"}, {n: "Belagerung", g:"f"}, {n: "Sturm", g:"m"}, {n: "Sicherung", g:"f"},
                    {n: "Eskorte", g:"f"}, {n: "Vergeltung", g:"f"}, {n: "Furcht", g:"f"}, {n: "Böser Onkel", g:"m"}, {n: "Tür-Eintreter", g:"m"}, {n: "Party-Crasher", g:"m"},
                    {n: "Überraschungsgast", g:"m"}, {n: "Spaß-Bremse", g:"f"}, {n: "Adrenalin-Junkie", g:"m"}, {n: "Schwarze-Witwe", g:"f"}, {n: "Höllen-Hund", g:"m"}, {n: "Stahl-Faust", g:"f"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        technik: {
            name: "Strom-Junkies", emoji: "⚡",
            targetVehicleTypes: { 110: 'NEA50', 111: 'NEA50', 112: 'NEA200', 113: 'NEA200', 122: 'LKW 7 Lbw (FGr E)', 171: 'GW TeSi', 172: 'LKW Technik (Notstrom)', 173: 'MTW TeSi', 174: 'Anh TeSi', 175: 'NEA50' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Strom-", "Spannungs-", "Kabel-", "Notstrom-", "Technik-", "Sicherungs-", "Elektronik-", "Werkstatt-", "Licht-", "Phasen-"];
                const adjektive_base = ["Elektrisch", "Spannungsgeladen", "Funktionierend", "Provisorisch", "Zertifiziert", "Verkabelt", "Leuchtend", "Summend", "Brummend", "Funkenschlagend"];
                const namen = [
                    {n: "Nikola Tesla", g:"m"}, {n: "Thomas Edison", g:"m"}, {n: "MacGyver", g:"m"}, {n: "Daniel Düsentrieb", g:"m"}, {n: "Doc Brown", g:"m"}, {n: "Volt", g:"n"}, {n: "Ampere", g:"n"},
                    {n: "Watt", g:"n"}, {n: "Kilowatt", g:"n"}, {n: "Megawatt", g:"n"}, {n: "Widerstand", g:"m"}, {n: "Kondensator", g:"m"}, {n: "Transformator", g:"m"}, {n: "Kurzschluss", g:"m"},
                    {n: "Spannungsspitze", g:"f"}, {n: "Lichtbogen", g:"m"}, {n: "Phase", g:"f"}, {n: "Nullleiter", g:"m"}, {n: "Frequenz", g:"f"}, {n: "Gleichstrom", g:"m"}, {n: "Wechselstrom", g:"m"},
                    {n: "Starkstrom", g:"m"}, {n: "Schraubenschlüssel", g:"m"}, {n: "Lötkolben", g:"m"}, {n: "Multimeter", g:"n"}, {n: "Oszilloskop", g:"n"}, {n: "Werkbank", g:"f"},
                    {n: "Schraubstock", g:"m"}, {n: "Kabeltrommel", g:"f"}, {n: "Kabelbinder", g:"m"}, {n: "Lüsterklemme", g:"f"}, {n: "Phasenprüfer", g:"m"}, {n: "Steckdose", g:"f"},
                    {n: "Schaltplan", g:"m"}, {n: "Generator", g:"m"}, {n: "Aggregat", g:"n"}, {n: "Diesel", g:"m"}, {n: "Admin", g:"m"}, {n: "IT-Support", g:"m"}, {n: "Helpdesk", g:"m"},
                    {n: "Sicherungs-Finder", g:"m"}, {n: "Kabel-Chaos-Kommando", g:"n"}, {n: "Spannungs-Abfall", g:"m"}, {n: "Lötkolben-Cowboy", g:"m"}, {n: "Admin-Mobil", g:"n"},
                    {n: "Strom-Dealer", g:"m"}, {n: "Licht-Macher", g:"m"}, {n: "Phasen-Phantomas", g:"m"}, {n: "Funke Hoffnung", g:"m"}, {n: "Blackout-Buddy", g:"m"}, {n: "Saft-Spender", g:"m"},
                    {n: "Brumm-Bär", g:"m"}, {n: "Trafo-Häuschen", g:"n"}, {n: "Lichtbogen-Larry", g:"m"}, {n: "Multimeter-Magier", g:"m"}, {n: "Werkbank-Wüterich", g:"m"},
                    {n: "Kabeltrommel-König", g:"m"}, {n: "Blackout-Bezwinger", g:"m"}, {n: "Generator-Genie", g:"n"}, {n: "Aggregat-Admiral", g:"m"}, {n: "Diesel-Don", g:"m"},
                    {n: "Server-Sanitäter", g:"m"}, {n: "Firewall-Fighter", g:"m"}, {n: "Router-Rambo", g:"m"}, {n: "Helpdesk-Held", g:"m"}, {n: "Ticket-Terminator", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        thw: {
            name: "Blaue Wichtel", emoji: "🛠️",
            targetVehicleTypes: { 40: 'MTW-TZ', 41: 'MzGW (FGr N)', 42: 'LKW K 9', 43: 'BRmG R', 44: 'Anh DLE', 45: 'MLW 5', 93: 'MTW-O', 100: 'MLW 4', 101: 'Anh SwPu', 102: 'Anh 7', 109: 'MzGW SB', 123: 'LKW 7 Lbw (FGr WP)', 124: 'MTW-OV', 39: 'GKW', 65: 'LKW 7 Lkr 19 tm' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Technik-", "Hilfs-", "Bau-", "Logistik-", "Räum-", "Stütz-", "Pumpen-", "Generator-", "Blau-", "Wichtel-", "Chaos-", "Paletten-", "Kabel-", "Schlumpf-", "Trümmer-", "Beton-", "Holz-", "Stahl-"];
                const adjektive_base = ["Blau", "Technisch", "Hilfsbereit", "Verplant", "Chaotisch", "Stabil", "Schwer", "Tragend", "Leuchtend", "Unermüdlich", "Kreativ", "Solid", "Standfest", "Robust"];
                const namen = [
                    {n: "Wichtel", g:"m"}, {n: "Schlumpf", g:"m"}, {n: "Helfer", g:"m"}, {n: "Pionier", g:"m"}, {n: "Logistiker", g:"m"}, {n: "Ingenieur", g:"m"}, {n: "Baumeister", g:"m"},
                    {n: "Maschinist", g:"m"}, {n: "Anpacker", g:"m"}, {n: "Fachberater", g:"m"}, {n: "Ortsbeauftragter", g:"m"}, {n: "Bastler", g:"m"}, {n: "Tüftler", g:"m"},
                    {n: "Konstrukteur", g:"m"}, {n: "Statiker", g:"m"}, {n: "Truppführer", g:"m"}, {n: "Kraftfahrer", g:"m"}, {n: "Baukasten", g:"m"}, {n: "Stütze", g:"f"}, {n: "Fundament", g:"n"},
                    {n: "Generator", g:"m"}, {n: "Pumpe", g:"f"}, {n: "Hebel", g:"m"}, {n: "Getriebe", g:"n"}, {n: "Werkzeugkiste", g:"f"}, {n: "Palette", g:"f"}, {n: "Gitterbox", g:"f"},
                    {n: "Einsatzbefehl", g:"m"}, {n: "Lichtmast", g:"m"}, {n: "Presslufthammer", g:"m"}, {n: "Trennschleifer", g:"m"}, {n: "Stahlträger", g:"m"}, {n: "Sandsack", g:"m"},
                    {n: "Tauchpumpe", g:"f"}, {n: "Hebekissen", g:"n"}, {n: "Chaos-Kommando", g:"n"}, {n: "Wichtel-Express", g:"m"}, {n: "Paletten-Polo", g:"n"}, {n: "Schlumpf-Transporter", g:"m"},
                    {n: "THW-Taxi", g:"n"}, {n: "Blauer Engel", g:"m"}, {n: "Blauer Riese", g:"m"}, {n: "Macher", g:"m"}, {n: "Kümmerer", g:"m"}, {n: "Hoffnung", g:"f"}, {n: "Fels in der Brandung", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        wasserrettung: {
            name: "Wasserrettung", emoji: "🚤",
            targetVehicleTypes: { 63: 'GW-Taucher', 64: 'GW-Wasserrettung', 70: 'MZB', 66: 'Anh MzB', 67: 'Anh SchlB', 68: 'Anh MzAB', 69: 'Tauchkraftwagen', 71: 'AB-MZB' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Fluss-", "See-", "Tauch-", "Wasser-", "Wellen-", "Strömungs-", "Ufer-", "Sonar-", "Tiefen-", "Schlick-", "Neopren-"];
                const adjektive_base = ["Nass", "Tief", "Blubbernd", "Kalt", "Schnell", "Leckgeschlagen", "Schwimmend", "Tauchend", "Feucht", "Klamm", "Glitschig"];
                const namen = [
                    {n: "Froschmann", g:"m"}, {n: "Kapitän", g:"m"}, {n: "Pirat", g:"m"}, {n: "Matrose", g:"m"}, {n: "Taucher", g:"m"}, {n: "Retter", g:"m"}, {n: "Wasserratte", g:"f"},
                    {n: "Fluss-Sheriff", g:"m"}, {n: "Bademeister", g:"m"}, {n: "Otter", g:"m"}, {n: "Biber", g:"m"}, {n: "Hecht", g:"m"}, {n: "Zander", g:"m"}, {n: "Wassermann", g:"m"},
                    {n: "Nixe", g:"f"}, {n: "Wels", g:"m"}, {n: "Kormoran", g:"m"}, {n: "Anker", g:"m"}, {n: "Schraube", g:"f"}, {n: "Sonar", g:"n"}, {n: "Rettungsring", g:"m"},
                    {n: "Schlauchboot", g:"n"}, {n: "Tauchglocke", g:"f"}, {n: "Periskop", g:"n"}, {n: "Tiefenmesser", g:"m"}, {n: "Schleuse", g:"f"}, {n: "Kielwasser", g:"n"},
                    {n: "Strömung", g:"f"}, {n: "Neoprenanzug", g:"m"}, {n: "Druckluftflasche", g:"f"}, {n: "Tauchcomputer", g:"m"}, {n: "Trockenanzug", g:"m"}, {n: "Hebesack", g:"m"},
                    {n: "Sprungschicht", g:"f"}, {n: "Dekompression", g:"f"}, {n: "Rhein", g:"m"}, {n: "Donau", g:"f"}, {n: "Elbe", g:"f"}, {n: "Bodensee", g:"m"},
                    {n: "Quietsche-Ente", g:"f"}, {n: "Bade-Ente", g:"f"}, {n: "Gummiboot", g:"n"}, {n: "Seepferdchen", g:"n"}, {n: "Feuchter-Traum", g:"m"},
                    {n: "Planschbecken-Patrouille", g:"f"}, {n: "Unterwasser-Staubsauger", g:"m"}, {n: "Schlick-Schlitten", g:"m"}, {n: "Blubber-Blitz", g:"m"}, {n: "Abtaucher", g:"m"},
                    {n: "Nasser-Willy", g:"m"}, {n: "Amphibien-Ambulanz", g:"f"}, {n: "Wellen-Reiter", g:"m"}, {n: "Fisch-Schreck", g:"m"}, {n: "Algen-Mäher", g:"m"},
                    {n: "Schilf-Schneider", g:"m"}, {n: "Ente-Nass", g:"f"}, {n: "Badewannen-Admiral", g:"m"}, {n: "Schlamm-Wühler", g:"m"}, {n: "Anker-Auswerfer", g:"m"},
                    {n: "Forelle", g:"f"}, {n: "Karpfen", g:"m"}, {n: "Aal", g:"m"}, {n: "Barsch", g:"m"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        },
        windmaschinen: {
            name: "Sturm-Macher", emoji: "💨",
            targetVehicleTypes: { 114: 'GW-Lüfter', 115: 'Anh Lüfter', 116: 'AB-Lüfter' },
            nameGenerator: function(isLarge = false) {
                const praefixe = ["Wind-", "Sturm-", "Luft-", "Orkan-", "Puste-", "Gebläse-", "Rauch-", "Druck-", "Wirbel-", "Tornado-", "Hurrikan-", "Taifun-", "Zyklon-", "Ventilator-", "Turbinen-"];
                const adjektive_base = ["Windig", "Stürmisch", "Laut", "Dröhnend", "Kräftig", "Rotierend", "Brüllend", "Frisch", "Eisig", "Heiß", "Trocken", "Feucht", "Stark", "Gewaltig", "Donnernd"];
                const namen = [
                    {n: "Äolus", g:"m"}, {n: "Boreas", g:"m"}, {n: "Zephyrus", g:"m"}, {n: "Eurus", g:"m"}, {n: "Notus", g:"m"}, {n: "Tornado", g:"m"}, {n: "Hurrikan", g:"m"},
                    {n: "Taifun", g:"m"}, {n: "Zyklon", g:"m"}, {n: "Orkan", g:"m"}, {n: "Sturm", g:"m"}, {n: "Böe", g:"f"}, {n: "Brise", g:"f"}, {n: "Passat", g:"m"}, {n: "Monsun", g:"m"},
                    {n: "Föhn", g:"m"}, {n: "Scirocco", g:"m"}, {n: "Mistral", g:"m"}, {n: "Pustefix", g:"m"}, {n: "Trocken-Föhn", g:"m"}, {n: "Propeller", g:"m"}, {n: "Turbine", g:"f"},
                    {n: "Ventilator", g:"m"}, {n: "Gebläse", g:"n"}, {n: "Kompressor", g:"m"}, {n: "Verdichter", g:"m"}, {n: "Düse", g:"f"}, {n: "Strahltriebwerk", g:"n"}, {n: "Rotor", g:"m"},
                    {n: "Impeller", g:"m"}, {n: "Luftschraube", g:"f"}, {n: "Windrad", g:"n"}, {n: "Windmühle", g:"f"}, {n: "Blasebalg", g:"m"}, {n: "Böser-Wolf", g:"m"},
                    {n: "Frisuren-Zerstörer", g:"m"}, {n: "Hut-Dieb", g:"m"}, {n: "Rauch-Vertreiber", g:"m"}, {n: "Wind-Gott", g:"m"}, {n: "Sturm-Dämon", g:"m"}, {n: "Luft-Elementar", g:"n"}
                ];
                const patterns = [
                    () => namen.random().n,
                    () => {
                        const adj = adjektive_base.random();
                        let nounObj;
                        do {
                            nounObj = namen.random();
                        } while (nounObj.n.includes(' '));
                        return `${declineAdjective(adj, nounObj.g)} ${nounObj.n}`;
                    },
                    () => {
                        const nounObj = namen.random();
                        if (nounObj.n.includes(' ')) return nounObj.n;
                        return `${praefixe.random()}${nounObj.n}`;
                    }
                ];
                return patterns.random()();
            }
        }
    };


    // ========================================================================
    // 3. KERNFUNKTIONEN
    // ========================================================================
    let vehicleTypeToModuleMap = {};
    let isProcessRunning = false;

    function formatTime(seconds) { if (isNaN(seconds) || seconds < 0) return "--:--"; seconds = Math.floor(seconds); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const remainingSeconds = seconds % 60; if (hours > 0) { return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`; } else { return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`; } }

    async function showBlockControlPanel() {
        showModal({ title: 'Namensgenerator Kontrollzentrum', body: 'Lade Fahrzeug- und Gebäudedaten...' });
        try {
            const [vehicleResponse, buildingResponse] = await Promise.all([gmFetch('/api/vehicles'), gmFetch('/api/buildings')]);
            if (!vehicleResponse.ok || !buildingResponse.ok) throw new Error('API-Fehler!');
            const allVehicles = await vehicleResponse.text().then(JSON.parse);
            const allBuildings = await buildingResponse.text().then(JSON.parse);
            const buildingCache = Object.fromEntries(allBuildings.map(b => [b.id, b.caption]));

            vehicleTypeToModuleMap = {};
            for (const moduleKey in MODULE_CONFIG) {
                for (const typeId in MODULE_CONFIG[moduleKey].targetVehicleTypes) {
                    vehicleTypeToModuleMap[typeId] = moduleKey;
                }
            }

            const bodyElement = document.createElement('div');
            const selectAllLine = document.createElement('div');
            selectAllLine.className = 'ng-select-all-line';
            selectAllLine.innerHTML = `<label for="check_all"><input type="checkbox" id="check_all"><strong>Alle Blöcke auswählen / abwählen</strong></label>`;
            bodyElement.appendChild(selectAllLine);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'ng-button-grid';
            const sortedModuleKeys = Object.keys(MODULE_CONFIG).sort((a, b) => MODULE_CONFIG[a].name.localeCompare(MODULE_CONFIG[b].name));

            for (const moduleKey of sortedModuleKeys) {
                const config = MODULE_CONFIG[moduleKey];
                const allTypeIdsInModule = Object.keys(config.targetVehicleTypes);
                const vehiclesInModule = allVehicles.filter(v => allTypeIdsInModule.some(id => id == v.vehicle_type));
                const count = vehiclesInModule.length;
                if (count === 0) continue;
                const needed = vehiclesInModule.filter(v => !v.caption.endsWith(MARKER)).length;
                const button = document.createElement('button');
                button.className = 'ng-module-btn';
                button.dataset.modulekey = moduleKey;
                button.innerHTML = `<div class="ng-btn-content">${config.emoji} ${config.name}</div><span class="count">(Gesamt: ${count} / Nötig: ${needed})</span>`;
                button.addEventListener('click', () => button.classList.toggle('selected'));
                buttonGrid.appendChild(button);
            }
            bodyElement.appendChild(buttonGrid);
            bodyElement.querySelector('#check_all').addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                bodyElement.querySelectorAll('.ng-module-btn').forEach(btn => isChecked ? btn.classList.add('selected') : btn.classList.remove('selected'));
            });

            const actions = [{
                label: 'Loslegen (Nötige umbenennen)',
                className: 'btn-start',
                callback: () => {
                    const selectedModules = Array.from(bodyElement.querySelectorAll('.ng-module-btn.selected')).map(btn => btn.dataset.modulekey);
                    if (selectedModules.length === 0) { alert("Bitte wähle mindestens einen Block aus."); return; }
                    let allSelectedTypeIds = selectedModules.flatMap(key => Object.keys(MODULE_CONFIG[key].targetVehicleTypes));
                    const vehiclesToProcess = allVehicles.filter(v => allSelectedTypeIds.includes(String(v.vehicle_type)) && !v.caption.endsWith(MARKER));
                    if (vehiclesToProcess.length > 0) startRenamingProcess(vehiclesToProcess, buildingCache);
                    else alert("Keine Fahrzeuge für diese Auswahl zur Umbenennung nötig.");
                }
            }, {
                label: 'Alles überschreiben (erzwingen)',
                className: 'btn-warning',
                callback: () => {
                    const selectedModules = Array.from(bodyElement.querySelectorAll('.ng-module-btn.selected')).map(btn => btn.dataset.modulekey);
                    if (selectedModules.length === 0) { alert("Bitte wähle mindestens einen Block aus."); return; }
                    let allSelectedTypeIds = selectedModules.flatMap(key => Object.keys(MODULE_CONFIG[key].targetVehicleTypes));
                    const vehiclesToProcess = allVehicles.filter(v => allSelectedTypeIds.includes(String(v.vehicle_type)));
                    if (vehiclesToProcess.length > 0 && confirm(`ACHTUNG!\n\nMöchtest du wirklich ALLE ${vehiclesToProcess.length} Fahrzeuge der ausgewählten Blöcke neu benennen?`)) {
                        startRenamingProcess(vehiclesToProcess, buildingCache);
                    }
                }
            }, {
                label: 'Schließen',
                className: 'btn-close',
                callback: () => document.body.removeChild(document.getElementById('ng-modal-overlay'))
            }];
            showModal({ title: 'Namensgenerator Kontrollzentrum', bodyElement: bodyElement, actions: actions });
        } catch (error) {
            showModal({ title: 'Fehler', body: `Ein Fehler ist aufgetreten:\n${error.message}` });
        }
    }

    async function startRenamingProcess(vehicles, buildingCache) {
        if (isProcessRunning) return;
        isProcessRunning = true;

        showModal({
            title: `Benennung läuft...`,
            progressGrid: true,
            actions: [{
                label: 'Abbrechen',
                className: 'btn-close',
                callback: () => {
                    isProcessRunning = false;
                    document.body.removeChild(document.getElementById('ng-modal-overlay'));
                }
            }]
        });

        const statusText = document.getElementById('ng-progress-status');
        const gridContainer = document.getElementById('ng-worker-grid');
        const startTime = Date.now();
        const performanceLog = [];

        try {
            const firstVehicleId = vehicles[0]?.id;
            if (!firstVehicleId) throw new Error("Konnte keine Fahrzeug-ID finden, um den Token abzurufen.");

            const authToken = await gmFetch(`/vehicles/${firstVehicleId}/edit`).then(r => r.text()).then(html => new DOMParser().parseFromString(html, "text/html").querySelector('meta[name="csrf-token"]').getAttribute('content'));

            const usedNames = new Set();
            const jobList = vehicles.map(v => {
                const moduleKey = vehicleTypeToModuleMap[v.vehicle_type];
                if (!moduleKey) return null;
                const config = MODULE_CONFIG[moduleKey];
                let spitzname;
                let attempts = 0;
                do {
                    spitzname = config.nameGenerator(config.largeVehicleIds && config.largeVehicleIds.includes(v.vehicle_type));
                    attempts++;
                } while (usedNames.has(spitzname) && attempts < 50);
                usedNames.add(spitzname);
                const stationName = buildingCache[v.building_id] || "Unbekannte Wache";
                const vehicleType = config.targetVehicleTypes[v.vehicle_type];
                const newCaption = `${vehicleType} ${spitzname} [${stationName}]${MARKER}`;
                return { id: v.id, newCaption: newCaption, oldCaption: v.caption };
            }).filter(Boolean);

            jobList.forEach(job => {
                const cell = document.createElement('div');
                cell.id = `vehicle-cell-${job.id}`;
                cell.className = 'ng-vehicle-cell status-pending';
                cell.title = `Wartet: "${job.oldCaption}" -> "${job.newCaption.slice(0, -1)}"`;
                cell.textContent = job.id;
                gridContainer.appendChild(cell);
            });

            const jobQueue = [...jobList];
            let processedCount = 0;
            let successCount = 0;
            let errorCount = 0;
            const totalJobs = jobList.length;

            const updateStatus = () => {
                const timeElapsed = (Date.now() - startTime) / 1000;
                performanceLog.push({ time: Date.now(), count: processedCount });
                if (performanceLog.length > 20) {
                    performanceLog.shift();
                }

                let etaString = '--:--';
                if (performanceLog.length > 5 && processedCount > 0 && processedCount < totalJobs) {
                    const first = performanceLog[0];
                    const last = performanceLog[performanceLog.length - 1];
                    const processedInWindow = last.count - first.count;
                    const timeInWindow = (last.time - first.time) / 1000;

                    if (timeInWindow > 0.5) {
                        const itemsPerSecond = processedInWindow / timeInWindow;
                        const remainingItems = totalJobs - processedCount;
                        if (itemsPerSecond > 0) {
                            const remainingTimeInSeconds = remainingItems / itemsPerSecond;
                            etaString = formatTime(remainingTimeInSeconds);
                        }
                    }
                }

                if (processedCount === totalJobs) {
                    statusText.textContent = `Bearbeitet: ${processedCount}/${totalJobs} | FERTIG! | Zeit: ${formatTime(timeElapsed)}`;
                    isProcessRunning = false;
                } else {
                    statusText.textContent = `Bearbeitet: ${processedCount}/${totalJobs} | ETA: ${etaString} | Zeit: ${formatTime(timeElapsed)}`;
                }
            };
            updateStatus();

            const worker = async () => {
                while (jobQueue.length > 0 && isProcessRunning) {
                    const job = jobQueue.shift();
                    if (!job) continue;

                    const cell = document.getElementById(`vehicle-cell-${job.id}`);
                    cell.className = 'ng-vehicle-cell status-working';
                    cell.title = `In Arbeit: "${job.oldCaption}" -> "${job.newCaption.slice(0, -1)}"`;

                    try {
                        const formData = new URLSearchParams();
                        formData.append('utf8', '✓');
                        formData.append('_method', 'patch');
                        formData.append('authenticity_token', authToken);
                        formData.append('vehicle[caption]', job.newCaption);

                        const response = await gmFetch(`/vehicles/${job.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: formData.toString()
                        });

                        if (response.ok) {
                            successCount++;
                            cell.className = 'ng-vehicle-cell status-done';
                            cell.title = `Erfolgreich: "${job.oldCaption}" -> "${job.newCaption.slice(0, -1)}"`;
                        } else {
                            throw new Error(`Status ${response.status}`);
                        }
                    } catch (error) {
                        errorCount++;
                        cell.className = 'ng-vehicle-cell status-error';
                        cell.title = `Fehler bei "${job.oldCaption}": ${error.message}`;
                    } finally {
                        processedCount++;
                        updateStatus();
                    }
                }
            };

            const workers = Array(MAX_WORKERS).fill(null).map(() => worker());
            await Promise.all(workers);

        } catch (error) {
            statusText.textContent = `Ein schwerwiegender Fehler ist aufgetreten: ${error.message}`;
            isProcessRunning = false;
        }
    }


    function showModal(config) {
        const oldOverlay = document.getElementById('ng-modal-overlay');
        if (oldOverlay) document.body.removeChild(oldOverlay);
        const overlay = document.createElement('div');
        overlay.id = 'ng-modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.id = 'ng-modal-content';
        modalContent.innerHTML = `<h3>${config.title}</h3>`;
        const modalBody = document.createElement('div');
        modalBody.id = 'ng-modal-body';
        if (config.bodyElement) {
            modalBody.appendChild(config.bodyElement)
        } else if (config.body) {
            modalBody.innerHTML = config.body
        }
        modalContent.appendChild(modalBody);
        if (config.progressGrid) {
            const progressArea = document.createElement('div');
            progressArea.innerHTML = `<div id="ng-progress-status">Initialisiere...</div><div id="ng-worker-grid"></div>`;
            modalContent.appendChild(progressArea)
        }
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'ng-modal-buttons';
        if (config.actions) {
            config.actions.forEach(action => {
                const button = document.createElement('button');
                button.className = `ng-modal-btn ${action.className||''}`;
                button.textContent = action.label;
                button.addEventListener('click', action.callback);
                buttonContainer.appendChild(button)
            })
        }
        modalContent.appendChild(buttonContainer);
        overlay.appendChild(modalContent);
        document.body.appendChild(overlay);
        return { overlay, modalContent }
    }

    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: `https://www.leitstellenspiel.de${url}`,
                headers: options.headers || {},
                data: options.body,
                timeout: 15000,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 400) {
                        response.ok = true;
                        response.text = () => Promise.resolve(response.responseText);
                        resolve(response);
                    } else {
                        reject(new Error(`Server-Fehler: Status ${response.status}`));
                    }
                },
                onerror: (error) => reject(new Error('Netzwerk- oder Skript-Konflikt-Fehler.')),
                ontimeout: () => reject(new Error('Zeitüberschreitung der Anfrage.'))
            });
        });
    }

    const addGeneratorButton = () => {
        const settingsLink = document.querySelector('a.lightbox-open[href="/settings/index"]');
        if (!settingsLink) return;
        const settingsListItem = settingsLink.closest('li');
        if (!settingsListItem) return;
        const mainMenu = settingsListItem.parentElement;
        if (!mainMenu || document.getElementById('main-naming-button')) {
            if (mainMenu) { observer.disconnect(); }
            return;
        }
        const newListItem = document.createElement('li');
        newListItem.setAttribute('role', 'presentation');
        const mainButton = document.createElement('a');
        mainButton.href = "#";
        mainButton.id = 'main-naming-button';
        mainButton.innerHTML = `<span style="font-size: 20px; vertical-align: -3px; margin-right: 5px; display: inline-block;">🏷️</span> Fahrzeug-Namen-Generator`;
        mainButton.style.cursor = "pointer";
        mainButton.addEventListener('click', (e) => {
            e.preventDefault();
            showBlockControlPanel();
        });
        settingsListItem.insertAdjacentElement('afterend', newListItem);
        newListItem.appendChild(mainButton);
        observer.disconnect();
    };

    const observer = new MutationObserver(addGeneratorButton);
    observer.observe(document.body, { childList: true, subtree: true });
    addGeneratorButton();

})();
