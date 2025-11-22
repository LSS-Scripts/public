// ==UserScript==
// @name         LSS - Moderner Chat Pro & Status (v5.4.0 - Linkify Fix)
// @namespace    http://tampermonkey.net/
// @version      5.4.1
// @description  Chat v4.6.6 Design + API-Status. Fix: Links, Bilder und Mentions funktionieren wieder wie im Original.
// @author       B&M (Gemischt von Gemini)
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

    // ========================================================================
    // 0. API ENGINE
    // ========================================================================
    const API = {
        data: [],
        lastUpdate: 0,
        interval: 5 * 60 * 1000,
        storageKey: 'LSS_ChatPro_API_Cache_v4',

        fetch: async function() {
            const now = Date.now();
            if (this.data.length > 0 && (now - this.lastUpdate) < this.interval) return;
            
            const cachedRaw = await GM_getValue(this.storageKey, null);
            if (cachedRaw) {
                try {
                    const c = JSON.parse(cachedRaw);
                    if ((now - c.ts) < this.interval) {
                        this.data = c.data; this.lastUpdate = c.ts;
                        updateGlobalUsers();
                        if(document.body) document.body.dispatchEvent(new CustomEvent('lss_user_update'));
                        return;
                    }
                } catch(e){}
            }

            return new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'GET', url: '/api/allianceinfo', headers: { "Accept": "application/json" },
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            try {
                                const json = JSON.parse(res.responseText);
                                this.data = json.users.map(u => ({
                                    id: u.id.toString(),
                                    name: u.name,
                                    online: u.online,
                                    isAdmin: (u.role_flags.owner || u.role_flags.admin || u.role_flags.coadmin)
                                }));
                                this.lastUpdate = Date.now();
                                GM_setValue(this.storageKey, JSON.stringify({ ts: this.lastUpdate, data: this.data }));
                                updateGlobalUsers();
                                if(document.body) document.body.dispatchEvent(new CustomEvent('lss_user_update'));
                                resolve(true);
                            } catch(e) { resolve(false); }
                        } else resolve(false);
                    },
                    onerror: () => resolve(false)
                });
            });
        },
        getUser: function(id) { return this.data.find(u => u.id === id.toString()); }
    };

    function updateGlobalUsers() {
        allianceUsers = API.data;
    }

    // ========================================================================
    // 1. CONFIG & VARS
    // ========================================================================
    const COLOR_STORAGE_KEY = 'LSS_ProChat_Settings';
    const BLOCKER_ENABLED_KEY = 'blocker_enabled';
    const BLOCKER_IDS_KEY = 'blocker_id_string';

    let myUsername = null;
    let isDark = false;
    let currentSettings = {};
    let modalElement = null;
    let proChatTextarea = null;
    let smileyButton = null;
    let smileyContainer = null;
    let imageModal = null;
    let imageModalContent = null;
    let isBlockerEnabled = false;
    let blockedIdString = '';
    let blockedIdArray = [];
    let allianceUsers = []; 
    let suggestionContainer = null;
    let apiIntervalHandle = null;

    const SMILEY_MAP = {':)':'😊',':-)':'😊',':(':'🙁',':-(':'🙁',';)':'😉',';-)':'😉',':D':'😃',':-D':'😃','XD':'🤣','x)':'🤣','xD':'😂',':o':'😮',':-o':'😮',':*':'😘',':-*':'😘','o.O':'🤔','O.o':'🤔',':p':'🤪',':P':'🤪',':-p':'🤪',':-P':'🤪','8)':'😎','8-)':'😎','<3':'❤️','O:)':'😇','O:-)':'😇','^^':'😀',':/':'😒',':-/':'😒','T_T':'😭',';(':'😢',':\'(':'😢',':|':'😐',':-|':'😐','>:(':'😡','>:-(':'😡','B)':'🤓','B-)':'🤓','P:':'💩'};
    const UNICODE_SMILIES = [
        '😃', '😂', '🤣', '😉', '😊', '🤔', '😮', '🙁', '😡', '😢',
'😭', '😈', '💩', '😍', '😘', '😎', '🤩', '🥳', '🥶', '🥵',
'😴', '🤪', '🤭', '🤫', '🤥', '😬', '🤒', '🤕', '🤯', '😵',
'💀', '🤷', '🤤', '🚑', '🚒', '🚓', '🚁', '🚚', '🚛', '🚨', '👨‍🚒', '👩‍🚒', '👮',
'👮‍♀️', '👮‍♂️', '🧑‍⚕️', '👷', '🧑‍🔧', '⛑️', '🦺', '🗣️', '🤷‍♀️',
'🏡', '🏢', '🏥', '🏦', '🏫',
'🔥', '💨', '💥', '💣', '⚡', '💧', '🌊', '🚧', '⚠️', '☢️',
'☣️', '💉', '💊', '🩹', '🩸', '🩺', '😷', '🥽', '🧤', '🪓',
'🔪', '🛢️', '🛏️', '🦼', '📄', '💬',
'🍕', '🍔', '🥐', '🌮', '🍪', '☕', '🍺', '🍾', '🍎', '🍇',
'🍉', '🍌', '🐕', '🐈', '🌳', '🌲', '☀️', '🌙', '🌟', '🌈',
'🌧️', '☔', '❄️', '💨', '🌬️',
'🛠️', '⚙️', '🔗', '🔒', '🔑', '🔨', '🔦', '📻', '📞', '🔋',
'💻', '📱', '⌚', '📚', '💰', '💵', '🎁', '🎈', '💍', '⚽',
'🎤', '🎼', '🎲', '✈️', '🚂', '⏎', '⇧', '☝️', '👍', '👎',
'🙏', '👋', '👏', '✊', '✋', '🛑', '🚫', '✅', '❌', '❕',
'❓', '❗', '⬆️', '⬇️', '👈', '👉', '👆', '👇', '🖕', '⏱️',
'⏳', '📅', '🗺️', '⭐', '🎉', '❤️', '💯'
    ];

    const defaultColors = {
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
        'dark_icon_bg_hover': '#40444b', 'dark_mission_bg': '#5865f2', 'dark_mission_fg': '#ffffff', 'dark_mission_border': '#4e5bd0', 'dark_mission_icon_fg': '#ffffff',
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
        'light_mission_bg': '#e6f0ff', 'light_mission_fg': '#0056b3', 'light_mission_border': '#b3d1ff', 'light_mission_icon_fg': '#007bff',
    };

    // ========================================================================
    // 2. HELPERS & SETTINGS LOGIC
    // ========================================================================
    function createImageModal() {
        if (imageModal) return;
        imageModal = document.createElement('div'); imageModal.id = 'proChatImageModal'; imageModal.className = 'pro-chat-modal-image'; imageModal.style.display = 'none';
        imageModal.innerHTML = `<div class="pro-chat-modal-image-content"><span id="proChatImageModalCloseBtn" class="pro-chat-modal-image-close">&times;</span><img id="proChatImageModalImage" src=""><a id="proChatImageModalLink" href="#" target="_blank" class="btn btn-primary btn-sm">Original</a></div>`;
        document.body.appendChild(imageModal);
        imageModalContent = document.getElementById('proChatImageModalImage');
        document.getElementById('proChatImageModalCloseBtn').onclick = closeImageModal;
        imageModal.onclick = (e) => { if (e.target === imageModal) closeImageModal(); };
    }
    function openImageModal(url) { if (!imageModal) createImageModal(); imageModalContent.src = url; document.getElementById('proChatImageModalLink').href = url; imageModal.style.display = 'flex'; }
    function closeImageModal() { if (imageModal) { imageModal.style.display = 'none'; imageModalContent.src = ''; } }
    
    async function loadSettings() {
        isBlockerEnabled = await GM_getValue(BLOCKER_ENABLED_KEY, false);
        blockedIdString = await GM_getValue(BLOCKER_IDS_KEY, '');
        blockedIdArray = blockedIdString ? blockedIdString.split(',').filter(x=>x).map(x=>x.trim()) : [];
        try { const s = JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY)); currentSettings = { ...defaultColors, ...s }; } catch (e) { currentSettings = { ...defaultColors }; }
    }
    function saveChatSettings(s) { currentSettings = s; localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(s)); }
    function applyChatSettings(s) {
        let c = ':root {\n'; for (const [k, v] of Object.entries(s)) c += `    --color-${k.replace(/_/g, '-')}: ${v};\n`; c += '}';
        const old = document.getElementById('pro-chat-dynamic-styles'); if (old) old.remove();
        const el = document.createElement("style"); el.id = 'pro-chat-dynamic-styles'; el.type="text/css"; el.innerText = c; document.head.appendChild(el);
    }
    async function saveBlockedIds() { blockedIdString = blockedIdArray.join(','); await GM_setValue(BLOCKER_IDS_KEY, blockedIdString); }

    // ========================================================================
    // 3. SETTINGS UI
    // ========================================================================
    function createSettingsUI() {
        const link = document.querySelector('a[href="/alliance_chats"].lightbox-open');
        if (link) { link.classList.remove('lightbox-open'); link.target = '_blank'; link.rel = 'noopener noreferrer'; }

        const createRow = (key, label) => {
            const d = document.createElement('div'); d.className = 'pro-chat-setting-row';
            d.innerHTML = `<label for="color_${key}">${label}</label><input type="color" id="color_${key}" value="${currentSettings[key]}"><button type="button" class="pro-chat-reset-btn" title="Zurücksetzen">&#8634;</button>`;
            d.querySelector('input').oninput = (e) => { currentSettings[key] = e.target.value; applyChatSettings(currentSettings); saveChatSettings(currentSettings); };
            d.querySelector('button').onclick = () => { currentSettings[key] = defaultColors[key]; d.querySelector('input').value = defaultColors[key]; applyChatSettings(currentSettings); saveChatSettings(currentSettings); };
            return d;
        };

        const modal = document.createElement('div'); modal.id = 'proChatSettingsModal'; modalElement = modal;
        modal.innerHTML = `
            <div class="pro-chat-modal-content">
                <div class="pro-chat-modal-header"><h3>Chat-Einstellungen</h3><button id="proChatCloseBtn" class="pro-chat-close-btn" title="Schließen">&times;</button></div>
                <div class="pro-chat-modal-body">
                    <details open><summary>User-Blocker</summary>
                        <fieldset><legend>Steuerung</legend><div class="pro-chat-setting-row" style="grid-template-columns: auto 1fr auto;"><label for="lss_blocker_modal_toggle" style="font-weight:bold;">User-Blocker aktiv:</label>${createBlockerToggleHTML('lss_blocker_modal_toggle')}</div></fieldset>
                        <fieldset><legend>Geblockte User</legend>
                            <div class="pro-chat-setting-row" style="grid-template-columns: 1fr auto;"><input type="text" id="lss_blocker_name_input" placeholder="Name..." list="lss_blocker_userlist"><button id="lss_blocker_name_add_btn">Hinzufügen</button></div>
                            <datalist id="lss_blocker_userlist"></datalist><ul id="lss_blocker_id_list"></ul>
                        </fieldset>
                    </details>
                    <details><summary>Dark Mode Farben</summary><fieldset><legend>Allgemein</legend><div id="sg-dark-gen"></div></fieldset><fieldset><legend>Standard-Blasen</legend><div id="sg-dark-bub"></div></fieldset><fieldset><legend>Flüstern & Erwähnungen</legend><div id="sg-dark-whi"></div></fieldset><fieldset><legend>Eingabefeld & Scrollbar</legend><div id="sg-dark-inp"></div></fieldset></details>
                    <details><summary>Light Mode Farben</summary><fieldset><legend>Allgemein</legend><div id="sg-light-gen"></div></fieldset><fieldset><legend>Standard-Blasen</legend><div id="sg-light-bub"></div></fieldset><fieldset><legend>Flüstern & Erwähnungen</legend><div id="sg-light-whi"></div></fieldset><fieldset><legend>Eingabefeld & Scrollbar</legend><div id="sg-light-inp"></div></fieldset></details>
                </div>
                <div class="pro-chat-modal-footer"><button id="proChatResetAllBtn">Alle Farben zurücksetzen</button></div>
            </div>`;
        document.body.appendChild(modal);

        const groups = {
            'sg-dark-gen': [['dark_header_bg','Header-Hintergrund'],['dark_header_fg','Header-Text'],['dark_chat_bg','Chat-Hintergrund'],['dark_username_fg','Name (Andere)'],['dark_timestamp_bg','Zeitstempel-Hintergrund'],['dark_timestamp_fg','Zeitstempel-Text'],['dark_ban_bg','Ban-Info Hintergrund'],['dark_ban_fg','Ban-Info Text']],
            'sg-dark-bub': [['dark_my_bubble_bg','Meine Blase (Hintergrund)'],['dark_my_bubble_fg','Meine Blase (Text)'],['dark_other_bubble_bg','Andere Blase (Hintergrund)'],['dark_other_bubble_fg','Andere Blase (Text)']],
            'sg-dark-whi': [['dark_whisper_bg','Flüstern-Blase (Hintergrund)'],['dark_whisper_fg','Flüstern-Blase (Text)'],['dark_whisper_border','Flüstern-Blase (Rand)'],['dark_my_whisper_bg','Eigene Flüstern-Blase (BG)'],['dark_my_whisper_fg','Eigene Flüstern-Blase (Text)'],['dark_whisper_label_bg','Flüstern-Label (Hintergrund)'],['dark_whisper_label_fg','Flüstern-Label (Text)'],['dark_my_mention_bubble_bg','Eigene @-Blase (Hintergrund)'],['dark_my_mention_bubble_fg','Eigene @-Blase (Text)'],['dark_my_mention_bubble_border','Eigene @-Blase (Rand)'],['dark_mention_bg','Text-Mention (Hintergrund)'],['dark_mention_fg','Text-Mention (Text)'],['dark_mission_bg','Einsatz-Link (Hintergrund)'],['dark_mission_fg','Einsatz-Link (Text)'],['dark_mission_border','Einsatz-Link (Rand)'],['dark_mission_icon_fg','Einsatz-Link (Icon)']],
            'sg-dark-inp': [['dark_input_bg','Eingabefeld (Hintergrund)'],['dark_input_fg','Eingabefeld (Text)'],['dark_input_addon_bg','Senden-Button (Hintergrund)'],['dark_input_addon_fg','Senden-Button (Text)'],['dark_input_focus_bg','Eingabefeld (Fokus-BG)'],['dark_input_focus_shadow','Eingabefeld (Fokus-Schatten)'],['dark_scrollbar_track','Scrollbar (Track)'],['dark_scrollbar_thumb','Scrollbar (Thumb)'],['dark_icon_bg_hover','Icon-Hover (Hintergrund)']],
            'sg-light-gen': [['light_header_bg','Header-Hintergrund'],['light_header_fg','Header-Text'],['light_chat_bg','Chat-Hintergrund'],['light_username_fg','Name (Andere)'],['light_timestamp_bg','Zeitstempel-Hintergrund'],['light_timestamp_fg','Zeitstempel-Text'],['light_ban_bg','Ban-Info Hintergrund'],['light_ban_fg','Ban-Info Text'],['light_ban_border','Ban-Info Rand']],
            'sg-light-bub': [['light_my_bubble_bg','Meine Blase (Hintergrund)'],['light_my_bubble_fg','Meine Blase (Text)'],['light_other_bubble_bg','Andere Blase (Hintergrund)'],['light_other_bubble_fg','Andere Blase (Text)']],
            'sg-light-whi': [['light_whisper_bg','Flüstern-Blase (Hintergrund)'],['light_whisper_fg','Flüstern-Blase (Text)'],['light_whisper_border','Flüstern-Blase (Rand)'],['light_my_whisper_bg','Eigene Flüstern-Blase (BG)'],['light_my_whisper_fg','Eigene Flüstern-Blase (Text)'],['light_whisper_label_bg','Flüstern-Label (Hintergrund)'],['light_whisper_label_fg','Flüstern-Label (Text)'],['light_my_mention_bubble_bg','Eigene @-Blase (Hintergrund)'],['light_my_mention_bubble_fg','Eigene @-Blase (Text)'],['light_my_mention_bubble_border','Eigene @-Blase (Rand)'],['light_mention_bg','Text-Mention (Hintergrund)'],['light_mention_fg','Text-Mention (Text)'],['light_mention_border','Text-Mention (Rand)'],['light_mission_bg','Einsatz-Link (Hintergrund)'],['light_mission_fg','Einsatz-Link (Text)'],['light_mission_border','Einsatz-Link (Rand)'],['light_mission_icon_fg','Einsatz-Link (Icon)']],
            'sg-light-inp': [['light_input_bg','Eingabefeld (Hintergrund)'],['light_input_fg','Eingabefeld (Text)'],['light_input_border','Eingabefeld (Rand)'],['light_input_addon_bg','Senden-Button (Hintergrund)'],['light_input_addon_fg','Senden-Button (Text)'],['light_input_focus_border','Eingabefeld (Fokus-Rand)'],['light_input_focus_shadow','Eingabefeld (Fokus-Schatten)'],['light_scrollbar_track','Scrollbar (Track)'],['light_scrollbar_thumb','Scrollbar (Thumb)'],['light_icon_bg_hover','Icon-Hover (Hintergrund)']]
        };
        for(const [id,items] of Object.entries(groups)){ const c=document.getElementById(id); items.forEach(i=>c.appendChild(createRow(i[0],i[1]))); }

        const head = document.getElementById('chat_panel_heading');
        if(head) {
            const d = document.createElement('div'); d.className='pro-chat-header-controls-left';
            d.innerHTML = `<button id="proChatSettingsBtn" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-cog"></span></button><label class="lss-switch lss-switch-xs"><input type="checkbox" id="lss_blocker_header_toggle"><span class="lss-slider"></span></label><span id="lss_blocker_header_count" class="lss-blocker-count"></span>`;
            d.querySelector('button').onclick = () => { modalElement.style.display='block'; populateBlockerList(); };
            d.querySelector('input').onchange = handleToggleChange;
            head.prepend(d);
        }

        document.getElementById('proChatCloseBtn').onclick = () => modal.style.display='none';
        document.getElementById('proChatResetAllBtn').onclick = () => { if(confirm('Reset?')) { saveChatSettings(defaultColors); location.reload(); } };
        const tgl = document.getElementById('lss_blocker_modal_toggle'); if(tgl) { tgl.checked = isBlockerEnabled; tgl.onchange = handleToggleChange; }
        const headTgl = document.getElementById('lss_blocker_header_toggle'); if(headTgl) headTgl.checked = isBlockerEnabled;
        document.getElementById('lss_blocker_name_add_btn').onclick = addBlockedUserByName;
        const dl = document.getElementById('lss_blocker_userlist');
        if(dl && allianceUsers) allianceUsers.forEach(u => { const o = document.createElement('option'); o.value = u.name; dl.appendChild(o); });
    }

    function createBlockerToggleHTML(id, extraClass = '') { return `<label class="lss-switch ${extraClass}" title="User-Blocker An/Aus" style="margin-right: auto;"><input type="checkbox" id="${id}" ${isBlockerEnabled ? 'checked' : ''}><span class="lss-slider"></span></label>`; }
    async function handleToggleChange(e) { isBlockerEnabled = e.target.checked; await GM_setValue(BLOCKER_ENABLED_KEY, isBlockerEnabled); document.querySelectorAll('input[type=checkbox][id^="lss_blocker_"]').forEach(c => c.checked = isBlockerEnabled); applyBlockStatusToAllElements(); }
    function populateBlockerList() {
        const ul = document.getElementById('lss_blocker_id_list'); if (!ul) return; ul.innerHTML = '';
        blockedIdArray.forEach(id => { const u = allianceUsers.find(x => x.id === id); const li = document.createElement('li'); li.innerHTML = `<span>${u ? u.name : id}</span> <button data-id="${id}">Löschen</button>`; li.querySelector('button').onclick = (e) => { blockedIdArray = blockedIdArray.filter(x => x !== e.target.dataset.id); saveBlockedIds(); populateBlockerList(); applyBlockStatusToAllElements(); }; ul.appendChild(li); });
    }
    function addBlockedUserByName() {
        const val = document.getElementById('lss_blocker_name_input').value.trim();
        const u = allianceUsers.find(x => x.name.toLowerCase() === val.toLowerCase());
        if (!u) return alert('User nicht gefunden');
        if (u.isAdmin) return alert('Admin kann nicht geblockt werden');
        if (!blockedIdArray.includes(u.id)) { blockedIdArray.push(u.id); saveBlockedIds(); populateBlockerList(); applyBlockStatusToAllElements(); }
        document.getElementById('lss_blocker_name_input').value = '';
    }

    // ========================================================================
    // 4. CHAT LOGIC (ORIGINAL Linkify RESTORED)
    // ========================================================================
    function getUsernameColor(u, d) { if (!u) return '#ccc'; let h = 0; for (let i = 0; i < u.length; i++) h = u.charCodeAt(i) + ((h << 5) - h); return `hsl(${h % 360},${d ? '70%' : '60%'},${d ? '75%' : '45%'})`; }
    function shouldBlockUser(id) { if (!id || !isBlockerEnabled) return false; const u = allianceUsers.find(x => x.id === id); if (u && u.isAdmin) return false; return blockedIdArray.includes(id); }
    
    // ORIGINAL LINKIFY (Source 2, Lines 146-150)
    function linkifyText(text) {
        const urlRegex = /(\b(?:https?:\/\/\S+|www\.\S+\.[a-z]{2,}(?:\S+)?|\S+\.[a-z]{2,}(?:\/\S*)?))/gi;
        const imageExtensions = /\.(png|jpe?g|gif|bmp|webp|tiff|svg)$/i;
        return text.replace(urlRegex, (url) => {
            let href = url;
            if (!url.match(/^https?:\/\//i)) { href = 'https://' + url; }
            if (href.match(imageExtensions)) {
                 return `<span class="pro-chat-image-preview-container" data-image-url="${href}"><img src="${href}" class="pro-chat-image-preview" alt="Bildvorschauklick"></span>`;
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    // BUBBLE HELPER
    function insertStatusBubble(linkElement, profileId) {
        const user = allianceUsers.find(x => x.id === profileId);
        if (user && !linkElement.parentNode.querySelector('.chat-status-bubble')) {
             const s = document.createElement('span');
             s.className = `chat-status-bubble chat-status-${user.online ? 'online' : 'offline'}`;
             s.title = user.online ? 'Online' : 'Offline';
             linkElement.parentNode.insertBefore(s, linkElement);
        }
    }

    // ORIGINAL PROCESS MAIN CHAT (Source 2 Logic + Status Bubbles)
    function processMainChatMessage(node) {
        if (node.dataset.proChatFormatted) return;
        if (node.nodeType !== 1 || node.tagName !== 'LI') return;
        const usernameSpan = node.querySelector('.mission_chat_message_username');
        if (!usernameSpan) return;

        // 1. Timestamp
        if (usernameSpan.firstChild && usernameSpan.firstChild.nodeType === 3 && usernameSpan.firstChild.textContent.includes('[')) {
            const text = usernameSpan.firstChild.textContent.trim().replace(/[\[\]]/g, '');
            const bubble = document.createElement('span');
            bubble.className = 'chat-timestamp-bubble';
            bubble.textContent = text;
            usernameSpan.firstChild.replaceWith(bubble);
        }
        
        node.querySelectorAll('img.alliance_chat_copy_username, a.alliance_chat_private_username, img.alliance_chat_private_username').forEach(el => el.setAttribute('title', ''));

        // 3. Sender/Empfänger & Status
        const usernameLink = usernameSpan.querySelector('a.chat-username');
        if (usernameLink) {
            const username = usernameLink.innerText.replace(':', '').trim();
            usernameLink.style.color = getUsernameColor(username, isDark);
            
            if (myUsername && username === myUsername) {
                node.classList.add('chat-message-own');
                const myReplyIcon = usernameSpan.querySelector('img.alliance_chat_copy_username');
                const myWhisperLink = usernameSpan.querySelector('a.alliance_chat_private_username');
                if (myReplyIcon) myReplyIcon.style.display = 'none';
                if (myWhisperLink) myWhisperLink.style.display = 'none';
            } else {
                node.classList.add('chat-message-other');
            }
            
            // Status Bubble
            insertStatusBubble(usernameLink, usernameLink.href.split('/').pop());
        }

        // 4. Whisper-Empfänger
        if (node.classList.contains('chatWhisper')) {
            const recipientIcon = node.querySelector(':scope > a.alliance_chat_private_username');
            const recipientLabel = node.querySelector(':scope > a.whisper-label');
            const recipientStatus = node.querySelector(':scope > span.chat-status-bubble'); // Falls original vorhanden
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

        // 5. Highlight @Mentions UND Linkify (ORIGINAL LOGIK Source 2)
        const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === 3 && usernameSpan && !usernameSpan.contains(child)) {
                let text = child.textContent;
                text = linkifyText(text); // Linkify FIRST -> HTML String
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = text;
                
                const finalFragment = document.createDocumentFragment();
                Array.from(tempDiv.childNodes).forEach(procNode => {
                    // Mentions nur in Textnodes suchen, nicht in Links
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
                        // Link oder Bild-Vorschau
                        finalFragment.appendChild(procNode);
                    }
                });
                
                child.replaceWith(finalFragment);
            }
        }
        
        // Event Listener für Bilder nachträglich anhängen
        node.querySelectorAll('.pro-chat-image-preview-container').forEach(c => {
             if(!c.onclick) c.onclick = (e) => { e.preventDefault(); openImageModal(c.dataset.imageUrl); };
        });

        // 6. @Mention verschieben (Original Source 2)
        if (!node.classList.contains('chatWhisper')) {
            const mentionSpans = node.querySelectorAll('span.chat-mention');
            let firstMentionSpan = null;
            for (const span of mentionSpans) {
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
        
        // 7. Mission Links
        node.querySelectorAll('a[href^="/missions/"]').forEach(l => { if (l.querySelector('.glyphicon')) { l.classList.add('pro-chat-mission-link'); const t = l.querySelector('span:not(.glyphicon)'); if (t) t.textContent = t.textContent.replace(/[\[\]]/g, ''); } });
        
        node.dataset.proChatFormatted = 'true';
    }

    function processAllianceChatMessage(well) {
        if (well.dataset.proChatFormatted) return;
        const s = well.querySelector('strong'); const a = well.querySelector('strong a[href^="/profile/"]');
        if (!s || !a) return;
        try { const d = new Date(well.dataset.messageTime); const ts = `${d.getDate()}.${d.getMonth()+1}. ${d.getHours()}:${(d.getMinutes()<10?'0':'')+d.getMinutes()}`; const b = document.createElement('span'); b.className = 'chat-timestamp-bubble'; b.textContent = ts; s.prepend(b); } catch (e) {}
        const name = a.innerText.trim(); a.style.color = getUsernameColor(name, isDark);
        if (myUsername === name) well.classList.add('chat-message-own'); else well.classList.add('chat-message-other');
        insertStatusBubble(a, a.href.split('/').pop());
        
        // Logic 3: Linkify & Mentions
        const p = well.querySelector('p');
        const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
        if (p) {
             Array.from(p.childNodes).forEach(child => {
                 if (child.nodeType === 3) {
                     let text = linkifyText(child.textContent);
                     const tempDiv = document.createElement('div'); tempDiv.innerHTML = text;
                     const finalFragment = document.createDocumentFragment();
                     Array.from(tempDiv.childNodes).forEach(procNode => {
                        if (procNode.nodeType === 3 && mentionRegex.test(procNode.textContent)) {
                             const parts = procNode.textContent.split(mentionRegex);
                             parts.forEach(part => {
                                 if (mentionRegex.test(part)) {
                                     const mentionSpan = document.createElement('span'); mentionSpan.className = 'chat-mention'; mentionSpan.textContent = part; finalFragment.appendChild(mentionSpan);
                                 } else { if (part.length > 0) finalFragment.appendChild(document.createTextNode(part)); }
                             });
                        } else finalFragment.appendChild(procNode);
                     });
                     child.replaceWith(finalFragment);
                 }
             });
             p.querySelectorAll('.pro-chat-image-preview-container').forEach(c => c.onclick = e => { e.preventDefault(); openImageModal(c.dataset.imageUrl); });
             
             // Mission Links
             p.querySelectorAll('a[href^="/missions/"]').forEach(l => { if (l.querySelector('.glyphicon')) { l.classList.add('pro-chat-mission-link'); const t = l.querySelector('span:not(.glyphicon)'); if (t) t.textContent = t.textContent.replace(/[\[\]]/g, ''); } });
        }
        
        const old1 = well.querySelector('.lss-chat-line-1'); if(old1) { well.prepend(s); old1.remove(); }
        s.classList.add('mission_chat_message_username');
        well.dataset.proChatFormatted = 'true';
    }

    function processAndBlockElement(el) {
        const link = el.matches('a[href^="/profile/"]') ? el : el.querySelector('a[href^="/profile/"]');
        const id = link ? link.href.split('/').pop() : null;
        if (shouldBlockUser(id)) { el.style.setProperty('display', 'none', 'important'); el.dataset.lssBlocked = 'true'; return; }
        el.style.removeProperty('display'); el.removeAttribute('data-lss-blocked');
        if (el.matches('li') && el.closest('#mission_chat_messages')) { processMainChatMessage(el); if (!el.classList.contains('new-chat-message-animated')) setTimeout(() => el.classList.add('new-chat-message-animated'), 10); }
        else if (el.matches('.well[data-message-time]')) processAllianceChatMessage(el);
        else if (id && link) insertStatusBubble(link, id);
    }

    function applyBlockStatusToAllElements() {
        document.querySelectorAll('.well[data-message-time], li[data-message-time], a[href^="/profile/"]').forEach(el => {
            if(el.tagName==='A' && (el.closest('.well') || el.closest('li[data-message-time]'))) return;
            processAndBlockElement(el);
        });
        const c = document.querySelectorAll('[data-lss-blocked="true"]').length;
        document.querySelectorAll('.lss-blocker-count').forEach(s => { s.textContent = c > 0 ? `(${c})` : ''; s.style.display = c > 0 ? 'inline-block' : 'none'; });
    }

    // ========================================================================
    // 5. INPUT & AUTOCOMPLETE (Sticky Overlay + Visual Harmony Fix)
    // ========================================================================
    function replaceInputWithTextarea() {
        const inputElement = document.getElementById('alliance_chat_message'); 
        const inputGroup = inputElement ? inputElement.closest('.input-group') : null;
        if (!inputElement || inputElement.tagName === 'TEXTAREA' || !inputGroup) return;

        proChatTextarea = document.createElement('textarea');
        const whisperTargetDisplay = document.createElement('div');
        whisperTargetDisplay.id = 'pro_chat_whisper_target';
        whisperTargetDisplay.style.display = 'none';
        whisperTargetDisplay.style.paddingBottom = '5px';

        proChatTextarea.id = inputElement.id;
        proChatTextarea.className = inputElement.className;
        proChatTextarea.name = inputElement.name;
        proChatTextarea.rows = 1;
        proChatTextarea.style.resize = 'none';
        proChatTextarea.style.overflowY = 'hidden';
        proChatTextarea.placeholder = "Nachricht (↵ = Senden/Vorschlag wählen, ⇧+↵ = Zeilenumbruch)";
        
        // FIX: Runde Ecke rechts entfernen, damit Button andockt
        proChatTextarea.style.borderTopRightRadius = '0';
        proChatTextarea.style.borderBottomRightRadius = '0';

        const smileyInputGroupAddon = document.createElement('span');
        smileyInputGroupAddon.className = 'input-group-addon pro-chat-smiley-addon';
        smileyButton = document.createElement('button');
        smileyButton.id = 'pro_chat_smiley_btn';
        smileyButton.type = 'button';
        smileyButton.className = 'btn btn-default btn-xs';
        smileyButton.title = 'Smilies auswählen';
        smileyButton.innerHTML = '😊';
        smileyInputGroupAddon.appendChild(smileyButton);

        smileyContainer = document.createElement('div');
        smileyContainer.id = 'pro_chat_smiley_container';
        smileyContainer.style.display = 'none';
        UNICODE_SMILIES.forEach(s => {
             const span = document.createElement('span');
             span.textContent = s;
             span.className = 'pro-chat-smiley-item';
             span.title = s;
             span.onclick = () => {
                 const v = proChatTextarea.value; const c = proChatTextarea.selectionStart;
                 proChatTextarea.value = v.slice(0, c) + s + " " + v.slice(c);
                 proChatTextarea.focus();
             };
             smileyContainer.appendChild(span);
        });
        // In Body für Overlay
        document.body.appendChild(smileyContainer);

        suggestionContainer = document.createElement('div');
        suggestionContainer.className = 'pro-chat-suggestion-container';
        suggestionContainer.style.display = 'none';
        document.body.appendChild(suggestionContainer);

        // Positions-Update (Sticky)
        function updatePopupPositions() {
            if(smileyContainer.style.display === 'grid') {
                const rect = smileyButton.getBoundingClientRect();
                smileyContainer.style.position = 'fixed';
                smileyContainer.style.left = (rect.right + 5) + 'px';
                smileyContainer.style.top = (rect.top + rect.height/2) + 'px';
                smileyContainer.style.transform = 'translateY(-50%)';
            }
            if(suggestionContainer.style.display === 'block') {
                const r = proChatTextarea.getBoundingClientRect();
                suggestionContainer.style.position = 'fixed';
                suggestionContainer.style.left = r.left + 'px';
                suggestionContainer.style.width = r.width + 'px';
                suggestionContainer.style.bottom = (window.innerHeight - r.top) + 'px';
                suggestionContainer.style.top = 'auto';
            }
        }
        window.addEventListener('scroll', updatePopupPositions, true);
        window.addEventListener('resize', updatePopupPositions);

        smileyButton.onclick = (e) => {
            e.stopPropagation();
            if (smileyContainer.style.display === 'grid') {
                smileyContainer.style.display = 'none';
            } else {
                smileyContainer.style.display = 'grid';
                hideSuggestions();
                updatePopupPositions();
            }
        };

        const autoGrow = (el) => { el.style.height='auto'; el.style.height=(el.scrollHeight)+'px'; updatePopupPositions(); };

        function checkMentionAutocomplete() {
             const c = proChatTextarea.selectionStart; const v = proChatTextarea.value; const sub = v.substring(0, c);
             const m = sub.match(/(?:@([a-zA-Z0-9_-]*)$)|(?:^\/w\s+([a-zA-Z0-9_-]*)$)/);
             if(m) {
                 const search = (m[1] || m[2]) || '';
                 const res = allianceUsers.filter(u => u.name.toLowerCase().startsWith(search.toLowerCase())).slice(0,10);
                 if(res.length) {
                     suggestionContainer.style.display='block'; suggestionContainer.innerHTML='';
                     updatePopupPositions();
                     res.forEach(u => {
                         const d = document.createElement('div'); d.className='pro-chat-suggestion-item';
                         d.innerHTML = `${u.name} ${u.online?'<span style="color:#28a745">●</span>':''}`;
                         d.onclick = () => {
                             const pre = m[0].startsWith('/w')?'/w ':'@';
                             proChatTextarea.value = v.substring(0, proChatTextarea.selectionStart).replace(new RegExp((m[1]?'@'+m[1]:'/w\\s+'+m[2])+'$'), pre+u.name+' ') + v.substring(proChatTextarea.selectionStart);
                             suggestionContainer.style.display='none'; proChatTextarea.focus();
                         };
                         suggestionContainer.appendChild(d);
                     });
                 } else suggestionContainer.style.display='none';
             } else suggestionContainer.style.display='none';
        }
        
        function hideSuggestions() { if (suggestionContainer) suggestionContainer.style.display = 'none'; }

        proChatTextarea.oninput = function() {
            autoGrow(this);
            const c = this.selectionStart; const v = this.value; const sub = v.substring(0, c);
            for(const [k,val] of Object.entries(SMILEY_MAP)) if(sub.endsWith(k)) { this.value = v.substring(0, c-k.length)+val+v.substring(c); this.selectionStart = this.selectionEnd = c-k.length+val.length; break; }
            checkMentionAutocomplete();
        };

        proChatTextarea.onkeydown = function(e) {
            if(e.key==='Enter' && !e.shiftKey) {
                e.preventDefault();
                hideSuggestions();
                this.closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
                setTimeout(()=>{this.value=''; autoGrow(this);},50);
            }
        };
        
        const formElement = inputElement.closest('form');
        if(formElement) formElement.prepend(whisperTargetDisplay);
        inputElement.parentNode.replaceChild(proChatTextarea, inputElement);
        inputGroup.appendChild(smileyInputGroupAddon);
        
        const labelElement = document.querySelector('label[for="alliance_chat_message"]');
        if (labelElement) { labelElement.innerHTML = '<span class="glyphicon glyphicon-send" style="font-size: 1.2em;"></span>'; labelElement.style.paddingTop='0'; labelElement.style.paddingBottom='0'; labelElement.style.lineHeight=`${proChatTextarea.style.minHeight||'38px'}`; }
        
        setTimeout(()=>autoGrow(proChatTextarea),100);
    }

    // === INIT & LOADER ===
    async function fetchAllAllianceMembers() { allianceUsers = await API.fetch(); allianceUsers = API.data; }
    async function loadAllianceUsers() { await API.fetch(); allianceUsers = API.data; if (!apiIntervalHandle) apiIntervalHandle = setInterval(async () => { await API.fetch(); allianceUsers=API.data; }, API.interval); }

    let currentPage = 1, maxPage = 1;
    function setupMultiPageLoader() {
        if (!window.location.pathname.startsWith('/alliance_chats')) return;
        const p = document.querySelector('ul.pagination'); if (!p) return;
        const l = p.querySelectorAll('a[href*="page="]'); if (l.length > 0) try { maxPage = parseInt(new URL(l[l.length - 2].href).searchParams.get('page')); } catch (e) {}
        p.style.display = 'none'; const c = document.createElement('div'); c.id = 'lss_load_more_container'; c.innerHTML = `<button id="lss_load_more_btn" class="btn btn-primary btn-block">Lade 5 weitere Seiten (${currentPage + 1}...)</button>`; p.parentNode.insertBefore(c, p);
        
        const loadBtn = document.getElementById('lss_load_more_btn');
        loadBtn.onclick = async function() {
            this.disabled = true; this.innerText = "Lade..."; const ct = document.querySelector('.well[data-message-time]').parentNode;
            for (let i = currentPage + 1; i <= Math.min(currentPage + 5, maxPage); i++) {
                await new Promise(resolve => { GM_xmlhttpRequest({ method: 'GET', url: `/alliance_chats?page=${i}`, onload: (res) => { const d = new DOMParser().parseFromString(res.responseText, 'text/html'); const sep = document.createElement('div'); sep.className = 'lss-page-divider'; sep.innerHTML = `<span>Seite ${i}</span>`; ct.insertBefore(sep, c.previousSibling); d.querySelectorAll('.well[data-message-time]').forEach(w => { const cl = w.cloneNode(true); processAndBlockElement(cl); ct.insertBefore(cl, c.previousSibling); }); resolve(); } }); });
                currentPage = i;
            }
            this.disabled = false; this.innerText = currentPage >= maxPage ? "Ende" : `Lade 5 weitere Seiten (${currentPage + 1}...)`;
        };
        // Auto-Load im Verlauf
        setTimeout(() => loadBtn.click(), 800);
    }

    // === ORIGINAL CSS + FIXES ===
    GM_addStyle(`
        /* === LAYOUT FIXES === */
        #mission_chat_messages { display: flex; flex-direction: column; }
        
        /* POPUPS: Background fix & High Z-Index */
        #pro_chat_smiley_container, .pro-chat-suggestion-container {
            background-color: #2c2f33 !important; /* Default Dark */
            opacity: 1 !important;
            z-index: 10001 !important;
        }
        body:not(.dark) #pro_chat_smiley_container, 
        body:not(.dark) .pro-chat-suggestion-container {
            background-color: #ffffff !important; /* Default Light */
        }
        
        /* POPUP STYLES */
        #pro_chat_smiley_container { width: 360px; padding: 10px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; box-shadow: 0 0 15px rgba(0,0,0,0.5); border-radius: 8px; border: 1px solid #444; }
        .pro-chat-suggestion-container { max-height: 150px; overflow-y: auto; border-radius: 8px 8px 0 0; box-shadow: 0 -2px 10px rgba(0,0,0,0.2); border: 1px solid #444; }
        
        /* BUTTON RADIUS FIX - HARMONY */
        .pro-chat-smiley-addon {
            border-top-left-radius: 0 !important;
            border-bottom-left-radius: 0 !important;
            border-top-right-radius: 4px !important;
            border-bottom-right-radius: 4px !important;
            padding: 0 !important;
            overflow: hidden; /* Clips the button corners */
        }
        
        /* BUTTON TRANSPARENCY FIX */
        #pro_chat_smiley_btn {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            width: 100%;
            height: 100%;
            margin: 0 !important;
            padding: 5px 12px;
            font-size: 1.5em;
            line-height: 1;
        }
        
        /* COLORS & BUBBLES */
        .chat-status-bubble { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; border:1px solid rgba(0,0,0,0.2); vertical-align:middle; }
        .chat-status-online { background-color:#28a745; box-shadow:0 0 5px #28a745; } 
        .chat-status-offline { background-color:#dc3545 !important; box-shadow:0 0 5px #dc3545 !important; opacity:0.8; }
        
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
        .pro-chat-header-controls-left { float: left; display: flex; align-items: center; height: 24px; gap: 8px; }
        .lss-alliance-chat-controls { display: flex; align-items: center; gap: 10px; margin: 10px 0 15px 0; padding: 10px; background-color: var(--color-dark-other-bubble-bg, #36393f); border: 1px solid var(--color-dark-header-border, #40444b); border-radius: 6px; color: var(--color-dark-body-fg, #f0f0f0); }
        body:not(.dark) .lss-alliance-chat-controls { background-color: var(--color-light-other-bubble-bg, #ffffff); border: 1px solid var(--color-light-header-border, #dce1e6); color: var(--color-light-body-fg, #111111); }
        .lss-alliance-chat-controls label.lss-blocker-label { font-weight: bold; margin: 0; color: inherit; }
        .lss-alliance-chat-controls .btn-xs { margin-left: auto; }
        #chat_panel_heading span.lss-blocker-count, .lss-alliance-chat-controls span.lss-blocker-count { font-size: 10px !important; font-weight: bold !important; color: #FFFFFF !important; background-color: #dc3545 !important; display: none !important; text-align: center !important; padding: 2px 5px !important; border-radius: 5px !important; line-height: 1 !important; vertical-align: text-top; margin-left: -4px !important; z-index: 10 !important; min-width: 10px !important; box-shadow: 0 1px 2px rgba(0,0,0,0.4); }
        #chat_panel_heading span.lss-blocker-count:not(:empty), .lss-alliance-chat-controls span.lss-blocker-count:not(:empty) { display: inline-block !important; }
        body:not(.dark) .lss-blocker-count { color: #000000 !important; background-color: #ffc107 !important; }
        @keyframes slideInFromBottom { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        #mission_chat_messages li.new-chat-message-animated { animation: slideInFromBottom 0.4s ease-out; }
        .panel-body#chat_panel_body { padding: 0 !important; }
        #mission_chat_ban_message { margin: 10px; border-radius: 8px; text-shadow: 0 1px 1px rgba(0,0,0,0.3); border: none; }
        #alliance_chat_header_info, #alliance_chat.alliance_false { display: none !important; }
        img.alliance_chat_copy_username, img.alliance_chat_private_username { width: 0px !important; height: 0px !important; padding: 9px !important; background-repeat: no-repeat; background-position: center; background-size: 16px 16px; vertical-align: middle; border-radius: 4px; margin: 0 2px; transition: all 0.2s ease; cursor: pointer; filter: none !important; opacity: 1 !important; }
        a.alliance_chat_private_username, a.alliance_chat_private_username:hover { text-decoration: none !important; border: none !important; }
        #mission_chat_messages, body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9 { display: flex; flex-direction: column; }
        body[pathname^="/alliance_chats"] #missions-board-body > .container-fluid > .row:first-child > .col-md-9 { padding: 10px 10px 5px 10px; }
        #mission_chat_messages li, .well[data-message-time] { max-width: 85%; list-style: none; line-height: 1.4; margin-bottom: 8px !important; border-radius: 12px !important; word-wrap: break-word; box-shadow: none !important; display: block !important; }
        .well[data-message-time] { padding: 10px 14px !important; border: none !important; }
        #mission_chat_messages li { padding: 10px 14px; border: none; }
        .chat-message-own, .well.chat-message-own { align-self: flex-end; border-radius: 12px 12px 0 12px !important; }
        .chat-message-other, .well.chat-message-other { align-self: flex-start; border-radius: 12px 12px 12px 0 !important; }
        .chat-mention { font-weight: bold; padding: 1px 4px; border-radius: 4px; margin: 0 1px; }
        .chat-timestamp-bubble { padding: 2px 7px; border-radius: 5px; font-size: 0.85em !important; font-weight: bold; margin-right: 5px; vertical-align: middle; }
        .chat-whisper-divider { display: inline-block; width: 14px; height: 14px; background-size: 14px 14px; background-repeat: no-repeat; background-position: center; vertical-align: middle; margin: 0 4px; }
        .well[data-message-time] p { margin: 0; }
        .well[data-message-time] strong { margin: 0; }
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
        .dark .chat-message-own:not(.chatWhisper):not(.chatToSelf) .mission_chat_message_username .chat-username, .dark .well.chat-message-own .mission_chat_message_username .chat-username { color: var(--color-dark-my-bubble-fg, #ffffff) !important; }
        .dark .chat-timestamp-bubble { background-color: var(--color-dark-timestamp-bg, #40444b); color: var(--color-dark-timestamp-fg, #adafb3); }
        .dark .chat-whisper-divider { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' fill='%238e9297'%3E%3Cpath d='M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z'/%3E%3C/svg%3E"); }
        .dark .chat-message-own, .dark .well.chat-message-own { background-color: var(--color-dark-my-bubble-bg, #7289da) !important; color: var(--color-dark-my-bubble-fg, #ffffff) !important; }
        .dark .chat-message-other, .dark .well.chat-message-other { background-color: var(--color-dark-other-bubble-bg, #36393f) !important; color: var(--color-dark-other-bubble-fg, #dcddde) !important; }
        .dark #mission_chat_messages li.chatWhisper { background-color: var(--color-dark-whisper-bg) !important; border-left: 4px solid var(--color-dark-whisper-border) !important; padding-left: 10px !important; color: var(--color-dark-whisper-fg) !important; }
        .dark #mission_chat_messages li.chatWhisper.chat-message-own { background-color: var(--color-dark-my-whisper-bg) !important; color: var(--color-dark-my-whisper-fg) !important; }
        .dark .whisper-label { background-color: var(--color-dark-whisper-label-bg) !important; color: var(--color-dark-whisper-label-fg) !important; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin: 0 4px; font-size: 0.9em; }
        .dark #mission_chat_messages li.chatToSelf:not(.chatWhisper) { background-color: var(--color-dark-my-mention-bubble-bg) !important; border-left: 4px solid var(--color-dark-my-mention-bubble-border) !important; padding-left: 10px !important; color: var(--color-dark-my-mention-bubble-fg) !important; }
        .dark .chat-mention { background-color: var(--color-dark-mention-bg, #f0ad4e); color: var(--color-dark-mention-fg, #332b1f); }
        .dark #new_alliance_chat { padding: 10px; background-color: var(--color-dark-body-bg, #2c2f33); border-top: 1px solid var(--color-dark-chat-border, #40444b); position: relative; }
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
        body:not(.dark) .chat-message-own:not(.chatWhisper):not(.chatToSelf) .mission_chat_message_username .chat-username, body:not(.dark) .well.chat-message-own .mission_chat_message_username .chat-username { color: var(--color-light-my-bubble-fg, #ffffff) !important; }
        body:not(.dark) .chat-timestamp-bubble { background-color: var(--color-light-timestamp-bg, #dce1e6); color: var(--color-light-timestamp-fg, #555555); }
        body:not(.dark) .chat-whisper-divider { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' fill='%23777777'%3E%3Cpath d='M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z'/%3E%3C/svg%3E"); }
        body:not(.dark) .chat-message-own, body:not(.dark) .well.chat-message-own { background-color: var(--color-light-my-bubble_bg, #007bff) !important; color: var(--color-light-my_bubble_fg, #ffffff) !important; }
        body:not(.dark) .chat-message-other, body:not(.dark) .well.chat-message-other { background-color: var(--color-light-other-bubble_bg, #ffffff) !important; color: var(--color-light-other-bubble_fg, #222222) !important; }
        body:not(.dark) #mission_chat_messages li.chatWhisper { background-color: var(--color-light-whisper-bg) !important; border-left: 4px solid var(--color-light-whisper-border) !important; padding-left: 10px !important; color: var(--color-light-whisper-fg) !important; }
        body:not(.dark) #mission_chat_messages li.chatWhisper.chat-message-own { background-color: var(--color-light-my-whisper-bg) !important; color: var(--color-light-my-whisper-fg) !important; }
        body:not(.dark) .whisper-label { background-color: var(--color-light-whisper-label-bg) !important; color: var(--color-light-whisper-label-fg) !important; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin: 0 4px; font-size: 0.9em; }
        body:not(.dark) #mission_chat_messages li.chatToSelf:not(.chatWhisper) { background-color: var(--color-light-my-mention-bubble-bg) !important; border-left: 4px solid var(--color-light-my-mention-bubble-border) !important; padding-left: 10px !important; color: var(--color-light-my-mention-bubble-fg) !important; }
        body:not(.dark) .chat-mention { background-color: var(--color-light-mention-bg, #fff4cc); color: var(--color-light-mention-fg, #664d03); border: 1px solid var(--color-light-mention-border, #ffe69c); }
        body:not(.dark) #new_alliance_chat { padding: 10px; background-color: var(--color-light-body-bg, #f0f4f7); border-top: 1px solid var(--color-light-chat-border, #dce1e6); position: relative; }
        body:not(.dark) #new_alliance_chat .input-group-addon { background-color: var(--color-light-input-addon-bg, #007bff); border: 1px solid var(--color-light-input-border, #dce1e6); color: var(--color-light-input-addon-fg, #ffffff); border-radius: 20px 0 0 20px; font-weight: bold; }
        body:not(.dark) #alliance_chat_message { background-color: var(--color-light-input-bg, #ffffff); border: 1px solid var(--color-light-input-border, #dce1e6); color: var(--color-light-input-fg, #333333); border-radius: 0 !important; padding: 10px 15px; height: auto; min-height: 38px; transition: all 0.2s ease; resize: none; }
        body:not(.dark) #alliance_chat_message:focus { border-color: var(--color-light-input-focus-border, #007bff); box-shadow: 0 0 8px var(--color-light-input-focus-shadow, rgba(0, 123, 255, 0.5)); outline: none; }
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
        .pro-chat-mission-link { display: inline-block; padding: 4px 8px; border-radius: 6px; text-decoration: none !important; margin: 2px 0; transition: all 0.2s ease; font-weight: bold; border: 1px solid transparent; }
        .pro-chat-mission-link .glyphicon { margin-right: 5px; font-size: 0.9em; }
        .dark .pro-chat-mission-link { background-color: var(--color-dark-mission-bg); color: var(--color-dark-mission-fg) !important; border-color: var(--color-dark-mission-border); }
        .dark .pro-chat-mission-link .glyphicon { color: var(--color-dark-mission-icon-fg); }
        .dark .pro-chat-mission-link:hover { filter: brightness(1.2); text-decoration: none !important; }
        body:not(.dark) .pro-chat-mission-link { background-color: var(--color-light-mission-bg); color: var(--color-light-mission-fg) !important; border-color: var(--color-light-mission-border); }
        body:not(.dark) .pro-chat-mission-link .glyphicon { color: var(--color-light-mission-icon-fg); }
        body:not(.dark) .pro-chat-mission-link:hover { filter: brightness(0.95); text-decoration: none !important; }
        .dark #alliance_chat_message { min-height: 44px; resize: none; border-radius: 0 !important; }
        body:not(.dark) #new_alliance_chat .input-group-addon:first-child { border-radius: 20px 0 0 20px !important; }
        .dark #new_alliance_chat .input-group-addon:first-child { border-radius: 20px 0 0 20px !important; }
        .pro-chat-smiley-addon { padding: 0 !important; background-color: var(--color-light-input-bg, #ffffff) !important; border: 1px solid var(--color-light-input-border, #dce1e6) !important; border-left: none !important; border-radius: 0 20px 20px 0 !important; }
        .dark .pro-chat-smiley-addon { background-color: var(--color-dark-input-bg, #40444b) !important; border: none !important; border-radius: 0 20px 20px 0 !important; }
        #pro_chat_smiley_btn { background: transparent !important; color: inherit !important; border: none !important; box-shadow: none !important; font-size: 1.5em; padding: 5px 10px; line-height: 1; height: 100%; transition: none; }
        .pro-chat-smiley-addon:hover { background-color: var(--color-dark-icon-bg-hover, #40444b) !important; }
        body:not(.dark) .pro-chat-smiley-addon:hover { background-color: var(--color-light-icon-bg-hover, #dce1e6) !important; }
        #pro_chat_smiley_container { position: absolute; width: 360px; padding: 10px; background-color: var(--color-dark-body-bg, #2c2f33); border: 1px solid var(--color-dark-header-border, #40444b); box-shadow: 0 4px 12px rgba(0,0,0,0.4); border-radius: 8px; z-index: 1000; display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; }
        body:not(.dark) #pro_chat_smiley_container { background-color: var(--color-light-other-bubble_bg, #ffffff); border: 1px solid var(--color-light-header-border, #dce1e6); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .pro-chat-smiley-item { font-size: 1.5em; text-align: center; cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.1s; }
        .pro-chat-smiley-item:hover { background-color: var(--color-dark-icon-bg-hover, #40444b); }
        body:not(.dark) .pro-chat-smiley-item:hover { background-color: var(--color-light-icon-bg-hover, #dce1e6); }
        .pro-chat-image-preview-container { display: inline-block; max-width: 150px; max-height: 150px; border-radius: 8px; overflow: hidden; margin: 5px 0; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height: 0; transition: transform 0.1s ease; }
        .pro-chat-image-preview-container:hover { transform: scale(1.03); }
        .pro-chat-image-preview { width: 100%; height: auto; display: block; min-height: 50px; object-fit: cover; }
        .pro-chat-modal-image { display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.9); justify-content: center; align-items: center; }
        .pro-chat-modal-image-content { position: relative; margin: auto; max-width: 90%; max-height: 90%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        #proChatImageModalImage { max-width: 100%; max-height: 85vh; display: block; border-radius: 5px; object-fit: contain; }
        .pro-chat-modal-image-close { position: absolute; top: 15px; right: 35px; color: #f1f1f1; font-size: 40px; font-weight: bold; transition: 0.3s; cursor: pointer; }
        .pro-chat-modal-image-close:hover, .pro-chat-modal-image-close:focus { color: #bbb; text-decoration: none; cursor: pointer; }
        #proChatImageModalLink { margin-top: 10px; background-color: #337ab7; border-color: #2e6da4; color: white; padding: 8px 15px; border-radius: 5px; text-decoration: none; }
        .pro-chat-suggestion-container { position: absolute; max-height: 100px; overflow-y: auto; background-color: var(--color-dark-body-bg, #2c2f33); border: 1px solid var(--color-dark-header-border, #40444b); box-shadow: 0 4px 12px rgba(0,0,0,0.4); border-radius: 8px; z-index: 999; }
        body:not(.dark) .pro-chat-suggestion-container { background-color: var(--color-light-other-bubble_bg, #ffffff); border: 1px solid var(--color-light-header-border, #dce1e6); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .pro-chat-suggestion-item { padding: 8px 15px; cursor: pointer; font-weight: normal; transition: background-color 0.1s; color: var(--color-dark-other-bubble-fg, #dcddde); white-space: nowrap; }
        body:not(.dark) .pro-chat-suggestion-item { color: var(--color-light-other-bubble_fg, #222222); }
        .pro-chat-suggestion-item:hover, .pro-chat-suggestion-item.selected { background-color: var(--color-dark-icon-bg-hover, #40444b); color: var(--color-dark-header-fg, #f0f0f0); }
        body:not(.dark) .pro-chat-suggestion-item:hover, body:not(.dark) .pro-chat-suggestion-item.selected { background-color: var(--color-light-icon-bg-hover, #dce1e6); color: var(--color-light-header-fg, #333333); }
        
        /* BUBBLE CSS */
        .chat-status-bubble { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; border: 1px solid rgba(0,0,0,0.2); }
        .chat-status-online { background-color: #28a745; box-shadow: 0 0 5px #28a745; }
        .chat-status-offline { background-color: #dc3545; opacity: 0.5; box-shadow: 0 0 5px #dc3545 !important; }
    `);

    // ========================================================================
    // 6. INIT
    // ========================================================================
    console.log("[ChatPro] Starting...");

    await API.fetch();
    setInterval(() => API.fetch(), API.interval);
    await loadSettings();
    applyChatSettings(currentSettings);
    createImageModal();

    setTimeout(() => {
        createSettingsUI();
        replaceInputWithTextarea();
        setupMultiPageLoader();
        applyBlockStatusToAllElements();
    }, 1500);

    myUsername = document.getElementById('navbar_profile_link')?.innerText.trim();
    isDark = document.body.classList.contains('dark');

    new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => {
        if(n.nodeType===1) {
            if(n.matches('#mission_chat_messages li, .well')) processAndBlockElement(n);
            n.querySelectorAll('#mission_chat_messages li, .well').forEach(processAndBlockElement);
        }
    }))).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('click', (e) => {
        if (smileyContainer && !smileyContainer.contains(e.target) && !e.target.closest('.pro-chat-smiley-addon')) smileyContainer.style.display = 'none';
        if (suggestionContainer && e.target !== proChatTextarea) suggestionContainer.style.display = 'none';
    });

    console.log("[ChatPro] Ready.");
})();
