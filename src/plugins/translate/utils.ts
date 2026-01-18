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

import { classNameFactory } from "@utils/css";
import { onlyOnce } from "@utils/onlyOnce";
import { PluginNative } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

import { DeeplLanguages, deeplLanguageToGoogleLanguage, GoogleLanguages, KagiLanguages, kagiLanguageToGoogleLanguage } from "./languages";
import { resetLanguageDefaults, settings } from "./settings";

export const cl = classNameFactory("vc-trans-");

const Native = VencordNative.pluginHelpers.Translate as PluginNative<typeof import("./native")>;

interface GoogleData {
    translation: string;
    sourceLanguage: string;
}

interface DeeplData {
    translations: {
        detected_source_language: string;
        text: string;
    }[];
}

interface KagiData {
    translation: string;
    detected_language?: {
        iso: string;
        label: string;
    };
}

export interface TranslationValue {
    sourceLanguage: string;
    text: string;
}

export const getLanguages = () => {
    if (settings.store.service === "google") return GoogleLanguages;
    if (settings.store.service === "kagi") return KagiLanguages;
    if (IS_WEB) return GoogleLanguages; // Fallback for web if somehow set to DeepL
    return DeeplLanguages;
};

export async function translate(kind: "received" | "sent", text: string): Promise<TranslationValue> {
    let translate: (text: string, sourceLang: string, targetLang: string) => Promise<TranslationValue>;

    if (settings.store.service === "google") {
        translate = googleTranslate;
    } else if (settings.store.service === "kagi") {
        translate = kagiTranslate;
    } else if (IS_WEB) {
        // DeepL not supported on web, fallback to Google
        translate = googleTranslate;
    } else {
        translate = deeplTranslate;
    }

    try {
        return await translate(
            text,
            settings.store[`${kind}Input`],
            settings.store[`${kind}Output`]
        );
    } catch (e) {
        const userMessage = typeof e === "string"
            ? e
            : "Something went wrong. If this issue persists, please check the console or ask for help in the support server.";

        showToast(userMessage, Toasts.Type.FAILURE);

        throw e instanceof Error
            ? e
            : new Error(userMessage);
    }
}

async function googleTranslate(text: string, sourceLang: string, targetLang: string): Promise<TranslationValue> {
    const url = "https://translate-pa.googleapis.com/v1/translate?" + new URLSearchParams({
        "params.client": "gtx",
        "dataTypes": "TRANSLATION",
        "key": "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA", // some google API key
        "query.sourceLanguage": sourceLang,
        "query.targetLanguage": targetLang,
        "query.text": text,
    });

    const res = await fetch(url);
    if (!res.ok)
        throw new Error(
            `Failed to translate "${text}" (${sourceLang} -> ${targetLang})`
            + `\n${res.status} ${res.statusText}`
        );

    const { sourceLanguage, translation }: GoogleData = await res.json();

    return {
        sourceLanguage: GoogleLanguages[sourceLanguage] ?? sourceLanguage,
        text: translation
    };
}

function fallbackToGoogle(text: string, sourceLang: string, targetLang: string): Promise<TranslationValue> {
    return googleTranslate(
        text,
        deeplLanguageToGoogleLanguage(sourceLang),
        deeplLanguageToGoogleLanguage(targetLang)
    );
}

const showDeeplApiQuotaToast = onlyOnce(
    () => showToast("Deepl API quota exceeded. Falling back to Google Translate", Toasts.Type.FAILURE)
);

