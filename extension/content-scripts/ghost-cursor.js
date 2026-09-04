/**
 * Tracky Pure Figma Amber Orange Cursor & Autonomous Playful DOM Explorer.
 *
 * 1. Shows a sleek Figma multiplayer cursor in vibrant Amber Orange (no tag).
 * 2. Autonomously wanders and flies across DOM elements on the page when idle.
 * 3. Reacts with curious hops and swoops when the user clicks on the page.
 * 4. Switches into a well-behaved, focused navigation co-pilot during Auto-Apply.
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
  isExploring: false,
  animFrameId: null,
  exploreTimerId: null,

  // Playful flight state
  flightStartTime: 0,
  flightDuration: 600,
  flightStartX: 160,
  flightStartY: 160,
  flightControlX: 160,
  flightControlY: 160,
  isFlightActive: false,

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
    if (this.cursorEl) return;
    this.cursorEl = document.createElement('div');
    this.cursorEl.id = 'tracky-ghost-cursor';
    this.cursorEl.innerHTML = `
      <div class="tracky-cursor-wrapper">
        ${this._getCursorSVG(this.cursorStyle, this.cursorColor)}
      </div>
    `;

    document.body.appendChild(this.cursorEl);

    // Initial position on load
    const initialTarget = this._pickRandomInterestingElement();
    if (initialTarget) {
      const rect = initialTarget.getBoundingClientRect();
      this.currentX = Math.max(40, rect.left + 20);
      this.currentY = Math.max(40, rect.top + 20);
    }

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
    // React to user clicks on the page
    window.addEventListener('click', (e) => this._onUserClick(e), { passive: true });

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

  _onUserClick(e) {
    if (!this.enabled || this.isAINavigating) return;

    // Playfully fly to the user's click vicinity
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDist = Math.random() * 25 + 20;
    const destX = e.clientX + Math.cos(offsetAngle) * offsetDist;
    const destY = e.clientY + Math.sin(offsetAngle) * offsetDist;

    this._startSwoopFlight(destX, destY, 450);

    // Do an excited playful hop
    setTimeout(() => {
      this.cursorEl?.classList.add('playful-bounce');
      setTimeout(() => this.cursorEl?.classList.remove('playful-bounce'), 450);
    }, 450);
  },

  _startAutonomousExplorer() {
    const scheduleNextWander = () => {
      if (!this.enabled) return;

      // Random interval between 3.5s and 6.5s
      const delay = Math.floor(Math.random() * 3000) + 3500;
      this.exploreTimerId = setTimeout(() => {
        if (!this.isAINavigating && this.enabled) {
          this._exploreRandomDOMElement();
        }
        scheduleNextWander();
      }, delay);
    };

    scheduleNextWander();
  },

  _exploreRandomDOMElement() {
    const el = this._pickRandomInterestingElement();
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Only visit visible elements in current viewport
    if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) {
      return;
    }

    // Pick playful corner or edge around element
    const padding = 15;
    const destX = Math.min(Math.max(20, rect.left + Math.random() * Math.min(rect.width, 100) + padding), vw - 30);
    const destY = Math.min(Math.max(20, rect.top + Math.random() * Math.min(rect.height, 60) + padding), vh - 30);

    const duration = Math.floor(Math.random() * 300) + 500; // 500-800ms swoop
    this._startSwoopFlight(destX, destY, duration);

    // Add curious tilt while hovering
    setTimeout(() => {
      if (!this.isAINavigating) {
        this.cursorEl?.classList.add('curious-tilt');
        setTimeout(() => this.cursorEl?.classList.remove('curious-tilt'), 800);
      }
    }, duration);
  },

  _pickRandomInterestingElement() {
    const candidates = Array.from(
      document.querySelectorAll(
        'article, .jobsearch-JobComponent, [class*="job"], [class*="card"], button, h1, h2, h3, a[href*="job"], [class*="badge"], [role="button"], img'
      )
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 20 &&
        rect.height > 15 &&
        rect.top >= 20 &&
        rect.bottom <= window.innerHeight - 20 &&
        window.getComputedStyle(el).visibility !== 'hidden'
      );
    });

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  _startSwoopFlight(destX, destY, durationMs = 500) {
    this.flightStartX = this.currentX;
    this.flightStartY = this.currentY;
    this.targetX = destX;
    this.targetY = destY;

    // Compute Bezier control point for organic swoop arc
    const midX = (this.flightStartX + destX) / 2;
    const midY = (this.flightStartY + destY) / 2;
    const curvature = (Math.random() - 0.5) * 80;
    this.flightControlX = midX - (destY - this.flightStartY) * 0.2 + curvature;
    this.flightControlY = midY + (destX - this.flightStartX) * 0.2 - 25;

    this.flightStartTime = performance.now();
    this.flightDuration = durationMs;
    this.isFlightActive = true;

    this.cursorEl?.classList.add('flying-swoop');
  },

  _startRenderLoop() {
    const loop = (timestamp) => {
      if (this.enabled && this.cursorEl && !this.isAINavigating) {
        if (this.isFlightActive) {
          const elapsed = timestamp - this.flightStartTime;
          const t = Math.min(elapsed / this.flightDuration, 1);

          // Quadratic Bezier Curve with ease-out cubic progress
          const ease = 1 - Math.pow(1 - t, 3);
          const inv = 1 - ease;

          this.currentX =
            inv * inv * this.flightStartX + 2 * inv * ease * this.flightControlX + ease * ease * this.targetX;
          this.currentY =
            inv * inv * this.flightStartY + 2 * inv * ease * this.flightControlY + ease * ease * this.targetY;

          this.cursorEl.style.left = `${this.currentX.toFixed(1)}px`;
          this.cursorEl.style.top = `${this.currentY.toFixed(1)}px`;

          if (t >= 1) {
            this.isFlightActive = false;
            this.cursorEl?.classList.remove('flying-swoop');
          }
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(loop);
    }
  },

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled) {
      this._ensureCursorDOM();
      if (this.cursorEl) {
        this.cursorEl.style.display = 'block';
      }
      this._startRenderLoop();
      this._startAutonomousExplorer();
    } else {
      if (this.cursorEl) {
        this.cursorEl.style.display = 'none';
        this.cursorEl.remove();
        this.cursorEl = null;
      }
      if (this.exploreTimerId) {
        clearTimeout(this.exploreTimerId);
        this.exploreTimerId = null;
      }
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.hideSpeechBubble();
    }
  },

  /**
   * Focused Autonomous AI Movement during Auto-Apply.
   * Well-behaved, smooth, and purposeful.
   */
  async moveTo(element, durationMs = 380) {
    if (!this.enabled || !element) return;
    this.init();
    this.isAINavigating = true;
    this.isFlightActive = false;
    this.cursorEl?.classList.remove('curious-tilt', 'flying-swoop');

    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 60));

    const rect = element.getBoundingClientRect();
    const destX = rect.left + Math.min(rect.width / 2, 75);
    const destY = rect.top + Math.min(rect.height / 2, 22);

    const startX = this.currentX;
    const startY = this.currentY;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Quintic ease-out curve for natural, well-behaved deceleration
        const ease = 1 - Math.pow(1 - progress, 4);
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
   * AI Click: Amber ripple + playful hop.
   */
  async click(element) {
    if (!element) return;

    if (this.enabled) {
      await this.moveTo(element, 300);

      // Amber click ripple
      const ripple = document.createElement('div');
      ripple.className = 'tracky-click-ripple';
      ripple.style.left = `${this.currentX}px`;
      ripple.style.top = `${this.currentY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);

      // Playful floating paw
      const paw = document.createElement('div');
      paw.className = 'tracky-paw-particle';
      paw.textContent = '🐾';
      paw.style.left = `${this.currentX}px`;
      paw.style.top = `${this.currentY}px`;
      document.body.appendChild(paw);
      setTimeout(() => paw.remove(), 750);

      element.classList.add('tracky-highlight-field');
      setTimeout(() => element.classList.remove('tracky-highlight-field'), 400);
      await new Promise((r) => setTimeout(r, 90));
    }

    await window.TrackyDOM.simulateClick(element);

    // Gentle playful hop after completing action
    this.cursorEl?.classList.add('playful-bounce');
    setTimeout(() => this.cursorEl?.classList.remove('playful-bounce'), 450);

    this.isAINavigating = false;
  },

  /**
   * AI Type: Natural typing cadence.
   */
  async type(element, text) {
    if (!element || text === undefined || text === null) return;

    if (this.enabled) {
      await this.moveTo(element, 250);
      element.classList.add('tracky-highlight-field');
      element.focus();

      const textStr = text.toString();
      const animatedLength = Math.min(textStr.length, 30);
      let currentVal = '';

      for (let i = 0; i < animatedLength; i++) {
        currentVal += textStr[i];
        window.TrackyDOM.simulateInput(element, currentVal);
        const delay = Math.floor(Math.random() * 18) + 12;
        await new Promise((r) => setTimeout(r, delay));
      }

      if (textStr.length > animatedLength) {
        window.TrackyDOM.simulateInput(element, textStr);
      }

      setTimeout(() => element.classList.remove('tracky-highlight-field'), 300);
    } else {
      window.TrackyDOM.simulateInput(element, text.toString());
    }

    this.isAINavigating = false;
  },

  bubbleEl: null,

  showSpeechBubble({ title, message, targetElement, onSubmit, onSkip, onManual }) {
    this.init();
    this.hideSpeechBubble();

    if (targetElement) {
      this.moveTo(targetElement, 300);
    }

    const bubble = document.createElement('div');
    bubble.id = 'tracky-cursor-bubble';

    // Calculate smart positioning (adaptive left vs right)
    const bubbleWidth = 270;
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
    this.isFlightActive = false;
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
