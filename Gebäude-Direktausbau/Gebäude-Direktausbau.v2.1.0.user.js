// ==UserScript==
// @name            Gebäude-Direktausbau (Ein-Klick)
// @version         2.1.0
// @author          B&M & JAN (optimiert)
// @description     Gebäude direkt per Klick auf die Zahl ausbauen (ohne Bestätigung)
// @match           https://www.leitstellenspiel.de/buildings/*
// @run-at          document-idle
// @grant           unsafeWindow
// ==/UserScript==

(function() {
    const expandBtn = document.querySelector('a[href$="/expand"]');
    if (!expandBtn || unsafeWindow.location.pathname.split('/').length !== 3) return;

    const buildingId = unsafeWindow.location.pathname.split('/')[2];
    const locale = unsafeWindow.I18n.locale;

    Promise.all([
        fetch(`/api/buildings/${buildingId}`).then(r => r.json()),
        fetch(`https://api.lss-manager.de/${locale}/buildings`).then(r => r.json()),
        fetch(`https://api.lss-manager.de/${locale}/small_buildings`).then(r => r.json()),
    ]).then(([b, types, smallTypes]) => {
        // Richtigen Gebäudetyp (normal oder klein) ermitteln
        const typeData = b.small_building ? smallTypes[b.building_type] : types[b.building_type];

        // Abbruch, wenn Max-Level erreicht oder Typ unbekannt
        if (!typeData || b.level >= typeData.maxLevel) return;

        const group = document.createElement('div');
        group.className = 'btn-group';

        // Schleife von nächster Stufe bis Max-Level
        for (let i = b.level + 1; i <= typeData.maxLevel; i++) {
            const btn = document.createElement('a');
            // Die nächste Stufe ist grün (success), alle weiteren grau (default)
            btn.className = `btn btn-xs ${i === b.level + 1 ? 'btn-success' : 'btn-default'}`;
            btn.textContent = i;
            // API erwartet Ziel-Level minus 1
            btn.href = `/buildings/${buildingId}/expand_do/credits?level=${i - 1}`;
            group.appendChild(btn);
        }

        expandBtn.after(document.createElement('br'), group);
    });
})();
