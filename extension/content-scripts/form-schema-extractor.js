/**
 * Tracky Semantic Form Schema Extractor.
 * Parses active job application forms, modals, and questions into structured JSON.
 * Provides full-page awareness (above & below fold) with zero screenshot overhead.
 */
window.TrackyFormExtractor = {
  /**
   * Extracts a comprehensive structured schema of all interactive questions,
   * inputs, dropdowns, radios, checkboxes, and buttons on the current page/modal.
   */
  extractFormSchema() {
    try {
      const container = this._findFormContainer();
      const heading = this._findHeading(container);

      const fields = [];
      const processedElements = new Set();

      // ── STRATEGY 1: Extract discrete Question Blocks / Item Containers ────
      const questionBlockSelectors = [
        '.ia-Questions-item',
        '.ia-Form-item',
        'div[class*="Questions-item"]',
        'div[class*="question-item"]',
        '[data-testid*="question" i]',
        '[data-testid*="Question" i]',
        '.jobs-easy-apply-form-section__grouping',
        '.jobs-easy-apply-form-element',
        'fieldset[data-test-form-builder-radio-button-form-component]',
        'div[data-test-single-line-text-form-component]',
        'fieldset',
        'div[role="radiogroup"]',
        '.form-group',
        '.form-field'
      ];

      const questionBlocks = Array.from(
        container.querySelectorAll(questionBlockSelectors.join(', '))
      ).filter((block) => {
        // Skip header search blocks
        if (block.closest('#jobsearch, form[role="search"], header, nav, footer, [data-testid="searchform"]')) {
          return false;
        }
        return true;
      });

      questionBlocks.forEach((block, index) => {
        // Find inputs inside this specific question block
        const blockRadios = Array.from(block.querySelectorAll('input[type="radio"], [role="radio"]'));
        const blockSelect = block.querySelector('select');
        const blockCheckbox = block.querySelector('input[type="checkbox"], [role="checkbox"]');
        const blockTextInputs = Array.from(
          block.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea')
        );
        const blockFileInput = block.querySelector('input[type="file"]');

        const qTitle = this._getQuestionBlockTitle(block) || `Question ${index + 1}`;
        const isRequired =
          block.querySelector('[aria-required="true"], [required], .ia-Questions-requiredBadge, [class*="required"]') !== null ||
          qTitle.includes('*') ||
          qTitle.toLowerCase().includes('required');

        // A. Radio Group inside this question block
        if (blockRadios.length > 0) {
          blockRadios.forEach((r) => processedElements.add(r));
          const options = blockRadios.map((r) => {
            const optLabel = this._getRadioOptionLabel(r);
            return {
              label: optLabel,
              value: r.value || optLabel,
              selector: this._getUniqueSelector(r),
              checked: !!r.checked
            };
          });

          fields.push({
            name: `radio_group_${index}_${qTitle.slice(0, 20)}`,
            label: qTitle,
            type: 'radio_group',
            required: isRequired,
            options: options,
            is_answered: options.some((o) => o.checked)
          });
          return;
        }

        // B. Select Dropdown inside this question block
        if (blockSelect) {
          processedElements.add(blockSelect);
          const options = Array.from(blockSelect.options || []).map((opt) => ({
            label: opt.text.trim(),
            value: opt.value
          }));
          const val = blockSelect.value || '';
          const isAnswered = val !== '' && !val.toLowerCase().includes('select') && blockSelect.selectedIndex > 0;

          fields.push({
            selector: this._getUniqueSelector(blockSelect),
            label: qTitle,
            type: 'select',
            required: isRequired || blockSelect.required,
            current_value: val,
            options: options.slice(0, 40),
            is_answered: isAnswered
          });
          return;
        }

        // C. Checkbox inside this question block
        if (blockCheckbox) {
          processedElements.add(blockCheckbox);
          fields.push({
            selector: this._getUniqueSelector(blockCheckbox),
            label: qTitle,
            type: 'checkbox',
            required: isRequired || blockCheckbox.required,
            checked: !!blockCheckbox.checked,
            is_answered: !!blockCheckbox.checked
          });
          return;
        }

        // D. File Input (Resume upload)
        if (blockFileInput) {
          processedElements.add(blockFileInput);
          fields.push({
            selector: this._getUniqueSelector(blockFileInput),
            label: qTitle || 'Resume Upload',
            type: 'file',
            required: isRequired,
            is_answered: true
          });
          return;
        }

        // E. Text / Number / Tel / Textarea inside this question block
        if (blockTextInputs.length > 0) {
          blockTextInputs.forEach((inputEl) => {
            processedElements.add(inputEl);
            const val = (inputEl.value || '').trim();
            const subLabel = this._getLabelText(inputEl) || qTitle;
            fields.push({
              selector: this._getUniqueSelector(inputEl),
              label: subLabel,
              type: (inputEl.type || 'text').toLowerCase(),
              placeholder: inputEl.placeholder || '',
              required: isRequired || inputEl.required,
              current_value: val,
              is_answered: val.length > 0
            });
          });
        }
      });

      // ── STRATEGY 2: Extract remaining standalone inputs not in blocks ───────
      const allInputs = Array.from(
        container.querySelectorAll(
          'input, select, textarea, [role="radio"], [role="checkbox"], [role="combobox"], [contenteditable="true"]'
        )
      );

      allInputs.forEach((el) => {
        if (processedElements.has(el)) return;
        if (el.type === 'hidden') return;

        // Skip search bar inputs
        if (
          el.id === 'what' ||
          el.id === 'where' ||
          el.name === 'q' ||
          el.name === 'l' ||
          el.closest('#jobsearch, form[role="search"], header, nav, footer, [data-testid="searchform"]')
        ) {
          return;
        }

        const tag = el.tagName.toLowerCase();
        const type = (el.type || 'text').toLowerCase();
        const selector = this._getUniqueSelector(el);
        const label = this._getLabelText(el);
        const required = el.required || el.getAttribute('aria-required') === 'true' || (label && label.includes('*'));
        const currentValue = (el.value || el.innerText || '').trim();

        if (type === 'radio') {
          const optLabel = this._getRadioOptionLabel(el);
          fields.push({
            selector: selector,
            label: label || optLabel,
            type: 'radio_group',
            required: required,
            options: [{ label: optLabel, value: el.value || optLabel, selector: selector, checked: el.checked }],
            is_answered: el.checked
          });
        } else if (tag === 'select') {
          const options = Array.from(el.options || []).map((opt) => ({
            label: opt.text.trim(),
            value: opt.value
          }));
          fields.push({
            selector: selector,
            label: label,
            type: 'select',
            required: required,
            current_value: currentValue,
            options: options.slice(0, 30),
            is_answered: currentValue.length > 0
          });
        } else if (type === 'checkbox') {
          fields.push({
            selector: selector,
            label: label,
            type: 'checkbox',
            required: required,
            checked: el.checked,
            is_answered: el.checked
          });
        } else if (type === 'file') {
          fields.push({
            selector: selector,
            label: label || 'Resume / CV',
            type: 'file',
            required: required,
            is_answered: true
          });
        } else {
          fields.push({
            selector: selector,
            label: label,
            type: type,
            placeholder: el.placeholder || '',
            required: required,
            current_value: currentValue,
            is_answered: currentValue.length > 0
          });
        }
      });

      // ── STRATEGY 3: Discover Primary Action Buttons (Continue, Next, Submit) ─
      const buttons = [];
      const buttonCandidates = container.querySelectorAll(
        'button, input[type="button"], input[type="submit"], a[role="button"], [class*="Button"]'
      );

      buttonCandidates.forEach((btn) => {
        if (btn.closest('#jobsearch, form[role="search"], header, nav, [data-testid="searchform"]')) return;
        const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || '').trim();
        if (!text || btn.disabled) return;

        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const selector = this._getUniqueSelector(btn);
        buttons.push({
          selector: selector,
          label: text,
          type: btn.type || 'button',
          is_primary: this._isPrimaryButton(btn, text)
        });
      });

      return {
        page_title: document.title,
        heading: heading,
        fields_count: fields.length,
        fields: fields.slice(0, 50),
        buttons: buttons.slice(0, 10)
      };
    } catch (err) {
      console.warn('[TrackyFormExtractor] Error extracting form schema:', err);
      return null;
    }
  },

  _findFormContainer() {
    const primarySelectors = [
      '.jobs-easy-apply-modal',
      'div[data-test-modal-id="easy-apply-modal"]',
      '.ia-BasePage',
      '[data-testid="ia-container"]',
      '#ia-container',
      '.ia-QuestionsContainer',
      'div[class*="ia-Container"]',
      'div[class*="ia-Form"]',
      'div[role="dialog"]:not([aria-hidden="true"])',
      'form:not(#jobsearch):not([role="search"]):not([action*="search"])',
      'main'
    ];

    for (const sel of primarySelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        const hasFormControls = el.querySelector('input:not([type="hidden"]), select, textarea, [role="radio"], button');
        if (hasFormControls) return el;
      }
    }

    return document.body;
  },

  _findHeading(container) {
    const h = container.querySelector(
      'h1, h2, h3, .ia-BasePage-heading, [class*="heading"], [class*="header"], [data-testid*="header"]'
    );
    return h ? h.innerText.trim() : '';
  },

  _getQuestionBlockTitle(block) {
    // 1. Check legend / header in block
    const headingEl = block.querySelector(
      'legend, .ia-Question-header, .ia-Questions-legend, .ia-Questions-label, [data-testid*="questionText" i], span[data-test-form-element-label-title], h2, h3, h4, h5, [class*="header"], [class*="title"], [class*="Question"]'
    );
    if (headingEl && headingEl.innerText.trim()) {
      return headingEl.innerText.replace(/[\n\r]+/g, ' ').trim();
    }

    // 2. Check direct label
    const labelEl = block.querySelector('label');
    if (labelEl && labelEl.innerText.trim()) {
      return labelEl.innerText.replace(/[\n\r]+/g, ' ').trim();
    }

    // 3. Check block text before inputs
    return '';
  },

  _getRadioOptionLabel(el) {
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input');
      inputs.forEach((i) => i.remove());
      const txt = clone.innerText.trim();
      if (txt) return txt;
    }
    if (el.id) {
      const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (explicitLabel && explicitLabel.innerText.trim()) return explicitLabel.innerText.trim();
    }
    const sibling = el.nextElementSibling;
    if (sibling && sibling.innerText && sibling.innerText.trim()) return sibling.innerText.trim();
    return el.value || 'Option';
  },

  _getLabelText(el) {
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }
    if (el.getAttribute('aria-labelledby')) {
      const labelId = el.getAttribute('aria-labelledby');
      const labelEl = document.getElementById(labelId);
      if (labelEl && labelEl.innerText.trim()) return labelEl.innerText.trim();
    }
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl && labelEl.innerText.trim()) return labelEl.innerText.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText.trim()) {
      return parentLabel.innerText.trim();
    }
    const parent = el.parentElement;
    if (parent) {
      const prevLabel = parent.querySelector('label, span[class*="label"], [class*="title"], p');
      if (prevLabel && prevLabel !== el && prevLabel.innerText.trim()) return prevLabel.innerText.trim();
    }
    return el.placeholder || el.name || el.id || '';
  },

  _getUniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.getAttribute('data-testid')) {
      return `[data-testid="${el.getAttribute('data-testid')}"]`;
    }
    if (el.name) {
      const tag = el.tagName.toLowerCase();
      return `${tag}[name="${CSS.escape(el.name)}"]`;
    }
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(/\s+/).filter((c) => c && !c.includes(':') && !c.includes('(') && c.length < 30);
      if (classes.length > 0) {
        return `${el.tagName.toLowerCase()}.${classes.slice(0, 2).join('.')}`;
      }
    }
    return el.tagName.toLowerCase();
  },

  _isPrimaryButton(btn, text) {
    const lower = text.toLowerCase();
    return (
      lower.includes('continue') ||
      lower.includes('next') ||
      lower.includes('submit') ||
      lower.includes('apply') ||
      lower.includes('review')
    );
  }
};
