/*
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
*/

/*
 * Runs in <head>, before the first paint: picks the theme and the menu width
 * the reader left the admin in, so a dark-mode reader never sees a white flash
 * and a collapsed menu does not spring open for a frame on every page.
 * Storage can throw (private windows, blocked site data); the defaults stand.
 */
(function () {
    "use strict";
    var root = document.documentElement;
    var theme = null;
    try {
        theme = window.localStorage.getItem("hv-theme");
    } catch (error) {
        theme = null;
    }
    // Light until the reader picks dark with the toggle, whatever the system
    // says: the admin is a daytime workplace, and the team asked for it.
    if (theme !== "light" && theme !== "dark") {
        theme = "light";
    }
    root.setAttribute("data-theme", theme);
    try {
        if (window.localStorage.getItem("hv-nav") === "collapsed") {
            root.classList.add("hv-nav-collapsed");
        }
    } catch (error) {
        // The menu simply starts open.
    }
})();
