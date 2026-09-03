/**
 * DOM utility helpers for Tracky Chrome Extension.
 */
window.TrackyDOM = {
  /**
   * Wait for a DOM element matching selector to appear.
   */
  waitForElement(selector, timeoutMs = 8000, parent = document) {
    return new Promise((resolve) => {
      const existing = parent.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = parent.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(parent.body || parent, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  },

  /**
   * Sleep helper.
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Safe native click simulation.
   */
  async simulateClick(element) {
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(150);

    // Trigger focus and mouse events
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.focus();
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  },

  /**
   * Set value and dispatch native input/change events for React/Vue/Angular forms.
   */
  simulateInput(element, value) {
    if (!element) return;
    element.focus();

    // Workaround for React 16+ controlled inputs (which override setter)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
    } else if (element instanceof HTMLInputElement && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
};
