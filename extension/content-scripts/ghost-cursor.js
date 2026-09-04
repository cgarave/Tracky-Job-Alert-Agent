/**
 * Tracky Pure Figma Amber Orange Cursor & Expressive Co-Pilot.
 *
 * 1. Shows a sleek Figma multiplayer cursor in vibrant Amber Orange.
 * 2. Expressive personality: flying swoops, curious head-tilts, joyful puppy hops,
 *    floating amber paws, and gentle ambient breathing when resting.
 * 3. 100% continuous, fluid motion: zero coordinate snapping or teleporting.
 * 4. Human-grade movement physics: Fitts' law distance scaling, organic Bezier curves,
 *    natural click press holds, and authentic keystroke cadence.
 */
window.TrackyCursor = {
  cursorEl: null,

  // Position coordinates
  currentX: 160,
  currentY: 160,
  targetX: 160,
  targetY: 160,

  // State
  enabled: false,
  cursorColor: '#F59E0B',
  cursorStyle: 'figma_arrow',
  isAINavigating: false,
  idleTimerId: null,
  activeAnimResolve: null,

  _getCursorSVG(styleType, color) {
    switch (styleType) {
      case 'modern_wedge':
        return `
          <svg class="tracky-cursor-svg" viewBox="0 0 18 18" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 6px ${color}80);">
            <polygon points="1,1 17,7 9,10 6,17" fill="${color}" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
        `;
      case 'glowing_orb':
        return `
          <svg class="tracky-cursor-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 8px ${color});">
            <circle cx="12" cy="12" r="6" fill="${color}"/>
            <circle cx="12" cy="12" r="9.5" stroke="${color}" stroke-width="1.8" stroke-dasharray="3 3" class="orb-pulse"/>
            <circle cx="12" cy="12" r="2.5" fill="#FFFFFF"/>
          </svg>
        `;
      case 'co_pilot_hand':
        return `
          <svg class="tracky-cursor-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 6px ${color}80);">
            <path d="M7 11V4a2 2 0 0 1 4 0v6M11 7.5a2 2 0 0 1 4 0v3.5M15 9a2 2 0 0 1 4 0v3c0 4.418-3.582 8-8 8H9a6 6 0 0 1-6-6v-2.5a2 2 0 0 1 4 0V11" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 11V4a2 2 0 0 1 4 0v6M11 7.5a2 2 0 0 1 4 0v3.5M15 9a2 2 0 0 1 4 0v3c0 4.418-3.582 8-8 8H9a6 6 0 0 1-6-6v-2.5a2 2 0 0 1 4 0V11" fill="${color}" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      case 'figma_arrow':
      default:
        return `
          <svg class="tracky-cursor-svg tracky-figma-arrow" viewBox="0 0 17 22" width="22" height="26" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 6px ${color}80);">
            <path d="M0.5 0.5V19.5L5.5 14.5H12.5L0.5 0.5Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
        `;
    }
  },

  _ensureCursorDOM() {
    if (window !== window.top) return;

    const existing = document.querySelectorAll('#tracky-ghost-cursor');
    if (existing.length > 0) {
      this.cursorEl = existing[0];
      for (let i = 1; i < existing.length; i++) {
        existing[i].remove();
      }
      // Preserve existing coordinate location without snapping
      const curLeft = parseFloat(this.cursorEl.style.left);
      const curTop = parseFloat(this.cursorEl.style.top);
      if (!isNaN(curLeft) && !isNaN(curTop) && curLeft > 0 && curTop > 0) {
        this.currentX = curLeft;
        this.currentY = curTop;
        this.targetX = curLeft;
        this.targetY = curTop;
      }
      return;
    }

    this.cursorEl = document.createElement('div');
    this.cursorEl.id = 'tracky-ghost-cursor';
    this.cursorEl.className = 'tracky-ambient-breathe';
    this.cursorEl.innerHTML = `
      <div class="tracky-cursor-wrapper">
        ${this._getCursorSVG(this.cursorStyle, this.cursorColor)}
      </div>
    `;

    document.body.appendChild(this.cursorEl);

    this.currentX = Math.max(40, window.innerWidth - 90);
    this.currentY = Math.max(40, window.innerHeight - 120);
    this.targetX = this.currentX;
    this.targetY = this.currentY;
    this.cursorEl.style.left = `${this.currentX}px`;
    this.cursorEl.style.top = `${this.currentY}px`;
  },

  updateCursorAppearance() {
    if (!this.cursorEl) return;
    const wrapper = this.cursorEl.querySelector('.tracky-cursor-wrapper');
    if (wrapper) {
      wrapper.innerHTML = this._getCursorSVG(this.cursorStyle, this.cursorColor);
    }
  },

  init() {
    this.syncSettings();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.ai_settings) {
          this.applySettings(changes.ai_settings.newValue);
        }
      });
    }
  },

  applySettings(settings) {
    if (!settings) return;
    if (settings.cursor_color) {
      this.cursorColor = settings.cursor_color;
    }
    if (settings.cursor_style) {
      this.cursorStyle = settings.cursor_style;
    }
    const shouldEnable = !!settings.enable_ghost_cursor;
    this.setEnabled(shouldEnable);
    if (shouldEnable) {
      this.updateCursorAppearance();
    }
  },

  async syncSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const cached = await chrome.storage.local.get(['ai_settings']);
        if (cached && cached.ai_settings) {
          this.applySettings(cached.ai_settings);
        }
      }
    } catch (e) {}

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'GET_AI_SETTINGS' }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res && res.settings) {
            this.applySettings(res.settings);
          }
        });
      }
    } catch (e) {}
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled) {
      this._ensureCursorDOM();
      if (this.cursorEl) {
        this.cursorEl.style.display = 'block';
      }
      this._startIdleAutonomousExplorer();
    } else {
      if (this.cursorEl) {
        this.cursorEl.style.display = 'none';
        this.cursorEl.remove();
        this.cursorEl = null;
      }
      if (this.idleTimerId) {
        clearTimeout(this.idleTimerId);
        this.idleTimerId = null;
      }
      this.hideSpeechBubble();
    }
  },

  /**
   * Playful Idle Explorer: Gently explores nearby main content elements when idle.
   */
  _startIdleAutonomousExplorer() {
    if (this.idleTimerId) {
      clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }

    const scheduleNextWander = () => {
      if (!this.enabled || this.isAINavigating) return;

      const delay = Math.floor(Math.random() * 3500) + 4500;
      this.idleTimerId = setTimeout(async () => {
        if (this.enabled && !this.isAINavigating) {
          await this._exploreRandomDOMElement();
        }
        scheduleNextWander();
      }, delay);
    };

    scheduleNextWander();
  },

  async _exploreRandomDOMElement() {
    const el = this._pickRandomVisibleElement();
    if (!el || this.isAINavigating) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    if (rect.bottom < 60 || rect.top > vh - 60 || rect.right < 40 || rect.left > vw - 40) {
      return;
    }

    const destX = Math.min(Math.max(40, rect.left + Math.random() * Math.min(rect.width, 80) + 10), vw - 50);
    const destY = Math.min(Math.max(40, rect.top + Math.random() * Math.min(rect.height, 40) + 10), vh - 50);

    const duration = Math.floor(Math.random() * 200) + 500;
    await this._swoopTo(destX, destY, duration);

    if (!this.isAINavigating && this.cursorEl) {
      if (Math.random() < 0.6) {
        this.cursorEl.classList.add('curious-tilt');
        setTimeout(() => this.cursorEl?.classList.remove('curious-tilt'), 700);
      } else {
        this.cursorEl.classList.add('playful-bounce');
        setTimeout(() => this.cursorEl?.classList.remove('playful-bounce'), 450);
      }

      setTimeout(() => {
        if (!this.isAINavigating && this.cursorEl) {
          this.cursorEl.classList.add('tracky-ambient-breathe');
        }
      }, 750);
    }
  },

  _pickRandomVisibleElement() {
    // Strictly search within main content, excluding header, nav, notifications, and alerts
    const candidates = Array.from(
      document.querySelectorAll(
        'main article, .jobsearch-JobComponent, [class*="JobComponent"], [class*="job-card"], [class*="jobsearch-ViewJobLayout"], .jobs-easy-apply-content, [class*="ia-BasePage"], main [class*="card"]'
      )
    ).filter((el) => {
      // Exclude notification bell, job alert bars, and header/nav elements
      if (
        el.closest('header, nav, #gnav, #jobsearch, .jobsearch-JobAlert, [data-testid*="notification" i], [data-testid*="jobalert" i]')
      ) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 40 &&
        rect.height > 20 &&
        rect.top >= 70 &&
        rect.bottom <= window.innerHeight - 70 &&
        rect.left >= 40 &&
        rect.right <= window.innerWidth - 40 &&
        window.getComputedStyle(el).visibility !== 'hidden' &&
        window.getComputedStyle(el).display !== 'none'
      );
    });

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  async _swoopTo(destX, destY, durationMs = 500) {
    if (!this.cursorEl) return;
    this.cursorEl.classList.remove('tracky-ambient-breathe', 'playful-bounce', 'curious-tilt');
    this.cursorEl.classList.add('flying-swoop');

    const startX = this.currentX;
    const startY = this.currentY;

    const midX = (startX + destX) / 2;
    const midY = (startY + destY) / 2;
    const arcDeviation = (Math.random() - 0.5) * 40;
    const controlX = midX + arcDeviation;
    const controlY = midY - Math.abs(arcDeviation) * 0.4;

    const startTime = performance.now();

    return new Promise((resolve) => {
      this.activeAnimResolve = resolve;

      const step = (currentTime) => {
        if (this.isAINavigating) {
          this.cursorEl?.classList.remove('flying-swoop');
          this.activeAnimResolve = null;
          return resolve();
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        const ease = 1 - Math.pow(1 - progress, 3);
        const inv = 1 - ease;

        this.currentX = inv * inv * startX + 2 * inv * ease * controlX + ease * ease * destX;
        this.currentY = inv * inv * startY + 2 * inv * ease * controlY + ease * ease * destY;

        if (this.cursorEl) {
          this.cursorEl.style.left = `${this.currentX.toFixed(1)}px`;
          this.cursorEl.style.top = `${this.currentY.toFixed(1)}px`;
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          this.currentX = destX;
          this.currentY = destY;
          this.targetX = destX;
          this.targetY = destY;
          this.cursorEl?.classList.remove('flying-swoop');
          this.activeAnimResolve = null;
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  },

  /**
   * Human-Grade Natural Movement during AI Navigation.
   * Continuous, fluid interpolation with zero coordinate teleporting.
   */
  async moveTo(element, customDuration = null) {
    if (!element) return;
    if (!this.enabled) {
      this.setEnabled(true);
    }
    this._ensureCursorDOM();
    if (!this.cursorEl) return;
    this.cursorEl.style.display = 'block';

    // Cancel any ongoing idle wander immediately
    if (this.activeAnimResolve) {
      this.activeAnimResolve();
      this.activeAnimResolve = null;
    }

    this.cursorEl.classList.remove('tracky-ambient-breathe', 'playful-bounce', 'curious-tilt');

    // Smooth scroll if element is outside viewport and wait for scroll to fully settle
    await window.TrackyDOM.smoothScrollTo(element);
    await window.TrackyDOM.sleep(70);

    const rect = element.getBoundingClientRect();

    const varianceX = (Math.random() - 0.5) * 6;
    const varianceY = (Math.random() - 0.5) * 4;
    const destX = rect.left + Math.min(Math.max(rect.width / 2, 10), 60) + varianceX;
    const destY = rect.top + Math.min(Math.max(rect.height / 2, 8), 24) + varianceY;

    // Seamless origin from current continuous coordinates
    const startX = this.currentX;
    const startY = this.currentY;

    const dist = Math.hypot(destX - startX, destY - startY);
    const durationMs = customDuration || Math.min(Math.max(260, dist * 0.45 + 160), 550) + (Math.random() * 40 - 20);

    const midX = (startX + destX) / 2;
    const midY = (startY + destY) / 2;
    const arcDeviation = (Math.random() - 0.5) * Math.min(dist * 0.18, 32);
    const controlX = midX + arcDeviation;
    const controlY = midY - Math.abs(arcDeviation) * 0.5;

    this.cursorEl.classList.add('flying-swoop');

    const startTime = performance.now();

    await new Promise((resolve) => {
      this.activeAnimResolve = resolve;

      const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        const ease = 1 - Math.pow(1 - progress, 3);
        const inv = 1 - ease;

        this.currentX = inv * inv * startX + 2 * inv * ease * controlX + ease * ease * destX;
        this.currentY = inv * inv * startY + 2 * inv * ease * controlY + ease * ease * destY;

        if (this.cursorEl) {
          this.cursorEl.style.left = `${this.currentX.toFixed(1)}px`;
          this.cursorEl.style.top = `${this.currentY.toFixed(1)}px`;
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          this.currentX = destX;
          this.currentY = destY;
          this.targetX = destX;
          this.targetY = destY;
          this.activeAnimResolve = null;
          resolve();
        }
      };

      requestAnimationFrame(step);
    });

    this.cursorEl.classList.remove('flying-swoop');

    // Curious head-tilt on arrival
    this.cursorEl.classList.add('curious-tilt');
    setTimeout(() => this.cursorEl?.classList.remove('curious-tilt'), 300);

    await window.TrackyDOM.sleep(Math.floor(Math.random() * 50) + 60);
  },

  /**
   * Expressive Click: Pre-click hover -> Click ripple + Floating paw -> Press hold -> Joyful puppy hop.
   */
  async click(element) {
    if (!element) return;

    if (this.enabled) {
      await this.moveTo(element);

      // Pre-click hover hesitation (70ms - 130ms)
      await window.TrackyDOM.sleep(Math.floor(Math.random() * 60) + 70);

      // Amber click ripple
      const ripple = document.createElement('div');
      ripple.className = 'tracky-click-ripple';
      ripple.style.left = `${this.currentX}px`;
      ripple.style.top = `${this.currentY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);

      // Floating paw particle
      const paw = document.createElement('div');
      paw.className = 'tracky-paw-particle';
      paw.textContent = '🐾';
      paw.style.left = `${this.currentX}px`;
      paw.style.top = `${this.currentY}px`;
      document.body.appendChild(paw);
      setTimeout(() => paw.remove(), 750);

      element.classList.add('tracky-highlight-field');
      setTimeout(() => element.classList.remove('tracky-highlight-field'), 350);
    }

    await window.TrackyDOM.simulateClick(element);

    // Joyful puppy victory hop after clicking!
    if (this.cursorEl) {
      this.cursorEl.classList.remove('curious-tilt');
      this.cursorEl.classList.add('playful-bounce');
      setTimeout(() => this.cursorEl?.classList.remove('playful-bounce'), 450);
    }

    await window.TrackyDOM.sleep(Math.floor(Math.random() * 80) + 120);
  },

  /**
   * Expressive Typing: Focus -> Alert inspection -> Keystroke cadence -> Joyful bounce on completion.
   */
  async type(element, text) {
    if (!element || text === undefined || text === null) return;

    if (this.enabled) {
      await this.moveTo(element);
      element.classList.add('tracky-highlight-field');

      if (typeof element.focus === 'function') {
        element.focus();
      }

      await window.TrackyDOM.sleep(Math.floor(Math.random() * 100) + 120);

      const textStr = text.toString();
      let currentVal = '';

      for (let i = 0; i < textStr.length; i++) {
        const char = textStr[i];
        currentVal += char;
        window.TrackyDOM.simulateInput(element, currentVal);

        let delay = Math.floor(Math.random() * 35) + 45;

        if (char === ' ') {
          delay += Math.floor(Math.random() * 50) + 70;
        } else if (char === ',' || char === '.' || char === '@' || char === '-') {
          delay += Math.floor(Math.random() * 60) + 90;
        } else if (char >= 'A' && char <= 'Z') {
          delay += Math.floor(Math.random() * 30) + 40;
        } else if (char >= '0' && char <= '9') {
          delay += Math.floor(Math.random() * 40) + 50;
        }

        await window.TrackyDOM.sleep(delay);
      }

      if (this.cursorEl) {
        this.cursorEl.classList.add('playful-bounce');
        setTimeout(() => this.cursorEl?.classList.remove('playful-bounce'), 450);
      }

      await window.TrackyDOM.sleep(Math.floor(Math.random() * 80) + 140);
      setTimeout(() => element.classList.remove('tracky-highlight-field'), 250);
    } else {
      window.TrackyDOM.simulateInput(element, text.toString());
    }
  },

  bubbleEl: null,

  showSpeechBubble({ title, message, targetElement, onSubmit, onSkip, onManual }) {
    this.hideSpeechBubble();

    if (targetElement) {
      this.moveTo(targetElement, 320);
    }

    const bubble = document.createElement('div');
    bubble.id = 'tracky-cursor-bubble';

    const bubbleWidth = 280;
    const isNearLeftEdge = this.currentX < bubbleWidth + 30;

    if (isNearLeftEdge) {
      bubble.className = 'tail-left';
      bubble.style.left = `${Math.min(window.innerWidth - bubbleWidth - 20, this.currentX + 28)}px`;
      bubble.style.top = `${Math.max(20, Math.min(window.innerHeight - 180, this.currentY - 20))}px`;
    } else {
      bubble.className = 'tail-right';
      bubble.style.left = `${Math.max(15, this.currentX - bubbleWidth - 14)}px`;
      bubble.style.top = `${Math.max(20, Math.min(window.innerHeight - 180, this.currentY - 20))}px`;
    }

    bubble.innerHTML = `
      <div class="tracky-bubble-header">
        <span>🐾</span>
        <span>${title || 'Tracky Needs Input'}</span>
      </div>
      <div class="tracky-bubble-msg">${message || 'Please provide an answer for this question:'}</div>
      <div class="tracky-bubble-input-row">
        <input type="text" class="tracky-bubble-input" id="tracky-bubble-text-input" placeholder="Type your answer here..." autocomplete="off" />
        <button class="tracky-bubble-submit-btn" id="tracky-bubble-submit-btn">Send ⏎</button>
      </div>
      <div class="tracky-bubble-actions">
        <button class="tracky-bubble-sub-btn" id="tracky-bubble-manual-btn">✍️ Let me fill it</button>
        <button class="tracky-bubble-sub-btn" id="tracky-bubble-skip-btn">⏭ Skip field</button>
      </div>
    `;

    document.body.appendChild(bubble);
    this.bubbleEl = bubble;

    const input = document.getElementById('tracky-bubble-text-input');
    const submitBtn = document.getElementById('tracky-bubble-submit-btn');
    const manualBtn = document.getElementById('tracky-bubble-manual-btn');
    const skipBtn = document.getElementById('tracky-bubble-skip-btn');

    setTimeout(() => input?.focus(), 100);

    const handleSend = () => {
      const val = input?.value.trim() || '';
      this.hideSpeechBubble();
      if (onSubmit) onSubmit(val);
    };

    submitBtn?.addEventListener('click', handleSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });

    manualBtn?.addEventListener('click', () => {
      this.hideSpeechBubble();
      if (onManual) onManual();
    });

    skipBtn?.addEventListener('click', () => {
      this.hideSpeechBubble();
      if (onSkip) onSkip();
    });
  },

  hideSpeechBubble() {
    if (this.bubbleEl) {
      this.bubbleEl.remove();
      this.bubbleEl = null;
    }
  },

  hide() {
    this.isAINavigating = false;
    if (this.idleTimerId) {
      clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    this.hideSpeechBubble();
    if (this.cursorEl) {
      this.cursorEl.style.display = 'none';
    }
  }
};

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.TrackyCursor.init());
} else {
  window.TrackyCursor.init();
}
