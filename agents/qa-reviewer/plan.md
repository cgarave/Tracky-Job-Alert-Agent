# QA Reviewer Task Plan

## Current Task: Comprehensive System & Rule-Compliance Audit
- [x] Audit backend dependencies in `requirements.txt` vs AST imports in `job_agent/`, `scripts/`, `tests/`
- [x] Audit frontend dependencies in `frontend/package.json` vs AST imports in `frontend/src/`
- [x] Verify adherence to `agents/RULES.md` (Shadcn UI / Tailwind CSS tokens, zero inline styles, branching rules)
- [x] Review code for edge cases, error handling, session management, and security risks
- [x] Fix discovered bugs:
  - Fixed missing `logger` variable definition in `job_agent/ai_parser.py`
  - Fixed potential path traversal vulnerability in `/api/screenshot/<filename>` endpoint in `job_agent/dashboard_server.py`
  - Fixed offline build failure in `frontend/src/app/layout.tsx` (removed external Google Fonts fetch)
  - Fixed TypeScript interface empty object lint warnings in `InputProps` & `TextareaProps`
  - Fixed unescaped JSX quotes and unused imports across tabs and modals
  - Standardized error typing in frontend API handlers
- [x] Verify static compilation and type checking (`npx tsc --noEmit`, `npm run lint`, `python3 -m compileall`)
- [x] Document audit logs in `agents/qa-reviewer/logs.md` and `output.md`
- [x] Submit audit report to Orchestrator / Parent agent
