// Background service worker for MV3 - handles fetch requests to bypass CORS
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "vencord:fetch") return false;

    const { url, options } = message;

    fetch(url, options)
        .then(async res => {
            const data = await res.text();
            sendResponse({ ok: true, status: res.status, data });
        })
        .catch(e => {
            sendResponse({ ok: false, error: String(e) });
        });

    // Return true to indicate we'll respond asynchronously
    return true;
});
