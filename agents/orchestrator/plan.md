# Orchestrator Task Plan

## Current Task (/goal): Fix Google SSO Popup Loop & Cloudflare Turnstile Bypass

### Phase 1: Stealth & Turnstile Solver Module [IN PROGRESS]
- [ ] Create `job_agent/applier/stealth.py`
- [ ] Implement CDP anti-detection script (`STEALTH_EVASION_SCRIPT`)
- [ ] Implement `solve_turnstile_challenge(page)` with humanized mouse trajectory
- [ ] Implement `configure_stealth_context(context)` with Google One Tap route suppression

### Phase 2: Login Helper Google SSO Stabilization [IN PROGRESS]
- [ ] Update `session_manager.py` to use `ignore_default_args=["--enable-automation"]`
- [ ] Block Google One Tap auto-flapping routes (`**/gsi/iframe**`, `**/gsi/select**`)
- [ ] Connect `stealth.py` configuration to interactive session helper

### Phase 3: Indeed & Platform Appliers Hardening [IN PROGRESS]
- [ ] Update `indeed_applier.py` to use stealth context and Turnstile challenge solver
- [ ] Update `jobstreet_applier.py` and `linkedin_applier.py` with stealth configuration

### Phase 4: Verification & Automated Tests [IN PROGRESS]
- [ ] Test Google One Tap suppression on `https://secure.indeed.com/account/login` (0 flickering tabs)
- [ ] Test Turnstile solver resolution
- [ ] Run `./scripts/agent-verify.sh`
- [ ] Make atomic local commits
- [ ] Conclude `/goal`