async function deeplTranslate(text: string, sourceLang: string, targetLang: string): Promise<TranslationValue> {
    if (!settings.store.deeplApiKey) {
        showToast("DeepL API key is not set. Resetting to Google", Toasts.Type.FAILURE);

        settings.store.service = "google";
        resetLanguageDefaults();

        return fallbackToGoogle(text, sourceLang, targetLang);
    }

    // CORS jumpscare
    const { status, data } = await Native.makeDeeplTranslateRequest(
        settings.store.service === "deepl-pro",
        settings.store.deeplApiKey,
        JSON.stringify({
            text: [text],
            target_lang: targetLang,
            source_lang: sourceLang.split("-")[0]
        })
    );

    switch (status) {
        case 200:
            break;
        case -1:
            throw "Failed to connect to DeepL API: " + data;
        case 403:
            throw "Invalid DeepL API key or version";
        case 456:
            showDeeplApiQuotaToast();
            return fallbackToGoogle(text, sourceLang, targetLang);
        default:
            throw new Error(`Failed to translate "${text}" (${sourceLang} -> ${targetLang})\n${status} ${data}`);
    }

    const { translations }: DeeplData = JSON.parse(data);
    const src = translations[0].detected_source_language;

    return {
        sourceLanguage: DeeplLanguages[src] ?? src,
        text: translations[0].text
    };
}

function fallbackToGoogleFromKagi(text: string, sourceLang: string, targetLang: string): Promise<TranslationValue> {
    return googleTranslate(
        text,
        kagiLanguageToGoogleLanguage(sourceLang),
        kagiLanguageToGoogleLanguage(targetLang)
    );
}

const showKagiApiQuotaToast = onlyOnce(
    () => showToast("Kagi API quota exceeded. Falling back to Google Translate", Toasts.Type.FAILURE)
);

// Helper to make fetch requests via the extension's content script (bypasses page CSP)
let fetchId = 0;
function extensionFetch(url: string, options: RequestInit): Promise<{ status: number; data: string; }> {
    return new Promise((resolve, reject) => {
        const id = ++fetchId;

        const handler = (event: MessageEvent) => {
            if (event.data?.type !== "vencord:fetch-result" || event.data.id !== id) return;
            window.removeEventListener("message", handler);

            if (event.data.ok) {
                resolve({ status: event.data.status, data: event.data.data });
            } else {
                reject(new Error(event.data.error));
            }
        };

        window.addEventListener("message", handler);
        window.postMessage({
            type: "vencord:fetch",
            id,
            url,
            options: {
                method: options.method,
                headers: options.headers,
                body: options.body
            }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Extension fetch timed out"));
        }, 30000);
    });
}

async function kagiTranslate(text: string, sourceLang: string, targetLang: string): Promise<TranslationValue> {
    if (!settings.store.kagiApiKey) {
        showToast("Kagi API key is not set. Resetting to Google", Toasts.Type.FAILURE);

        settings.store.service = "google";
        resetLanguageDefaults();

        return fallbackToGoogleFromKagi(text, sourceLang, targetLang);
    }

    const payload = JSON.stringify({
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
        skip_definition: true,
        model: settings.store.kagiModel ?? "standard"
    });

    const url = `https://translate.kagi.com/api/translate?token=${encodeURIComponent(settings.store.kagiApiKey)}`;
    const fetchOptions: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: payload
    };

    let status: number;
    let data: string;

    if (IS_WEB) {
        // Use extension's content script to bypass CSP
        try {
            const result = await extensionFetch(url, fetchOptions);
            status = result.status;
            data = result.data;
        } catch (e) {
            throw "Failed to connect to Kagi API: " + String(e);
        }
    } else {
        const result = await Native.makeKagiTranslateRequest(settings.store.kagiApiKey, payload);
        status = result.status;
        data = result.data;
    }

    switch (status) {
        case 200:
            break;
        case -1:
            throw "Failed to connect to Kagi API: " + data;
        case 401:
        case 403:
            throw "Invalid Kagi session token";
        case 429:
            showKagiApiQuotaToast();
            return fallbackToGoogleFromKagi(text, sourceLang, targetLang);
        default:
            throw new Error(`Kagi translation failed (${status}): ${data}`);
    }

    const { translation, detected_language }: KagiData = JSON.parse(data);
    const src = detected_language?.iso ?? sourceLang;

    return {
        sourceLanguage: KagiLanguages[src] ?? detected_language?.label ?? src,
        text: translation
    };
}
