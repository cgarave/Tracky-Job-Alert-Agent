/**
 * API Bridge between Chrome Extension and Tracky Local Server (http://127.0.0.1:5050).
 */
window.TrackyAPI = {
  baseUrl: 'http://127.0.0.1:5050',

  async checkServerStatus() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/status`, { method: 'GET' });
      return resp.ok;
    } catch {
      return false;
    }
  },

  async getProfile() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/profile`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.warn('[Tracky] Failed to fetch profile from local server:', e);
      return null;
    }
  },

  async answerForm(questions, jobDetails) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/answer-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, job_details: jobDetails })
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.answers || [];
    } catch (e) {
      console.error('[Tracky] Gemini question answering failed:', e);
      return [];
    }
  },

  async generateCoverLetter(jobDetails) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_details: jobDetails })
      });
      if (!resp.ok) return '';
      const data = await resp.json();
      return data.cover_letter || '';
    } catch (e) {
      console.error('[Tracky] Gemini cover letter generation failed:', e);
      return '';
    }
  },

  async recordApplication(appData) {
    try {
      await fetch(`${this.baseUrl}/api/applications/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData)
      });
    } catch (e) {
      console.warn('[Tracky] Failed to record application:', e);
    }
  },

  async saveQAPair(question, answer, category = 'general') {
    if (!question || !answer) return false;
    try {
      const resp = await fetch(`${this.baseUrl}/api/qa-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: String(question).trim(),
          answer_value: String(answer).trim(),
          category: category
        })
      });
      return resp.ok;
    } catch (e) {
      console.warn('[Tracky] Failed to save QA memory to database:', e);
      return false;
    }
  },

  activeAbortController: null,

  abortCurrentStep() {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch (e) {}
      this.activeAbortController = null;
    }
  },

  async navigateStep(payload, timeoutMs = 8000) {
    this.abortCurrentStep();
    const controller = new AbortController();
    this.activeAbortController = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      this.activeAbortController = null;

      if (!resp.ok) {
        return {
          action: 'stuck',
          reason: `Server responded with status ${resp.status}`,
          reasoning: 'Failed to communicate with Tracky AI local backend.'
        };
      }
      return await resp.json();
    } catch (e) {
      clearTimeout(timer);
      this.activeAbortController = null;
      const isTimeout = e.name === 'AbortError';
      console.warn('[Tracky] Navigation step error/timeout:', isTimeout ? 'Aborted / Timed out' : e.message);
      return {
        action: 'stuck',
        reason: isTimeout ? 'Request cancelled or timed out' : (e.message || 'Network connection failed'),
        reasoning: isTimeout
          ? "Navigation was paused or cancelled."
          : 'Cannot reach local Tracky backend at http://127.0.0.1:5050'
      };
    }
  },

  async scoreJob(jobDetails) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/score-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_details: jobDetails })
      });
      if (!resp.ok) return 75;
      const data = await resp.json();
      return data.match_score ?? 75;
    } catch (e) {
      return 75;
    }
  },

  async getSessionStatus() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/session/status`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      return null;
    }
  },

  async getNextBatchJob() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/session/next-job`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.job || null;
    } catch (e) {
      return null;
    }
  },

  async recordSessionJob(payload) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/session/record-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return resp.ok;
    } catch (e) {
      return false;
    }
  },

  async startSession(mode = 'batch', job = null) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, job })
      });
      return await resp.json();
    } catch (e) {
      return null;
    }
  },

  async stopSession() {
    try {
      await fetch(`${this.baseUrl}/api/ai/session/stop`, { method: 'POST' });
    } catch (e) {}
  },

  async getSessionSettings() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ai/session-settings`);
      if (!resp.ok) return {};
      return await resp.json();
    } catch (e) {
      return {};
    }
  }
};
