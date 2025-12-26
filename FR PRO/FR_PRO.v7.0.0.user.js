// ==UserScript==
// @name         First Responder PRO
// @namespace    http://tampermonkey.net/
// @version      7.0.0
// @description  High-Performance Auto-Auswahl mit perfektioniertem Deep-Blue Design.
// @author       B&M
// @match        https://www.leitstellenspiel.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- KONFIGURATION & DATEN ---
    const SETTINGS_KEY = 'lss_fr_ultimate_v7';
    const VEHICLES = [
        {id:0,name:"LF 20"},{id:1,name:"LF 10"},{id:2,name:"DLK 23"},{id:3,name:"ELW 1"},{id:4,name:"RW"},{id:5,name:"GW-A"},{id:6,name:"LF 8/6"},{id:7,name:"LF 20/16"},{id:8,name:"LF 10/6"},{id:9,name:"LF 16-TS"},{id:10,name:"GW-Öl"},{id:11,name:"GW-L2-Wasser"},{id:12,name:"GW-Messtechnik"},{id:13,name:"SW 1000"},{id:14,name:"SW 2000"},{id:15,name:"SW 2000-Tr"},{id:16,name:"SW Kats"},{id:17,name:"TLF 2000"},{id:18,name:"TLF 3000"},{id:19,name:"TLF 8/8"},{id:20,name:"TLF 8/18"},{id:21,name:"TLF 16/24-Tr"},{id:22,name:"TLF 16/25"},{id:23,name:"TLF 16/45"},{id:24,name:"TLF 20/40"},{id:25,name:"TLF 20/40-SL"},{id:26,name:"TLF 16"},{id:27,name:"GW-Gefahrgut"},{id:28,name:"RTW"},{id:29,name:"NEF"},{id:30,name:"HLF 20"},{id:31,name:"RTH"},{id:32,name:"FuStW"},{id:33,name:"GW-Höhenrettung"},{id:34,name:"ELW 2"},{id:35,name:"leBefKw"},{id:36,name:"MTW"},{id:37,name:"TSF-W"},{id:38,name:"KTW"},{id:39,name:"GKW"},{id:40,name:"MTW-TZ"},{id:41,name:"MzGW (FGr N)"},{id:42,name:"LKW K 9"},{id:43,name:"BRmG R"},{id:44,name:"Anh DLE"},{id:45,name:"MLW 5"},{id:46,name:"WLF"},{id:47,name:"AB-Rüst"},{id:48,name:"AB-Atemschutz"},{id:49,name:"AB-Öl"},{id:50,name:"GruKw"},{id:51,name:"FüKW (Polizei)"},{id:52,name:"GefKw"},{id:53,name:"Dekon-P"},{id:54,name:"AB-Dekon-P"},{id:55,name:"KdoW-LNA"},{id:56,name:"KdoW-OrgL"},{id:57,name:"FwK"},{id:58,name:"KTW Typ B"},{id:59,name:"ELW 1 (SEG)"},{id:60,name:"GW-San"},{id:61,name:"Polizeihubschrauber"},{id:62,name:"AB-Schlauch"},{id:63,name:"GW-Taucher"},{id:64,name:"GW-Wasserrettung"},{id:65,name:"LKW 7 Lkr 19 tm"},{id:66,name:"Anh MzB"},{id:67,name:"Anh SchlB"},{id:68,name:"Anh MzAB"},{id:69,name:"Tauchkraftwagen"},{id:70,name:"MZB"},{id:71,name:"AB-MZB"},{id:72,name:"WaWe 10"},{id:73,name:"GRTW"},{id:74,name:"NAW"},{id:75,name:"FLF"},{id:76,name:"Rettungstreppe"},{id:77,name:"AB-Gefahrgut"},{id:78,name:"AB-Einsatzleitung"},{id:79,name:"SEK - ZF"},{id:80,name:"SEK - MTF"},{id:81,name:"MEK - ZF"},{id:82,name:"MEK - MTF"},{id:83,name:"GW-Werkfeuerwehr"},{id:84,name:"ULF mit Löscharm"},{id:85,name:"TM 50"},{id:86,name:"Turbolöscher"},{id:87,name:"TLF 4000"},{id:88,name:"KLF"},{id:89,name:"MLF"},{id:90,name:"HLF 10"},{id:91,name:"Rettungshundefahrzeug"},{id:92,name:"Anh Hund"},{id:93,name:"MTW-O"},{id:94,name:"DHuFüKW"},{id:95,name:"Polizeimotorrad"},{id:96,name:"Außenlastbehälter (allgemein)"},{id:97,name:"ITW"},{id:98,name:"Zivilstreifenwagen"},{id:100,name:"MLW 4"},{id:101,name:"Anh SwPu"},{id:102,name:"Anh 7"},{id:103,name:"FuStW (DGL)"},{id:104,name:"GW-L1"},{id:105,name:"GW-L2"},{id:106,name:"MTF-L"},{id:107,name:"LF-L"},{id:108,name:"AB-L"},{id:109,name:"MzGW SB"},{id:110,name:"NEA50"},{id:111,name:"NEA50"},{id:112,name:"NEA200"},{id:113,name:"NEA200"},{id:114,name:"GW-Lüfter"},{id:115,name:"Anh Lüfter"},{id:116,name:"AB-Lüfter"},{id:117,name:"AB-Tank"},{id:118,name:"Kleintankwagen"},{id:119,name:"AB-Lösch"},{id:120,name:"Tankwagen"},{id:121,name:"GTLF"},{id:122,name:"LKW 7 Lbw (FGr E)"},{id:123,name:"LKW 7 Lbw (FGr WP)"},{id:124,name:"MTW-OV"},{id:125,name:"MTW-Tr UL"},{id:126,name:"MTF Drohne"},{id:127,name:"GW UAS"},{id:128,name:"ELW Drohne"},{id:129,name:"ELW2 Drohne"},{id:130,name:"GW-Bt"},{id:131,name:"Bt-Kombi"},{id:132,name:"FKH"},{id:133,name:"Bt LKW"},{id:134,name:"Pferdetransporter klein"},{id:135,name:"Pferdetransporter groß"},{id:136,name:"Anh Pferdetransport"},{id:137,name:"Zugfahrzeug Pferdetransport"},{id:138,name:"GW-Verpflegung"},{id:139,name:"GW-Küche"},{id:140,name:"MTW-Verpflegung"},{id:141,name:"FKH"},{id:142,name:"AB-Küche"},{id:143,name:"Anh Schlauch"},{id:144,name:"FüKW (THW)"},{id:145,name:"FüKomKW"},{id:146,name:"Anh FüLa"},{id:147,name:"FmKW"},{id:148,name:"MTW-FGr K"},{id:149,name:"GW-Bergrettung (NEF)"},{id:150,name:"GW-Bergrettung"},{id:151,name:"ELW Bergrettung"},{id:152,name:"ATV"},{id:153,name:"Hundestaffel (Bergrettung)"},{id:154,name:"Schneefahrzeug"},{id:155,name:"Anh Höhenrettung (Bergrettung)"},{id:156,name:"Polizeihubschrauber mit verbauter Winde"},{id:157,name:"RTH Winde"},{id:158,name:"GW-Höhenrettung (Bergrettung)"},{id:159,name:"Seenotrettungskreuzer"},{id:160,name:"Seenotrettungsboot"},{id:161,name:"Hubschrauber (Seenotrettung)"},{id:162,name:"RW-Schiene"},{id:163,name:"HLF Schiene"},{id:164,name:"AB-Schiene"},{id:165,name:"LauKw"},{id:166,name:"PTLF 4000"},{id:167,name:"SLF"},{id:168,name:"Anh Sonderlöschmittel"},{id:169,name:"AB-Sonderlöschmittel"},{id:170,name:"AB-Wasser/Schaum"},{id:171,name:"GW TeSi"},{id:172,name:"LKW Technik (Notstrom)"},{id:173,name:"MTW TeSi"},{id:174,name:"Anh TeSi"},{id:175,name:"NEA50"}
    ];

    let state = {
        enabled: true,
        selected: [30, 32]
    };

    // --- CORE FUNKTIONEN ---
    const load = () => {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) state = JSON.parse(saved);
    };

    const save = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));

    const notify = (msg, type = 'success') => {
        const n = document.createElement('div');
        n.className = `fr-ultimate-notif ${type}`;
        n.innerHTML = msg;
        document.body.appendChild(n);
        setTimeout(() => { n.style.opacity = '1'; n.style.transform = 'translateX(0)'; }, 10);
        setTimeout(() => {
            n.style.opacity = '0';
            n.style.transform = 'translateX(50px)';
            setTimeout(() => n.remove(), 400);
        }, 3000);
    };

    const select = () => {
    if (!state.enabled) return;
    const table = document.getElementById('vehicle_show_table_all');
    if (!table) return;

    const selectedSet = new Set(state.selected);
    // Wir suchen direkt nach nicht-ausgewählten Checkboxen
    const checkboxes = table.querySelectorAll('input.vehicle_checkbox:not([checked])');

    for (const cb of checkboxes) {
        const typeId = parseInt(cb.getAttribute('vehicle_type_id'));
        if (selectedSet.has(typeId)) {
            const row = cb.closest('tr');
            // Blitz-Check: Nur wenn Fahrzeug einsatzbereit (nicht Klasse .danger)
            if (row && !row.classList.contains('danger')) {
                cb.click();
                notify(`⚡ <strong>${row.getAttribute('vehicle_type')}</strong> gewählt.`, 'success');
                return;
            }
        }
    }
    notify(`⚠️ Kein FR verfügbar!`, 'error');
};

    // --- UI ENGINE ---
    const injectStyles = () => {
        const s = document.createElement('style');
        s.textContent = `
            :root {
                --fr-bg: linear-gradient(135deg, #000428 0%, #004e92 100%);
                --fr-accent: #00d2ff;
                --fr-glass: rgba(0, 4, 40, 0.95);
                --fr-text: #ffffff;
            }

            .lss-fr-ultimate-pill {
                display: inline-flex; align-items: center; gap: 10px;
                background: var(--fr-bg); padding: 5px 15px; border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.2); height: 32px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-right: 10px;
                transition: transform 0.2s;
            }
            .lss-fr-ultimate-pill:hover { transform: scale(1.02); }

            .fr-text-bold { color: var(--fr-text); font-weight: 900; font-size: 11px; letter-spacing: 1px; }

            .fr-toggle-wrap { position: relative; width: 34px; height: 18px; cursor: pointer; }
            .fr-toggle-wrap input { display: none; }
            .fr-slider { position: absolute; top:0; left:0; right:0; bottom:0; background: #333; border-radius: 20px; transition: .3s; }
            .fr-slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: .3s; }
            input:checked + .fr-slider { background: var(--fr-accent); }
            input:checked + .fr-slider:before { transform: translateX(16px); }

            .fr-gear { color: var(--fr-text); cursor: pointer; opacity: 0.8; font-size: 14px; transition: 0.3s; }
            .fr-gear:hover { opacity: 1; transform: rotate(45deg); color: var(--fr-accent); }

            /* MODAL - DEEP BLUE MODE */
            #fr-overlay { position: fixed; inset:0; background: rgba(0,0,0,0.85); z-index: 50000; display: none; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
            .fr-modal { background: #0a1118; width: 480px; border-radius: 16px; border: 1px solid #1a2a3a; box-shadow: 0 25px 80px rgba(0,0,0,1); overflow: hidden; }
            .fr-header { background: var(--fr-bg); padding: 20px; color: #fff; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .fr-body { padding: 20px; }
            .fr-search { width: 100%; padding: 12px 15px; background: #141e26; border: 1px solid #2a3a4a; border-radius: 10px; color: #fff; outline: none; margin-bottom: 15px; }
            .fr-list { max-height: 400px; overflow-y: auto; border: 1px solid #1a2a3a; border-radius: 10px; background: #0d161f; }
            .fr-item { display: flex; align-items: center; padding: 12px 15px; gap: 12px; border-bottom: 1px solid #1a2a3a; color: #fff !important; cursor: pointer; font-size: 13px; }
            .fr-item:hover { background: #1a2a3a; }
            .fr-item span { color: #fff !important; }
            .fr-footer { padding: 15px 20px; background: #0a1118; text-align: right; border-top: 1px solid #1a2a3a; }
            .fr-save { background: var(--fr-bg); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px 30px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
            .fr-save:hover { filter: brightness(1.2); box-shadow: 0 0 15px var(--fr-accent); }

            /* NOTIFICATION */
            .fr-ultimate-notif { position: fixed; top: 100px; right: 20px; z-index: 60000; padding: 15px 25px; border-radius: 10px; color: #fff; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-left: 5px solid #fff; opacity: 0; transform: translateX(50px); transition: 0.4s; pointer-events: none; }
            .fr-ultimate-notif.success { background: linear-gradient(to right, #004e92, #000428); }
            .fr-ultimate-notif.error { background: linear-gradient(to right, #cb2d3e, #ef473a); }
        `;
        document.head.appendChild(s);
    };

    const createModal = () => {
        const overlay = document.createElement('div');
        overlay.id = 'fr-overlay';
        overlay.innerHTML = `
            <div class="fr-modal">
                <div class="fr-header"><strong>FIRST RESPONDER (PRO) KONFIGURATION</strong><span style="cursor:pointer;font-size:20px" onclick="this.closest('#fr-overlay').style.display='none'">&times;</span></div>
                <div class="fr-body">
                    <input type="text" class="fr-search" placeholder="Fahrzeugtyp suchen...">
                    <div class="fr-list"></div>
                </div>
                <div class="fr-footer"><button class="fr-save">ÄNDERUNGEN SPEICHERN</button></div>
            </div>
        `;

        const list = overlay.querySelector('.fr-list');
        VEHICLES.sort((a,b) => a.name.localeCompare(b.name)).forEach(v => {
            const div = document.createElement('label');
            div.className = 'fr-item';
            div.innerHTML = `<input type="checkbox" value="${v.id}" ${state.selected.includes(v.id) ? 'checked' : ''}> <span>${v.name}</span>`;
            list.appendChild(div);
        });

        overlay.querySelector('.fr-search').oninput = (e) => {
            const term = e.target.value.toLowerCase();
            overlay.querySelectorAll('.fr-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(term) ? 'flex' : 'none');
        };

        overlay.querySelector('.fr-save').onclick = () => {
            state.selected = Array.from(overlay.querySelectorAll('.fr-list input:checked')).map(c => parseInt(c.value));
            save();
            overlay.style.display = 'none';
            notify('✅ Konfiguration erfolgreich gespeichert!');
        };

        document.body.appendChild(overlay);
    };

    const createWidget = () => {
        const target = document.getElementById('navbar-right-help-button');
        if (!target) return;

        const pill = document.createElement('div');
        pill.className = 'lss-fr-ultimate-pill';
        pill.innerHTML = `
            <label class="fr-toggle-wrap">
                <input type="checkbox" ${state.enabled ? 'checked' : ''} id="fr-master-toggle">
                <span class="fr-slider"></span>
            </label>
            <span class="fr-text-bold">FR - PRO</span>
            <div class="fr-gear"><span class="glyphicon glyphicon-cog"></span></div>
        `;

        pill.querySelector('#fr-master-toggle').onchange = (e) => {
            state.enabled = e.target.checked;
            save();
            notify(state.enabled ? '🔵 System Online' : '⚪ System Standby');
        };

        pill.querySelector('.fr-gear').onclick = () => document.getElementById('fr-overlay').style.display = 'flex';
        target.prepend(pill);
    };

    // --- INIT ---
    const init = () => {
    load();
    injectStyles();
    createModal();

    // Aggressives Einschleichen via Observer (reagiert in Millisekunden)
    const fastInject = () => {
        const target = document.getElementById('navbar-right-help-button');
        if (target && !document.querySelector('.lss-fr-ultimate-pill')) {
            createWidget();
            return true;
        }
        return false;
    };

    if (!fastInject()) {
        const observer = new MutationObserver(() => {
            if (fastInject()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Sofortige Fahrzeug-Wahl beim Öffnen des Einsatzes
    if (window.location.pathname.startsWith('/missions/')) {
        if (document.querySelector('.mission_header_info .glyphicon-asterisk')) {
            // Minimaler Delay von 5ms, damit die Spiel-Logik nicht blockiert
            setTimeout(select, 5);
        }
    }
};

init();
})();
