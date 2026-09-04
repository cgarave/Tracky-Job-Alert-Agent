/**
 * Tracky AI Vision-Powered Browser Navigation Engine.
 *
 * 1. Semantic DOM Form extraction & automated answer filling via Gemini AI.
 * 2. Visual ghost cursor animation directly on targeted form fields and buttons.
 * 3. Never advances or clicks Continue until all required questions on screen are answered.
 * 4. Pauses smoothly with interactive speech bubble whenever user input is needed.
 */
window.TrackyAINavigator = {
  running: false,
  paused: false,
  stepCount: 0,
  maxSteps: 15,
  history: [],
  jobContext: {},
  profile: null,
  reasoningSteps: [],

  async start(customJobContext = null) {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.stepCount = 0;
    this.history = [];
    this.reasoningSteps = [];

    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const api = window.TrackyAPI;

    overlay?.expand();
    overlay?.showThinking('Starting Tracky AI Co-Pilot...', 1, this.maxSteps);

    // Load profile & settings
    this.profile = await api.getProfile();
    if (!this.profile) {
      overlay?.showError('Could not load profile from Tracky server (127.0.0.1:5050).');
      this.running = false;
      return;
    }

    const enableGhostCursor = this.profile.ai_settings?.enable_ghost_cursor ?? true;
    cursor.setEnabled(enableGhostCursor);
    cursor.isAINavigating = true;

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

    // Begin navigation loop
    await this._navigationLoop();
  },

  async _navigationLoop() {
    const overlay = window.TrackyOverlay;
    const cursor = window.TrackyCursor;
    const dom = window.TrackyDOM;
    const api = window.TrackyAPI;

    cursor.isAINavigating = true;

    while (this.running && this.stepCount < this.maxSteps) {
      if (this.paused) {
        await dom.sleep(500);
        continue;
      }

      this.stepCount++;
      overlay?.showThinking(
        'Analyzing application step with Tracky AI...',
        this.stepCount,
        this.maxSteps,
        this._inferPlatformName()
      );

      // 1. Allow step DOM to settle
      await dom.sleep(800);

      // 2. Extract semantic form schema from DOM
      let formSchema = window.TrackyFormExtractor?.extractFormSchema();

      // If no fields found yet on an apply page, give DOM up to 1.5s to finish rendering
      if (!formSchema || !formSchema.fields || formSchema.fields.length === 0) {
        await dom.sleep(1200);
        formSchema = window.TrackyFormExtractor?.extractFormSchema();
      }

      const unfilledFields = this._getUnfilledFields(formSchema);

      // ── PHASE 1: AI EVALUATES & ANSWERS SCREENING QUESTIONS ────────────────
      if (unfilledFields.length > 0) {
        overlay?.showThinking(
          `Tracky AI is evaluating ${unfilledFields.length} question${unfilledFields.length > 1 ? 's' : ''}...`,
          this.stepCount,
          this.maxSteps,
          this._inferPlatformName()
        );

        const questionsToAnswer = unfilledFields.map((f) => ({
          question_id: f.selector || f.name,
          question: f.label || 'Screening Question',
          type: f.type,
          options: (f.options || []).map((o) => o.label || o.value),
          required: f.required
        }));

        let answers = [];
        try {
          answers = await api.answerForm(questionsToAnswer, this.jobContext);
        } catch (err) {
          console.warn('[Tracky] Gemini answerForm error:', err);
        }

        // Fill each question using visual cursor
        for (const f of unfilledFields) {
          if (!this.running || this.paused) break;

          const ansObj = (answers || []).find(
            (a) =>
              a.question_id === (f.selector || f.name) ||
              (a.question && f.label && a.question.toLowerCase().includes(f.label.toLowerCase())) ||
              (a.question && f.label && f.label.toLowerCase().includes(a.question.toLowerCase()))
          );
          const answer = ansObj?.answer;
          const confidence = ansObj?.confidence || 'high';

          // If required and could not be answered with high confidence, pause for user
          if (f.required && (!answer || confidence === 'low')) {
            const targetEl =
              this._findElement(f.selector) ||
              (f.options?.[0] ? this._findElement(f.options[0].selector) : null);
            await this._pauseForUserIntervention(targetEl, `Please answer: "${f.label || 'this question'}"`, f.label || '');
            continue;
          }

          if (!answer) continue;

          // A. Handle Radio Groups
          if (f.type === 'radio_group' && f.options) {
            const ansStr = String(answer).toLowerCase().trim();
            const matchedOpt =
              f.options.find((o) => {
                const optStr = String(o.label || o.value).toLowerCase().trim();
                return optStr === ansStr || ansStr.includes(optStr) || optStr.includes(ansStr);
              }) || f.options[0];

            if (matchedOpt) {
              const radioEl = this._findElement(matchedOpt.selector);
              if (radioEl) {
                try {
                  radioEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch (e) {}
                radioEl.checked = true;
                radioEl.dispatchEvent(new Event('change', { bubbles: true }));
                // Also click the enclosing label if present
                const parentLabel = radioEl.closest('label');
                await cursor.click(parentLabel || radioEl);
              }
            }
          }
          // B. Handle Select Dropdowns
          else if (f.type === 'select') {
            const selectEl = this._findElement(f.selector);
            if (selectEl) {
              try {
                selectEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } catch (e) {}
              const ansStr = String(answer).toLowerCase().trim();
              const matchedOpt = Array.from(selectEl.options).find(
                (o) =>
                  o.value.toLowerCase() === ansStr ||
                  o.text.toLowerCase().includes(ansStr) ||
                  ansStr.includes(o.text.toLowerCase())
              );
              if (matchedOpt) {
                selectEl.value = matchedOpt.value;
              } else if (selectEl.options.length > 1) {
                selectEl.selectedIndex = 1;
              }
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
              await cursor.moveTo(selectEl);
            }
          }
          // C. Handle Checkboxes
          else if (f.type === 'checkbox') {
            const checkEl = this._findElement(f.selector);
            if (checkEl) {
              const shouldCheck =
                answer === true || String(answer).toLowerCase() === 'yes' || String(answer).toLowerCase() === 'true';
              if (checkEl.checked !== shouldCheck) {
                await cursor.click(checkEl);
              }
            }
          }
          // D. Handle Text / Number / Tel / Textarea
          else {
            const inputEl = this._findElement(f.selector);
            if (inputEl) {
              try {
                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } catch (e) {}
              await cursor.type(inputEl, String(answer));
            }
          }

          this.history.push(`filled: ${f.label}`);
          await dom.sleep(200);
        }
      }

      // ── STRICT VERIFICATION: Ensure NO required questions remain unfilled ─
      await dom.sleep(400);

      // 1. Check for visible form validation errors on the page
      const errorEl = document.querySelector(
        '.ia-Form-error, [aria-invalid="true"], .artdeco-inline-feedback--error, [data-test-form-element-error-messages]'
      );
      if (errorEl && errorEl.offsetParent !== null && errorEl.innerText.trim()) {
        await this._pauseForUserIntervention(errorEl, `Please review required question: "${errorEl.innerText.trim()}"`);
        continue;
      }

      // 2. Double check if any visible required text/number inputs are still empty
      const remainingUnfilledInput = this._findFirstUnfilledRequiredInput();
      if (remainingUnfilledInput) {
        const label = this._inferFieldLabel(remainingUnfilledInput);
        await this._pauseForUserIntervention(
          remainingUnfilledInput,
          `Please provide an answer for "${label || 'this required field'}"`,
          label
        );
        continue;
      }

      // ── PHASE 2: ADVANCE STEP OR SUBMIT ────────────────────────────────────
      const nextBtn = this._findStepNavigationButton(formSchema);
      if (nextBtn) {
        const btnText = (nextBtn.innerText || nextBtn.value || nextBtn.getAttribute('aria-label') || '').toLowerCase();
        const isSubmit = btnText.includes('submit') || btnText.includes('review') || btnText.includes('apply now');
        const approvalMode = this.profile?.ai_settings?.application_mode || 'review_before_submit';

        if (isSubmit && approvalMode === 'review_before_submit') {
          this.paused = true;
          overlay?.showApproval(
            'All questions answered! Please review your application and click Submit.',
            async () => {
              overlay?.showThinking('Submitting final application...', this.stepCount, this.maxSteps);
              await cursor.click(nextBtn);
              await dom.sleep(1800);
              await this._recordApplicationSuccess();
            },
            () => this.stop()
          );
          return;
        } else if (isSubmit) {
          overlay?.showThinking('Submitting final application...', this.stepCount, this.maxSteps);
          await cursor.click(nextBtn);
          await dom.sleep(1800);
          await this._recordApplicationSuccess();
          return;
        } else {
          overlay?.setStatus('All questions filled. Advancing to next step...', true);
          await cursor.click(nextBtn);
          this.history.push(`clicked: ${btnText}`);
          await dom.sleep(1500);
          continue;
        }
      }

      // ── PHASE 3: FALLBACK TO GEMINI MULTIMODAL IF NO BUTTON DETECTED ───────
      const screenshot = await this._captureScreenshot();
      const domSnapshot = this._extractDOMSnapshot();
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
      if (!this.running) return;
      const action = decision?.action || 'stuck';

      if (!decision || decision.action === 'stuck') {
        const targetEl = this._pickFirstUnfilledInput();
        await this._pauseForUserIntervention(targetEl, decision?.reason || 'Please complete this step to continue.');
        continue;
      } else if (decision.action === 'done') {
        await this._recordApplicationSuccess();
        return;
      } else if (decision.action === 'scroll') {
        const direction = decision.direction === 'up' ? -1 : 1;
        window.scrollBy({ top: 500 * direction, behavior: 'smooth' });
        this.history.push(`scrolled ${decision.direction || 'down'}`);
        await dom.sleep(700);
      } else if (decision.action === 'click') {
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
        const autoUpload = this.profile?.ai_settings?.resume_auto_upload ?? true;

        if (autoUpload && el) {
          overlay?.showThinking('Auto-uploading stored resume...', this.stepCount, this.maxSteps);
          this.history.push('uploaded resume');
          await dom.sleep(800);
        } else {
          this.paused = true;
          overlay?.showStuck(
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
        await this._pauseForUserIntervention(el, decision.question || 'Please provide an answer for this field:');
        continue;
      } else if (action === 'captcha') {
        this.paused = true;
        overlay?.showCaptcha(
          () => {
            this.paused = false;
            this.history.push('user solved captcha');
            this._navigationLoop();
          },
          () => this.stop()
        );
        return;
      } else if (action === 'request_approval') {
        const approvalMode = this.profile?.ai_settings?.application_mode || 'review_before_submit';
        const submitBtn = this._findElement(decision.submit_selector || 'button[type="submit"]');

        if (approvalMode === 'review_before_submit') {
          this.paused = true;
          overlay?.showApproval(
            decision.summary || 'Ready to submit application.',
            async () => {
              overlay?.showThinking('Submitting final application...', this.stepCount, this.maxSteps);
              if (submitBtn) await cursor.click(submitBtn);
              await dom.sleep(1800);
              await this._recordApplicationSuccess();
            },
            () => this.stop()
          );
          return;
        } else {
          overlay?.showThinking('Submitting application...', this.stepCount, this.maxSteps);
          if (submitBtn) await cursor.click(submitBtn);
          await dom.sleep(1800);
          await this._recordApplicationSuccess();
          return;
        }
      }
    }

    if (this.stepCount >= this.maxSteps) {
      overlay?.showStuck(
        'Reached max application steps. Please complete remaining fields manually.',
        () => this.stop(),
        () => this.stop()
      );
    }
  },

  async _recordApplicationSuccess() {
    const overlay = window.TrackyOverlay;
    const api = window.TrackyAPI;
    const cursor = window.TrackyCursor;

    cursor.isAINavigating = false;
    overlay?.showSuccess('Job application successfully submitted!');

    await api.recordSessionJob({
      title: this.jobContext.title || document.title,
      company: this.jobContext.company || this._inferCompanyName(),
      url: window.location.href,
      source: this._inferPlatformName(),
      status: 'applied',
      mode: 'ai_vision',
      reasoning_steps: this.reasoningSteps || []
    });

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
            resolve(null);
            return;
          }
          resolve(resp?.dataUrl || null);
        });
      } catch (e) {
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
          if (el.closest('#jobsearch, form[role="search"], header, nav, footer')) return false;
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
      const el = document.querySelector(selector);
      if (el) return el;
    } catch (e) {}

    // Check if selector contains :contains(...)
    const containsMatch = selector.match(/^([a-zA-Z0-9_\-\.]+)?\s*:contains\(["'](.*?)["']\)$/i);
    if (containsMatch) {
      const tag = containsMatch[1] || '*';
      const text = containsMatch[2].toLowerCase();
      const candidates = Array.from(document.querySelectorAll(tag));
      return candidates.find((c) => (c.innerText || c.textContent || '').trim().toLowerCase().includes(text)) || null;
    }

    // Fallback: search by text content for buttons or links
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
    const cleanSel = selector.replace(/[#\.\-_]/g, ' ').toLowerCase();
    const btnMatch = buttons.find((b) => {
      const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return txt && (cleanSel.includes(txt) || txt.includes(cleanSel));
    });
    if (btnMatch) return btnMatch;

    return null;
  },

  _getUnfilledFields(formSchema) {
    if (!formSchema || !formSchema.fields) return [];
    return formSchema.fields.filter((f) => {
      if (f.is_answered !== undefined) {
        return !f.is_answered;
      }
      if (f.type === 'radio_group') {
        return !f.options.some((o) => o.checked);
      }
      if (f.type === 'checkbox') {
        return f.required && !f.checked;
      }
      if (f.type === 'file') {
        return false;
      }
      return !f.current_value || f.current_value.trim().length === 0;
    });
  },

  _findFirstUnfilledRequiredInput() {
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]), textarea, select')
    ).filter((el) => {
      if (el.closest('#jobsearch, form[role="search"], header, nav, footer, [data-testid="searchform"]')) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      if (!isVisible) return false;

      const isRequired =
        el.required ||
        el.getAttribute('aria-required') === 'true' ||
        el.closest('.ia-Questions-item, [data-testid*="question" i]')?.querySelector('.ia-Questions-requiredBadge, [class*="required"]') !== null;

      if (!isRequired) return false;

      if (el.type === 'radio') {
        const name = el.name;
        if (name) {
          const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
          return !Array.from(group).some((r) => r.checked);
        }
        return !el.checked;
      }

      if (el.type === 'checkbox') {
        return !el.checked;
      }

      if (el.tagName.toLowerCase() === 'select') {
        return !el.value || el.value.toLowerCase().includes('select') || el.selectedIndex <= 0;
      }

      return !el.value || el.value.trim().length === 0;
    });

    return inputs[0] || null;
  },

  _inferFieldLabel(el) {
    if (!el) return '';
    return (
      el.getAttribute('aria-label') ||
      el.closest('.ia-Questions-item, [data-testid*="question" i], .form-group')?.querySelector('legend, label, .ia-Question-header, [class*="title"]')?.innerText?.trim() ||
      el.closest('label')?.innerText?.trim() ||
      document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText?.trim() ||
      el.placeholder ||
      el.name ||
      'Required Field'
    );
  },

  _findStepNavigationButton(formSchema) {
    // 1. Check known primary button selectors
    const selectors = [
      'button[type="submit"][data-testid="submit-application"]',
      'button[data-testid="IA-SubmitButton"]',
      'button.ia-SubmitButton',
      'button[aria-label*="Submit application"]',
      'button[data-control-name="submit_unify"]',
      'button[data-testid="IA-ContinueButton"]',
      'button.ia-continueButton',
      'button[data-testid="continue-button"]',
      'button[data-easy-apply-next-button]',
      'button[aria-label*="Continue"]',
      'button[aria-label*="Next"]',
      'button[aria-label*="Review"]',
      'button[data-testid="IA-next"]',
      'form:not(#jobsearch) button[type="submit"]',
      '.jobs-easy-apply-modal footer button:not([aria-label*="Dismiss"]):not([aria-label*="Back"]):last-child'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && !el.disabled) {
        if (!el.closest('#jobsearch, form[role="search"], header, nav')) {
          return el;
        }
      }
    }

    // 2. Check schema buttons
    if (formSchema && formSchema.buttons) {
      const primary = formSchema.buttons.find((b) => b.is_primary);
      if (primary) {
        const el = this._findElement(primary.selector);
        if (el && el.offsetParent !== null && !el.disabled) return el;
      }
    }

    // 3. Fallback: search visible buttons by text
    const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
    return (
      allButtons.find((b) => {
        if (b.closest('#jobsearch, form[role="search"], header, nav, footer')) return false;
        const txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').toLowerCase().trim();
        return (
          (txt.includes('continue') || txt.includes('next') || txt.includes('submit') || txt.includes('review') || txt.includes('apply now')) &&
          !txt.includes('back') &&
          !txt.includes('cancel') &&
          !txt.includes('dismiss') &&
          !b.disabled &&
          b.offsetParent !== null
        );
      }) || null
    );
  },

  async _pauseForUserIntervention(element, message, questionLabel = '') {
    const cursor = window.TrackyCursor;
    const overlay = window.TrackyOverlay;
    const api = window.TrackyAPI;

    this.paused = true;

    if (element) {
      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await cursor.moveTo(element);
        element.style.outline = '2px solid #f59e0b';
        element.style.outlineOffset = '3px';
      } catch (e) {}
    }

    const questionToSave =
      questionLabel ||
      element?.getAttribute('aria-label') ||
      element?.closest('label')?.innerText ||
      element?.closest('.ia-Form-item, .ia-Questions-item, .jobs-easy-apply-form-section__grouping')?.querySelector('label, legend, span')?.innerText ||
      message ||
      '';

    return new Promise((resolve) => {
      cursor.showSpeechBubble({
        title: 'Input Needed',
        message: message || 'Please complete this question to continue:',
        targetElement: element,
        onSubmit: async (userAnswer) => {
          if (element) {
            element.style.outline = '';
            if (userAnswer && (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea')) {
              await cursor.type(element, userAnswer);
            }
          }
          // Persist to SQLite Q&A Knowledge Base
          if (questionToSave && userAnswer && api?.saveQAPair) {
            try {
              await api.saveQAPair(questionToSave.replace(/[\n\r]+/g, ' ').trim(), userAnswer);
              console.log('[Tracky] Persisted Q&A to knowledge base:', questionToSave, '=>', userAnswer);
            } catch (err) {
              console.warn('[Tracky] Failed to persist Q&A:', err);
            }
          }
          this.paused = false;
          resolve();
        },
        onSkip: () => {
          if (element) element.style.outline = '';
          this.paused = false;
          resolve();
        },
        onManual: () => {
          overlay?.showStuck(
            'Complete the field on screen, then click Continue.',
            () => {
              if (element) element.style.outline = '';
              this.paused = false;
              resolve();
            },
            () => {
              if (element) element.style.outline = '';
              this.stop();
              resolve();
            }
          );
        }
      });
    });
  },

  _pickFirstUnfilledInput() {
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]), textarea, select, [role="radio"]')
    ).filter((el) => {
      if (el.closest('#jobsearch, form[role="search"], header, nav, footer')) return false;
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

    const indeedCompany = document.querySelector('[data-testid="inlineHeader-companyName"], .jobsearch-CompanyInfoContainer, .jobsearch-JobInfoHeader-companyName');
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
      overlay?.setStatus('Session paused');
    } else {
      overlay?.setStatus('Resuming session...');
    }
  },

  cancel() {
    this.running = false;
    this.paused = false;
    window.TrackyCursor.isAINavigating = false;
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
