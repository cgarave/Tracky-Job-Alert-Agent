/**
 * LinkedIn Easy Apply Adapter for Tracky.
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

    // 1. Locate Easy Apply button
    const applyBtn = document.querySelector(
      '.jobs-apply-button, button.jobs-apply-button--top-card, button[aria-label*="Easy Apply"]'
    );

    if (!applyBtn) {
      overlay.showError('No Easy Apply button found (Direct/External ATS)');
      return false;
    }

    await cursor.click(applyBtn);
    await dom.sleep(1200);

    // 2. Loop through modal steps (max 10 steps)
    let stepCount = 0;
    while (stepCount < 10) {
      stepCount++;
      const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal]');
      if (!modal) break;

      overlay.setStatus(`Filling application step ${stepCount}...`, true);

      // A. Fill standard inputs
      const textInputs = modal.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea');
      for (const input of textInputs) {
        if (!input.value) {
          const label = input.closest('div')?.querySelector('label')?.innerText || input.getAttribute('aria-label') || '';
          const labelLower = label.toLowerCase();

          if (labelLower.includes('phone') && profile.phone) {
            await cursor.type(input, profile.phone);
          } else if (labelLower.includes('email') && profile.email) {
            await cursor.type(input, profile.email);
          } else if (labelLower.includes('year') || labelLower.includes('experience')) {
            await cursor.type(input, profile.years_of_experience || '3');
          } else if (labelLower.includes('salary') || labelLower.includes('compensation')) {
            await cursor.type(input, profile.screening_defaults?.expected_salary_monthly_php || '80000');
          } else {
            // Ask Gemini for answers to custom question
            const answers = await window.TrackyAPI.answerForm([{ question_id: input.id || label, question: label }], { title: document.title });
            if (answers && answers[0]?.answer) {
              await cursor.type(input, answers[0].answer);
            }
          }
        }
      }

      // B. Handle Radio buttons & Yes/No
      const radioFieldsets = modal.querySelectorAll('fieldset');
      for (const fs of radioFieldsets) {
        const legend = fs.querySelector('legend')?.innerText?.toLowerCase() || '';
        const radios = fs.querySelectorAll('input[type="radio"]');
        if (radios.length > 0 && ![...radios].some((r) => r.checked)) {
          // Select Yes for authorization / No for sponsorship
          if (legend.includes('authorized') || legend.includes('commute') || legend.includes('relocate')) {
            const yesRadio = [...radios].find((r) => r.value.toLowerCase().includes('yes') || r.nextElementSibling?.innerText?.toLowerCase().includes('yes'));
            if (yesRadio) await cursor.click(yesRadio);
          } else if (legend.includes('sponsorship') || legend.includes('visa')) {
            const noRadio = [...radios].find((r) => r.value.toLowerCase().includes('no') || r.nextElementSibling?.innerText?.toLowerCase().includes('no'));
            if (noRadio) await cursor.click(noRadio);
          } else if (radios[0]) {
            await cursor.click(radios[0]);
          }
        }
      }

      // C. Next / Review / Submit Button
      const submitBtn = modal.querySelector('button[aria-label*="Submit application"], button[data-control-name="submit_unify"]');
      const reviewBtn = modal.querySelector('button[aria-label*="Review your application"], button[data-control-name="review_unify"]');
      const nextBtn = modal.querySelector('button[aria-label*="Continue to next step"], button[aria-label*="Next"]');

      if (submitBtn) {
        if (mode === 'review_before_submit') {
          overlay.showSuccess('Ready for final submit (Review Mode)! Click Submit below.');
          await cursor.moveTo(submitBtn);
          return true;
        } else {
          overlay.setStatus('Submitting application...', true);
          await cursor.click(submitBtn);
          await dom.sleep(1500);
          overlay.showSuccess('Submitted successfully via LinkedIn Easy Apply!');
          await window.TrackyAPI.recordApplication({
            title: document.title,
            company: 'LinkedIn Employer',
            url: window.location.href,
            source: 'LinkedIn',
            status: 'applied',
            mode: 'full_auto'
          });
          return true;
        }
      } else if (reviewBtn) {
        await cursor.click(reviewBtn);
        await dom.sleep(1000);
      } else if (nextBtn) {
        await cursor.click(nextBtn);
        await dom.sleep(1000);
      } else {
        break;
      }
    }

    return true;
  }
};
