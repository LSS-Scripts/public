// ==UserScript==
// @name         LSS Flexible Grid (SmartLoad V15)
// @namespace    http://tampermonkey.net/
// @version      15.0
// @description  Befreit deine Leitstelle. Jetzt mit intelligentem Start-Mechanismus, der wartet, bis das Spiel wirklich bereit ist. Vergisst nie wieder deine Positionen! Mit Magnet-Funktion, Dark-Mode Scrollbars und Reset im Profil.
// @author       Gemini AI
// @match        https://www.leitstellenspiel.de/
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
    const STORAGE_KEY = 'lss_layout_v15_final'; // Neuer Key für sauberen Neustart
    const GRIP_HEIGHT = 12;
    const MAP_HEADER_HEIGHT = 30;
    const SNAP_TOLERANCE = 20;

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
        .lss-shell-content > div {
            scrollbar-width: thin;
            scrollbar-color: #555 #222;
        }
        .lss-shell-content > div::-webkit-scrollbar { width: 10px; }
        .lss-shell-content > div::-webkit-scrollbar-track { background: #222; }
        .lss-shell-content > div::-webkit-scrollbar-thumb {
            background-color: #555;
            border-radius: 6px;
            border: 2px solid #222;
        }
        .lss-shell-content > div::-webkit-scrollbar-thumb:hover { background-color: #777; }

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
        
        .lss-placeholder { visibility: hidden; pointer-events: none; }
        .ui-resizable-se {
            width: 15px; height: 15px;
            background: linear-gradient(135deg, transparent 50%, #555 50%);
            right: 0; bottom: 0; z-index: 1002 !important;
        }

        /* Snap Edges */
        .lss-snap-edge {
            position: fixed; background: transparent; z-index: -100; pointer-events: none;
        }
    `);

    $(document).ready(function() {
        $('head').append('<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">');
        
        // INTELLIGENTER START: Wir prüfen alle 100ms, ob das Spiel bereit ist
        let checkInterval = setInterval(function() {
            // Wir warten auf: Einsätze, Wachen, Chat, Funk und Map
            if ($('#missions_outer').length && $('#buildings_outer').length && $('#map_outer').length) {
                clearInterval(checkInterval);
                console.log("LSS FlexGrid: Spiel-Elemente gefunden, starte Initialisierung...");
                setTimeout(initLayout, 500); // Kurzer Sicherheitspuffer für Layout-Rendering
            }
        }, 100);
    });

    function initLayout() {
        createSnapEdges();
        addResetToProfileMenu();

        const windowsDef = [
            { id: '#missions', outer: '#missions_outer', title: 'Einsätze', isMap: false },
            { id: '#buildings', outer: '#buildings_outer', title: 'Wachen', isMap: false },
            { id: '#chat_panel', outer: '#chat_outer', title: 'Chat', isMap: false },
            { id: '#radio', outer: '#radio_outer', title: 'Funk', isMap: false },
            { id: '#map_outer', outer: '#map_outer', title: 'Karte', isMap: true }
        ];

        let savedLayout = GM_getValue(STORAGE_KEY, {});
        if (typeof savedLayout !== 'object' || savedLayout === null) savedLayout = {};

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

            // Placeholder
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

            // Prüfen, ob für DIESES Fenster gespeicherte Daten vorliegen
            if (savedLayout && savedLayout[win.id]) {
                finalPos = savedLayout[win.id];
            } else {
                // Keine Daten -> Nutze gemessene Startposition
                finalPos = {
                    top: task.originalPos.top - usedHeaderHeight, 
                    left: task.originalPos.left,
                    width: task.originalPos.width,
                    height: task.originalPos.height + usedHeaderHeight
                };
            }

            $shell.attr('data-expanded-height', finalPos.height);
            $shell.css({ top: finalPos.top, left: finalPos.left, width: finalPos.width });

            if(finalPos.minimized) {
                $shell.addClass('lss-minimized');
                $shell.css('height', ''); 
            } else {
                $shell.css('height', finalPos.height);
            }

            setupInteractions($shell, win.id, win.isMap);
        });
    }

    function createSnapEdges() {
        $('body').append(`
            <div class="lss-snap-edge" style="top: -10px; left: 0; width: 100%; height: 10px;"></div>
            <div class="lss-snap-edge" style="bottom: -10px; left: 0; width: 100%; height: 10px;"></div>
            <div class="lss-snap-edge" style="left: -10px; top: 0; width: 10px; height: 100%;"></div>
            <div class="lss-snap-edge" style="right: -10px; top: 0; width: 10px; height: 100%;"></div>
        `);
    }

    function setupInteractions($shell, storageId, isMap) {
        let handleSelector = isMap ? '.lss-map-header-full' : '.lss-grip-handle';

        $shell.draggable({
            handle: handleSelector,
            stack: '.lss-window-shell',
            snap: '.lss-window-shell, .lss-snap-edge', 
            snapMode: 'outer',
            snapTolerance: SNAP_TOLERANCE,
            stop: function() { saveShell(storageId, $(this)); }
        });

        $shell.resizable({
            handles: 'se',
            minHeight: 60,
            minWidth: 200,
            stop: function(e, ui) { 
                $(this).attr('data-expanded-height', ui.size.height);
                saveShell(storageId, $(this)); 
            },
            resize: function(e, ui) {
                if(isMap && typeof map !== "undefined" && map.invalidateSize) map.invalidateSize();

                // CUSTOM SNAP
                let $this = $(this);
                let myRight = ui.position.left + ui.size.width;
                let myBottom = ui.position.top + ui.size.height;
                
                $('.lss-window-shell').not($this).each(function() {
                    let $other = $(this);
                    let p = $other.offset();
                    let w = $other.outerWidth();
                    let h = $other.outerHeight();
                    let otherLeft = p.left;
                    let otherRight = p.left + w;
                    let otherTop = p.top;
                    let otherBottom = p.top + h;

                    if (Math.abs(myRight - otherLeft) < SNAP_TOLERANCE) ui.size.width = otherLeft - ui.position.left;
                    else if (Math.abs(myRight - otherRight) < SNAP_TOLERANCE) ui.size.width = otherRight - ui.position.left;

                    if (Math.abs(myBottom - otherTop) < SNAP_TOLERANCE) ui.size.height = otherTop - ui.position.top;
                    else if (Math.abs(myBottom - otherBottom) < SNAP_TOLERANCE) ui.size.height = otherBottom - ui.position.top;
                });

                let winW = $(window).width();
                let winH = $(window).height();
                if (Math.abs(myRight - winW) < SNAP_TOLERANCE) ui.size.width = winW - ui.position.left;
                if (Math.abs(myBottom - winH) < SNAP_TOLERANCE) ui.size.height = winH - ui.position.top;
                
                $this.css({ width: ui.size.width, height: ui.size.height });
            }
        });

        $shell.find('.lss-win-min-btn').on('click mousedown', function(e) {
            e.stopPropagation(); e.preventDefault();
            if ($shell.hasClass('lss-minimized')) {
                $shell.removeClass('lss-minimized');
                let oldHeight = $shell.attr('data-expanded-height');
                $shell.css('height', oldHeight ? oldHeight + 'px' : '400px');
                if(isMap) setTimeout(() => { if(typeof map !== "undefined" && map.invalidateSize) map.invalidateSize(); }, 200);
            } else {
                $shell.attr('data-expanded-height', $shell.outerHeight());
                $shell.addClass('lss-minimized');
                $shell.css('height', '');
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
        // Sicherheitscheck: Falls Rückgabewert kein Objekt ist
        if (typeof currentData !== 'object' || currentData === null) currentData = {};
        
        let pos = $shell.offset();
        let isMin = $shell.hasClass('lss-minimized');
        let saveHeight = isMin ? ($shell.attr('data-expanded-height') || 400) : $shell.outerHeight();

        currentData[id] = {
            top: pos.top,
            left: pos.left,
            width: $shell.outerWidth(),
            height: saveHeight,
            minimized: isMin
        };
        GM_setValue(STORAGE_KEY, currentData);
    }

    function addResetToProfileMenu() {
        // Wir nutzen setInterval um sicherzustellen, dass das Menü existiert
        let menuCheck = setInterval(function() {
            let $menu = $('#menu_profile').parent().find('.dropdown-menu');
            if ($menu.length > 0) {
                clearInterval(menuCheck);
                if ($('#lss-reset-item').length === 0) {
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
        }, 500);
    }

})(jQuery);
