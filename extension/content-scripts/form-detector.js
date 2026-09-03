/**
 * Main form detector and application runner for Tracky Extension.
 */
window.TrackyFormDetector = {
  adapters: [
    window.TrackyLinkedInAdapter,
    window.TrackyOnlineJobsAdapter,
    window.TrackyIndeedAdapter,
    window.TrackyJobStreetAdapter
  ],

  getActiveAdapter() {
    return this.adapters.find((a) => a && a.isApplicable());
  },

  async runAutoApply() {
    const adapter = this.getActiveAdapter();
    if (!adapter) {
      window.TrackyOverlay.showError('Platform not supported for direct auto-apply.');
      return;
    }

    const profile = await window.TrackyAPI.getProfile();
    if (!profile) {
      window.TrackyOverlay.showError('Please configure your profile in Tracky Dashboard.');
      return;
    }

    const enableGhostCursor = profile.ai_settings?.enable_ghost_cursor ?? true;
    const mode = profile.ai_settings?.application_mode || 'review_before_submit';
    window.TrackyCursor.setEnabled(enableGhostCursor);

    await adapter.apply(profile, mode);
  },

  init() {
    const adapter = this.getActiveAdapter();
    if (adapter) {
      window.TrackyOverlay.init();
    }
  }
};

// Listen for messages from Side Panel or Background Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TRIGGER_AUTO_APPLY') {
    (async () => {
      await window.TrackyFormDetector.runAutoApply();
      sendResponse({ status: 'started' });
    })();
    return true; // Keep message channel open for async response
  }
});

// Auto-initialize on supported page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.TrackyFormDetector.init());
} else {
  window.TrackyFormDetector.init();
}
