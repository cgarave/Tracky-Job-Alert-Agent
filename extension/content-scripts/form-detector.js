/**
 * Main form detector and application runner for Tracky Extension.
 * Directs execution to TrackyAINavigator (Vision AI co-pilot).
 */
window.TrackyFormDetector = {
  isSupportedSite() {
    const host = window.location.hostname.toLowerCase();
    return (
      host.includes('linkedin.com') ||
      host.includes('indeed.com') ||
      host.includes('onlinejobs.ph') ||
      host.includes('jobstreet.com.ph') ||
      host.includes('greenhouse.io') ||
      host.includes('lever.co') ||
      host.includes('workday.com') ||
      host.includes('myworkdayjobs.com') ||
      host.includes('smartrecruiters.com') ||
      document.querySelector('button[id*="apply"], button[class*="apply"], a[id*="apply"], a[class*="apply"]') !== null
    );
  },

  async runAutoApply(customContext = null) {
    window.TrackyOverlay?.expand();
    const api = window.TrackyAPI;
    const profile = await api.getProfile();
    const mode = profile?.ai_settings?.application_mode || 'review_before_submit';

    // Synchronize ghost cursor preference
    const enableGhostCursor = profile?.ai_settings?.enable_ghost_cursor ?? false;
    window.TrackyCursor?.setEnabled(enableGhostCursor);

    // 1. Try Deterministic Platform Adapters First (Fast & 0-API latency)
    try {
      if (window.TrackyLinkedInAdapter && window.TrackyLinkedInAdapter.isApplicable()) {
        const handled = await window.TrackyLinkedInAdapter.apply(profile, mode);
        if (handled) return;
      } else if (window.TrackyIndeedAdapter && window.TrackyIndeedAdapter.isApplicable()) {
        const handled = await window.TrackyIndeedAdapter.apply(profile, mode);
        if (handled) return;
      } else if (window.TrackyOnlineJobsAdapter && window.TrackyOnlineJobsAdapter.isApplicable()) {
        const handled = await window.TrackyOnlineJobsAdapter.apply(profile, mode);
        if (handled) return;
      } else if (window.TrackyJobStreetAdapter && window.TrackyJobStreetAdapter.isApplicable()) {
        const handled = await window.TrackyJobStreetAdapter.apply(profile, mode);
        if (handled) return;
      }
    } catch (e) {
      console.warn('[Tracky FormDetector] Adapter encountered error, falling back to Vision AI:', e);
    }

    // 2. Fallback to Gemini Multimodal AI Navigator (For unknown ATS, custom forms, or complex pages)
    if (window.TrackyAINavigator) {
      await window.TrackyAINavigator.start(customContext);
    }
  },

  async init() {
    if (this.isSupportedSite()) {
      window.TrackyOverlay?.init();

      // Check if this page load is part of an ongoing apply session (e.g. page reload or new step)
      try {
        chrome.runtime.sendMessage({ action: 'GET_APPLY_SESSION' }, async (resp) => {
          const session = resp?.session;
          if (session && session.isNavigating) {
            // Check if session is recent (within 5 minutes)
            const isFresh = Date.now() - (session.timestamp || 0) < 5 * 60 * 1000;
            if (isFresh) {
              console.log('[Tracky FormDetector] Found active apply session after reload. Auto-resuming...');
              // Small delay to let page inputs / DOM settle
              setTimeout(async () => {
                await this.runAutoApply(session.jobContext);
              }, 1200);
            }
          }
        });
      } catch (e) {
        // Extension context might be refreshing
      }
    }
  }
};

// Listen for messages from Side Panel or Background Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'TRIGGER_AUTO_APPLY') {
    (async () => {
      await window.TrackyFormDetector.runAutoApply(message.jobContext);
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
