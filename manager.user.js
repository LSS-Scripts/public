// ==UserScript==
// @name         B&M Scriptmanager
// @namespace    https://github.com/LSS-Scripts/public
// @version      7.1
// @description  Ein zentraler Manager mit detailliertem Action-Logging, Filter, Grid-Layout und mehr.
// @author       Masklin
// @match        https://www.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const GITHUB_REPO_OWNER = 'LSS-Scripts';
    const GITHUB_REPO_NAME = 'public';
    const DB_NAME = 'LSSScriptDB';
    const DB_VERSION = 1;

    let scriptStates = {};
    let scriptMetadataCache = {};
    let db;

    window.BMScriptManager = {
        openDatabase: function() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    db.createObjectStore('scripts', { keyPath: 'name' });
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
        fetchRepoContents: function(dirName = '', customRepo = null) {
            return new Promise((resolve, reject) => {
                let owner = GITHUB_REPO_OWNER;
                let name = GITHUB_REPO_NAME;
                const headers = {};
                const repoInfo = customRepo || { owner, name, token: null };

                if (customRepo) {
                    owner = customRepo.owner;
                    name = customRepo.name;
                    if (customRepo.token) {
                        headers['Authorization'] = `token ${customRepo.token}`;
                    }
                }
                const apiUrl = `https://api.github.com/repos/${owner}/${name}/contents/${dirName}`;
                
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: headers,
                    onload: (response) => {
                        if (response.status === 200) {
                            const contents = JSON.parse(response.responseText);
                            contents.forEach(item => item.repoInfo = repoInfo);
                            resolve(contents);
                        } else {
                            console.error(`[B&M Manager] Fehler (Status ${response.status}) für '${owner}/${name}'.`);
                            resolve([]);
                        }
                    },
                    onerror: (error) => {
                        console.error(`[B&M Manager] Netzwerkfehler bei '${owner}/${name}'.`, error);
                        reject(error);
                    }
                });
            });
        },
        _fetchRawFile: function(filePath, repoInfo = null) {
             return new Promise((resolve) => {
                const owner = repoInfo ? repoInfo.owner : GITHUB_REPO_OWNER;
                const name = repoInfo ? repoInfo.name : GITHUB_REPO_NAME;
                const token = repoInfo ? repoInfo.token : null;
                const fileUrl = `https://raw.githubusercontent.com/${owner}/${name}/main/${filePath}`;
                const headers = token ? { 'Authorization': `token ${token}` } : {};

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: fileUrl,
                    headers: headers,
                    onload: (response) => {
                        if (response.status === 200) {
                            resolve({ success: true, content: response.responseText });
                        } else {
                           resolve({ success: false });
                        }
                    },
                    onerror: () => resolve({ success: false })
                });
            });
        },
        fetchRawScript: function(dirName, fileName, repoInfo) {
            return this._fetchRawFile(`${dirName}/${fileName}`, repoInfo);
        },
        fetchScriptInfo: async function(dirName, repoInfo) {
            const result = await this._fetchRawFile(`${dirName}/info.txt`, repoInfo);
            return result.success ? result.content : "Keine Beschreibung verfügbar.";
        },
        fetchChangelog: async function(dirName, repoInfo) {
            const result = await this._fetchRawFile(`${dirName}/changelog.txt`, repoInfo);
            return result.success && result.content.trim() !== '' ? `\n<hr>\n<strong>Changelog:</strong>\n${result.content}` : "";
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
        runActiveScripts: async function() {
            await window.BMScriptManager.openDatabase();
            const scripts = await window.BMScriptManager.getScriptsFromDB();
            scripts.forEach(script => {
                const isMatch = script.match.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(window.location.href));
                if (isMatch) {
                    try {
                        eval(script.code);
                    } catch (e) {
                        console.error(`Fehler beim Ausführen von Skript '${script.name}':`, e);
                    }
                }
            });
        },
        createUIElement: function(scriptMeta, infoText, buttonState) {
            const scriptList = document.getElementById('script-list');
            const item = document.createElement('div');
            item.className = 'script-button ' + buttonState;

            const isExternal = scriptMeta.repoInfo.owner !== GITHUB_REPO_OWNER || scriptMeta.repoInfo.name !== GITHUB_REPO_NAME;
            let buttonContent = `<strong>${scriptMeta.name} <span class="version">v${scriptMeta.version}</span></strong>`;

            if (isExternal) {
                item.classList.add('external-script');
                buttonContent = `<span class="external-symbol">⚠️</span> ` + buttonContent;
            }
            
            if (buttonState === 'update') {
                buttonContent += ` <span class="update-symbol" title="Update verfügbar">🔄</span>`;
            }

            item.innerHTML = buttonContent;
            item.dataset.description = infoText;
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
            item.addEventListener('click', () => {
                const currentState = scriptStates[scriptMeta.name];
                if (['active', 'update'].includes(currentState)) scriptStates[scriptMeta.name] = 'deactivate';
                else if (currentState === 'deactivate') scriptStates[scriptMeta.name] = 'active';
                else if (currentState === 'install') scriptStates[scriptMeta.name] = 'activate';
                else if (currentState === 'activate') scriptStates[scriptMeta.name] = 'install';

                const isExt = item.classList.contains('external-script');
                item.className = 'script-button ' + scriptStates[scriptMeta.name] + (isExt ? ' external-script' : '');
            });
        },
        loadAndDisplayScripts: async function() {
            const scriptList = document.getElementById('script-list');
            const saveButton = document.getElementById('save-scripts-button');
            
            scriptList.innerHTML = `<div class="bm-loader-container"><div class="bm-loader"></div> Lade und synchronisiere Skripte...</div>`;
            saveButton.style.display = 'none';
            document.getElementById('bm-script-filter').style.display = 'none';
            scriptStates = {};
            scriptMetadataCache = {};

            try {
                const accessConfigString = localStorage.getItem('bm_access_cfg');
                const privateRepoPromises = [];
                if (accessConfigString) {
                    const repoConfigs = accessConfigString.split(';').filter(s => s.trim() !== '');
                    for (const config of repoConfigs) {
                        if (config.includes('@') && config.includes('/')) {
                            try {
                                const [token, repoPath] = config.split('@');
                                const [owner, name] = repoPath.split('/');
                                privateRepoPromises.push(window.BMScriptManager.fetchRepoContents('', { owner, name, token }));
                            } catch (e) { console.error(`[B&M Manager] Fehler beim Parsen: "${config}"`); }
                        }
                    }
                }
                
                const allResults = await Promise.all([window.BMScriptManager.fetchRepoContents(), ...privateRepoPromises]);
                const allDirectories = allResults.flat();
                let dbScripts = await window.BMScriptManager.getScriptsFromDB();

                const githubScriptNames = new Set(allDirectories.filter(dir => dir.type === 'dir').map(dir => dir.name));
                const scriptsToDelete = dbScripts.filter(localScript => !githubScriptNames.has(localScript.name));
                if (scriptsToDelete.length > 0) {
                    await Promise.all(scriptsToDelete.map(script => window.BMScriptManager.deleteScriptFromDB(script.name)));
                    dbScripts = await window.BMScriptManager.getScriptsFromDB();
                }

                allDirectories.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
                
                scriptList.innerHTML = '';
                
                for (const dir of allDirectories.filter(d => d.type === 'dir')) {
                    const filesInDir = await window.BMScriptManager.fetchRepoContents(dir.name, dir.repoInfo);
                    const userJsFile = filesInDir.find(f => f.name.endsWith('.user.js'));
                    if (!userJsFile) continue;
                    const scriptMeta = window.BMScriptManager.getScriptNameAndVersion(userJsFile.name);
                    if (!scriptMeta) continue;
                    
                    scriptMeta.repoInfo = dir.repoInfo;
                    scriptMetadataCache[scriptMeta.name] = scriptMeta;
                    
                    const isExternal = scriptMeta.repoInfo.owner !== GITHUB_REPO_OWNER || scriptMeta.repoInfo.name !== GITHUB_REPO_NAME;
                    let extraInfo = '';

                    if (isExternal) {
                        const repoPath = `${scriptMeta.repoInfo.owner}/${scriptMeta.repoInfo.name}`;
                        extraInfo = `<strong><span class="external-warning">! NICHT ZUR WEITERGABE BESTIMMT !</span></strong>\n`;
                        extraInfo += `<em>Quelle: ${repoPath}</em>\n<hr>\n`;
                    }

                    const [info, changelog] = await Promise.all([
                        window.BMScriptManager.fetchScriptInfo(dir.name, dir.repoInfo),
                        window.BMScriptManager.fetchChangelog(dir.name, dir.repoInfo)
                    ]);
                    
                    const fullDescription = extraInfo + info + changelog;
                    
                    const localScript = dbScripts.find(s => s.name === scriptMeta.name);
                    let buttonState = 'install';

                    if (localScript) {
                        if (localScript.version === scriptMeta.version) {
                            buttonState = 'active';
                        } else {
                            const onlineVersion = scriptMeta.version.split('.').map(Number);
                            const localVersion = localScript.version.split('.').map(Number);

                            const [onlineMajor, onlineMinor, onlinePatch] = onlineVersion;
                            const [localMajor, localMinor, localPatch] = localVersion;

                            if (onlineMajor > localMajor ||
                               (onlineMajor === localMajor && onlineMinor > localMinor) ||
                               (onlineMajor === localMajor && onlineMinor === localMinor && onlinePatch > localPatch))
                            {
                                buttonState = 'update';
                            } else {
                                buttonState = 'active';
                            }
                        }
                    }

                    window.BMScriptManager.createUIElement(scriptMeta, fullDescription, buttonState);
                    scriptStates[scriptMeta.name] = buttonState;
                }
                saveButton.style.display = 'block';
                document.getElementById('bm-script-filter').style.display = 'block';
            } catch (error) {
                console.error('B&M Manager: Kritischer Fehler:', error);
                scriptList.innerHTML = `<p style="color:red; text-align: center;">Fehler beim Laden der Skripte.<br>Bitte Konsole prüfen.</p>`;
            }
        },
        saveChangesAndReload: async function() {
            const saveButton = document.getElementById('save-scripts-button');
            saveButton.disabled = true;
            saveButton.innerHTML = 'Speichere...';

            console.log(`[B&M Manager] Starte Speichervorgang...`);

            for (const scriptName in scriptStates) {
                const state = scriptStates[scriptName];
                const scriptMeta = scriptMetadataCache[scriptName];
                if (!scriptMeta) continue;

                if (['activate', 'update'].includes(state)) {
                    const action = state === 'activate' ? 'Installiere' : 'Aktualisiere';
                    console.log(`[B&M Manager] 📥 ${action} Skript: '${scriptName}' (Version ${scriptMeta.version})`);
                    
                    const result = await window.BMScriptManager.fetchRawScript(scriptMeta.name, scriptMeta.fullName, scriptMeta.repoInfo);
                    
                    if (result.success) {
                       const script = { name: scriptMeta.name, version: scriptMeta.version, code: result.content, match: window.BMScriptManager.extractMatchFromCode(result.content) };
                       await window.BMScriptManager.saveScriptToDB(script);
                       console.log(`[B&M Manager] ✅ Skript '${scriptName}' erfolgreich in der Datenbank gespeichert.`);
                    } else {
                       console.error(`[B&M Manager] ❌ Fehler beim Herunterladen von Skript '${scriptName}'.`);
                    }

                } else if (state === 'deactivate') {
                    console.log(`[B&M Manager] 🗑️ Lösche Skript: '${scriptName}'`);
                    await window.BMScriptManager.deleteScriptFromDB(scriptName);
                    console.log(`[B&M Manager] ✅ Skript '${scriptName}' erfolgreich aus der Datenbank gelöscht.`);
                }
            }

            console.log(`[B&M Manager] Alle Änderungen verarbeitet. Lade die Seite neu.`);
            setTimeout(() => { location.reload(); }, 300);
        }
    };
    
    GM_addStyle(`
        #lss-script-manager-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background-color: #222; color: #eee; border: 1px solid #555; border-radius: 5px; padding: 20px; font-family: sans-serif; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: none; width: 80%; max-width: 900px; }
        #lss-script-manager-container.visible { display: block; }
        #lss-script-manager-container h3 { color: white; text-align: center; border-bottom: 2px solid #555; padding-bottom: 10px; margin: 0 0 15px 0; }
        
        #bm-script-filter { width: 100%; padding: 8px 10px; margin-bottom: 20px; background-color: #333; color: #eee; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; }
        #bm-script-filter:focus { outline: none; border-color: #007bff; }

        #script-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
        .script-button { padding: 8px; margin-bottom: 0; border-radius: 5px; cursor: pointer; transition: all 0.2s ease; position: relative; border: 2px solid transparent; text-align: center; font-size: 0.9em; min-height: 60px; display: flex; flex-direction: column; justify-content: center; }
        .script-button.hidden { display: none; }
        .script-button.install { background-color: #007bff; color: white; border-color: #007bff; }
        .script-button.update { background-color: #ffc107; color: #212529; border-color: #ffc107; }
        .script-button.active { background-color: #28a745; color: white; border-color: #28a745; }
        .script-button.activate { background-color: #ffc107; color: #212529; border-color: #ffc107; }
        .script-button.deactivate { background-color: #dc3545; color: white; border-color: #dc3545; }
        .script-button:hover { filter: brightness(1.15); transform: translateY(-2px); }
        .script-button strong { display: inline-block; vertical-align: middle; line-height: 1.2; }
        .script-button .version { font-size: 0.8em; opacity: 0.8; display: block; margin-top: 4px; }
        #bm-global-tooltip { display: none; position: fixed; background-color: #333; color: #eee; padding: 10px; border-radius: 5px; white-space: pre-wrap; z-index: 10001; width: 250px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); text-align: left; pointer-events: none; }
        #bm-global-tooltip hr { border: none; border-top: 1px solid #555; margin: 8px 0; }
        #save-scripts-button { display: none; width: 100%; padding: 10px; margin-top: 20px; font-weight: bold; color: white; background-color: #007bff; border: none; border-radius: 5px; cursor: pointer; }
        #save-scripts-button:disabled { background-color: #6c757d; cursor: not-allowed; }
        .script-button.external-script { border-color: #ff9800; box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
        .external-symbol { margin-right: 5px; font-size: 1.1em; vertical-align: middle; }
        .external-warning { color: #ff6b6b; }
        .update-symbol { display: inline-block; vertical-align: middle; animation: bm-spin 2s linear infinite; }
        .bm-close-btn { position: absolute; top: 10px; right: 15px; font-size: 28px; font-weight: bold; color: #aaa; cursor: pointer; line-height: 1; transition: color 0.2s ease; }
        .bm-close-btn:hover { color: #fff; }
        .bm-loader-container { display: flex; justify-content: center; align-items: center; padding: 40px; color: #aaa; font-size: 1.1em; }
        .bm-loader { display: inline-block; border: 4px solid #444; border-top: 4px solid #007bff; border-radius: 50%; width: 24px; height: 24px; animation: bm-spin 1s linear infinite; margin-right: 15px; }
        
        @keyframes bm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `);
    
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.createElement('div');
        container.id = 'lss-script-manager-container';
        container.innerHTML = `
            <span class="bm-close-btn" title="Schließen">&times;</span>
            <h3>B&M Scriptmanager</h3>
            <input type="text" id="bm-script-filter" placeholder="Filter nach Name oder Info..." style="display: none;">
            <div id="script-list"></div>
            <button id="save-scripts-button" style="display: none;">Speichern und Seite neu laden</button>`;
        document.body.appendChild(container);

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
        
        document.getElementById('save-scripts-button').addEventListener('click', window.BMScriptManager.saveChangesAndReload);
        
        container.querySelector('.bm-close-btn').addEventListener('click', () => {
            container.classList.remove('visible');
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
