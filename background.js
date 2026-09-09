// Compute and push tab numbers (1-based position in window) to each tab's content script.
async function renumberWindow(windowId) {
  if (windowId === undefined || windowId < 0) return;
  let tabs;
  try {
    tabs = await chrome.tabs.query({ windowId });
  } catch (e) {
    return;
  }
  tabs.sort((a, b) => a.index - b.index);
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    chrome.tabs.sendMessage(tab.id, { type: "set-tab-number", number: tab.index + 1 }, () => {
      // Swallow "receiving end does not exist" errors for pages without our
      // content script (chrome:// pages, the Web Store, PDFs, etc.)
      void chrome.runtime.lastError;
    });
  }
}

async function renumberAllWindows() {
  const windows = await chrome.windows.getAll();
  for (const w of windows) {
    await renumberWindow(w.id);
  }
}

chrome.runtime.onInstalled.addListener(renumberAllWindows);
chrome.runtime.onStartup.addListener(renumberAllWindows);

chrome.tabs.onCreated.addListener((tab) => renumberWindow(tab.windowId));
chrome.tabs.onRemoved.addListener((tabId, info) => renumberWindow(info.windowId));
chrome.tabs.onMoved.addListener((tabId, info) => renumberWindow(info.windowId));
chrome.tabs.onAttached.addListener((tabId, info) => renumberWindow(info.newWindowId));
chrome.tabs.onDetached.addListener((tabId, info) => renumberWindow(info.oldWindowId));
chrome.tabs.onReplaced.addListener(async (addedTabId) => {
  const tab = await chrome.tabs.get(addedTabId);
  renumberWindow(tab.windowId);
});
// Re-push the number whenever a tab finishes (re)loading, since navigation
// reloads the content script and it loses its previously assigned number.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    renumberWindow(tab.windowId);
  }
});

// Reply to a content script asking for its own tab's number directly
// (covers the brief window right after the script loads, before any
// tab event fires).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "get-tab-number" && sender.tab) {
    sendResponse({ number: sender.tab.index + 1 });
  }
  return true;
});
