/**
 * Indeed Apply Adapter for Tracky.
 *
 * Key behaviors:
 *  1. On a job listing page, clicking "Easily Apply" or "Apply now" opens a NEW TAB.
 *  2. This adapter detects the click, waits for the new tab, and injects itself there.
 *  3. On the apply page itself (indeedapply.com or /apply/ URL), it fills the form steps.
 */
window.TrackyIndeedAdapter = {
  isApplicable() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    // Match both job listing pages AND the apply flow pages
    return host.includes('indeed.com') || host.includes('indeedapply.com');
  },

  /** Returns true when we're already inside an Indeed apply flow page */
  _isApplyPage() {
    const url = window.location.href;
    return (
      url.includes('/apply') ||
      url.includes('indeedapply.com') ||
      url.includes('/viewjob') === false && document.querySelector('button[data-testid="submit-application"]') !== null
    );
  },

  async apply(profile, mode = 'review_before_submit') {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    // ── Case A: We're already on the multi-step apply form ──────────────────
    if (this._isApplyPage()) {
      return await this._fillApplyForm(profile, mode);
    }

    // ── Case B: We're on a job listing — find the Apply button and click it ──
    overlay.setStatus('Detecting Indeed Apply button...', true);

    // Indeed 2024 selectors (in priority order)
    const applySelectors = [
      // Easily Apply inline button
      '#indeedApplyButton',
      'button[id^="indeedApply"]',
      'button.ia-IndeedApplyButton',
      // "Apply now" / "Easily apply" on listing page (2024 redesign)
      'button[data-testid="job-description-visit-apply"]',
      'button[data-testid="apply-button"]',
      'a[data-testid="apply-button"]',
      '[class*="IndeedApplyButton"]',
      // Generic fallbacks
      'button[aria-label*="Apply"]',
      'a[aria-label*="Apply"]',
    ];

    let applyBtn = null;
    for (const sel of applySelectors) {
      applyBtn = document.querySelector(sel);
      if (applyBtn) break;
    }

    if (!applyBtn) {
      overlay.showError('No Indeed Apply button found (may require external ATS).');
      return false;
    }

    overlay.setStatus('Opening Indeed apply form...', true);

    // Register active session for cross-tab tracking before clicking
    try {
      await chrome.runtime.sendMessage({
        action: 'REGISTER_APPLY_SESSION',
        jobContext: {
          title: document.title,
          company: document.querySelector('.jobsearch-JobInfoHeader-companyName, [data-testid="inlineHeader-companyName"]')?.innerText || 'Indeed Employer',
          url: window.location.href,
          source: 'Indeed'
        }
      });
    } catch (e) {}

    // Listen for new tab before clicking (Indeed opens a new tab)
    const beforeTabIds = await this._getOpenTabIds();
    await cursor.click(applyBtn);

    // Wait up to 6 seconds for a new tab to open
    const newTabUrl = await this._waitForNewTab(beforeTabIds, 6000);

    if (newTabUrl) {
      // New tab opened — send a message to the background to inject into it
      overlay.setStatus('Apply form opened in new tab — injecting auto-filler...', true);
      try {
        chrome.runtime.sendMessage({
          action: 'INJECT_APPLY_FORM',
          profile,
          mode
        });
      } catch (e) {
        // Handled by service worker
      }
      overlay.showSuccess('Apply form opened! Auto-filling in the new tab...');
      return true;
    }

    // No new tab opened — the page either reloaded or rendered an inline form/modal
    await dom.sleep(1200);
    const hasFormElements = document.querySelector('form, [role="dialog"], input:not([type="hidden"]), select, textarea, button[type="submit"]') !== null;
    if (hasFormElements || this._isApplyPage()) {
      return await this._fillApplyForm(profile, mode);
    }

    // Fall back to general AI Navigator to inspect the page
    if (window.TrackyAINavigator) {
      await window.TrackyAINavigator.start({
        title: document.title,
        company: document.querySelector('.jobsearch-JobInfoHeader-companyName, [data-testid="inlineHeader-companyName"]')?.innerText || 'Indeed Employer',
        url: window.location.href,
        source: 'Indeed'
      });
      return true;
    }

    overlay.showError('Could not find apply form. Try clicking Apply manually.');
    return false;
  },

  /** Get all currently open tab IDs via the extension background */
  async _getOpenTabIds() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'GET_ALL_TABS' }, (resp) => {
          resolve(resp?.tabIds || []);
        });
      } catch {
        resolve([]);
      }
    });
  },

  /** Poll for a new tab that wasn't in beforeTabIds */
  async _waitForNewTab(beforeTabIds, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await window.TrackyDOM.sleep(300);
      const newIds = await this._getOpenTabIds();
      const added = newIds.filter((id) => !beforeTabIds.includes(id));
      if (added.length > 0) return added[0];
    }
    return null;
  },

  /** Fill out the multi-step Indeed apply form using Tracky AI Navigator */
  async _fillApplyForm(profile, mode) {
    const overlay = window.TrackyOverlay;
    overlay.setStatus('Analyzing Indeed application form with Tracky AI...', true);

    if (window.TrackyAINavigator) {
      const jobContext = {
        title: document.title,
        company: document.querySelector('.jobsearch-JobInfoHeader-companyName, [data-testid="inlineHeader-companyName"]')?.innerText || 'Indeed Employer',
        url: window.location.href,
        source: 'Indeed'
      };
      await window.TrackyAINavigator.start(jobContext);
      return true;
    }

    overlay.showError('Tracky AI Navigator is not available.');
    return false;
  }
};
