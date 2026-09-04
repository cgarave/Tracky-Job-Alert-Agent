/**
 * LinkedIn Easy Apply Adapter for Tracky.
 *
 * LinkedIn Easy Apply opens a slide-in modal drawer on the right side of the page.
 * The adapter clicks the Easy Apply button, fills known profile information, and
 * pauses cleanly for user intervention when encountering unfamiliar screening questions.
 */
window.TrackyLinkedInAdapter = {
  isApplicable() {
    return window.location.hostname.includes('linkedin.com');
  },

  /** Find the Easy Apply button or external Apply button across modern LinkedIn variations */
  findApplyButton() {
    // 1. Check known selector patterns
    const selectors = [
      '.jobs-apply-button--top-card button',
      'button.jobs-apply-button',
      '.jobs-apply-button',
      'button[data-job-id] .jobs-apply-button',
      'div.jobs-s-apply button',
      'button[aria-label*="Easy Apply" i]',
      'button[aria-label*="easy apply" i]',
      '.jobs-unified-top-card__content--two-pane .jobs-apply-button',
      'button[data-control-name="jobdetails_topcard_inapply"]',
      'button[data-control-name="jobdetails_topcard_easy_apply"]',
      '.job-details-jobs-unified-top-card__primary-description-container + div button'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && !el.disabled) {
        return { element: el, isEasyApply: this._isElementEasyApply(el) };
      }
    }

    // 2. Scan all visible buttons for "Easy Apply" text
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    const easyApplyBtn = buttons.find((b) => {
      const txt = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return txt.includes('easy apply') && !b.disabled && b.offsetParent !== null;
    });

    if (easyApplyBtn) {
      return { element: easyApplyBtn, isEasyApply: true };
    }

    // 3. Check for external "Apply" link/button (redirects to Workday, Greenhouse, etc.)
    const applyBtn = buttons.find((b) => {
      const txt = (b.innerText || b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return (txt === 'apply' || txt.includes('apply on')) && !b.disabled && b.offsetParent !== null;
    });

    if (applyBtn) {
      return { element: applyBtn, isEasyApply: false };
    }

    return null;
  },

  _isElementEasyApply(el) {
    const txt = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
    return txt.includes('easy apply');
  },

  async apply(profile, mode = 'review_before_submit') {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    overlay.setStatus('Detecting LinkedIn Apply button...', true);

    const match = this.findApplyButton();
    if (!match) {
      overlay.showError('No LinkedIn Apply button detected on this page.');
      return false;
    }

    const { element: applyBtn, isEasyApply } = match;

    // If external ATS apply, register cross-tab session so Tracky follows into the new tab
    if (!isEasyApply) {
      overlay.setStatus('External ATS application detected. Opening application tab...', true);
      try {
        await chrome.runtime.sendMessage({
          action: 'REGISTER_APPLY_SESSION',
          jobContext: {
            title: document.title,
            company: document.querySelector('.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name')?.innerText || 'LinkedIn Employer',
            url: window.location.href,
            source: 'LinkedIn External'
          }
        });
      } catch (e) {}

      await cursor.click(applyBtn);
      overlay.showSuccess('External ATS opened in new tab. Tracky will continue there!');
      return true;
    }

    // Register apply session for in-page Easy Apply modal
    try {
      await chrome.runtime.sendMessage({
        action: 'REGISTER_APPLY_SESSION',
        jobContext: {
          title: document.title,
          company: document.querySelector('.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name')?.innerText || 'LinkedIn Employer',
          url: window.location.href,
          source: 'LinkedIn Easy Apply'
        }
      });
    } catch (e) {}

    await cursor.click(applyBtn);

    // Wait for the Easy Apply modal drawer
    overlay.setStatus('Waiting for Easy Apply modal...', true);
    const modal = await dom.waitForElement(
      '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-content',
      8000
    );

    if (!modal) {
      overlay.showError('Easy Apply modal did not open. Try clicking Apply manually.');
      return false;
    }

    // Modal opened — delegate multi-step questions to Tracky AI Navigator
    overlay.setStatus('Analyzing LinkedIn Easy Apply questions with Tracky AI...', true);
    if (window.TrackyAINavigator) {
      await window.TrackyAINavigator.start({
        title: document.title,
        company: document.querySelector('.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name')?.innerText || 'LinkedIn Employer',
        url: window.location.href,
        source: 'LinkedIn Easy Apply'
      });
      return true;
    }

    return true;
  }
};
