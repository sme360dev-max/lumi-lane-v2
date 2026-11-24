/*
   \==================================================================
   \==   @ Henvo                                                    ==
   \==   @ author: Mai Quoc Viet                                    ==
   \==   @ project: knowledge                                       ==
   \==   @ copyright: (c) 2026 Henvo. All rights reserved.          ==
   \==================================================================
*/

/*
 * The admin shell: theme switch, menu, page finder, and the small helpers
 * every admin page shares (spelled-out dates, document lightbox, dismissable
 * messages, the system status card on the overview, the login form niceties).
 *
 * Everything here is an enhancement. With the script blocked the menu is still
 * a list of links, forms still submit, and a thumbnail still opens its file.
 */
(function () {
    "use strict";

    var root = document.documentElement;

    function ready(fn) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn);
        } else {
            fn();
        }
    }

    function store(key, value) {
        try {
            if (value === null) {
                window.localStorage.removeItem(key);
            } else {
                window.localStorage.setItem(key, value);
            }
        } catch (error) {
            // Private windows refuse storage; the choice lasts for this page only.
        }
    }

    function fold(text) {
        // Accent-insensitive matching, so "cafe" finds "Café".
        return (text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "");
    }

    /* Theme: one button, two states. The reader's choice is remembered; with
       no choice made, the operating system decides (admin-theme.js). */
    function wireTheme() {
        document.querySelectorAll("[data-hv-theme-toggle]").forEach(function (button) {
            button.addEventListener("click", function () {
                var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
                root.setAttribute("data-theme", next);
                store("hv-theme", next);
            });
        });
    }

    /* Menu: a drawer under 1024px, a rail that collapses to icons above it. */
    var MOBILE = window.matchMedia("(max-width: 1023px)");

    function setDrawer(open) {
        var scrim = document.querySelector("[data-hv-close-nav]");
        var toggle = document.querySelector("[data-hv-nav-toggle]");
        document.body.classList.toggle("hv-nav-open", open);
        if (scrim) {
            scrim.hidden = !open;
        }
        if (toggle) {
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }
    }

    function wireMenu() {
        var toggle = document.querySelector("[data-hv-nav-toggle]");
        var collapse = document.querySelector("[data-hv-collapse]");
        var scrim = document.querySelector("[data-hv-close-nav]");

        if (toggle) {
            toggle.addEventListener("click", function () {
                setDrawer(!document.body.classList.contains("hv-nav-open"));
            });
        }
        if (scrim) {
            scrim.addEventListener("click", function () {
                setDrawer(false);
            });
        }
        if (collapse) {
            collapse.addEventListener("click", function () {
                var collapsed = root.classList.toggle("hv-nav-collapsed");
                store("hv-nav", collapsed ? "collapsed" : null);
                var label = collapsed ? collapse.getAttribute("data-label-expand") : collapse.getAttribute("data-label-collapse");
                collapse.setAttribute("aria-label", label);
                collapse.setAttribute("title", label);
                var text = collapse.querySelector(".hv-nav-text");
                if (text) {
                    text.textContent = collapsed ? "Expand" : "Collapse";
                }
            });
        }
        MOBILE.addEventListener("change", function () {
            setDrawer(false);
        });

        // Keep the open page in view when the menu is longer than the screen.
        var active = document.querySelector(".hv-nav-link.is-active");
        var nav = document.querySelector("[data-hv-nav]");
        if (active && nav && active.offsetTop > nav.clientHeight - 80) {
            nav.scrollTop = active.offsetTop - nav.clientHeight / 2;
        }
    }

    /* The account menu is a <details>; close it on a click elsewhere or Esc. */
    function wireUserMenu() {
        document.addEventListener("click", function (event) {
            document.querySelectorAll("[data-hv-menu][open]").forEach(function (menu) {
                if (!menu.contains(event.target)) {
                    menu.removeAttribute("open");
                }
            });
        });
    }

    /* Page finder (Ctrl+K): every page in the menu, filtered as you type. */
    function wirePalette() {
        var palette = document.querySelector("[data-hv-palette]");
        if (!palette) {
            return;
        }
        var input = palette.querySelector("[data-hv-palette-input]");
        var list = palette.querySelector("[data-hv-palette-list]");
        var empty = palette.querySelector("[data-hv-palette-empty]");
        var entries = [];
        var cursor = 0;
        var lastFocus = null;

        document.querySelectorAll("[data-hv-nav-link]").forEach(function (link) {
            var name = link.querySelector(".hv-nav-text").textContent.trim();
            var section = link.getAttribute("data-hv-section") || "";
            var glyph = link.querySelector("svg");
            entries.push({
                name: name,
                section: section,
                href: link.getAttribute("href"),
                icon: glyph ? glyph.outerHTML : "",
                key: fold(name + " " + section),
            });
        });

        function render() {
            var query = fold(input.value.trim());
            var matches = entries.filter(function (entry) {
                return !query || query.split(/\s+/).every(function (word) {
                    return entry.key.indexOf(word) !== -1;
                });
            });
            list.innerHTML = "";
            cursor = Math.min(cursor, Math.max(matches.length - 1, 0));
            matches.forEach(function (entry, index) {
                var item = document.createElement("li");
                item.setAttribute("role", "option");
                item.className = "hv-palette-item" + (index === cursor ? " is-on" : "");
                item.setAttribute("aria-selected", index === cursor ? "true" : "false");
                var link = document.createElement("a");
                link.href = entry.href;
                link.innerHTML = entry.icon;
                var name = document.createElement("span");
                name.textContent = entry.name;
                link.appendChild(name);
                if (entry.section) {
                    var section = document.createElement("small");
                    section.textContent = entry.section;
                    link.appendChild(section);
                }
                item.appendChild(link);
                item.addEventListener("mousemove", function () {
                    if (cursor !== index) {
                        cursor = index;
                        highlight();
                    }
                });
                list.appendChild(item);
            });
            empty.hidden = matches.length > 0;
        }

        function highlight() {
            list.querySelectorAll(".hv-palette-item").forEach(function (item, index) {
                item.classList.toggle("is-on", index === cursor);
                item.setAttribute("aria-selected", index === cursor ? "true" : "false");
                if (index === cursor) {
                    item.scrollIntoView({ block: "nearest" });
                }
            });
        }

        function open() {
            lastFocus = document.activeElement;
            palette.hidden = false;
            input.value = "";
            cursor = 0;
            render();
            input.focus();
        }

        function close() {
            palette.hidden = true;
            if (lastFocus && lastFocus.focus) {
                lastFocus.focus();
            }
        }

        document.querySelectorAll("[data-hv-palette-open]").forEach(function (button) {
            button.addEventListener("click", open);
        });
        palette.addEventListener("click", function (event) {
            if (event.target === palette) {
                close();
            }
        });
        input.addEventListener("input", function () {
            cursor = 0;
            render();
        });
        input.addEventListener("keydown", function (event) {
            var items = list.querySelectorAll(".hv-palette-item");
            if (event.key === "ArrowDown") {
                event.preventDefault();
                cursor = Math.min(cursor + 1, items.length - 1);
                highlight();
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                cursor = Math.max(cursor - 1, 0);
                highlight();
            } else if (event.key === "Enter") {
                var chosen = items[cursor] ? items[cursor].querySelector("a") : null;
                if (chosen) {
                    event.preventDefault();
                    window.location.href = chosen.href;
                }
            }
        });
        document.addEventListener("keydown", function (event) {
            var mod = event.ctrlKey || event.metaKey;
            if (mod && (event.key === "k" || event.key === "K")) {
                event.preventDefault();
                if (palette.hidden) {
                    open();
                } else {
                    close();
                }
            } else if (event.key === "Escape") {
                if (!palette.hidden) {
                    close();
                } else if (document.body.classList.contains("hv-nav-open")) {
                    setDrawer(false);
                } else {
                    document.querySelectorAll("[data-hv-menu][open]").forEach(function (menu) {
                        menu.removeAttribute("open");
                    });
                }
            }
        });
    }

    /* Dropdowns. The browser draws an open <select> itself, in the operating
       system's own grey list, and no stylesheet reaches it. Each single
       <select> gets a button and a list drawn here instead; the real element
       stays underneath, so forms submit, Django's scripts read and write it,
       and validation is untouched. Multi-selects, the two-column picker and
       autocomplete widgets keep their own controls. */
    var SELECT_SKIP = "[multiple], [size], .admin-autocomplete, .select2-hidden-accessible, [data-hv-native]";
    var CHECK_ICON = '<svg class="hv-i hv-select-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    var CARET_ICON = '<svg class="hv-i hv-select-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 9.5 5.5 5.5 5.5-5.5"/></svg>';
    var openSelect = null;

    function optionLabel(option) {
        return option ? option.textContent.trim() : "";
    }

    function onViewportChange(event) {
        if (openSelect && event && event.type === "scroll" && openSelect.pop.contains(event.target)) {
            return;
        }
        closeSelect(false);
    }

    function closeSelect(restoreFocus) {
        if (!openSelect) {
            return;
        }
        var current = openSelect;
        openSelect = null;
        current.pop.remove();
        current.trigger.setAttribute("aria-expanded", "false");
        current.trigger.removeAttribute("aria-activedescendant");
        current.wrap.classList.remove("is-open");
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("scroll", onViewportChange, true);
        if (restoreFocus) {
            current.trigger.focus();
        }
    }

    function placePop(state) {
        var rect = state.trigger.getBoundingClientRect();
        var pop = state.pop;
        pop.style.minWidth = Math.max(rect.width, 180) + "px";
        pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - pop.offsetWidth - 8)) + "px";
        var below = window.innerHeight - rect.bottom;
        if (below < Math.min(pop.offsetHeight, 300) + 12 && rect.top > below) {
            pop.style.top = "";
            pop.style.bottom = window.innerHeight - rect.top + 6 + "px";
            pop.classList.add("is-up");
        } else {
            pop.style.bottom = "";
            pop.style.top = rect.bottom + 6 + "px";
            pop.classList.remove("is-up");
        }
    }

    function syncTrigger(state) {
        var option = state.select.options[state.select.selectedIndex];
        state.value.textContent = optionLabel(option) || "—";
        state.trigger.disabled = state.select.disabled;
        var first = state.select.options[0];
        // A filter showing anything but its first choice ("All") is in use.
        state.wrap.classList.toggle("is-set", Boolean(option && first && option !== first));
    }

    function choose(state, option) {
        if (!option || option.disabled) {
            return;
        }
        var changed = state.select.value !== option.value;
        state.select.value = option.value;
        syncTrigger(state);
        closeSelect(true);
        if (changed) {
            state.select.dispatchEvent(new Event("input", { bubbles: true }));
            state.select.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function openList(state) {
        closeSelect(false);
        var select = state.select;
        var pop = document.createElement("div");
        pop.className = "hv-select-pop";
        var list = document.createElement("ul");
        list.setAttribute("role", "listbox");
        list.id = "hv-listbox-" + Math.random().toString(36).slice(2, 9);
        state.trigger.setAttribute("aria-controls", list.id);

        var items = [];
        var search = null;
        if (select.options.length > 9) {
            search = document.createElement("input");
            search.type = "search";
            search.className = "hv-select-search";
            search.placeholder = "Search the list…";
            search.setAttribute("aria-label", "Search the list");
            search.setAttribute("autocomplete", "off");
            pop.appendChild(search);
        }

        function setCursor(index) {
            items.forEach(function (entry, i) {
                entry.item.classList.toggle("is-active", i === index);
            });
            state.cursor = index;
            if (items[index]) {
                state.trigger.setAttribute("aria-activedescendant", items[index].item.id);
                items[index].item.scrollIntoView({ block: "nearest" });
            }
        }

        function addOption(option) {
            var item = document.createElement("li");
            item.setAttribute("role", "option");
            item.className = "hv-select-option";
            item.id = list.id + "-" + items.length;
            if (option.disabled) {
                item.setAttribute("aria-disabled", "true");
            }
            if (option.selected) {
                item.setAttribute("aria-selected", "true");
            }
            var label = document.createElement("span");
            label.textContent = optionLabel(option) || "—";
            item.appendChild(label);
            item.insertAdjacentHTML("beforeend", CHECK_ICON);
            var entry = { item: item, option: option, key: fold(optionLabel(option)) };
            item.addEventListener("mousedown", function (event) {
                event.preventDefault();
            });
            item.addEventListener("click", function () {
                choose(state, option);
            });
            item.addEventListener("mousemove", function () {
                if (state.cursor !== items.indexOf(entry)) {
                    setCursor(items.indexOf(entry));
                }
            });
            items.push(entry);
            list.appendChild(item);
        }

        Array.prototype.forEach.call(select.children, function (node) {
            if (node.tagName === "OPTGROUP") {
                var heading = document.createElement("li");
                heading.className = "hv-select-group";
                heading.setAttribute("role", "presentation");
                heading.textContent = node.label;
                list.appendChild(heading);
                Array.prototype.forEach.call(node.children, addOption);
            } else {
                addOption(node);
            }
        });
        pop.appendChild(list);
        document.body.appendChild(pop);

        state.pop = pop;
        state.items = items;
        openSelect = state;
        state.trigger.setAttribute("aria-expanded", "true");
        state.wrap.classList.add("is-open");
        placePop(state);
        setCursor(Math.max(0, select.selectedIndex));

        function visible() {
            return items.filter(function (entry) {
                return !entry.item.hidden;
            });
        }

        function move(step) {
            var shown = visible();
            if (!shown.length) {
                return;
            }
            var at = shown.indexOf(items[state.cursor]);
            var next = shown[Math.min(Math.max(at + step, 0), shown.length - 1)];
            setCursor(items.indexOf(next));
        }

        state.keys = function (event) {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
            } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                var shown = visible();
                if (shown.length) {
                    setCursor(items.indexOf(event.key === "Home" ? shown[0] : shown[shown.length - 1]));
                }
            } else if (event.key === "Enter") {
                event.preventDefault();
                if (items[state.cursor] && !items[state.cursor].item.hidden) {
                    choose(state, items[state.cursor].option);
                }
            } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeSelect(true);
            } else if (event.key === "Tab") {
                closeSelect(false);
            }
        };

        if (search) {
            search.addEventListener("input", function () {
                var query = fold(search.value.trim());
                items.forEach(function (entry) {
                    entry.item.hidden = Boolean(query) && entry.key.indexOf(query) === -1;
                });
                var shown = visible();
                if (shown.length) {
                    setCursor(items.indexOf(shown[0]));
                }
            });
            search.addEventListener("keydown", state.keys);
            search.focus();
        }

        window.addEventListener("resize", onViewportChange);
        window.addEventListener("scroll", onViewportChange, true);
    }

    function enhanceSelect(select) {
        if (select.dataset.hvSelect || select.matches(SELECT_SKIP) || select.closest(".empty-form, .selector, .hv-select")) {
            return;
        }
        select.dataset.hvSelect = "1";

        var wrap = document.createElement("span");
        wrap.className = "hv-select";
        if (select.classList.contains("hv-field")) {
            wrap.classList.add("hv-field");
        }
        if (select.classList.contains("hv-field-sm")) {
            wrap.classList.add("hv-field-sm");
        }
        if (select.hasAttribute("data-hv-filter-select")) {
            wrap.classList.add("hv-select-filter");
        }

        var trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "hv-select-trigger";
        trigger.setAttribute("role", "combobox");
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        var prefixText = select.getAttribute("data-hv-select-label");
        var name = prefixText || select.getAttribute("aria-label");
        var label = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
        if (!name && label) {
            name = label.textContent.replace(/[:*\s]+$/, "");
        }
        if (label) {
            // The label still points at the hidden select; send its click on.
            label.addEventListener("click", function (event) {
                event.preventDefault();
                trigger.focus();
            });
        }
        if (name) {
            trigger.setAttribute("aria-label", name);
        }
        if (prefixText) {
            var prefix = document.createElement("span");
            prefix.className = "hv-select-prefix";
            prefix.textContent = prefixText;
            trigger.appendChild(prefix);
        }
        var value = document.createElement("span");
        value.className = "hv-select-value";
        trigger.appendChild(value);
        trigger.insertAdjacentHTML("beforeend", CARET_ICON);

        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        wrap.appendChild(trigger);
        select.classList.add("hv-select-native");
        select.tabIndex = -1;
        select.setAttribute("aria-hidden", "true");

        var state = { select: select, wrap: wrap, trigger: trigger, value: value };
        syncTrigger(state);

        trigger.addEventListener("click", function () {
            if (openSelect === state) {
                closeSelect(true);
            } else {
                openList(state);
            }
        });
        trigger.addEventListener("keydown", function (event) {
            if (openSelect === state) {
                state.keys(event);
                return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openList(state);
            }
        });
        // Django's own scripts (an option added from the popup, an action
        // reset) change the real select; the button follows them.
        select.addEventListener("change", function () {
            syncTrigger(state);
        });
        new MutationObserver(function () {
            syncTrigger(state);
        }).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["selected", "disabled"] });
    }

    function wireSelects(scope) {
        if (scope && scope.tagName === "SELECT") {
            enhanceSelect(scope);
            return;
        }
        (scope || document).querySelectorAll("select").forEach(enhanceSelect);
    }

    function wireSelectDismiss() {
        document.addEventListener("mousedown", function (event) {
            if (openSelect && !openSelect.pop.contains(event.target) && !openSelect.wrap.contains(event.target)) {
                closeSelect(false);
            }
        });
    }

    /* Filters above a list: each is a dropdown whose option values are the
       addresses of the filtered list, so choosing one goes there. */
    function wireFilters() {
        document.querySelectorAll("[data-hv-filter-select]").forEach(function (select) {
            select.addEventListener("change", function () {
                // Only ever a query string on this list, never another address.
                if (select.value.charAt(0) === "?") {
                    window.location.href = select.value;
                }
            });
        });
    }

    /* A change form split into tabs, one per fieldset and one per inline:
       the page shows one part at a time instead of a long scroll. The tab
       with the first error opens first; otherwise the last tab used on this
       record. Without the script every part simply shows, one under another. */
    function wireTabs() {
        var form = document.querySelector(".change-form #content-main form");
        if (!form || document.body.classList.contains("popup")) {
            return;
        }
        // The csrf input comes first; the parts live in the div after it.
        var holder = form.querySelector(":scope > div");
        if (!holder) {
            return;
        }
        var panels = Array.prototype.filter.call(holder.children, function (node) {
            return node.matches("fieldset.module, .inline-group") && !node.matches(".hidden");
        });
        if (panels.length < 2) {
            return;
        }

        var bar = document.createElement("div");
        bar.className = "hv-tabs";
        bar.setAttribute("role", "tablist");
        bar.setAttribute("aria-label", "Record sections");
        var tabs = [];

        panels.forEach(function (panel, index) {
            var heading = panel.querySelector("h2");
            var name = heading ? heading.textContent.trim() : "";
            if (!name) {
                name = index === 0 ? "General" : "Section " + (index + 1);
            }
            if (!panel.id) {
                panel.id = "hv-panel-" + index;
            }
            panel.classList.add("hv-tab-panel");
            panel.setAttribute("role", "tabpanel");

            var tab = document.createElement("button");
            tab.type = "button";
            tab.className = "hv-tab";
            tab.setAttribute("role", "tab");
            tab.id = "hv-tab-" + index;
            tab.setAttribute("aria-controls", panel.id);
            panel.setAttribute("aria-labelledby", tab.id);
            tab.textContent = name;
            if (panel.querySelector(".errorlist, .errors")) {
                tab.classList.add("has-error");
                tab.insertAdjacentHTML("beforeend", '<span class="hv-tab-dot" aria-label="has errors"></span>');
            }
            // Saved records only: a stacked inline is one block per record, a
            // tabular one is one table whose rows are the records.
            var rows = panel.querySelectorAll(".inline-related.has_original, tr.form-row.has_original").length;
            if (panel.matches(".inline-group") && rows) {
                var count = document.createElement("span");
                count.className = "hv-tab-count";
                count.textContent = rows;
                tab.appendChild(count);
            }
            tab.addEventListener("click", function () {
                show(index, true);
            });
            tab.addEventListener("keydown", function (event) {
                var step = event.key === "ArrowRight" ? 1 : (event.key === "ArrowLeft" ? -1 : 0);
                if (step) {
                    event.preventDefault();
                    var next = (index + step + tabs.length) % tabs.length;
                    show(next, true);
                    tabs[next].focus();
                }
            });
            tabs.push(tab);
            bar.appendChild(tab);
        });

        var storeKey = "hv-tab:" + window.location.pathname;

        function show(active, remember) {
            panels.forEach(function (panel, index) {
                var on = index === active;
                panel.hidden = !on;
                tabs[index].classList.toggle("is-on", on);
                tabs[index].setAttribute("aria-selected", on ? "true" : "false");
                tabs[index].tabIndex = on ? 0 : -1;
                if (on) {
                    revealTab(tabs[index]);
                    var details = panel.querySelector(":scope > details");
                    if (details) {
                        details.open = true;
                    }
                }
            });
            if (remember) {
                try {
                    window.sessionStorage.setItem(storeKey, String(active));
                } catch (error) {
                    // The choice simply is not remembered.
                }
            }
        }

        var frame = scrollableTabs(bar);
        holder.insertBefore(frame, panels[0]);
        document.body.classList.add("hv-has-tabs");

        var start = tabs.findIndex(function (tab) {
            return tab.classList.contains("has-error");
        });
        if (start === -1) {
            try {
                start = Number(window.sessionStorage.getItem(storeKey) || 0);
            } catch (error) {
                start = 0;
            }
        }
        show(start >= 0 && start < panels.length ? start : 0, false);
    }

    var CHEVRON_ICON = '<svg class="hv-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';

    /* A tab bar wider than the page scrolls sideways. A touch screen swipes,
       but a mouse on a narrow laptop window has no sideways wheel and the
       scrollbar is hidden, so the bar gets arrow buttons at both ends (shown
       only while something is out of view) and the ordinary wheel scrolls it. */
    function scrollableTabs(bar) {
        var frame = document.createElement("div");
        frame.className = "hv-tabs-frame";
        var prev = document.createElement("button");
        var next = document.createElement("button");
        [[prev, "is-prev", "Earlier sections", -1], [next, "is-next", "Later sections", 1]].forEach(function (spec) {
            var button = spec[0];
            button.type = "button";
            button.className = "hv-tabs-arrow " + spec[1];
            button.setAttribute("aria-label", spec[2]);
            button.tabIndex = -1;
            button.innerHTML = CHEVRON_ICON;
            button.addEventListener("click", function () {
                bar.scrollBy({left: spec[3] * Math.max(bar.clientWidth * 0.7, 120), behavior: "smooth"});
            });
        });
        frame.appendChild(prev);
        frame.appendChild(bar);
        frame.appendChild(next);

        function refresh() {
            var max = bar.scrollWidth - bar.clientWidth;
            frame.classList.toggle("can-prev", bar.scrollLeft > 2);
            frame.classList.toggle("can-next", bar.scrollLeft < max - 2);
        }
        bar.addEventListener("scroll", refresh, {passive: true});
        window.addEventListener("resize", refresh);
        bar.addEventListener("wheel", function (event) {
            if (bar.scrollWidth <= bar.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
                return;
            }
            event.preventDefault();
            bar.scrollLeft += event.deltaY;
        }, {passive: false});
        window.requestAnimationFrame(refresh);
        return frame;
    }

    /* Bring the open tab into the bar's view, without moving the page. */
    function revealTab(tab) {
        var bar = tab.parentElement;
        if (!bar || bar.scrollWidth <= bar.clientWidth) {
            return;
        }
        var left = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
        bar.scrollTo({left: Math.max(0, left), behavior: "smooth"});
    }

    /* Each saved row of a tabular inline carries its record's name in a
       paragraph Django floats over the top of the row. Taller rows here than
       in Django's own skin let it slide over the row below; it gets a row of
       its own instead, so the whole name shows and nothing overlaps. */
    function wireInlineCaptions(scope) {
        (scope || document).querySelectorAll(".inline-group .tabular tr.form-row.has_original").forEach(function (row) {
            if (row.dataset.hvCaption) {
                return;
            }
            row.dataset.hvCaption = "1";
            var label = row.querySelector("td.original p");
            if (!label || !label.textContent.trim()) {
                return;
            }
            var caption = document.createElement("tr");
            caption.className = "hv-inline-caption";
            var cell = document.createElement("td");
            cell.colSpan = row.children.length;
            cell.appendChild(label);
            caption.appendChild(cell);
            row.parentNode.insertBefore(caption, row);
            row.classList.add("hv-has-caption");
        });
    }

    /* The KYC desk: pick an application in the queue, see it on the right.
       The address carries the choice (#kyc-<id>), so a reload or a shared
       link opens the same application, and the browser's back button walks
       back through what was looked at. Arrow keys move through the queue. */
    function wireKycDesk() {
        var desk = document.querySelector("[data-hv-kyc]");
        if (!desk) {
            return;
        }
        var picks = Array.prototype.slice.call(desk.querySelectorAll("[data-hv-kyc-pick]"));
        var cases = Array.prototype.slice.call(desk.querySelectorAll(".hv-kyc-case"));
        if (!picks.length || !cases.length) {
            return;
        }
        desk.classList.add("is-single");

        function show(id, focusCase) {
            var found = cases.some(function (node) {
                return node.id === id;
            });
            if (!found) {
                id = cases[0].id;
            }
            cases.forEach(function (node) {
                node.hidden = node.id !== id;
            });
            picks.forEach(function (link) {
                var on = link.getAttribute("data-hv-kyc-pick") === id;
                link.classList.toggle("is-on", on);
                if (on) {
                    link.setAttribute("aria-current", "true");
                    link.scrollIntoView({ block: "nearest" });
                } else {
                    link.removeAttribute("aria-current");
                }
            });
            if (focusCase) {
                var stage = desk.querySelector(".hv-kyc-stage");
                if (stage && stage.getBoundingClientRect().top < 0) {
                    stage.scrollIntoView({ block: "start", behavior: "smooth" });
                }
            }
        }

        picks.forEach(function (link, index) {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                var id = link.getAttribute("data-hv-kyc-pick");
                if (window.location.hash !== "#" + id) {
                    window.history.pushState(null, "", "#" + id);
                }
                show(id, true);
            });
            link.addEventListener("keydown", function (event) {
                var step = event.key === "ArrowDown" ? 1 : (event.key === "ArrowUp" ? -1 : 0);
                if (step && picks[index + step]) {
                    event.preventDefault();
                    picks[index + step].focus();
                    picks[index + step].click();
                }
            });
        });

        window.addEventListener("popstate", function () {
            show(window.location.hash.slice(1), false);
        });
        show(window.location.hash.slice(1), false);
    }

    function wireMessages() {
        document.addEventListener("click", function (event) {
            var button = event.target.closest ? event.target.closest("[data-hv-dismiss]") : null;
            if (button) {
                var message = button.closest("li");
                if (message) {
                    message.remove();
                }
            }
        });
    }

    /* A native date box is drawn in the browser's locale, which is not always
       the reader's: an en-US install shows 04/17 for the 17th of April. The
       date in words underneath cannot be read two ways. */
    var ECHO_CLASS = "hv-date-echo";
    var SOURCE_SELECTOR = ".hv-date-echo-source";

    function spellOut(value) {
        var match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value || "");
        if (!match) {
            return "";
        }
        var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        var text = date.toLocaleDateString("en-AU", {
            weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
        });
        if (match[4]) {
            text += ", " + match[4] + ":" + match[5];
        }
        return text;
    }

    function echoFor(input) {
        var next = input.nextElementSibling;
        if (next && next.classList.contains(ECHO_CLASS)) {
            return next;
        }
        var echo = document.createElement("p");
        echo.className = ECHO_CLASS;
        // Polite: the reader is typing in the box right above it.
        echo.setAttribute("aria-live", "polite");
        input.insertAdjacentElement("afterend", echo);
        return echo;
    }

    function wireDateEchoes(scope) {
        (scope || document).querySelectorAll(SOURCE_SELECTOR).forEach(function (input) {
            if (input.dataset.hvDateEchoWired) {
                return;
            }
            input.dataset.hvDateEchoWired = "1";
            var refresh = function () {
                echoFor(input).textContent = spellOut(input.value);
            };
            input.addEventListener("input", refresh);
            input.addEventListener("change", refresh);
            refresh();
        });
    }

    /* Full-size view of a scanned document, opened from its thumbnail. The
       thumbnail shows what a document is; this is where its number
       gets read. The anchor keeps its href, so a middle click still opens a
       tab and the page works unchanged without this script. */
    var lightbox = null;

    function closeLightbox() {
        if (!lightbox) {
            return;
        }
        lightbox.remove();
        lightbox = null;
        document.removeEventListener("keydown", onLightboxKey);
    }

    function onLightboxKey(event) {
        if (event.key === "Escape") {
            closeLightbox();
        }
    }

    function openLightbox(source, caption) {
        closeLightbox();
        lightbox = document.createElement("div");
        lightbox.className = "hv-lightbox";
        lightbox.setAttribute("role", "dialog");
        lightbox.setAttribute("aria-modal", "true");
        lightbox.setAttribute("aria-label", caption || "View file");

        var image = document.createElement("img");
        image.src = source;
        image.alt = caption || "";

        var close = document.createElement("button");
        close.type = "button";
        close.className = "hv-lightbox-close";
        close.setAttribute("aria-label", "Close");
        close.textContent = "×";

        var label = document.createElement("p");
        label.className = "hv-lightbox-caption";
        label.textContent = caption || "";

        lightbox.appendChild(close);
        lightbox.appendChild(image);
        lightbox.appendChild(label);
        // The backdrop closes; the picture does not, it is where people drag to pan.
        lightbox.addEventListener("click", function (event) {
            if (event.target === lightbox || event.target === close) {
                closeLightbox();
            }
        });
        document.body.appendChild(lightbox);
        document.addEventListener("keydown", onLightboxKey);
        close.focus();
    }

    function wireLightbox() {
        document.addEventListener("click", function (event) {
            var trigger = event.target.closest ? event.target.closest("[data-hv-lightbox]") : null;
            if (!trigger || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
                return;
            }
            event.preventDefault();
            openLightbox(trigger.getAttribute("href"), trigger.getAttribute("data-hv-caption"));
        });
    }

    /* The status card on the overview. Asked from the browser so a slow worker
       ping never holds up the page; the endpoint lists only what failed when
       anything does, so everything it does not name is up. */
    var HEALTH_LABELS = { healthy: "Operational", unhealthy: "Problem" };

    function wireHealth() {
        var card = document.querySelector("[data-hv-health]");
        if (!card || !window.fetch) {
            return;
        }
        var stamp = card.querySelector("[data-hv-health-time]");
        var refreshButton = card.querySelector("[data-hv-health-refresh]");

        function paint(name, state, detail) {
            var row = card.querySelector('[data-hv-health-item="' + name + '"]');
            if (!row) {
                return;
            }
            row.setAttribute("data-state", state);
            var note = row.querySelector("em");
            if (note) {
                note.textContent = detail || HEALTH_LABELS[state] || "Unknown";
            }
        }

        function check() {
            stamp.textContent = "Checking…";
            card.querySelectorAll("[data-hv-health-item]").forEach(function (row) {
                row.setAttribute("data-state", "checking");
            });
            fetch(card.getAttribute("data-url"), { credentials: "same-origin", cache: "no-store" })
                .then(function (response) {
                    return response.json().catch(function () {
                        return {};
                    });
                })
                .then(function (body) {
                    var components = (body.data && body.data.components) || {};
                    var failed = (body.errors && body.errors.components) || {};
                    card.querySelectorAll("[data-hv-health-item]").forEach(function (row) {
                        var name = row.getAttribute("data-hv-health-item");
                        if (failed[name]) {
                            var reason = failed[name].error === "no_workers" ? "No workers running" : "Problem";
                            paint(name, "unhealthy", reason);
                        } else if (components[name] && components[name].response_time_ms !== undefined) {
                            paint(name, "healthy", Math.round(components[name].response_time_ms) + " ms");
                        } else {
                            paint(name, "healthy");
                        }
                    });
                    var now = new Date();
                    stamp.textContent = "Checked at " + String(now.getHours()).padStart(2, "0") + ":" +
                        String(now.getMinutes()).padStart(2, "0");
                })
                .catch(function () {
                    card.querySelectorAll("[data-hv-health-item]").forEach(function (row) {
                        paint(row.getAttribute("data-hv-health-item"), "unknown", "Could not check");
                    });
                    stamp.textContent = "Could not reach the server";
                });
        }

        if (refreshButton) {
            refreshButton.addEventListener("click", check);
        }
        check();
    }

    /* Login: show the password on demand, and warn about Caps Lock before the
       third failed attempt rather than after it. */
    function wireLogin() {
        var password = document.querySelector("[data-hv-password]");
        var reveal = document.querySelector("[data-hv-reveal]");
        var caps = document.querySelector("[data-hv-caps]");
        if (!password) {
            return;
        }
        if (reveal) {
            reveal.addEventListener("click", function () {
                var shown = password.type === "text";
                password.type = shown ? "password" : "text";
                reveal.setAttribute("aria-pressed", shown ? "false" : "true");
                reveal.setAttribute("aria-label", shown ? "Show password" : "Hide password");
                password.focus();
            });
        }
        if (caps) {
            ["keydown", "keyup"].forEach(function (type) {
                password.addEventListener(type, function (event) {
                    caps.hidden = !(event.getModifierState && event.getModifierState("CapsLock"));
                });
            });
        }
    }

    ready(function () {
        wireTheme();
        wireMenu();
        wireUserMenu();
        wirePalette();
        wireMessages();
        wireDateEchoes(document);
        wireLightbox();
        wireHealth();
        wireLogin();
        wireFilters();
        wireSelects(document);
        wireSelectDismiss();
        wireInlineCaptions();
        wireTabs();
        wireKycDesk();

        // A printed report carries its figures table, folded or not.
        window.addEventListener("beforeprint", function () {
            document.querySelectorAll(".hv-data-table").forEach(function (details) {
                details.open = true;
            });
        });

        // A new inline row is cloned from a hidden template after load.
        document.addEventListener("formset:added", function (event) {
            wireDateEchoes(event.target);
            wireSelects(event.target);
        });
    });
})();
