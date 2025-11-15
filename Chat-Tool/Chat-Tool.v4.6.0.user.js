// ==UserScript==
// @name         LSS - Moderner Chat Pro (Blocker & Ladefunktion)
// @namespace    http://tampermonkey.net/
// @version      4.6.0 // Version erhöht und alle Positionierungsfehler behoben + /w Autocomplete
// @description  Kombiniert Messenger-Design (v3.0) mit Blocker & Ladefunktion (v3.5). NEU: Smiley-Auswahl, ASCII-Smiley-Konvertierung, Linkify & Bild-Vorschau/Modal (v4.4.9). NEU: @-Mention Autovervollständigung & /w Autovervollständigung (v4.5.6)
// @author       B&M & DeinName (Gemischt von Gemini)
// @match        https://*.leitstellenspiel.de/*
// @match        https://*.missionchief.com/*
// @match        https://*.missionchief.co.uk/*
// @match        https://*.meldkamerspel.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      leitstellenspiel.de
// @connect      missionchief.com
// @connect      missionchief.co.uk
// @connect      meldkamerspel.com
// ==/UserScript==

(async function() {
    'use strict';

    // === EINSTELLUNGS-SCHLÜSSEL ===
    const COLOR_STORAGE_KEY = 'LSS_ProChat_Settings';
    const BLOCKER_ENABLED_KEY = 'blocker_enabled';
    const BLOCKER_IDS_KEY = 'blocker_id_string';
    const AUTO_EXCLUDE_KEY = 'lss_auto_excluded_admins';
    // NEU: Schlüssel für die User-Liste
    const ALLIANCE_USERS_KEY = 'lss_alliance_users';
    const USERS_CACHE_TIME_KEY = 'lss_alliance_users_cache_time';
    const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 Stunden Cache-Dauer

    // === GLOBALE VARIABLEN ===
    let myUsername = null;
    let isDark = false;
    let currentSettings = {};
    let modalElement = null;
    let proChatTextarea = null;
    let smileyButton = null;
    let smileyContainer = null;
    let imageModal = null; // NEU: Image Modal Element
    let imageModalContent = null; // NEU: Image Modal Content Element

    // --- Blocker-Variablen ---
    let isBlockerEnabled = false;
    let blockedIdString = '';
    let blockedIdArray = [];
    let autoExcludedAdminIds = [];

    // --- Mention-Autovervollständigung Variablen (NEU) ---
    let allianceUsers = []; // Array der Usernamen
    let suggestionContainer = null;
    let selectedSuggestionIndex = -1;


    // --- Smilies Mapping (v4.4.7) ---
    const SMILEY_MAP = {
        ':)': '😊', // Happy
        ':-)': '😊',
        ':(': '🙁', // Sad
        ':-(': '🙁',
        ';)': '😉', // Wink
        ';-)': '😉',
        ':D': '😃', // Big Grin
        ':-D': '😃',
        'XD': '🤣', // Laughing
        'x)': '🤣',
        'xD': '😂',
        ':o': '😮', // Surprise
        ':-o': '😮',
        ':*': '😘', // Tongue out / Silly
        ':-*': '😘', // Tongue out / Silly
        'o.O': '🤔', // Think
        'O.o': '🤔',
        ':p': '🤪', // Tongue out / Silly
        ':P': '🤪', // Tongue out / Silly
        ':-p': '🤪',
        ':-P': '🤪', // Tongue out / Silly
        '8)': '😎', // Cool
        '8-)': '😎',
        '<3': '❤️', // Heart
        'O:)': '😇', // Angel
        'O:-)': '😇',
        '^^': '😀', // Cheeks
        ':/': '😒', // Unsatisfied
        ':-/': '😒',
        'T_T': '😭', // Crying
        ';(': '😢',
        ':\'(': '😢',
        ':|': '😐', // Neutral
        ':-|': '😐',
        '>:(': '😡', // Angry
        '>:-(': '😡',
        'B)': '🤓', // Nerd
        'B-)': '🤓',
        'P:': '💩', // Poop (reversed :P)
    };

    // --- Smilies für die Auswahl (v4.4.5) ---
    const UNICODE_SMILIES = [
        '😃', '😂', '🤣', '😉', '😊', '🤔', '😮', '🙁', '😡', '😢',
        '😭', '😈', '💩', '😍', '😘', '😎', '🤩', '🥳', '🥶', '🥵',
        '😴', '🤪', '🤭', '🤫', '🤥', '😬', '🤒', '🤕', '🤯', '😵',
        '💀', '👽', '🤖', '🤷', '😀', '😇', '😚', '😒', '😞', '😖',
        '🍕', '🍔', '🥐', '🌮', '🍪', '☕', '🍺', '🍾', '🥝', '🥢',
        '🥄', '🍼', '🍎', '🍇', '🍉', '🍌', '🍓', '🍒', '🥕', '🥔',
        '🚑', '🚒', '🚓', '🚁', '⛴️', '🏠', '🚗', '⌚', '📱', '💻',
        '💡', '🎤', '🎼', '🎲', '⚽', '🏀', '🎾', '🏖️', '✈️', '🚂',
        '🎁', '🎈', '💍', '📚', '🚀', '🛠️', '⚙️', '🔗', '🔒', '🔑',
        '🔨', '🔫', '💣', '🛡️', '⚔️', '💉', '💊', '💳', '⭐', '🎉',
        '📻', '📞', '📠', '📟', '💻', '🖨️', '🖱️', '🔋', '🔌', '🧲',
        '☝️', '👍', '👎', '🙏', '👋', '👏', '🖐️', '✋', '✊', '🤛',
        '🤜', '🤞', '✌️', '🤘', '🤙', '👈', '👉', '👆', '👇', 'OK'
    ];

    // --- Redesign-Farb-Defaults (v3.0) ---
    const defaultColors = {
        // --- Dark Mode Farben ---
        'dark_header_bg': '#2c2f33', 'dark_header_fg': '#f0f0f0', 'dark_header_border': '#40444b',
        'dark_body_bg': '#2c2f33', 'dark_body_fg': '#f0f0f0', 'dark_chat_bg': '#23272a', 'dark_chat_border': '#40444b',
        'dark_username_fg': '#ffffff', 'dark_timestamp_bg': '#40444b', 'dark_timestamp_fg': '#adafb3',
        'dark_my_bubble_bg': '#7289da', 'dark_my_bubble_fg': '#ffffff', 'dark_other_bubble_bg': '#36393f', 'dark_other_bubble_fg': '#dcddde',
        'dark_whisper_bg': '#403a30', 'dark_whisper_border': '#f0ad4e', 'dark_whisper_fg': '#dcddde',
        'dark_my_whisper_bg': '#594e3a', 'dark_my_whisper_fg': '#ffffff', 'dark_whisper_label_bg': '#f0ad4e', 'dark_whisper_label_fg': '#ffffff',
        'dark_mention_bg': '#f0ad4e', 'dark_mention_fg': '#332b1f', 'dark_my_mention_bubble_bg': '#593a3a',
        'dark_my_mention_bubble_border': '#e53e3e', 'dark_my_mention_bubble_fg': '#f0f0f0', 'dark_input_bg': '#40444b',
        'dark_input_fg': '#f0f0f0', 'dark_input_focus_bg': '#4a4f56', 'dark_input_focus_shadow': 'rgba(114, 137, 218, 0.7)',
        'dark_input_addon_bg': '#7289da', 'dark_input_addon_fg': '#ffffff', 'dark_scrollbar_track': '#23272a',
        'dark_scrollbar_thumb': '#40444b', 'dark_scrollbar_thumb_hover': '#555a63', 'dark_ban_bg': '#d9534f', 'dark_ban_fg': '#ffffff',
        'dark_icon_bg_hover': '#40444b',
        // NEU: Einsatz-Hervorhebung
        'dark_mission_bg': '#5865f2', // Discord-Lila/Blau
        'dark_mission_fg': '#ffffff',
        'dark_mission_border': '#4e5bd0',
        'dark_mission_icon_fg': '#ffffff',
        // --- Light Mode Farben ---
        'light_header_bg': '#f9f9f9', 'light_header_fg': '#333333', 'light_header_border': '#dce1e6',
        'light_body_bg': '#f0f4f7', 'light_body_fg': '#111111', 'light_chat_bg': '#e5eef3', 'light_chat_border': '#dce1e6',
        'light_username_fg': '#111111', 'light_timestamp_bg': '#dce1e6', 'light_timestamp_fg': '#555555',
        'light_my_bubble_bg': '#007bff', 'light_my_bubble_fg': '#ffffff', 'light_other_bubble_bg': '#ffffff', 'light_other_bubble_fg': '#222222',
        'light_whisper_bg': '#fcf8e3', 'light_whisper_border': '#f0ad4e', 'light_whisper_fg': '#664d03',
        'light_my_whisper_bg': '#fff4cc', 'light_my_whisper_fg': '#664d03', 'light_whisper_label_bg': '#f0ad4e', 'light_whisper_label_fg': '#ffffff',
        'light_mention_bg': '#fff4cc', 'light_mention_fg': '#664d03', 'light_mention_border': '#ffe69c',
        'light_my_mention_bubble_bg': '#fce3e3', 'light_my_mention_bubble_border': '#e53e3e', 'light_my_mention_bubble_fg': '#632b2b',
        'light_input_bg': '#ffffff', 'light_input_fg': '#333333', 'light_input_border': '#dce1e6', 'light_input_focus_border': '#007bff',
        'light_input_focus_shadow': 'rgba(0, 123, 255, 0.5)', 'light_input_addon_bg': '#007bff', 'light_input_addon_fg': '#ffffff',
        'light_scrollbar_track': '#e5eef3', 'light_scrollbar_thumb': '#b0c0ce', 'light_scrollbar_thumb_hover': '#98a9b9',
        'light_ban_bg': '#f2dede', 'light_ban_fg': '#a94442', 'light_ban_border': '#ebccd1', 'light_icon_bg_hover': '#dce1e6',
        // NEU: Einsatz-Hervorhebung
        'light_mission_bg': '#e6f0ff', // Helles Blau
        'light_mission_fg': '#0056b3',
        'light_mission_border': '#b3d1ff',
        'light_mission_icon_fg': '#007bff',
    };

    // === BILD-MODAL FUNKTIONEN (NEU: v4.4.9) ===

    /**
     * Erstellt das Bild-Anzeige-Modal (einmalig)
     */
    function createImageModal() {
        if (imageModal) return;

        imageModal = document.createElement('div');
        imageModal.id = 'proChatImageModal';
        imageModal.className = 'pro-chat-modal-image';
        imageModal.style.display = 'none';
        imageModal.innerHTML = `
            <div class="pro-chat-modal-image-content">
                <span id="proChatImageModalCloseBtn" class="pro-chat-modal-image-close">&times;</span>
                <img id="proChatImageModalImage" src="" alt="Vollbild-Vorschau">
                <a id="proChatImageModalLink" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Originalbild öffnen</a>
            </div>
        `;
        document.body.appendChild(imageModal);
        imageModalContent = document.getElementById('proChatImageModalImage');

        document.getElementById('proChatImageModalCloseBtn').onclick = closeImageModal;
        imageModal.onclick = (event) => {
            if (event.target === imageModal) {
                closeImageModal();
            }
        };
    }

    /**
     * Öffnet das Bild-Modal
     */
    function openImageModal(imageUrl) {
        if (!imageModal || !imageModalContent) createImageModal();

        imageModalContent.src = imageUrl;
        document.getElementById('proChatImageModalLink').href = imageUrl;
        imageModal.style.display = 'flex';
    }

    /**
     * Schließt das Bild-Modal
     */
    function closeImageModal() {
        if (imageModal) {
            imageModal.style.display = 'none';
            imageModalContent.src = ''; // Zurücksetzen zur Freigabe des Speichers
        }
    }


    // === EINSTELLUNGS-FUNKTIONEN ===

    /**
     * Öffnet das Einstellungs-Modal
     */
    function openSettingsModal() {
        if (modalElement) modalElement.style.display = 'block';
    }

    /**
     * Lädt SOWOHL Farb- als auch Blocker-Einstellungen
     */
    async function loadSettings() {
        isBlockerEnabled = await GM_getValue(BLOCKER_ENABLED_KEY, false);
        blockedIdString = await GM_getValue(BLOCKER_IDS_KEY, '');
        blockedIdArray = parseIdString(blockedIdString);
        autoExcludedAdminIds = await GM_getValue(AUTO_EXCLUDE_KEY, []);
        try {
            const saved = JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY));
            currentSettings = { ...defaultColors, ...saved };
        } catch (e) {
            currentSettings = { ...defaultColors };
        }
    }

    /**
     * Speichert die Farb-Einstellungen (LocalStorage)
     */
    function saveChatSettings(settings) {
        currentSettings = settings;
        localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(settings));
    }

    /**
     * Wendet die Farben als CSS-Variablen an
     */
    function applyChatSettings(settings) {
        let cssVariables = ':root {\n';
        for (const [key, value] of Object.entries(settings)) {
            cssVariables += `    --color-${key.replace(/_/g, '-')}: ${value};\n`;
        }
        cssVariables += '}';
        const oldStyle = document.getElementById('pro-chat-dynamic-styles');
        if (oldStyle) oldStyle.remove();
        const styleSheet = document.createElement("style");
        styleSheet.id = 'pro-chat-dynamic-styles';
        styleSheet.type = "text/css";
        styleSheet.innerText = cssVariables;
        document.head.appendChild(styleSheet);
    }

    /**
     * Speichert die Blocker-ID-Liste (GM)
     */
    async function saveBlockedIds() {
        blockedIdString = blockedIdArray.join(',');
        await GM_setValue(BLOCKER_IDS_KEY, blockedIdString);
    }

    /**
     * Speichert die Auto-Admin-Liste (GM)
     */
    async function saveAutoExcludedAdminIds() {
        await GM_setValue(AUTO_EXCLUDE_KEY, autoExcludedAdminIds);
    }

    /**
     * Parst den ID-String zu einem Array
     */
    function parseIdString(str) {
        if (!str) return [];
        return str.split(',')
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id));
    }

    /**
     * Erstellt das KOMBINIERTE Einstellungs-Modal
     */
    function createSettingsUI() {
        // Helper zum Erstellen einer Farb-Einstellungszeile
        function createSettingRow(key, label) {
            const wrapper = document.createElement('div');
            wrapper.className = 'pro-chat-setting-row';
            wrapper.innerHTML = `
                <label for="color_${key}">${label}</label>
                <input type="color" id="color_${key}" value="${currentSettings[key]}">
                <button type="button" class="pro-chat-reset-btn" title="Zurücksetzen">&#8634;</button>
            `;
            wrapper.querySelector('input[type="color"]').addEventListener('input', (e) => {
                const newSettings = { ...currentSettings, [key]: e.target.value };
                applyChatSettings(newSettings);
                saveChatSettings(newSettings);
            });
            wrapper.querySelector('.pro-chat-reset-btn').addEventListener('click', () => {
                const defaultValue = defaultColors[key];
                const newSettings = { ...currentSettings, [key]: defaultValue };
                wrapper.querySelector('input[type="color"]').value = defaultValue;
                applyChatSettings(newSettings);
                saveChatSettings(newSettings);
            });
            return wrapper;
        }

        // 1. Erstelle das Modal-Fenster
        const modal = document.createElement('div');
        modal.id = 'proChatSettingsModal';
        modalElement = modal;
        modal.innerHTML = `
            <div class="pro-chat-modal-content">
                <div class="pro-chat-modal-header">
                    <h3 style="margin: 0;">Chat-Einstellungen (Pro v4.5.6)</h3>
                    <button id="proChatCloseBtn" class="pro-chat-close-btn" title="Schließen">&times;</button>
                </div>
                <div class="pro-chat-modal-body">
                    <details open>
                        <summary>User-Blocker</summary>
                        <fieldset>
                            <legend>Blocker-Steuerung</legend>
                            <div class="pro-chat-setting-row" style="grid-template-columns: auto 1fr auto;">
                                <label for="lss_blocker_modal_toggle" style="font-weight:bold;">User-Blocker aktiv:</label>
                                ${createBlockerToggleHTML('lss_blocker_modal_toggle')}
                                </div>
                        </fieldset>
                        <fieldset>
                            <legend>Geblockte IDs</legend>
                            <div class="pro-chat-setting-row" style="grid-template-columns: 1fr auto;">
                                <input type="text" id="lss_blocker_id_input" placeholder="Profil-ID eingeben...">
                                <button id="lss_blocker_id_add_btn">Hinzufügen</button>
                            </div>
                            <ul id="lss_blocker_id_list"></ul>
                        </fieldset>
                    </details>
                    <details>
                        <summary>Dark Mode Farben</summary>
                        <fieldset><legend>Allgemein</legend><div id="settings-group-dark-general"></div></fieldset>
                        <fieldset><legend>Standard-Blasen</legend><div id="settings-group-dark-bubbles"></div></fieldset>
                        <fieldset><legend>Flüstern & Erwähnungen</legend><div id="settings-group-dark-whisper"></div></fieldset>
                        <fieldset><legend>Eingabefeld & Scrollbar</legend><div id="settings-group-dark-input"></div></fieldset>
                    </details>
                    <details>
                        <summary>Light Mode Farben</summary>
                        <fieldset><legend>Allgemein</legend><div id="settings-group-light-general"></div></fieldset>
                        <fieldset><legend>Standard-Blasen</legend><div id="settings-group-light-bubbles"></div></fieldset>
                        <fieldset><legend>Flüstern & Erwähnungen</legend><div id="settings-group-light-whisper"></div></fieldset>
                        <fieldset><legend>Eingabefeld & Scrollbar</legend><div id="settings-group-light-input"></div></fieldset>
                    </details>
                </div>
                <div class="pro-chat-modal-footer">
                    <button id="proChatResetAllBtn">Alle Farben zurücksetzen</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 2. Füge die Farb-Einstellungs-Zeilen hinzu (Volle Listen)
        const groups = {
            'settings-group-dark-general': [
                { key: 'dark_header_bg', label: 'Header-Hintergrund' }, { key: 'dark_header_fg', label: 'Header-Text' },
                { key: 'dark_chat_bg', label: 'Chat-Hintergrund' }, { key: 'dark_username_fg', label: 'Name (Andere)' },
                { key: 'dark_timestamp_bg', label: 'Zeitstempel-Hintergrund' }, { key: 'dark_timestamp_fg', label: 'Zeitstempel-Text' },
                { key: 'dark_ban_bg', label: 'Ban-Info Hintergrund' }, { key: 'dark_ban_fg', label: 'Ban-Info Text' },
            ],
            'settings-group-dark-bubbles': [
                { key: 'dark_my_bubble_bg', label: 'Meine Blase (Hintergrund)' }, { key: 'dark_my_bubble_fg', label: 'Meine Blase (Text)' },
                { key: 'dark_other_bubble_bg', label: 'Andere Blase (Hintergrund)' }, { key: 'dark_other_bubble_fg', label: 'Andere Blase (Text)' },
            ],
            'settings-group-dark-whisper': [
                { key: 'dark_whisper_bg', label: 'Flüstern-Blase (Hintergrund)' }, { key: 'dark_whisper_fg', label: 'Flüstern-Blase (Text)' },
                { key: 'dark_whisper_border', label: 'Flüstern-Blase (Rand)' }, { key: 'dark_my_whisper_bg', label: 'Eigene Flüstern-Blase (BG)' },
                { key: 'dark_my_whisper_fg', label: 'Eigene Flüstern-Blase (Text)' }, { key: 'dark_whisper_label_bg', label: 'Flüstern-Label (Hintergrund)' },
                { key: 'dark_whisper_label_fg', label: 'Flüstern-Label (Text)' }, { key: 'dark_my_mention_bubble_bg', label: 'Eigene @-Blase (Hintergrund)' },
                { key: 'dark_my_mention_bubble_fg', label: 'Eigene @-Blase (Text)' }, { key: 'dark_my_mention_bubble_border', label: 'Eigene @-Blase (Rand)' },
                { key: 'dark_mention_bg', label: 'Text-Mention (Hintergrund)' }, { key: 'dark_mention_fg', label: 'Text-Mention (Text)' },
                { key: 'dark_mission_bg', label: 'Einsatz-Link (Hintergrund)' },
                { key: 'dark_mission_fg', label: 'Einsatz-Link (Text)' },
                { key: 'dark_mission_border', label: 'Einsatz-Link (Rand)' },
                { key: 'dark_mission_icon_fg', label: 'Einsatz-Link (Icon)' },
            ],
            'settings-group-dark-input': [
                { key: 'dark_input_bg', label: 'Eingabefeld (Hintergrund)' }, { key: 'dark_input_fg', label: 'Eingabefeld (Text)' },
                { key: 'dark_input_addon_bg', label: 'Senden-Button (Hintergrund)' }, { key: 'dark_input_addon_fg', label: 'Senden-Button (Text)' },
                { key: 'dark_input_focus_bg', label: 'Eingabefeld (Fokus-BG)' }, { key: 'dark_input_focus_shadow', label: 'Eingabefeld (Fokus-Schatten)' },
                { key: 'dark_scrollbar_track', label: 'Scrollbar (Track)' }, { key: 'dark_scrollbar_thumb', label: 'Scrollbar (Thumb)' },
                { key: 'dark_icon_bg_hover', label: 'Icon-Hover (Hintergrund)' },
            ],
            'settings-group-light-general': [
                { key: 'light_header_bg', label: 'Header-Hintergrund' }, { key: 'light_header_fg', label: 'Header-Text' },
                { key: 'light_chat_bg', label: 'Chat-Hintergrund' }, { key: 'light_username_fg', label: 'Name (Andere)' },
                { key: 'light_timestamp_bg', label: 'Zeitstempel-Hintergrund' }, { key: 'light_timestamp_fg', label: 'Zeitstempel-Text' },
                { key: 'light_ban_bg', label: 'Ban-Info Hintergrund' }, { key: 'light_ban_fg', label: 'Ban-Info Text' }, { key: 'light_ban_border', label: 'Ban-Info Rand' },
            ],
            'settings-group-light-bubbles': [
                { key: 'light_my_bubble_bg', label: 'Meine Blase (Hintergrund)' }, { key: 'light_my_bubble_fg', label: 'Meine Blase (Text)' },
                { key: 'light_other_bubble_bg', label: 'Andere Blase (Hintergrund)' }, { key: 'light_other_bubble_fg', label: 'Andere Blase (Text)' },
            ],
            'settings-group-light-whisper': [
                { key: 'light_whisper_bg', label: 'Flüstern-Blase (Hintergrund)' }, { key: 'light_whisper_fg', label: 'Flüstern-Blase (Text)' },
                { key: 'light_whisper_border', label: 'Flüstern-Blase (Rand)' }, { key: 'light_my_whisper_bg', label: 'Eigene Flüstern-Blase (BG)' },
                { key: 'light_my_whisper_fg', label: 'Eigene Flüstern-Blase (Text)' }, { key: 'light_whisper_label_bg', label: 'Flüstern-Label (Hintergrund)' },
                { key: 'light_whisper_label_fg', label: 'Flüstern-Label (Text)' }, { key: 'light_my_mention_bubble_bg', label: 'Eigene @-Blase (Hintergrund)' },
                { key: 'light_my_mention_bubble_fg', label: 'Eigene @-Blase (Text)' }, { key: 'light_my_mention_bubble_border', label: 'Eigene @-Blase (Rand)' },
                { key: 'light_mention_bg', label: 'Text-Mention (Hintergrund)' }, { key: 'light_mention_fg', label: 'Text-Mention (Text)' }, { key: 'light_mention_border', label: 'Text-Mention (Rand)' },
                { key: 'light_mission_bg', label: 'Einsatz-Link (Hintergrund)' },
                { key: 'light_mission_fg', label: 'Einsatz-Link (Text)' },
                { key: 'light_mission_border', label: 'Einsatz-Link (Rand)' },
                { key: 'light_mission_icon_fg', label: 'Einsatz-Link (Icon)' },
            ],
            'settings-group-light-input': [
                { key: 'light_input_bg', label: 'Eingabefeld (Hintergrund)' }, { key: 'light_input_fg', label: 'Eingabefeld (Text)' }, { key: 'light_input_border', label: 'Eingabefeld (Rand)' },
                { key: 'light_input_addon_bg', label: 'Senden-Button (Hintergrund)' }, { key: 'light_input_addon_fg', label: 'Senden-Button (Text)' },
                { key: 'light_input_focus_border', label: 'Eingabefeld (Fokus-Rand)' }, { key: 'light_input_focus_shadow', label: 'Eingabefeld (Fokus-Schatten)' },
                { key: 'light_scrollbar_track', label: 'Scrollbar (Track)' }, { key: 'light_scrollbar_thumb', label: 'Scrollbar (Thumb)' }, { key: 'light_icon_bg_hover', label: 'Icon-Hover (Hintergrund)' },
            ]
        };
        for (const [groupId, settingsList] of Object.entries(groups)) {
            const container = document.getElementById(groupId);
            if (container) {
                settingsList.forEach(setting => {
                    container.appendChild(createSettingRow(setting.key, setting.label));
                });
            }
        }

        // 3. Erstelle Controls im Chat-Header
        const chatHeader = document.getElementById('chat_panel_heading');
        if (chatHeader) {
            const leftControls = document.createElement('div');
            leftControls.className = 'pro-chat-header-controls-left';

            const settingsButton = document.createElement('button');
            settingsButton.className = 'btn btn-default btn-xs';
            settingsButton.title = 'Chat-Einstellungen';
            settingsButton.innerHTML = '<span class="glyphicon glyphicon-cog"></span>';
            settingsButton.id = 'proChatSettingsBtn';
            settingsButton.addEventListener('click', openSettingsModal);

            const headerToggle = createBlockerToggle('lss_blocker_header_toggle', 'lss-switch-xs');

            const headerCountSpan = document.createElement('span');
            headerCountSpan.id = 'lss_blocker_header_count';
            headerCountSpan.className = 'lss-blocker-count'; // Wichtig für CSS-Selektor
            headerCountSpan.textContent = ''; // Initial leer

            leftControls.appendChild(settingsButton);
            leftControls.appendChild(headerToggle);
            leftControls.appendChild(headerCountSpan);

            chatHeader.prepend(leftControls);
        }

        // 4. Event-Listener für Modal
        document.getElementById('proChatCloseBtn').addEventListener('click', () => {
            modalElement.style.display = 'none';
        });
        document.getElementById('proChatResetAllBtn').addEventListener('click', () => {
            if (confirm('Möchtest du wirklich alle Farben auf die Standardwerte zurücksetzen? (Blocker-Einstellungen bleiben erhalten)')) {
                saveChatSettings(defaultColors);
                applyChatSettings(defaultColors);
                modalElement.style.display = 'none';
                document.getElementById('proChatSettingsModal').remove();
                createSettingsUI();
                openSettingsModal();
            }
        });
        window.addEventListener('click', (event) => {
            if (event.target == modalElement) modalElement.style.display = 'none';
        });

        // 5. Event-Listener für Blocker-UI im Modal
        const blockerToggle = document.getElementById('lss_blocker_modal_toggle');
        if (blockerToggle) {
             blockerToggle.checked = isBlockerEnabled;
             blockerToggle.addEventListener('change', handleToggleChange);
        }
        document.getElementById('lss_blocker_id_add_btn').addEventListener('click', addBlockedId);
        document.getElementById('lss_blocker_id_input').addEventListener('keypress', (e) => { if (e.key === 'Enter') addBlockedId(); });

        populateBlockerList();
    } // Ende createSettingsUI

    // === BLOCKER-UI-FUNKTIONEN ===

    /**
     * Erzeugt einen Toggle-Switch als HTML-String
     */
    function createBlockerToggleHTML(id, extraClass = '') {
        return `
            <label class="lss-switch ${extraClass}" title="User-Blocker An/Aus" style="margin-right: auto;">
                <input type="checkbox" id="${id}" ${isBlockerEnabled ? 'checked' : ''}>
                <span class="lss-slider"></span>
            </label>
        `;
    }

    /**
     * Erzeugt ein Toggle-Switch-Element
     */
    function createBlockerToggle(id, extraClass = '') {
        const toggleLabel = document.createElement('label');
        toggleLabel.className = `lss-switch ${extraClass}`;
        toggleLabel.title = 'User-Blocker An/Aus';
        toggleLabel.style.margin = '0';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = id;
        toggleInput.checked = isBlockerEnabled;

        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'lss-slider';

        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(toggleSlider);

        toggleInput.addEventListener('change', handleToggleChange);
        return toggleLabel;
    }

    /**
     * Erstellt die UI-Leiste für die Allianz-Chat-Seite
     */
    function createAllianceChatUI(targetH3) {
        if (!targetH3 || document.getElementById('lss_alliance_chat_controls')) return;

        const controlWrapper = document.createElement('div');
        controlWrapper.className = 'lss-alliance-chat-controls';
        controlWrapper.id = 'lss_alliance_chat_controls';

        const textLabel = document.createElement('label');
        textLabel.className = 'lss-blocker-label';
        textLabel.setAttribute('for', 'lss_blocker_alliance_toggle');
        textLabel.textContent = 'User-Blocker:';

        const toggle = createBlockerToggle('lss_blocker_alliance_toggle');

        const allianceCountSpan = document.createElement('span');
        allianceCountSpan.id = 'lss_blocker_alliance_count';
        allianceCountSpan.className = 'lss-blocker-count'; // Wichtig für CSS-Selektor
        allianceCountSpan.textContent = ''; // Initial leer

        const settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.className = 'btn btn-default btn-xs';
        settingsBtn.title = 'Chat-Einstellungen';
        settingsBtn.innerHTML = '<span class="glyphicon glyphicon-cog"></span>';
        settingsBtn.addEventListener('click', openSettingsModal);

        controlWrapper.appendChild(textLabel);
        controlWrapper.appendChild(toggle);
        controlWrapper.appendChild(allianceCountSpan);
        controlWrapper.appendChild(settingsBtn);

        targetH3.parentNode.insertBefore(controlWrapper, targetH3.nextSibling);
    }

    /**
     * Reagiert auf ALLE Blocker-Toggle-Schalter und synchronisiert sie
     */
    async function handleToggleChange(e) {
        isBlockerEnabled = e.target.checked;
        await GM_setValue(BLOCKER_ENABLED_KEY, isBlockerEnabled);

        // Synchronisiere alle 3 Toggles
        const modalToggle = document.getElementById('lss_blocker_modal_toggle');
        if (modalToggle) modalToggle.checked = isBlockerEnabled;

        const headerToggle = document.getElementById('lss_blocker_header_toggle');
        if (headerToggle) headerToggle.checked = isBlockerEnabled;

        const allianceToggle = document.getElementById('lss_blocker_alliance_toggle');
        if (allianceToggle) allianceToggle.checked = isBlockerEnabled;

        // Wende den neuen Status auf alle Nachrichten an UND aktualisiere Zähler
        applyBlockStatusToAllElements();
    }

    /**
     * Füllt die Blocker-Liste im Modal
     */
    function populateBlockerList() {
        const listElement = document.getElementById('lss_blocker_id_list');
        if (!listElement) return;
        listElement.innerHTML = '';
        if (blockedIdArray.length === 0) {
            listElement.innerHTML = '<li>Keine IDs geblockt.</li>'; return;
        }
        blockedIdArray.forEach(id => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${id}</span> <button data-id="${id}" class="lss_blocker_id_remove_btn">Löschen</button>`;
            listElement.appendChild(li);
        });
        listElement.querySelectorAll('.lss_blocker_id_remove_btn').forEach(button => {
            button.addEventListener('click', removeBlockedId);
        });
    }

    /**
     * Fügt eine ID zur Blocker-Liste hinzu
     */
    function addBlockedId() {
        const inputElement = document.getElementById('lss_blocker_id_input');
        if (!inputElement) return;
        const idToAdd = inputElement.value.trim();
        if (!/^\d+$/.test(idToAdd)) { alert('Bitte eine gültige, numerische ID eingeben.'); return; }
        if (blockedIdArray.includes(idToAdd)) { alert('Diese ID ist bereits in der Liste.'); return; }
        if (autoExcludedAdminIds.includes(idToAdd)) {
             alert(`Benutzer ${idToAdd} ist ein Admin und kann nicht geblockt werden.`); inputElement.value = ''; return;
        }
        blockedIdArray.push(idToAdd);
        saveBlockedIds();
        populateBlockerList();
        inputElement.value = ''; inputElement.focus();
        applyBlockStatusToAllElements(); // Wende Änderung an UND aktualisiert Zähler
    }

    /**
     * Entfernt eine ID aus der Blocker-Liste
     */
    function removeBlockedId(event) {
        const idToRemove = event.target.dataset.id;
        blockedIdArray = blockedIdArray.filter(id => id !== idToRemove);
        saveBlockedIds();
        populateBlockerList();
        applyBlockStatusToAllElements(); // Wende Änderung an UND aktualisiert Zähler
    }


    // === REDESIGN- & BLOCKER-LOGIK ===

    /**
     * Holt den eigenen Benutzernamen
     */
    function getMyUsername() {
        const profileLink = document.getElementById('navbar_profile_link');
        return profileLink ? profileLink.innerText.trim() : null;
    }

    /**
     * Erzeugt eine konsistente Farbe für jeden Benutzernamen
     */
    function getUsernameColor(username, isDark) {
        let hash = 0;
        if (!username || username.length === 0) return isDark ? 'hsl(0, 70%, 75%)' : 'hsl(0, 60%, 45%)';
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash;
        }
        const h = hash % 360;
        const s = isDark ? '70%' : '60%';
        const l = isDark ? '75%' : '45%';
        return `hsl(${h}, ${s}, ${l})`;
    }

    /**
     * Erkennt Admins anhand der CSS-Klasse und fügt sie zur Ausschlussliste hinzu
     */
    function detectAndExcludeAdmin(linkElement) {
        if (linkElement.matches('.chat-username-dark.label.label-info, .chat-username.chat-username-dark')) {
            const profileId = linkElement.href.split('/').pop();
            if (profileId && /^\d+$/.test(profileId) && !autoExcludedAdminIds.includes(profileId)) {
                console.log(`[ChatPro] Admin erkannt: ${profileId}`);
                autoExcludedAdminIds.push(profileId);
                saveAutoExcludedAdminIds();
            }
        }
    }

    /**
     * Findet das Elternelement, das ausgeblendet werden soll
     */
    function findHidableElement(elementContainingLink) {
        if (!elementContainingLink) return null;
        const well = elementContainingLink.closest('.well[data-message-time]'); if (well) return well;
        const mainChatLi = elementContainingLink.closest('li[data-message-time]'); if (mainChatLi) return mainChatLi;
        const chatRow = elementContainingLink.closest('.chat-message-row'); if (chatRow) return chatRow;
        const tableRow = elementContainingLink.closest('tr'); if (tableRow) return tableRow;
        const forumPost = elementContainingLink.closest('.forum_post'); if (forumPost) return forumPost;
        const missionShare = elementContainingLink.closest('.mission_list_siver'); if (missionShare) return missionShare;
        const generalLi = elementContainingLink.closest('li');
         if (generalLi && generalLi.contains(elementContainingLink) && generalLi.querySelector('a[href^="/profile/"]') === elementContainingLink) return generalLi;
        let parent = elementContainingLink.parentNode;
        if (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') return parent;
        return null;
    }

    /**
     * Blendet ein Element aus
     */
    function hideElement(element) {
        if (element && !element.hasAttribute('data-lss-blocked')) {
            element.style.setProperty('display', 'none', 'important');
            element.dataset.lssBlocked = 'true';
        }
    }

    /**
     * Blendet ein Element wieder ein
     */
    function showElement(element) {
        if (element && element.hasAttribute('data-lss-blocked')) {
            element.style.removeProperty('display');
            element.removeAttribute('data-lss-blocked');
        }
    }

    /**
     * Prüft, ob ein Benutzer geblockt werden soll
     */
     function shouldBlockUser(profileId) {
        if (!profileId) return false;
        if (autoExcludedAdminIds.includes(profileId)) return false;
        return isBlockerEnabled && blockedIdArray.includes(profileId);
    }

    /**
     * Konvertiert URLs im Text in klickbare Links mit target="_blank".
     * @param {string} text Der Rohtext der Nachricht.
     * @returns {string} Der Text mit konvertierten Links.
     */
    function linkifyText(text) {
        // Regex für URLs (unterstützt http(s)://, www. und URLs ohne Präfix, aber mit Domain-Endung)
        const urlRegex = /(\b(?:https?:\/\/\S+|www\.\S+\.[a-z]{2,}(?:\S+)?|\S+\.[a-z]{2,}(?:\/\S*)?))/gi;
        const imageExtensions = /\.(png|jpe?g|gif|bmp|webp|tiff|svg)$/i;

        return text.replace(urlRegex, (url) => {
            let href = url;
            // Füge https:// hinzu, wenn es fehlt (z.B. bei www.example.de)
            if (!url.match(/^https?:\/\//i)) {
                href = 'https://' + url;
            }

            // **Wenn es ein Bildlink ist, erstelle eine Vorschau**
            if (href.match(imageExtensions)) {
                 return `<span class="pro-chat-image-preview-container" data-image-url="${href}">
                             <img src="${href}" class="pro-chat-image-preview" alt="Bildvorschauklick">
                         </span>`;
            }

            // Normaler Link
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

/**
     * NEUE FUNKTION: Konvertiert getippte ASCII-Smileys LIVE in Unicode-Emojis (v4.5.7)
     * Diese Funktion ersetzt die alte 'on-send'-Konvertierung und wird im 'input'-Listener aufgerufen.
     */
    function convertAsciiToUnicode() {
        if (!proChatTextarea) return; // Stelle sicher, dass das Textfeld existiert

        const cursorPosition = proChatTextarea.selectionStart;
        // Nur ausführen, wenn der Cursor an einer Stelle ist (keine Auswahl)
        if (cursorPosition !== proChatTextarea.selectionEnd) return;

        const text = proChatTextarea.value;
        const preCursorText = text.substring(0, cursorPosition);

        // Sortierte Schlüssel (längste zuerst), wie in der alten Funktion
        const sortedKeys = Object.keys(SMILEY_MAP).sort((a, b) => b.length - a.length);

        for (const ascii of sortedKeys) {
            // Prüfe, ob der Text vor dem Cursor mit einem ASCII-Smiley endet
            if (preCursorText.endsWith(ascii)) {
                
                // Wort-Grenze prüfen
                const prevCharIndex = cursorPosition - ascii.length - 1;
                const prevChar = prevCharIndex >= 0 ? text[prevCharIndex] : null;
                const isWordChar = (char) => char && /\w/.test(char);

                if (isWordChar(prevChar)) {
                    continue; // Ist Teil eines Wortes (z.B. "meineFunktion(:)"), nicht ersetzen
                }

                // Ersetzung durchführen
                const unicode = SMILEY_MAP[ascii];
                const textBefore = text.substring(0, cursorPosition - ascii.length);
                const textAfter = text.substring(cursorPosition);

                // Wert im Textfeld aktualisieren
                proChatTextarea.value = textBefore + unicode + textAfter;

                // Cursor-Position neu setzen (hinter das Unicode-Emoji)
                const newCursorPos = textBefore.length + unicode.length;
                proChatTextarea.selectionStart = newCursorPos;
                proChatTextarea.selectionEnd = newCursorPos;

                // Wichtig: Nur eine Ersetzung pro Tastendruck, dann abbrechen
                return; 
            }
        }
        // Kein return-Wert mehr nötig, da die Funktion direkt das Textfeld ändert.
    }


    // --- KOMBINIERTE VERARBEITUNGS-FUNKTIONEN ---

    /**
     * Wendet das Messenger-Design auf eine NACHRICHT IM HAUPTCHAT an (AKTUALISIERT v4.4.8)
     */
    function processMainChatMessage(node) {
        if (node.dataset.proChatFormatted) return;
        if (node.nodeType !== 1 || node.tagName !== 'LI') return;
        const usernameSpan = node.querySelector('.mission_chat_message_username');
        if (!usernameSpan) return;

        // 1. Timestamp Bubble
        const firstChild = usernameSpan.firstChild;
        if (firstChild && firstChild.nodeType === 3 && firstChild.textContent.includes('[')) {
            const text = firstChild.textContent.trim().replace(/[\[\]]/g, '');
            const bubble = document.createElement('span');
            bubble.className = 'chat-timestamp-bubble';
            bubble.textContent = text;
            firstChild.replaceWith(bubble);
        }

        // 2. Tooltip-Entferner
        node.querySelectorAll('img.alliance_chat_copy_username, a.alliance_chat_private_username, img.alliance_chat_private_username').forEach(el => {
            el.setAttribute('title', '');
        });

        // 3. Sender/Empfänger & Icon-Handling
        const usernameLink = usernameSpan.querySelector('a.chat-username');
        if (usernameLink) {
            const username = usernameLink.innerText.replace(':', '').trim();
            const color = getUsernameColor(username, isDark);
            usernameLink.style.color = color;
            if (myUsername && username === myUsername) {
                node.classList.add('chat-message-own');
                const myReplyIcon = usernameSpan.querySelector('img.alliance_chat_copy_username');
                const myWhisperLink = usernameSpan.querySelector('a.alliance_chat_private_username');
                if (myReplyIcon) myReplyIcon.style.display = 'none';
                if (myWhisperLink) myWhisperLink.style.display = 'none';
            } else {
                node.classList.add('chat-message-other');
            }
        }

        // 4. Whisper-Empfänger
        if (node.classList.contains('chatWhisper')) {
            const recipientIcon = node.querySelector(':scope > a.alliance_chat_private_username');
            const recipientLabel = node.querySelector(':scope > a.whisper-label');
            const recipientStatus = node.querySelector(':scope > span.chat-status-bubble');
            if (recipientIcon && recipientLabel) {
                const recipientName = recipientLabel.innerText.trim();
                if (myUsername && recipientName === myUsername) {
                    recipientIcon.style.display = 'none';
                }
                const divider = document.createElement('span');
                divider.className = 'chat-whisper-divider';
                usernameSpan.appendChild(divider);
                usernameSpan.appendChild(recipientIcon);
                if (recipientStatus) usernameSpan.appendChild(recipientStatus);
                usernameSpan.appendChild(recipientLabel);
            }
        }

        // 5. Highlight @Mentions UND Linkify (AKTUALISIERT v4.4.8)
        const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;

        for (const child of Array.from(node.childNodes)) {
            // Nur reine Textknoten außerhalb des Usernamen-Spans verarbeiten
            if (child.nodeType === 3 && usernameSpan && !usernameSpan.contains(child)) {
                let text = child.textContent;

                // **Linkify (URLs in <a>-Tags/Vorschauen umwandeln)**
                text = linkifyText(text);

                // Erzeuge einen temporären DOM-Container, um den HTML-Text (mit Links) einzufügen
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = text;

                // 5b. Weiterverarbeitung für Mentions
                const nodesToProcess = Array.from(tempDiv.childNodes);
                const finalFragment = document.createDocumentFragment();

                nodesToProcess.forEach(procNode => {
                    // Verarbeite Mentions nur in reinen Textknoten, NICHT in <a>-Tags (Links/Vorschauen)
                    if (procNode.nodeType === 3 && mentionRegex.test(procNode.textContent)) {
                        const parts = procNode.textContent.split(mentionRegex);
                        parts.forEach(part => {
                            if (mentionRegex.test(part)) {
                                const mentionSpan = document.createElement('span');
                                mentionSpan.className = 'chat-mention';
                                mentionSpan.textContent = part;
                                finalFragment.appendChild(mentionSpan);
                            } else {
                                if (part.length > 0) finalFragment.appendChild(document.createTextNode(part));
                            }
                        });
                    } else {
                        // Link (bereits <a>) oder reiner Text ohne Mention
                        finalFragment.appendChild(procNode);
                    }
                });

                child.replaceWith(finalFragment);
            }
        }


        // 6. @Mention als "Antwort" verschieben
        if (!node.classList.contains('chatWhisper')) {
            const mentionSpans = node.querySelectorAll('span.chat-mention');
            let firstMentionSpan = null;
            for (const span of mentionSpans) {
                // Sicherstellen, dass die Mention nicht bereits im Username-Span ist (was in LSS normalerweise nicht der Fall ist)
                if (!usernameSpan.contains(span)) { firstMentionSpan = span; break; }
            }
            if (firstMentionSpan) {
                const mentionName = firstMentionSpan.textContent.trim();
                const divider = document.createElement('span');
                divider.className = 'chat-whisper-divider';
                const recipientLabel = document.createElement('span');
                recipientLabel.className = 'whisper-label';
                recipientLabel.textContent = mentionName.substring(1);
                usernameSpan.appendChild(divider);
                usernameSpan.appendChild(recipientLabel);
                const prevSibling = firstMentionSpan.previousSibling;
                if (prevSibling && prevSibling.nodeType === 3 && prevSibling.textContent.endsWith(' ')) {
                    prevSibling.textContent = prevSibling.textContent.slice(0, -1);
                }
                firstMentionSpan.remove();
            }
        }
        // 7. NEU: Einsatz-Links hervorheben
        node.querySelectorAll('a[href^="/missions/"]').forEach(missionLink => {
            // Prüfen, ob es ein "echter" Einsatzlink ist (mit Icon)
            const icon = missionLink.querySelector('span.glyphicon');
            if (icon) {
                missionLink.classList.add('pro-chat-mission-link');

                // NEU: Text-Span finden und Klammern entfernen
                const textSpan = missionLink.querySelector('span:not(.glyphicon)');
                if (textSpan && textSpan.textContent) {
                    textSpan.textContent = textSpan.textContent.replace(/[\[\]]/g, '');
                }
            }
        });
        node.dataset.proChatFormatted = 'true';
    }

    /**
     * Wendet das Messenger-Design auf eine NACHRICHT IM ALLIANZ-CHAT an (AKTUALISIERT v4.4.8)
     */
    function processAllianceChatMessage(well) {
        if (well.dataset.proChatFormatted) return;
        const strong = well.querySelector('strong');
        const usernameLink = well.querySelector('strong a[href^="/profile/"]');
        const p = well.querySelector('p');
        const isoString = well.dataset.messageTime;
        if (!strong || !usernameLink || !p || !isoString) return;

        // 1. Erstelle Timestamp Bubble (mit Datum)
        try {
            const date = new Date(isoString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const newTimestampStr = `${day}.${month}. ${time}`; // z.B. 28.10. 15:30

            const bubble = document.createElement('span');
            bubble.className = 'chat-timestamp-bubble';
            bubble.textContent = newTimestampStr;
            bubble.title = date.toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'full' });
            strong.prepend(bubble);
        } catch (e) {
            console.error("[ChatPro] Fehler beim Parsen des Datums", isoString, e);
        }

        // 2. Username & Siding
        const username = usernameLink.innerText.trim();
        const color = getUsernameColor(username, isDark);
        usernameLink.style.color = color;
        if (myUsername && username === myUsername) {
            well.classList.add('chat-message-own');
        } else {
            well.classList.add('chat-message-other');
        }

        // 3. Highlight @Mentions UND Linkify (AKTUALISIERT v4.4.8)
        const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
        const childNodes = Array.from(p.childNodes);

        childNodes.forEach(child => {
            if (child.nodeType === 3) {
                let text = child.textContent;

                // **NEU: 3a. Linkify (URLs in <a>-Tags/Vorschauen umwandeln)**
                text = linkifyText(text);

                // Erzeuge einen temporären DOM-Container, um den HTML-Text (mit Links) einzufügen
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = text;

                // 3b. Weiterverarbeitung für Mentions
                const nodesToProcess = Array.from(tempDiv.childNodes);
                const finalFragment = document.createDocumentFragment();

                nodesToProcess.forEach(procNode => {
                    // Verarbeite Mentions nur in reinen Textknoten, NICHT in <a>-Tags (Links/Vorschauen)
                    if (procNode.nodeType === 3 && mentionRegex.test(procNode.textContent)) {
                        const parts = procNode.textContent.split(mentionRegex);
                        parts.forEach(part => {
                            if (mentionRegex.test(part)) {
                                const mentionSpan = document.createElement('span');
                                mentionSpan.className = 'chat-mention';
                                mentionSpan.textContent = part;
                                finalFragment.appendChild(mentionSpan);
                            } else {
                                if (part.length > 0) finalFragment.appendChild(document.createTextNode(part));
                            }
                        });
                    } else {
                        // Link (bereits <a>) oder reiner Text ohne Mention
                        finalFragment.appendChild(procNode);
                    }
                });
                child.replaceWith(finalFragment);
            }
        });

        // 4. NEU: Einsatz-Links hervorheben (Muss NACH Linkify/Mentions laufen)
        p.querySelectorAll('a[href^="/missions/"]').forEach(missionLink => {
            const icon = missionLink.querySelector('span.glyphicon');
            if (icon) {
                missionLink.classList.add('pro-chat-mission-link');

                // NEU: Text-Span finden und Klammern entfernen
                const textSpan = missionLink.querySelector('span:not(.glyphicon)');
                if (textSpan && textSpan.textContent) {
                    textSpan.textContent = textSpan.textContent.replace(/[\[\]]/g, '');
                }
            }
        });

        // 5. Aufräumen
        const oldSpan = well.querySelector('span.pull-right');
        if (oldSpan) oldSpan.remove();
        const oldLine1 = well.querySelector('.lss-chat-line-1');
        if (oldLine1) {
            well.prepend(strong);
            oldLine1.remove();
        }

        // 6. Redesigner-Klasse
        strong.classList.add('mission_chat_message_username');
        well.dataset.proChatFormatted = 'true';
    }

    /**
     * ZENTRALE Funktion: Verarbeitet, stylt und blockt ein Element
     */
    function processAndBlockElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
        const link = element.matches('a[href^="/profile/"]') ? element : element.querySelector('a[href^="/profile/"]');
        const profileId = link ? link.href.split('/').pop() : null;

        if (shouldBlockUser(profileId)) {
            hideElement(element);
            return; // Nicht stylen, wenn geblockt
        }
        showElement(element); // Sicherstellen, dass sichtbar

        // Styling anwenden
        if (element.matches('li') && element.closest('#mission_chat_messages')) {
            processMainChatMessage(element);
            if (!element.classList.contains('new-chat-message-animated')) {
                 setTimeout(() => element.classList.add('new-chat-message-animated'), 10);
            }
        }
        if (element.matches('.well[data-message-time]')) {
            processAllianceChatMessage(element);
        }
    }

    /**
     * Aktualisiert die Zähleranzeigen
     */
    function updateCounterDisplays(count) {
        const countString = count > 0 ? `(${count})` : '';
        const counterSpans = document.querySelectorAll('.lss-blocker-count');
        counterSpans.forEach(span => {
            span.textContent = countString;
            // Sichtbarkeit explizit steuern
            if (countString) {
                span.style.display = 'inline-block';
            } else {
                span.style.display = 'none';
            }
        });
    }


    /**
     * Wendet Block-Status an UND aktualisiert Zähler
     */
    function applyBlockStatusToAllElements() {
        let hiddenCount = 0;
        const relevantSelectors = [
            '.well[data-message-time]', 'li[data-message-time]', '.chat-message-row',
            'tr:has(a[href^="/profile/"])', 'li:has(a[href^="/profile/"])',
            '.forum_post', '.mission_list_siver'
        ];

        document.querySelectorAll(relevantSelectors.join(', ')).forEach(element => {
            processAndBlockElement(element);
            if (element.dataset.lssBlocked === 'true') {
                hiddenCount++;
            }
        });
        updateCounterDisplays(hiddenCount);
    }

    // === ALLIANZ-CHAT LADE-FUNKTIONEN ===

    let currentPage = 1; let maxPage = 1; let chatContainer = null;
    function fetchPage(pageNumber) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `/alliance_chats?page=${pageNumber}`,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) resolve(response.responseText);
                    else reject(new Error(`Fehler Seite ${pageNumber}: Status ${response.status}`));
                },
                onerror: (error) => reject(new Error(`Netzwerkfehler Seite ${pageNumber}: ${error}`))
            });
        });
    }

    function setupMultiPageLoader() {
        if (!window.location.pathname.startsWith('/alliance_chats')) return;

        // UI-Bar erstellen
        const h3Title = Array.from(document.querySelectorAll('h3')).find(h3 => h3.textContent.trim() === 'Chatverlauf');
        if (h3Title) {
            createAllianceChatUI(h3Title);
        }

        const pagination = document.querySelector('ul.pagination');
        if (!pagination) return;

        const firstWell = document.querySelector('.well[data-message-time]');
        chatContainer = firstWell ? firstWell.parentNode : pagination.previousElementSibling || pagination.parentNode;

        if (chatContainer) {
            chatContainer.style.display = 'flex';
            chatContainer.style.flexDirection = 'column';
        }

        const activeLi = pagination.querySelector('li.active span');
        if (activeLi) currentPage = parseInt(activeLi.textContent, 10);

        const allPageLinks = pagination.querySelectorAll('a[href*="page="]');
        maxPage = 1;
        if (allPageLinks.length > 0) {
             let lastRealLink = null;
             for(let i = allPageLinks.length - 1; i >= 0; i--){
                 if(/^\d+$/.test(allPageLinks[i].textContent.trim())){ lastRealLink = allPageLinks[i]; break; }
             }
             if(lastRealLink){
                 try { maxPage = parseInt(new URL(lastRealLink.href).searchParams.get('page'), 10); }
                 catch(e) { console.error("[ChatPro] Fehler beim Parsen der max. Seite", e); }
             }
        }
        pagination.style.display = 'none';

        const loadContainer = document.createElement('div');
        loadContainer.id = 'lss_load_more_container';
        const loadButton = document.createElement('button');
        loadButton.id = 'lss_load_more_btn';
        loadContainer.appendChild(loadButton);

        function updateButtonState() {
            if (currentPage >= maxPage) {
                loadButton.textContent = 'Ende des Chatverlaufs erreicht'; loadButton.disabled = true; return;
            }
            const nextStart = currentPage + 1;
            const nextEnd = Math.min(currentPage + 5, maxPage);
            loadButton.textContent = `Lade 5 weitere Seiten (${nextStart}-${nextEnd})`; loadButton.disabled = false;
        }

        loadButton.addEventListener('click', async () => {
            loadButton.disabled = true; loadButton.textContent = 'Lade Seiten...';
            const startPage = currentPage + 1;
            const endPage = Math.min(currentPage + 5, maxPage);
            const insertionPoint = loadContainer;

            let newlyHiddenCount = 0;
            for (let i = startPage; i <= endPage; i++) {
                try {
                    const html = await fetchPage(i);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const newWells = doc.querySelectorAll('.well[data-message-time]');
                    if (newWells.length === 0) { maxPage = i - 1; break; }

                    const divider = document.createElement('div');
                    divider.className = 'lss-page-divider';
                    divider.innerHTML = `<span>Seite ${i}</span>`;
                    if (chatContainer) chatContainer.insertBefore(divider, insertionPoint);

                    newWells.forEach(well => {
                        const clonedWell = well.cloneNode(true);
                        processAndBlockElement(clonedWell);
                        if (chatContainer) chatContainer.insertBefore(clonedWell, insertionPoint);
                        if (clonedWell.dataset.lssBlocked === 'true') {
                            newlyHiddenCount++;
                        }
                    });
                } catch (error) { console.error("[ChatPro] Fehler beim Laden von Seite", i, error); break; }
            }
            currentPage = endPage; updateButtonState();
            // Aktualisiere den Zähler nach dem Laden
            // Lese aktuellen Zählerstand aus (falls vorhanden)
            const currentCounterElement = document.querySelector('.lss-blocker-count');
            let currentCount = 0;
            if(currentCounterElement && currentCounterElement.textContent){
                const match = currentCounterElement.textContent.match(/\((\d+)\)/);
                if(match && match[1]) {
                    currentCount = parseInt(match[1], 10);
                }
            }
            updateCounterDisplays(currentCount + newlyHiddenCount);
        });
        updateButtonState();
        if(pagination.parentNode) pagination.parentNode.insertBefore(loadContainer, pagination.nextSibling);
    } // Ende setupMultiPageLoader


    // === NEUE FUNKTION: Allianz-User-Caching und Fetching (KORRIGIERT FÜR MAX-PAGE) ===

    /**
     * Holt eine Seite der Verbandsmitglieder
     */
    function fetchAllianceMembersPage(pageNumber) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `/verband/mitglieder?page=${pageNumber}`,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`Fehler beim Abrufen der Mitgliederseite ${pageNumber}: Status ${response.status}`));
                    }
                },
                onerror: (error) => reject(new Error(`Netzwerkfehler beim Abrufen der Mitgliederseite ${pageNumber}: ${error}`))
            });
        });
    }

    /**
     * Parst die Usernamen aus dem HTML-Inhalt einer Mitgliederseite
     */
    function parseUsernamesFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const userLinks = doc.querySelectorAll('a[href^="/profile/"]');
        const usernames = [];
        userLinks.forEach(link => {
            const username = link.textContent.trim();
            if (username.length > 0 && username !== myUsername) { // Eigenen Namen ausschließen
                usernames.push(username);
            }
        });
        return usernames;
    }

    /**
     * Ruft alle Seiten der Verbandsmitglieder ab (paralleles Paging)
     */
    async function fetchAllAllianceMembers() {
        console.log("[ChatPro] Starte Abruf aller Verbandsmitglieder...");
        try {
            // 1. Erste Seite abrufen, um die maximale Seitenzahl zu ermitteln
            const firstPageHtml = await fetchAllianceMembersPage(1);
            const parser = new DOMParser();
            const doc = parser.parseFromString(firstPageHtml, 'text/html');
            const pagination = doc.querySelector('ul.pagination');
            let maxPage = 1;

            if (pagination) {
                // Finde den Link zur letzten Seite, indem wir den letzten numerischen Link suchen
                const pageLinks = Array.from(pagination.querySelectorAll('a[href*="page="]')).filter(a => /^\d+$/.test(a.textContent.trim()));
                if (pageLinks.length > 0) {
                     // Der letzte gefundene Link ist der höchste
                     maxPage = Math.max(...pageLinks.map(a => parseInt(new URL(a.href).searchParams.get('page'), 10)));
                } else {
                     // Fallback: Wenn keine numerischen Links gefunden wurden, aber eine Paginierung existiert, prüfen wir, ob wir auf Seite 1 sind und es einen "Weiter" Link gibt.
                     const nextPageLink = pagination.querySelector('li.next:not(.disabled) a[rel="next"]');
                     if (nextPageLink) {
                         maxPage = 2;
                     }
                }
            }

            console.log(`[ChatPro] Maximale Mitgliederseite gefunden: ${maxPage}`);

            // 2. Usernamen der ersten Seite parsen
            let allUsernames = parseUsernamesFromHtml(firstPageHtml);

            // 3. Alle weiteren Seiten (2 bis maxPage) parallel abrufen
            if (maxPage > 1) {
                const fetchPromises = [];
                for (let i = 2; i <= maxPage; i++) {
                    fetchPromises.push(fetchAllianceMembersPage(i));
                }

                const results = await Promise.allSettled(fetchPromises);

                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        const usernames = parseUsernamesFromHtml(result.value);
                        allUsernames.push(...usernames);
                    } else {
                        console.error("[ChatPro] Fehler beim parallelen Laden einer Mitgliederseite:", result.reason);
                    }
                });
            }

            // 4. Duplikate entfernen und alphabetisch sortieren
            const uniqueUsernames = [...new Set(allUsernames)].sort((a, b) => a.localeCompare(b));
            console.log(`[ChatPro] ${uniqueUsernames.length} einzigartige Verbandsmitglieder geladen und gecacht.`);

            // 5. Speichern und Cache-Zeitpunkt setzen
            await GM_setValue(ALLIANCE_USERS_KEY, JSON.stringify(uniqueUsernames));
            await GM_setValue(USERS_CACHE_TIME_KEY, Date.now());

            return uniqueUsernames;

        } catch (error) {
            console.error("[ChatPro] Schwerwiegender Fehler beim Abrufen der Verbandsmitglieder:", error);
            return [];
        }
    }

    /**
     * Lädt die Allianz-Usernamen aus dem Cache oder ruft sie ab
     */
    async function loadAllianceUsers() {
        const cachedUsersJson = await GM_getValue(ALLIANCE_USERS_KEY, null);
        const cacheTime = await GM_getValue(USERS_CACHE_TIME_KEY, 0);
        const now = Date.now();

        if (cachedUsersJson && (now - cacheTime) < CACHE_DURATION_MS) {
            try {
                allianceUsers = JSON.parse(cachedUsersJson);
                console.log(`[ChatPro] ${allianceUsers.length} Verbandsmitglieder aus dem Cache geladen.`);
                return;
            } catch (e) {
                console.error("[ChatPro] Fehler beim Parsen der gecachten Userliste, lade neu.");
            }
        }

        // Cache abgelaufen oder leer/defekt, neu laden
        allianceUsers = await fetchAllAllianceMembers();
    }


    // === NEUE FUNKTIONEN: Mention-Autovervollständigung UI und Logik ===

    /**
     * Erstellt den Autovervollständigungs-Container
     */
    function createSuggestionUI() {
        if (suggestionContainer) return;

        suggestionContainer = document.createElement('div');
        suggestionContainer.id = 'pro_chat_suggestion_container';
        suggestionContainer.className = 'pro-chat-suggestion-container';
        suggestionContainer.style.display = 'none';

        // Anhängen an den Body (oder das Chat-Panel), da es absolut innerhalb des Chat-Panels positioniert wird.
        const chatPanelBody = document.getElementById('chat_panel_body');
        if(chatPanelBody) {
             chatPanelBody.appendChild(suggestionContainer);
        } else {
             document.body.appendChild(suggestionContainer);
        }
    }

    /**
     * Zeigt die Vorschläge an (KORRIGIERT: POSITIONIERUNG)
     */
    function showSuggestions(filteredUsers) {
        if (!suggestionContainer || !proChatTextarea) return;

        // *** WICHTIG: Berechnen der Position relativ zum Chat Panel Body ***
        const inputRect = proChatTextarea.getBoundingClientRect();
        const chatPanelBody = document.getElementById('chat_panel_body');

        let parentLeft = 0;
        let parentTop = 0;

        if (chatPanelBody) {
            const parentRect = chatPanelBody.getBoundingClientRect();
            parentLeft = parentRect.left;
            parentTop = parentRect.top;
        }

        // KORRIGIERTE POSITIONIERUNG: Oberkante des Vorschlagsfeldes = Oberkante Textarea + Höhe Textarea + 5px Abstand
        const topRelativeToParent = (inputRect.top - parentTop) + inputRect.height + 60;
        const leftRelativeToParent = inputRect.left - parentLeft;

        suggestionContainer.style.top = `${topRelativeToParent}px`;
        suggestionContainer.style.left = `${leftRelativeToParent}px`;
        suggestionContainer.style.width = `${inputRect.width}px`;


        suggestionContainer.innerHTML = '';
        suggestionContainer.style.display = 'none';
        selectedSuggestionIndex = -1;

        if (filteredUsers.length === 0) return;

        filteredUsers.slice(0, 10).forEach((username, index) => {
            const item = document.createElement('div');
            item.className = 'pro-chat-suggestion-item';
            item.textContent = username;
            item.dataset.index = index;
            item.addEventListener('click', () => selectSuggestion(username));
            suggestionContainer.appendChild(item);
        });

        suggestionContainer.style.display = 'block';
    }

    /**
     * Wählt einen Vorschlag aus und fügt ihn in die Textarea ein (KORRIGIERT: /w LOGIK HINZUGEFÜGT)
     */
    function selectSuggestion(username) {
        if (!proChatTextarea) return;

        const cursorPosition = proChatTextarea.selectionStart;
        const text = proChatTextarea.value;

        // Finde den Beginn des @-Mentions
        const preMentionText = text.substring(0, cursorPosition);

        // NEUE LOGIK: Finde den Auslöser und dessen Index
        const atIndex = preMentionText.lastIndexOf('@');
        const wMatch = preMentionText.match(/^\/w\s+/);
        const wIndex = wMatch ? wMatch[0].length : -1;

        let newText = text;
        let newCursorPos = cursorPosition;

        if (atIndex !== -1) {
            // FALL 1: @-Mention
            // Ersetze alles ab dem @ bis zur Cursorposition durch @Username + Leerzeichen
            newText = text.substring(0, atIndex) + `@${username} ` + text.substring(cursorPosition);
            newCursorPos = atIndex + username.length + 2;

        } else if (wIndex !== -1) {
            // FALL 2: /w (Flüstern)
            const prefix = '/w ';
            const startIndex = 0;

            // Text vor "/w" (leer) + "/w " + Username + Leerzeichen + Rest des Textes
            newText = text.substring(0, startIndex) + prefix + username + ' ' + text.substring(cursorPosition);
            newCursorPos = startIndex + prefix.length + username.length + 1;
        }

        if (atIndex !== -1 || wIndex !== -1) {
            proChatTextarea.value = newText;

            // Setze den Cursor
            proChatTextarea.selectionStart = newCursorPos;
            proChatTextarea.selectionEnd = newCursorPos;

            // Trigger input event, um autoGrow und Whisper-Anzeige zu aktualisieren
            proChatTextarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }

        // Vorschläge ausblenden
        hideSuggestions();
        proChatTextarea.focus();
    }

    /**
     * Blendet die Vorschläge aus
     */
    function hideSuggestions() {
        if (suggestionContainer) {
            suggestionContainer.style.display = 'none';
            selectedSuggestionIndex = -1;

            // Entferne die Hervorhebung
            suggestionContainer.querySelectorAll('.pro-chat-suggestion-item').forEach(item => {
                 item.classList.remove('selected');
            });
        }
    }

    /**
     * Navigiert durch die Vorschläge (Hoch/Runter)
     */
    function navigateSuggestions(direction) {
        if (!suggestionContainer || suggestionContainer.style.display === 'none') return;

        const items = suggestionContainer.querySelectorAll('.pro-chat-suggestion-item');
        if (items.length === 0) return;

        let newIndex = selectedSuggestionIndex + direction;

        if (newIndex < 0) {
            newIndex = items.length - 1; // Wrap around nach oben
        } else if (newIndex >= items.length) {
            newIndex = 0; // Wrap around nach unten
        }

        // Hervorhebung aktualisieren
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === newIndex);
        });

        selectedSuggestionIndex = newIndex;

        // Sorgen Sie dafür, dass das ausgewählte Element sichtbar ist
        if (selectedSuggestionIndex !== -1) {
            items[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
        }
    }


    /**
     * Die Hauptlogik der Autovervollständigung (wird im input-Listener aufgerufen) (KORRIGIERT: /w ERKENNUNG HINZUGEFÜGT)
     */
    function checkMentionAutocomplete() {
        if (!proChatTextarea) return;

        const cursorPosition = proChatTextarea.selectionStart;
        const text = proChatTextarea.value;
        const preCursorText = text.substring(0, cursorPosition);

        // NEU: Suche entweder nach @[Name] ODER nach /w [Name] am Zeilenanfang
        const mentionMatch = preCursorText.match(/(?:@([a-zA-Z0-9_-]*)$)|(?:^\/w\s+([a-zA-Z0-9_-]*)$)/);

 if (mentionMatch) {
    // Die Suchzeichenkette ist entweder in Gruppe 1 (für @) oder Gruppe 2 (für /w)
    // KORREKTUR: Fallback auf '' (leerer String) hinzugefügt, falls beide Gruppen undefined sind
    const searchString = (mentionMatch[1] || mentionMatch[2]) || '';

            if (allianceUsers.length === 0) {
                 hideSuggestions();
                 return;
            }

            // Filtere die Usernamen (Groß-/Kleinschreibung ignorieren)
            const filteredUsers = allianceUsers.filter(username =>
                 username.toLowerCase().startsWith(searchString.toLowerCase())
            );

            showSuggestions(filteredUsers);
        } else {
            hideSuggestions();
        }
    }

    // === NEUE FUNKTION: Eingabefeld zu Textarea umwandeln (AKTUALISIERT v4.5.5) ===
    function replaceInputWithTextarea() {
        const inputElement = document.getElementById('alliance_chat_message');
        const inputGroup = inputElement ? inputElement.closest('.input-group') : null;

        // Prüfen, ob das Element existiert und noch nicht umgewandelt wurde
        if (!inputElement || inputElement.tagName === 'TEXTAREA' || !inputGroup) return;

        console.log("[ChatPro] Ersetze Input-Feld durch Auto-Grow Textarea...");

        // 1. Erstelle BEIDE neuen Elemente (Textarea und Whisper-Anzeige)
        proChatTextarea = document.createElement('textarea');
        const whisperTargetDisplay = document.createElement('div');
        whisperTargetDisplay.id = 'pro_chat_whisper_target';
        whisperTargetDisplay.style.display = 'none'; // Standardmäßig ausblenden
        whisperTargetDisplay.style.paddingBottom = '5px';

        // 2. Wichtige Attribute vom alten Input übernehmen
        proChatTextarea.id = inputElement.id;
        proChatTextarea.className = inputElement.className;
        proChatTextarea.name = inputElement.name;
        proChatTextarea.style.resize = 'none'; // Verhindert manuelles Vergrößern durch den User
        proChatTextarea.style.overflowY = 'hidden'; // Versteckt die Scrollbar (wird von autoGrow gemanagt)
        proChatTextarea.rows = 1; // Startet mit einer Zeile
        proChatTextarea.placeholder = "Nachricht (Enter = Senden/Vorschlag wählen, Shift+Enter = Zeilenumbruch)";

        // 3. Smiley-Button Container (Rechts)
        const smileyInputGroupAddon = document.createElement('span');
        smileyInputGroupAddon.className = 'input-group-addon pro-chat-smiley-addon';

        smileyButton = document.createElement('button');
        smileyButton.id = 'pro_chat_smiley_btn';
        smileyButton.type = 'button';
        smileyButton.className = 'btn btn-default btn-xs';
        smileyButton.title = 'Smilies auswählen';
        smileyButton.innerHTML = '😊'; // Icon
        smileyInputGroupAddon.appendChild(smileyButton);

        // 4. Smiley-Auswahl-Container (Popover-Stil)
        smileyContainer = document.createElement('div');
        smileyContainer.id = 'pro_chat_smiley_container';
        smileyContainer.style.display = 'none';
        UNICODE_SMILIES.forEach(smiley => {
             const span = document.createElement('span');
             span.textContent = smiley;
             span.className = 'pro-chat-smiley-item';
             span.title = smiley;
             span.addEventListener('click', (e) => insertSmiley(e.target.textContent));
             smileyContainer.appendChild(span);
        });

        // 5. Smiley-Logik
        smileyButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Verhindert, dass der Klick das Container schließt
            const isVisible = smileyContainer.style.display === 'block';
            smileyContainer.style.display = isVisible ? 'none' : 'block';
            hideSuggestions(); // Vorschläge ausblenden
        });

        // Schließe das Smiley-Fenster, wenn irgendwo außerhalb geklickt wird
        document.addEventListener('click', (e) => {
            if (smileyContainer && smileyContainer.style.display === 'block' &&
                !smileyContainer.contains(e.target) && e.target !== smileyButton) {
                smileyContainer.style.display = 'none';
            }
        });

        /**
         * Fügt einen Smiley an der Cursorposition in die Textarea ein
         */
        function insertSmiley(smiley) {
             if (!proChatTextarea) return;

             const start = proChatTextarea.selectionStart;
             const end = proChatTextarea.selectionEnd;
             const value = proChatTextarea.value;

             // Füge den Smiley ein und setze den Cursor danach
             proChatTextarea.value = value.substring(0, start) + smiley + ' ' + value.substring(end);
             proChatTextarea.selectionStart = proChatTextarea.selectionEnd = start + smiley.length + 1;

             // Manuelles Triggern, um AutoGrow und Whisper-Anzeige zu aktualisieren
             proChatTextarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
             proChatTextarea.focus();
        }

        // 6. Erstelle das Autovervollständigungs-UI
        createSuggestionUI();


        // 7. Event-Listener für das automatische Wachsen
        const autoGrow = (el) => {
            el.style.height = 'auto'; // Wichtig: Zurücksetzen, um Verkleinern zu ermöglichen
            el.style.height = (el.scrollHeight) + 'px';
        };

        // 8. Input-Listener (AutoGrow + Mention- & Whisper-Anzeige + Autovervollständigung)
        proChatTextarea.addEventListener('input', () => {
			convertAsciiToUnicode();
            autoGrow(proChatTextarea);
            checkMentionAutocomplete(); // <<< NEUE LOGIK HIER

            // --- LOGIK FÜR FLÜSTER/MENTION-ANZEIGE (v4.4.2) ---
            const text = proChatTextarea.value;
            const whisperTargetDisplay = document.getElementById('pro_chat_whisper_target');
            if (!whisperTargetDisplay) return;

            // Suche nach "/w Name"
            const whisperMatch = text.match(/^\/w\s+([a-zA-Z0-9_-]+)/);
            // Suche nach "@Name"
            const atMatch = text.match(/^@([a-zA-Z0-9_-]+)/);

            let targetName = null;
            let displayHTML = '';
            let labelClass = '';

            if (whisperMatch && whisperMatch[1]) {
                // --- FALL 1: FLÜSTERN (/w) ---
                targetName = whisperMatch[1];
                labelClass = 'whisper-label';
                displayHTML = `Mit <span class="${labelClass}">${targetName}</span> flüstern`;

            } else if (atMatch && atMatch[1] && text.indexOf(' ') === -1) {
                // --- FALL 2: ERWÄHNUNG (@) ---
                targetName = atMatch[1];
                // Wir nutzen die existierende CSS-Klasse 'chat-mention' für den @Namen
                labelClass = 'chat-mention';
                displayHTML = `<span class="${labelClass}">${targetName}</span> erwähnt`;
            }

            // --- ANZEIGE STEUERN ---
            if (targetName) {
                // Name gefunden, Anzeige einblenden
                whisperTargetDisplay.innerHTML = displayHTML;

                // Wende die korrekten Farben je nach Modus an
                const label = whisperTargetDisplay.querySelector('span');
                if (label) {
                    if (label.classList.contains('whisper-label')) {
                        // Style für .whisper-label (Gelb)
                        if (document.body.classList.contains('dark')) {
                            label.style.backgroundColor = 'var(--color-dark-whisper-label-bg, #f0ad4e)';
                            label.style.color = 'var(--color-dark-whisper-label-fg, #ffffff)';
                        } else {
                            label.style.backgroundColor = 'var(--color-light-whisper-label-bg, #f0ad4e)';
                            label.style.color = 'var(--color-light-whisper-label-fg, #ffffff)';
                        }
                    } else if (label.classList.contains('chat-mention')) {
                        // Style für .chat-mention (wird bei @ genutzt)
                        if (document.body.classList.contains('dark')) {
                            label.style.backgroundColor = 'var(--color-dark-mention-bg, #f0ad4e)';
                            label.style.color = 'var(--color-dark-mention-fg, #332b1f)';
                        } else {
                            label.style.backgroundColor = 'var(--color-light-mention-bg, #fff4cc)';
                            label.style.color = 'var(--color-light-mention-fg, #664d03)';
                            label.style.border = '1px solid var(--color-light-mention-border, #ffe69c)';
                        }
                    }
                }
                whisperTargetDisplay.style.display = 'block'; // Anzeigen
            } else {
                // Nichts gefunden, Anzeige ausblenden
                whisperTargetDisplay.innerHTML = '';
                whisperTargetDisplay.style.display = 'none'; // Ausblenden
            }
            // --- ENDE LOGIK ---
        });

        // 9. Keydown-Listener (Senden + Autovervollständigung-Navigation) - AKTUALISIERT (v4.5.4)
        proChatTextarea.addEventListener('keydown', (e) => {
            if (!proChatTextarea) return;

            const suggestionsVisible = suggestionContainer && suggestionContainer.style.display === 'block';

            if (suggestionsVisible) {
                // Autovervollständigung ist sichtbar
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateSuggestions(-1);
                    return;
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    navigateSuggestions(1);
                    return;
                } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (selectedSuggestionIndex !== -1) {
                        const selectedItem = suggestionContainer.querySelector(`.pro-chat-suggestion-item[data-index="${selectedSuggestionIndex}"]`);
                        if (selectedItem) {
                            selectSuggestion(selectedItem.textContent);
                            return;
                        }
                    }
                    // Wenn Enter gedrückt wird, aber kein Vorschlag ausgewählt ist, senden wie gewohnt (weiter unten)
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    hideSuggestions();
                    return;
                }
            }

            // Normale Senden-Logik
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Verhindert den Zeilenumbruch

                // Vorschläge ausblenden
                hideSuggestions();

                // *** NEU: ASCII-Smileys konvertieren, BEVOR das Formular gesendet wird ***
                // proChatTextarea.value = convertAsciiToUnicode(proChatTextarea.value);

                const form = proChatTextarea.closest('form');
                if (form) {
                    // Löst das 'submit'-Event aus, damit der AJAX-Handler des Spiels es fängt
                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    form.dispatchEvent(submitEvent);

                    // Schließe Popover und setze Felder zurück
                    if (smileyContainer) smileyContainer.style.display = 'none';
                    document.getElementById('pro_chat_whisper_target').style.display = 'none';

                    // Nach dem Senden das Textfeld leeren und zurücksetzen
                    // Die Verzögerung ist entscheidend, damit der konvertierte Wert gelesen wird
                    setTimeout(() => {
                         proChatTextarea.value = '';
                         autoGrow(proChatTextarea);
                    }, 50);
                }
            }
        });

        // 10. Elemente ZUM DOM HINZUFÜGEN (IN KORREKTER REIHENFOLGE)
        const formElement = inputElement.closest('form');
        if (formElement) {
             // 10a. Füge Whisper-Anzeige VOR dem input-group-addon (Send-Button-Container) hinzu
             formElement.prepend(whisperTargetDisplay);
        }

        // 10b. Ersetze das Input-Feld (innerhalb von .input-group)
        inputElement.parentNode.replaceChild(proChatTextarea, inputElement);

        // 10c. Füge den Smiley-Addon-Container an das Ende der .input-group
        inputGroup.appendChild(smileyInputGroupAddon);

        // 10d. Füge die Popover-Container zum Body hinzu (oder dem Chat-Panel-Body)
        // Die absolute Positionierung funktioniert am besten, wenn es sich im Chat-Panel befindet.
        const chatPanelBody = document.getElementById('chat_panel_body');
        if(chatPanelBody) {
             chatPanelBody.appendChild(smileyContainer);
        } else {
             document.body.appendChild(smileyContainer);
        }

        // 11. Label zum Papierflieger machen
        const labelElement = document.querySelector('label[for="alliance_chat_message"]');
        if (labelElement) {
            // Ersetze "* Nachricht" durch ein Sende-Icon
            labelElement.innerHTML = '<span class="glyphicon glyphicon-send" style="font-size: 1.2em;"></span>';
            // Optional: Vertikale Zentrierung des Icons verbessern
            labelElement.style.paddingTop = '0';
            labelElement.style.paddingBottom = '0';
            labelElement.style.lineHeight = `${proChatTextarea.style.minHeight || '38px'}`;
        }

        // 12. Initial einmal Größe anpassen
        setTimeout(() => autoGrow(proChatTextarea), 100);
    }

    // === STYLES (KOMBINIERT v4.5.5 - Wichtig: Positionierung korrigiert) ===
    const mergedStyles = `
        /* === EINSTELLUNGS-MODAL === */
        #proChatSettingsModal { display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
        .pro-chat-modal-content { background-color: #2c2f33; color: #f0f0f0; margin: 8% auto; padding: 0; border: 1px solid #40444b; width: 600px; max-width: 90%; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
        .pro-chat-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #40444b; }
        .pro-chat-modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; background-color: #23272a; }
        .pro-chat-modal-footer { text-align: right; padding: 15px 20px; border-top: 1px solid #40444b; }
        .pro-chat-close-btn { color: #aaa; float: right; font-size: 28px; font-weight: bold; background: none; border: none; cursor: pointer; }
        .pro-chat-close-btn:hover, .pro-chat-close-btn:focus { color: white; text-decoration: none; }
        .pro-chat-modal-body details { margin-bottom: 10px; background: #2c2f33; border-radius: 5px; }
        .pro-chat-modal-body summary { font-size: 1.2em; font-weight: bold; padding: 10px; cursor: pointer; background: #36393f; border-radius: 5px; }
        .pro-chat-modal-body fieldset { border: 1px solid #40444b; border-radius: 5px; margin: 10px; padding: 10px; }
        .pro-chat-modal-body legend { font-weight: bold; color: #7289da; padding: 0 5px; width: auto; border: none; font-size: 0.9em; }
        .pro-chat-setting-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; margin-bottom: 8px; }
        .pro-chat-setting-row label { white-space: nowrap; }
        .pro-chat-setting-row input[type="color"] { width: 60px; height: 30px; padding: 2px; border: 1px solid #40444b; border-radius: 4px; cursor: pointer; }
        .pro-chat-setting-row input[type="text"] { background-color: #40444b; color: #f0f0f0; border: 1px solid #555; border-radius: 4px; padding: 5px; }
        .pro-chat-setting-row button { background-color: #4a4f56; color: #f0f0f0; border: 1px solid #555; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
        .pro-chat-setting-row button:hover { background-color: #555a63; }
        .pro-chat-reset-btn { background: none; border: 1px solid #555; color: #999; border-radius: 4px; cursor: pointer; font-size: 1.2em; line-height: 1; padding: 2px 8px; }
        .pro-chat-reset-btn:hover { color: white; border-color: #777; }
        #proChatResetAllBtn { background-color: #d9534f; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; }
        #proChatResetAllBtn:hover { background-color: #c9302c; }

        /* === BLOCKER-UI STYLES === */
        .lss-switch { position: relative; display: inline-block; width: 50px; height: 24px; vertical-align: middle; }
        .lss-switch input { opacity: 0; width: 0; height: 0; }
        .lss-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #777; transition: .4s; border-radius: 24px; }
        .lss-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .lss-slider { background-color: #28a745; }
        input:checked + .lss-slider:before { transform: translateX(26px); }
        .lss-switch.lss-switch-xs { width: 34px; height: 20px; }
        .lss-switch.lss-switch-xs .lss-slider:before { height: 14px; width: 14px; left: 3px; bottom: 3px; }
        .lss-switch.lss-switch-xs input:checked + .lss-slider:before { transform: translateX(14px); }
        #lss_blocker_id_list { list-style: none; padding: 0; margin-top: 10px; max-height: 200px; overflow-y: auto; border: 1px solid #555; background-color: #23272a; padding: 5px; }
        #lss_blocker_id_list li { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-bottom: 1px solid #444; }
        #lss_blocker_id_list li:last-child { border-bottom: none; }
        #lss_blocker_id_list button { background: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 12px; cursor: pointer; }
        #lss_blocker_id_add_btn { background-color: #28a745; }

        /* Wrapper für linke Header-Controls */
        .pro-chat-header-controls-left {
            float: left;
            display: flex;
            align-items: center;
            height: 24px;
            gap: 8px;
        }

        /* Control-Bar für Alliance-Chat */
        .lss-alliance-chat-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0 15px 0;
            padding: 10px;
            background-color: var(--color-dark-other-bubble-bg, #36393f);
            border: 1px solid var(--color-dark-header-border, #40444b);
            border-radius: 6px;
            color: var(--color-dark-body-fg, #f0f0f0);
        }
        body:not(.dark) .lss-alliance-chat-controls {
            background-color: var(--color-light-other-bubble-bg, #ffffff);
            border: 1px solid var(--color-light-header-border, #dce1e6);
            color: var(--color-light-body-fg, #111111);
        }
        .lss-alliance-chat-controls label.lss-blocker-label {
            font-weight: bold;
            margin: 0;
            color: inherit;
        }
        .lss-alliance-chat-controls .btn-xs {
             margin-left: auto;
        }

        /* Styling für Zähler */
        #chat_panel_heading span.lss-blocker-count,
        .lss-alliance-chat-controls span.lss-blocker-count {
            font-size: 10px !important;
            font-weight: bold !important;
            color: #FFFFFF !important;
            background-color: #dc3545 !important;
            display: none !important;
            text-align: center !important;
            padding: 2px 5px !important;
            border-radius: 5px !important;
            line-height: 1 !important;
            vertical-align: text-top;
            margin-left: -4px !important;
            z-index: 10 !important;
            min-width: 10px !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }
        #chat_panel_heading span.lss-blocker-count:not(:empty),
        .lss-alliance-chat-controls span.lss-blocker-count:not(:empty) {
             display: inline-block !important;
        }
         body:not(.dark) .lss-blocker-count {
             color: #000000 !important;
             background-color: #ffc107 !important;
         }


        /* === MESSENGER-DESIGN === */
        @keyframes slideInFromBottom { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        #mission_chat_messages li.new-chat-message-animated { animation: slideInFromBottom 0.4s ease-out; }
        .panel-body#chat_panel_body { padding: 0 !important; }
        #mission_chat_ban_message { margin: 10px; border-radius: 8px; text-shadow: 0 1px 1px rgba(0,0,0,0.3); border: none; }
        #alliance_chat_header_info, #alliance_chat.alliance_false { display: none !important; }
        img.alliance_chat_copy_username, img.alliance_chat_private_username { width: 0px !important; height: 0px !important; padding: 9px !important; background-repeat: no-repeat; background-position: center; background-size: 16px 16px; vertical-align: middle; border-radius: 4px; margin: 0 2px; transition: all 0.2s ease; cursor: pointer; filter: none !important; opacity: 1 !important; }
        a.alliance_chat_private_username, a.alliance_chat_private_username:hover { text-decoration: none !important; border: none !important; }

        /* === MESSENGER LAYOUT === */
        #mission_chat_messages,
        body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9 {
             display: flex;
             flex-direction: column;
        }
        body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9 {
             padding: 10px 10px 5px 10px;
        }
        #mission_chat_messages li,
        .well[data-message-time] {
            max-width: 85%;
            list-style: none;
            line-height: 1.4;
            margin-bottom: 8px !important;
            border-radius: 12px !important;
            word-wrap: break-word;
            box-shadow: none !important;
            display: block !important;
        }
        .well[data-message-time] {
            padding: 10px 14px !important;
            border: none !important;
        }
        #mission_chat_messages li {
            padding: 10px 14px;
            border: none;
        }
        .chat-message-own, .well.chat-message-own {
            align-self: flex-end;
            border-radius: 12px 12px 0 12px !important;
        }
        .chat-message-other, .well.chat-message-other {
            align-self: flex-start;
            border-radius: 12px 12px 12px 0 !important;
        }
        .chat-mention { font-weight: bold; padding: 1px 4px; border-radius: 4px; margin: 0 1px; }
        .chat-timestamp-bubble { padding: 2px 7px; border-radius: 5px; font-size: 0.85em !important; font-weight: bold; margin-right: 5px; vertical-align: middle; }
        .chat-whisper-divider { display: inline-block; width: 14px; height: 14px; background-size: 14px 14px; background-repeat: no-repeat; background-position: center; vertical-align: middle; margin: 0 4px; }
        .well[data-message-time] p { margin: 0; }
        .well[data-message-time] strong { margin: 0; }

        /* === DARK MODE STYLES === */
        .dark #chat_panel_heading { background-image: none !important; background-color: var(--color-dark-header-bg, #2c2f33) !important; color: var(--color-dark-header-fg, #f0f0f0) !important; border-bottom: 1px solid var(--color-dark-header-border, #40444b); font-weight: bold; padding: 10px 15px; }
        .dark #chat_panel_heading .btn-default { background-color: var(--color-dark-header-border, #40444b); border: none; color: var(--color-dark-header-fg, #f0f0f0); opacity: 0.7; transition: all 0.2s ease; }
        .dark #chat_panel_heading .btn-default:hover { opacity: 1; background-color: var(--color-dark-scrollbar-thumb-hover, #555a63); }
        .dark #chat_panel_heading .dropdown-menu { background-color: var(--color-dark-header-bg, #2c2f33); border: 1px solid var(--color-dark-header-border, #40444b); }
        .dark #chat_panel_heading .dropdown-menu > li > a { color: var(--color-dark-header-fg, #f0f0f0); }
        .dark #chat_panel_heading .dropdown-menu > li > a:hover { background-color: var(--color-dark-my-bubble-bg, #7289da); color: var(--color-dark-my-bubble-fg, #ffffff); }
        .dark #chat_panel_body, .dark #alliance_chat { background-color: var(--color-dark-body-bg, #2c2f33) !important; color: var(--color-dark-body-fg, #f0f0f0) !important; border: none !important; }
        .dark body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9 { background-color: var(--color-dark-chat-bg, #23272a); border-top: 1px solid var(--color-dark-chat-border, #40444b); }
        .dark #mission_chat_messages { background-color: var(--color-dark-chat-bg, #23272a); border-top: 1px solid var(--color-dark-chat-border, #40444b); }
        .dark .mission_chat_message_username { font-weight: bold; display: block; margin-bottom: 4px; color: var(--color-dark-username-fg, #ffffff); }
        .dark .mission_chat_message_username .chat-username { text-decoration: none; transition: all 0.2s ease; }
        .dark .mission_chat_message_username .chat-username:hover { text-decoration: underline; filter: brightness(1.2); }
        .dark .chat-message-own:not(.chatWhisper):not(.chatToSelf) .mission_chat_message_username .chat-username,
        .dark .well.chat-message-own .mission_chat_message_username .chat-username { color: var(--color-dark-my-bubble-fg, #ffffff) !important; }
        .dark .chat-timestamp-bubble { background-color: var(--color-dark-timestamp-bg, #40444b); color: var(--color-dark-timestamp-fg, #adafb3); }
        .dark .chat-whisper-divider { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' fill='%238e9297'%3E%3Cpath d='M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z'/%3E%3C/svg%3E"); }
        .dark .chat-message-own, .dark .well.chat-message-own { background-color: var(--color-dark-my-bubble-bg, #7289da) !important; color: var(--color-dark-my-bubble-fg, #ffffff) !important; }
        .dark .chat-message-other, .dark .well.chat-message-other { background-color: var(--color-dark-other-bubble-bg, #36393f) !important; color: var(--color-dark-other-bubble-fg, #dcddde) !important; }
        .dark #mission_chat_messages li.chatWhisper { background-color: var(--color-dark-whisper-bg) !important; border-left: 4px solid var(--color-dark-whisper-border) !important; padding-left: 10px !important; color: var(--color-dark-whisper-fg) !important; }
        .dark #mission_chat_messages li.chatWhisper.chat-message-own { background-color: var(--color-dark-my-whisper-bg) !important; color: var(--color-dark-my-whisper-fg) !important; }
        .dark .whisper-label { background-color: var(--color-dark-whisper-label-bg) !important; color: var(--color-dark-whisper-label-fg) !important; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin: 0 4px; font-size: 0.9em; }
        .dark #mission_chat_messages li.chatToSelf:not(.chatWhisper) { background-color: var(--color-dark-my-mention-bubble-bg) !important; border-left: 4px solid var(--color-dark-my-mention-bubble-border) !important; padding-left: 10px !important; color: var(--color-dark-my-mention-bubble-fg) !important; }
        .dark .chat-mention { background-color: var(--color-dark-mention-bg, #f0ad4e); color: var(--color-dark-mention-fg, #332b1f); }
        .dark #new_alliance_chat {
            padding: 10px;
            background-color: var(--color-dark-body-bg, #2c2f33);
            border-top: 1px solid var(--color-dark-chat-border, #40444b);
            position: relative; /* WICHTIG für absolute Positionierung der Popups */
        }
        .dark #new_alliance_chat .input-group-addon { background-color: var(--color-dark-input-addon-bg, #7289da); border: none; color: var(--color-dark-input-addon-fg, #ffffff); border-radius: 20px 0 0 20px; font-weight: bold; }
        .dark #alliance_chat_message { background-color: var(--color-dark-input-bg, #40444b); border: none; color: var(--color-dark-input-fg, #f0f0f0); border-radius: 0 20px 20px 0 !important; padding: 10px 15px; height: auto; transition: all 0.2s ease; }
        .dark #alliance_chat_message:focus { background-color: var(--color-dark-input-focus-bg, #4a4f56); box-shadow: 0 0 8px var(--color-dark-input-focus-shadow, rgba(114, 137, 218, 0.7)); outline: none; }
        .dark img.alliance_chat_copy_username { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%238e9297'%3E%3Cpath d='M115.9 448.9C83.3 408.6 64 358.4 64 304C64 171.5 178.6 64 320 64C461.4 64 576 171.5 576 304C576 436.5 461.4 544 320 544C283.5 544 248.8 536.8 217.4 524L101 573.9C97.3 575.5 93.5 576 89.5 576C75.4 576 64 564.6 64 550.5C64 546.2 65.1 542 67.1 538.3L115.9 448.9zM153.2 418.7C165.4 433.8 167.3 454.8 158 471.9L140 505L198.5 479.9C210.3 474.8 223.7 474.7 235.6 479.6C261.3 490.1 289.8 496 319.9 496C437.7 496 527.9 407.2 527.9 304C527.9 200.8 437.8 112 320 112C202.2 112 112 200.8 112 304C112 346.8 127.1 386.4 153.2 418.7z'/%3E%3C/svg%3E"); }
        .dark img.alliance_chat_private_username { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%238e9297'%3E%3Cpath d='M405.5 349.6C439.2 349.6 487.8 342.7 487.8 302.6C488 295.9 488.7 300.8 466.9 206.4C462.3 187.3 458.2 178.6 424.6 161.8C398.5 148.5 341.7 126.4 324.9 126.4C309.2 126.4 304.7 146.6 286 146.6C268 146.6 254.7 131.5 237.9 131.5C221.8 131.5 211.2 142.5 203.1 165.1C175.6 242.7 176.8 239.4 177 243.4C177 268.2 274.6 349.5 405.5 349.5zM493 318.8C497.7 340.8 497.7 343.1 497.7 346C497.7 383.7 455.4 404.6 399.7 404.6C274 404.7 163.8 331 163.8 282.3C163.8 275.5 165.2 268.8 167.9 262.6C122.7 264.9 64.1 272.9 64.1 324.6C64.1 409.3 264.7 513.6 423.6 513.6C545.4 513.6 576.1 458.5 576.1 415C576.1 380.8 546.5 342 493.2 318.8z'/%3E%3C/svg%3E"); }
        .dark img.alliance_chat_copy_username:hover { background-color: var(--color-dark-icon-bg-hover, #40444b); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23FFFFFF'%3E%3Cpath d='M115.9 448.9C83.3 408.6 64 358.4 64 304C64 171.5 178.6 64 320 64C461.4 64 576 171.5 576 304C576 436.5 461.4 544 320 544C283.5 544 248.8 536.8 217.4 524L101 573.9C97.3 575.5 93.5 576 89.5 576C75.4 576 64 564.6 64 550.5C64 546.2 65.1 542 67.1 538.3L115.9 448.9zM153.2 418.7C165.4 433.8 167.3 454.8 158 471.9L140 505L198.5 479.9C210.3 474.8 223.7 474.7 235.6 479.6C261.3 490.1 289.8 496 319.9 496C437.7 496 527.9 407.2 527.9 304C527.9 200.8 437.8 112 320 112C202.2 112 112 200.8 112 304C112 346.8 127.1 386.4 153.2 418.7z'/%3E%3C/svg%3E"); }
        .dark img.alliance_chat_private_username:hover { background-color: var(--color-dark-icon-bg-hover, #40444b); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23FFFFFF'%3E%3Cpath d='M405.5 349.6C439.2 349.6 487.8 342.7 487.8 302.6C488 295.9 488.7 300.8 466.9 206.4C462.3 187.3 458.2 178.6 424.6 161.8C398.5 148.5 341.7 126.4 324.9 126.4C309.2 126.4 304.7 146.6 286 146.6C268 146.6 254.7 131.5 237.9 131.5C221.8 131.5 211.2 142.5 203.1 165.1C175.6 242.7 176.8 239.4 177 243.4C177 268.2 274.6 349.5 405.5 349.5zM493 318.8C497.7 340.8 497.7 343.1 497.7 346C497.7 383.7 455.4 404.6 399.7 404.6C274 404.7 163.8 331 163.8 282.3C163.8 275.5 165.2 268.8 167.9 262.6C122.7 264.9 64.1 272.9 64.1 324.6C64.1 409.3 264.7 513.6 423.6 513.6C545.4 513.6 576.1 458.5 576.1 415C576.1 380.8 546.5 342 493.2 318.8z'/%3E%3C/svg%3E"); }
        .dark .chat-status-bubble { box-shadow: 0 0 4px #39e600; }
        .dark #mission_chat_messages::-webkit-scrollbar, .dark body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar { width: 8px; }
        .dark #mission_chat_messages::-webkit-scrollbar-track, .dark body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar-track { background: var(--color-dark-scrollbar-track, #23272a); border-radius: 4px; }
        .dark #mission_chat_messages::-webkit-scrollbar-thumb, .dark body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar-thumb { background-color: var(--color-dark-scrollbar-thumb, #40444b); border-radius: 4px; border: 2px solid var(--color-dark-scrollbar-track, #23272a); }
        .dark #mission_chat_messages::-webkit-scrollbar-thumb:hover, .dark body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar-thumb:hover { background-color: var(--color-dark-scrollbar-thumb-hover, #555a63); }
        .dark #mission_chat_ban_message { background-color: var(--color-dark-ban-bg, #d9534f); color: var(--color-dark-ban-fg, #ffffff); }
        .dark .btn.pull-right[href="/alliance_chats"] { margin: 10px; background-color: var(--color-dark-header-border, #40444b); border: 1px solid var(--color-dark-scrollbar-thumb-hover, #555a63); color: var(--color-dark-header-fg, #f0f0f0); border-radius: 20px; }
        .dark .btn.pull-right[href="/alliance_chats"]:hover { background-color: var(--color-dark-scrollbar-thumb-hover, #555a63); color: var(--color-dark-my-bubble-fg, #ffffff); }

        /* === LIGHT MODE STYLES === */
        body:not(.dark) #chat_panel_heading { background-image: none !important; background-color: var(--color-light-header-bg, #f9f9f9) !important; color: var(--color-light-header-fg, #333333) !important; border-bottom: 1px solid var(--color-light-header-border, #dce1e6); font-weight: bold; padding: 10px 15px; }
        body:not(.dark) #chat_panel_heading .btn-default { background-color: var(--color-light-body-bg, #f0f4f7); border: 1px solid var(--color-light-header-border, #dce1e6); color: var(--color-light-header-fg, #333333); opacity: 0.8; transition: all 0.2s ease; }
        body:not(.dark) #chat_panel_heading .btn-default:hover { opacity: 1; background-color: var(--color-light-chat-bg, #e5eef3); }
        body:not(.dark) #chat_panel_heading .dropdown-menu { background-color: var(--color-light-header-bg, #f9f9f9); border: 1px solid var(--color-light-header-border, #dce1e6); }
        body:not(.dark) #chat_panel_heading .dropdown-menu > li > a { color: var(--color-light-header-fg, #333333); }
        body:not(.dark) #chat_panel_heading .dropdown-menu > li > a:hover { background-color: var(--color-light-my-bubble-bg, #007bff); color: var(--color-light-my-bubble-fg, #ffffff); }
        body:not(.dark) #chat_panel_body, body:not(.dark) #alliance_chat { background-color: var(--color-light-body-bg, #f0f4f7) !important; color: var(--color-light-body-fg, #111111) !important; border: none !important; }
        body:not(.dark) body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9 { background-color: var(--color-light-chat-bg, #e5eef3); border-top: 1px solid var(--color-light-chat-border, #dce1e6); }
        body:not(.dark) #mission_chat_messages { background-color: var(--color-light-chat-bg, #e5eef3); border-top: 1px solid var(--color-light-chat-border, #dce1e6); }
        body:not(.dark) .mission_chat_message_username { font-weight: bold; display: block; margin-bottom: 4px; color: var(--color-light-username-fg, #111111); }
        body:not(.dark) .mission_chat_message_username .chat-username { text-decoration: none; transition: all 0.2s ease; }
        body:not(.dark) .mission_chat_message_username .chat-username:hover { text-decoration: underline; filter: brightness(0.8); }
        body:not(.dark) .chat-message-own:not(.chatWhisper):not(.chatToSelf) .mission_chat_message_username .chat-username,
        body:not(.dark) .well.chat-message-own .mission_chat_message_username .chat-username { color: var(--color-light-my-bubble-fg, #ffffff) !important; }
        body:not(.dark) .chat-timestamp-bubble { background-color: var(--color-light-timestamp-bg, #dce1e6); color: var(--color-light-timestamp-fg, #555555); }
        body:not(.dark) .chat-whisper-divider { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' fill='%23777777'%3E%3Cpath d='M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z'/%3E%3C/svg%3E"); }
        body:not(.dark) .chat-message-own, body:not(.dark) .well.chat-message-own { background-color: var(--color-light-my-bubble_bg, #007bff) !important; color: var(--color-light-my_bubble_fg, #ffffff) !important; }
        body:not(.dark) .chat-message-other, body:not(.dark) .well.chat-message-other { background-color: var(--color-light-other-bubble_bg, #ffffff) !important; color: var(--color-light-other-bubble_fg, #222222) !important; }
        body:not(.dark) #mission_chat_messages li.chatWhisper { background-color: var(--color-light-whisper-bg) !important; border-left: 4px solid var(--color-light-whisper-border) !important; padding-left: 10px !important; color: var(--color-light-whisper-fg) !important; }
        body:not(.dark) #mission_chat_messages li.chatWhisper.chat-message-own { background-color: var(--color-light-my-whisper-bg) !important; color: var(--color-light-my-whisper-fg) !important; }
        body:not(.dark) .whisper-label { background-color: var(--color-light-whisper-label-bg) !important; color: var(--color-light-whisper-label-fg) !important; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin: 0 4px; font-size: 0.9em; }
        body:not(.dark) #mission_chat_messages li.chatToSelf:not(.chatWhisper) { background-color: var(--color-light-my-mention-bubble-bg) !important; border-left: 4px solid var(--color-light-my-mention-bubble-border) !important; padding-left: 10px !important; color: var(--color-light-my-mention-bubble-fg) !important; }
        body:not(.dark) .chat-mention { background-color: var(--color-light-mention-bg, #fff4cc); color: var(--color-light-mention-fg, #664d03); border: 1px solid var(--color-light-mention-border, #ffe69c); }
        body:not(.dark) #new_alliance_chat {
            padding: 10px;
            background-color: var(--color-light-body-bg, #f0f4f7);
            border-top: 1px solid var(--color-light-chat-border, #dce1e6);
            position: relative; /* WICHTIG für absolute Positionierung der Popups */
        }
        body:not(.dark) #new_alliance_chat .input-group-addon { background-color: var(--color-light-input-addon-bg, #007bff); border: 1px solid var(--color-light-input-border, #dce1e6); color: var(--color-light-input-addon-fg, #ffffff); border-radius: 20px 0 0 20px; font-weight: bold; }
        /* Light Mode: Allgemein für Textarea und Input-Feld */
        body:not(.dark) #alliance_chat_message {
            background-color: var(--color-light-input-bg, #ffffff);
            border: 1px solid var(--color-light-input-border, #dce1e6);
            color: var(--color-light-input-fg, #333333);
            border-radius: 0 !important; /* Nur links und rechts von den Addons gerundet */
            padding: 10px 15px;
            height: auto;
            min-height: 38px;
            transition: all 0.2s ease;
            resize: none;
        }
        body:not(.dark) #alliance_chat_message:focus {
            border-color: var(--color-light-input-focus-border, #007bff);
            box-shadow: 0 0 8px var(--color-light-input-focus-shadow, rgba(0, 123, 255, 0.5));
            outline: none;
        }
        body:not(.dark) img.alliance_chat_copy_username { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23777777'%3E%3Cpath d='M115.9 448.9C83.3 408.6 64 358.4 64 304C64 171.5 178.6 64 320 64C461.4 64 576 171.5 576 304C576 436.5 461.4 544 320 544C283.5 544 248.8 536.8 217.4 524L101 573.9C97.3 575.5 93.5 576 89.5 576C75.4 576 64 564.6 64 550.5C64 546.2 65.1 542 67.1 538.3L115.9 448.9zM153.2 418.7C165.4 433.8 167.3 454.8 158 471.9L140 505L198.5 479.9C210.3 474.8 223.7 474.7 235.6 479.6C261.3 490.1 289.8 496 319.9 496C437.7 496 527.9 407.2 527.9 304C527.9 200.8 437.8 112 320 112C202.2 112 112 200.8 112 304C112 346.8 127.1 386.4 153.2 418.7z'/%3E%3C/svg%3E"); }
        body:not(.dark) img.alliance_chat_private_username { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23777777'%3E%3Cpath d='M405.5 349.6C439.2 349.6 487.8 342.7 487.8 302.6C488 295.9 488.7 300.8 466.9 206.4C462.3 187.3 458.2 178.6 424.6 161.8C398.5 148.5 341.7 126.4 324.9 126.4C309.2 126.4 304.7 146.6 286 146.6C268 146.6 254.7 131.5 237.9 131.5C221.8 131.5 211.2 142.5 203.1 165.1C175.6 242.7 176.8 239.4 177 243.4C177 268.2 274.6 349.5 405.5 349.5zM493 318.8C497.7 340.8 497.7 343.1 497.7 346C497.7 383.7 455.4 404.6 399.7 404.6C274 404.7 163.8 331 163.8 282.3C163.8 275.5 165.2 268.8 167.9 262.6C122.7 264.9 64.1 272.9 64.1 324.6C64.1 409.3 264.7 513.6 423.6 513.6C545.4 513.6 576.1 458.5 576.1 415C576.1 380.8 546.5 342 493.2 318.8z'/%3E%3C/svg%3E"); }
        body:not(.dark) img.alliance_chat_copy_username:hover { background-color: var(--color-light-icon-bg-hover, #dce1e6); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23000000'%3E%3Cpath d='M115.9 448.9C83.3 408.6 64 358.4 64 304C64 171.5 178.6 64 320 64C461.4 64 576 171.5 576 304C576 436.5 461.4 544 320 544C283.5 544 248.8 536.8 217.4 524L101 573.9C97.3 575.5 93.5 576 89.5 576C75.4 576 64 564.6 64 550.5C64 546.2 65.1 542 67.1 538.3L115.9 448.9zM153.2 418.7C165.4 433.8 167.3 454.8 158 471.9L140 505L198.5 479.9C210.3 474.8 223.7 474.7 235.6 479.6C261.3 490.1 289.8 496 319.9 496C437.7 496 527.9 407.2 527.9 304C527.9 200.8 437.8 112 320 112C202.2 112 112 200.8 112 304C112 346.8 127.1 386.4 153.2 418.7z'/%3E%3C/svg%3E"); }
        body:not(.dark) img.alliance_chat_private_username:hover { background-color: var(--color-light-icon-bg-hover, #dce1e6); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640' fill='%23000000'%3E%3Cpath d='M405.5 349.6C439.2 349.6 487.8 342.7 487.8 302.6C488 295.9 488.7 300.8 466.9 206.4C462.3 187.3 458.2 178.6 424.6 161.8C398.5 148.5 341.7 126.4 324.9 126.4C309.2 126.4 304.7 146.6 286 146.6C268 146.6 254.7 131.5 237.9 131.5C221.8 131.5 211.2 142.5 203.1 165.1C175.6 242.7 176.8 239.4 177 243.4C177 268.2 274.6 349.5 405.5 349.5zM493 318.8C497.7 340.8 497.7 343.1 497.7 346C497.7 383.7 455.4 404.6 399.7 404.6C274 404.7 163.8 331 163.8 282.3C163.8 275.5 165.2 268.8 167.9 262.6C122.7 264.9 64.1 272.9 64.1 324.6C64.1 409.3 264.7 513.6 423.6 513.6C545.4 513.6 576.1 458.5 576.1 415C576.1 380.8 546.5 342 493.2 318.8z'/%3E%3C/svg%3E"); }
        body:not(.dark) .chat-status-bubble { box-shadow: 0 0 4px #45a12d; }
        body:not(.dark) #mission_chat_messages::-webkit-scrollbar, body:not(.dark) body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar { width: 8px; }
        body:not(.dark) #mission_chat_messages::-webkit-scrollbar-track, body:not(.dark) body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar-track { background: var(--color-light-scrollbar-track, #e5eef3); border-radius: 4px; }
        body:not(.dark) #mission_chat_messages::-webkit-scrollbar-thumb, body:not(.dark) body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar-thumb { background-color: var(--color-light-scrollbar-thumb, #b0c0ce); border-radius: 4px; border: 2px solid var(--color-light-scrollbar-track, #e5eef3); }
        body:not(.dark) #mission_chat_messages::-webkit-scrollbar-thumb:hover, body:not(.dark) body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9::-webkit-scrollbar-thumb:hover { background-color: var(--color-light-scrollbar-thumb-hover, #98a9b9); }
        body:not(.dark) #mission_chat_ban_message { background-color: var(--color-light-ban-bg, #f2dede); color: var(--color-light-ban-fg, #a94442); border: 1px solid var(--color-light-ban-border, #ebccd1); }
        body:not(.dark) .btn.pull-right[href="/alliance_chats"] { margin: 10px; background-color: var(--color-light-header-bg, #f9f9f9); border: 1px solid var(--color-light-header-border, #dce1e6); color: var(--color-light-header-fg, #333333); border-radius: 20px; }
        body:not(.dark) .btn.pull-right[href="/alliance_chats"]:hover { background-color: var(--color-light-chat-bg, #e5eef3); color: var(--color-light-my-bubble-bg, #007bff); }
        /* === NEU: Einsatz-Hervorhebung === */
        .pro-chat-mission-link {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            text-decoration: none !important;
            margin: 2px 0;
            transition: all 0.2s ease;
            font-weight: bold;
            border: 1px solid transparent;
        }
        .pro-chat-mission-link .glyphicon {
            margin-right: 5px;
            font-size: 0.9em;
        }
        /* Dark Mode */
        .dark .pro-chat-mission-link {
            background-color: var(--color-dark-mission-bg);
            color: var(--color-dark-mission-fg) !important;
            border-color: var(--color-dark-mission-border);
        }
        .dark .pro-chat-mission-link .glyphicon {
            color: var(--color-dark-mission-icon-fg);
        }
        .dark .pro-chat-mission-link:hover {
            filter: brightness(1.2);
            text-decoration: none !important;
        }
        /* Light Mode */
        body:not(.dark) .pro-chat-mission-link {
            background-color: var(--color-light-mission-bg);
            color: var(--color-light-mission-fg) !important;
            border-color: var(--color-light-mission-border);
        }
        body:not(.dark) .pro-chat-mission-link .glyphicon {
            color: var(--color-light-mission-icon-fg);
        }
        body:not(.dark) .pro-chat-mission-link:hover {
            filter: brightness(0.95);
            text-decoration: none !important;
        }
        /* === ANPASSUNG FÜR MEHRZEILIGES EINGABEFELD & SMILEY === */

        /* Dark Mode: Stelle sicher, dass resize 'none' ist und setze min-height */
        .dark #alliance_chat_message {
            min-height: 44px; /* Start-Höhe */
            resize: none;
            border-radius: 0 !important; /* Wird von Addons gerundet */
        }

        /* Light Mode: Sende-Button Addon (links) */
        body:not(.dark) #new_alliance_chat .input-group-addon:first-child {
            border-radius: 20px 0 0 20px !important;
        }

        /* Dark Mode: Sende-Button Addon (links) */
        .dark #new_alliance_chat .input-group-addon:first-child {
            border-radius: 20px 0 0 20px !important;
        }

        /* === NEU: SMILEY-BUTTON ADDON (RECHTS) === */
        .pro-chat-smiley-addon {
            padding: 0 !important;
            /* Light Mode */
            background-color: var(--color-light-input-bg, #ffffff) !important;
            border: 1px solid var(--color-light-input-border, #dce1e6) !important;
            border-left: none !important;
            border-radius: 0 20px 20px 0 !important;
        }
        /* Dark Mode */
        .dark .pro-chat-smiley-addon {
             background-color: var(--color-dark-input-bg, #40444b) !important;
             border: none !important;
             border-radius: 0 20px 20px 0 !important;
        }

        #pro_chat_smiley_btn {
             background: transparent !important;
             color: inherit !important;
             border: none !important;
             box-shadow: none !important;
             font-size: 1.5em; /* Größer für Emoji */
             padding: 5px 10px;
             line-height: 1;
             height: 100%;
             transition: none;
        }

        /* Hover-Effekt für den Smiley-Button-Hintergrund */
        .pro-chat-smiley-addon:hover {
            /* Dark Mode */
            background-color: var(--color-dark-icon-bg-hover, #40444b) !important;
        }
        body:not(.dark) .pro-chat-smiley-addon:hover {
            /* Light Mode */
            background-color: var(--color-light-icon-bg-hover, #dce1e6) !important;
        }

        /* === NEU: SMILEY-CONTAINER POPUP (KORRIGIERTE POSITION) === */
        #pro_chat_smiley_container {
            position: absolute;
            bottom: 50px; /* Positioniert 50px über dem unteren Rand des Formulars */
            right: 5px; /* Positioniert 5px vom rechten Rand des Formulars */
            width: 270px;
            padding: 10px;
            /* Dark Mode */
            background-color: var(--color-dark-body-bg, #2c2f33);
            border: 1px solid var(--color-dark-header-border, #40444b);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border-radius: 8px;
            z-index: 1000;
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 5px;
        }
        body:not(.dark) #pro_chat_smiley_container {
             /* Light Mode */
             background-color: var(--color-light-other-bubble_bg, #ffffff);
             border: 1px solid var(--color-light-header-border, #dce1e6);
             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .pro-chat-smiley-item {
            font-size: 1.5em;
            text-align: center;
            cursor: pointer;
            padding: 5px;
            border-radius: 4px;
            transition: background-color 0.1s;
        }

        .pro-chat-smiley-item:hover {
            /* Dark Mode */
            background-color: var(--color-dark-icon-bg-hover, #40444b);
        }
        body:not(.dark) .pro-chat-smiley-item:hover {
             /* Light Mode */
            background-color: var(--color-light-icon-bg-hover, #dce1e6);
        }

        /* === PAGE-LOADER STYLES === */
        #lss_load_more_container { text-align: center; padding: 20px 0; }
        #lss_load_more_btn { background-color: #337ab7; color: white; border: 1px solid #2e6da4; padding: 10px 16px; font-size: 18px; border-radius: 6px; cursor: pointer; }
        #lss_load_more_btn:disabled { background-color: #555; cursor: not-allowed; opacity: 0.65; }
        .lss-page-divider { text-align: center; color: #aaa; font-weight: bold; border-bottom: 1px solid #555; line-height: 0.1em; margin: 20px 0; }
        .lss-page-divider span { background: var(--color-dark-chat-bg, #23272a); padding: 0 10px; } /* Fallback */
        body:not(.dark) .lss-page-divider span { background: var(--color-light-chat-bg, #e5eef3); } /* Fallback */

        /* === BILD-VORSCHAU UND MODAL STYLES (v4.4.9) === */
        .pro-chat-image-preview-container {
            display: inline-block;
            max-width: 150px;
            max-height: 150px;
            border-radius: 8px;
            overflow: hidden;
            margin: 5px 0;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            line-height: 0;
            transition: transform 0.1s ease;
        }
        .pro-chat-image-preview-container:hover {
             transform: scale(1.03);
        }
        .pro-chat-image-preview {
            width: 100%;
            height: auto;
            display: block;
            min-height: 50px;
            object-fit: cover;
        }
        .pro-chat-modal-image {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.9);
            justify-content: center;
            align-items: center;
        }
        .pro-chat-modal-image-content {
            position: relative;
            margin: auto;
            max-width: 90%;
            max-height: 90%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        #proChatImageModalImage {
            max-width: 100%;
            max-height: 85vh;
            display: block;
            border-radius: 5px;
            object-fit: contain;
        }
        .pro-chat-modal-image-close {
            position: absolute;
            top: 15px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            transition: 0.3s;
            cursor: pointer;
        }
        .pro-chat-modal-image-close:hover,
        .pro-chat-modal-image-close:focus {
            color: #bbb;
            text-decoration: none;
            cursor: pointer;
        }
        #proChatImageModalLink {
            margin-top: 10px;
            background-color: #337ab7;
            border-color: #2e6da4;
            color: white;
            padding: 8px 15px;
            border-radius: 5px;
            text-decoration: none;
        }

        /* === NEU: @-MENTION AUTOVERVOLLSTÄNDIGUNG STYLES (KORRIGIERTE POSITION) === */
        /* Das Elternelement #new_alliance_chat ist position: relative */
        .pro-chat-suggestion-container {
            position: absolute; /* Relative zur #chat_panel_body, wo es angehängt wird */
            max-height: 100px;
            overflow-y: auto;
            background-color: var(--color-dark-body-bg, #2c2f33);
            border: 1px solid var(--color-dark-header-border, #40444b);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border-radius: 8px;
            z-index: 999;
        }
        body:not(.dark) .pro-chat-suggestion-container {
             background-color: var(--color-light-other-bubble_bg, #ffffff);
             border: 1px solid var(--color-light-header-border, #dce1e6);
             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .pro-chat-suggestion-item {
            padding: 8px 15px;
            cursor: pointer;
            font-weight: normal;
            transition: background-color 0.1s;
            color: var(--color-dark-other-bubble-fg, #dcddde);
            white-space: nowrap;
        }
        body:not(.dark) .pro-chat-suggestion-item {
             color: var(--color-light-other-bubble_fg, #222222);
        }


        .pro-chat-suggestion-item:hover,
        .pro-chat-suggestion-item.selected {
            background-color: var(--color-dark-icon-bg-hover, #40444b);
            color: var(--color-dark-header-fg, #f0f0f0);
        }
        body:not(.dark) .pro-chat-suggestion-item:hover,
        body:not(.dark) .pro-chat-suggestion-item.selected {
            background-color: var(--color-light-icon-bg-hover, #dce1e6);
            color: var(--color-light-header-fg, #333333);
        }
    `;
    GM_addStyle(mergedStyles);


    // === GLOBALER OBSERVER ===
    const globalObserver = new MutationObserver(function(mutations) {
        let needsCounterUpdate = false;
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                // Admin-Erkennung
                node.querySelectorAll('a.chat-username.chat-username-dark').forEach(detectAndExcludeAdmin);
                if (node.matches && node.matches('a.chat-username.chat-username-dark')) { detectAndExcludeAdmin(node); }
                // Relevante Elemente verarbeiten
                 const relevantSelectors = [
                    '.well[data-message-time]', 'li[data-message-time]', '.chat-message-row',
                    'tr:has(a[href^="/profile/"])', 'li:has(a[href^="/profile/"])',
                    '.forum_post', '.mission_list_siver'
                 ];
                 let elementsToProcess = [];
                 if(node.matches && node.matches(relevantSelectors.join(', '))) { elementsToProcess.push(node); }
                 node.querySelectorAll(relevantSelectors.join(', ')).forEach(el => elementsToProcess.push(el));
                 elementsToProcess.forEach(el => {
                     processAndBlockElement(el);
                     needsCounterUpdate = true;
                 });

                 // NEU (v4.4.9): Fange alle neu hinzugefügten Bildvorschauen ab und registriere den Klick-Handler
                 node.querySelectorAll('.pro-chat-image-preview-container').forEach(container => {
                     if (!container.dataset.clickHandlerAttached) {
                         container.addEventListener('click', (e) => {
                             e.preventDefault();
                             e.stopPropagation(); // Verhindert, dass der Klick die Blase schließt, falls implementiert
                             const imageUrl = container.dataset.imageUrl;
                             if (imageUrl) openImageModal(imageUrl);
                         });
                         container.dataset.clickHandlerAttached = 'true';
                     }
                 });
            });
            // Entfernte Nodes
            if (mutation.removedNodes.length > 0) {
                 mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.lssBlocked === 'true') {
                        needsCounterUpdate = true;
                    }
                 });
            }
        });
        if (needsCounterUpdate) {
             // Kurze Verzögerung, um sicherzustellen, dass alle DOM-Änderungen abgeschlossen sind
             setTimeout(() => applyBlockStatusToAllElements(), 50);
        }
    });


    // === START ===

    console.log("[ChatPro] Script starting...");

    // *** WICHTIG *** Cache-Zeitpunkt löschen, um Neuladen der vollständigen Liste zu erzwingen
    await GM_setValue(USERS_CACHE_TIME_KEY, 0);
    console.log("[ChatPro] Erzwinge Neuladen der Verbandsmitgliederliste...");

    // 1. Alle Einstellungen laden
    await loadSettings();

    // 2. Allianz-User laden (Muss nun alle Seiten abrufen)
    await loadAllianceUsers();

    // 3. Farb-CSS-Variablen anwenden
    applyChatSettings(currentSettings);
    console.log("[ChatPro] Color settings applied.");

    // 4. Bild-Modal vorbereiten (wird erst bei Klick sichtbar)
    createImageModal();

    // 5. Kombinierte Einstellungs-UI erstellen (Modal + Header Controls)
    // Warte, bis der Header wahrscheinlich da ist
    setTimeout(() => {
        try {
            createSettingsUI();
            console.log("[ChatPro] Settings UI created.");

            // HIER DIE NEUE FUNKTION AUFRUFEN
            replaceInputWithTextarea();

        } catch (e) {
             console.error("[ChatPro] Error creating Settings UI:", e);
        }
    }, 1000);
    // 6. Globale Variablen setzen
    myUsername = getMyUsername();
    isDark = document.body.classList.contains('dark');
    console.log(`[ChatPro] myUsername: ${myUsername}, isDark: ${isDark}`);

    // 7. Initialer Scan & Zähler-Update
    try {
        console.log("[ChatPro] Starting initial scan...");
        document.querySelectorAll('a.chat-username.chat-username-dark').forEach(detectAndExcludeAdmin);
        // Verzögert starten, um sicherzustellen, dass die UI (insb. die Counter-Spans) existiert
        setTimeout(() => {
            console.log("[ChatPro] Running delayed initial applyBlockStatusToAllElements...");
            applyBlockStatusToAllElements();
        }, 1200); // Etwas später als UI-Erstellung
    } catch (e) {
        console.error("[ChatPro] Fehler beim initialen Scan.", e);
    }

    // 8. Paginierungs-Setup für /alliance_chats
    if (window.location.pathname.startsWith('/alliance_chats')) {
        console.log("[ChatPro] Alliance chats page detected, setting up multi-page loader...");
        setTimeout(() => {
            try {
                 setupMultiPageLoader();
                 console.log("[ChatPro] Multi-page loader setup complete.");
            } catch(e) {
                 console.error("[ChatPro] Error setting up multi-page loader:", e);
            }
        }, 500); // Kurze Verzögerung für UI-Elemente
    }

    // 9. Globalen Observer starten
    try {
        globalObserver.observe(document.body, { childList: true, subtree: true });
        console.log("[ChatPro] Global observer started.");
    } catch (e) {
        console.error("[ChatPro] Error starting global observer:", e);
    }
    // 10. Globalen Klick-Listener für Flüster- & Reply-Icons hinzufügen
    document.addEventListener('click', (e) => {
        // Prüfe, ob auf ein Whisper-Icon (<a> oder <img>) ODER ein Reply-Icon (<img>) geklickt wurde
        const whisperIcon = e.target.closest('a.alliance_chat_private_username, img.alliance_chat_private_username');
        const replyIcon = e.target.closest('img.alliance_chat_copy_username');

        // Prüfe auch, ob unser Textfeld schon existiert
        if ((whisperIcon || replyIcon) && proChatTextarea) {

            // Warte 50ms, damit das Spiel-Skript das /w... oder @... in das Feld einfügen kann
            setTimeout(() => {
                // Erzwinge ein 'input'-Event auf unserem Textfeld.
                // Das löst unsere neue Logik im input-Listener aus.
                proChatTextarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            }, 50); // 50ms ist meist ausreichend
        }

        // Klick außerhalb des Mention-Containers schließt diesen
        if (suggestionContainer && suggestionContainer.style.display === 'block' &&
            !suggestionContainer.contains(e.target) && e.target !== proChatTextarea) {
             hideSuggestions();
        }
    });

    console.log("[ChatPro] Script initialized."); // DEBUG END

})();
