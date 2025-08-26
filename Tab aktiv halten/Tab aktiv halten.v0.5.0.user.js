// ==UserScript==
// @name         Tab Aktiv Halten (Web Audio API - Capture)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Verhindert das Schlafen/Entladen eines Tabs durch die Web Audio API. Nutzt den Capture-Modus für maximale Zuverlässigkeit auf komplexen Seiten.
// @author       Gemini
// @match        *://www.leitstellenspiel.de/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('Tampermonkey: Lade Skript v1.3 (Capture-Modus)...');

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    // -- Einmalige Audio-Einrichtung --
    // Erstelle eine leere Audioquelle und starte sie. Sie bleibt still, bis der Context läuft.
    const source = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    source.buffer = buffer;
    source.loop = true;
    source.connect(audioCtx.destination);
    source.start(0);

    // -- Logik zur Reaktivierung des Kontexts --
    const resumeAudioContext = () => {
        if (audioCtx.state === 'suspended') {
            console.log('Tampermonkey: Nutzerinteraktion erkannt, versuche AudioContext zu reaktivieren...');
            audioCtx.resume().then(() => {
                console.log('%cTampermonkey: AudioContext erfolgreich reaktiviert! Status: ' + audioCtx.state, 'color: green; font-weight: bold;');
            }).catch(e => {
                console.error('Tampermonkey: Fehler beim Reaktivieren des AudioContext:', e);
            });
        }
        // Der Listener wird dank { once: true } automatisch nach dem ersten Aufruf entfernt.
    };

    // Prüfe den initialen Status und warte auf Interaktion, falls nötig.
    if (audioCtx.state === 'suspended') {
        console.log('Tampermonkey: AudioContext ist "suspended". Warte auf erste Nutzerinteraktion (Klick/Tastendruck)...');
        // Hänge den Listener im CAPTURE-MODUS an. Das ist der entscheidende Unterschied.
        window.addEventListener('click', resumeAudioContext, { once: true, capture: true });
        window.addEventListener('keydown', resumeAudioContext, { once: true, capture: true });
    } else {
         console.log('Tampermonkey: AudioContext läuft bereits. Status:', audioCtx.state);
    }
})();
