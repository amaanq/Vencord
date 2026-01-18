/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    receivedInput: {
        type: OptionType.STRING,
        description: "Language that received messages should be translated from",
        default: "auto",
        hidden: true
    },
    receivedOutput: {
        type: OptionType.STRING,
        description: "Language that received messages should be translated to",
        default: "en",
        hidden: true
    },
    sentInput: {
        type: OptionType.STRING,
        description: "Language that your own messages should be translated from",
        default: "auto",
        hidden: true
    },
    sentOutput: {
        type: OptionType.STRING,
        description: "Language that your own messages should be translated to",
        default: "en",
        hidden: true
    },

    service: {
        type: OptionType.SELECT,
        description: IS_WEB ? "Translation service (DeepL not supported on Web)" : "Translation service",
        disabled: () => false,
        options: IS_WEB
            ? [
                { label: "Google Translate", value: "google", default: true },
                { label: "Kagi Translate", value: "kagi" }
            ] as const
            : [
                { label: "Google Translate", value: "google", default: true },
                { label: "DeepL Free", value: "deepl" },
                { label: "DeepL Pro", value: "deepl-pro" },
                { label: "Kagi Translate", value: "kagi" }
            ] as const,
        onChange: resetLanguageDefaults
    },
    deeplApiKey: {
        type: OptionType.STRING,
        description: "DeepL API key",
        default: "",
        placeholder: "Get your API key from https://deepl.com/your-account",
        disabled: () => IS_WEB
    },
    kagiApiKey: {
        type: OptionType.STRING,
        description: "Kagi session token (from Session Link in account settings)",
        default: "",
        placeholder: "Get token from kagi.com/settings/user_details → Session Link"
    },
    kagiModel: {
        type: OptionType.SELECT,
        description: "Kagi translation model",
        options: [
            { label: "Standard (faster)", value: "standard", default: true },
            { label: "Best (higher quality)", value: "best" }
        ] as const
    },
    autoTranslate: {
        type: OptionType.BOOLEAN,
        description: "Automatically translate your messages before sending. You can also shift/right click the translate button to toggle this",
        default: false
    },
    showAutoTranslateTooltip: {
        type: OptionType.BOOLEAN,
        description: "Show a tooltip on the ChatBar button whenever a message is automatically translated",
        default: true
    },
}).withPrivateSettings<{
    showAutoTranslateAlert: boolean;
}>();

export function resetLanguageDefaults() {
    if (IS_WEB || settings.store.service === "google" || settings.store.service === "kagi") {
        settings.store.receivedInput = "auto";
        settings.store.receivedOutput = "en";
        settings.store.sentInput = "auto";
        settings.store.sentOutput = "en";
    } else {
        // DeepL
        settings.store.receivedInput = "";
        settings.store.receivedOutput = "en-us";
        settings.store.sentInput = "";
        settings.store.sentOutput = "en-us";
    }
}
