/**
 * Indeed Apply Adapter for Tracky.
 *
 * Key behaviors:
 *  1. On a job listing page, clicking "Easily Apply" or "Apply now" opens a NEW TAB or in-page form.
 *  2. Strictly targets legitimate Apply buttons in the job pane, never notification bell or job alerts.
 *  3. On the apply page itself (indeedapply.com or /apply/ URL), it fills the form steps.
 */
window.TrackyIndeedAdapter = {
  isApplicable() {
    const host = window.location.hostname;
    return host.includes('indeed.com') || host.includes('indeedapply.com');
  },

  /** Returns true when we're already inside an Indeed apply flow page */
  _isApplyPage() {
    const url = window.location.href;
    return (
      url.includes('/apply') ||
      url.includes('indeedapply.com') ||
      (url.includes('/viewjob') === false && document.querySelector('button[data-testid="submit-application"], button[data-testid="IA-ContinueButton"]') !== null)
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

    // Indeed Authentic Apply Selectors (strictly job pane, priority order)
    const applySelectors = [
      '#indeedApplyButton',
      'button[id^="indeedApply"]',
      'button.ia-IndeedApplyButton',
      'button[data-testid="job-description-visit-apply"]',
      'button[data-testid="apply-button"]',
      'a[data-testid="apply-button"]',
      'button[data-testid="viewjob-apply-button"]',
      '[class*="IndeedApplyButton"]',
      '.jobsearch-JobComponent button[aria-label*="Apply" i]:not([aria-label*="filter" i]):not([aria-label*="alert" i])',
      '#viewJobSSRRoot button[aria-label*="Apply" i]:not([aria-label*="filter" i]):not([aria-label*="alert" i])'
    ];

    let applyBtn = null;
    for (const sel of applySelectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      for (const el of candidates) {
        // Exclude header, nav, notification bells, job alerts, search forms, and filter pills
        if (
          el.closest('header, nav, #gnav, #jobsearch, .jobsearch-JobAlert, [data-testid*="jobalert" i], [data-testid*="notification" i], [id*="notification" i]')
        ) {
          continue;
        }

        const label = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase();
        if (label.includes('notification') || label.includes('alert') || label.includes('filter')) {
          continue;
        }

        if (el.offsetParent !== null && !el.disabled) {
          applyBtn = el;
          break;
        }
      }
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
      overlay.setStatus('Apply form opened in new tab — injecting auto-filler...', true);
      try {
        chrome.runtime.sendMessage({
          action: 'INJECT_APPLY_FORM',
          profile,
          mode
        });
      } catch (e) {}
      overlay.showSuccess('Apply form opened! Auto-filling in the new tab...');
      return true;
    }

    // No new tab opened — page reloaded or rendered an inline form/modal
    await dom.sleep(1200);
    const hasFormElements = document.querySelector('form:not(#jobsearch), [role="dialog"], input:not([type="hidden"]), select, textarea, button[type="submit"]') !== null;
    if (hasFormElements || this._isApplyPage()) {
      return await this._fillApplyForm(profile, mode);
    }

    // Fall back to general AI Navigator
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
