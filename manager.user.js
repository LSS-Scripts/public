// ==UserScript==
// @name         B&M Scriptmanager
// @namespace    https://github.com/LSS-Scripts/public
// @version      13.6.1
// @description  Behebt einen Fehler, bei dem initial deaktivierte Skripte nicht wieder aktiviert werden konnten. Fügt Kategorie-Ansicht hinzu. (Farb-Update)
// @author       B&M
// @match        https://www.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const GITHUB_API_URL = 'https://api.github.com/repos/';
    const GITHUB_REPO_OWNER = 'LSS-Scripts';
    const GITHUB_REPO_NAME = 'public';
    const DB_NAME = 'LSSScriptDB';
    const DB_VERSION = 1;
    const CACHE_DURATION_MS = 10 * 60 * 1000;
    const DEFAULT_CATEGORY = "Sonstiges";

    let scriptStates = {};
    let initialScriptStates = {};
    let scriptMetadataCache = {};
    let db;

    window.BMScriptManager = {
        _settingsCache: {},
        _branchCache: {},

        // --- Datenbank-Funktionen (Unverändert) ---
        openDatabase: function() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('scripts')) {
                        db.createObjectStore('scripts', { keyPath: 'name' });
                    }
                };
                request.onsuccess = (event) => {
                    db = event.target.result;
                    resolve();
                };
                request.onerror = (event) => reject(event.target.error);
            });
        },
        getScriptsFromDB: function() {
            // ... (unverändert) ...
            return new Promise((resolve, reject) => {
                if (!db) { reject("Datenbank nicht geöffnet."); return; }
                const transaction = db.transaction(['scripts'], 'readonly');
                const objectStore = transaction.objectStore('scripts');
                const request = objectStore.getAll();
                request.onsuccess = (event) => resolve(event.target.result);
                request.onerror = (event) => reject(event.target.error);
            });
        },
        getSingleScriptFromDB: function(scriptName) {
            // ... (unverändert) ...
             return new Promise((resolve, reject) => {
                if (!db) { reject("Datenbank nicht geöffnet."); return; }
                const transaction = db.transaction(['scripts'], 'readonly');
                const objectStore = transaction.objectStore('scripts');
                const request = objectStore.get(scriptName);
                request.onsuccess = (event) => resolve(event.target.result);
                request.onerror = (event) => reject(event.target.error);
            });
        },
        saveScriptToDB: function(script) {
            // ... (unverändert) ...
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['scripts'], 'readwrite');
                const objectStore = transaction.objectStore('scripts');
                const request = objectStore.put(script);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        },
        deleteScriptFromDB: function(scriptName) {
            // ... (unverändert) ...
            localStorage.removeItem(`BMSettings_${scriptName}`);
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['scripts'], 'readwrite');
                const objectStore = transaction.objectStore('scripts');
                const request = objectStore.delete(scriptName);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        },

        // --- GitHub/Helper-Funktionen (Unverändert) ---
        getScriptNameAndVersion: function(fileName) {
            // ... (unverändert) ...
            const regex = /(.+)\.v(\d+\.\d+\.\d+)\.user\.js/;
            const match = fileName.match(regex);
            if (match) {
                return { name: match[1], version: match[2], fullName: fileName };
            }
            return null;
        },
        extractMatchFromCode: function(code) {
            // ... (unverändert) ...
            const matchRegex = /@match\s+(.+)/g;
            let match;
            const matches = [];
            while ((match = matchRegex.exec(code)) !== null) {
                matches.push(match[1]);
            }
            return matches;
        },
        codeHasSettings: function(code) {
            // ... (unverändert) ...
            return /\/\*--BMScriptConfig([\s\S]*?)--\*\//.test(code);
        },
        compareVersions: function(v1, v2) {
            // ... (unverändert) ...
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            const len = Math.max(parts1.length, parts2.length);
            for (let i = 0; i < len; i++) {
                const p1 = parts1[i] || 0;
                const p2 = parts2[i] || 0;
                if (p1 > p2) return 1;
                if (p1 < p2) return -1;
            }
            return 0;
        },
        _getDefaultBranch: async function(repoInfo) {
            // ... (unverändert) ...
            const repoPath = `${repoInfo.owner}/${repoInfo.name}`;
            if (this._branchCache[repoPath]) {
                return this._branchCache[repoPath];
            }
            try {
                const repoDataResult = await this._fetchRESTContents(repoPath, repoInfo.token);
                if (!repoDataResult.success) return 'main';
                const defaultBranch = repoDataResult.data.default_branch || 'main';
                this._branchCache[repoPath] = defaultBranch;
                return defaultBranch;
            } catch (e) {
                return 'main';
            }
        },
        _fetchRawFile: async function(filePath, repoInfo = null) {
            // ... (unverändert) ...
            return new Promise(async (resolve) => {
                const owner = repoInfo ? repoInfo.owner : GITHUB_REPO_OWNER;
                const name = repoInfo ? repoInfo.name : GITHUB_REPO_NAME;
                const token = repoInfo ? repoInfo.token : null;
                const defaultBranch = await this._getDefaultBranch({owner, name, token});
                let fileUrl = `https://raw.githubusercontent.com/${owner}/${name}/${defaultBranch}/${filePath}`;
                const headers = token ? { 'Authorization': `token ${token}` } : {};
                GM_xmlhttpRequest({
                    method: 'GET', url: fileUrl, headers,
                    onload: res => {
                        if (res.status === 200 && res.responseText) {
                            resolve({ success: true, content: res.responseText });
                        } else {
                            resolve({ success: false });
                        }
                    },
                    onerror: (err) => {
                        resolve({ success: false });
                    }
                });
            });
        },
        _fetchFileWithAPI: async function(filePath, repoInfo) {
            // ... (unverändert) ...
             return new Promise(async (resolve) => {
                const owner = repoInfo.owner;
                const name = repoInfo.name;
                const token = repoInfo.token;
                const apiPath = `${owner}/${name}/contents/${filePath}`;
                const result = await this._fetchRESTContents(apiPath, token);

                if (result.success && result.data.content) {
                    try {
                        const decodedContent = decodeURIComponent(escape(window.atob(result.data.content)));
                        resolve({ success: true, content: decodedContent });
                    } catch (e) {
                        resolve({ success: false });
                    }
                } else {
                    resolve({ success: false });
                }
            });
        },
        fetchRawScript: function(dirName, fileName, repoInfo) {
            // ... (unverändert) ...
            return this._fetchRawFile(`${dirName}/${fileName}`, repoInfo);
        },
        _fetchRESTContents: function(path, token = null) {
            // ... (unverändert) ...
            return new Promise((resolve) => {
                const fullUrl = GITHUB_API_URL + path;
                const headers = token ? { 'Authorization': `token ${token}` } : {};
                GM_xmlhttpRequest({
                    method: 'GET', url: fullUrl, headers,
                    onload: res => {
                        if (res.status === 200) {
                            resolve({ success: true, data: JSON.parse(res.responseText) });
                        } else {
                            resolve({ success: false, status: res.status });
                        }
                    },
                    onerror: (err) => {
                         resolve({ success: false, status: 'NETWORK_ERROR' });
                    }
                });
            });
        },
        getScriptDetails: async function(dir, repoInfo) {
            // --- (Modifiziert: Liest categories.txt mit) ---
            try {
                const filesInDirResult = await this._fetchRESTContents(dir.url.replace('https://api.github.com/repos/', ''), repoInfo.token);
                if (!filesInDirResult.success) return null;
                const userJsFile = filesInDirResult.data.find(f => f.name.endsWith('.user.js'));
                if (!userJsFile) return null;
                const scriptMeta = this.getScriptNameAndVersion(userJsFile.name);
                if (!scriptMeta) return null;

                const [info, changelog, categoriesRaw] = await Promise.all([
                    this._fetchRawFile(`${dir.name}/info.txt`, repoInfo).then(r => r.success ? r.content.trim() : `Keine info.txt gefunden.`),
                    this._fetchRawFile(`${dir.name}/changelog.txt`, repoInfo).then(r => r.success && r.content.trim() ? `\n<hr>\n<strong>Changelog:</strong>\n${r.content}` : ""),
                    this._fetchRawFile(`${dir.name}/categories.txt`, repoInfo).then(r => r.success ? r.content.trim() : "")
                ]);

                scriptMeta.description = info;
                scriptMeta.changelog = changelog;

                if (categoriesRaw) {
                    scriptMeta.categories = categoriesRaw.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    scriptMeta.categories = [DEFAULT_CATEGORY]; // Fallback
                }

                scriptMeta.repoInfo = repoInfo;
                scriptMeta.dirName = dir.name;
                return scriptMeta;
            } catch (e) {
                console.error(`[B&M Manager] Fehler beim Verarbeiten von Verzeichnis ${dir.name}`, e);
                return null;
            }
        },
        fetchScriptsWithManifest: async function(repoInfo) {
            // --- (Modifiziert: Weist Fallback-Kategorie zu) ---
            const result = await this._fetchFileWithAPI('manifest.json', repoInfo);
            if (result.success) {
                try {
                    const manifest = JSON.parse(result.content);
                    manifest.forEach(script => {
                        script.repoInfo = repoInfo;
                        script.dirName = script.name;
                        script.fullName = script.fileName;
                        if (!script.categories || script.categories.length === 0) {
                            script.categories = [DEFAULT_CATEGORY];
                        }
                    });
                    return manifest;
                } catch (e) {
                    console.error(`[B&M Manager] Fehler beim Parsen der manifest.json von ${repoInfo.owner}/${repoInfo.name}`, e);
                    return [];
                }
            }
            return [];
        },
        fetchScriptsWithREST: async function(repoInfo, progressCallback) {
            // ... (unverändert) ...
            const { owner, name, token } = repoInfo;
            try {
                if(progressCallback) progressCallback(`Lade Repository: ${owner}/${name}...`);
                const rootDirsResult = await this._fetchRESTContents(`${owner}/${name}/contents/`, token);
                if (!rootDirsResult.success) return [];
                const rootDirs = rootDirsResult.data.filter(d => d.type === 'dir');
                const detailPromises = rootDirs.map(dir => this.getScriptDetails(dir, repoInfo));
                return (await Promise.all(detailPromises)).filter(Boolean);
            } catch (e) {
                console.error(`[B&M Manager] Fehler beim Laden des Repos: ${owner}/${name}`, e);
                return [];
            }
        },
        fetchPrivateRepoScripts: async function(repoInfo, progressCallback) {
            // ... (unverändert) ...
            const repoPath = `${repoInfo.owner}/${repoInfo.name}`;
            if(progressCallback) progressCallback(`Prüfe Manifest für ${repoPath}...`);
            const manifestResult = await this.fetchScriptsWithManifest(repoInfo);
            if (manifestResult.length > 0) {
                return manifestResult;
            } else {
                return this.fetchScriptsWithREST(repoInfo, progressCallback);
            }
        },

        // --- Aktive Skripte ausführen (Unverändert) ---
        runActiveScripts: async function() {
            await this.openDatabase();
            const scripts = await this.getScriptsFromDB();
            for (const script of scripts.filter(s => s.isActive !== false)) {
                try {
                    const isMatch = script.match.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(window.location.href));
                    if (isMatch) {
                        eval(script.code);
                    }
                } catch (e) { console.error(`Fehler beim Ausführen von Skript '${script.name}':`, e); }
            }
        },

        // --- UI-FUNKTIONEN ---

        /**
         * createUIElement (Unverändert zu 13.6.0)
         */
        createUIElement: function(scriptMeta, infoText, buttonState) {
            const item = document.createElement('div');
            item.className = 'script-button ' + buttonState;
            item.dataset.scriptName = scriptMeta.name.toLowerCase();
            item.dataset.scriptInfo = infoText.toLowerCase();
            item.dataset.categories = (scriptMeta.categories || [DEFAULT_CATEGORY]).join(',').toLowerCase();

            const isExternal = scriptMeta.repoInfo.owner !== GITHUB_REPO_OWNER || scriptMeta.repoInfo.name !== GITHUB_REPO_NAME;
            let buttonContent = `<strong data-script-name="${scriptMeta.name}">${scriptMeta.name} <span class="version">v${scriptMeta.version}</span></strong>`;
            let icons = '';
            if (isExternal) {
                item.classList.add('external-script');
                icons += `<span class="external-symbol">⚠️</span>`;
            }
            if (buttonState === 'update') {
                icons += ` <span class="update-symbol" title="Update verfügbar">🔄</span>`;
            }
            if (buttonState === 'downgrade') {
                icons += ` <span class="downgrade-symbol" title="Reparatur-Update empfohlen">↩️</span>`;
            }
            item.innerHTML = `${icons} ${buttonContent}`;
            item.dataset.description = infoText;

            if (['active', 'update', 'inactive', 'downgrade'].includes(buttonState) && scriptMeta.hasSettings) {
                const configBtn = document.createElement('span');
                configBtn.className = 'bm-config-btn';
                configBtn.innerHTML = '⚙️';
                configBtn.title = 'Einstellungen';
                configBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.BMScriptManager._fetchAndShowSettingsUI(scriptMeta.name);
                });
                item.appendChild(configBtn);
            }

            if (['active', 'update', 'inactive', 'removed', 'downgrade'].includes(buttonState)) {
                 const uninstallBtn = document.createElement('span');
                 uninstallBtn.className = 'bm-uninstall-btn';
                 uninstallBtn.innerHTML = '&times;';
                 uninstallBtn.title = 'Skript deinstallieren & Einstellungen löschen';
                 uninstallBtn.addEventListener('click', (e) => {
                     e.stopPropagation();
                     if (confirm(`Möchten Sie das Skript "${scriptMeta.name}" wirklich deinstallieren? Alle Einstellungen für dieses Skript werden ebenfalls gelöscht.`)) {
                         scriptStates[scriptMeta.name] = 'uninstall';
                         item.className = 'script-button uninstall' + (isExternal ? ' external-script' : '');
                     }
                 });
                 item.appendChild(uninstallBtn);
            }

            item.addEventListener('mouseover', (e) => {
                const tooltip = document.getElementById('bm-global-tooltip');
                tooltip.innerHTML = e.currentTarget.dataset.description;
                const buttonRect = e.currentTarget.getBoundingClientRect();
                tooltip.style.display = 'block';
                const tooltipWidth = tooltip.offsetWidth;
                const viewportWidth = window.innerWidth;
                let leftPos = buttonRect.right + 10;
                if (leftPos + tooltipWidth > viewportWidth - 15) {
                    leftPos = buttonRect.left - tooltipWidth - 10;
                }
                tooltip.style.top = `${buttonRect.top}px`;
                tooltip.style.left = `${leftPos}px`;
            });
            item.addEventListener('mouseout', () => {
                document.getElementById('bm-global-tooltip').style.display = 'none';
            });

            item.addEventListener('click', () => {
                const currentState = scriptStates[scriptMeta.name];
                if (initialScriptStates[scriptMeta.name] === 'removed' && currentState !== 'uninstall') return;
                if (['active', 'update', 'downgrade'].includes(currentState)) {
                    scriptStates[scriptMeta.name] = 'inactive';
                } else if (currentState === 'inactive') {
                    scriptStates[scriptMeta.name] = initialScriptStates[scriptMeta.name] === 'inactive' ? 'active' : initialScriptStates[scriptMeta.name];
                } else if (currentState === 'install') {
                    scriptStates[scriptMeta.name] = 'activate';
                } else if (currentState === 'activate') {
                    scriptStates[scriptMeta.name] = 'install';
                } else if (currentState === 'uninstall') {
                    scriptStates[scriptMeta.name] = initialScriptStates[scriptMeta.name];
                }
                const isExt = item.classList.contains('external-script');
                item.className = 'script-button ' + scriptStates[scriptMeta.name] + (isExt ? ' external-script' : '');
            });

            return item;
        },

        loadAndDisplayScripts: async function(forceRefresh = false) {
            // ... (unverändert) ...
            const scriptList = document.getElementById('script-list');
            const saveButton = document.getElementById('save-scripts-button');
            const filterInput = document.getElementById('bm-script-filter');

            if (forceRefresh) {
                sessionStorage.removeItem('bm_cache_timestamp');
                sessionStorage.removeItem('bm_cache_data');
                this._branchCache = {};
            }

            const now = Date.now();
            const cacheTimestamp = sessionStorage.getItem('bm_cache_timestamp');
            const cachedScripts = sessionStorage.getItem('bm_cache_data');

            if (!forceRefresh && cachedScripts && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
                scriptList.innerHTML = '';
                const allScripts = JSON.parse(cachedScripts);
                await this._populateUI(allScripts);
                this._applyFilters();
                return;
            }

            const loaderContainer = `<div class="bm-loader-container"><div class="bm-loader"></div> <span id="bm-loader-text">Initialisiere...</span></div>`;
            scriptList.innerHTML = loaderContainer;
            saveButton.style.display = 'none';
            filterInput.style.display = 'none';
            filterInput.value = '';
            scriptStates = {}; scriptMetadataCache = {};

            const updateLoaderText = (text) => {
                const loaderText = document.getElementById('bm-loader-text');
                if (loaderText) loaderText.textContent = text;
            };

            try {
                updateLoaderText('Lese Repositories...');
                const publicRepoInfo = { owner: GITHUB_REPO_OWNER, name: GITHUB_REPO_NAME, token: null };
                const publicScriptsPromise = this.fetchScriptsWithManifest(publicRepoInfo);

                const privateScriptPromises = [];
                const accessConfigString = localStorage.getItem('bm_access_cfg');
                if (accessConfigString) {
                    const repoConfigs = accessConfigString.split(';').filter(s => s.trim() !== '');
                    for (const config of repoConfigs) {
                        if (config.includes('@') && config.includes('/')) {
                            try {
                                const [token, repoPath] = config.split('@');
                                const [owner, name] = repoPath.split('/');
                                privateScriptPromises.push(this.fetchPrivateRepoScripts({ owner, name, token }, updateLoaderText));
                            } catch (e) { console.error(`[B&M Manager] Fehler beim Parsen: "${config}"`); }
                        }
                    }
                }

                const promises = [publicScriptsPromise, ...privateScriptPromises];
                const scriptArrays = await Promise.all(promises);
                const allScripts = scriptArrays.flat();

                sessionStorage.setItem('bm_cache_data', JSON.stringify(allScripts));
                sessionStorage.setItem('bm_cache_timestamp', Date.now());

                await this._populateUI(allScripts);
                this._applyFilters();
            } catch (error) {
                console.error('B&M Manager: Kritischer Fehler:', error);
                scriptList.innerHTML = `<p style="color:red; text-align: center;">Fehler beim Laden.<br>Bitte Konsole prüfen.</p>`;
            }
        },

        /**
         * _populateUI (MODIFIZIERT: Zählt aktive/inaktive Skripte und baut Header neu)
         */
        _populateUI: async function(allScripts) {
            const scriptList = document.getElementById('script-list');
            const saveButton = document.getElementById('save-scripts-button');
            const filterInput = document.getElementById('bm-script-filter');
            const viewMode = document.getElementById('bm-view-switcher').value;

            document.getElementById('bm-collapse-all').style.display = viewMode === 'category' ? 'inline-block' : 'none';

            scriptList.innerHTML = 'Verarbeite & sortiere...';
            let dbScripts = await this.getScriptsFromDB();
            scriptList.innerHTML = '';
            initialScriptStates = {};

            const onlineScriptDetails = new Map();
            const categoryMap = new Map();

            for (const scriptMeta of allScripts) {
                scriptMetadataCache[scriptMeta.name] = scriptMeta;
                const localScript = dbScripts.find(s => s.name === scriptMeta.name);

                let buttonState = 'install';
                let infoText = "";

                if (localScript) {
                    if (typeof localScript.hasSettings === 'undefined') {
                        localScript.hasSettings = window.BMScriptManager.codeHasSettings(localScript.code);
                        window.BMScriptManager.saveScriptToDB(localScript);
                    }
                    scriptMeta.hasSettings = scriptMeta.hasSettings || localScript.hasSettings;

                    if (localScript.isActive === false) buttonState = 'inactive';
                    else {
                        const vComp = this.compareVersions(scriptMeta.version, localScript.version);
                        if (vComp > 0) buttonState = 'update';
                        else if (vComp < 0) buttonState = 'downgrade';
                        else buttonState = 'active';
                    }
                }

                const isExternal = scriptMeta.repoInfo.owner !== GITHUB_REPO_OWNER || scriptMeta.repoInfo.name !== GITHUB_REPO_NAME;
                if (isExternal) {
                    infoText += `<strong><span class="external-warning">! NICHT ZUR WEITERGABE BESTIMMT !</span></strong>\n<em>Quelle: ${scriptMeta.repoInfo.owner}/${scriptMeta.repoInfo.name}</em>\n<hr>\n`;
                }
                if (buttonState === 'downgrade') {
                     infoText += `<strong><span class="external-warning">EMPFEHLUNG:</span> Reparatur-Update</strong>\n<hr>\nDeine installierte Version (${localScript.version}) wurde zurückgezogen. Es wird empfohlen, die stabile Version ${scriptMeta.version} zu installieren.\n<hr>\n`;
                }
                infoText += (scriptMeta.description || "Keine Beschreibung.") + (scriptMeta.changelog || "");

                scriptStates[scriptMeta.name] = buttonState;
                initialScriptStates[scriptMeta.name] = buttonState;

                const detail = { scriptMeta, infoText, buttonState };
                onlineScriptDetails.set(scriptMeta.name, detail);

                const categories = scriptMeta.categories && scriptMeta.categories.length > 0 ? scriptMeta.categories : [DEFAULT_CATEGORY];
                for (const category of categories) {
                    if (!categoryMap.has(category)) {
                        categoryMap.set(category, []);
                    }
                    categoryMap.get(category).push(detail);
                }
            }

            const onlineScriptNames = new Set(allScripts.map(s => s.name));
            for (const localScript of dbScripts) {
                if (!onlineScriptNames.has(localScript.name)) {
                    const scriptMeta = {
                        name: localScript.name,
                        version: localScript.version,
                        repoInfo: { owner: 'Unbekannt', name: 'Unbekannt' },
                        categories: [DEFAULT_CATEGORY]
                    };
                    const infoText = `<strong><span class="external-warning">VORSICHT:</span> Skript wurde online entfernt!</strong>\n<hr>\nDieses Skript ist lokal installiert, wurde aber online nicht mehr gefunden. Es wird empfohlen, es zu deinstallieren.`;
                    const buttonState = 'removed';

                    scriptStates[localScript.name] = buttonState;
                    initialScriptStates[localScript.name] = buttonState;

                    const detail = { scriptMeta, infoText, buttonState };
                    if (!categoryMap.has(DEFAULT_CATEGORY)) {
                        categoryMap.set(DEFAULT_CATEGORY, []);
                    }
                    categoryMap.get(DEFAULT_CATEGORY).push(detail);
                    onlineScriptDetails.set(scriptMeta.name, detail);
                }
            }

            if (viewMode === 'alphabetical') {
                scriptList.className = 'grid-view';
                const sortedDetails = [...onlineScriptDetails.values()].sort((a, b) =>
                    a.scriptMeta.name.toLocaleLowerCase().localeCompare(b.scriptMeta.name.toLocaleLowerCase())
                );

                for (const detail of sortedDetails) {
                    const item = this.createUIElement(detail.scriptMeta, detail.infoText, detail.buttonState);
                    scriptList.appendChild(item);
                }

            } else if (viewMode === 'category') {
                scriptList.className = 'category-view';
                const sortedCategories = [...categoryMap.keys()].sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()));

                for (const category of sortedCategories) {
                    const categoryGroup = document.createElement('details');
                    categoryGroup.className = 'bm-category-group';
                    categoryGroup.open = false;

                    const categoryHeader = document.createElement('summary');
                    categoryHeader.className = 'bm-category-header';

                    const scriptsInCategory = categoryMap.get(category);
                    const uniqueScripts = [...new Map(scriptsInCategory.map(d => [d.scriptMeta.name, d])).values()];

                    const total = uniqueScripts.length;
                    const active = uniqueScripts.filter(d => ['active', 'update', 'downgrade'].includes(d.buttonState)).length;
                    const inactive = uniqueScripts.filter(d => d.buttonState === 'inactive').length;

                    // ##### MODIFIZIERT: Icon für "Total" geändert #####
                    categoryHeader.innerHTML = `
                        <div class="bm-cat-title">${category}</div>
                        <div class="bm-cat-stats">
                            <span class="bm-stat-total" title="Gesamt in Kategorie">📚 ${total}</span>
                            <span class="bm-stat-active" title="Aktiviert">✔️ ${active}</span>
                            <span class="bm-stat-inactive" title="Deaktiviert">❌ ${inactive}</span>
                        </div>
                    `;
                    // ##### /MODIFIZIERT #####

                    categoryGroup.appendChild(categoryHeader);

                    const categoryGrid = document.createElement('div');
                    categoryGrid.className = 'bm-category-grid';
                    categoryGroup.appendChild(categoryGrid);

                    uniqueScripts.sort((a, b) => a.scriptMeta.name.toLocaleLowerCase().localeCompare(b.scriptMeta.name.toLocaleLowerCase()));

                    for (const detail of uniqueScripts) {
                         const item = this.createUIElement(detail.scriptMeta, detail.infoText, detail.buttonState);
                         categoryGrid.appendChild(item);
                    }
                    scriptList.appendChild(categoryGroup);
                }
            }

            saveButton.style.display = 'block';
            filterInput.style.display = 'block';
        },

        /**
         * _applyFilters (Unverändert)
         */
        _applyFilters: function() {
            const searchTerm = document.getElementById('bm-script-filter').value.toLowerCase();
            const viewMode = document.getElementById('bm-view-switcher').value;

            if (viewMode === 'alphabetical') {
                const allButtons = document.querySelectorAll('#script-list .script-button');
                allButtons.forEach(button => {
                    const nameMatch = button.dataset.scriptName.includes(searchTerm);
                    const infoMatch = button.dataset.scriptInfo.includes(searchTerm);
                    button.classList.toggle('hidden', !(nameMatch || infoMatch));
                });
            } else if (viewMode === 'category') {
                const allCategoryGroups = document.querySelectorAll('#script-list .bm-category-group');
                allCategoryGroups.forEach(group => {
                    const categoryTitle = group.querySelector('.bm-cat-title').textContent.toLowerCase();
                    const titleMatch = categoryTitle.includes(searchTerm);
                    let scriptsVisibleInGroup = 0;

                    const allButtonsInGroup = group.querySelectorAll('.script-button');
                    allButtonsInGroup.forEach(button => {
                        const nameMatch = button.dataset.scriptName.includes(searchTerm);
                        const infoMatch = button.dataset.scriptInfo.includes(searchTerm);
                        const scriptMatch = nameMatch || infoMatch;

                        button.classList.toggle('hidden', !scriptMatch);
                        if (scriptMatch) {
                            scriptsVisibleInGroup++;
                        }
                    });

                    const groupVisible = titleMatch || (scriptsVisibleInGroup > 0);
                    group.classList.toggle('hidden', !groupVisible);

                    if (searchTerm.length > 0 && !titleMatch && scriptsVisibleInGroup > 0) {
                        group.open = true;
                    }
                });
            }
        },

        // --- Speichern & Update-Logik (Unverändert) ---
        applyChanges: async function() {
            // ... (unverändert) ...
            const saveButton = document.getElementById('save-scripts-button');
            saveButton.disabled = true;
            saveButton.innerHTML = 'Wende Änderungen an...';
            try {
                for (const scriptName in scriptStates) {
                    const state = scriptStates[scriptName];
                    const initialState = initialScriptStates[scriptName];
                    const scriptMeta = scriptMetadataCache[scriptName];

                    if (state === initialState && !['update', 'downgrade'].includes(state)) continue;

                    if (state === 'activate' || state === 'update' || state === 'downgrade') {
                        if (!scriptMeta) continue;
                        const result = await window.BMScriptManager.fetchRawScript(scriptMeta.dirName, scriptMeta.fullName, scriptMeta.repoInfo);
                        if (result.success) {
                           const hasSettings = window.BMScriptManager.codeHasSettings(result.content);
                           const script = { name: scriptMeta.name, version: scriptMeta.version, code: result.content, match: window.BMScriptManager.extractMatchFromCode(result.content), hasSettings: hasSettings, isActive: true };
                           await window.BMScriptManager.saveScriptToDB(script);
                        }
                    } else if (state === 'uninstall') {
                        await window.BMScriptManager.deleteScriptFromDB(scriptName);
                    } else if (state === 'inactive' || (state === 'active' && initialState !== 'active')) {
                         const localScript = await window.BMScriptManager.getSingleScriptFromDB(scriptName);
                         if (localScript) {
                             localScript.isActive = (state === 'active');
                             await window.BMScriptManager.saveScriptToDB(localScript);
                         }
                    }
                }
                localStorage.removeItem('bm_update_available');
                await window.BMScriptManager.loadAndDisplayScripts(true);
            } catch (error) {
                console.error('[B&M Manager] Ein Fehler ist beim Anwenden der Änderungen aufgetreten:', error);
            } finally {
                saveButton.disabled = false;
                saveButton.innerHTML = 'Änderungen anwenden';
            }
        },
        checkForUpdatesInBackground: async function() {
            // ... (unverändert) ...
            const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
            const now = Date.now();
            const lastCheck = parseInt(localStorage.getItem('bm_last_update_check') || '0');

            if (now - lastCheck < UPDATE_CHECK_INTERVAL_MS) {
                if (localStorage.getItem('bm_update_available') === 'true') {
                    this.showUpdateNotification();
                }
                return;
            }

            localStorage.setItem('bm_last_update_check', now.toString());
            localStorage.setItem('bm_update_available', 'false');

            try {
                const publicRepoInfo = { owner: GITHUB_REPO_OWNER, name: GITHUB_REPO_NAME, token: null };
                const publicScripts = await this.fetchScriptsWithManifest(publicRepoInfo);
                const allOnlineScripts = publicScripts.flat();
                const localScripts = await this.getScriptsFromDB();
                const activeLocalScripts = localScripts.filter(s => s.isActive !== false);

                if (activeLocalScripts.length === 0) return;

                const onlineScriptsMap = new Map(allOnlineScripts.map(s => [s.name, s.version]));
                let updateFound = false;

                for (const localScript of activeLocalScripts) {
                    if (onlineScriptsMap.has(localScript.name)) {
                        const onlineVersion = onlineScriptsMap.get(localScript.name);
                        if (this.compareVersions(onlineVersion, localScript.version) > 0) {
                            updateFound = true;
                            break;
                        }
                    }
                }

                if (updateFound) {
                    localStorage.setItem('bm_update_available', 'true');
                    this.showUpdateNotification();
                    sessionStorage.removeItem('bm_cache_data');
                    sessionStorage.removeItem('bm_cache_timestamp');
                }
            } catch (error) {
                console.error('[B&M Manager] Fehler bei der Hintergrund-Update-Prüfung:', error);
            }
        },
        showUpdateNotification: function() {
            // ... (unverändert) ...
            const profileMenuLink = document.getElementById('menu_profile');
            const bmManagerLink = document.getElementById('b-m-scriptmanager-link');

            if (profileMenuLink) {
                profileMenuLink.classList.add('alliance_forum_new');
            }
            if (bmManagerLink) {
                bmManagerLink.classList.add('bm-update-highlight');
            }
        },

        // --- Einstellungs-UI (Unverändert) ---
        getSettings: function(scriptName) {
            // ... (unverändert) ...
            if (this._settingsCache[scriptName]) {
                return this._settingsCache[scriptName];
            }
            try {
                const settings = JSON.parse(localStorage.getItem(`BMSettings_${scriptName}`) || '{}');
                this._settingsCache[scriptName] = settings;
                return settings;
            } catch (e) { return {}; }
        },
        _saveSettings: function(scriptName, settings) {
            // ... (unverändert) ...
            this._settingsCache[scriptName] = settings;
            localStorage.setItem(`BMSettings_${scriptName}`, JSON.stringify(settings));
        },
        _buildSettingsUI: function(scriptName, schema) {
            // ... (unverändert) ...
            const settings = this.getSettings(scriptName);
            const modal = document.getElementById('bm-settings-modal');
            const content = modal.querySelector('.bm-settings-content');
            let formHtml = `<div class="bm-settings-header">Einstellungen für <strong>${scriptName}</strong></div><div class="bm-settings-body">`;
            for (const item of schema) {
                const value = settings[`param${item.param}`] ?? item.default;
                formHtml += `<div class="bm-settings-row" title="${item.info || ''}"><label for="bm-setting-${item.param}">${item.label}</label>`;
                switch(item.type) {
                    case 'checkbox': formHtml += `<input type="checkbox" id="bm-setting-${item.param}" ${value ? 'checked' : ''}>`; break;
                    case 'number': formHtml += `<input type="number" id="bm-setting-${item.param}" value="${value}" min="${item.min || ''}" max="${item.max || ''}">`; break;
                    case 'select':
                        formHtml += `<select id="bm-setting-${item.param}">`;
                        for (const option of item.options) {
                           formHtml += `<option value="${option.value}" ${option.value === value ? 'selected' : ''}>${option.text}</option>`;
                        }
                        formHtml += `</select>`;
                        break;
                    default: formHtml += `<input type="text" id="bm-setting-${item.param}" value="${value}">`; break;
                }
                formHtml += `</div>`;
            }
            formHtml += `</div><div class="bm-settings-footer"><button id="bm-settings-save">Speichern</button><button id="bm-settings-cancel">Abbrechen</button></div>`;
            content.innerHTML = formHtml;
            modal.style.display = 'flex';
            document.getElementById('bm-settings-cancel').addEventListener('click', () => modal.style.display = 'none');
            document.getElementById('bm-settings-save').addEventListener('click', () => {
                const newSettings = {};
                for (const item of schema) {
                    const input = document.getElementById(`bm-setting-${item.param}`);
                    const paramKey = `param${item.param}`;
                    switch(item.type) {
                        case 'checkbox': newSettings[paramKey] = input.checked; break;
                        case 'number': newSettings[paramKey] = Number(input.value); break;
                        default: newSettings[paramKey] = input.value; break;
                    }
                }
                this._saveSettings(scriptName, newSettings);
                modal.style.display = 'none';
                location.reload();
            });
        },
        _fetchAndShowSettingsUI: async function(scriptName) {
            // ... (unverändert) ...
            const modal = document.getElementById('bm-settings-modal');
            const content = modal.querySelector('.bm-settings-content');
            content.innerHTML = `<div class="bm-loader-container"><div class="bm-loader"></div> Lade Konfiguration...</div>`;
            modal.style.display = 'flex';
            const localScript = await window.BMScriptManager.getSingleScriptFromDB(scriptName);
            let scriptCode = localScript ? localScript.code : null;
            if (!scriptCode) {
                const scriptMeta = scriptMetadataCache[scriptName];
                if (!scriptMeta) {
                    content.innerHTML = `<p style="color:red; text-align:center;">Fehler: Skript-Metadaten nicht gefunden.</p><button onclick="this.parentElement.parentElement.style.display='none'">Schließen</button>`;
                    return;
                }
                const result = await window.BMScriptManager.fetchRawScript(scriptMeta.dirName, scriptMeta.fullName, scriptMeta.repoInfo);
                if (result.success) {
                    scriptCode = result.content;
                }
            }
            if (scriptCode) {
                if (window.BMScriptManager.codeHasSettings(scriptCode)) {
                    const match = scriptCode.match(/\/\*--BMScriptConfig([\s\S]*?)--\*\//);
                    try {
                        const schema = JSON.parse(match[1]);
                        this._buildSettingsUI(scriptName, schema);
                    } catch (e) {
                        content.innerHTML = `<p style="color:red; text-align:center;">Fehler: Konfiguration im Skript ist fehlerhaft.</p><button onclick="this.parentElement.parentElement.style.display='none'">Schließen</button>`;
                    }
                } else {
                    content.innerHTML = `<p style="text-align:center;">Für dieses Skript sind keine Einstellungen verfügbar.</p><button onclick="this.parentElement.parentElement.style.display='none'">Schließen</button>`;
                }
            } else {
                 content.innerHTML = `<p style="color:red; text-align:center;">Fehler: Konfiguration konnte nicht geladen werden.</p><button onclick="this.parentElement.parentElement.style.display='none'">Schließen</button>`;
            }
        }
    };

    // --- CSS-STYLES (MODIFIZIERT FÜR MEHR BLAU) ---
    GM_addStyle(`
        #lss-script-manager-container, #bm-settings-modal { font-family: sans-serif; }
        /* ##### NEUER HINTERGRUND ##### */
        #lss-script-manager-container {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            background-color: #262c37; /* Dunkles Blau/Slate */
            color: #eee;
            border: 1px solid #444c5e; /* Passender Rand */
            border-radius: 5px;
            padding: 20px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            display: none;
            width: 90%;
            max-width: 1300px;
        }
        #lss-script-manager-container.visible { display: block; }
        /* ##### BLAUE HEADER-LINIE ##### */
        #lss-script-manager-container h3 {
            color: white;
            text-align: center;
            border-bottom: 2px solid #007bff; /* Blauer Akzent */
            padding-bottom: 10px;
            margin: 0 0 15px 0;
        }

        /* Toolbar */
        .bm-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; flex-wrap: wrap; }
        #bm-script-filter-wrapper { position: relative; flex-grow: 1; min-width: 300px; }
        .bm-view-controls { display: flex; gap: 10px; align-items: center; }
        /* ##### BLAUERE TOOLBAR-ELEMENTE ##### */
        #bm-view-switcher, #bm-collapse-all {
            background-color: #3a4150; /* Blau-Grau */
            color: #eee;
            border: 1px solid #5c677d; /* Passender Rand */
            border-radius: 4px;
            padding: 8px 10px;
            cursor: pointer;
        }
        #bm-collapse-all:hover, #bm-view-switcher:hover { background-color: #4a5160; }

        #bm-script-filter {
            width: 100%;
            padding: 8px 40px 8px 10px;
            background-color: #3a4150; /* Blau-Grau */
            color: #eee;
            border: 1px solid #5c677d; /* Passender Rand */
            border-radius: 4px;
            box-sizing: border-box;
        }
        #bm-refresh-btn { position: absolute; right: 10px; top: 7px; font-size: 1.5em; cursor: pointer; color: #aaa; transition: color .2s, transform .5s; }
        #bm-refresh-btn:hover { color: #fff; transform: rotate(180deg); }
        #b-m-scriptmanager-link.bm-update-highlight { background-color: #28a745; border-radius: 3px; }

        /* Grid-Styling für Alphabetische Ansicht */
        #script-list.grid-view { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 75px; gap: 15px; }

        /* Flex-Styling für Kategorie-Ansicht */
        #script-list.category-view {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }

        /* ##### BLAUERE KATEGORIE-BOXEN ##### */
        .bm-category-group {
            border: 1px solid #444c5e;
            border-radius: 5px;
            margin: 0;
            background: linear-gradient(145deg, #3a4150, #2c313d); /* Blau-Grau Gradient */
            box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            flex-basis: 300px;
            flex-grow: 1;
        }
        .bm-category-group:hover {
            border-color: #007bff; /* Blauer Hover-Rand */
            box-shadow: 3px 3px 8px rgba(0, 123, 255, 0.3); /* Blauer Schatten */
            transform: translateY(-2px);
        }
        .bm-category-group.hidden { display: none; }

        /* Geöffnete Kategorie */
        details[open].bm-category-group {
            flex-basis: 100%;
            background: transparent;
            box-shadow: none;
            border-color: #444c5e;
        }
        details[open].bm-category-group:hover {
             transform: none;
             border-color: #444c5e; /* Kein Hover-Effekt wenn offen */
             box-shadow: none;
        }

        /* Header-Stil */
        .bm-category-header {
            padding: 15px;
            cursor: pointer;
            border-radius: 4px;
            transition: background-color 0.2s ease;
            text-align: center;
        }
        details[open] .bm-category-header {
             border-radius: 4px 4px 0 0;
             background-color: #3a4150; /* Blau-Grau */
             text-align: left;
        }

        .bm-cat-title {
            font-size: 1.3em;
            font-weight: bold;
            color: #eee;
            margin-bottom: 10px;
        }
        details[open] .bm-cat-title {
            font-size: 1.2em;
            margin-bottom: 0;
            display: inline-block;
        }

        .bm-cat-stats {
            display: flex;
            justify-content: center;
            gap: 15px;
            font-size: 0.9em;
        }
        details[open] .bm-cat-stats {
            display: inline-flex;
            float: right;
            margin-top: 2px;
        }

        /* ##### BLAUE "TOTAL"-ANZEIGE ##### */
        .bm-stat-total { color: #6c9cff; } /* Helles Blau */
        .bm-stat-active { color: #28a745; }
        .bm-stat-inactive { color: #dc3545; }

        /* Grid *innerhalb* einer Kategorie */
        .bm-category-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            grid-auto-rows: 75px;
            gap: 15px;
            padding: 15px;
            background-color: rgba(40, 48, 61, 0.3); /* Dunkelblauer transparenter BG */
        }

        /* Script-Buttons (Unverändert) */
        .script-button { padding: 8px; border-radius: 5px; cursor: pointer; transition: all 0.2s ease; position: relative; border: 2px solid transparent; text-align: center; font-size: 0.85em; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .script-button.hidden { display: none; }
        .script-button:hover { filter: brightness(1.15); transform: translateY(-2px); }
        .script-button strong { line-height: 1.2; }
        .script-button .version { font-size: 0.8em; opacity: 0.8; display: block; margin-top: 4px; }
        .script-button.install { background-color: #007bff; color: white; border-color: #007bff; }
        .script-button.update { background-color: #ffc107; border-color: #ffc107; color: #212529; }
        .script-button.active { background-color: #28a745; color: white; border-color: #28a745; }
        .script-button.inactive { background-color: #6c757d; color: white; border-color: #6c757d; }
        .script-button.uninstall { background-color: #dc3545; color: white; border-color: #dc3545; }
        .script-button.activate { background-color: #17a2b8; border-color: #17a2b8; color: white; }
        .script-button.removed { background-color: #495057; color: #ced4da; border-color: #343a40; }
        .script-button.removed:hover { filter: brightness(1); transform: none; }
        .script-button.removed strong { text-decoration: line-through; }
        .script-button.downgrade { background-color: #fd7e14; border-color: #fd7e14; color: white; }

        /* Tooltip (Unverändert) */
        #bm-global-tooltip { display: none; position: fixed; background-color: #333; padding: 10px; border-radius: 5px; white-space: pre-wrap; z-index: 10001; width: 250px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); text-align: left; pointer-events: none; color: #f1f1f1;}
        #save-scripts-button { display: none; width: 100%; padding: 10px; margin-top: 20px; font-weight: bold; color: white; background-color: #007bff; border: none; border-radius: 5px; cursor: pointer; }
        .script-button.external-script { border-color: #ff9800; box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
        .external-symbol, .update-symbol, .bm-config-btn { vertical-align: middle; }
        .external-symbol { margin-right: 5px; }
        .external-warning { color: #ff6b6b; }
        .update-symbol { display: inline-block; animation: bm-spin 2s linear infinite; }
        .bm-config-btn { cursor: pointer; font-size: 1.1em; position: absolute; bottom: 5px; right: 8px; opacity: 0.6; transition: opacity 0.2s; }
        .script-button:hover .bm-config-btn { opacity: 1; }
        .bm-uninstall-btn { position: absolute; top: -2px; right: 2px; font-size: 1.4em; color: #fff; cursor: pointer; opacity: 0; transition: opacity 0.2s; line-height: 1; background-color: rgba(0,0,0,0.3); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; text-shadow: 0 0 3px black; }
        .script-button:hover .bm-uninstall-btn { opacity: 0.8; }
        .bm-uninstall-btn:hover { opacity: 1; color: #ffc107; }
        .bm-close-btn { position: absolute; top: 10px; right: 15px; font-size: 28px; font-weight: bold; color: #aaa; cursor: pointer; line-height: 1; transition: color 0.2s ease; }
        .bm-close-btn:hover { color: #fff; }
        .bm-loader-container { display: flex; justify-content: center; align-items: center; padding: 40px; color: #aaa; font-size: 1.1em; grid-column: 1 / -1; }
        .bm-loader { display: inline-block; border: 4px solid #444; border-top: 4px solid #007bff; border-radius: 50%; width: 24px; height: 24px; animation: bm-spin 1s linear infinite; margin-right: 15px; flex-shrink: 0; }
        #bm-loader-text { text-align: left; }
        @keyframes bm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Einstellungs-Modal (Angepasst an Blau) */
        #bm-settings-modal { ... }
        .bm-settings-content {
            background-color: #2c313d; /* Dunkles Blau-Grau */
            color: #eee;
            padding: 20px;
            border-radius: 5px;
            border: 1px solid #444c5e; /* Passender Rand */
            width: 90%;
            max-width: 500px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        }
        .bm-settings-header { font-size: 1.5em; margin-bottom: 20px; border-bottom: 1px solid #444c5e; padding-bottom: 10px; }
        .bm-settings-body { ... }
        .bm-settings-row { ... }
        .bm-settings-row label { ... }
        .bm-settings-row input, .bm-settings-row select { ... }
        .bm-settings-row input:focus, .bm-settings-row select:focus { outline: none; border-color: #007bff; }
        .bm-settings-row input[type="checkbox"] { ... }
        .bm-settings-footer { margin-top: 20px; text-align: right; border-top: 1px solid #444c5e; padding-top: 15px; }
        .bm-settings-footer button { ... }
        .bm-settings-footer button#bm-settings-cancel { background-color: #6c757d; }
    `);

    // --- HTML-Aufbau & Event-Listener (Unverändert zu 13.6.0) ---
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.createElement('div');
        container.id = 'lss-script-manager-container';
        container.innerHTML = `
            <span class="bm-close-btn" title="Schließen & Seite neu laden">&times;</span>
            <h3>B&M Scriptmanager</h3>
            <div class="bm-toolbar">
                <div id="bm-script-filter-wrapper">
                    <input type="text" id="bm-script-filter" placeholder="Filter nach Name oder Info..." style="display: none;">
                    <span id="bm-refresh-btn" title="Cache leeren und neu laden">🔄</span>
                </div>
                <div class="bm-view-controls">
                    <button id="bm-collapse-all" title="Alle Kategorien einklappen" style="display: none;">Alle einklappen</button>
                    <label for="bm-view-switcher" style="font-size: 0.9em; margin-right: 5px;">Anzeige:</label>
                    <select id="bm-view-switcher">
                        <option value="alphabetical">Alphabet (alle)</option>
                        <option value="category">Nach Kategorie</option>
                    </select>
                </div>
            </div>
            <div id="script-list"></div>
            <button id="save-scripts-button" style="display: none;">Änderungen anwenden</button>`;
        document.body.appendChild(container);

        const settingsModal = document.createElement('div');
        settingsModal.id = 'bm-settings-modal';
        settingsModal.innerHTML = `<div class="bm-settings-content"></div>`;
        document.body.appendChild(settingsModal);

        const globalTooltip = document.createElement('div');
        globalTooltip.id = 'bm-global-tooltip';
        document.body.appendChild(globalTooltip);

        // Menü-Link (unverändert)
        const userMenu = document.querySelector('a[href="/settings/index"]')?.parentNode;
        if (userMenu) {
            const scriptManagerMenuItem = document.createElement('li');
            scriptManagerMenuItem.innerHTML = `<a href="#" id="b-m-scriptmanager-link" role="button"><img class="icon icons8-Settings" src="/images/icons8-settings.svg" width="24" height="24"> B&M Scriptmanager</a>`;
            userMenu.parentNode.insertBefore(scriptManagerMenuItem, userMenu.nextSibling);

            document.getElementById('b-m-scriptmanager-link').addEventListener('click', async (e) => {
                e.preventDefault();
                const managerContainer = document.getElementById('lss-script-manager-container');
                const isVisible = managerContainer.classList.toggle('visible');
                if (isVisible) {
                    await window.BMScriptManager.openDatabase();
                    window.BMScriptManager.loadAndDisplayScripts();
                }
            });
        }

        // --- Event-Listener (Unverändert zu 13.6.0) ---
        document.getElementById('save-scripts-button').addEventListener('click', window.BMScriptManager.applyChanges);

        container.querySelector('.bm-close-btn').addEventListener('click', () => {
            location.reload();
        });

        document.getElementById('bm-refresh-btn').addEventListener('click', () => {
            window.BMScriptManager.loadAndDisplayScripts(true);
        });

        document.getElementById('bm-view-switcher').addEventListener('change', (e) => {
             document.getElementById('bm-collapse-all').style.display = e.target.value === 'category' ? 'inline-block' : 'none';
             window.BMScriptManager.loadAndDisplayScripts(false);
        });

        document.getElementById('bm-collapse-all').addEventListener('click', () => {
            document.querySelectorAll('#script-list .bm-category-group').forEach(details => {
                details.open = false;
            });
        });

        document.getElementById('bm-script-filter').addEventListener('input', (e) => {
            window.BMScriptManager._applyFilters();
        });

        // --- Start-Logik (Unverändert) ---
        window.BMScriptManager.openDatabase().then(() => {
            window.BMScriptManager.checkForUpdatesInBackground();
        });

        window.BMScriptManager.runActiveScripts();
    });
})();
