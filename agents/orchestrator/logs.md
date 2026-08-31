# Orchestrator Permanent Activity Logs

## 2026-08-31 — Session Sync, Dashboard Metrics & Auto-Apply Investigation
- **Branch**: `fix/session-sync-metrics-and-autoapply`
- **Investigation Results**:
  1. *Session Sync Failure & Stale Timestamp*:
     - In the frontend, "Open in New Tab" opened external browsers (Chrome/Safari) which are completely isolated from Python Playwright.
     - Playwright was never running during the login, so clicking "Verify" didn't capture the new cookies or update `updated_at`.
     - Saved session files only contained pre-login tracking cookies (`pathname: "/login"`).
  2. *Total Tracked & Applied Count Broken*:
     - `/api/status` crashed with an `AttributeError` because `dashboard_server.py` called `db.get_application_stats` (which did not exist in `db.py`).
  3. *Auto-Apply Daemon Crash & Login Proof Failure*:
     - `main.py` crashed on `db_module.count_today_applications` (missing method).
     - Because session files only contained pre-login cookies, appliers were presented with login pages and took screenshots of the login prompt.
- **Action**: Created detailed `implementation_plan.md` artifact and requested user approval.
