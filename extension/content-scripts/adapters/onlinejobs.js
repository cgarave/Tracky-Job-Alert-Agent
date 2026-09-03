/**
 * OnlineJobs.ph Direct Employer Message & Application Adapter for Tracky.
 */
window.TrackyOnlineJobsAdapter = {
  isApplicable() {
    return window.location.hostname.includes('onlinejobs.ph');
  },

  async apply(profile, mode = 'review_before_submit') {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;

    overlay.setStatus('Detecting application message form...', true);

    // 1. Locate apply button / form container
    const applyBtn = document.querySelector('a.apply-job-btn, button.apply-job-btn, #apply-button, a[href*="apply"]');
    if (applyBtn && document.querySelector('#jobpost-apply-form, form[action*="apply"]') === null) {
      await cursor.click(applyBtn);
      await dom.sleep(1000);
    }

    const form = document.querySelector('form[action*="apply"], #jobpost-apply-form, div.apply-form-box, form');
    const msgBox = document.querySelector('textarea[name="message"], textarea#message, textarea');
    const rateInput = document.querySelector('input[name="rate"], input[name="salary"], input#rate');
    const subjectInput = document.querySelector('input[name="subject"], input#subject');

    if (!msgBox) {
      overlay.showError('Could not find application message box (Login required?)');
      return false;
    }

    // 2. Generate customized Gemini AI cover message
    overlay.setStatus('Generating tailored cover letter with Gemini AI...', true);
    const jobTitle = document.querySelector('h1, h2, h3, .job-title')?.innerText || document.title;
    const jobDesc = document.querySelector('.job-description, .jobpost-full, div.desc')?.innerText || '';

    const coverLetter = await window.TrackyAPI.generateCoverLetter({
      title: jobTitle,
      company: 'OnlineJobs Employer',
      description: jobDesc
    });

    // 3. Fill Subject, Rate, and Message
    if (subjectInput && !subjectInput.value) {
      await cursor.type(subjectInput, `Application: ${jobTitle} — ${profile.full_name || 'Experienced Candidate'}`);
    }

    if (rateInput && !rateInput.value) {
      const defaultRate = profile.screening_defaults?.expected_salary_hourly_usd || '20';
      await cursor.type(rateInput, `$${defaultRate}/hr`);
    }

    if (coverLetter) {
      overlay.setStatus('Typing tailored cover letter...', true);
      await cursor.type(msgBox, coverLetter);
    }

    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], button.btn-apply');

    if (mode === 'review_before_submit') {
      overlay.showSuccess('Cover letter & rate prepared! Review and click Send.');
      if (submitBtn) await cursor.moveTo(submitBtn);
      return true;
    } else {
      if (submitBtn) {
        overlay.setStatus('Sending application message...', true);
        await cursor.click(submitBtn);
        await dom.sleep(1500);
        overlay.showSuccess('Sent application to OnlineJobs employer!');
        await window.TrackyAPI.recordApplication({
          title: jobTitle,
          company: 'OnlineJobs Employer',
          url: window.location.href,
          source: 'OnlineJobs.ph',
          status: 'applied',
          mode: 'full_auto'
        });
        return true;
      }
    }

    return true;
  }
};
