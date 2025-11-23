// ==UserScript==
// @name         LSS Leitstellen Massenzuweisung (Compact UI)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Kompakte Leiste zur Zuweisung sichtbarer Gebäude.
// @author       Gemini AI
// @match        https://www.leitstellenspiel.de/buildings/*
// @match        https://polizei.leitstellenspiel.de/buildings/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initMassAssign() {
        const $table = $('#building_table');
        if ($('#lss_mass_assign_container').length > 0) return;

        // 1. Daten Sammeln
        const $firstRow = $table.find('tbody tr').first();
        if ($firstRow.length === 0) return;

        const $links = $firstRow.find('td:last-child .btn-group a');
        if ($links.length === 0) return;

        let leitstellenOptions = [];
        $links.each(function() {
            const href = $(this).attr('href');
            const text = $(this).text().trim();
            const parts = href.split('/');
            const lstId = parts[parts.length - 1];
            leitstellenOptions.push({ id: lstId, name: text });
        });

        // 2. UI Bauen (Jetzt kompakt & flexibel)
        // Wir nutzen Inline-CSS für Flexbox, damit es schön nebeneinander steht.
        const uiHTML = `
            <div id="lss_mass_assign_container" style="
                background: #202020;
                color: #ecf0f1;
                padding: 10px 15px;
                margin-bottom: 15px;
                border-left: 4px solid #c0392b;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="glyphicon glyphicon-tasks" style="font-size: 1.2em; margin-right: 5px;"></span>
                    <strong style="margin-right: 5px;">LST-Zuweisung:</strong>

                    <select id="lss_mass_select" class="form-control input-sm" style="width: 250px; background: #fff; color: #333; border: 1px solid #ccc;">
                        </select>

                    <button id="lss_mass_start_btn" class="btn btn-danger btn-sm" style="margin-left: 5px;">
                        Start
                    </button>
                </div>

                <div id="lss_mass_status" style="font-size: 0.9em; opacity: 0.8; text-align: right;">
                    <span class="glyphicon glyphicon-info-sign"></span>
                    Nur <strong>sichtbare</strong> (gefilterte) Zeilen werden bearbeitet.
                </div>
            </div>
        `;

        $table.before(uiHTML);

        const $select = $('#lss_mass_select');
        leitstellenOptions.forEach(opt => {
            $select.append(`<option value="${opt.id}">${opt.name}</option>`);
        });

        // 3. Logik
        $('#lss_mass_start_btn').on('click', async function(e) {
            e.preventDefault();

            const selectedId = $select.val();
            const selectedName = $select.find('option:selected').text();

            // Suche sichtbare Zeilen
            const $visibleRows = $table.find('tbody tr.alliance_buildings_table_searchable:visible');
            const total = $visibleRows.length;

            if (total === 0) {
                alert("Keine sichtbaren Gebäude gefunden.");
                return;
            }

            if (!confirm(`Anzahl betroffener Gebäude: ${total}\nZiel: "${selectedName}"\n\nStarten?`)) {
                return;
            }

            const $status = $('#lss_mass_status');
            const $btn = $(this);
            const originalBtnText = $btn.text();

            $btn.prop('disabled', true).text('Läuft...');

            for (let i = 0; i < total; i++) {
                const $row = $($visibleRows[i]);
                if($row.css('display') === 'none') continue;

                // Status Update rechts
                $status.html(`<span class="glyphicon glyphicon-refresh"></span> Bearbeite <strong>${i + 1}/${total}</strong>...`);

                const $targetLink = $row.find(`td:last-child a[href$="/leitstelle-set/${selectedId}"]`);

                if ($targetLink.length > 0) {
                    const url = $targetLink.attr('href');
                    try {
                        await fetch(url);
                        $row.css('background-color', 'rgba(46, 204, 113, 0.2)'); // Dezentes Grün
                    } catch (error) {
                        console.error(error);
                        $row.css('background-color', 'rgba(231, 76, 60, 0.2)'); // Dezentes Rot
                    }
                }

                await new Promise(r => setTimeout(r, 100));
            }

            $status.html(`<span class="glyphicon glyphicon-ok" style="color:#2ecc71"></span> <strong>Fertig!</strong> ${total} zugewiesen. <a href="javascript:location.reload();" style="color:#3498db; text-decoration: underline;">Reload</a>`);
            $btn.text('Fertig').removeClass('btn-danger').addClass('btn-success');

            setTimeout(() => {
                 $btn.prop('disabled', false).text(originalBtnText).removeClass('btn-success').addClass('btn-danger');
            }, 5000);
        });
    }

    // --- OBSERVER ---
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const callback = function(mutationsList, observer) {
        if ($('#building_table tbody tr').length > 0) {
            initMassAssign();
            observer.disconnect();
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);

    if ($('#building_table tbody tr').length > 0) {
        initMassAssign();
        observer.disconnect();
    }

})();
