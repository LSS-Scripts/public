// ==UserScript==
// @name            Gebäude-Direktausbau (Ein-Klick)
// @version         2.0.0
// @author          B&M & JAN
// @description     update buildings to a certain level immediately on click
// @description:de  Gebäude direkt per Klick auf die Zahl ausbauen (ohne Bestätigung)
// @match           https://www.leitstellenspiel.de/buildings/*
// @run-at          document-idle
// @grant           unsafeWindow
// ==/UserScript==

const expandBtn = document.querySelector(
    'a[href^="/buildings/"][href$="/expand"]'
);

if (expandBtn && unsafeWindow.location.pathname.split('/').length === 3) {
    const expandBar = document.createElement('div');
    expandBar.classList.add('btn-group');

    // Wir entfernen die Extra Buttons für Credits/Coins, da wir sie nicht mehr brauchen

    const [, , buildingId] = unsafeWindow.location.pathname.split('/');

    Promise.all([
        fetch(`/api/buildings/${buildingId}`).then(r => r.json()),
        fetch(
            `https://api.lss-manager.de/${unsafeWindow.I18n.locale}/buildings`
        ).then(r => r.json()),
        fetch(
            `https://api.lss-manager.de/${unsafeWindow.I18n.locale}/small_buildings`
        ).then(r => r.json()),
    ]).then(([building, buildingTypes, smallBuildings]) => {
        const currentLevel = building.level;
        const { maxLevel, levelPrices } =
            buildingTypes[
                building.small_building ?
                    smallBuildings[building.building_type]
                :   building.building_type
            ];

        if (currentLevel >= maxLevel) return;

        const levels = Array(maxLevel)
            .fill(0)
            .map((_, i) => i + 1)
            .slice(currentLevel);

        // Hier wird der Button direkt mit dem Link belegt
        expandBar.append(
            ...levels.map(level => {
                const btn = document.createElement('a');
                btn.classList.add('btn', 'btn-default', 'btn-xs');

                // Nächste Stufe grün markieren zur besseren Sichtbarkeit
                if (level === currentLevel + 1) {
                    btn.classList.replace('btn-default', 'btn-success');
                }

                // Der direkte Link zum Ausbau mit CREDITS
                // Die API erwartet (Ziellevel - 1)
                btn.href = `/buildings/${buildingId}/expand_do/credits?level=${level - 1}`;

                btn.textContent = level;
                return btn;
            })
        );

        // Nur noch die Leiste einfügen, keine extra Buttons mehr
        expandBtn.after(
            document.createElement('br'),
            expandBar
        );
    });
}
