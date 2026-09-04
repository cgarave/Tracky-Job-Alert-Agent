/**
 * DOM utility helpers for Tracky Chrome Extension.
 * Provides realistic human event simulation, smooth scrolling, and reactive input binding.
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
   * Smooth, human-like scroll to target element with settling delay.
   * Skips scroll if element is already comfortably in viewport.
   */
  async smoothScrollTo(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const vh = window.innerHeight;
    const isComfortablyVisible = rect.top >= 80 && rect.bottom <= vh - 80;

    if (!isComfortablyVisible) {
      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(280);
      } catch (e) {}
    }
  },

  /**
   * Realistic human click simulation with natural event sequence and hold duration.
   */
  async simulateClick(element) {
    if (!element) return false;

    await this.smoothScrollTo(element);
    await this.sleep(60);

    const mouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      buttons: 1
    };

    element.dispatchEvent(new PointerEvent('pointerover', mouseEventInit));
    element.dispatchEvent(new MouseEvent('mouseover', mouseEventInit));
    element.dispatchEvent(new PointerEvent('pointerdown', mouseEventInit));
    element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));

    if (typeof element.focus === 'function') {
      element.focus();
    }

    // Natural human finger/mouse press hold (70ms - 130ms)
    const pressDuration = Math.floor(Math.random() * 60) + 70;
    await this.sleep(pressDuration);

    element.dispatchEvent(new PointerEvent('pointerup', mouseEventInit));
    element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
    element.dispatchEvent(new MouseEvent('click', mouseEventInit));

    // Also call native .click() for React/LinkedIn/Indeed link or button triggers
    if (typeof element.click === 'function') {
      try {
        element.click();
      } catch (e) {}
    }

    return true;
  },

  /**
   * Set value and dispatch native input/change events for React/Vue/Angular forms.
   */
  simulateInput(element, value) {
    if (!element) return;
    if (typeof element.focus === 'function') {
      element.focus();
    }

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
