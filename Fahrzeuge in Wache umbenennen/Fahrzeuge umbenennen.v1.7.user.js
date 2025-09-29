// ==UserScript==
// @name         Fahrzeuge in Wache umbenennen
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Benennt Fahrzeuge auf der Wachenseite modern und einfach um.
// @author       B&M
// @match        https://www.leitstellenspiel.de/buildings/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        .rename-preview.fade-out {
            opacity: 0;
            transition: opacity 0.5s ease-out;
        }
        .placeholder-pill {
            display: inline-block;
            padding: 4px 8px;
            margin: 2px;
            background-color: #e9ecef;
            border: 1px solid #ced4da;
            border-radius: 12px;
            font-size: 12px;
            color: #212529;
            cursor: pointer;
            transition: background-color 0.2s, color 0.2s;
        }
        .placeholder-pill:hover {
            background-color: #007bff;
            color: white;
            border-color: #007bff;
        }
        .dark .placeholder-pill {
            background-color: #343a40;
            color: #f8f9fa;
            border-color: #495057;
        }
        .dark .placeholder-pill:hover {
            background-color: #007bff;
            color: #ffffff;
            border-color: #007bff;
        }
        .switch-label {
            display: flex;
            align-items: center;
            cursor: pointer;
            margin-bottom: 8px;
        }
        .switch-text {
            margin-left: 8px;
            font-weight: normal;
        }
        .switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 22px;
            flex-shrink: 0;
        }
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 22px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #28a745;
        }
        input:checked + .slider:before {
            transform: translateX(18px);
        }
        .dark .slider {
            background-color: #555;
        }
        /* Stellt sicher, dass die Summary-Leiste den ganzen Platz einnimmt und zentriert ist */
summary {
    display: flex;
    justify-content: space-between; /* Drückt den Titel nach links und das Icon nach rechts */
    align-items: center;
    outline: none; /* Entfernt den Fokus-Rahmen beim Anklicken */
}

/* Versteckt den Standard-Pfeil des Browsers */
summary::-webkit-details-marker {
    display: none;
}
summary {
    list-style: none; /* Fallback für andere Browser */
}

/* Unser neues Icon auf der rechten Seite (ersetzt ::before) */
summary::after {
    /* SVG-Icon für "Pfeil nach unten" */
    content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23007bff' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E");
    width: 16px;
    height: 16px;
    transition: transform 0.2s; /* Sorgt für eine sanfte Animation */
}

/* Dreht den Pfeil, wenn das Menü geöffnet ist */
details[open] > summary::after {
    transform: rotate(180deg);
}

