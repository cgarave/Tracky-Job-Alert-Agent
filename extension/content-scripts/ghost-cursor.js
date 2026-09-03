/**
 * Tracky Visual Ghost Cursor & Natural Typing Simulator.
 * Non-blocking (pointer-events: none) human navigation co-pilot.
 */
window.TrackyCursor = {
  cursorEl: null,
  currentX: 100,
  currentY: 100,
  enabled: true,

  init() {
    if (this.cursorEl) return;
    this.cursorEl = document.createElement('div');
    this.cursorEl.id = 'tracky-ghost-cursor';
    this.cursorEl.innerHTML = '<div class="cursor-pointer"></div>';
    document.body.appendChild(this.cursorEl);
  },

  async setEnabled(enabled) {
    this.enabled = enabled;
  },

  /**
   * Smoothly move the ghost cursor to the center of the target element.
   */
  async moveTo(element, durationMs = 350) {
    if (!this.enabled || !element) return;
    this.init();
    this.cursorEl.style.display = 'block';

    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await new Promise((r) => setTimeout(r, 80));

    const rect = element.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    const startX = this.currentX;
    const startY = this.currentY;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Ease-out cubic curve
        const ease = 1 - Math.pow(1 - progress, 3);
        const curX = startX + (targetX - startX) * ease;
        const curY = startY + (targetY - startY) * ease;

        this.cursorEl.style.left = `${curX}px`;
        this.cursorEl.style.top = `${curY}px`;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          this.currentX = targetX;
          this.currentY = targetY;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  },

  /**
   * Trigger a visual click ripple at current cursor position and click the element.
   */
  async click(element) {
    if (!element) return;

    if (this.enabled) {
      await this.moveTo(element, 250);

      // Create click ripple
      const ripple = document.createElement('div');
      ripple.className = 'tracky-click-ripple';
      ripple.style.left = `${this.currentX}px`;
      ripple.style.top = `${this.currentY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);

      element.classList.add('tracky-highlight-field');
      setTimeout(() => element.classList.remove('tracky-highlight-field'), 400);
      await new Promise((r) => setTimeout(r, 120));
    }

    await window.TrackyDOM.simulateClick(element);
  },

  /**
   * Type text with human-like cadence into an input or textarea.
   */
  async type(element, text) {
    if (!element || text === undefined || text === null) return;

    if (this.enabled) {
      await this.moveTo(element, 200);
      element.classList.add('tracky-highlight-field');
      element.focus();

      // Human-like typing cadence (max 30 chars animated, rest instant for long text)
      const animatedLength = Math.min(text.toString().length, 40);
      let currentVal = '';

      for (let i = 0; i < animatedLength; i++) {
        currentVal += text.toString()[i];
        window.TrackyDOM.simulateInput(element, currentVal);
        const delay = Math.floor(Math.random() * 25) + 20; // 20-45ms
        await new Promise((r) => setTimeout(r, delay));
      }

      if (text.toString().length > animatedLength) {
        window.TrackyDOM.simulateInput(element, text.toString());
      }

      setTimeout(() => element.classList.remove('tracky-highlight-field'), 300);
    } else {
      window.TrackyDOM.simulateInput(element, text.toString());
    }
  },

  hide() {
    if (this.cursorEl) {
      this.cursorEl.style.display = 'none';
    }
  }
};
