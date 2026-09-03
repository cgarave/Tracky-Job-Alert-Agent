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
  }
};
