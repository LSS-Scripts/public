/*--BMScriptConfig
[
  {
    "param": 1,
    "label": "Verbands-ID",
    "type": "number",
    "default": "24",
    "info": "Die eindeutige Verbands-ID"
  },
  {
    "param": 2,
    "label": "Verbands-Name",
    "type": "Text",
    "default": "FLORIAN HAMBURG",
    "info": "Der eindeutige Verbands-Name"
  }

]
--*/


// ==UserScript==
// @name         VA - Verbandsmitgliedschaft prüfen
// @namespace    http://tampermonkey.net/
// @version      0.9.6
// @description
// @author       Masklin
// @license      MIT
// @match        https://www.leitstellenspiel.de/alliance_threads/*
// @grant        GM_xmlhttpRequest
// @connect      leitstellenspiel.de
// ==/UserScript==

(async function() {
    'use strict';

    /**
     * Gibt ein Promise zurück, das erfüllt wird, sobald der BMScriptManager bereit ist.
     * @param {number} [timeout=10000] Die maximale Wartezeit in Millisekunden.
     * @returns {Promise<boolean>} Ein Promise, das bei Erfolg zu `true` auflöst.
     */
    function ensureBMScriptManager(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (window.BMScriptManager && typeof window.BMScriptManager.getSettings === 'function') {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error(`B&M Scriptmanager wurde nach ${timeout / 1000}s nicht gefunden.`));
                }
            }, 50);
        });
    }

    // =================================================================================
    // START der Hauptlogik: Fast das gesamte ursprüngliche Skript lebt jetzt hier drin.
    // =================================================================================
    function startScriptLogic(settings) {

        // Konfiguration - GANZ OBEN, WIE GEWÜNSCHT!
        const OK_ALLIANCE_ID = settings.param1 ?? '24';
        const OK_ALLIANCE_LINK_PART = `/alliances/${OK_ALLIANCE_ID}`;
        const OK_ALLIANCE_NAME = settings.param2 ?? 'FLORIAN HAMBURG';

        // Alle Konstanten und Variablen, die für das Skript benötigt werden
        const LS_KEY_PREFIX = 'lss_alliance_checker_profil_pruefung_fix_';
        const LS_KEY_FORUM_PARSING_ACTIVE = LS_KEY_PREFIX + 'forum_parsing_active';
        const LS_KEY_PROFILE_CHECKING_ACTIVE = LS_KEY_PREFIX + 'profile_checking_active';
        const LS_KEY_COLLECTED_FORUM_LINKS = LS_KEY_PREFIX + 'collected_forum_links';
        const LS_KEY_PROFILE_CHECK_RESULTS = LS_KEY_PREFIX + 'profile_check_results';
        const LS_KEY_PROFILE_CHECK_QUEUE = LS_KEY_PREFIX + 'profile_check_queue';
        const LS_KEY_CURRENT_FORUM_PAGE = LS_KEY_PREFIX + 'current_forum_page';
        const LS_KEY_CURRENT_PROFILE_INDEX = LS_KEY_PREFIX + 'current_profile_index';
        const LS_KEY_STOP_REQUESTED = LS_KEY_PREFIX + 'stop_requested';
        const LS_KEY_TOTAL_FORUM_PAGES = LS_KEY_PREFIX + 'total_forum_pages';
        const LS_KEY_IS_CURRENT_PAGE_ONLY_SCAN_TEMP = LS_KEY_PREFIX + 'is_current_page_only_temp'; // Temporärer Schlüssel für den aktuellen Scan

        const THREAD_ID_REGEX = /\/alliance_threads\/(\d+)/;
        const REQUEST_DELAY = 100; // 100 Millisekunden

        let currentThreadId = null;
        let estimatedTotalForumPages = 1;

        let processButton = null;
        let stopButton = null;
        let currentPageOnlyCheckbox = null;
        let statusDiv = null;
        let progressBar = null;

        let resultModal = null;
        let resultModalContent = null;
        let resultModalCloseButton = null;

        function getThreadIdFromUrl() {
            const match = window.location.pathname.match(THREAD_ID_REGEX);
            return match ? match[1] : null;
        }

        console.log('[LSS] Skriptstart: Aggressives Zurücksetzen relevanter localStorage-Flags.');
        localStorage.removeItem(LS_KEY_FORUM_PARSING_ACTIVE);
        localStorage.removeItem(LS_KEY_PROFILE_CHECKING_ACTIVE);
        localStorage.removeItem(LS_KEY_STOP_REQUESTED);
        localStorage.removeItem(LS_KEY_COLLECTED_FORUM_LINKS);
        localStorage.removeItem(LS_KEY_PROFILE_CHECK_QUEUE);
        localStorage.removeItem(LS_KEY_CURRENT_FORUM_PAGE);
        localStorage.removeItem(LS_KEY_CURRENT_PROFILE_INDEX);
        localStorage.removeItem(LS_KEY_TOTAL_FORUM_PAGES);
        localStorage.removeItem(LS_KEY_IS_CURRENT_PAGE_ONLY_SCAN_TEMP);

        currentThreadId = getThreadIdFromUrl();

        function initialCheckForPersistentResults() {
            const storedResults = localStorage.getItem(LS_KEY_PROFILE_CHECK_RESULTS);
            if (storedResults && Object.keys(JSON.parse(storedResults)).length > 0) {
                console.log('[LSS] initialCheckForPersistentResults: Vorherige Scan-Ergebnisse im localStorage gefunden.');
            }
        }

        function addUIElements() {
            const paginationUl = document.querySelector('ul.pagination.pagination');
            if (paginationUl) {
                const uiContainer = document.createElement('div');
                uiContainer.style.marginTop = '10px';
                uiContainer.style.marginBottom = '10px';
                uiContainer.style.display = 'flex';
                uiContainer.style.flexDirection = 'column';
                uiContainer.style.gap = '10px';
                const buttonGroup = document.createElement('div');
                buttonGroup.className = 'btn-group';
                buttonGroup.style.display = 'flex';
                buttonGroup.style.justifyContent = 'center';
                buttonGroup.style.gap = '5px';
                processButton = document.createElement('a');
                processButton.href = '#';
                processButton.id = 'lss-profile-parser-process-button';
                processButton.classList.add('btn', 'btn-info', 'btn-sm');
                processButton.style.minWidth = '250px';
                processButton.textContent = 'Mitgliedschaften Prüfen';
                processButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!processButton.disabled) {
                        startOverallProcess();
                    }
                });
                buttonGroup.appendChild(processButton);
                stopButton = document.createElement('a');
                stopButton.href = '#';
                stopButton.textContent = 'Stoppen';
                stopButton.id = 'lss-profile-parser-stop-button';
                stopButton.classList.add('btn', 'btn-danger', 'btn-sm');
                stopButton.style.minWidth = '100px';
                stopButton.style.display = 'none';
                stopButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    stopParsing();
                });
                buttonGroup.appendChild(stopButton);
                uiContainer.appendChild(buttonGroup);
                const checkboxDiv = document.createElement('div');
                checkboxDiv.style.textAlign = 'center';
                checkboxDiv.style.marginTop = '5px';
                currentPageOnlyCheckbox = document.createElement('input');
                currentPageOnlyCheckbox.type = 'checkbox';
                currentPageOnlyCheckbox.id = 'lss-check-current-page-only';
                currentPageOnlyCheckbox.style.marginRight = '5px';
                const checkboxLabel = document.createElement('label');
                checkboxLabel.htmlFor = 'lss-check-current-page-only';
                checkboxLabel.textContent = 'Nur aktuelle Seite prüfen';
                checkboxLabel.style.cursor = 'pointer';
                checkboxDiv.appendChild(currentPageOnlyCheckbox);
                checkboxDiv.appendChild(checkboxLabel);
                uiContainer.appendChild(checkboxDiv);
                statusDiv = document.createElement('div');
                statusDiv.id = 'lss-status-display';
                statusDiv.style.marginTop = '10px';
                statusDiv.style.padding = '8px';
                statusDiv.style.border = '1px solid #ddd';
                statusDiv.style.borderRadius = '4px';
                statusDiv.style.backgroundColor = '#f9f9f9';
                statusDiv.style.textAlign = 'center';
                statusDiv.textContent = 'Bereit für die Prüfung.';
                uiContainer.appendChild(statusDiv);
                progressBar = document.createElement('div');
                progressBar.id = 'lss-progress-bar';
                progressBar.style.cssText = `
                    width: 0%;
                    height: 20px;
                    background-color: #4CAF50;
                    text-align: center;
                    line-height: 20px;
                    color: white;
                    border-radius: 4px;
                    margin-top: 5px;
                    transition: width 0.5s ease-in-out;
                    opacity: 0;
                `;
                statusDiv.appendChild(progressBar);
                paginationUl.parentNode.insertBefore(uiContainer, paginationUl.nextSibling);
                resultModal = document.createElement('div');
                resultModal.id = 'lss-result-modal';
                resultModal.style.cssText = `
                    display: none;
                    position: fixed;
                    z-index: 1000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    background-color: rgba(0,0,0,0.4);
                    padding-top: 60px;
                `;
                resultModalContent = document.createElement('div');
                resultModalContent.style.cssText = `
                    background-color: #fefefe;
                    margin: 5% auto;
                    padding: 20px;
                    border: 1px solid #888;
                    width: 90%;
                    max-width: 600px;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2), 0 6px 20px 0 rgba(0,0,0,0.19);
                    position: relative;
                `;
                resultModalCloseButton = document.createElement('span');
                resultModalCloseButton.innerHTML = '&times;';
                resultModalCloseButton.style.cssText = `
                    color: #aaa;
                    float: right;
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                `;
                resultModalCloseButton.addEventListener('click', () => { resultModal.style.display = 'none'; });
                resultModal.addEventListener('click', (event) => {
                    if (event.target === resultModal) {
                        resultModal.style.display = 'none';
                    }
                });
                const modalTitle = document.createElement('h3');
                modalTitle.textContent = 'Ergebnisse der Verbandsprüfung';
                modalTitle.style.marginBottom = '15px';
                modalTitle.style.borderBottom = '1px solid #eee';
                modalTitle.style.paddingBottom = '10px';
                const modalBody = document.createElement('div');
                modalBody.id = 'lss-modal-body';
                modalBody.style.maxHeight = '400px';
                modalBody.style.overflowY = 'auto';
                resultModalContent.appendChild(resultModalCloseButton);
                resultModalContent.appendChild(modalTitle);
                modalBody.innerHTML = '<p>Lade Ergebnisse...</p>';
                resultModalContent.appendChild(modalBody);
                resultModal.appendChild(resultModalContent);
                document.body.appendChild(resultModal);
                console.log('[LSS] addUIElements: UI-Elemente erfolgreich dem DOM hinzugefügt.');
                setTimeout(updateButtonStates, 50);
            } else {
                console.warn('[LSS] addUIElements: Das Paginierungs-UL-Element wurde nicht gefunden. UI-Elemente können nicht platziert werden.');
            }
        }

        function updateButtonStates() {
            const isForumParsingActive = localStorage.getItem(LS_KEY_FORUM_PARSING_ACTIVE) === 'true';
            const isProfileCheckingActive = localStorage.getItem(LS_KEY_PROFILE_CHECKING_ACTIVE) === 'true';
            const isStopRequested = localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true';
            if (!processButton || !statusDiv || !progressBar || !stopButton || !currentPageOnlyCheckbox) {
                console.warn("updateButtonStates: UI-Elemente noch nicht vollständig verfügbar. Erneuter Versuch in 100ms.");
                setTimeout(updateButtonStates, 100);
                return;
            }
            if (isForumParsingActive || isProfileCheckingActive) {
                processButton.disabled = true;
                stopButton.style.display = 'inline-block';
                currentPageOnlyCheckbox.disabled = true;
                progressBar.style.opacity = '1';
            } else {
                if (isStopRequested) {
                    statusDiv.textContent = 'Vorgang gestoppt.';
                    localStorage.removeItem(LS_KEY_STOP_REQUESTED);
                } else {
                    statusDiv.textContent = 'Bereit für die Prüfung.';
                }
                processButton.disabled = false;
                stopButton.style.display = 'none';
                progressBar.style.width = '0%';
                progressBar.style.opacity = '0';
                currentPageOnlyCheckbox.disabled = false;
                const storedResults = localStorage.getItem(LS_KEY_PROFILE_CHECK_RESULTS);
                if (storedResults && Object.keys(JSON.parse(storedResults)).length > 0 && resultModal.style.display === 'none') {
                    console.log('[LSS] updateButtonStates: Lade und zeige persistente Ergebnisse an.');
                    displayFinalResultsAndCleanUp(false, true);
                }
            }
        }

        function updateProgressBar(current, total, phaseName) {
            if (progressBar && statusDiv) {
                let percentage = 0;
                if (total > 0) {
                    percentage = Math.round((current / total) * 100);
                }
                statusDiv.textContent = `${phaseName}: ${percentage}%`;
                progressBar.style.width = `${percentage}%`;
                progressBar.textContent = `${percentage}%`;
                if (progressBar.style.opacity !== '1') {
                    progressBar.style.opacity = '1';
                }
            }
        }

        function getCurrentPageNumberFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const page = urlParams.get('page');
            const pageNum = parseInt(page, 10);
            return isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
        }

        function startOverallProcess() {
            console.log('[LSS] Neuer Scan gestartet. Bereinige alte Ergebnisse aus localStorage.');
            localStorage.removeItem(LS_KEY_COLLECTED_FORUM_LINKS);
            localStorage.removeItem(LS_KEY_PROFILE_CHECK_RESULTS);
            localStorage.removeItem(LS_KEY_PROFILE_CHECK_QUEUE);
            localStorage.removeItem(LS_KEY_CURRENT_FORUM_PAGE);
            localStorage.removeItem(LS_KEY_CURRENT_PROFILE_INDEX);
            localStorage.removeItem(LS_KEY_TOTAL_FORUM_PAGES);
            localStorage.setItem(LS_KEY_STOP_REQUESTED, 'false');
            const isCurrentPageOnlyScanForThisRun = currentPageOnlyCheckbox.checked;
            localStorage.setItem(LS_KEY_IS_CURRENT_PAGE_ONLY_SCAN_TEMP, isCurrentPageOnlyScanForThisRun.toString());
            console.log(`[LSS] Scan-Typ: 'Nur aktuelle Seite prüfen' ist ${isCurrentPageOnlyScanForThisRun ? 'aktiviert' : 'deaktiviert'}.`);
            if (!currentThreadId) {
                currentThreadId = getThreadIdFromUrl();
                if (!currentThreadId) {
                    console.error('[LSS] Prüfe auf Verbandsmitgliedschaft: Thread ID konnte nicht aus der URL ermittelt werden. Prozess abgebrochen.');
                    statusDiv.textContent = 'Fehler: Thread ID nicht gefunden.';
                    return;
                }
            }
            console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Starte gesamten Prozess...');
            localStorage.setItem(LS_KEY_FORUM_PARSING_ACTIVE, 'true');
            updateButtonStates();
            let startPageNum = 1;
            let phase1Text = 'Forum-Seiten erfassen';
            if (isCurrentPageOnlyScanForThisRun) {
                startPageNum = getCurrentPageNumberFromUrl();
                phase1Text = 'Aktuelle Seite erfassen';
                estimatedTotalForumPages = 1;
                localStorage.setItem(LS_KEY_TOTAL_FORUM_PAGES, estimatedTotalForumPages.toString());
            } else {
                const paginationUl = document.querySelector('ul.pagination.pagination');
                if (paginationUl) {
                    const firstPageDoc = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');
                    estimatedTotalForumPages = extractTotalForumPages(firstPageDoc);
                    console.log(`[LSS] Gesamtanzahl der Forenseiten aus DOM: ${estimatedTotalForumPages}`);
                    localStorage.setItem(LS_KEY_TOTAL_FORUM_PAGES, estimatedTotalForumPages.toString());
                } else {
                    console.warn('[LSS] Paginierungs-UL nicht gefunden. Schätze Gesamtseiten auf 1.');
                    estimatedTotalForumPages = 1;
                    localStorage.setItem(LS_KEY_TOTAL_FORUM_PAGES, '1');
                }
            }
            updateProgressBar(0, 1, phase1Text);
            requestForumPage(currentThreadId, startPageNum, isCurrentPageOnlyScanForThisRun);
        }

        function stopParsing() {
            console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Stop-Anfrage empfangen. Beende bald...');
            localStorage.setItem(LS_KEY_STOP_REQUESTED, 'true');
            updateButtonStates();
        }

        function extractTotalForumPages(doc) {
            let maxPage = 1;
            const pageLinks = doc.querySelectorAll('ul.pagination.pagination li a');
            pageLinks.forEach(link => {
                const pageText = link.textContent.trim();
                const pageNum = parseInt(pageText, 10);
                if (!isNaN(pageNum)) {
                    maxPage = Math.max(maxPage, pageNum);
                }
            });
            const lastPageLink = doc.querySelector('li.last a');
            if (lastPageLink) {
                const href = lastPageLink.href;
                const match = href.match(/page=(\d+)/);
                if (match && !isNaN(parseInt(match[1], 10))) {
                    maxPage = Math.max(maxPage, parseInt(match[1], 10));
                }
            }
            return maxPage;
        }

        function requestForumPage(threadId, pageNum, isCurrentPageOnly) {
            if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Forum-Parsing gestoppt (Anfrage abgebrochen).');
                finishForumParsing(isCurrentPageOnly);
                return;
            }
            const url = `https://www.leitstellenspiel.de/alliance_threads/${threadId}?page=${pageNum}`;
            localStorage.setItem(LS_KEY_CURRENT_FORUM_PAGE, pageNum.toString());
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                        console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Forum-Parsing gestoppt (nach Antwort).');
                        finishForumParsing(isCurrentPageOnly);
                        return;
                    }
                    if (response.status === 200) {
                        processFetchedForumPage(response.responseText, threadId, pageNum, isCurrentPageOnly);
                    } else {
                        console.error(`[LSS] Prüfe auf Verbandsmitgliedschaft: Fehler beim Abrufen von Forenseite ${pageNum}. Status: ${response.status}`);
                        finishForumParsing(isCurrentPageOnly);
                    }
                },
                onerror: function(error) {
                    if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                        console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Forum-Parsing gestoppt (nach Fehler).');
                        finishForumParsing(isCurrentPageOnly);
                        return;
                    }
                    console.error(`[LSS] Prüfe auf Verbandsmitgliedschaft: Netzwerkfehler beim Abrufen von Forenseite ${pageNum}.`, error);
                    finishForumParsing(isCurrentPageOnly);
                }
            });
        }

        function processFetchedForumPage(htmlContent, threadId, pageNum, isCurrentPageOnly) {
            if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Forum-Parsing gestoppt (während Verarbeitung).');
                finishForumParsing(isCurrentPageOnly);
                return;
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const phase1Text = isCurrentPageOnly ? 'Aktuelle Seite erfassen' : 'Forum-Seiten erfassen';
            let currentTotalPages = parseInt(localStorage.getItem(LS_KEY_TOTAL_FORUM_PAGES) || '1', 10);
            updateProgressBar(pageNum, currentTotalPages, phase1Text);
            let collectedLinksMap = JSON.parse(localStorage.getItem(LS_KEY_COLLECTED_FORUM_LINKS)) || {};
            const profileLinks = doc.querySelectorAll('a[href^="/profile/"]');
            if (profileLinks.length > 0) {
                profileLinks.forEach(link => {
                    const profileUrl = link.href;
                    const userName = link.textContent.trim();
                    let postId = 'N/A';
                    let parentPost = link.closest('[id^="post-on-page-"]');
                    if (parentPost) {
                        postId = parentPost.id;
                    }
                    if (!collectedLinksMap[profileUrl]) {
                        collectedLinksMap[profileUrl] = {
                            userName: userName,
                            foundLocations: []
                        };
                    }
                    const isLocationDuplicate = collectedLinksMap[profileUrl].foundLocations.some(
                        loc => loc.page === pageNum && loc.postId === postId
                    );
                    if (!isLocationDuplicate) {
                        collectedLinksMap[profileUrl].foundLocations.push({
                            page: pageNum,
                            postId: postId
                        });
                    }
                });
                localStorage.setItem(LS_KEY_COLLECTED_FORUM_LINKS, JSON.stringify(collectedLinksMap));
            }
            if (isCurrentPageOnly) {
                console.log('[LSS] "Nur aktuelle Seite prüfen" ist aktiviert. Beende Forum-Parsing nach aktueller Seite.');
                finishForumParsing(isCurrentPageOnly);
            } else {
                const nextButtonDisabled = doc.querySelector('li.next.disabled > span');
                const nextButtonAnchor = doc.querySelector('li.next:not(.disabled) > a[rel="next"]');
                if (nextButtonAnchor && !nextButtonDisabled) {
                    setTimeout(() => requestForumPage(threadId, pageNum + 1, isCurrentPageOnly), REQUEST_DELAY);
                } else {
                    console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Ende der Forenseiten erreicht (oder keine weiteren Seiten).');
                    finishForumParsing(isCurrentPageOnly);
                }
            }
        }

        function finishForumParsing(isCurrentPageOnly) {
            localStorage.setItem(LS_KEY_FORUM_PARSING_ACTIVE, 'false');
            let currentTotalPages = parseInt(localStorage.getItem(LS_KEY_TOTAL_FORUM_PAGES) || '1', 10);
            const phase1Text = isCurrentPageOnly ? 'Aktuelle Seite erfasst' : 'Forum-Seiten erfasst';
            updateProgressBar(currentTotalPages, currentTotalPages, phase1Text);
            if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                displayFinalResultsAndCleanUp(true);
                return;
            }
            const collectedForumLinksMap = JSON.parse(localStorage.getItem(LS_KEY_COLLECTED_FORUM_LINKS)) || {};
            const profileUrls = Object.keys(collectedForumLinksMap);
            if (profileUrls.length === 0) {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Keine Profil-Links im Forum gefunden. Beende den gesamten Prozess.');
                displayFinalResultsAndCleanUp();
                return;
            }
            localStorage.setItem(LS_KEY_PROFILE_CHECK_QUEUE, JSON.stringify(profileUrls));
            localStorage.setItem(LS_KEY_CURRENT_PROFILE_INDEX, '0');
            localStorage.setItem(LS_KEY_PROFILE_CHECKING_ACTIVE, 'true');
            localStorage.setItem(LS_KEY_PROFILE_CHECK_RESULTS, JSON.stringify({}));
            updateButtonStates();
            updateProgressBar(0, profileUrls.length, 'Profile prüfen');
            console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Starte Profilprüfung für alle gesammelten Profile...');
            checkNextProfileInQueue();
        }

        function checkNextProfileInQueue() {
            if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Profilprüfung gestoppt (Warteschlange abgebrochen).');
                displayFinalResultsAndCleanUp(true);
                return;
            }
            const queue = JSON.parse(localStorage.getItem(LS_KEY_PROFILE_CHECK_QUEUE));
            let currentIndex = parseInt(localStorage.getItem(LS_KEY_CURRENT_PROFILE_INDEX), 10);
            updateProgressBar(currentIndex, queue.length, 'Profile prüfen');
            if (queue && currentIndex < queue.length) {
                const profileUrl = queue[currentIndex];
                requestProfilePage(profileUrl, currentIndex);
            } else {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Alle Profile geprüft.');
                displayFinalResultsAndCleanUp();
            }
        }

        function requestProfilePage(profileUrl, index) {
            if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Profilprüfung gestoppt (Anfrage abgebrochen).');
                displayFinalResultsAndCleanUp(true);
                return;
            }
            GM_xmlhttpRequest({
                method: "GET",
                url: profileUrl,
                onload: function(response) {
                    if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                        console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Profilprüfung gestoppt (nach Antwort).');
                        displayFinalResultsAndCleanUp(true);
                        return;
                    }
                    if (response.status === 200) {
                        processFetchedProfilePage(profileUrl, response.responseText, index);
                    } else {
                        console.error(`[Phase 2] Fehler beim Abrufen der Profilseite ${profileUrl}. Status: ${response.status}`);
                        saveProfileCheckResult(profileUrl, 'ERROR', null);
                        let nextIndex = index + 1;
                        localStorage.setItem(LS_KEY_CURRENT_PROFILE_INDEX, nextIndex.toString());
                        setTimeout(() => checkNextProfileInQueue(), REQUEST_DELAY);
                    }
                },
                onerror: function(error) {
                    if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                        console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Profilprüfung gestoppt (nach Fehler).');
                        displayFinalResultsAndCleanUp(true);
                        return;
                    }
                    console.error(`[LSS] Prüfe auf Verbandsmitgliedschaft: Netzwerkfehler beim Abrufen von Profilseite.`, error);
                    saveProfileCheckResult(profileUrl, 'ERROR', null);
                    let nextIndex = index + 1;
                    localStorage.setItem(LS_KEY_CURRENT_PROFILE_INDEX, nextIndex.toString());
                    setTimeout(() => checkNextProfileInQueue(), REQUEST_DELAY);
                }
            });
        }

        function processFetchedProfilePage(profileUrl, htmlContent, index) {
            if (localStorage.getItem(LS_KEY_STOP_REQUESTED) === 'true') {
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Profilprüfung gestoppt (während Verarbeitung).');
                displayFinalResultsAndCleanUp(true);
                return;
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const allAllianceLinks = doc.querySelectorAll('a[href^="/alliances/"]');
            let isOkAllianceFound = false;
            let foundAnyOtherAlliance = false;
            let actualAllianceName = null;
            if (allAllianceLinks.length > 0) {
                for (const link of allAllianceLinks) {
                    const href = link.getAttribute('href');
                    const name = link.textContent.trim();
                    if (href === OK_ALLIANCE_LINK_PART) {
                        isOkAllianceFound = true;
                        actualAllianceName = name;
                        break;
                    } else {
                        foundAnyOtherAlliance = true;
                        actualAllianceName = name;
                    }
                }
            }
            let status = 'UNKNOWN_STATE';
            if (isOkAllianceFound) {
                status = 'OK_FOUND';
            } else if (foundAnyOtherAlliance) {
                status = 'ATTENTION_REQUIRED_OTHER_ALLIANCE';
            } else {
                status = 'ATTENTION_REQUIRED_NONE_FOUND';
            }
            saveProfileCheckResult(profileUrl, status, actualAllianceName);
            let nextIndex = index + 1;
            localStorage.setItem(LS_KEY_CURRENT_PROFILE_INDEX, nextIndex.toString());
            setTimeout(() => checkNextProfileInQueue(), REQUEST_DELAY);
        }

        function saveProfileCheckResult(profileUrl, status, actualAllianceName) {
            let results = JSON.parse(localStorage.getItem(LS_KEY_PROFILE_CHECK_RESULTS)) || {};
            const forumInfo = JSON.parse(localStorage.getItem(LS_KEY_COLLECTED_FORUM_LINKS)) || {};
            const currentForumInfo = forumInfo[profileUrl];
            results[profileUrl] = {
                userName: currentForumInfo ? currentForumInfo.userName : 'Unbekannt',
                foundInForum: currentForumInfo ? currentForumInfo.foundLocations : [],
                checkStatus: status,
                actualAllianceName: actualAllianceName || 'N/A'
            };
            localStorage.setItem(LS_KEY_PROFILE_CHECK_RESULTS, JSON.stringify(results));
        }

        function displayFinalResultsAndCleanUp(wasStopped = false, isPersistentDisplay = false) {
            console.log('\n--- [LSS] Prüfe auf Verbandsmitgliedschaft: ENDERGEBNISSE ---');
            const profileCheckResults = JSON.parse(localStorage.getItem(LS_KEY_PROFILE_CHECK_RESULTS)) || {};
            const collectedForumLinksMap = JSON.parse(localStorage.getItem(LS_KEY_COLLECTED_FORUM_LINKS)) || {};
            const uniqueProfilesCount = Object.keys(collectedForumLinksMap).length;
            const checkedProfilesCount = Object.keys(profileCheckResults).length;
            if (wasStopped) {
                console.warn(`Vorgang wurde vom Benutzer GESTOPPT! (${checkedProfilesCount} von ${uniqueProfilesCount} Profilen geprüft)`);
                if (statusDiv) statusDiv.textContent = `Vorgang gestoppt! ${checkedProfilesCount} von ${uniqueProfilesCount} Profilen geprüft.`;
            } else if (isPersistentDisplay) {
                console.log(`[LSS] Zeige persistente Ergebnisse an. (Geprüfte Profile: ${checkedProfilesCount})`);
                if (statusDiv) statusDiv.textContent = `Letzte Prüfung abgeschlossen. ${checkedProfilesCount} Profile geprüft.`;
            } else {
                console.log(`\nGesammelte einzigartige Profile aus dem Forum: ${uniqueProfilesCount}`);
                console.log(`Geprüfte Profile: ${checkedProfilesCount}`);
                if (statusDiv) statusDiv.textContent = `Prüfung abgeschlossen! ${checkedProfilesCount} Profile geprüft.`;
            }
            console.log('\n--- Details der Profilprüfungen ---');
            let counts = {
                okFound: 0,
                attentionRequiredOtherAlliance: 0,
                attentionRequiredNoneFound: 0,
                error: 0
            };
            const modalBodyElement = document.getElementById('lss-modal-body');
            let ul = null;
            if (modalBodyElement) {
                modalBodyElement.innerHTML = '';
                ul = document.createElement('ul');
                ul.style.listStyle = 'none';
                ul.style.padding = '0';
                if (wasStopped) {
                    const statusMessage = document.createElement('p');
                    statusMessage.innerHTML = `Vorgang **gestoppt** nach Prüfung von ${checkedProfilesCount} von ${uniqueProfilesCount} Profilen.`;
                    statusMessage.style.fontWeight = 'bold';
                    statusMessage.style.color = '#FFA500';
                    modalBodyElement.appendChild(statusMessage);
                }
            }
            for (const profileUrl in profileCheckResults) {
                const result = profileCheckResults[profileUrl];
                const userName = result.userName;
                const foundLocations = result.foundInForum;
                let li = null;
                if (modalBodyElement) {
                    li = document.createElement('li');
                    li.style.marginBottom = '10px';
                    li.style.padding = '8px';
                    li.style.border = '1px solid #eee';
                    li.style.borderRadius = '5px';
                }
                switch (result.checkStatus) {
                    case 'OK_FOUND':
                        counts.okFound++;
                        break;
                    case 'ATTENTION_REQUIRED_OTHER_ALLIANCE':
                        counts.attentionRequiredOtherAlliance++;
                        if (li && ul) {
                            li.style.backgroundColor = '#fff0f0';
                            li.innerHTML = `<strong>🚨 AUFFÄLLIG:</strong> ${userName} (<a href="${profileUrl}" target="_blank">${profileUrl}</a>)<br>Zugehörig zu Verband: "${result.actualAllianceName}" (NICHT "${OK_ALLIANCE_NAME}").<br>Fundstelle(n): `;
                            foundLocations.forEach((loc, i) => {
                                const forumLink = document.createElement('a');
                                if (currentThreadId) {
                                    forumLink.href = `/alliance_threads/${currentThreadId}?page=${loc.page}#${loc.postId}`;
                                } else {
                                    forumLink.href = '#';
                                    console.warn("currentThreadId ist null, genauer Forum-Link konnte nicht erstellt werden.");
                                }
                                forumLink.target = '_blank';
                                forumLink.textContent = `Seite ${loc.page}, Post ${loc.postId}`;
                                li.appendChild(forumLink);
                                if (i < foundLocations.length - 1) li.append('; ');
                            });
                            ul.appendChild(li);
                        }
                        break;
                    case 'ATTENTION_REQUIRED_NONE_FOUND':
                        counts.attentionRequiredNoneFound++;
                        if (li && ul) {
                            li.style.backgroundColor = '#fff0f0';
                            li.innerHTML = `<strong>🚨 AUFFÄLLIG:</strong> ${userName} (<a href="${profileUrl}" target="_blank">${profileUrl}</a>)<br>Keinerlei Verband auf Profilseite gefunden.<br>Fundstelle(n): `;
                            foundLocations.forEach((loc, i) => {
                                const forumLink = document.createElement('a');
                                if (currentThreadId) {
                                    forumLink.href = `/alliance_threads/${currentThreadId}?page=${loc.page}#${loc.postId}`;
                                } else {
                                    forumLink.href = '#';
                                    console.warn("currentThreadId ist null, genauer Forum-Link konnte nicht erstellt werden.");
                                }
                                forumLink.target = '_blank';
                                forumLink.textContent = `Seite ${loc.page}, Post ${loc.postId}`;
                                li.appendChild(forumLink);
                                if (i < foundLocations.length - 1) li.append('; ');
                            });
                            ul.appendChild(li);
                        }
                        break;
                    case 'ERROR':
                        counts.error++;
                        if (li && ul) {
                            li.style.backgroundColor = '#fff0f0';
                            li.innerHTML = `<strong>❗ FEHLER:</strong> ${userName} (<a href="${profileUrl}" target="_blank">${profileUrl}</a>)<br>Fehler beim Abrufen/Parsen des Profils.<br>Fundstelle(n): `;
                            foundLocations.forEach((loc, i) => {
                                const forumLink = document.createElement('a');
                                if (currentThreadId) {
                                    forumLink.href = `/alliance_threads/${currentThreadId}?page=${loc.page}#${loc.postId}`;
                                } else {
                                    forumLink.href = '#';
                                    console.warn("currentThreadId ist null, genauer Forum-Link konnte nicht erstellt werden.");
                                }
                                forumLink.target = '_blank';
                                forumLink.textContent = `Seite ${loc.page}, Post ${loc.postId}`;
                                li.appendChild(forumLink);
                                if (i < foundLocations.length - 1) li.append('; ');
                            });
                            ul.appendChild(li);
                        }
                        break;
                    default:
                        console.warn(`[LSS] Unbekannter Status für Profil ${profileUrl}: ${result.checkStatus}`);
                }
            }
            if (modalBodyElement && ul) {
                if (ul.children.length > 0) {
                    modalBodyElement.appendChild(ul);
                } else {
                    const noResults = document.createElement('p');
                    noResults.textContent = 'Es wurden keine auffälligen Profile gefunden.';
                    noResults.style.color = '#555';
                    modalBodyElement.appendChild(noResults);
                }
                if (!isPersistentDisplay && resultModal.style.display === 'none') {
                    resultModal.style.display = 'block';
                }
            }
            console.log('\n--- Zusammenfassung der Ergebnisse ---');
            console.log(`Profile, die zu "${OK_ALLIANCE_NAME}" (${OK_ALLIANCE_ID}) gehören (nicht auffällig markiert): ${counts.okFound}`);
            console.log(`🚨 Profile mit ANDEREM Verband (als "${OK_ALLIANCE_NAME}"): ${counts.attentionRequiredOtherAlliance}`);
            console.log(`🚨 Profile OHNE Verband: ${counts.attentionRequiredNoneFound}`);
            console.log(`❗ Profile mit Prüf-Fehler: ${counts.error}`);
            console.log('----------------------------------------------------');
            if (!isPersistentDisplay) {
                localStorage.removeItem(LS_KEY_FORUM_PARSING_ACTIVE);
                localStorage.removeItem(LS_KEY_PROFILE_CHECKING_ACTIVE);
                localStorage.removeItem(LS_KEY_STOP_REQUESTED);
                localStorage.removeItem(LS_KEY_IS_CURRENT_PAGE_ONLY_SCAN_TEMP);
                console.log('[LSS] Prüfe auf Verbandsmitgliedschaft: Vorgang abgeschlossen. Ergebnisse bleiben gespeichert.');
            }
            if (!isPersistentDisplay) {
                updateButtonStates();
            }
        }

        // Der ursprüngliche Startpunkt wird zum Ende unserer Hauptfunktion:
        initialCheckForPersistentResults();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addUIElements);
        } else {
            addUIElements();
        }
    }
    // =================================================================================
    // ENDE der Hauptlogik
    // =================================================================================


    // =================================================================================
    // START des Skript-Startpunkts: Warten, Einstellungen holen, Hauptfunktion starten.
    // =================================================================================
    try {
        await ensureBMScriptManager();

        const skriptName = 'VA - Verbandsmitgliedschaft prüfen';
        const settings = window.BMScriptManager.getSettings(skriptName);

        startScriptLogic(settings); // Die gesamte, jetzt gekapselte Logik starten

    } catch (error) {
        console.error(`[VA - Verbandsmitgliedschaft prüfen] konnte nicht gestartet werden:`, error);
        alert(`Das Skript "VA - Verbandsmitgliedschaft prüfen" konnte nicht gestartet werden, da der B&M ScriptManager nicht gefunden wurde.`);
    }

})();
