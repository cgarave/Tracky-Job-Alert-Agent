# Orchestrator Task Plan

## Current Task: Fix Session Sync, Metrics Counters, and Auto-Apply Execution

### Phase 1: Database & Status API Layer [PENDING APPROVAL]
- [ ] Add `count_today_applications(conn)` and alias `get_application_stats = get_stats` in `db.py`
- [ ] Fix timezone-aware `today_applied` query in `db.get_stats()`
- [ ] Fix `/api/status` in `dashboard_server.py` to call `db.get_stats(conn)`

### Phase 2: Session Manager & Interactive Browser Sync [PENDING APPROVAL]
- [ ] Upgrade `launch_interactive_login()` to auto-detect login completion and immediately flush cookies with updated timestamp
- [ ] Add `save_raw_cookies(platform, cookies)` for direct cookie sync
- [ ] Add `/api/sessions/import` endpoint in `dashboard_server.py`

### Phase 3: Auto-Apply Daemon & Applier Resilience [PENDING APPROVAL]
- [ ] Fix `count_today_applications` call in `main.py` auto-apply loop
- [ ] Enforce session pre-checks across all platforms in `main.py`
- [ ] Add explicit login detection and user notices in appliers

### Phase 4: Frontend Connect Modal & Live Status Refresh [PENDING APPROVAL]
- [ ] Enhance `connect-platform-modal.tsx` with 1-Click Interactive Login Launcher and live polling
- [ ] Add Cookie Import / Paste tab in modal
- [ ] Verify live timestamp and cookie count refresh

### Phase 5: Verification & Testing
- [ ] Execute `./scripts/agent-verify.sh`
- [ ] Run Python unit tests for `get_stats()`, `count_today_applications()`, and session auth
- [ ] Create atomic local commits with developer documentation
