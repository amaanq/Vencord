if (typeof browser === "undefined") {
    var browser = chrome;
}

// Listen for fetch requests from the main world, forward to background worker (bypasses CORS)
window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "vencord:fetch") return;

    const { id, url, options } = event.data;

    try {
        // Forward to background service worker which has no CORS restrictions
        const response = await browser.runtime.sendMessage({
            type: "vencord:fetch",
            url,
            options
        });

        if (response.ok) {
            window.postMessage({
                type: "vencord:fetch-result",
                id,
                ok: true,
                status: response.status,
                data: response.data
            });
        } else {
            window.postMessage({
                type: "vencord:fetch-result",
                id,
                ok: false,
                error: response.error
            });
        }
    } catch (e) {
        window.postMessage({
            type: "vencord:fetch-result",
            id,
            ok: false,
            error: String(e)
        });
    }
});

document.addEventListener(
    "DOMContentLoaded",
    () => {
        window.postMessage({
            type: "vencord:meta",
            meta: {
                EXTENSION_VERSION: browser.runtime.getManifest().version,
                EXTENSION_BASE_URL: browser.runtime.getURL(""),
                RENDERER_CSS_URL: browser.runtime.getURL("dist/Vencord.css"),
            }
        });
    },
    { once: true }
);
