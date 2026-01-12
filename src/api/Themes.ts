/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Settings, SettingsStore } from "@api/Settings";
import { createAndAppendStyle } from "@utils/css";
import { localStorage } from "@utils/localStorage";
import { ThemeStore } from "@vencord/discord-types";
import { PopoutWindowStore } from "@webpack/common";

import { userStyleRootNode, vencordRootNode } from "./Styles";

const THEME_CSS_CACHE_KEY = "VencordThemeCssCache";
const QUICK_CSS_CACHE_KEY = "VencordQuickCssCache";

let style: HTMLStyleElement;
let themesStyle: HTMLStyleElement;

function updateCssCache(key: string, css: string | undefined) {
    if (!IS_WEB || IS_USERSCRIPT) return;
    try {
        if (css) localStorage.setItem(key, css);
        else localStorage.removeItem(key);
    } catch (e) {
        console.error("[Vencord] Failed to update CSS cache:", e);
    }
}

// Inject cached CSS immediately to prevent themes not loading on cold start
if (IS_WEB && !IS_USERSCRIPT) {
    try {
        const cached = [
            localStorage.getItem(THEME_CSS_CACHE_KEY),
            localStorage.getItem(QUICK_CSS_CACHE_KEY)
        ].filter(Boolean).join("\n");

        if (cached) {
            const earlyStyle = document.createElement("style");
            earlyStyle.id = "vencord-themes-early";
            earlyStyle.textContent = cached;
            document.documentElement?.appendChild(earlyStyle);
        }
    } catch (e) {
        console.error("[Vencord] Failed to load cached CSS:", e);
    }
}

async function toggle(isEnabled: boolean) {
    if (!style) {
        if (isEnabled) {
            style = createAndAppendStyle("vencord-custom-css", userStyleRootNode);
            VencordNative.quickCss.addChangeListener(css => {
                style.textContent = css;
                // At the time of writing this, changing textContent resets the disabled state
                style.disabled = !Settings.useQuickCss;
                updatePopoutWindows();
                updateCssCache(QUICK_CSS_CACHE_KEY, css);
            });
            const css = await VencordNative.quickCss.get();
            style.textContent = css;
            updateCssCache(QUICK_CSS_CACHE_KEY, css);
            document.getElementById("vencord-themes-early")?.remove();
        }
    } else
        style.disabled = !isEnabled;
}

async function initThemes() {
    themesStyle ??= createAndAppendStyle("vencord-themes", userStyleRootNode);

    const { themeLinks, enabledThemes } = Settings;

    const { ThemeStore } = require("@webpack/common/stores") as typeof import("@webpack/common/stores");

    // "darker" and "midnight" both count as dark
    // This function is first called on DOMContentLoaded, so ThemeStore may not have been loaded yet
    const activeTheme = ThemeStore == null
        ? undefined
        : ThemeStore.theme === "light" ? "light" : "dark";

    const links = themeLinks
        .map(rawLink => {
            const match = /^@(light|dark) (.*)/.exec(rawLink);
            if (!match) return rawLink;

            const [, mode, link] = match;
            return mode === activeTheme ? link : null;
        })
        .filter(link => link !== null);

    // For web, we inline local theme CSS directly instead of using blob URLs
    // This allows us to cache the CSS in localStorage for instant loading on cold start
    const inlinedCss: string[] = [];

    if (IS_WEB) {
        for (const theme of enabledThemes) {
            const themeData = await VencordNative.themes.getThemeData(theme);
            if (!themeData) continue;
            inlinedCss.push(`/* Theme: ${theme} */\n${themeData}`);
        }
    } else {
        const localThemes = enabledThemes.map(theme => `vencord:///themes/${theme}?v=${Date.now()}`);
        links.push(...localThemes);
    }

    const importCss = links.map(link => `@import url("${link.trim()}");`).join("\n");
    const fullCss = importCss + (inlinedCss.length ? "\n" + inlinedCss.join("\n") : "");

    themesStyle.textContent = fullCss;

    updateCssCache(THEME_CSS_CACHE_KEY, inlinedCss.length ? inlinedCss.join("\n") : undefined);
    document.getElementById("vencord-themes-early")?.remove();

    updatePopoutWindows();
}

function applyToPopout(popoutWindow: Window | undefined, key: string) {
    if (!popoutWindow?.document) return;
    // skip game overlay cuz it needs to stay transparent, themes broke it
    if (key === "DISCORD_OutOfProcessOverlay") return;

    const doc = popoutWindow.document;

    doc.querySelector("vencord-root")?.remove();

    doc.documentElement.appendChild(vencordRootNode.cloneNode(true));
}

function updatePopoutWindows() {
    if (!PopoutWindowStore) return;

    for (const key of PopoutWindowStore.getWindowKeys()) {
        applyToPopout(PopoutWindowStore.getWindow(key), key);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (IS_USERSCRIPT) return;

    initThemes();

    toggle(Settings.useQuickCss);
    SettingsStore.addChangeListener("useQuickCss", toggle);

    SettingsStore.addChangeListener("themeLinks", initThemes);
    SettingsStore.addChangeListener("enabledThemes", initThemes);

    window.addEventListener("message", event => {
        const { discordPopoutEvent } = event.data || {};
        if (discordPopoutEvent?.type !== "loaded") return;

        applyToPopout(PopoutWindowStore.getWindow(discordPopoutEvent.key), discordPopoutEvent.key);
    });

    if (!IS_WEB) {
        VencordNative.quickCss.addThemeChangeListener(initThemes);
    }
}, { once: true });

export function initQuickCssThemeStore(themeStore: ThemeStore) {
    if (IS_USERSCRIPT) return;

    initThemes();

    let currentTheme = themeStore.theme;
    themeStore.addChangeListener(() => {
        if (currentTheme === themeStore.theme) return;

        currentTheme = themeStore.theme;
        initThemes();
    });
}
