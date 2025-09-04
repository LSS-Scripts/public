// ==UserScript==
// @name         B&M Scriptmanager
// @namespace    https://github.com/LSS-Scripts/public
// @version      13.3.6 (Reactivation Fix)
// @description  Behebt einen Fehler, bei dem initial deaktivierte Skripte nicht wieder aktiviert werden konnten.
// @author       Dein Name (und Gemini)
// @match        https://www.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
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

    let scriptStates = {};
    let initialScriptStates = {};
    let scriptMetadataCache = {};
    let db;

    window.BMScriptManager = {
        _settingsCache: {},
        _branchCache: {},

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
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['scripts'], 'readwrite');
                const objectStore = transaction.objectStore('scripts');
                const request = objectStore.put(script);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        },
        deleteScriptFromDB: function(scriptName) {
            localStorage.removeItem(`BMSettings_${scriptName}`);
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['scripts'], 'readwrite');
                const objectStore = transaction.objectStore('scripts');
                const request = objectStore.delete(scriptName);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        },
        getScriptNameAndVersion: function(fileName) {
            const regex = /(.+)\.v(\d+\.\d+\.\d+)\.user\.js/;
            const match = fileName.match(regex);
            if (match) {
                return { name: match[1], version: match[2], fullName: fileName };
            }
            return null;
        },
        extractMatchFromCode: function(code) {
            const matchRegex = /@match\s+(.+)/g;
            let match;
            const matches = [];
            while ((match = matchRegex.exec(code)) !== null) {
                matches.push(match[1]);
            }
            return matches;
        },
        codeHasSettings: function(code) {
            return /\/\*--BMScriptConfig([\s\S]*?)--\*\//.test(code);
        },
        compareVersions: function(v1, v2) {
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
                console.warn(`[B&M Manager] Konnte Default-Branch für ${repoPath} nicht ermitteln, nutze 'main' als Fallback.`);
                return 'main';
            }
        },
        _fetchRawFile: async function(filePath, repoInfo = null) {
            return new Promise(async (resolve) => {
                const owner = repoInfo ? repoInfo.owner : GITHUB_REPO_OWNER;
                const name = repoInfo ? repoInfo.name : GITHUB_REPO_NAME;
                const token = repoInfo ? repoInfo.token : null;
                const defaultBranch = await this._getDefaultBranch({owner, name, token});
                let fileUrl = `https://raw.githubusercontent.com/${owner}/${name}/${defaultBranch}/${filePath}`;
                const headers = token ? { 'Authorization': `token ${token}` } : {};
                console.log(`[B&M GitHub Log] ➡️ Fordere Roh-Datei an: ${fileUrl}`);
                GM_xmlhttpRequest({
                    method: 'GET', url: fileUrl, headers,
                    onload: res => {
                        if (res.status === 200 && res.responseText) {
                            console.log(`[B&M GitHub Log] ✅ Datei empfangen (Status: ${res.status}) von: ${fileUrl}`);
                            resolve({ success: true, content: res.responseText });
                        } else {
                            console.error(`[B&M GitHub Log] ❌ Fehler beim Abrufen der Datei (Status: ${res.status}) von: ${fileUrl}`);
                            resolve({ success: false });
                        }
                    },
                    onerror: (err) => {
                        console.error(`[B&M GitHub Log] ❌ Netzwerkfehler beim Anfordern der Datei von: ${fileUrl}`, err);
                        resolve({ success: false });
                    }
                });
            });
        },
        _fetchFileWithAPI: async function(filePath, repoInfo) {
             return new Promise(async (resolve) => {
                const owner = repoInfo.owner;
                const name = repoInfo.name;
                const token = repoInfo.token;
                const apiPath = `${owner}/${name}/contents/${filePath}`;
                const result = await this._fetchRESTContents(apiPath, token);

                if (result.success && result.data.content) {
                    try {
                        const decodedContent = decodeURIComponent(escape(window.atob(result.data.content)));
                        console.log(`[B&M GitHub Log] ✅ API-Datei dekodiert: ${filePath}`);
                        resolve({ success: true, content: decodedContent });
                    } catch (e) {
                        console.error(`[B&M GitHub Log] ❌ Fehler beim Dekodieren der API-Datei: ${filePath}`, e);
                        resolve({ success: false });
                    }
                } else {
                    resolve({ success: false });
                }
            });
        },
        fetchRawScript: function(dirName, fileName, repoInfo) {
            return this._fetchRawFile(`${dirName}/${fileName}`, repoInfo);
        },
        _fetchRESTContents: function(path, token = null) {
            return new Promise((resolve) => {
                const fullUrl = GITHUB_API_URL + path;
                const headers = token ? { 'Authorization': `token ${token}` } : {};
                console.log(`[B&M GitHub Log] ➡️ Fordere API-Daten an: ${fullUrl}`);
                GM_xmlhttpRequest({
                    method: 'GET', url: fullUrl, headers,
                    onload: res => {
                        if (res.status === 200) {
                            console.log(`[B&M GitHub Log] ✅ API-Daten empfangen (Status: ${res.status}) von: ${fullUrl}`);
                            resolve({ success: true, data: JSON.parse(res.responseText) });
                        } else {
                            console.error(`[B&M GitHub Log] ❌ Fehler beim Abrufen der API-Daten (Status: ${res.status}) von: ${fullUrl}`);
                            resolve({ success: false, status: res.status });
                        }
                    },
                    onerror: (err) => {
                         console.error(`[B&M GitHub Log] ❌ Netzwerkfehler beim Anfordern von API-Daten von: ${fullUrl}`, err);
                         resolve({ success: false, status: 'NETWORK_ERROR' });
                    }
                });
            });
        },
        getScriptDetails: async function(dir, repoInfo) {
            try {
                const filesInDirResult = await this._fetchRESTContents(dir.url.replace('https://api.github.com/repos/', ''), repoInfo.token);
                if (!filesInDirResult.success) return null;
                const userJsFile = filesInDirResult.data.find(f => f.name.endsWith('.user.js'));
                if (!userJsFile) return null;
                const scriptMeta = this.getScriptNameAndVersion(userJsFile.name);
                if (!scriptMeta) return null;
                const [info, changelog] = await Promise.all([
                    this._fetchRawFile(`${dir.name}/info.txt`, repoInfo).then(r => r.success ? r.content.trim() : `Keine info.txt gefunden.`),
                    this._fetchRawFile(`${dir.name}/changelog.txt`, repoInfo).then(r => r.success && r.content.trim() ? `\n<hr>\n<strong>Changelog:</strong>\n${r.content}` : "")
                ]);
                scriptMeta.description = info;
                scriptMeta.changelog = changelog;
                scriptMeta.repoInfo = repoInfo;
                scriptMeta.dirName = dir.name;
                return scriptMeta;
            } catch (e) {
                console.error(`[B&M Manager] Fehler beim Verarbeiten von Verzeichnis ${dir.name}`, e);
                return null;
            }
        },
        fetchScriptsWithManifest: async function(repoInfo) {
            const result = await this._fetchFileWithAPI('manifest.json', repoInfo);
            if (result.success) {
                try {
                    const manifest = JSON.parse(result.content);
                    manifest.forEach(script => {
                        script.repoInfo = repoInfo;
                        script.dirName = script.name;
                        script.fullName = script.fileName;
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
            const repoPath = `${repoInfo.owner}/${repoInfo.name}`;
            if(progressCallback) progressCallback(`Prüfe Manifest für ${repoPath}...`);
            const manifestResult = await this.fetchScriptsWithManifest(repoInfo);
            if (manifestResult.length > 0) {
                console.log(`[B&M Manager] ✅ Manifest in privatem Repo '${repoPath}' gefunden und verwendet.`);
                return manifestResult;
            } else {
                console.log(`[B&M Manager] ℹ️ Kein Manifest in privatem Repo '${repoPath}' gefunden. Fallback auf Verzeichnis-Scan.`);
                return this.fetchScriptsWithREST(repoInfo, progressCallback);
            }
        },
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
        createUIElement: function(scriptMeta, infoText, buttonState) {
            const scriptList = document.getElementById('script-list');
            const item = document.createElement('div');
            item.className = 'script-button ' + buttonState;
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

            scriptList.appendChild(item);
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
            // ########## KORRIGIERTE KLICK-LOGIK ##########
            item.addEventListener('click', () => {
                const currentState = scriptStates[scriptMeta.name];

                if (initialScriptStates[scriptMeta.name] === 'removed' && currentState !== 'uninstall') {
                    return;
                }

                if (['active', 'update', 'downgrade'].includes(currentState)) {
                    scriptStates[scriptMeta.name] = 'inactive';
                } else if (currentState === 'inactive') {
                    if (initialScriptStates[scriptMeta.name] === 'inactive') {
                        scriptStates[scriptMeta.name] = 'active'; // Explizit aktivieren
                    } else {
                        scriptStates[scriptMeta.name] = initialScriptStates[scriptMeta.name]; // Zum vorherigen Zustand zurück
                    }
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
        },
        loadAndDisplayScripts: async function(forceRefresh = false) {
            const scriptList = document.getElementById('script-list');
            const saveButton = document.getElementById('save-scripts-button');
            const filterInput = document.getElementById('bm-script-filter');

            if (forceRefresh) {
                console.log('[B&M Manager] Cache wird geleert (forceRefresh=true).');
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
            } catch (error) {
                console.error('B&M Manager: Kritischer Fehler:', error);
                scriptList.innerHTML = `<p style="color:red; text-align: center;">Fehler beim Laden.<br>Bitte Konsole prüfen.</p>`;
            }
        },
        _populateUI: async function(allScripts) {
            const scriptList = document.getElementById('script-list');
            const saveButton = document.getElementById('save-scripts-button');
            const filterInput = document.getElementById('bm-script-filter');
            scriptList.innerHTML = 'Verarbeite & sortiere...';
            let dbScripts = await this.getScriptsFromDB();
            allScripts.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
            scriptList.innerHTML = '';
            initialScriptStates = {};

            for (const scriptMeta of allScripts) {
                scriptMetadataCache[scriptMeta.name] = scriptMeta;
                const isExternal = scriptMeta.repoInfo.owner !== GITHUB_REPO_OWNER || scriptMeta.repoInfo.name !== GITHUB_REPO_NAME;
                let extraInfo = '';
                if (isExternal) {
                    const repoPath = `${scriptMeta.repoInfo.owner}/${scriptMeta.repoInfo.name}`;
                    extraInfo = `<strong><span class="external-warning">! NICHT ZUR WEITERGABE BESTIMMT !</span></strong>\n<em>Quelle: ${repoPath}</em>\n<hr>\n`;
                }
                const fullDescription = extraInfo + (scriptMeta.description || "Keine Beschreibung.") + (scriptMeta.changelog || "");
                const localScript = dbScripts.find(s => s.name === scriptMeta.name);
                let buttonState = 'install';
                let infoText = fullDescription;

                if (localScript) {
                    if (typeof localScript.hasSettings === 'undefined') {
                        localScript.hasSettings = window.BMScriptManager.codeHasSettings(localScript.code);
                        window.BMScriptManager.saveScriptToDB(localScript);
                    }
                    scriptMeta.hasSettings = scriptMeta.hasSettings || localScript.hasSettings;

                    // Wichtig: Der `initialState` wird hier anhand des DB-Eintrags gesetzt, nicht nach der Versionsprüfung
                    if (localScript.isActive === false) {
                        buttonState = 'inactive';
                    } else {
                        const versionComparison = this.compareVersions(scriptMeta.version, localScript.version);
                        if (versionComparison > 0) {
                            buttonState = 'update';
                        } else if (versionComparison < 0) {
                            buttonState = 'downgrade';
                             infoText = `<strong><span class="external-warning">EMPFEHLUNG:</span> Reparatur-Update</strong>\n<hr>\nDeine installierte Version (${localScript.version}) wurde zurückgezogen. Es wird empfohlen, die stabile Version ${scriptMeta.version} zu installieren.\n<hr>\n` + fullDescription;
                        } else {
                            buttonState = 'active';
                        }
                    }
                }
                this.createUIElement(scriptMeta, infoText, buttonState);
                scriptStates[scriptMeta.name] = buttonState;
                initialScriptStates[scriptMeta.name] = buttonState;
            }

            const onlineScriptNames = new Set(allScripts.map(s => s.name));
            for (const localScript of dbScripts) {
                if (!onlineScriptNames.has(localScript.name)) {
                    console.warn(`[B&M Manager] Verwaistes Skript gefunden: '${localScript.name}'.`);
                    const scriptMeta = { name: localScript.name, version: localScript.version, repoInfo: { owner: 'Unbekannt', name: 'Unbekannt' } };
                    const infoText = `<strong><span class="external-warning">VORSICHT:</span> Skript wurde online entfernt!</strong>\n<hr>\nDieses Skript ist lokal installiert, wurde aber online nicht mehr gefunden. Es wird empfohlen, es zu deinstallieren.`;
                    this.createUIElement(scriptMeta, infoText, 'removed');
                    scriptStates[localScript.name] = 'removed';
                    initialScriptStates[localScript.name] = 'removed';
                }
            }

            saveButton.style.display = 'block';
            filterInput.style.display = 'block';
        },
        applyChanges: async function() {
            const saveButton = document.getElementById('save-scripts-button');
            saveButton.disabled = true;
            saveButton.innerHTML = 'Wende Änderungen an...';
            try {
                console.log(`[B&M Manager] Starte Speichervorgang...`);
                for (const scriptName in scriptStates) {
                    const state = scriptStates[scriptName];
                    const initialState = initialScriptStates[scriptName];
                    const scriptMeta = scriptMetadataCache[scriptName];

                    if (state === initialState && !['update', 'downgrade'].includes(state)) continue;

                    if (state === 'activate' || state === 'update' || state === 'downgrade') {
                        if (!scriptMeta) continue;
                        const action = (initialState === 'install' || initialState === 'activate') ? 'Installiere' : 'Aktualisiere/Repariere';
                        console.log(`[B&M Manager] 📥 ${action} Skript: '${scriptName}' (zu Version ${scriptMeta.version})`);
                        const result = await window.BMScriptManager.fetchRawScript(scriptMeta.dirName, scriptMeta.fullName, scriptMeta.repoInfo);
                        if (result.success) {
                           const hasSettings = window.BMScriptManager.codeHasSettings(result.content);
                           const script = { name: scriptMeta.name, version: scriptMeta.version, code: result.content, match: window.BMScriptManager.extractMatchFromCode(result.content), hasSettings: hasSettings, isActive: true };
                           await window.BMScriptManager.saveScriptToDB(script);
                           console.log(`[B&M Manager] ✅ Skript '${scriptName}' erfolgreich gespeichert.`);
                        } else {
                           console.error(`[B&M Manager] ❌ Fehler beim Herunterladen von Skript '${scriptName}'.`);
                        }
                    } else if (state === 'uninstall') {
                        console.log(`[B&M Manager] 🗑️ Deinstalliere Skript: '${scriptName}'`);
                        await window.BMScriptManager.deleteScriptFromDB(scriptName);
                        console.log(`[B&M Manager] ✅ Skript '${scriptName}' erfolgreich deinstalliert.`);
                    } else if (state === 'inactive' || (state === 'active' && initialState !== 'active')) {
                         console.log(`[B&M Manager] 🔄 Ändere Status für '${scriptName}' zu '${state}'`);
                         const localScript = await window.BMScriptManager.getSingleScriptFromDB(scriptName);
                         if (localScript) {
                             localScript.isActive = (state === 'active');
                             await window.BMScriptManager.saveScriptToDB(localScript);
                             console.log(`[B&M Manager] ✅ Status für '${scriptName}' erfolgreich aktualisiert.`);
                         }
                    }
                }
                console.log(`[B&M Manager] Alle Änderungen verarbeitet. Aktualisiere UI...`);
                await window.BMScriptManager.loadAndDisplayScripts(true);
            } catch (error) {
                console.error('[B&M Manager] Ein Fehler ist beim Anwenden der Änderungen aufgetreten:', error);
            } finally {
                saveButton.disabled = false;
                saveButton.innerHTML = 'Änderungen anwenden';
            }
        },
        getSettings: function(scriptName) {
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
            this._settingsCache[scriptName] = settings;
            localStorage.setItem(`BMSettings_${scriptName}`, JSON.stringify(settings));
        },
        _buildSettingsUI: function(scriptName, schema) {
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

    GM_addStyle(`
        #lss-script-manager-container, #bm-settings-modal { font-family: sans-serif; }
        #lss-script-manager-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background-color: #222; color: #eee; border: 1px solid #555; border-radius: 5px; padding: 20px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: none; width: 90%; max-width: 1300px; }
        #lss-script-manager-container.visible { display: block; }
        #lss-script-manager-container h3 { color: white; text-align: center; border-bottom: 2px solid #555; padding-bottom: 10px; margin: 0 0 15px 0; }
        #bm-script-filter-wrapper { position: relative; }
        #bm-script-filter { width: 100%; padding: 8px 40px 8px 10px; margin-bottom: 20px; background-color: #333; color: #eee; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; }
        #bm-refresh-btn { position: absolute; right: 10px; top: 7px; font-size: 1.5em; cursor: pointer; color: #aaa; transition: color .2s, transform .5s; }
        #bm-refresh-btn:hover { color: #fff; transform: rotate(180deg); }
        #script-list { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 75px; gap: 15px; }
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
        .downgrade-symbol { display: inline-block; transform: scaleX(-1); }
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
        #bm-settings-modal { display: none; position: fixed; z-index: 10001; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); justify-content: center; align-items: center; }
        .bm-settings-content { background-color: #333; color: #eee; padding: 20px; border-radius: 5px; border: 1px solid #555; width: 90%; max-width: 500px; box-shadow: 0 5px 20px rgba(0,0,0,0.5); }
        .bm-settings-header { font-size: 1.5em; margin-bottom: 20px; border-bottom: 1px solid #555; padding-bottom: 10px; }
        .bm-settings-body { max-height: 60vh; overflow-y: auto; padding-right: 10px; }
        .bm-settings-row { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; align-items: center; margin-bottom: 12px; }
        .bm-settings-row label { text-align: right; cursor: help; }
        .bm-settings-row input, .bm-settings-row select { width: 100%; box-sizing: border-box; background-color: #dadada; color: #111; border: 1px solid #999; padding: 5px; border-radius: 3px; transition: border-color .2s ease; }
        .bm-settings-row input:focus, .bm-settings-row select:focus { outline: none; border-color: #007bff; }
        .bm-settings-row input[type="checkbox"] { width: 20px; height: 20px; justify-self: start; }
        .bm-settings-footer { margin-top: 20px; text-align: right; border-top: 1px solid #555; padding-top: 15px; }
        .bm-settings-footer button { background-color: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-left: 10px; }
        .bm-settings-footer button#bm-settings-cancel { background-color: #6c757d; }
    `);

    document.addEventListener('DOMContentLoaded', () => {
        const container = document.createElement('div');
        container.id = 'lss-script-manager-container';
        container.innerHTML = `
            <span class="bm-close-btn" title="Schließen & Seite neu laden">&times;</span>
            <h3>B&M Scriptmanager</h3>
            <div id="bm-script-filter-wrapper">
                <input type="text" id="bm-script-filter" placeholder="Filter nach Name oder Info..." style="display: none;">
                <span id="bm-refresh-btn" title="Cache leeren und neu laden">🔄</span>
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

        document.getElementById('save-scripts-button').addEventListener('click', window.BMScriptManager.applyChanges);

        container.querySelector('.bm-close-btn').addEventListener('click', () => {
            location.reload();
        });

        document.getElementById('bm-refresh-btn').addEventListener('click', () => {
            window.BMScriptManager.loadAndDisplayScripts(true);
        });

        document.getElementById('bm-script-filter').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const allButtons = document.querySelectorAll('#script-list .script-button');
            allButtons.forEach(button => {
                const scriptName = button.querySelector('strong').textContent.toLowerCase();
                const scriptInfo = button.dataset.description.toLowerCase();
                const isMatch = scriptName.includes(searchTerm) || scriptInfo.includes(searchTerm);
                button.classList.toggle('hidden', !isMatch);
            });
        });

        window.BMScriptManager.runActiveScripts();
    });
})();
