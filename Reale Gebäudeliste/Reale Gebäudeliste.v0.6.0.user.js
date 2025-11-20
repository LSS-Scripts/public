// ==UserScript==
// @name         Warnung (Dunkel & Rot)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Zeigt einmalig eine Warnung im Dark-Mode-Stil mit rotem Rahmen.
// @author       Du
// @match        https://www.leitstellenspiel.de/
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==


 //GM_deleteValue('hat_gewarnt_dark_rgl');


(function() {
    'use strict';

    // 1. PRÜFUNG: Wurde das Script schon ausgeführt?
    // Falls ja: Sofort abbrechen (Selbstlöschung simulieren)
    if (GM_getValue('hat_gewarnt_dark_rgl', false)) {
        return;
    }

    // 2. CONTAINER (Overlay)
    // Dunkelt den Rest der Webseite ab
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85);
        z-index: 2147483647; /* Maximaler Z-Index */
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
    `;

    // 3. DIE WARN-BOX
    const box = document.createElement('div');
    box.style.cssText = `
        background: #222; /* Dunkler Hintergrund */
        color: #fff;      /* Weiße Schrift */
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        border: 4px solid #ff0000; /* Dicker roter Rahmen */
        max-width: 500px;
        box-shadow: 0 0 25px rgba(255, 0, 0, 0.6); /* Roter Glow-Effekt */
    `;

    // Inhalt der Box
    box.innerHTML = `
        <h2 style="color: #ff4444; margin-top: 0; text-transform: uppercase; letter-spacing: 2px;">
            ⚠️ Warnung
        </h2>
        <p style="font-size: 16px; line-height: 1.5;">
          Die Reale Gebäudeliste musste aus technischen Gründen aus dem B&M-Manager entfernt werden, da diese Gebäudeliste Funktionen benötigt, die aktuell nicht über den B&M-Manager bereitgestellt werden können.
<br>Wenn Du die aktualisierte Liste einzeln nutzen möchtest, klicke bitte hier:
        </p>
        <p style="margin: 25px 0;">
            <a href="https://github.com/Masklin112/share/raw/refs/heads/main/Reale%20Geb%C3%A4udeliste.v1.3.5.user.js" target="_blank"
               style="color: #4db8ff; font-size: 20px; font-weight: bold; text-decoration: underline; cursor: pointer;">
                >> Jetzt hier klicken <<
            </a><br>
Dies ist nur eine einmalige Warnung, das Script deaktiviert sich hiernach selbst.
        </p>
        <button id="closeBtn" style="
            margin-top: 10px;
            padding: 10px 20px;
            background: #444;
            color: white;
            border: 1px solid #666;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;">
            Schließen
        </button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 4. STATUS SETZEN
    // Speichern, dass die Warnung gesehen wurde.
    GM_setValue('hat_gewarnt_dark_rgl', true);

    // Button Funktion
    document.getElementById('closeBtn').addEventListener('click', function() {
        overlay.remove();
    });

    // Button Hover-Effekt (Optional für bessere UX)
    const btn = document.getElementById('closeBtn');
    btn.onmouseover = function() { this.style.background = '#666'; };
    btn.onmouseout = function() { this.style.background = '#444'; };

})();
