// ==UserScript==
// @name         Event-Dauerleuchten-Exorzist
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Entfernt das grüne Leuchten vom Profil-Button UND vom Event-Menüpunkt, wenn NUR das saisonale Event neu ist.
// @author       B&M
// @match        https://www.leitstellenspiel.de/*
// @match        https://www.leitstellenspiel.at/*
// @match        https://www.ch-leitstellenspiel.ch/*
// @match        https://www.missionchief.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- IDs und Klassen ---
    const PROFILE_MENU_ID = 'menu_profile';           // Der <a>-Tag des Profil-Buttons
    const EVENT_NAVBAR_ID = 'seasonal-event-navbar';  // Das <li>-Element des Events
    const TASKS_COUNTER_ID = 'completed_tasks_counter'; // Das <span>-Element für den Aufgaben-Zähler
    const GLOW_CLASS = 'daily_bonus_not_taken';       // Die Klasse, die das Leuchten verursacht
    const HIDDEN_CLASS = 'hidden';                    // Die Klasse, die den Zähler versteckt

    const checkAndFixGlow = () => {
        const profileMenu = document.getElementById(PROFILE_MENU_ID);
        const eventItem = document.getElementById(EVENT_NAVBAR_ID);
        const tasksCounter = document.getElementById(TASKS_COUNTER_ID);

        // Finde das übergeordnete <li>-Element des Profil-Buttons
        // (Das ist das Element, das fälschlicherweise leuchtet)
        const profileDropdown = profileMenu ? profileMenu.closest('li.dropdown') : null;

        // Wenn eines der Elemente noch nicht da ist, beenden und auf nächsten Durchlauf warten.
        if (!profileDropdown || !eventItem || !tasksCounter) {
            return;
        }

        // 1. Leuchten vom Event-Item selbst entfernen (wie im alten Skript)
        if (eventItem.classList.contains(GLOW_CLASS)) {
            eventItem.classList.remove(GLOW_CLASS);
        }

        // 2. Logik für das Leuchten des Profil-Buttons prüfen
        const isProfileGlowing = profileDropdown.classList.contains(GLOW_CLASS);
        const areTasksNew = !tasksCounter.classList.contains(HIDDEN_CLASS);

        // 3. Fallunterscheidung:
        // WENN das Profil leuchtet, ABER keine neuen Aufgaben da sind...
        if (isProfileGlowing && !areTasksNew) {
            // ...dann MUSS das Leuchten ja vom Event kommen. Also entfernen wir es.
            profileDropdown.classList.remove(GLOW_CLASS);
        }

        // WENN das Profil leuchtet UND neue Aufgaben da sind -> alles korrekt, nichts tun.
        // WENN das Profil nicht leuchtet -> alles korrekt, nichts tun.
    };

    // Wir brauchen einen MutationObserver, der auch auf Klassen-Änderungen reagiert
    // (z.B. wenn die 'hidden'-Klasse beim Task-Counter entfernt wird).
    const observer = new MutationObserver((mutations) => {
        // Wir müssen nicht die Mutationen prüfen, wir rufen einfach unsere Funktion auf.
        checkAndFixGlow();
    });

    // Beobachte den 'body', da Elemente dynamisch ihre Klassen ändern können.
    observer.observe(document.body, {
        childList: true,  // auf neue Elemente achten
        subtree: true,    // in die Tiefe gehen
        attributes: true, // WICHTIG: auf Klassen-Änderungen achten (z.B. 'hidden')
        attributeFilter: ['class'] // Nur auf 'class'-Änderungen reagieren
    });

    // Führe die Funktion auch einmal beim Start aus, falls die Seite schon geladen ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndFixGlow);
    } else {
        checkAndFixGlow();
    }
})();
