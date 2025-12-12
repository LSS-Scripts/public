// ==UserScript==
// @name         Leitstellenspiel - Schul-Manager (Color Fix)
// @namespace    http://tampermonkey.net/
// @version      31.0
// @description  API-basiert, Deutsche Namen, Kompaktes Layout & Lesbare Farben (Orange für Bau).
// @author       Gemini (Optimiert)
// @match        https://www.leitstellenspiel.de/
// @match        *://*.leitstellenspiel.de/buildings/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Cache für die API-Daten (5 Sekunden für schnelles Feedback)
    let apiCache = {
        data: null,
        timestamp: 0,
        TIMEOUT: 10000
    };

    /**
     * VOLLSTÄNDIGES WÖRTERBUCH
     */
    const courseMapping = {
        // --- POLIZEI ---
        "police_firefighting": "Brandbekämpfung",
        "police_service_group_leader": "Dienstgruppenleitung",
        "k9": "Hundeführer (Schutzhund)",
        "police_fukw": "Hundertschaftsführer (FüKW)",
        "criminal_investigation": "Kriminalpolizei",
        "police_speaker_operator": "Lautsprecheroperator",
        "police_mek": "MEK",
        "police_motorcycle": "Motorradstaffel",
        "polizeihubschrauber": "Polizeihubschrauber",
        "police_horse": "Reiterstaffel",
        "police_sek": "SEK",
        "police_wasserwerfer": "Wasserwerfer",
        "police_helicopter_lift": "Windenoperator (Polizei)",
        "police_einsatzleiter": "Zugführer (leBefKw)",

        // --- FEUERWEHR & RETTUNGSDIENST (Allgemein) ---
        "railway_fire": "Bahnrettung",
        "dekon_p": "Dekon-P Lehrgang",
        "fire_drone": "Drohnen-Schulung (FW)",
        "elw2": "ELW 2 Lehrgang",
        "fire_care_service": "Feuerwehr-Verpflegungseinheit",
        "fwk": "Feuerwehrkran Lehrgang",
        "arff": "Flugfeldlöschfahrzeug-Ausbildung",
        "gw_gefahrgut": "GW-Gefahrgut Lehrgang",
        "gw_messtechnik": "GW-Messtechnik Lehrgang",
        "gw_taucher": "GW-Taucher / Bergungstaucher",
        "gw_wasserrettung": "GW-Wasserrettung / Wassergefahren",
        "gw_hoehenrettung": "Höhenrettung Lehrgang",
        "intensive_care": "Intensivpflege",
        "energy_supply": "NEA200 Fortbildung",
        "notarzt": "Notarzt-Ausbildung",
        "rettungstreppe": "Rettungstreppen-Ausbildung",
        "care_service_equipment": "Verpflegungshelfer",
        "wechsellader": "Wechsellader Lehrgang",
        "werkfeuerwehr": "Werkfeuerwehr-Ausbildung",

        // --- RETTUNGSDIENST / SEG ---
        "care_service": "Betreuungsdienst",
        "seg_drone": "Drohnenoperator (SEG)",
        "mountain_command": "Einsatzleiter Bergrettung",
        "mountain_height_rescue": "Höhenretter (Bergrettung)",
        "lna": "LNA-Ausbildung",
        "orgl": "OrgL-Ausbildung",
        "seg_rescue_dogs": "Rettungshundeführer (SEG)",
        "seg_elw": "SEG - Einsatzleitung",
        "seg_gw_san": "SEG - GW-San",
        "disaster_response_technology": "Technik und Sicherheit",
        "rescue_helicopter_lift": "Windenoperator (Rettung)",

        // --- WASSERRETTUNG / SEENOTRETTUNG ---
        "coastal_helicopter": "Hubschrauberpilot (Seenotrettung)",
        "coastal_rescue": "Seenotretter",
        "emergency_paramedic_water_rescue": "Wasserrettungsausbildung für Notfallsanitäter",
        "coastal_helicopter_lift": "Windenoperator (Seenotrettung)",

        // --- THW ---
        "thw_energy_supply": "Fachgruppe Elektroversorgung",
        "thw_rescue_dogs": "Fachgruppe Rettungshundeführer (THW)",
        "thw_raumen": "Fachgruppe Räumen",
        "heavy_rescue": "Fachgruppe Schwere Bergung",
        "water_damage_pump": "Fachgruppe Wasserschaden/Pumpen",
        "thw_command": "Fachzug Führung und Kommunikation",
        "thw_care_service": "Logistik-Verpflegung",
        "thw_drone": "Trupp Unbemannte Luftfahrtsysteme",
        "thw_zugtrupp": "Zugtrupp",

        // --- SONSTIGE FALLBACKS ---
        "gw_san": "GW-Sanitäter"
    };

    function formatEducationName(internalName) {
        if (courseMapping[internalName]) return courseMapping[internalName];
        return internalName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    async function fetchBuildings() {
        const now = Date.now();
        if (apiCache.data && (now - apiCache.timestamp < apiCache.TIMEOUT)) return apiCache.data;
        try {
            const response = await fetch('/api/buildings');
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            apiCache.data = data;
            apiCache.timestamp = now;
            return data;
        } catch (e) {
            console.error("Fehler beim Abrufen der Gebäude:", e);
            return [];
        }
    }

    function getSchoolTypeName(typeId, caption) {
        const types = { 1: "Feuerwehrschule", 3: "Rettungsschule", 8: "Polizeischule", 10: "THW-Bundesschule", 27: "Seenotrettungsschule" };
        if (types[typeId]) return types[typeId];
        const lowerCap = caption.toLowerCase();
        if (lowerCap.includes('polizei')) return "Polizeischule (Sonstige)";
        if (lowerCap.includes('feuerwehr')) return "Feuerwehrschule (Sonstige)";
        if (lowerCap.includes('rettung')) return "Rettungsschule (Sonstige)";
        if (lowerCap.includes('thw')) return "THW-Bundesschule (Sonstige)";
        return "Sonstige Schule";
    }

    function initBuildingUebersicht() {
        const targetTabPaneId = 'tab_schooling';
        const summaryId = 'schooling-summary-container';
        let isRendering = false;

        async function renderOverview() {
            if (isRendering) return;
            isRendering = true;

            const targetTab = document.getElementById(targetTabPaneId);
            if (!targetTab) { isRendering = false; return; }

            let summaryDiv = document.getElementById(summaryId);
            if (summaryDiv && summaryDiv.children.length > 0 && summaryDiv.innerText.length > 20) {
                 isRendering = false;
                 if (targetTab.firstChild !== summaryDiv) targetTab.prepend(summaryDiv);
                 return;
            }

            if (!summaryDiv) {
                summaryDiv = document.createElement('div');
                summaryDiv.id = summaryId;
                summaryDiv.style.marginBottom = '20px';
                targetTab.prepend(summaryDiv);
            }

            if (!apiCache.data) summaryDiv.innerHTML = '<div class="alert alert-info"><i class="fa fa-spinner fa-spin"></i> Lade Schuldaten...</div>';

            const buildings = await fetchBuildings();

            const stats = {};
            let totalSchools = 0;
            let totalRooms = 0;
            let totalConstruction = 0;
            let totalOccupied = 0;

            buildings.forEach(b => {
                if (!b.hasOwnProperty('schoolings')) return;

                const typeName = getSchoolTypeName(b.building_type, b.caption);

                if (!stats[typeName]) {
                    stats[typeName] = {
                        count: 0, rooms: 0, construction: 0, occupied: 0, free: 0,
                        link: `/buildings/${b.id}`, activeCourses: {}
                    };
                }

                let capacity = 1;
                let buildingNow = 0;
                if (b.extensions) {
                    b.extensions.forEach(ext => {
                        if (ext.enabled) {
                            if (ext.available) capacity++;
                            else buildingNow++;
                        }
                    });
                }

                const activeSchoolings = b.schoolings ? b.schoolings.length : 0;
                if (b.schoolings && b.schoolings.length > 0) {
                    b.schoolings.forEach(course => {
                        const niceName = formatEducationName(course.education);
                        if (!stats[typeName].activeCourses[niceName]) stats[typeName].activeCourses[niceName] = 0;
                        stats[typeName].activeCourses[niceName]++;
                    });
                }

                stats[typeName].count++;
                stats[typeName].rooms += capacity;
                stats[typeName].construction += buildingNow;
                stats[typeName].occupied += activeSchoolings;
                stats[typeName].free += (capacity - activeSchoolings);
                if ((capacity - activeSchoolings) > 0) stats[typeName].link = `/buildings/${b.id}`;
            });

            let tableRows = '';
            const sortedTypes = Object.keys(stats).sort();
            const borderStyle = 'border-left: 2px solid #555;';

            sortedTypes.forEach(type => {
                const s = stats[type];
                totalSchools += s.count;
                totalRooms += s.rooms;
                totalConstruction += s.construction;
                totalOccupied += s.occupied;

                let actionBtn = s.free > 0
                    ? `<a href="${s.link}" class="btn btn-xs btn-success" target="_blank">Starten</a>`
                    : `<span class="label label-default">Voll</span>`;

                let capDisplay = s.rooms;
                if (s.construction > 0) {
                    // FIX: "text-muted" entfernt, Farbe auf Orange (#f0ad4e) geändert für bessere Lesbarkeit
                    capDisplay = `${s.rooms} <span style="color: #f0ad4e; font-size: 0.85em;" title="Davon im Bau">(+${s.construction})</span>`;
                }

                let occupiedTooltip = "";
                let cursorStyle = "";
                const courseKeys = Object.keys(s.activeCourses);
                if (courseKeys.length > 0) {
                    courseKeys.sort((a, b) => s.activeCourses[b] - s.activeCourses[a]);
                    occupiedTooltip = courseKeys.map(k => `${s.activeCourses[k]}x ${k}`).join('\n');
                    cursorStyle = 'cursor: help; text-decoration: underline dotted;';
                }

                // FIX: Anzahl Farbe auf hellgrau (#bbb) statt text-muted
                tableRows += `
                    <tr>
                        <td><strong>${type}</strong> <span style="color: #bbb; font-weight:normal;">(${s.count})</span></td>
                        <td style="${borderStyle}">${capDisplay}</td>
                        <td class="text-danger" title="${occupiedTooltip}" style="${cursorStyle}">${s.occupied}</td>
                        <td class="text-success"><strong>${s.free}</strong></td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            });

            const totalFree = totalRooms - totalOccupied;
            let totalCapDisplay = totalRooms;
            if (totalConstruction > 0) {
                // FIX: Footer ebenfalls auf Orange geändert
                totalCapDisplay = `${totalRooms} <span style="color: #f0ad4e; font-size: 0.85em;">(+${totalConstruction})</span>`;
            }

            summaryDiv.innerHTML = `
                <div class="panel panel-default" style="margin-bottom: 20px;">
                    <div class="panel-heading"><h3 class="panel-title" style="margin:0;"><strong>Schul-Manager Übersicht</strong></h3></div>
                    <div class="panel-body" style="padding: 0;">
                        <table class="table table-striped table-hover table-condensed" style="margin-bottom: 0;">
                            <thead>
                                <tr>
                                    <th>Schultyp (Anzahl)</th>
                                    <th style="${borderStyle}">Gesamt</th>
                                    <th>Belegt</th>
                                    <th>Frei</th>
                                    <th>&nbsp;</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                            <tfoot>
                                <tr style="border-top: 2px solid #555; font-weight: bold;">
                                    <td>GESAMT <span style="color: #bbb; font-weight:normal;">(${totalSchools})</span></td>
                                    <td style="${borderStyle}">${totalCapDisplay}</td>
                                    <td class="text-danger">${totalOccupied}</td>
                                    <td class="text-success">${totalFree}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
            isRendering = false;
        }

        function startObserver() {
            const targetTab = document.getElementById(targetTabPaneId);
            if (!targetTab) return;
            renderOverview();
            const observer = new MutationObserver((mutations) => {
                let summary = document.getElementById(summaryId);
                if (!summary) {
                    console.log("Schul-Manager: Tabelle wurde gelöscht, stelle wieder her...");
                    renderOverview();
                } else {
                    if (targetTab.firstChild !== summary) targetTab.prepend(summary);
                }
            });
            observer.observe(targetTab, { childList: true, subtree: false });
        }

        const targetLink = document.querySelector(`a[href="#${targetTabPaneId}"]`);
        if (targetLink) {
            targetLink.addEventListener('click', () => { setTimeout(startObserver, 200); });
            if (window.location.hash === `#${targetTabPaneId}` || targetLink.parentElement.classList.contains('active')) {
                setTimeout(startObserver, 500);
            }
        }
    }

    function initHomepageAmpel() {
        function addCustomStyles() {
            if (document.getElementById('school-ampel-styles')) return;
            const style = document.createElement('style');
            style.id = 'school-ampel-styles';
            style.innerHTML = `
                .school-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px; vertical-align: middle; border: 1px solid #555; }
                .school-dot.green { background-color: #449d44; box-shadow: 0 0 4px #449d44; }
                .school-dot.red { background-color: #c9302c; }
            `;
            document.head.appendChild(style);
        }

        async function updateAmpeln() {
            const buildings = await fetchBuildings();
            if (!buildings.length) return;
            buildings.forEach(b => {
                if (!b.hasOwnProperty('schoolings')) return;
                const domEl = document.getElementById(`building_list_caption_${b.id}`);
                if (!domEl) return;
                let capacity = 1;
                if (b.extensions) {
                    b.extensions.forEach(ext => {
                        if (ext.enabled && ext.available) capacity++;
                    });
                }
                const occupied = b.schoolings ? b.schoolings.length : 0;
                const isFree = occupied < capacity;
                const oldDot = domEl.querySelector('.school-dot');
                if (oldDot) oldDot.remove();
                const dot = document.createElement('span');
                dot.classList.add('school-dot', isFree ? 'green' : 'red');
                dot.title = `Belegt: ${occupied} / ${capacity}`;
                domEl.prepend(dot);
            });
        }
        const list = document.getElementById('building_list');
        if (list) {
            addCustomStyles();
            updateAmpeln();
        }
    }

    const path = window.location.pathname;
    if (path === '/') { initHomepageAmpel(); }
    else if (path.startsWith('/buildings/')) { initBuildingUebersicht(); }
})();
