/**
 * Tracky Floating Vision AI Assistant HUD Controller.
 * Manages idle trigger pill and expanded real-time streaming HUD panel.
 */
window.TrackyOverlay = {
  idlePillEl: null,
  panelEl: null,
  isExpanded: false,

  init() {
    this.createIdlePill();
    this.createPanel();
  },

  createIdlePill() {
    if (this.idlePillEl) return;
    this.idlePillEl = document.createElement('div');
    this.idlePillEl.id = 'tracky-idle-pill';
    this.idlePillEl.innerHTML = `
      <div class="tracky-pill-icon">🐶</div>
      <div class="tracky-pill-content">
        <span class="tracky-pill-title">Tracky AI Co-Pilot</span>
        <span class="tracky-pill-status" id="tracky-idle-status-text">Ready to auto-apply</span>
      </div>
      <button class="tracky-pill-btn" id="tracky-idle-apply-btn">⚡ Auto-Apply</button>
    `;

    document.body.appendChild(this.idlePillEl);

    document.getElementById('tracky-idle-apply-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.TrackyAINavigator?.start();
    });

    this.idlePillEl.addEventListener('click', () => {
      if (!this.isExpanded) {
        this.expand();
      }
    });
  },

  createPanel() {
    if (this.panelEl) return;
    this.panelEl = document.createElement('div');
    this.panelEl.id = 'tracky-overlay-panel';
    this.panelEl.style.display = 'none';

    this.panelEl.innerHTML = `
      <div class="tracky-hud-header">
        <div class="tracky-hud-brand">
          <span class="tracky-hud-icon">🐶</span>
          <span class="tracky-hud-title">Tracky Vision AI</span>
          <span class="tracky-hud-status-badge active" id="tracky-hud-badge">Active</span>
        </div>
        <div class="tracky-hud-controls">
          <button class="tracky-hud-btn-icon" id="tracky-hud-pause-btn" title="Pause/Resume">⏸</button>
          <button class="tracky-hud-btn-icon" id="tracky-hud-min-btn" title="Minimize">−</button>
          <button class="tracky-hud-btn-icon" id="tracky-hud-stop-btn" title="Stop Application">✕</button>
        </div>
      </div>
      <div class="tracky-hud-body" id="tracky-hud-body-content">
        <div class="tracky-reasoning-card">
          <div class="tracky-reasoning-label">
            <span class="tracky-pulsing-dot"></span>
            <span>AI Reasoning Stream</span>
          </div>
          <div class="tracky-reasoning-text" id="tracky-hud-reasoning-text">
            Initializing Gemini Vision navigator...
          </div>
        </div>
        <div class="tracky-progress-section" id="tracky-hud-progress-row">
          <span id="tracky-hud-step-text">Step 1</span>
          <div class="tracky-progress-track">
            <div class="tracky-progress-fill" id="tracky-hud-progress-bar" style="width: 15%;"></div>
          </div>
          <span id="tracky-hud-platform-text">Web ATS</span>
        </div>
        <div id="tracky-hud-interactive-area"></div>
      </div>
    `;

    document.body.appendChild(this.panelEl);

    document.getElementById('tracky-hud-min-btn')?.addEventListener('click', () => this.minimize());
    document.getElementById('tracky-hud-pause-btn')?.addEventListener('click', () => {
      window.TrackyAINavigator?.togglePause();
    });
    document.getElementById('tracky-hud-stop-btn')?.addEventListener('click', () => {
      window.TrackyAINavigator?.stop();
    });
  },

  expand() {
    this.init();
    this.isExpanded = true;
    if (this.idlePillEl) this.idlePillEl.style.display = 'none';
    if (this.panelEl) this.panelEl.style.display = 'block';
  },

  minimize() {
    this.isExpanded = false;
    if (this.panelEl) this.panelEl.style.display = 'none';
    if (this.idlePillEl) this.idlePillEl.style.display = 'flex';
  },

  setStatus(text, isLoading = false) {
    this.init();
    const idleStatus = document.getElementById('tracky-idle-status-text');
    if (idleStatus) idleStatus.textContent = text;

    const btn = document.getElementById('tracky-idle-apply-btn');
    if (btn) {
      if (isLoading) {
        btn.innerHTML = '<div class="tracky-spinner"></div>';
        btn.disabled = true;
      } else {
        btn.innerHTML = '⚡ Auto-Apply';
        btn.disabled = false;
      }
    }
  },

  showThinking(reasoning, step = 1, maxSteps = 8, platform = 'Auto-Detect') {
    this.expand();
    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) reasoningEl.textContent = reasoning;

    const stepEl = document.getElementById('tracky-hud-step-text');
    if (stepEl) stepEl.textContent = `Step ${step}`;

    const platEl = document.getElementById('tracky-hud-platform-text');
    if (platEl) platEl.textContent = platform;

    const progEl = document.getElementById('tracky-hud-progress-bar');
    if (progEl) {
      const pct = Math.min(Math.round((step / maxSteps) * 100), 95);
      progEl.style.width = `${pct}%`;
    }

    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Active';
      badge.className = 'tracky-hud-status-badge active';
    }

    const interactive = document.getElementById('tracky-hud-interactive-area');
    if (interactive) interactive.innerHTML = '';
  },

  showAskUser(question, onAnswer) {
    this.expand();
    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Input Needed';
      badge.className = 'tracky-hud-status-badge paused';
    }

    const interactive = document.getElementById('tracky-hud-interactive-area');
    if (!interactive) return;

    interactive.innerHTML = `
      <div class="tracky-prompt-box">
        <div class="tracky-prompt-title">❓ Question from Employer:</div>
        <div style="font-size: 12px; color: #1e293b; margin-bottom: 8px;">${question}</div>
        <input type="text" class="tracky-prompt-input" id="tracky-user-answer-input" placeholder="Type your answer here..." />
        <div class="tracky-actions-row">
          <button class="tracky-btn tracky-btn-primary" id="tracky-submit-answer-btn">Submit Answer →</button>
        </div>
      </div>
    `;

    const input = document.getElementById('tracky-user-answer-input');
    input?.focus();

    const submit = () => {
      const val = input?.value?.trim() || '';
      if (val) {
        interactive.innerHTML = '';
        onAnswer(val);
      }
    };

    document.getElementById('tracky-submit-answer-btn')?.addEventListener('click', submit);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  },

  showCaptcha(onContinue, onSkip) {
    this.expand();
    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Your Turn';
      badge.className = 'tracky-hud-status-badge captcha';
    }

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) {
      reasoningEl.textContent = '🔒 Bot challenge / CAPTCHA detected. Please solve it on the page, then click Continue.';
    }

    const interactive = document.getElementById('tracky-hud-interactive-area');
    if (!interactive) return;

    interactive.innerHTML = `
      <div class="tracky-actions-row" style="margin-top: 8px;">
        <button class="tracky-btn tracky-btn-secondary" id="tracky-captcha-skip-btn">✗ Skip Job</button>
        <button class="tracky-btn tracky-btn-primary" id="tracky-captcha-continue-btn">▶ Continue</button>
      </div>
    `;

    document.getElementById('tracky-captcha-continue-btn')?.addEventListener('click', () => {
      interactive.innerHTML = '';
      onContinue();
    });
    document.getElementById('tracky-captcha-skip-btn')?.addEventListener('click', () => {
      interactive.innerHTML = '';
      onSkip();
    });
  },

  showApproval(summary, onSubmit, onSkip) {
    this.expand();
    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Ready to Submit';
      badge.className = 'tracky-hud-status-badge approval';
    }

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) {
      reasoningEl.textContent = 'Application filled and ready for final submission. Please review details below:';
    }

    const interactive = document.getElementById('tracky-hud-interactive-area');
    if (!interactive) return;

    const summaryText = typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2);

    interactive.innerHTML = `
      <div class="tracky-approval-card">
        <div class="tracky-approval-title">
          <span>✓</span>
          <span>Application Summary</span>
        </div>
        <div style="font-size: 11px; color: #166534; white-space: pre-wrap; line-height: 1.4; margin-bottom: 8px;">${summaryText}</div>
      </div>
      <div class="tracky-actions-row">
        <button class="tracky-btn tracky-btn-secondary" id="tracky-approval-skip-btn">✗ Skip</button>
        <button class="tracky-btn tracky-btn-success" id="tracky-approval-submit-btn">✓ Submit Application</button>
      </div>
    `;

    document.getElementById('tracky-approval-submit-btn')?.addEventListener('click', () => {
      interactive.innerHTML = '';
      onSubmit();
    });
    document.getElementById('tracky-approval-skip-btn')?.addEventListener('click', () => {
      interactive.innerHTML = '';
      onSkip();
    });
  },

  showStuck(reason, onContinue, onSkip) {
    this.expand();
    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Needs Help';
      badge.className = 'tracky-hud-status-badge paused';
    }

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) {
      reasoningEl.textContent = `⚠️ ${reason || "AI is stuck — please take over on screen."}`;
    }

    const interactive = document.getElementById('tracky-hud-interactive-area');
    if (!interactive) return;

    interactive.innerHTML = `
      <div class="tracky-actions-row" style="margin-top: 8px;">
        <button class="tracky-btn tracky-btn-secondary" id="tracky-stuck-skip-btn">✗ Skip Job</button>
        <button class="tracky-btn tracky-btn-primary" id="tracky-stuck-continue-btn">▶ Continue from here</button>
      </div>
    `;

    document.getElementById('tracky-stuck-continue-btn')?.addEventListener('click', () => {
      interactive.innerHTML = '';
      onContinue();
    });
    document.getElementById('tracky-stuck-skip-btn')?.addEventListener('click', () => {
      interactive.innerHTML = '';
      onSkip();
    });
  },

  showSuccess(message = 'Applied successfully!') {
    this.expand();
    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Applied';
      badge.className = 'tracky-hud-status-badge approval';
    }

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) reasoningEl.textContent = `✅ ${message}`;

    const progEl = document.getElementById('tracky-hud-progress-bar');
    if (progEl) progEl.style.width = '100%';

    setTimeout(() => {
      this.minimize();
    }, 4500);
  },

  showError(message = 'Application failed') {
    this.expand();
    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Failed';
      badge.className = 'tracky-hud-status-badge captcha';
    }

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) reasoningEl.textContent = `❌ ${message}`;
  }
};
