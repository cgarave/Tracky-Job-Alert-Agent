/**
 * In-Page Floating Assistant HUD for Tracky.
 */
window.TrackyOverlay = {
  pillEl: null,

  init() {
    if (this.pillEl) return;

    this.pillEl = document.createElement('div');
    this.pillEl.id = 'tracky-overlay-pill';
    this.pillEl.innerHTML = `
      <div class="tracky-pill-icon">🐶</div>
      <div class="tracky-pill-content">
        <span class="tracky-pill-title">Tracky AI Co-Pilot</span>
        <span class="tracky-pill-status" id="tracky-pill-status-text">Ready to auto-apply</span>
      </div>
      <button class="tracky-pill-btn" id="tracky-pill-apply-btn">⚡ Auto-Apply</button>
    `;

    document.body.appendChild(this.pillEl);

    document.getElementById('tracky-pill-apply-btn')?.addEventListener('click', async () => {
      await window.TrackyFormDetector.runAutoApply();
    });
  },

  setStatus(text, isLoading = false) {
    this.init();
    const statusEl = document.getElementById('tracky-pill-status-text');
    if (statusEl) {
      statusEl.textContent = text;
    }
    const btn = document.getElementById('tracky-pill-apply-btn');
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

  showSuccess(message = 'Applied successfully!') {
    this.setStatus(`✅ ${message}`, false);
    setTimeout(() => {
      this.setStatus('Ready to auto-apply');
    }, 5000);
  },

  showError(message = 'Application failed') {
    this.setStatus(`❌ ${message}`, false);
  }
};
