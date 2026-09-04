/**
 * Tracky Chrome Extension Background Service Worker (Manifest V3).
 * Full Browser Tab Controller & Autonomous Vision AI Orchestrator.
 */

let batchSessionRunning = false;
let currentBatchTabId = null;

// Helpers to persist cross-tab application session across MV3 service worker suspensions
async function getActiveSession() {
  try {
    const res = await chrome.storage.local.get('activeApplySession');
    return res.activeApplySession || null;
  } catch {
    return null;
  }
}

async function setActiveSession(session) {
  try {
    if (!session) {
      await chrome.storage.local.remove('activeApplySession');
    } else {
      await chrome.storage.local.set({ activeApplySession: session });
    }
  } catch (e) {
    console.warn('[Tracky ServiceWorker] Failed to save session:', e);
  }
}

// Enable opening side panel when extension action icon is clicked
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 1. Listen for new navigation targets created directly by links/buttons (e.g. window.open, target="_blank")
if (chrome.webNavigation && chrome.webNavigation.onCreatedNavigationTarget) {
  chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
    const session = await getActiveSession();
    if (session && session.isNavigating) {
      if (session.parentTabId === details.sourceTabId || session.childTabId === details.sourceTabId) {
        console.log(`[Tracky Cross-Tab] webNavigation target tab #${details.tabId} spawned from tab #${details.sourceTabId}`);
        session.childTabId = details.tabId;
        await setActiveSession(session);
        try {
          await chrome.tabs.update(details.tabId, { active: true });
        } catch (e) {}
      }
    }
  });
}

// 2. Fallback tab creation listener
chrome.tabs.onCreated.addListener(async (tab) => {
  const session = await getActiveSession();
  if (session && session.isNavigating) {
    // If tab opener matches parent or child, or if childTabId not yet bound
    if (!session.childTabId || tab.openerTabId === session.parentTabId || tab.openerTabId === session.childTabId) {
      console.log(`[Tracky Cross-Tab] Detected new tab #${tab.id} opened from apply action.`);
      session.childTabId = tab.id;
      await setActiveSession(session);
      try {
        await chrome.tabs.update(tab.id, { active: true });
      } catch (e) {}
    }
  }
});

// 3. Watch for tab loading complete to auto-continue cross-tab and same-tab navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const session = await getActiveSession();
    // Check if session is navigating and tab is either the newly opened child tab or the reloaded parent tab
    if (session && session.isNavigating && (session.childTabId === tabId || session.parentTabId === tabId)) {
      console.log(`[Tracky Session] Tab #${tabId} loaded (${tab.url || 'current'}). Auto-continuing AI co-pilot.`);
      await injectTrackyScripts(tabId);

      // Resume AI Navigation in the tab after brief DOM hydration
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'TRIGGER_AUTO_APPLY',
            jobContext: session.jobContext,
            crossTab: session.childTabId === tabId,
            resumed: true
          });
        } catch (err) {
          console.log('[Tracky Session] Trigger sent or waiting for listener:', err?.message);
        }
      }, 1000);
    }
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

  // 2. Query all open browser tabs (supports both GET_ALL_TABS and GET_TAB_IDS)
  if (message.action === 'GET_ALL_TABS' || message.action === 'GET_TAB_IDS') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({});
        sendResponse({
          tabIds: tabs.map(t => t.id),
          tabs: tabs.map(t => ({
            id: t.id,
            title: t.title || 'Untitled',
            url: t.url || '',
            active: t.active,
            windowId: t.windowId
          }))
        });
      } catch (e) {
        sendResponse({ tabIds: [], tabs: [] });
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
    (async () => {
      const session = {
        parentTabId: sender.tab?.id || message.tabId,
        childTabId: message.childTabId || null,
        isNavigating: true,
        jobContext: message.jobContext || {},
        timestamp: Date.now()
      };
      await setActiveSession(session);
      sendResponse({ status: 'registered' });
    })();
    return true;
  }

  if (message.action === 'CLEAR_APPLY_SESSION') {
    (async () => {
      await setActiveSession(null);
      sendResponse({ status: 'cleared' });
    })();
    return true;
  }

  if (message.action === 'GET_APPLY_SESSION') {
    (async () => {
      const session = await getActiveSession();
      sendResponse({ session });
    })();
    return true;
  }

  if (message.action === 'INJECT_APPLY_FORM') {
    (async () => {
      const session = await getActiveSession();
      const targetTabId = session?.childTabId || message.tabId;
      if (targetTabId) {
        await injectTrackyScripts(targetTabId);
        chrome.tabs.sendMessage(targetTabId, {
          action: 'TRIGGER_AUTO_APPLY',
          jobContext: session?.jobContext || {},
          profile: message.profile,
          mode: message.mode,
          crossTab: true
        }).catch(() => {});
      }
      sendResponse({ status: 'injected' });
    })();
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

  // 9. Fetch and cache AI settings (bypasses page CSP and mixed-content restrictions)
  if (message.action === 'GET_AI_SETTINGS') {
    (async () => {
      try {
        const resp = await fetch('http://127.0.0.1:5050/api/ai/session-settings');
        if (resp.ok) {
          const data = await resp.json();
          const settings = data.ai_settings || data;
          await chrome.storage.local.set({ ai_settings: settings });
          sendResponse({ settings });
          return;
        }
      } catch (e) {}
      const cached = await chrome.storage.local.get(['ai_settings']);
      sendResponse({ settings: cached.ai_settings || { enable_ghost_cursor: false } });
    })();
    return true;
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

// ── Dashboard Session Sync ───────────────────────────────────────────────────
// Automatically detects when the user starts an AI Batch Session from the Web Dashboard
setInterval(async () => {
  try {
    const resp = await fetch('http://127.0.0.1:5050/api/ai/session/status');
    if (resp.ok) {
      const state = await resp.json();
      if (state.active && !state.paused && !batchSessionRunning && state.mode === 'batch') {
        console.log('[Tracky Batch] Detected active batch session from dashboard. Launching loop.');
        batchSessionRunning = true;
        await runBatchSessionLoop();
      } else if (!state.active && batchSessionRunning) {
        batchSessionRunning = false;
        if (currentBatchTabId) {
          try {
            await chrome.tabs.remove(currentBatchTabId);
          } catch (e) {}
          currentBatchTabId = null;
        }
      }
    }
  } catch (e) {
    // Backend offline or unreachable
  }
}, 3500);
