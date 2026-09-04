/**
 * Tracky Floating Vision AI Assistant HUD Controller.
 * Manages minimal idle pill, expanded real-time streaming HUD panel,
 * step backtracking/history review, and immediate cancellation.
 */
window.TrackyOverlay = {
  idlePillEl: null,
  panelEl: null,
  isExpanded: false,

  // Step Backtracking History
  stepRecords: [],
  currentViewIndex: 0,
  isHistoryDrawerOpen: false,

  init() {
    if (window !== window.top) return;
    this.createIdlePill();
    this.createPanel();
  },

  createIdlePill() {
    if (window !== window.top) return;
    const existing = document.querySelectorAll('#tracky-idle-pill');
    if (existing.length > 0) {
      this.idlePillEl = existing[0];
      for (let i = 1; i < existing.length; i++) existing[i].remove();
      return;
    }
    this.idlePillEl = document.createElement('div');
    this.idlePillEl.id = 'tracky-idle-pill';
    this.idlePillEl.innerHTML = `
      <div class="tracky-pill-icon">🐶</div>
      <div class="tracky-pill-content">
        <span class="tracky-pill-title">Tracky AI</span>
        <span class="tracky-pill-status" id="tracky-idle-status-text">Ready</span>
      </div>
    `;

    document.body.appendChild(this.idlePillEl);

    this.idlePillEl.addEventListener('click', () => {
      if (!this.isExpanded) {
        this.expand();
      }
    });
  },

  createPanel() {
    if (window !== window.top) return;
    const existing = document.querySelectorAll('#tracky-overlay-panel');
    if (existing.length > 0) {
      this.panelEl = existing[0];
      for (let i = 1; i < existing.length; i++) existing[i].remove();
      return;
    }
    this.panelEl = document.createElement('div');
    this.panelEl.id = 'tracky-overlay-panel';
    this.panelEl.style.display = 'none';

    this.panelEl.innerHTML = `
      <div class="tracky-hud-header">
        <div class="tracky-hud-brand">
          <span class="tracky-hud-icon">🐶</span>
          <span class="tracky-hud-title">Tracky AI</span>
          <span class="tracky-hud-status-badge active" id="tracky-hud-badge">Active</span>
        </div>
        <div class="tracky-hud-controls">
          <button class="tracky-hud-cancel-btn" id="tracky-hud-cancel-btn" title="Cancel Auto-Apply">✕ Cancel</button>
          <button class="tracky-hud-btn-icon" id="tracky-hud-pause-btn" title="Pause/Resume">⏸</button>
          <button class="tracky-hud-btn-icon" id="tracky-hud-min-btn" title="Minimize">−</button>
        </div>
      </div>
      <div class="tracky-hud-body" id="tracky-hud-body-content">
        <div class="tracky-reasoning-card">
          <div class="tracky-stepper-header">
            <div class="tracky-reasoning-label">
              <span class="tracky-pulsing-dot"></span>
              <span>Reasoning Stream</span>
            </div>
            <div class="tracky-stepper-controls">
              <button class="tracky-stepper-btn" id="tracky-step-prev-btn" title="Previous Step" disabled>◀</button>
              <span class="tracky-step-counter" id="tracky-step-counter-text">Step 1/1</span>
              <button class="tracky-stepper-btn" id="tracky-step-next-btn" title="Next Step" disabled>▶</button>
              <button class="tracky-stepper-btn" id="tracky-step-history-toggle-btn" title="Toggle Full Log">📋 Log</button>
            </div>
          </div>
          <div class="tracky-reasoning-text" id="tracky-hud-reasoning-text">
            Ready to assist. Click Auto-Apply from the job listing or dashboard.
          </div>
          <div class="tracky-step-actions-detail" id="tracky-step-actions-detail" style="display: none;"></div>
          <div class="tracky-full-history-drawer" id="tracky-full-history-drawer" style="display: none;"></div>
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

    // Event handlers
    document.getElementById('tracky-hud-min-btn')?.addEventListener('click', () => this.minimize());
    document.getElementById('tracky-hud-pause-btn')?.addEventListener('click', () => {
      window.TrackyAINavigator?.togglePause();
    });
    document.getElementById('tracky-hud-cancel-btn')?.addEventListener('click', () => {
      this.cancelAutoApply();
    });

    // Stepper buttons
    document.getElementById('tracky-step-prev-btn')?.addEventListener('click', () => {
      if (this.currentViewIndex > 0) {
        this.renderStep(this.currentViewIndex - 1);
      }
    });

    document.getElementById('tracky-step-next-btn')?.addEventListener('click', () => {
      if (this.currentViewIndex < this.stepRecords.length - 1) {
        this.renderStep(this.currentViewIndex + 1);
      }
    });

    document.getElementById('tracky-step-history-toggle-btn')?.addEventListener('click', () => {
      this.toggleHistoryDrawer();
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

  setStatus(text, isActive = false) {
    this.init();
    const idleStatus = document.getElementById('tracky-idle-status-text');
    if (idleStatus) {
      idleStatus.textContent = text;
      idleStatus.className = `tracky-pill-status ${isActive ? 'active' : ''}`;
    }
  },

  cancelAutoApply() {
    window.TrackyAPI?.abortCurrentStep();
    window.TrackyAINavigator?.cancel();
    window.TrackyCursor?.hideSpeechBubble();

    this.setStatus('Cancelled', false);
    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) {
      reasoningEl.textContent = 'Auto-apply cancelled by user.';
    }

    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Cancelled';
      badge.className = 'tracky-hud-status-badge paused';
    }

    const interactive = document.getElementById('tracky-hud-interactive-area');
    if (interactive) interactive.innerHTML = '';
  },

  clearHistory() {
    this.stepRecords = [];
    this.currentViewIndex = 0;
    this._updateStepperUI();
  },

  addStepRecord(record) {
    const formatted = {
      step: record.step || this.stepRecords.length + 1,
      reasoning: record.reasoning || '',
      action: record.action || 'inspect',
      fields: record.fields || [],
      nextSelector: record.next_selector || '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    this.stepRecords.push(formatted);
    this.renderStep(this.stepRecords.length - 1);
  },

  renderStep(index) {
    if (index < 0 || index >= this.stepRecords.length) return;
    this.currentViewIndex = index;
    const item = this.stepRecords[index];

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) reasoningEl.textContent = item.reasoning;

    const detailEl = document.getElementById('tracky-step-actions-detail');
    if (detailEl) {
      if (item.fields && item.fields.length > 0) {
        detailEl.style.display = 'block';
        const tags = item.fields
          .map((f) => `<span class="tracky-step-action-tag">✍️ ${f.label || f.selector}: "${f.value || 'checked'}"</span>`)
          .join(' ');
        detailEl.innerHTML = `<div style="margin-bottom: 4px; font-weight: 600;">Planned Actions:</div>${tags}`;
      } else if (item.action) {
        detailEl.style.display = 'block';
        detailEl.innerHTML = `<span class="tracky-step-action-tag">Action: ${item.action}</span>`;
      } else {
        detailEl.style.display = 'none';
      }
    }

    this._updateStepperUI();
    this._renderHistoryDrawer();
  },

  _updateStepperUI() {
    const prevBtn = document.getElementById('tracky-step-prev-btn');
    const nextBtn = document.getElementById('tracky-step-next-btn');
    const counter = document.getElementById('tracky-step-counter-text');

    const total = Math.max(this.stepRecords.length, 1);
    const curr = this.stepRecords.length > 0 ? this.currentViewIndex + 1 : 1;

    if (counter) counter.textContent = `Step ${curr}/${total}`;
    if (prevBtn) prevBtn.disabled = this.currentViewIndex <= 0;
    if (nextBtn) nextBtn.disabled = this.currentViewIndex >= this.stepRecords.length - 1;
  },

  toggleHistoryDrawer() {
    this.isHistoryDrawerOpen = !this.isHistoryDrawerOpen;
    const drawer = document.getElementById('tracky-full-history-drawer');
    if (drawer) {
      drawer.style.display = this.isHistoryDrawerOpen ? 'flex' : 'none';
    }
    if (this.isHistoryDrawerOpen) {
      this._renderHistoryDrawer();
    }
  },

  _renderHistoryDrawer() {
    const drawer = document.getElementById('tracky-full-history-drawer');
    if (!drawer) return;

    if (this.stepRecords.length === 0) {
      drawer.innerHTML = '<div style="color: #94a3b8; font-size: 11px; padding: 4px;">No step history recorded yet.</div>';
      return;
    }

    drawer.innerHTML = this.stepRecords
      .map(
        (rec, idx) => `
        <div class="tracky-history-item ${idx === this.currentViewIndex ? 'active' : ''}" data-step-idx="${idx}">
          <div class="tracky-history-item-header">
            <span>Step ${rec.step} (${rec.action})</span>
            <span>${rec.timestamp}</span>
          </div>
          <div style="color: #334155; line-height: 1.3;">${rec.reasoning}</div>
        </div>
      `
      )
      .join('');

    drawer.querySelectorAll('.tracky-history-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-step-idx') || '0', 10);
        this.renderStep(idx);
      });
    });
  },

  showThinking(reasoning, step = 1, maxSteps = 8, platform = 'Auto-Detect') {
    this.expand();
    this.setStatus('Active', true);

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
      <div class="tracky-approval-card" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
        <div style="font-weight: 700; color: #166534; font-size: 11px; margin-bottom: 4px;">✓ Application Summary</div>
        <div style="font-size: 11px; color: #166534; white-space: pre-wrap; line-height: 1.4;">${summaryText}</div>
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
    this.setStatus('Applied', false);

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
    this.setStatus('Failed', false);

    const badge = document.getElementById('tracky-hud-badge');
    if (badge) {
      badge.textContent = 'Failed';
      badge.className = 'tracky-hud-status-badge captcha';
    }

    const reasoningEl = document.getElementById('tracky-hud-reasoning-text');
    if (reasoningEl) reasoningEl.textContent = `❌ ${message}`;
  }
};
