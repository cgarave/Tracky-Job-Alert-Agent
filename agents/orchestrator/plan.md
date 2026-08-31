# Orchestrator Task Plan — Remove Auto-Apply Feature Entirely

## Goal: Remove entire Auto-Apply subsystem and return to a pure, fast, minimal Job Discovery & Alert Agent

### Phase 1: Backend Cleanup [IN PROGRESS]
- [ ] Delete `job_agent/applier/` directory (`engine.py`, `session_manager.py`, `stealth.py`, `indeed_applier.py`, `jobstreet_applier.py`, `linkedin_applier.py`, `onlinejobs_applier.py`, `browser_manager.py`)
- [ ] Delete `job_agent/profile_manager.py` and `job_agent/ai_parser.py`
- [ ] Delete `job_agent/data/profiles/`, `data/sessions/`, `data/resumes/`, `data/screenshots/`
- [ ] Simplify `dashboard_server.py` to remove all apply/session/profile endpoints
- [ ] Simplify `main.py` to remove auto-apply loop
- [ ] Simplify `db.py` to focus on `seen_jobs` and alert statistics

### Phase 2: Frontend Cleanup & UI Streamlining [IN PROGRESS]
- [ ] Delete `autoapply-tab.tsx`, `history-tab.tsx`, `sessions-tab.tsx`, `profile-tab.tsx`, `screening-tab.tsx`
- [ ] Delete `apply-modal.tsx`, `connect-platform-modal.tsx`, `screenshot-modal.tsx`
- [ ] Update `sidebar.tsx` to 2 clean tabs: Jobs Feed & Agent Settings
- [ ] Update `stats-ribbon.tsx` to show Total Tracked, Today's New Jobs, Monitored Keywords, Alert Status
- [ ] Update `jobs-tab.tsx` to remove apply buttons, keeping clean "Open Job ↗"
- [ ] Update `page.tsx`, `types/index.ts`, and `lib/api.ts`

### Phase 3: Build & Static Asset Generation [IN PROGRESS]
- [ ] Run `npm run build:static` in `frontend/`
- [ ] Run `./scripts/agent-verify.sh`
- [ ] Commit changes and restart server

### Phase 4: Verification & Conclusion [IN PROGRESS]
- [ ] Verify clean UI and API endpoints
- [ ] Update `walkthrough.md`
- [ ] Conclude `/goal`
