# Orchestrator Task Plan

## Current Task: Fix Login Window Twitching & Universal Easy Apply Button Detection

### Phase 1: Interactive Login Window Stabilization [IN PROGRESS]
- [ ] Add single-instance check in `session_manager.py` to prevent duplicate concurrent launches
- [ ] Remove `--start-maximized` and set native `--window-size=1366,850`
- [ ] Handle OAuth/SSO popups gracefully (`page.on('popup')`)

### Phase 2: Universal Easy Apply Selector Engine [IN PROGRESS]
- [ ] Expand Indeed Easy Apply selectors + React hydration waiting
- [ ] Expand JobStreet (SEEK) Apply selectors + hydration waiting
- [ ] Expand OnlineJobs.ph and LinkedIn Easy Apply selectors
- [ ] Add explicit external ATS redirect extraction (Workday, Greenhouse, Lever)

### Phase 3: Verification & Validation
- [ ] Run `./scripts/agent-verify.sh`
- [ ] Test single-instance Playwright launcher
- [ ] Test selector detection logic
- [ ] Commit with developer documentation
