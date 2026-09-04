/**
 * Tracky Pure Figma Amber Orange Cursor & Navigation Co-Pilot.
 *
 * 1. Shows a sleek Figma multiplayer cursor in vibrant Amber Orange.
 * 2. Purposeful, steady, and calm: only moves when actively executing AI actions.
 * 3. Never wanders randomly across DOM elements or hijacks user clicks.
 * 4. Stays locked in focused AI Navigation mode for the entire Auto-Apply session.
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
  animFrameId: null,

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
    // Only mount cursor in the top-level browsing context, never in iframes
    if (window !== window.top) return;

    // Clean up any stale or existing cursor elements
    const existing = document.querySelectorAll('#tracky-ghost-cursor');
    if (existing.length > 0) {
      this.cursorEl = existing[0];
      for (let i = 1; i < existing.length; i++) {
        existing[i].remove();
      }
      return;
    }

    this.cursorEl = document.createElement('div');
    this.cursorEl.id = 'tracky-ghost-cursor';
    this.cursorEl.innerHTML = `
      <div class="tracky-cursor-wrapper">
        ${this._getCursorSVG(this.cursorStyle, this.cursorColor)}
      </div>
    `;

    document.body.appendChild(this.cursorEl);

    // Initial position parked smoothly on right side
    this.currentX = Math.max(40, window.innerWidth - 80);
    this.currentY = Math.max(40, window.innerHeight - 100);
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
    // Sync settings from background worker and cache
    this.syncSettings();

    // Listen to real-time settings changes across any tab
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
    } else {
      if (this.cursorEl) {
        this.cursorEl.style.display = 'none';
        this.cursorEl.remove();
        this.cursorEl = null;
      }
      this.hideSpeechBubble();
    }
  },

  /**
   * Focused AI Movement during Auto-Apply.
   * Smooth, linear, and direct.
   */
  async moveTo(element, durationMs = 320) {
    if (!element) return;
    if (!this.enabled) {
      this.setEnabled(true);
    }
    this._ensureCursorDOM();
    if (!this.cursorEl) return;
    this.cursorEl.style.display = 'block';

    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 60));

    const rect = element.getBoundingClientRect();
    const destX = rect.left + Math.min(Math.max(rect.width / 2, 10), 60);
    const destY = rect.top + Math.min(Math.max(rect.height / 2, 8), 24);

    const startX = this.currentX;
    const startY = this.currentY;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Quintic ease-out curve for natural deceleration
        const ease = 1 - Math.pow(1 - progress, 3);
        this.currentX = startX + (destX - startX) * ease;
        this.currentY = startY + (destY - startY) * ease;

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
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  },

  /**
   * AI Click: Amber ripple on targeted button or field.
   */
  async click(element) {
    if (!element) return;

    if (this.enabled) {
      await this.moveTo(element, 260);

      // Amber click ripple
      const ripple = document.createElement('div');
      ripple.className = 'tracky-click-ripple';
      ripple.style.left = `${this.currentX}px`;
      ripple.style.top = `${this.currentY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 450);

      element.classList.add('tracky-highlight-field');
      setTimeout(() => element.classList.remove('tracky-highlight-field'), 350);
      await new Promise((r) => setTimeout(r, 80));
    }

    await window.TrackyDOM.simulateClick(element);
  },

  /**
   * AI Type: Natural typing cadence into input.
   */
  async type(element, text) {
    if (!element || text === undefined || text === null) return;

    if (this.enabled) {
      await this.moveTo(element, 220);
      element.classList.add('tracky-highlight-field');
      element.focus();

      const textStr = text.toString();
      const animatedLength = Math.min(textStr.length, 25);
      let currentVal = '';

      for (let i = 0; i < animatedLength; i++) {
        currentVal += textStr[i];
        window.TrackyDOM.simulateInput(element, currentVal);
        const delay = Math.floor(Math.random() * 15) + 10;
        await new Promise((r) => setTimeout(r, delay));
      }

      if (textStr.length > animatedLength) {
        window.TrackyDOM.simulateInput(element, textStr);
      }

      setTimeout(() => element.classList.remove('tracky-highlight-field'), 250);
    } else {
      window.TrackyDOM.simulateInput(element, text.toString());
    }
  },

  bubbleEl: null,

  showSpeechBubble({ title, message, targetElement, onSubmit, onSkip, onManual }) {
    this.hideSpeechBubble();

    if (targetElement) {
      this.moveTo(targetElement, 260);
    }

    const bubble = document.createElement('div');
    bubble.id = 'tracky-cursor-bubble';

    // Calculate smart positioning (adaptive left vs right)
    const bubbleWidth = 280;
    const isNearLeftEdge = this.currentX < bubbleWidth + 30;

    if (isNearLeftEdge) {
      // Position to the right of cursor
      bubble.className = 'tail-left';
      bubble.style.left = `${Math.min(window.innerWidth - bubbleWidth - 20, this.currentX + 28)}px`;
      bubble.style.top = `${Math.max(20, Math.min(window.innerHeight - 180, this.currentY - 20))}px`;
    } else {
      // Position to the left of cursor
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
