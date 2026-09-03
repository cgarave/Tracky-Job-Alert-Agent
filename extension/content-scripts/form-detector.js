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
    if (window.TrackyAINavigator) {
      await window.TrackyAINavigator.start(customContext);
    }
  },

  init() {
    if (this.isSupportedSite()) {
      window.TrackyOverlay?.init();
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
