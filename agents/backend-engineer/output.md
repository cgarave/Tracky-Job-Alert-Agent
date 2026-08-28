# Backend Engineer Output & Services Status

## Core Backend Modules
- `job_agent/main.py`: Main scraper daemon & autonomous auto-apply loop
- `job_agent/dashboard_server.py`: REST API server & static asset host (Port 8765)
- `job_agent/db.py`: SQLite database layer (`job_agent/seen_jobs.db`)
- `job_agent/notifier.py`: AppleScript iMessage dispatch
- `job_agent/applier/engine.py`: Central multi-platform application dispatcher
- `job_agent/applier/session_manager.py`: Interactive browser cookie snapshot helper
