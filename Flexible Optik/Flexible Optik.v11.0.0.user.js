// ==UserScript==
// @name         LSS Flexible Grid (Dark Scroll V11)
// @namespace    http://tampermonkey.net/
// @version      11.0
// @description  Befreit deine Leitstelle aus dem Kerker des statischen Rasters. Jetzt mit Scrollbalken, die nicht mehr leuchten wie ein Atomkraftwerk bei Nacht. Mit der magnetischen "Snap"-Funktion kleben deine Fenster aneinander wie Gaffer an einer Unfallstelle. Solltest du das Layout so sehr verunstalten, dass selbst der Rettungsdienst die Flucht ergreift: Der Reset-Knopf versteckt sich schamhaft im Profilmenü.
// @author       Gemini AI
// @match        https://www.leitstellenspiel.de/*
// @match        https://www.missionchief.com/
// @match        https://www.meldkamerspel.com/
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// ==/UserScript==

(function($) {
    'use strict';

    // Konfiguration
    const STORAGE_KEY = 'lss_layout_v11_data';
    const GRIP_HEIGHT = 12;
    const MAP_HEADER_HEIGHT = 30;
    const SNAP_TOLERANCE = 15;

    // --- CSS ---
    GM_addStyle(`
        /* --- NAVIGATIONS-FIXES --- */
        #main_navbar, .navbar-static-top, .navbar-fixed-top {
            z-index: 50000 !important;
            position: relative !important;
        }
        .dropdown-menu { z-index: 50001 !important; }
        .navbar-fixed-bottom {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 50002 !important;
        }

        /* --- SCROLLBAR STYLING (Dark Mode) --- */

        /* Firefox */
        .lss-shell-content > div {
            scrollbar-width: thin;
            scrollbar-color: #555 #222;
        }

        /* Chrome, Edge, Safari (Webkit) */
        .lss-shell-content > div::-webkit-scrollbar {
            width: 10px;
        }
        .lss-shell-content > div::-webkit-scrollbar-track {
            background: #222; /* Hintergrund der Leiste */
        }
        .lss-shell-content > div::-webkit-scrollbar-thumb {
            background-color: #555; /* Der "Griff" */
            border-radius: 6px;
            border: 2px solid #222; /* Macht den Griff optisch schlanker */
        }
        .lss-shell-content > div::-webkit-scrollbar-thumb:hover {
            background-color: #777; /* Heller beim Drüberfahren */
        }

        /* --- FENSTER STYLES --- */
        .lss-window-shell {
            position: absolute !important;
            z-index: 1000;
            background-color: #222;
            border: 1px solid #444;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            margin: 0 !important;
            box-sizing: border-box;
        }

        .lss-grip-handle {
            height: ${GRIP_HEIGHT}px;
            background-color: #111;
            border-bottom: 1px solid #333;
            cursor: move;
            flex-shrink: 0;
            z-index: 10;
            width: 100%;
        }
        .lss-grip-handle:hover { background-color: #333; }

        .lss-map-header-full {
            height: ${MAP_HEADER_HEIGHT}px;
            background-color: #222;
            color: #eee;
            display: flex;
            align-items: center;
            padding-left: 10px;
            font-weight: bold;
            border-bottom: 1px solid #444;
            cursor: move;
            flex-shrink: 0;
            width: 100%;
            box-sizing: border-box;
        }

        .lss-shell-content {
            flex-grow: 1;
            position: relative;
            overflow: hidden;
            background: #222;
            width: 100%;
        }
        .lss-shell-content > div {
            height: 100% !important;
            overflow-y: auto !important;
            width: 100% !important;
            border: none !important;
            margin: 0 !important;
        }

        #map { width: 100% !important; height: 100% !important; }

        .lss-win-min-btn {
            position: absolute;
            top: 0;
            right: 0;
            width: 30px;
            height: ${GRIP_HEIGHT + 5}px;
            background-color: #c9302c;
            color: white;
            text-align: center;
            line-height: ${GRIP_HEIGHT}px;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
            z-index: 20;
            border-bottom-left-radius: 4px;
        }
        .lss-win-min-btn:hover { background-color: #d9534f; }
        .lss-map-header-full .lss-win-min-btn {
            height: 20px;
            line-height: 20px;
            top: 5px;
            right: 5px;
        }

        .lss-minimized {
            height: auto !important;
            width: 200px !important;
            border: 1px solid #666;
        }
        .lss-minimized .lss-shell-content { display: none !important; }

        .lss-placeholder {
            visibility: hidden;
            pointer-events: none;
        }

        .ui-resizable-se {
            width: 15px;
            height: 15px;
            background: linear-gradient(135deg, transparent 50%, #555 50%);
            right: 0;
            bottom: 0;
            z-index: 1002 !important;
        }
    `);

    $(document).ready(function() {
        $('head').append('<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">');
        setTimeout(initLayout, 1500);
    });

    function initLayout() {
        addResetToProfileMenu();

        const windowsDef = [
            { id: '#missions', outer: '#missions_outer', title: 'Einsätze', isMap: false },
            { id: '#buildings', outer: '#buildings_outer', title: 'Wachen', isMap: false },
            { id: '#chat_panel', outer: '#chat_outer', title: 'Chat', isMap: false },
            { id: '#radio', outer: '#radio_outer', title: 'Funk', isMap: false },
            { id: '#map_outer', outer: '#map_outer', title: 'Karte', isMap: true }
        ];

        let savedLayout = GM_getValue(STORAGE_KEY, null);
        if (typeof savedLayout !== 'object') savedLayout = {};

        // 1. MESSEN
        let tasks = [];
        windowsDef.forEach(win => {
            let $outer = $(win.outer);
            if ($outer.length === 0) return;

            let offset = $outer.offset();
            let w = $outer.outerWidth();
            let h = $outer.outerHeight();

            if (h < 200) h = 500;

            tasks.push({
                def: win,
                originalPos: { top: offset.top, left: offset.left, width: w, height: h }
            });
        });

        // 2. UMBAU
        tasks.forEach(task => {
            let win = task.def;
            let $outer = $(win.outer);
            let $content = $(win.id);

            let $placeholder = $('<div class="lss-placeholder"></div>');
            $placeholder.css({
                width: task.originalPos.width + 'px',
                height: task.originalPos.height + 'px',
                float: $outer.css('float'),
                margin: $outer.css('margin')
            });
            $placeholder.addClass($outer.attr('class').replace('overview_outer', '').replace('bigMapWindow', ''));
            $outer.before($placeholder);

            let headerHTML = win.isMap
                ? `<div class="lss-map-header-full"><span>${win.title}</span><div class="lss-win-min-btn" title="Minimieren">_</div></div>`
                : `<div class="lss-grip-handle" title="Verschieben"></div><div class="lss-win-min-btn" title="Minimieren">_</div>`;

            let $shell = $(`
                <div class="lss-window-shell" id="shell-${win.id.substring(1)}">
                    ${headerHTML}
                    <div class="lss-shell-content"></div>
                </div>
            `);

            $('body').append($shell);

            if (win.isMap) {
                $outer.detach().appendTo($shell.find('.lss-shell-content'));
                $outer.css({width: '100%', height: '100%', margin: 0, padding: 0});
            } else {
                $content.detach().appendTo($shell.find('.lss-shell-content'));
                $outer.remove();
                $content.css({ height: '100%', overflowY: 'auto', border: 'none', margin: 0 });
                $content.find('.panel-heading').css('margin-top', '0');
            }

            // 3. POSITIONIERUNG
            let finalPos = {};
            let usedHeaderHeight = win.isMap ? MAP_HEADER_HEIGHT : GRIP_HEIGHT;

            if (savedLayout && savedLayout[win.id]) {
                finalPos = savedLayout[win.id];
            } else {
                finalPos = {
                    top: task.originalPos.top - usedHeaderHeight,
                    left: task.originalPos.left,
                    width: task.originalPos.width,
                    height: task.originalPos.height + usedHeaderHeight
                };
            }

            $shell.css(finalPos);
            if(finalPos.minimized) $shell.addClass('lss-minimized');

            setupInteractions($shell, win.id, win.isMap);
        });
    }

    function setupInteractions($shell, storageId, isMap) {
        let handleSelector = isMap ? '.lss-map-header-full' : '.lss-grip-handle';

        $shell.draggable({
            handle: handleSelector,
            stack: '.lss-window-shell',
            snap: '.lss-window-shell',
            snapMode: 'outer',
            snapTolerance: SNAP_TOLERANCE,
            stop: function() { saveShell(storageId, $(this)); }
        });

        $shell.resizable({
            handles: 'se',
            minHeight: 60,
            minWidth: 200,
            stop: function() { saveShell(storageId, $(this)); },
            resize: function(e, ui) {
                if(isMap && typeof map !== "undefined" && map.invalidateSize) {
                    map.invalidateSize();
                }
            }
        });

        $shell.find('.lss-win-min-btn').on('click mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $shell.toggleClass('lss-minimized');
            if(isMap && !$shell.hasClass('lss-minimized')) {
                setTimeout(() => { if(typeof map !== "undefined" && map.invalidateSize) map.invalidateSize(); }, 200);
            }
            saveShell(storageId, $shell);
        });

        $shell.on('mousedown', function() {
            $('.lss-window-shell').css('z-index', 1000);
            $(this).css('z-index', 1001);
        });
    }

    function saveShell(id, $shell) {
        let currentData = GM_getValue(STORAGE_KEY, {});
        if (typeof currentData !== 'object') currentData = {};

        let pos = $shell.offset();
        currentData[id] = {
            top: pos.top,
            left: pos.left,
            width: $shell.outerWidth(),
            height: $shell.outerHeight(),
            minimized: $shell.hasClass('lss-minimized')
        };
        GM_setValue(STORAGE_KEY, currentData);
    }

    function addResetToProfileMenu() {
        let $menu = $('#menu_profile').parent().find('.dropdown-menu');
        if ($menu.length > 0 && $('#lss-reset-item').length === 0) {
            $menu.append('<li role="separator" class="divider"></li>');
            let $resetItem = $('<li id="lss-reset-item"><a href="#" style="color: #c9302c;"><span class="glyphicon glyphicon-refresh"></span> Layout Reset</a></li>');

            $resetItem.click(function(e) {
                e.preventDefault();
                if(confirm('Layout wirklich zurücksetzen?')) {
                    GM_setValue(STORAGE_KEY, null);
                    location.reload();
                }
            });
            $menu.append($resetItem);
        }
    }

})(jQuery);
