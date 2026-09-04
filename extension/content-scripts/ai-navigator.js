/**
 * Tracky AI Vision-Powered Browser Navigation Engine.
 *
 * Replaces hardcoded selectors with dynamic Gemini Vision perception:
 * 1. Takes page screenshot via background worker.
 * 2. Asks Gemini Vision to determine next human-like action (click, type, upload, approval, etc.).
 * 3. Animates ghost cursor to targeted element coordinates.
 * 4. Streams reasoning in real-time to the floating HUD.
 * 5. Handles cross-tab external ATS redirects and batch job sessions.
 */
window.TrackyAINavigator = {
  running: false,
  paused: false,
  stepCount: 0,
  maxSteps: 12,
  history: [],
  jobContext: {},
  profile: null,

  async start(customJobContext = null) {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.stepCount = 0;
    this.history = [];

    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const api = window.TrackyAPI;

    overlay.expand();
    overlay.showThinking('Starting Tracky AI Vision navigator...', 1, this.maxSteps);

    // Load profile & settings
    this.profile = await api.getProfile();
    if (!this.profile) {
      overlay.showError('Could not load profile from Tracky server (127.0.0.1:5050).');
      this.running = false;
      return;
    }

    const enableGhostCursor = this.profile.ai_settings?.enable_ghost_cursor ?? true;
    cursor.setEnabled(enableGhostCursor);

    // Infer job context from page or arguments
    this.jobContext = customJobContext || {
      title: document.title,
      company: this._inferCompanyName(),
      url: window.location.href,
      source: this._inferPlatformName()
    };

    // Register cross-tab session with background service worker
    try {
      chrome.runtime.sendMessage({
        action: 'REGISTER_APPLY_SESSION',
        jobContext: this.jobContext
      });
    } catch (e) {}

    // Clear previous step history in overlay
    window.TrackyOverlay?.clearHistory();
    this.reasoningSteps = [];

    // Begin the vision navigation loop
    await this._navigationLoop();
  },

  async _navigationLoop() {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;
    const api = window.TrackyAPI;

    while (this.running && this.stepCount < this.maxSteps) {
      if (this.paused) {
        await dom.sleep(500);
        continue;
      }

      this.stepCount++;
      overlay.showThinking(
        'Analyzing application form with Tracky AI...',
        this.stepCount,
        this.maxSteps,
        this._inferPlatformName()
      );

      // 1. Extract semantic form schema directly from DOM (full-page awareness)
      const formSchema = window.TrackyFormExtractor?.extractFormSchema();
      let screenshot = '';

      // If no recognized form fields, fall back to screenshot Vision
      if (!formSchema || formSchema.fields_count === 0) {
        screenshot = await this._captureScreenshot();
      }

      const domSnapshot = this._extractDOMSnapshot();

      // 2. Query Gemini AI Navigator via local backend
      const payload = {
        form_schema: formSchema,
        screenshot_b64: screenshot || '',
        dom_snapshot: domSnapshot,
        page_url: window.location.href,
        page_title: document.title,
        history: this.history,
        job_context: this.jobContext,
        profile: this.profile
      };

      const decision = await api.navigateStep(payload);
      if (!this.running) return; // Cancelled during request

      if (!decision) {
        overlay.showStuck(
          'No response from AI backend. Please check Tracky server.',
          () => this._navigationLoop(),
          () => this.stop()
        );
        return;
      }

      // 3. Record step for backtracking & dashboard reporting
      const stepRecord = {
        step: this.stepCount,
        reasoning: decision.reasoning || '',
        action: decision.action || 'inspect',
        fields: decision.fields || [],
        next_selector: decision.next_selector || ''
      };
      if (!this.reasoningSteps) this.reasoningSteps = [];
      this.reasoningSteps.push(stepRecord);
      overlay.addStepRecord(stepRecord);

      // Stream AI reasoning to HUD (if enabled in settings)
      const showStream = this.profile?.ai_settings?.show_reasoning_stream ?? true;
      if (showStream && decision.reasoning) {
        overlay.showThinking(
          decision.reasoning,
          this.stepCount,
          this.maxSteps,
          this._inferPlatformName()
        );
      } else if (!showStream) {
        overlay.showThinking(
          `Navigating step ${this.stepCount} of ${this.maxSteps}...`,
          this.stepCount,
          this.maxSteps,
          this._inferPlatformName()
        );
      }

      await dom.sleep(300);

      // 4. Handle Decision Actions
      const action = decision.action;

      if (action === 'fill_step') {
        const fields = decision.fields || [];
        overlay.showThinking(
          `Filling ${fields.length} form field${fields.length > 1 ? 's' : ''}...`,
          this.stepCount,
          this.maxSteps
        );

        // Fluid cascade: glide through each field in sequence
        for (const field of fields) {
          if (!this.running || this.paused) break;
          const el = this._findElement(field.selector);
          if (!el) {
            console.warn('[Tracky] Batch field not found:', field.selector);
            continue;
          }

          // Ensure visible before interacting
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (e) {}

          const actionType = field.action_type || (field.value !== undefined ? 'type' : 'click');
          if (actionType === 'type') {
            await cursor.type(el, field.value || '');
          } else if (actionType === 'click') {
            await cursor.click(el);
          }
          this.history.push(`filled: ${field.label || field.selector}`);
          await dom.sleep(200);
        }

        // Advance to Next step if next_selector is provided
        if (decision.next_selector) {
          const nextBtn = this._findElement(decision.next_selector);
          if (nextBtn) {
            const btnText = (nextBtn.innerText || nextBtn.value || '').toLowerCase();
            const isFinalSubmit = btnText.includes('submit') || btnText.includes('review');
            const approvalMode = this.profile.ai_settings?.application_mode || 'review_before_submit';

            if (isFinalSubmit && approvalMode === 'review_before_submit') {
              this.paused = true;
              overlay.showApproval(
                decision.summary || 'Ready to submit application.',
                async () => {
                  overlay.showThinking('Submitting final application...', this.stepCount, this.maxSteps);
                  await cursor.click(nextBtn);
                  await dom.sleep(1800);
                  await this._recordApplicationSuccess();
                },
                () => this.stop()
              );
              return;
            } else {
              await cursor.click(nextBtn);
              this.history.push(`clicked next: ${decision.next_selector}`);
              await dom.sleep(1500);
            }
          }
        }
      } else if (action === 'scroll') {
        const direction = decision.direction === 'up' ? -1 : 1;
        window.scrollBy({ top: 500 * direction, behavior: 'smooth' });
        this.history.push(`scrolled ${decision.direction || 'down'}`);
        await dom.sleep(700);
      } else if (action === 'click') {
        const el = this._findElement(decision.selector);
        if (el) {
          this.history.push(`clicked: ${decision.selector || 'button'}`);
          await cursor.click(el);
          await dom.sleep(1200);
        } else {
          this.history.push(`selector_not_found: ${decision.selector}`);
          await dom.sleep(800);
        }
      } else if (action === 'type') {
        const el = this._findElement(decision.selector);
        if (el && decision.text !== undefined) {
          this.history.push(`typed into: ${decision.selector}`);
          await cursor.type(el, decision.text);
          await dom.sleep(600);
        } else {
          this.history.push(`input_not_found: ${decision.selector}`);
          await dom.sleep(800);
        }
      } else if (action === 'upload_resume') {
        const el = this._findElement(decision.selector || 'input[type="file"]');
        const autoUpload = this.profile.ai_settings?.resume_auto_upload ?? true;

        if (autoUpload && el) {
          overlay.showThinking('Auto-uploading stored resume...', this.stepCount, this.maxSteps);
          this.history.push('uploaded resume');
          await dom.sleep(800);
        } else {
          // Pause and let user upload
          this.paused = true;
          overlay.showStuck(
            'Resume upload field detected. Please select your resume file, then click Continue.',
            () => {
              this.paused = false;
              this.history.push('user uploaded resume manually');
            },
            () => this.stop()
          );
          return;
        }
      } else if (action === 'ask_user') {
        this.paused = true;
        const el = this._findElement(decision.field_selector);
        cursor.showSpeechBubble({
          title: 'Quick Question',
          message: decision.question || 'Please provide an answer for this field:',
          targetElement: el,
          onSubmit: async (userAnswer) => {
            this.paused = false;
            if (el && userAnswer) {
              await cursor.type(el, userAnswer);
            }
            this.history.push(`answered: "${decision.question}" with "${userAnswer}"`);
            await this._navigationLoop();
          },
          onSkip: () => {
            this.paused = false;
            this.history.push(`skipped: "${decision.question}"`);
            this._navigationLoop();
          },
          onManual: () => {
            this.paused = true;
            overlay.showStuck('Complete the field on screen, then click Continue.', () => {
              this.paused = false;
              this._navigationLoop();
            }, () => this.stop());
          }
        });
        return;
      } else if (action === 'captcha') {
        this.paused = true;
        overlay.showCaptcha(
          () => {
            this.paused = false;
            this.history.push('user solved captcha');
            this._navigationLoop();
          },
          () => this.stop()
        );
        return;
      } else if (action === 'request_approval') {
        const approvalMode = this.profile.ai_settings?.application_mode || 'review_before_submit';
        const submitBtn = this._findElement(decision.submit_selector || 'button[type="submit"]');

        if (approvalMode === 'review_before_submit') {
          this.paused = true;
          overlay.showApproval(
            decision.summary || 'Ready to submit application.',
            async () => {
              overlay.showThinking('Submitting final application...', this.stepCount, this.maxSteps);
              if (submitBtn) await cursor.click(submitBtn);
              await dom.sleep(1800);
              await this._recordApplicationSuccess();
            },
            () => this.stop()
          );
          return;
        } else {
          // Full auto mode
          overlay.showThinking('Full Auto: Submitting application...', this.stepCount, this.maxSteps);
          if (submitBtn) await cursor.click(submitBtn);
          await dom.sleep(1800);
          await this._recordApplicationSuccess();
          return;
        }
      } else if (action === 'new_tab_expected') {
        const el = this._findElement(decision.selector);
        if (el) {
          this.history.push('clicked external ATS link');
          await cursor.click(el);
          await dom.sleep(2000);
        }
      } else if (action === 'done') {
        await this._recordApplicationSuccess();
        return;
      } else if (action === 'stuck') {
        this.paused = true;
        const targetEl = this._pickFirstUnfilledInput();
        cursor.showSpeechBubble({
          title: 'Tracky Is Paused',
          message: decision.reason || "I'm paused on this question. Can you help me answer it?",
          targetElement: targetEl,
          onSubmit: async (userAnswer) => {
            this.paused = false;
            if (targetEl && userAnswer) {
              await cursor.type(targetEl, userAnswer);
            }
            this.history.push(`user assisted with answer: "${userAnswer}"`);
            await this._navigationLoop();
          },
          onSkip: () => {
            this.paused = false;
            this.history.push('user skipped stuck question');
            this._navigationLoop();
          },
          onManual: () => {
            this.paused = true;
            overlay.showStuck('Complete the step on screen, then click Continue.', () => {
              this.paused = false;
              this._navigationLoop();
            }, () => this.stop());
          }
        });
        return;
      }
    }

    if (this.stepCount >= this.maxSteps) {
      overlay.showStuck(
        'Reached max application steps. Please complete remaining fields manually.',
        () => this.stop(),
        () => this.stop()
      );
    }
  },

  async _recordApplicationSuccess() {
    const overlay = window.TrackyOverlay;
    const api = window.TrackyAPI;

    overlay.showSuccess('Job application successfully submitted!');
    await api.recordSessionJob({
      title: this.jobContext.title || document.title,
      company: this.jobContext.company || this._inferCompanyName(),
      url: window.location.href,
      source: this._inferPlatformName(),
      status: 'applied',
      mode: 'ai_vision',
      reasoning_steps: this.reasoningSteps || []
    });

    // Notify background worker of completion
    try {
      chrome.runtime.sendMessage({
        action: 'JOB_APPLY_COMPLETED',
        url: window.location.href,
        status: 'applied'
      });
    } catch (e) {}

    this.running = false;
  },

  _captureScreenshot() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'CAPTURE_SCREENSHOT' }, (resp) => {
          if (chrome.runtime.lastError) {
            console.warn('[Tracky] Screenshot capture lastError:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          if (resp?.error) {
            console.warn('[Tracky] ServiceWorker capture error:', resp.error);
          }
          resolve(resp?.dataUrl || null);
        });
      } catch (e) {
        console.warn('[Tracky] Screenshot capture exception:', e);
        resolve(null);
      }
    });
  },

  _extractDOMSnapshot() {
    try {
      const vh = window.innerHeight;
      const controls = Array.from(
        document.querySelectorAll(
          'input:not([type="hidden"]), select, textarea, button, a[role="button"], [class*="Apply"], [id*="apply"], [data-testid*="apply"]'
        )
      )
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        })
        .slice(0, 50)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const inViewport = rect.top >= 0 && rect.bottom <= vh;
          const pos = inViewport ? '[visible]' : rect.top > vh ? '[below-fold]' : '[above-fold]';

          const label =
            el.getAttribute('aria-label') ||
            el.closest('div')?.querySelector('label')?.innerText ||
            el.name ||
            el.id ||
            el.placeholder ||
            el.innerText ||
            '';
          const tag = el.tagName.toLowerCase();
          const type = el.type ? ` type="${el.type}"` : '';
          const id = el.id ? ` id="${el.id}"` : '';
          const cls = el.className ? ` class="${String(el.className).slice(0, 35)}"` : '';
          const testid = el.getAttribute('data-testid') ? ` data-testid="${el.getAttribute('data-testid')}"` : '';
          return `<${tag}${type}${id}${testid}${cls} status="${pos}" label="${label.slice(0, 50).trim()}">${el.innerText ? el.innerText.slice(0, 60).trim() : ''}</${tag}>`;
        })
        .join('\n');

      return `Page Title: ${document.title}\nURL: ${window.location.href}\nScroll State: ${Math.round(window.scrollY)}px / ${document.body.scrollHeight}px (Viewport Height: ${vh}px)\nInteractive Controls:\n${controls}`;
    } catch {
      return '';
    }
  },

  _findElement(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (e) {
      return null;
    }
  },

  _pickFirstUnfilledInput() {
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="radio"]')
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      const empty = el.type === 'radio' ? !el.checked : !el.value;
      return visible && empty;
    });
    return inputs[0] || document.querySelector('input:not([type="hidden"]), select, textarea');
  },

  _inferCompanyName() {
    const liCompany = document.querySelector('.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name');
    if (liCompany) return liCompany.innerText.trim();

    const indeedCompany = document.querySelector('[data-testid="inlineHeader-companyName"], .jobsearch-CompanyInfoContainer');
    if (indeedCompany) return indeedCompany.innerText.trim();

    return 'Employer';
  },

  _inferPlatformName() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('indeed')) return 'Indeed';
    if (host.includes('onlinejobs')) return 'OnlineJobs.ph';
    if (host.includes('jobstreet')) return 'JobStreet';
    if (host.includes('greenhouse')) return 'Greenhouse ATS';
    if (host.includes('lever.co')) return 'Lever ATS';
    if (host.includes('workday')) return 'Workday ATS';
    return 'Company ATS';
  },

  togglePause() {
    this.paused = !this.paused;
    const overlay = window.TrackyOverlay;
    if (this.paused) {
      overlay.setStatus('Session paused');
    } else {
      overlay.setStatus('Resuming session...');
    }
  },

  cancel() {
    this.running = false;
    this.paused = false;
    window.TrackyAPI?.abortCurrentStep();
    window.TrackyCursor?.hideSpeechBubble();
    try {
      chrome.runtime.sendMessage({ action: 'CLEAR_APPLY_SESSION' });
    } catch (e) {}
  },

  stop() {
    this.cancel();
    window.TrackyOverlay?.minimize();
    window.TrackyCursor?.hide();
  }
};
