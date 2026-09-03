/**
 * Tracky Chrome Extension Background Service Worker (Manifest V3).
 */

// Enable opening side panel when extension action icon is clicked
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle incoming messages from dashboard or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_JOB_TAB') {
    (async () => {
      const tab = await chrome.tabs.create({ url: message.url, active: true });
      sendResponse({ status: 'opened', tabId: tab.id });
    })();
    return true; // Keep channel open
  }

  if (message.action === 'CHECK_CONNECTION') {
    (async () => {
      try {
        const resp = await fetch('http://127.0.0.1:5050/api/status');
        sendResponse({ online: resp.ok });
      } catch {
        sendResponse({ online: false });
      }
    })();
    return true;
  }
});
