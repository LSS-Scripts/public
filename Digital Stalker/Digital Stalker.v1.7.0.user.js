// ==UserScript==
// @name         LSS: Digital Stalker & Click-Killer (BM Edition)
// @namespace    http://tampermonkey.net/
// @version      1.7 (Profile Exclusive)
// @description  Verwandle deine Karte in einen Überwachungsstaat. DSGVO? Egal. Dieses Tool tritt die digitale Tür ein, klaut FMS-Daten beim Hovern und serviert Wachen-Details ohne Ladezeit direkt auf die Netzhaut.
// @author       BM-Dev (The Eye)
// @match        https://www.leitstellenspiel.de/*
// @match        https://polizei.leitstellenspiel.de/*
// @match        https://www.missionchief.com/*
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // === SICHERHEITS-CHECK: NUR AUF PROFIL-SEITEN ===
    // Wir prüfen, ob wir uns wirklich auf einer Profilseite befinden.
    // Die Hauptseite nutzt #map_outer, Profilseiten nutzen #profile_map.
    const profileMapElement = document.getElementById('profile_map');
    if (!profileMapElement) {
        // Wir sind auf der Hauptkarte oder woanders -> Script beenden.
        return;
    }
    console.log("[BM Stalker] Profilseite erkannt. Systeme fahren hoch...");
    // =================================================

    // 1. CSS
    const css = `
        /* Leaflet Popup töten */
        .leaflet-popup { display: none !important; opacity: 0 !important; }

        /* Roter Knopf */
        #bm-target-btn {
            position: absolute; width: 40px; height: 40px;
            background: rgba(255, 0, 0, 0.15);
            border: 2px solid red; border-radius: 50%;
            z-index: 20000; cursor: pointer; display: none;
            transform: translate(-50%, -50%); pointer-events: auto;
            box-shadow: 0 0 15px red;
            transition: all 0.1s ease;
        }
        #bm-target-btn:hover { background: rgba(255, 0, 0, 0.3); transform: translate(-50%, -50%) scale(1.1); }

        /* HUD Monitor */
        #bm-hud-tooltip {
            position: absolute;
            background: rgba(10, 10, 10, 0.95);
            color: white;
            padding: 8px;
            border-radius: 6px;
            font-size: 12px;
            font-family: "Segoe UI", "Roboto", sans-serif;
            z-index: 20001;
            pointer-events: none;
            display: none;
            white-space: nowrap;
            border: 1px solid #444;
            box-shadow: 5px 5px 20px rgba(0,0,0,0.8);
            min-width: 150px;
            backdrop-filter: blur(4px);
        }

        /* HUD Elemente */
        .bm-hud-header {
            font-weight: 700; font-size: 13px; color: #ffcc00;
            border-bottom: 1px solid #555; margin-bottom: 6px; padding-bottom: 4px;
            text-align: left; letter-spacing: 0.5px;
        }
        .bm-hud-row { display: flex; align-items: center; margin-bottom: 3px; justify-content: flex-start; }
        .bm-hud-name { color: #ccc; font-weight: 500; }
        .bm-hud-fms {
            font-weight: 800; border-radius: 3px; padding: 1px 0; min-width: 22px;
            text-align: center; color: #000; margin-right: 12px;
            box-shadow: 1px 1px 3px rgba(0,0,0,0.5); font-size: 11px;
        }

        .fms-1 { background-color: #5bc0de; }
        .fms-2 { background-color: #5cb85c; }
        .fms-3 { background-color: #f0ad4e; }
        .fms-4 { background-color: #d9534f; color: white; }
        .fms-5 { background-color: #5bc0de; border: 2px solid white; line-height: 12px; }
        .fms-6 { background-color: #222; color: #aaa; border: 1px solid #555; }
        .fms-7 { background-color: #e67e22; }
        .fms-0 { background-color: #fff; color: black; }

        #bm-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.9); z-index: 99999;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(5px);
        }

        #bm-modal-box {
            width: 98%; max-width: none !important; height: 95%;
            background: #1e1e1e; border: 1px solid #333; border-radius: 8px;
            display: flex; flex-direction: column; position: relative;
            box-shadow: 0 0 100px rgba(0,0,0,1); overflow: hidden;
        }

        #bm-modal-header {
            padding: 10px 20px; background: #111; border-bottom: 2px solid #333;
            display: flex; justify-content: space-between; align-items: center; color: #eee;
            font-family: sans-serif;
            height: 50px;
        }
        #bm-modal-title {
            font-weight: bold; font-size: 18px; color: #fff;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%;
        }

        .bm-close-btn {
            background: transparent; color: #e74c3c; border: 2px solid #e74c3c;
            border-radius: 50%; width: 30px; height: 30px;
            font-size: 16px; font-weight: bold; line-height: 26px;
            cursor: pointer; text-align: center; transition: all 0.2s;
            display: flex; justify-content: center; align-items: center;
        }
        .bm-close-btn:hover { background: #e74c3c; color: white; }

        #bm-modal-body {
            flex: 1; overflow-y: auto; padding: 15px; background-color: #272b30; color: #c8c8c8;
            width: 100% !important;
        }

        /* NUKLEARER BREITEN-FIX */
        #bm-modal-body.container-fluid,
        #bm-modal-body .container,
        #bm-modal-body .container-fluid {
            width: 100% !important; max-width: 100% !important;
            padding-left: 5px !important; padding-right: 5px !important; margin: 0 !important;
            display: block !important;
        }
        #bm-modal-body .row { margin: 0 !important; display: block !important; width: 100% !important; }
        #bm-modal-body [class*="col-"] {
            width: 100% !important; max-width: 100% !important; flex: 0 0 100% !important;
            padding: 0 !important; float: none !important; display: block !important;
        }
        #bm-modal-body table { width: 100% !important; display: table !important; }

        #bm-modal-body #building-navigation-container,
        #bm-modal-body .breadcrumb,
        #bm-modal-body .building-title { display: none !important; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const btn = document.createElement('div');
    btn.id = 'bm-target-btn';
    document.body.appendChild(btn);

    const tooltip = document.createElement('div');
    tooltip.id = 'bm-hud-tooltip';
    document.body.appendChild(tooltip);

    const vehicleCache = {};
    const buildings = [];

    // ---------------------------------------------------------
    // TEIL 1: Der Datendieb (UPDATED SCANNER)
    // ---------------------------------------------------------

    async function scan() {
        let foundCount = 0;

        // METHODE 1: Cache (Global)
        let cache = null;
        if (typeof unsafeWindow.building_markers_params_cache_per_id !== 'undefined') {
            cache = unsafeWindow.building_markers_params_cache_per_id;
        } else if (unsafeWindow.parent && typeof unsafeWindow.parent.building_markers_params_cache_per_id !== 'undefined') {
            cache = unsafeWindow.parent.building_markers_params_cache_per_id;
        }

        if (cache && typeof cache.forEach === 'function') {
            cache.forEach((b) => {
                if(!buildings.some(existing => existing.id == b.id)) {
                    buildings.push({
                        id: b.id, lat: parseFloat(b.latitude), lng: parseFloat(b.longitude), name: b.name
                    });
                    foundCount++;
                }
            });
            if(foundCount > 0) console.log(`[BM Stalker] Cache Scan: ${foundCount} neue Ziele gefunden.`);
        }

        // METHODE 2: Fetch (Profilseite)
        if (typeof unsafeWindow.user_id_to_view !== 'undefined' && foundCount === 0) {
            console.log(`[BM Stalker] Profil erkannt (User ${unsafeWindow.user_id_to_view}). Starte manuellen Fetch...`);
            try {
                const response = await fetch('/building/buildings_json?user_to_load_id=' + unsafeWindow.user_id_to_view);
                const data = await response.json();

                if (data && data.buildings) {
                    data.buildings.forEach(b => {
                        if(!buildings.some(existing => existing.id == b.id)) {
                            buildings.push({
                                id: b.id, lat: parseFloat(b.latitude), lng: parseFloat(b.longitude), name: b.name
                            });
                            foundCount++;
                        }
                    });
                    console.log(`[BM Stalker] Fetch erfolgreich: ${foundCount} Ziele importiert.`);
                }
            } catch(e) {
                console.error("[BM Stalker] Fetch fehlgeschlagen:", e);
            }
        }

        // METHODE 3: Fallback (Regex)
        if (foundCount === 0) {
            const html = document.body.innerHTML;
            const regex = /buildingMarkerAddSingle\(\{(.*?)\}\)/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                try {
                    const c = match[1];
                    const id = c.match(/"id":(\d+)/)[1];
                    const lat = c.match(/"latitude":([\d\.]+)/)[1];
                    const lng = c.match(/"longitude":([\d\.]+)/)[1];
                    let name = "Gebäude";
                    const nameMatch = c.match(/"name":"(.*?)"/);
                    if(nameMatch) name = nameMatch[1];

                    if(!buildings.some(existing => existing.id == id)) {
                        buildings.push({
                            id: id, lat: parseFloat(lat), lng: parseFloat(lng), name: name
                        });
                        foundCount++;
                    }
                } catch(e){}
            }
        }

        if (buildings.length === 0) setTimeout(scan, 2000);
    }

    scan();
    setTimeout(scan, 3000);

    function fetchVehiclesForTooltip(url, buildingId, buildingName) {
        updateTooltipContent(buildingName, '<span style="color:#888; font-style:italic;">Injiziere Spionage-Software...</span>');

        fetch(url)
            .then(res => res.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const rows = doc.querySelectorAll('tr');
                const vehicles = [];

                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 3) {
                        const nameLink = cells[1].querySelector('a');
                        const fmsSpan = cells[3].querySelector('.building_list_fms');
                        if (nameLink && fmsSpan) {
                            vehicles.push({
                                name: nameLink.textContent.trim(),
                                fms: fmsSpan.textContent.trim()
                            });
                        }
                    }
                });

                vehicleCache[buildingId] = vehicles;

                if (currentBuildingId === buildingId) {
                    renderVehicleList(buildingName, vehicles);
                }
            })
            .catch(() => {
                updateTooltipContent(buildingName, '<span style="color:#e74c3c;">Zugriff verweigert (Fehler)</span>');
            });
    }

    function updateTooltipContent(name, contentHtml) {
        tooltip.innerHTML = `<div class="bm-hud-header">${name}</div><div>${contentHtml}</div>`;
    }

    function renderVehicleList(name, vehicles) {
        if (!vehicles || vehicles.length === 0) {
            updateTooltipContent(name, '<span style="color:#aaa;">Leer (oder Zombie-Wache)</span>');
            return;
        }
        let html = '';
        vehicles.forEach(v => {
            html += `
                <div class="bm-hud-row">
                    <span class="bm-hud-fms fms-${v.fms}">${v.fms}</span>
                    <span class="bm-hud-name">${v.name}</span>
                </div>
            `;
        });
        updateTooltipContent(name, html);
    }

    // ---------------------------------------------------------
    // TEIL 2: Der Chirurg
    // ---------------------------------------------------------

    function loadAndShowModal(url, buildingName) {
        const overlay = document.createElement('div');
        overlay.id = 'bm-modal-overlay';

        const box = document.createElement('div');
        box.id = 'bm-modal-box';

        const header = document.createElement('div');
        header.id = 'bm-modal-header';

        header.innerHTML = `<span id="bm-modal-title">${buildingName || 'Unbekanntes Objekt'}</span> <button class="bm-close-btn" title="Schließen">✕</button>`;

        const body = document.createElement('div');
        body.id = 'bm-modal-body';
        body.className = "container-fluid";
        body.innerHTML = '<div style="text-align:center; padding:50px; font-size: 20px; color:#666;">🔪 Extrahiere Daten...</div>';

        box.appendChild(header);
        box.appendChild(body);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const closeFunc = () => overlay.remove();
        header.querySelector('.bm-close-btn').onclick = closeFunc;
        overlay.onclick = (e) => { if(e.target === overlay) closeFunc(); };

        fetch(url).then(res => res.text()).then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const nav = doc.getElementById('building-navigation-container');
            if (nav) nav.remove();

            let finalTitle = buildingName;
            const titleDiv = doc.querySelector('.building-title');
            if (titleDiv) {
                const h1 = titleDiv.querySelector('h1');
                if (h1) finalTitle = h1.textContent.trim();
                titleDiv.remove();
            }
            const breadcrumb = doc.querySelector('.breadcrumb');
            if (breadcrumb) breadcrumb.remove();

            const titleSpan = document.getElementById('bm-modal-title');
            if(titleSpan) titleSpan.textContent = finalTitle;

            const vehicleTabLink = doc.querySelector('a[href="#vehicle"]');
            if (vehicleTabLink) {
                doc.querySelectorAll('ul.nav-tabs li').forEach(t => t.classList.remove('active'));
                vehicleTabLink.closest('li').classList.add('active');
                doc.querySelectorAll('.tab-pane').forEach(p => {
                    p.classList.remove('active');
                    p.classList.remove('in');
                });
                const vPane = doc.getElementById('vehicle');
                if (vPane) { vPane.classList.add('active'); vPane.classList.add('in'); }
            }

            let content = doc.getElementById('iframe-inside-container') || doc.body;
            content.querySelectorAll('script').forEach(s => s.remove());
            body.innerHTML = content.innerHTML;
        });
    }

    // ---------------------------------------------------------
    // TEIL 3: Das Zielerfassungssystem
    // ---------------------------------------------------------

    let currentBuildingId = null;
    let currentUrl = null;
    let currentName = null;

    window.addEventListener('mousemove', function(e) {
        if(!unsafeWindow.map) return;
        const map = unsafeWindow.map;
        const rect = map.getContainer().getBoundingClientRect();

        if(e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            btn.style.display = 'none';
            tooltip.style.display = 'none';
            return;
        }

        const point = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
        const layerPoint = map.latLngToLayerPoint(point);

        let hit = null;
        for(let b of buildings) {
            const bPoint = map.latLngToLayerPoint([b.lat, b.lng]);
            const dist = Math.sqrt(Math.pow(layerPoint.x - bPoint.x, 2) + Math.pow(layerPoint.y - bPoint.y, 2));
            if(dist < 30) { hit = b; break; }
        }

        if(hit) {
            const bPos = map.latLngToContainerPoint([hit.lat, hit.lng]);
            const absX = rect.left + bPos.x;
            const absY = rect.top + bPos.y;

            btn.style.left = absX + 'px';
            btn.style.top = absY + 'px';
            btn.style.display = 'block';

            tooltip.style.left = (absX + 25) + 'px';
            tooltip.style.top = (absY - 20) + 'px';
            tooltip.style.display = 'block';

            document.body.style.cursor = 'pointer';
            currentUrl = '/buildings/' + hit.id;
            currentName = hit.name;

            if (currentBuildingId !== hit.id) {
                currentBuildingId = hit.id;
                if (vehicleCache[hit.id]) {
                    renderVehicleList(hit.name, vehicleCache[hit.id]);
                } else {
                    fetchVehiclesForTooltip(currentUrl, hit.id, hit.name);
                }
            }
        } else {
            btn.style.display = 'none';
            tooltip.style.display = 'none';
            currentUrl = null;
            currentBuildingId = null;
            document.body.style.cursor = 'default';
        }
    });

    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if(currentUrl) loadAndShowModal(currentUrl, currentName);
    });

})();
