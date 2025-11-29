// ==UserScript==
// @name        LSS Master-Ausbilder (V10.1.0 Ultimate)
// @namespace   leitstellenspiel-scripts
// @version     10.1.0
// @description Die echte Fusion: SEG-Fix, Smart-Links UND der "Alles merken"-Button für maximale Faulheit.
// @author      Masklin / BOS-Ernie / Gemini (Fusion)
// @license     MIT
// @match       https://*.leitstellenspiel.de/
// @match       https://*.leitstellenspiel.de/buildings/*
// @match       https://*.leitstellenspiel.de/schoolings/*
// @match       https://*.leitstellenspiel.de/einsaetze/*
// @match       https://*.leitstellenspiel.de/profile/*
// @match       https://*.leitstellenspiel.de/alliance/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(async function () {
    'use strict';

    // =================================================================================
    // 1. KONFIGURATION
    // =================================================================================
    const POOL_STORAGE_KEY = 'LSS_Training_Pool';
    const VEHICLE_CACHE_KEY = "lss_master_vehicle_cache";
    const SCHOOLING_CACHE_KEY = "lss_master_schooling_cache";
    const BUILDING_CACHE_KEY = "lss_master_building_cache";
    
    const BLUEPRINT_DB_NAME = "BosErnie_StationBlueprints";
    const BLUEPRINT_STORE_NAME = "main";
    
    const MODAL_ID_CHECKER = 'lss-master-checker-modal';
    const MODAL_ID_BASKET = 'lss-master-basket-modal';
    const STORAGE_TTL = 24 * 60 * 60 * 1000; 
    const BUILDING_TTL = 5 * 60 * 1000; 

    const vehiclesConfigurationOverride = [
        { id: 134, maxStaff: 4, training: [{ key: "police_horse", number: 4 }] },
        { id: 135, maxStaff: 2, training: [{ key: "police_horse", number: 2 }] },
        { id: 137, maxStaff: 6, training: [{ key: "police_horse", number: 6 }] },
        { id: 29, maxStaff: 1, training: [{ key: "notarzt", number: 1 }] },
        { id: 122, maxStaff: 2, training: [{ key: "thw_energy_supply", number: 2 }] },
        { id: 123, maxStaff: 3, training: [{ key: "water_damage_pump", number: 3 }] },
        { id: 93, maxStaff: 5, training: [{ key: "thw_rescue_dogs", number: 5 }] },
        { id: 53, maxStaff: 6, training: [{ key: "dekon_p", number: 6 }] },
        { id: 81, maxStaff: 3, training: [{ key: "police_mek", number: 3 }] },
        { id: 79, maxStaff: 3, training: [{ key: "police_sek", number: 3 }] },
        { id: 173, maxStaff: 7, training: [{ key: "disaster_response_technology", number: 7 }] },
        { id: 172, maxStaff: 6, training: [{ key: "disaster_response_technology", number: 6 }] },
        { id: 126, maxStaff: 5, training: [{ key: "fire_drone", number: 5 }] },
        { id: 74, maxStaff: 3, training: [{ key: "notarzt", number: 3 }] },
        { id: 51, maxStaff: 2, training: [{ key: "police_fukw", number: 2 }] }
    ];

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // DEFINITION: Globale Update-Funktion
    window.updateLssBasket = function() {
        const li = document.getElementById('lss-master-basket');
        if(!li) return;

        const pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY) || '{}');
        let totalReq = Object.keys(pool).length; 
        
        const badge = totalReq > 0 ? `<span class="badge" style="background:#d9534f; margin-left:5px;">${totalReq}</span>` : '';
        
        li.innerHTML = `
            <a href="#" class="dropdown-toggle" data-toggle="dropdown">
                <span class="glyphicon glyphicon-education" title="Ausbildungs-Manager"></span>
                ${badge}
                <span class="visible-xs-inline">Ausbildung</span>
                <b class="caret"></b>
            </a>
            <ul class="dropdown-menu" id="lss-basket-dd" style="background:#1c1c1c; border:1px solid #444; min-width:350px; padding:0;">
                <li style="padding:10px; color:#aaa; text-align:center;">Lade...</li>
            </ul>
        `;
    };

    // =================================================================================
    // 2. STYLES
    // =================================================================================
    function injectStyles() {
        if(document.getElementById('lss-master-styles')) return;
        const style = document.createElement('style');
        style.id = 'lss-master-styles';
        style.textContent = `
            .lss-mm-modal { display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; overflow:auto; background-color:rgba(0,0,0,0.85); backdrop-filter: blur(3px); }
            .lss-mm-content { background-color: #2d2d2d !important; color: #eee !important; margin: 3% auto; padding: 0; border: 1px solid #555; width: 95%; max-width: 1000px; border-radius: 8px; box-shadow: 0 15px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; max-height: 90vh; }
            .lss-mm-header { background-color: #1e1e1e !important; padding: 15px 25px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0; }
            .lss-mm-body { padding: 0; overflow-y: auto; background-color: #2d2d2d !important; flex: 1; }
            .lss-mm-footer { background-color: #1e1e1e !important; padding: 15px 25px; border-top: 1px solid #444; text-align: right; border-radius: 0 0 8px 8px; }
            .ma-table { width: 100%; border-collapse: collapse; color: #ddd; font-size: 13px; }
            .ma-table th { background-color: #111 !important; color: #aaa; position: sticky; top: 0; padding: 12px 15px; text-align: left; border-bottom: 2px solid #555; z-index: 10; }
            .ma-table td { padding: 10px 15px; border-bottom: 1px solid #444; vertical-align: middle; color: #eee; }
            .ma-table tr:hover { background-color: #383838 !important; }
            .ma-badge { background-color: #e53e3e; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9em; }
            .ma-badge-ok { background-color: #2ecc71; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9em; }
            .pool-add-btn { margin-left: 10px; font-weight: bold; cursor:pointer; }
            .ma-progress-bar { height: 25px; background: #444; border-radius: 4px; overflow: hidden; margin: 15px 0; position:relative; }
            .ma-progress-fill { height: 100%; background: #00bcd4; width: 0%; transition: width 0.3s; }
            .ma-progress-text { position: absolute; width: 100%; text-align: center; line-height: 25px; color: #fff; text-shadow: 1px 1px 2px #000; }
            .basket-main-row { cursor: pointer; background-color: #2d2d2d; }
            .basket-main-row.expanded { background-color: #333 !important; }
            .basket-details-row { display: none; }
            .basket-details-content { padding: 20px; background: #1a1a1a; box-shadow: inset 0 0 15px rgba(0,0,0,0.5); }
            .detail-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
            .detail-item { background: #3a3a3a; padding: 5px 10px; border-radius: 4px; border: 1px solid #555; display: flex; justify-content: space-between; align-items: center; }
            .warn-text { color: #f39c12; font-size: 0.9em; display: block; margin-top: 3px; }
        `;
        document.head.appendChild(style);
    }

    // =================================================================================
    // 3. GLOBAL BASKET INIT
    // =================================================================================
    window.updateLssBasket = function() {
        const li = document.getElementById('lss-master-basket');
        if(!li) return;
        const pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY) || '{}');
        const count = Object.keys(pool).length;
        const badge = count > 0 ? `<span class="badge" style="background:#d9534f; margin-left:5px;">${count}</span>` : '';
        li.innerHTML = `
            <a href="#" class="dropdown-toggle" data-toggle="dropdown">
                <span class="glyphicon glyphicon-education" title="Ausbildungs-Manager"></span>${badge}
                <span class="visible-xs-inline">Ausbildung</span> <b class="caret"></b>
            </a>
            <ul class="dropdown-menu" id="lss-basket-dd" style="background:#1c1c1c; border:1px solid #444; min-width:350px; padding:0;">
                <li style="padding:10px; color:#aaa; text-align:center;">Lade...</li>
            </ul>
        `;
    };

    function initBasketUI() {
        const nav = document.querySelector('#navbar-main-collapse .navbar-right');
        if (!nav || document.getElementById('lss-master-basket')) return;

        const li = document.createElement('li');
        li.id = 'lss-master-basket';
        li.className = 'dropdown';
        
        $(li).on('show.bs.dropdown', async () => {
            const dd = document.getElementById('lss-basket-dd');
            dd.innerHTML = '<li style="padding:10px; color:#aaa; text-align:center;">Lade Daten...</li>';
            const pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY) || '{}');
            const names = await getSchoolingNames();
            const entries = Object.entries(pool).sort();

            let html = '';
            if (entries.length === 0) html = '<li style="padding:15px; text-align:center; color:#888;">Warenkorb leer</li>';
            else {
                for (const [key, v] of entries.slice(0,5)) {
                    let p = 0; Object.values(v).forEach(x => p += (x.amount||x));
                    const name = names[key] || key;
                    
                    // SMART LINK
                    const schoolInfo = await findBestSchoolUrl(key);
                    let btnHtml = '';
                    
                    if (schoolInfo.url) {
                        btnHtml = `<a href="${schoolInfo.url}" class="btn btn-xs btn-success pull-right" title="Starten in: ${schoolInfo.name}" target="_blank">Start</a>`;
                    } else {
                        btnHtml = `<span class="btn btn-xs btn-default pull-right" style="opacity:0.5; cursor:not-allowed;">Voll</span>`;
                    }

                    html += `<li style="padding:8px; border-bottom:1px solid #333; color:#eee;">
                        <b>${name}</b><br><span style="font-size:0.85em; color:#aaa;">${p} Pers.</span>
                        ${btnHtml}
                    </li>`;
                }
                html += `<li style="padding:10px; background:#222; text-align:center;"><button id="lss-open-dash" class="btn btn-sm btn-primary">Große Übersicht</button></li>`;
            }
            dd.innerHTML = html;
            document.getElementById('lss-open-dash')?.addEventListener('click', openDashboard);
        });

        const help = document.getElementById('help_menu');
        if(help) nav.insertBefore(li, help); else nav.appendChild(li);
        window.updateLssBasket();
    }

    async function openDashboard() {
        if(!document.getElementById(MODAL_ID_BASKET)) {
            document.body.insertAdjacentHTML('beforeend', `
            <div id="${MODAL_ID_BASKET}" class="lss-mm-modal"><div class="lss-mm-content">
                <div class="lss-mm-header"><h3 style="margin:0;color:#fff">Manager</h3><button onclick="$('#${MODAL_ID_BASKET}').hide()" class="close" style="color:#fff">&times;</button></div>
                <div class="lss-mm-body" id="${MODAL_ID_BASKET}-body"></div>
                <div class="lss-mm-footer"><button class="btn btn-danger pull-left" onclick="if(confirm('Löschen?')){localStorage.removeItem('${POOL_STORAGE_KEY}'); window.updateLssBasket(); $('#${MODAL_ID_BASKET}').hide();}">Alles löschen</button><button class="btn btn-primary" onclick="$('#${MODAL_ID_BASKET}').hide()">Schließen</button></div>
            </div></div>`);
        }
        $('#'+MODAL_ID_BASKET).show();
        const body = document.getElementById(`${MODAL_ID_BASKET}-body`);
        body.innerHTML = '<div style="padding:40px; text-align:center;">Lade Smart-Links...</div>';
        
        const pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY)||'{}');
        const names = await getSchoolingNames();
        const entries = Object.entries(pool).sort();
        
        if(entries.length === 0) {
            body.innerHTML = '<div style="text-align:center; padding:60px; color:#888;"><h4>Warenkorb leer</h4></div>';
            return;
        }

        let rows = '';
        for (const [key, buildings] of entries) {
            const bIds = Object.keys(buildings);
            let pCount = 0;
            let details = '';
            
            bIds.forEach(id => {
                const entry = buildings[id];
                const amt = entry.amount || entry;
                const name = entry.name || `Wache ${id}`;
                pCount += amt;
                details += `<li class="detail-item"><a href="/buildings/${id}" target="_blank" style="color:#eee">${name}</a> <span class="ma-badge" style="background:#555">${amt}</span></li>`;
            });

            const n = names[key] || key;
            const schoolInfo = await findBestSchoolUrl(key);
            let actionBtn = '';
            
            if (schoolInfo.url) {
                actionBtn = `<a href="${schoolInfo.url}" class="btn btn-success btn-xs" target="_blank" onclick="event.stopPropagation()">Start (${schoolInfo.name})</a>`;
            } else {
                actionBtn = `<span class="btn btn-disabled btn-xs">Keine Schule frei</span>`;
            }

            rows += `
                <tr class="basket-main-row" onclick="this.classList.toggle('expanded'); this.nextElementSibling.style.display = this.classList.contains('expanded') ? 'table-row' : 'none';">
                    <td>▶ <strong>${n}</strong></td>
                    <td>${bIds.length} Wachen</td>
                    <td><span class="ma-badge">${pCount}</span></td>
                    <td style="text-align:right;">${actionBtn}</td>
                </tr>
                <tr class="basket-details-row"><td colspan="4"><div class="basket-details-content"><ul class="detail-list">${details}</ul></div></td></tr>
            `;
        }
        body.innerHTML = `<table class="ma-table"><thead><tr><th>Lehrgang</th><th>Wachen</th><th>Pers</th><th>Aktion</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // =================================================================================
    // 4. API & DATEN
    // =================================================================================
    async function getVehicleData() {
        const cached = JSON.parse(localStorage.getItem(VEHICLE_CACHE_KEY) || '{}');
        if (cached.data && cached.ts > Date.now() - STORAGE_TTL) return cached.data;
        try {
            const res = await fetch("https://api.lss-manager.de/de_DE/vehicles");
            const data = await res.json();
            const transformed = Object.entries(data).filter(([,v])=>!v.isTrailer).map(([id,v])=>{
                const training = [];
                if(v.staff?.training){
                    Object.values(v.staff.training).forEach(g=>{
                        Object.entries(g).forEach(([k,i])=>{
                            if(i.min>0) training.push({key:k, number:i.min});
                            else if(i.all) training.push({key:k, number:v.maxPersonnel});
                        });
                    });
                }
                return {id:Number(id), caption:v.caption, maxStaff:v.maxPersonnel, training};
            });
            const finalData = transformed.map(v => {
                const ov = vehiclesConfigurationOverride.find(o => o.id === v.id);
                return ov ? {...v, ...ov} : v;
            });
            localStorage.setItem(VEHICLE_CACHE_KEY, JSON.stringify({ data: finalData, ts: Date.now() }));
            return finalData;
        } catch (e) { return []; }
    }

    async function getSchoolingNames() {
        const cached = JSON.parse(localStorage.getItem(SCHOOLING_CACHE_KEY) || '{}');
        if (cached.data && cached.ts > Date.now() - STORAGE_TTL) return cached.data;
        try {
            const res = await fetch("https://api.lss-manager.de/de_DE/schoolings");
            const json = await res.json();
            const map = {};
            Object.values(json).flat().forEach(s => { if(s.key) map[s.key] = s.caption; });
            map['gw_taucher'] = 'GW-Taucher'; map['gw_wasserrettung'] = 'GW-Wasserrettung';
            localStorage.setItem(SCHOOLING_CACHE_KEY, JSON.stringify({ data: map, ts: Date.now() }));
            return map;
        } catch (e) { return {}; }
    }
    
    async function getAllBuildings() {
        const cached = JSON.parse(localStorage.getItem(BUILDING_CACHE_KEY) || '{}');
        if (cached.data && cached.ts > Date.now() - BUILDING_TTL) return cached.data;
        try {
            const res = await fetch("/api/buildings");
            const data = await res.json();
            localStorage.setItem(BUILDING_CACHE_KEY, JSON.stringify({ data: data, ts: Date.now() }));
            return data;
        } catch(e) { return []; }
    }

    function getStoredBlueprints() {
        return new Promise((resolve) => {
            const req = indexedDB.open(BLUEPRINT_DB_NAME, 2);
            req.onerror = () => resolve([]);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(BLUEPRINT_STORE_NAME)) { resolve([]); return; }
                const tx = db.transaction(BLUEPRINT_STORE_NAME, 'readonly');
                const store = tx.objectStore(BLUEPRINT_STORE_NAME);
                store.get('blueprints').onsuccess = (ev) => resolve(Object.values(ev.target.result || {}));
            };
        });
    }
    
    // --- SEG FIX IMPLEMENTIERT ---
    async function findBestSchoolUrl(eduKey) {
        const buildings = await getAllBuildings();
        
        const typeMap = {
            'gw_': [1], 'elw': [1, 3, 8], 'dlk': [1], 'hlf': [1], 'rw': [1], 'fire_': [1],
            'notarzt': [3], 'lna': [3], 'orgl': [3], 'seg_': [3], 'care_': [3], 'intensive': [3],
            'police': [8], 'sek': [8], 'mek': [8], 'sheriff': [8], 'k9': [8],
            'thw': [10], 'water_damage': [10], 'energy': [10],
            'water': [1, 3, 27], 'taucher': [1, 3, 27],
            'disaster_': [3, 10]
        };
        
        let targetTypes = [1]; // Default
        for(const [k, types] of Object.entries(typeMap)) { 
            if(eduKey.includes(k)) { targetTypes = types; break; } 
        }

        const candidates = buildings.filter(b => {
            if (![1,3,8,10,27].includes(b.building_type)) return false;
            if (!targetTypes.includes(b.building_type)) return false;
            const cap = 1 + (b.extensions ? b.extensions.length : 0);
            const busy = b.schoolings ? b.schoolings.length : 0;
            return busy < cap;
        });
        
        if (candidates.length > 0) {
            return { url: `/buildings/${candidates[0].id}?auto_assign_edu=${eduKey}`, name: candidates[0].caption };
        }
        return { url: null, name: "Keine freie Schule" };
    }

    // =================================================================================
    // 5. WACHEN-PRÜFER (CHECKER) - MIT ALLES-MERKEN-BUTTON
    // =================================================================================
    function injectCheckerUI(h1) {
        getStoredBlueprints().then(blueprints => {
            const type = parseInt(h1.getAttribute('building_type'));
            const relevant = blueprints.filter(b => b.buildingTypeId === type && b.enabled);
            
            if (relevant.length > 0) {
                const personalBtn = document.querySelector('a[href*="/personals"]');
                const anchor = personalBtn ? personalBtn.closest('.btn-group') : h1;

                const wrapper = document.createElement('div');
                wrapper.id = 'lss-checker-group';
                wrapper.style.marginTop = '5px';
                wrapper.style.display = 'block';

                const group = document.createElement('div');
                group.className = 'btn-group';
                
                relevant.forEach(bp => {
                    const btn = document.createElement('a');
                    btn.className = 'btn btn-default btn-xs';
                    btn.innerHTML = `<span class="glyphicon glyphicon-education"></span> Prüfen: ${bp.name}`;
                    btn.onclick = () => performCheck(bp, h1.innerText.trim());
                    group.appendChild(btn);
                });
                wrapper.appendChild(group);
                anchor.after(wrapper);
            }
        });
    }

    async function performCheck(blueprint, buildingName) {
        if(!document.getElementById(MODAL_ID_CHECKER)) {
            document.body.insertAdjacentHTML('beforeend', `
            <div id="${MODAL_ID_CHECKER}" class="lss-mm-modal"><div class="lss-mm-content">
                <div class="lss-mm-header"><h3 id="${MODAL_ID_CHECKER}-title" style="margin:0;color:#fff">Prüfung</h3><button onclick="$('#${MODAL_ID_CHECKER}').hide()" class="close" style="color:#fff">&times;</button></div>
                <div class="lss-mm-body" id="${MODAL_ID_CHECKER}-body" style="padding:20px;"></div>
            </div></div>`);
        }
        $('#'+MODAL_ID_CHECKER).show();
        const body = document.getElementById(`${MODAL_ID_CHECKER}-body`);
        body.innerHTML = '<div style="text-align:center;">Lade Daten...</div>';
        document.getElementById(`${MODAL_ID_CHECKER}-title`).innerText = "Prüfung: " + blueprint.name;

        const bId = parseInt(window.location.pathname.split('/')[2]);
        if (!bId) return;

        try {
            const [vehiclesDb, schoolingsMap, personnelHtml] = await Promise.all([
                getVehicleData(),
                getSchoolingNames(),
                fetch(`/buildings/${bId}/personals`).then(r => r.text())
            ]);

            const pDoc = new DOMParser().parseFromString(personnelHtml, "text/html");
            const available = { 'null': 0 };
            const inTraining = {};
            let countTotal = 0;
            let countFree = 0;

            pDoc.querySelectorAll("#personal_table tbody tr").forEach(row => {
                countTotal++;
                const filterAttr = row.getAttribute("data-filterable-by");
                const eduList = filterAttr ? JSON.parse(filterAttr.replace(/'/g, '"')) : [];
                const trainingSpan = row.querySelector('span[data-education-key]');
                const isStudying = trainingSpan && trainingSpan.textContent.includes('Im Unterricht');
                const isBound = row.querySelector('td:nth-child(4) a[href*="/vehicles/"]');

                if (isStudying) {
                    const key = trainingSpan.getAttribute('data-education-key');
                    inTraining[key] = (inTraining[key] || 0) + 1;
                }
                if (eduList.length === 0) available['null']++;
                else eduList.forEach(k => available[k] = (available[k] || 0) + 1);

                if (!isStudying && !isBound && eduList.length === 0) countFree++;
            });

            const required = { 'null': 0 };
            const vMap = Object.fromEntries(vehiclesDb.map(v => [v.id, v]));
            blueprint.vehicles.forEach(bv => {
                const dbVeh = vMap[bv.id];
                if(!dbVeh) return;
                const qty = bv.quantity;
                let spec = 0;
                if (dbVeh.training) {
                    let reqList = Array.isArray(dbVeh.training) ? dbVeh.training : [];
                    reqList.forEach(r => {
                        const amt = r.number * qty;
                        required[r.key] = (required[r.key] || 0) + amt;
                        spec += amt;
                    });
                }
                const norm = (dbVeh.maxStaff * qty) - spec;
                if(norm > 0) required['null'] += norm;
            });

            let table = `<table class="ma-table"><thead><tr><th>Ausbildung</th><th>Soll</th><th>Ist</th><th>Unterricht</th><th>Fehlt</th></tr></thead><tbody>`;
            const allKeys = new Set([...Object.keys(required), ...Object.keys(available)]);
            let dynamicFreeCount = countFree;
            let missingItems = []; // Für "Alles merken"

            allKeys.forEach(key => {
                const req = required[key] || 0;
                if(req === 0) return;
                const av = available[key] || 0;
                const tr = inTraining[key] || 0;
                const missing = Math.max(0, req - av); 
                const name = schoolingsMap[key] || (key==='null'?'Basis-Personal':key);

                let act = '<span class="ma-badge-ok">OK</span>';
                if(missing > 0 && key !== 'null') {
                    const trainableAmount = Math.min(missing, countFree);
                    if (trainableAmount > 0) {
                        act = `<button class="btn btn-xs btn-default pool-add-btn" data-key="${key}" data-m="${missing}">🛒 +${missing}</button>`;
                        missingItems.push({ key, missing }); // Merken für Master-Button
                    } else {
                        act = `<span style="color:#e74c3c; font-weight:bold;">Kein freies Personal!</span>`;
                    }
                } else if (missing > 0) act = '<strong style="color:#e53e3e">Fehlt!</strong>';

                table += `<tr style="${missing>0?'background:rgba(200,0,0,0.15)':''}"><td>${name}</td><td>${req}</td><td>${av}</td><td>${tr}</td><td>${missing>0 ? `<b>${missing}</b> ` : ''}${act}</td></tr>`;
            });
            table += `</tbody></table>`;

            let headerHtml = `<div style="margin-bottom:10px;">Personal: <strong>${countTotal}</strong> | <span style="color:#2ecc71">Verfügbar für Ausbildung: <strong id="disp-free">${countFree}</strong></span></div>`;
            
            // --- MASTER BUTTON ---
            if (missingItems.length > 1 && countFree > 0) {
                headerHtml += `<button id="add-all-btn" class="btn btn-success btn-block" style="margin-bottom:10px; font-weight:bold;">🛒 Alle ${missingItems.length} fehlenden Lehrgänge vormerken (soweit Personal reicht)</button>`;
            }

            body.innerHTML = headerHtml + table;

            // Einzel-Button Handler
            body.querySelectorAll('.pool-add-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const key = e.target.dataset.key;
                    const requestedAmount = parseInt(e.target.dataset.m);
                    
                    if (dynamicFreeCount <= 0) {
                        alert("Kein freies Personal mehr verfügbar!");
                        e.target.disabled = true;
                        return;
                    }
                    const possibleAmount = Math.min(requestedAmount, dynamicFreeCount);
                    dynamicFreeCount -= possibleAmount;
                    document.getElementById('disp-free').innerText = dynamicFreeCount;

                    let pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY) || '{}');
                    if(!pool[key]) pool[key] = {};
                    pool[key][bId] = { amount: possibleAmount, name: buildingName };
                    localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(pool));
                    window.updateLssBasket();
                    e.target.className = "btn btn-xs btn-success";
                    e.target.innerText = `✔ (+${possibleAmount})`;
                    e.target.disabled = true;
                });
            });

            // Master-Button Handler
            const masterBtn = document.getElementById('add-all-btn');
            if(masterBtn) {
                masterBtn.addEventListener('click', () => {
                    let addedTotal = 0;
                    missingItems.forEach(item => {
                        if (dynamicFreeCount <= 0) return;
                        const possible = Math.min(item.missing, dynamicFreeCount);
                        dynamicFreeCount -= possible;
                        
                        let pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY) || '{}');
                        if(!pool[item.key]) pool[item.key] = {};
                        pool[item.key][bId] = { amount: possible, name: buildingName };
                        localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(pool));
                        addedTotal += possible;

                        // Buttons updaten
                        const subBtn = body.querySelector(`.pool-add-btn[data-key="${item.key}"]`);
                        if(subBtn) {
                            subBtn.className = "btn btn-xs btn-success";
                            subBtn.innerText = `✔ (+${possible})`;
                            subBtn.disabled = true;
                        }
                    });
                    
                    window.updateLssBasket();
                    document.getElementById('disp-free').innerText = dynamicFreeCount;
                    masterBtn.innerText = `Erledigt! ${addedTotal} Personen vorgemerkt.`;
                    masterBtn.disabled = true;
                });
            }

        } catch(e) { body.innerHTML = `<div style="color:red;padding:20px">Fehler: ${e.message}</div>`; }
    }

    // =================================================================================
    // 6. VISUAL SCHOOL ASSIGNER
    // =================================================================================
    function injectSchoolUI(h1) {
        const div = document.createElement('div');
        div.id = 'lss-school-auto-panel';
        div.style.cssText = 'background:#2d2d2d; color:#eee; padding:20px; margin:15px 0; border:1px solid #00bcd4; border-radius:5px; box-shadow:0 0 10px rgba(0,188,212,0.3);';
        
        const params = new URLSearchParams(window.location.search);
        const k = params.get('auto_assign_edu');
        const pool = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY)||'{}');
        const data = pool[k];

        if(!data) { div.innerHTML = 'Pool leer für diesen Key.'; h1.after(div); return; }

        // AUTO-SELECT LEHRGANG
        setTimeout(() => {
            const eduSelect = document.getElementById('education_select');
            if (eduSelect) {
                for (const option of eduSelect.options) {
                    if (option.value.startsWith(k + ':')) {
                        eduSelect.value = option.value;
                        eduSelect.dispatchEvent(new Event('change'));
                        break;
                    }
                }
            }
        }, 500);

        let total = 0; Object.values(data).forEach(v => total += (v.amount||v));
        const wCount = Object.keys(data).length;

        div.innerHTML = `
            <h3 style="margin-top:0;color:#00bcd4;">🤖 Visual Assistant</h3>
            <p>Auftrag: <strong>${total} Personen</strong> aus <strong>${wCount} Wachen</strong>.</p>
            <p style="font-size:0.9em; color:#aaa;">Es werden nur Personen markiert, die <u>keine Ausbildung</u> haben und <u>keinem Fahrzeug</u> zugewiesen sind.</p>
            <div class="ma-progress-bar"><div id="ma-progress" class="ma-progress-fill"></div><div id="ma-progress-text" class="ma-progress-text">0%</div></div>
            <div id="ma-status" style="font-family:monospace; margin-bottom:10px;">Bereit.</div>
            <button id="ma-scan" class="btn btn-primary">🔎 Zuweisung ausführen (Listen öffnen)</button>
        `;
        
        h1.after(div);

        document.getElementById('ma-scan').addEventListener('click', async function() {
            this.disabled = true;
            this.textContent = "Arbeite...";
            await executeVisualAssignment(k, data);
        });
    }

    async function executeVisualAssignment(eduKey, poolData) {
        const log = (msg, pct) => {
            document.getElementById('ma-status').textContent = msg;
            if(pct !== undefined) {
                document.getElementById('ma-progress').style.width = pct + '%';
                document.getElementById('ma-progress-text').textContent = Math.round(pct) + '%';
            }
        };

        const wachenIds = Object.keys(poolData);
        let processed = 0;
        let markedCount = 0;

        for (const wId of wachenIds) {
            const need = (poolData[wId].amount || poolData[wId]);
            log(`Bearbeite Wache ${wId} (${need} benötigt)...`, (processed / wachenIds.length) * 100);

            const panelHeader = document.querySelector(`.personal-select-heading[building_id="${wId}"]`);
            
            if (panelHeader) {
                if (!panelHeader.nextElementSibling || panelHeader.nextElementSibling.classList.contains('hidden')) {
                     panelHeader.click();
                }
                await waitForPanelContent(panelHeader);

                const panelBody = panelHeader.nextElementSibling;
                const checkboxes = Array.from(panelBody.querySelectorAll('.schooling_checkbox'));
                
                let selectedForThisStation = 0;

                for (const cb of checkboxes) {
                    if (selectedForThisStation >= need) break;
                    const tr = cb.closest('tr');
                    if (cb.disabled || cb.checked) continue;

                    // STRICT CHECKS
                    const eduCell = tr.querySelector('td[id^="school_personal_education_"]');
                    if (eduCell && eduCell.textContent.trim() !== "") continue;
                    const vehLink = tr.querySelector('td:nth-child(4) a[href*="/vehicles/"]');
                    if (vehLink) continue;

                    cb.click(); 
                    selectedForThisStation++;
                    markedCount++;
                }
            }
            processed++;
            await sleep(100);
        }

        log(`Fertig! ${markedCount} Personen markiert.`, 100);
        document.getElementById('ma-scan').style.display = 'none';
        
        const doneBtn = document.createElement('button');
        doneBtn.className = "btn btn-success btn-lg";
        doneBtn.innerHTML = '<span class="glyphicon glyphicon-bullhorn"></span> 🎓 Lehrgang starten & Auftrag löschen';
        doneBtn.style.marginTop = "10px";
        
        doneBtn.onclick = () => {
            const p = JSON.parse(localStorage.getItem(POOL_STORAGE_KEY));
            delete p[eduKey];
            localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(p));
            window.updateLssBasket();

            const form = document.querySelector('form[action*="/education"]');
            const submitBtn = form ? form.querySelector('input[type="submit"]') : null;
            if (submitBtn) submitBtn.click();
            else if (form) form.submit();
            else alert("Fehler: Start-Button nicht gefunden!");
        };
        document.getElementById('lss-school-auto-panel').appendChild(doneBtn);
    }

    function waitForPanelContent(header) {
        return new Promise(resolve => {
            const body = header.nextElementSibling;
            const i = setInterval(() => {
                if (!body.innerHTML.includes('ajax-loader') && body.querySelectorAll('.schooling_checkbox').length > 0) {
                    clearInterval(i);
                    resolve();
                }
            }, 50);
            setTimeout(() => { clearInterval(i); resolve(); }, 4000);
        });
    }

    // =================================================================================
    // INTERVAL LOOP
    // =================================================================================
    injectStyles();
    initBasketUI();

    setInterval(() => {
        if (!document.getElementById('lss-master-basket')) initBasketUI();

        if (window.location.pathname.includes('/buildings/')) {
            const h1 = document.querySelector('h1[building_type]');
            const isSchool = document.querySelector('form[action*="/education"]') || document.getElementById('tab_schooling');
            
            if (h1 && !isSchool && !document.getElementById('lss-checker-group')) {
                injectCheckerUI(h1);
            }
            
            if (isSchool && !document.getElementById('lss-school-auto-panel')) {
                const params = new URLSearchParams(window.location.search);
                if (params.has('auto_assign_edu')) injectSchoolUI(h1);
            }
        }
    }, 1000);

})();
