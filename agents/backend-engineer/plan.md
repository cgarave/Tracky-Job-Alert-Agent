# Backend Engineer Task Plan

## Phase 1: Deep Technical Audit & Codebase Health Assessment
- [x] Audit `dashboard_server.py`, `session_manager.py`, `browser_manager.py`, `engine.py`, `main.py`, and `db.py`
- [x] Identify obsolete/redundant browser selector code & endpoints
- [x] Check scraper resiliency, freshness filters, and anti-detection mechanisms
- [x] Audit session verification and post-submit confirmation verification logic
- [x] Record detailed audit findings in `logs.md` and `output.md`

## Phase 2: Targeted Hardening & Refactoring Plan
- [ ] Refactor `db.py` `get_jobs()` query to deduplicate multiple application rows using subquery/window function.
- [ ] Add SQLite indexes for `seen_jobs(seen_at DESC)`, `seen_jobs(source)`, and `applications(job_id)`.
- [ ] Enhance `session_manager.py` `is_session_active()` with platform-specific auth token/cookie validation (preventing guest cookie false positives).
- [ ] Harden `indeed_applier.py` with strict post-submit confirmation text/element verification matching `jobstreet`, `onlinejobs`, and `linkedin`.
- [ ] Add application worker semaphore / queue in `dashboard_server.py` to prevent concurrent Playwright process stampedes.
- [ ] Streamline `browser_manager.py` and remove redundant user-facing browser selector logic as requested.

