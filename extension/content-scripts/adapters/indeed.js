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
        // If messaging fails, the new tab's content script will self-detect via _isApplyPage()
      }
      overlay.showSuccess('Apply form opened! Auto-filling in the new tab...');
      return true;
    }

    // No new tab — the form may be inline (modal/iframe on the same page)
    await dom.sleep(1500);
    const inlineForm = document.querySelector('.ia-BasePage, .ia-container, [class*="applyContainer"]');
    if (inlineForm) {
      return await this._fillApplyForm(profile, mode);
    }

    overlay.showError('Could not find apply form. Try clicking Apply manually.');
    return false;
  },

  /** Get all currently open tab IDs via the extension background */
  async _getOpenTabIds() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'GET_TAB_IDS' }, (resp) => {
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

  /** Fill out the multi-step Indeed apply form */
  async _fillApplyForm(profile, mode) {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    let stepCount = 0;
    while (stepCount < 10) {
      stepCount++;
      overlay.setStatus(`Filling Indeed step ${stepCount}...`, true);
      await dom.sleep(800);

      // Fill text inputs
      const textInputs = document.querySelectorAll(
        'input[type="text"]:not([readonly]), input[type="tel"]:not([readonly]), ' +
        'input[type="email"]:not([readonly]), input[type="number"]:not([readonly]), ' +
        'textarea:not([readonly])'
      );
      for (const input of textInputs) {
        if (input.value || input.closest('[aria-hidden="true"]')) continue;
        const label =
          input.closest('div[class]')?.querySelector('label')?.innerText ||
          input.getAttribute('aria-label') ||
          input.getAttribute('placeholder') || '';
        const labelLower = label.toLowerCase();

        if (labelLower.includes('phone') && profile.phone) {
          await cursor.type(input, profile.phone);
        } else if ((labelLower.includes('year') || labelLower.includes('experience')) && profile.years_of_experience) {
          await cursor.type(input, String(profile.years_of_experience));
        } else if (labelLower.includes('salary') || labelLower.includes('compensation')) {
          const salary = profile.screening_defaults?.expected_salary_monthly_php || '80000';
          await cursor.type(input, String(salary));
        } else if (label) {
          const answers = await window.TrackyAPI.answerForm(
            [{ question_id: input.id || label, question: label }],
            { title: document.title, url: window.location.href }
          );
          if (answers && answers[0]?.answer) {
            await cursor.type(input, answers[0].answer);
          }
        }
      }

      // Handle radio/checkbox questions
      const fieldsets = document.querySelectorAll('fieldset');
      for (const fs of fieldsets) {
        const legend = fs.querySelector('legend')?.innerText?.toLowerCase() || '';
        const radios = fs.querySelectorAll('input[type="radio"]');
        if (radios.length > 0 && ![...radios].some((r) => r.checked)) {
          if (legend.includes('authorized') || legend.includes('commute') || legend.includes('relocate')) {
            const yes = [...radios].find((r) => (r.nextElementSibling?.innerText || r.value || '').toLowerCase().includes('yes'));
            if (yes) await cursor.click(yes);
          } else if (legend.includes('sponsor') || legend.includes('visa')) {
            const no = [...radios].find((r) => (r.nextElementSibling?.innerText || r.value || '').toLowerCase().includes('no'));
            if (no) await cursor.click(no);
          } else {
            await cursor.click(radios[0]);
          }
        }
      }

      // Selects
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        if (sel.value || sel.closest('[aria-hidden="true"]')) continue;
        if (sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Look for navigation buttons
      const submitBtn = document.querySelector(
        'button[type="submit"][data-testid="submit-application"], ' +
        'button[data-testid="IA-SubmitButton"], ' +
        'button.ia-SubmitButton, ' +
        'button[aria-label*="Submit"]'
      );
      const continueBtn = document.querySelector(
        'button[data-testid="IA-ContinueButton"], ' +
        'button.ia-continueButton, ' +
        'button[data-testid="continue-button"], ' +
        'button[aria-label*="Continue"]'
      );
      const nextBtn = document.querySelector(
        'button[data-testid="IA-next"], button[aria-label*="Next"]'
      );

      if (submitBtn) {
        if (mode === 'review_before_submit') {
          overlay.showSuccess('Ready! Review your application and click Submit.');
          await cursor.moveTo(submitBtn);
          return true;
        } else {
          overlay.setStatus('Submitting application...', true);
          await cursor.click(submitBtn);
          await dom.sleep(2000);
          overlay.showSuccess('Submitted via Indeed Apply!');
          await window.TrackyAPI.recordApplication({
            title: document.title,
            company: 'Indeed Employer',
            url: window.location.href,
            source: 'Indeed.ph',
            status: 'applied',
            mode: 'full_auto'
          });
          return true;
        }
      } else if (continueBtn) {
        await cursor.click(continueBtn);
        await dom.sleep(1200);
      } else if (nextBtn) {
        await cursor.click(nextBtn);
        await dom.sleep(1200);
      } else {
        break;
      }
    }
    return true;
  }
};
