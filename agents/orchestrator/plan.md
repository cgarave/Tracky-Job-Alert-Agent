# Orchestrator Task Plan — Bulk & Single Job Deletion with Selection Controls

## Goal: Implement select checkboxes, Select All, single & bulk deletion, floating action bar, and future-scan ignore options

### Phase 1: Backend Database & API Endpoints [PENDING APPROVAL]
- [ ] Add `dismissed_jobs` table and `delete_jobs` / `delete_all_jobs` functions to `job_agent/db.py`
- [ ] Update `is_new()` to check both `seen_jobs` and `dismissed_jobs`
- [ ] Add `DELETE /api/jobs` endpoint to `job_agent/dashboard_server.py` supporting ID arrays and filter purges

### Phase 2: Frontend Deletion Modal & API Client [PENDING APPROVAL]
- [ ] Create `frontend/src/components/modals/delete-confirm-modal.tsx` with "Don't alert me again" toggle
- [ ] Add `deleteJobs()` and `deleteAllJobs()` to `frontend/src/lib/api.ts`

### Phase 3: Jobs Feed Selection & Floating Action Bar [PENDING APPROVAL]
- [ ] Add selection state and Shift+Click range selection to `frontend/src/components/tabs/jobs-tab.tsx`
- [ ] Add master Select All checkbox with indeterminate state support in table and grid
- [ ] Add floating bottom action bar with count indicator, delete action, database-wide select banner, and Escape key listener
- [ ] Add quick single-item delete icon on each table row and card

### Phase 4: Verification & Build [PENDING APPROVAL]
- [ ] Run `./scripts/agent-verify.sh` and `npm run build:static`
- [ ] Restart daemon server and test API & UI live
- [ ] Update `walkthrough.md` and commit changes
