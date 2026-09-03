/**
 * Tracky Chrome Extension Background Service Worker (Manifest V3).
 * Full Browser Tab Controller & Autonomous Vision AI Orchestrator.
 */

let batchSessionRunning = false;
let currentBatchTabId = null;
let activeApplySession = null; // Tracks cross-tab session { parentTabId, childTabId, jobContext, history }

// Enable opening side panel when extension action icon is clicked
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Watch for any new tab opened (e.g. clicking "Apply on company site")
chrome.tabs.onCreated.addListener(async (tab) => {
  if (activeApplySession && activeApplySession.isNavigating) {
    activeApplySession.childTabId = tab.id;
    console.log(`[Tracky Cross-Tab] Detected new tab #${tab.id} opened from apply action.`);
    
    // Automatically bring new tab into focus
    try {
      await chrome.tabs.update(tab.id, { active: true });
    } catch (e) {}
  }
});

// Watch for tab loading complete to auto-continue cross-tab navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && activeApplySession && activeApplySession.childTabId === tabId) {
    console.log(`[Tracky Cross-Tab] New tab #${tabId} loaded. Injecting AI co-pilot.`);
    await injectTrackyScripts(tabId);
    
    // Resume AI Navigation in the new tab after brief hydration
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: 'TRIGGER_AUTO_APPLY',
        jobContext: activeApplySession.jobContext,
        crossTab: true
      }).catch(() => {});
    }, 1200);
  }
});

// Handle incoming messages from content scripts, dashboard, or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // 1. Capture tab screenshot for Vision AI perception
  if (message.action === 'CAPTURE_SCREENSHOT') {
    (async () => {
      try {
        const windowId = sender.tab?.windowId || chrome.windows.WINDOW_ID_CURRENT;
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        sendResponse({ dataUrl });
      } catch (err) {
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
          sendResponse({ dataUrl });
        } catch (fallbackErr) {
          console.warn('[Tracky ServiceWorker] captureVisibleTab failed:', err?.message || fallbackErr?.message);
          sendResponse({ dataUrl: null, error: err?.message || fallbackErr?.message || 'Capture failed' });
        }
      }
    })();
    return true;
  }

  // 2. Query all open browser tabs
  if (message.action === 'GET_ALL_TABS') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({});
        sendResponse({
          tabs: tabs.map(t => ({
            id: t.id,
            title: t.title || 'Untitled',
            url: t.url || '',
            active: t.active,
            windowId: t.windowId
          }))
        });
      } catch (e) {
        sendResponse({ tabs: [] });
      }
    })();
    return true;
  }

  // 3. Switch active tab
  if (message.action === 'SWITCH_TAB') {
    (async () => {
      try {
        if (message.tabId) {
          await chrome.tabs.update(message.tabId, { active: true });
          sendResponse({ status: 'switched' });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  // 4. Open a new tab
  if (message.action === 'OPEN_JOB_TAB') {
    (async () => {
      const tab = await chrome.tabs.create({ url: message.url, active: true });
      sendResponse({ status: 'opened', tabId: tab.id });
    })();
    return true;
  }

  // 5. Close a tab
  if (message.action === 'CLOSE_TAB') {
    (async () => {
      try {
        const tabId = message.tabId || sender.tab?.id;
        if (tabId) {
          await chrome.tabs.remove(tabId);
          sendResponse({ status: 'closed' });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  // 6. Register active application session for cross-tab tracking
  if (message.action === 'REGISTER_APPLY_SESSION') {
    activeApplySession = {
      parentTabId: sender.tab?.id,
      childTabId: null,
      isNavigating: true,
      jobContext: message.jobContext || {}
    };
    sendResponse({ status: 'registered' });
    return true;
  }

  if (message.action === 'CLEAR_APPLY_SESSION') {
    activeApplySession = null;
    sendResponse({ status: 'cleared' });
    return true;
  }

  // 7. Check local backend connection
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

  // 8. Batch Session Trigger & Orchestration
  if (message.action === 'START_BATCH_SESSION') {
    (async () => {
      batchSessionRunning = true;
      await runBatchSessionLoop();
      sendResponse({ status: 'started' });
    })();
    return true;
  }

  if (message.action === 'STOP_BATCH_SESSION') {
    batchSessionRunning = false;
    if (currentBatchTabId) {
      try {
        chrome.tabs.remove(currentBatchTabId);
      } catch (e) {}
      currentBatchTabId = null;
    }
    sendResponse({ status: 'stopped' });
    return true;
  }

  if (message.action === 'JOB_APPLY_COMPLETED') {
    activeApplySession = null;
    if (batchSessionRunning && sender.tab?.id === currentBatchTabId) {
      setTimeout(async () => {
        try {
          if (currentBatchTabId) {
            await chrome.tabs.remove(currentBatchTabId);
            currentBatchTabId = null;
          }
        } catch (e) {}
        if (batchSessionRunning) {
          await runBatchSessionLoop();
        }
      }, 2500);
    }
  }
});

/**
 * Injects Tracky companion and AI scripts into any target tab.
 */
async function injectTrackyScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'lib/dom-utils.js',
        'lib/api-bridge.js',
        'content-scripts/ghost-cursor.js',
        'content-scripts/overlay.js',
        'content-scripts/adapters/linkedin.js',
        'content-scripts/adapters/onlinejobs.js',
        'content-scripts/adapters/indeed.js',
        'content-scripts/adapters/jobstreet.js',
        'content-scripts/form-schema-extractor.js',
        'content-scripts/ai-navigator.js',
        'content-scripts/form-detector.js'
      ]
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content-scripts/ghost-cursor.css', 'content-scripts/overlay.css']
    });
  } catch (e) {
    console.warn(`[Tracky ServiceWorker] Script injection skipped for tab #${tabId}:`, e.message);
  }
}

/**
 * Batch application orchestrator.
 */
async function runBatchSessionLoop() {
  if (!batchSessionRunning) return;

  try {
    const resp = await fetch('http://127.0.0.1:5050/api/ai/session/next-job');
    if (!resp.ok) {
      batchSessionRunning = false;
      return;
    }
    const data = await resp.json();
    const job = data.job;

    if (!job || !job.url) {
      console.log('[Tracky Batch] No more pending matching jobs found.');
      batchSessionRunning = false;
      await fetch('http://127.0.0.1:5050/api/ai/session/stop', { method: 'POST' });
      return;
    }

    const tab = await chrome.tabs.create({ url: job.url, active: true });
    currentBatchTabId = tab.id;

    await new Promise((r) => setTimeout(r, 4000));
    await injectTrackyScripts(tab.id);

    await new Promise((r) => setTimeout(r, 1000));
    await chrome.tabs.sendMessage(tab.id, {
      action: 'TRIGGER_AUTO_APPLY',
      jobContext: {
        title: job.title,
        company: job.company,
        url: job.url,
        source: job.source
      }
    });

  } catch (err) {
    console.error('[Tracky Batch] Error in batch loop:', err);
    batchSessionRunning = false;
  }
}
