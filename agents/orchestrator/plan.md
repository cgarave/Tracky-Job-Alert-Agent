# Orchestrator Task Plan

## Current Task: Enterprise Minimal UI/UX Redesign & System Hardening

### Phase 1: Frontend Enterprise Minimal Redesign & View Toggle [COMPLETED]
- [x] Purge all unicode emojis across `frontend/src/` (15 locations) and replace with standardized Lucide React icons
- [x] Remove "Default Login Browser" banner, split buttons, and selectors from `sessions-tab.tsx` and `settings-tab.tsx`
- [x] Streamline `connect-platform-modal.tsx` into a minimal 2-step flow: Open in New Tab ↗ -> Verify Session
- [x] Add high-density Table View vs Card Grid view toggle in Scraped Jobs tab
- [x] Modernize cards, tables, badges, and modals to Linear/Raycast dark minimal aesthetic

### Phase 2: Backend System Hardening & Query Fix [COMPLETED]
- [x] Fix 1-to-many left join duplication in `get_jobs()` in `db.py`
- [x] Add missing SQLite indexes on `seen_jobs` and `applications`
- [x] Harden `is_session_active()` in `session_manager.py` to prevent guest cookie false positives
- [x] Streamline `browser_manager.py` and `dashboard_server.py`
- [x] Add post-submit confirmation verification in `indeed_applier.py`

### Phase 3: Cross-Agent Testing & Build Validation [COMPLETED]
- [x] Run `./scripts/agent-verify.sh` (Python compilation + Next.js static build)
- [x] Unit test deduplication subquery logic
- [x] QA Reviewer and Tester verification pass
- [x] Atomic local commits with developer documentation
