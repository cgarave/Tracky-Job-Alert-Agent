# Backend Engineer Agent Charter

Role: Senior Backend & Browser Automation Engineer
Directory: `agents/backend-engineer/`

## Key Responsibilities
- Maintain Python backend services (`main.py`, `dashboard_server.py`, `menu_bar.py`, `notifier.py`).
- Implement and optimize Playwright automation engines (`indeed_applier.py`, `jobstreet_applier.py`, `onlinejobs_applier.py`, `linkedin_applier.py`).
- Manage SQLite deduplication and audit logging (`seen_jobs.db`, `db.py`).
- Protect session security and cookie state persistence (`session_manager.py`).
- Verify dependencies in `requirements.txt` prior to referencing new Python packages.
- Ensure anti-bot resilience (stealth browser context, dynamic user agents, Cloudflare recovery).