/* Anpassung für den Dark-Mode, falls der Pfeil sonst nicht gut sichtbar ist */
.dark summary::after {
    content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23FFF' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E");
}
    `;
    document.head.appendChild(style);

    async function main() {
        const vehicleTable = document.getElementById('vehicle_table');
        if (!vehicleTable) return;

        let vehicleApiData = {};
        try {
            vehicleApiData = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: "https://api.lss-manager.de/de_DE/vehicles",
                    onload: (response) => resolve(JSON.parse(response.responseText)),
                    onerror: (error) => reject(error),
                });
            });
        } catch (error) {
            console.error("Fehler beim Laden der API-Daten:", error);
            return;
        }

        const stationName = document.querySelector('h1').textContent.trim();
        let allVehicles = [];

        const readVehicleData = () => {
            const vehicles = [];
            const rows = vehicleTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const nameCell = row.querySelector('td[sortvalue]');
                const imageCell = row.querySelector('td img[vehicle_type_id]');
                if (!nameCell || !imageCell) return;
                const link = nameCell.querySelector('a');
                if (link) {
                    const vehicleId = link.getAttribute('href').match(/\d+/)[0];
                    const vehicleName = link.textContent.trim();
                    const vehicleTypeId = imageCell.getAttribute('vehicle_type_id');
                    const vehicleType = vehicleApiData[vehicleTypeId]?.caption || 'N/A';
                    vehicles.push({ id: vehicleId, oldName: vehicleName, type: vehicleType, rowElement: row });
                }
            });
            return vehicles;
        };

        const generatePreview = () => {
            const pattern = document.getElementById('rename-pattern-input').value;
            document.querySelectorAll('.rename-preview').forEach(el => el.remove());

            const countPerType = document.getElementById('count-per-type-toggle').checked;
            const omitSingle = document.getElementById('omit-single-toggle').checked;

            const vehicleTypeCounts = {};
            if (omitSingle) {
                allVehicles.forEach(vehicle => {
                    vehicleTypeCounts[vehicle.type] = (vehicleTypeCounts[vehicle.type] || 0) + 1;
                });
            }

            const typeCounters = {};
            allVehicles.forEach((vehicle, index) => {
                let currentNumber;

                if (countPerType) {
                    typeCounters[vehicle.type] = (typeCounters[vehicle.type] || 0) + 1;
                    currentNumber = typeCounters[vehicle.type];
                } else {
                    currentNumber = index + 1;
                }

                let numberStr = `${currentNumber}`;
                let romanStr = toRoman(currentNumber);

                if (omitSingle && vehicleTypeCounts[vehicle.type] === 1) {
                    numberStr = '';
                    romanStr = '';
                }

                let newName = pattern
                    .replace(/{id}/g, vehicle.id)
                    .replace(/{old}/g, vehicle.oldName)
                    .replace(/{vehicleType}/g, vehicle.type)
                    .replace(/{number}/g, numberStr)
                    .replace(/{numberRoman}/g, romanStr)
                    .replace(/{stationName}/g, stationName)
                    .trim()
                    .replace(/ +/g, ' ');

                const previewElement = document.createElement('div');
                previewElement.className = 'rename-preview';
                previewElement.style.marginTop = '5px';
                previewElement.innerHTML = `
                    ➡️ <input type="text" value="${newName}" style="width: 60%; background-color: #d1ecf1; border: 1px solid #bee5eb;" readonly />
                    <button class="btn btn-success btn-xs save-single-vehicle" data-vehicle-id="${vehicle.id}">Speichern</button>
                `;
                vehicle.rowElement.querySelector('td[sortvalue]').appendChild(previewElement);
            });
            document.getElementById('save-all-button').style.display = 'inline-block';
        };

        const saveVehicleName = async (vehicleId, newName) => {
             try {
                const response = await fetch(`/vehicles/${vehicleId}/editName`);
                const formHtml = await response.text();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = formHtml;
                const authToken = tempDiv.querySelector('input[name="authenticity_token"]').value;
                const formData = new FormData();
                formData.append('authenticity_token', authToken);
                formData.append('vehicle[caption]', newName);
                formData.append('_method', 'patch');
                await fetch(`/vehicles/${vehicleId}`, { method: 'POST', body: formData });
                return true;
            } catch (error) {
                console.error(`Fehler beim Speichern von Fahrzeug ${vehicleId}:`, error);
                return false;
            }
        };

        const toRoman = (num) => {
            if (isNaN(num) || num === null) return '';
            const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
            let str = '';
            for (let i of Object.keys(roman)) {
                let q = Math.floor(num / roman[i]);
                num -= q * roman[i];
                str += i.repeat(q);
            }
            return str;
        };

        const isUiOpen = localStorage.getItem('lss-rename-ui-open') !== 'false';

        const toolContainer = document.createElement('div');
        const placeholders = [
            { p: '{id}', t: 'Fahrzeug-ID' }, { p: '{old}', t: 'Alter Name' },
            { p: '{vehicleType}', t: 'Fahrzeugtyp (z.B. LF 20)' },
            { p: '{number}', t: 'Zähler (1, 2, 3)' }, { p: '{numberRoman}', t: 'Röm. Zähler (I, II, III)' },
            { p: '{stationName}', t: 'Name der Wache' }
        ];
        const placeholderButtons = placeholders.map(ph => `<span class="placeholder-pill" title="${ph.t}" data-placeholder="${ph.p}">${ph.p.replace(/[{}]/g, '')}</span>`).join(' ');

        toolContainer.innerHTML = `
            <details id="rename-tool-details" ${isUiOpen ? 'open' : ''} style="margin-bottom: 20px;">
                <summary style="font-size: 1.5em; cursor: pointer; font-weight: bold; padding: 5px; border: 1px solid #ccc; border-radius: 5px;">Fahrzeuge umbenennen</summary>
                <div style="margin-top: -1px; padding: 10px; border: 1px solid #ccc; border-top: none; border-radius: 0 0 5px 5px;">
                    <p style="margin-bottom: 5px;"><b>1. Vorlage erstellen</b> (fahre mit der Maus über die Platzhalter für eine Erklärung)</p>
                    <input id="rename-pattern-input" type="text" placeholder="Gib hier deine Vorlage ein..." style="width: 100%; padding: 5px; margin-bottom: 5px;" />
                    <div id="placeholder-container" style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px;">${placeholderButtons}</div>
                    <p style="margin-bottom: 5px;"><b>2. Zähl-Optionen festlegen</b></p>
                    <div style="margin-bottom: 10px;">
                        <label class="switch-label">
                            <div class="switch">
                                <input type="checkbox" id="count-per-type-toggle">
                                <span class="slider"></span>
                            </div>
                            <span class="switch-text">Zählung pro Fahrzeugtyp neustarten</span>
                        </label>
                        <label class="switch-label">
                            <div class="switch">
                                <input type="checkbox" id="omit-single-toggle">
                                <span class="slider"></span>
                            </div>
                            <span class="switch-text">Einzelne Fahrzeuge nicht nummerieren</span>
                        </label>
                    </div>
                    <p style="margin-bottom: 5px;"><b>3. Vorschau generieren und speichern</b></p>
                    <button id="preview-button" class="btn btn-primary">Vorschau generieren</button>
                    <button id="save-all-button" class="btn btn-success" style="display: none;">Alle speichern</button>
                </div>
            </details>
        `;

        vehicleTable.parentNode.insertBefore(toolContainer, vehicleTable);
        const savedPattern = localStorage.getItem('lss-rename-lastPattern');
        const patternInput = document.getElementById('rename-pattern-input');
        if (savedPattern && patternInput) {
            patternInput.value = savedPattern;
        }

        const countPerTypeCheckbox = document.getElementById('count-per-type-toggle');
        const omitSingleCheckbox = document.getElementById('omit-single-toggle');

        countPerTypeCheckbox.checked = localStorage.getItem('lss-rename-countPerType') === 'true';
        omitSingleCheckbox.checked = localStorage.getItem('lss-rename-omitSingle') === 'true';

        countPerTypeCheckbox.addEventListener('change', (e) => localStorage.setItem('lss-rename-countPerType', e.target.checked));
        omitSingleCheckbox.addEventListener('change', (e) => localStorage.setItem('lss-rename-omitSingle', e.target.checked));

        const detailsElement = document.getElementById('rename-tool-details');
        if (detailsElement) {
            detailsElement.addEventListener('toggle', () => {
                localStorage.setItem('lss-rename-ui-open', detailsElement.open);
            });
        }

        document.getElementById('placeholder-container').addEventListener('click', e => {
            if (e.target.classList.contains('placeholder-pill')) {
                const input = document.getElementById('rename-pattern-input');
                const cursorPosition = input.selectionStart;
                const textBefore = input.value.substring(0, cursorPosition);
                const textAfter = input.value.substring(cursorPosition);
                input.value = textBefore + e.target.dataset.placeholder + textAfter;
                input.focus();
                input.selectionStart = input.selectionEnd = cursorPosition + e.target.dataset.placeholder.length;
            }
        });

        document.getElementById('preview-button').addEventListener('click', () => {
            const patternToSave = document.getElementById('rename-pattern-input').value;
            localStorage.setItem('lss-rename-lastPattern', patternToSave);
            generatePreview();
        });

        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('save-single-vehicle')) {
                const btn = e.target;
                const vehicleId = btn.dataset.vehicleId;
                const newName = btn.previousElementSibling.value;
                btn.disabled = true;
                btn.textContent = '...';
                const success = await saveVehicleName(vehicleId, newName);
                if (success) {
                    btn.textContent = '✅';
                    const vehicleLink = document.querySelector(`a[href='/vehicles/${vehicleId}']`);
                    if (vehicleLink) vehicleLink.textContent = newName;
                    const previewDiv = btn.closest('.rename-preview');
                    if (previewDiv) {
                        previewDiv.classList.add('fade-out');
                        setTimeout(() => {
                            previewDiv.style.display = 'none';
                        }, 500);
                    }
                } else {
                    btn.textContent = '❌';
                }
            }
        });

        document.getElementById('save-all-button').addEventListener('click', () => {
            document.querySelectorAll('.save-single-vehicle:not(:disabled)').forEach((btn, index) => {
                setTimeout(() => {
                    btn.click();
                }, 200 * index);
            });
        });

        allVehicles = readVehicleData();
    }

    main();
})();
