/**
 * Indeed Apply Adapter for Tracky.
 */
window.TrackyIndeedAdapter = {
  isApplicable() {
    return window.location.hostname.includes('indeed.com');
  },

  async apply(profile, mode = 'review_before_submit') {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    overlay.setStatus('Detecting Indeed Apply button...', true);

    const applyBtn = document.querySelector('#indeedApplyButton, button[id*="indeedApply"], .ia-IndeedApplyButton');
    if (!applyBtn) {
      overlay.showError('No Indeed Apply button found (Direct/External ATS)');
      return false;
    }

    await cursor.click(applyBtn);
    await dom.sleep(1500);

    // Indeed modal / iframe navigation
    let stepCount = 0;
    while (stepCount < 8) {
      stepCount++;
      overlay.setStatus(`Filling Indeed application step ${stepCount}...`, true);

      // Handle common inputs
      const textInputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea');
      for (const input of textInputs) {
        if (!input.value) {
          const label = input.closest('div')?.querySelector('label')?.innerText || input.getAttribute('aria-label') || '';
          const labelLower = label.toLowerCase();

          if (labelLower.includes('phone') && profile.phone) {
            await cursor.type(input, profile.phone);
          } else if (labelLower.includes('year') || labelLower.includes('experience')) {
            await cursor.type(input, profile.years_of_experience || '3');
          } else {
            const answers = await window.TrackyAPI.answerForm([{ question_id: input.id || label, question: label }], { title: document.title });
            if (answers && answers[0]?.answer) {
              await cursor.type(input, answers[0].answer);
            }
          }
        }
      }

      // Buttons
      const submitBtn = document.querySelector('button[type="submit"], button[data-testid="submit-application"], button.ia-SubmitButton');
      const continueBtn = document.querySelector('button.ia-continueButton, button[data-testid="continue-button"]');

      if (submitBtn) {
        if (mode === 'review_before_submit') {
          overlay.showSuccess('Ready for final submit (Review Mode)! Click Submit below.');
          await cursor.moveTo(submitBtn);
          return true;
        } else {
          overlay.setStatus('Submitting application...', true);
          await cursor.click(submitBtn);
          await dom.sleep(1500);
          overlay.showSuccess('Submitted successfully via Indeed Apply!');
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
      } else {
        break;
      }
    }

    return true;
  }
};
