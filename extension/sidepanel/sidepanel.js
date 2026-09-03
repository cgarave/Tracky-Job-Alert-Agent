/**
 * Tracky Chrome Extension Side Panel Controller.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const connectionBadge = document.getElementById('connection-badge');
  const activeTabTitle = document.getElementById('active-tab-title');
  const applyActiveBtn = document.getElementById('apply-active-btn');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  const ghostCursorToggle = document.getElementById('ghost-cursor-toggle');
  const modeRadios = document.querySelectorAll('input[name="app_mode"]');

  // 1. Check Tracky Local Server Status
  async function checkServer() {
    try {
      const resp = await fetch('http://127.0.0.1:5050/api/status');
      if (resp.ok) {
        connectionBadge.className = 'badge-online';
        connectionBadge.textContent = '🟢 Server Online';
      } else {
        throw new Error('Server returned non-200');
      }
    } catch {
      connectionBadge.className = 'badge-offline';
      connectionBadge.textContent = '🛑 Offline (Tracky Stopped)';
    }
  }

  await checkServer();
  setInterval(checkServer, 8000);

  // 2. Detect Active Tab
  async function updateActiveTabInfo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const url = tab.url.toLowerCase();
    const isSupported =
      url.includes('linkedin.com') ||
      url.includes('onlinejobs.ph') ||
      url.includes('indeed.com') ||
      url.includes('jobstreet.com') ||
      url.includes('seek.com');

    if (isSupported) {
      activeTabTitle.textContent = `🎯 ${tab.title || 'Job Listing Page'}`;
      applyActiveBtn.disabled = false;
    } else {
      activeTabTitle.textContent = 'Navigate to LinkedIn, OnlineJobs, Indeed, or JobStreet';
      applyActiveBtn.disabled = true;
    }
  }

  await updateActiveTabInfo();
  chrome.tabs.onActivated.addListener(updateActiveTabInfo);
  chrome.tabs.onUpdated.addListener(updateActiveTabInfo);

  // 3. Trigger Auto-Apply on Active Tab
  applyActiveBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    applyActiveBtn.disabled = true;
    applyActiveBtn.textContent = '⚡ Starting AI Auto-Apply...';

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTO_APPLY' });
      setTimeout(() => {
        applyActiveBtn.disabled = false;
        applyActiveBtn.textContent = '⚡ Auto-Apply to This Job';
      }, 3000);
    } catch (e) {
      console.warn('Failed to message content script:', e);
      applyActiveBtn.disabled = false;
      applyActiveBtn.textContent = '⚡ Auto-Apply to This Job';
    }
  });

  // 4. Open Web Dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://127.0.0.1:5050' });
  });

  // 5. Load / Save Preferences
  const { ghostCursor = true, appMode = 'review_before_submit' } = await chrome.storage.local.get([
    'ghostCursor',
    'appMode'
  ]);

  ghostCursorToggle.checked = ghostCursor;
  modeRadios.forEach((r) => {
    if (r.value === appMode) r.checked = true;
    r.addEventListener('change', async () => {
      await chrome.storage.local.set({ appMode: r.value });
    });
  });

  ghostCursorToggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ ghostCursor: ghostCursorToggle.checked });
  });
});
