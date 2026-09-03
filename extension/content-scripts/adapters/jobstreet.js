/**
 * JobStreet (SEEK platform) Quick Apply Adapter for Tracky.
 */
window.TrackyJobStreetAdapter = {
  isApplicable() {
    return window.location.hostname.includes('jobstreet') || window.location.hostname.includes('seek');
  },

  async apply(profile, mode = 'review_before_submit') {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    overlay.setStatus('Detecting JobStreet Quick Apply button...', true);

    const applyBtn = document.querySelector(
      'a[data-automation="job-detail-apply"], button[data-automation="job-detail-apply"], a[href*="/apply"]'
    );

    if (!applyBtn) {
      overlay.showError('No Quick Apply button found (Direct employer ATS redirect)');
      return false;
    }

    await cursor.click(applyBtn);
    await dom.sleep(1500);

    // Fill SEEK application form if modal/page rendered
    const textInputs = document.querySelectorAll('input[type="text"], input[type="tel"], textarea');
    for (const input of textInputs) {
      if (!input.value) {
        const label = input.closest('div')?.querySelector('label')?.innerText || '';
        if (label.toLowerCase().includes('phone') && profile.phone) {
          await cursor.type(input, profile.phone);
        } else if (label) {
          const answers = await window.TrackyAPI.answerForm([{ question_id: input.id || label, question: label }], { title: document.title });
          if (answers && answers[0]?.answer) {
            await cursor.type(input, answers[0].answer);
          }
        }
      }
    }

    const submitBtn = document.querySelector('button[data-automation="submit-application"], button[type="submit"]');
    if (submitBtn) {
      if (mode === 'review_before_submit') {
        overlay.showSuccess('Ready for final submit (Review Mode)! Click Submit below.');
        await cursor.moveTo(submitBtn);
      } else {
        overlay.setStatus('Submitting application...', true);
        await cursor.click(submitBtn);
        overlay.showSuccess('Submitted successfully via JobStreet!');
        await window.TrackyAPI.recordApplication({
          title: document.title,
          company: 'JobStreet Employer',
          url: window.location.href,
          source: 'JobStreet.ph',
          status: 'applied',
          mode: 'full_auto'
        });
      }
    }

    return true;
  }
};
