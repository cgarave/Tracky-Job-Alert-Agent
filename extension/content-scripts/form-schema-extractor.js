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
      // 1. Identify primary container (modal, dialog, or form container)
      const container = this._findFormContainer();

      // 2. Extract title / step heading
      const heading = this._findHeading(container);

      // 3. Extract all interactive form controls
      const fields = [];
      const radioGroups = {};

      const inputs = container.querySelectorAll(
        'input, select, textarea, [role="radio"], [role="checkbox"], [role="combobox"], [contenteditable="true"]'
      );

      inputs.forEach((el) => {
        // Skip hidden or invisible elements
        if (el.type === 'hidden') return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && window.getComputedStyle(el).display === 'none') {
          return;
        }

        const tag = el.tagName.toLowerCase();
        const type = (el.type || 'text').toLowerCase();
        const selector = this._getUniqueSelector(el);
        const label = this._getLabelText(el);
        const required = el.required || el.getAttribute('aria-required') === 'true';
        const currentValue = el.value || el.innerText || '';

        // Handle radio groups
        if (type === 'radio') {
          const groupName = el.name || label || 'radio_group';
          if (!radioGroups[groupName]) {
            radioGroups[groupName] = {
              name: groupName,
              label: this._getFieldsetLegend(el) || label,
              type: 'radio_group',
              required: required,
              options: []
            };
          }
          radioGroups[groupName].options.push({
            label: label || el.value || 'Option',
            value: el.value || '',
            selector: selector,
            checked: el.checked
          });
          return;
        }

        // Handle select dropdowns
        if (tag === 'select') {
          const options = Array.from(el.options || []).map((opt) => ({
            label: opt.text.trim(),
            value: opt.value
          }));
          fields.push({
            selector: selector,
            label: label,
            type: 'select',
            required: required,
            current_value: el.value,
            options: options.slice(0, 20)
          });
          return;
        }

        // Handle file upload
        if (type === 'file') {
          fields.push({
            selector: selector,
            label: label || 'Resume / CV Upload',
            type: 'file',
            required: required
          });
          return;
        }

        // Handle checkbox
        if (type === 'checkbox') {
          fields.push({
            selector: selector,
            label: label,
            type: 'checkbox',
            required: required,
            checked: el.checked
          });
          return;
        }

        // Handle standard text / email / tel / number / textarea
        fields.push({
          selector: selector,
          label: label,
          type: type,
          placeholder: el.placeholder || '',
          required: required,
          current_value: currentValue.trim()
        });
      });

      // Add grouped radios into fields array
      Object.values(radioGroups).forEach((rg) => {
        fields.push(rg);
      });

      // 4. Discover Primary Action Buttons (Continue, Next, Submit, Apply, Review)
      const buttons = [];
      const btnEls = container.querySelectorAll(
        'button, input[type="submit"], input[type="button"], a[role="button"], .ia-IndeedApplyButton, [class*="apply-button"]'
      );

      btnEls.forEach((btn) => {
        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || '').trim();
        if (!text || text.length > 40) return;

        const selector = this._getUniqueSelector(btn);
        buttons.push({
          selector: selector,
          label: text,
          type: btn.type || 'button',
          is_primary: this._isPrimaryButton(btn, text)
        });
      });

      // If no fields and no buttons, return null
      if (fields.length === 0 && buttons.length === 0) {
        return null;
      }

      return {
        page_title: document.title,
        heading: heading,
        fields_count: fields.length,
        fields: fields.slice(0, 30),
        buttons: buttons.slice(0, 10)
      };
    } catch (err) {
      console.warn('[TrackyFormExtractor] Error extracting form schema:', err);
      return null;
    }
  },

  _findFormContainer() {
    // Look for active modal dialogs first
    const modal = document.querySelector(
      'div[role="dialog"], div[aria-modal="true"], .jobs-easy-apply-modal, .ia-BasePage, form'
    );
    if (modal) return modal;
    return document.body;
  },

  _findHeading(container) {
    const h = container.querySelector('h1, h2, h3, .ia-BasePage-heading, [class*="heading"], [class*="header"]');
    return h ? h.innerText.trim() : '';
  },

  _getLabelText(el) {
    // 1. Check aria-label or aria-labelledby
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }
    if (el.getAttribute('aria-labelledby')) {
      const labelEl = document.getElementById(el.getAttribute('aria-labelledby'));
      if (labelEl) return labelEl.innerText.trim();
    }

    // 2. Check <label for="id">
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl) return labelEl.innerText.trim();
    }

    // 3. Check enclosing <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      return parentLabel.innerText.trim();
    }

    // 4. Check enclosing div / container text
    const parent = el.parentElement;
    if (parent) {
      const prevLabel = parent.querySelector('label, span[class*="label"], [class*="title"], p');
      if (prevLabel && prevLabel !== el) return prevLabel.innerText.trim();
    }

    // 5. Fallback to name or placeholder
    return el.name || el.placeholder || el.id || '';
  },

  _getFieldsetLegend(el) {
    const fieldset = el.closest('fieldset, div[role="radiogroup"], [class*="radio-group"]');
    if (fieldset) {
      const legend = fieldset.querySelector('legend, [class*="legend"], label, h4, h5');
      if (legend) return legend.innerText.trim();
    }
    return '';
  },

  _getUniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.getAttribute('data-testid')) {
      return `[data-testid="${el.getAttribute('data-testid')}"]`;
    }
    if (el.name) {
      const tag = el.tagName.toLowerCase();
      return `${tag}[name="${el.name}"]`;
    }
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(/\s+/).filter((c) => c && !c.includes(':') && c.length < 30);
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
