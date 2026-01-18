chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { command });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openShortcuts") {
    chrome.tabs.create({ url: "about://extensions/shortcuts" });
  }
});

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
