/**
 * LinkedIn Easy Apply Adapter for Tracky.
 *
 * LinkedIn Easy Apply opens a slide-in modal drawer on the right side of the page.
 * The adapter clicks the Easy Apply button, then fills each modal step until Submit.
 */
window.TrackyLinkedInAdapter = {
  isApplicable() {
    return window.location.hostname.includes('linkedin.com');
  },

  async apply(profile, mode = 'review_before_submit') {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    overlay.setStatus('Detecting Easy Apply button...', true);

    // LinkedIn 2024 Easy Apply button selectors
    const applySelectors = [
      'button.jobs-apply-button--top-card',
      'button[data-control-name="jobdetails_topcard_inapply"]',
      '.jobs-apply-button',
      'button[aria-label*="Easy Apply"]',
      'button[aria-label*="easy apply"]',
      // Fallback for job card view
      '.jobs-unified-top-card__content--two-pane .jobs-apply-button',
    ];

    let applyBtn = null;
    for (const sel of applySelectors) {
      applyBtn = document.querySelector(sel);
      if (applyBtn) break;
    }

    if (!applyBtn) {
      overlay.showError('No Easy Apply button found (Direct application or unsupported ATS).');
      return false;
    }

    await cursor.click(applyBtn);

    // Wait for the Easy Apply modal to appear
    overlay.setStatus('Waiting for Easy Apply modal...', true);
    const modal = await dom.waitForElement(
      '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-content',
      8000
    );

    if (!modal) {
      overlay.showError('Easy Apply modal did not open. Try clicking Apply manually.');
      return false;
    }

    // Loop through modal steps (max 12 steps)
    let stepCount = 0;
    while (stepCount < 12) {
      stepCount++;

      // Re-query modal each iteration (LinkedIn re-renders it between steps)
      const currentModal = document.querySelector(
        '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-content'
      );
      if (!currentModal) break;

      overlay.setStatus(`Filling application step ${stepCount}...`, true);
      await dom.sleep(600);

      // A. Fill text inputs
      const textInputs = currentModal.querySelectorAll(
        'input[type="text"]:not([readonly]), input[type="tel"]:not([readonly]), ' +
        'input[type="email"]:not([readonly]), input[type="number"]:not([readonly]), ' +
        'textarea:not([readonly])'
      );
      for (const input of textInputs) {
        if (input.value) continue;

        const label =
          input.closest('.jobs-easy-apply-form-element')?.querySelector('label')?.innerText ||
          input.closest('div')?.querySelector('label')?.innerText ||
          input.getAttribute('aria-label') ||
          input.getAttribute('placeholder') || '';
        const labelLower = label.toLowerCase();

        if (labelLower.includes('phone') && profile.phone) {
          await cursor.type(input, profile.phone);
        } else if (labelLower.includes('email') && profile.email) {
          await cursor.type(input, profile.email);
        } else if (labelLower.includes('year') || labelLower.includes('experience')) {
          await cursor.type(input, String(profile.years_of_experience || '3'));
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

      // B. Handle radio buttons (Yes/No screening questions)
      const radioFieldsets = currentModal.querySelectorAll('fieldset');
      for (const fs of radioFieldsets) {
        const legend = fs.querySelector('legend, span[data-test-form-element-label-title]')?.innerText?.toLowerCase() || '';
        const radios = fs.querySelectorAll('input[type="radio"]');
        if (radios.length > 0 && ![...radios].some((r) => r.checked)) {
          const getLabel = (r) => (r.nextElementSibling?.innerText || r.value || '').toLowerCase();
          if (legend.includes('authorized') || legend.includes('commute') || legend.includes('relocate')) {
            const yes = [...radios].find((r) => getLabel(r).includes('yes'));
            if (yes) await cursor.click(yes);
          } else if (legend.includes('sponsor') || legend.includes('visa')) {
            const no = [...radios].find((r) => getLabel(r).includes('no'));
            if (no) await cursor.click(no);
          } else {
            await cursor.click(radios[0]);
          }
        }
      }

      // C. Handle dropdowns/selects
      const selects = currentModal.querySelectorAll('select');
      for (const sel of selects) {
        if (sel.value) continue;
        if (sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // D. Find navigation button (Submit / Review / Next / Continue)
      const submitBtn = currentModal.querySelector(
        'button[aria-label*="Submit application"], ' +
        'button[data-control-name="submit_unify"], ' +
        'footer button[aria-label*="Submit"]'
      );
      const reviewBtn = currentModal.querySelector(
        'button[aria-label*="Review your application"], ' +
        'button[data-control-name="review_unify"]'
      );
      const nextBtn = currentModal.querySelector(
        'button[aria-label*="Continue to next step"], ' +
        'button[aria-label*="Next"], ' +
        'button[data-easy-apply-next-button], ' +
        'footer button:not([aria-label*="Dismiss"]):not([aria-label*="Back"]):last-child'
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
          overlay.showSuccess('Submitted via LinkedIn Easy Apply!');
          await window.TrackyAPI.recordApplication({
            title: document.title,
            company: document.querySelector('.jobs-unified-top-card__company-name')?.innerText || 'LinkedIn Employer',
            url: window.location.href,
            source: 'LinkedIn',
            status: 'applied',
            mode: 'full_auto'
          });
          return true;
        }
      } else if (reviewBtn) {
        await cursor.click(reviewBtn);
        await dom.sleep(1200);
      } else if (nextBtn) {
        await cursor.click(nextBtn);
        await dom.sleep(1200);
      } else {
        // No button found — might be on a confirmation step
        break;
      }
    }

    return true;
  }
};
