# Tracky UX and Performance Implementation Plan

This checklist records the roadmap status. Checked items are implemented in the current workspace; unchecked items remain planned or only partially implemented.

## Dashboard experience

- [x] Replace six-second full refresh with incremental status polling.
- [x] Refresh jobs after initial load, manual refresh, page changes, and scan completion.
- [x] Display queued, running, completed, partial, failed, and paused scan states.
- [x] Display source progress and scan source errors.
- [x] Add server-side pagination for the job feed.
- [x] Add server-backed search, source, alert-state, saved, and application filters.
- [x] Add saved and applied feed modes.
- [x] Add save-job and mark-applied actions.
- [x] Add loading, empty, and retryable error states.
- [x] Add notification delivery history screen.
- [x] Add dismissed-job payload retention and restore API support.
- [x] Add dismissed-jobs recovery UI.
- [x] Add keyboard navigation and save/apply shortcuts in the job feed.
- [x] Add a collapsible narrow-window sidebar.
- [ ] Complete automated accessibility coverage and reduced-motion review.

## Job data quality and optimization

- [x] Normalize job URLs for stable deduplication.
- [x] Store search keywords on tracked jobs.
- [x] Add saved and application state fields and indexes.
- [x] Add persistent delivery retry queue with backoff.
- [x] Add pagination and indexed state queries.
- [x] Add persistent per-source health history and error categories.
- [x] Expose current per-source health, duration, and result counts in scan status.
- [x] Run scrapers concurrently with bounded workers.
- [ ] Reuse Playwright browser contexts across searches.
- [ ] Add source response caching and stale-description controls.
- [ ] Add stale-job retention and cleanup controls.

## Alerts and control surfaces

- [x] Add delivery state and history API support.
- [x] Add validated, atomic, revision-aware configuration saves.
- [x] Keep dashboard mutations loopback-only and CSRF-protected.
- [x] Restrict iMessage commands to authorized configured recipients.
- [ ] Add notification-history retry controls in the UI.
- [ ] Add quiet hours, digest scheduling, and per-recipient alert caps.
- [ ] Add first-run onboarding and requirement checks.
- [x] Add native SwiftUI setup app shell with step navigation and runtime checks.
- [x] Build the setup app for macOS 12+ as a universal arm64 and x86_64 binary.
- [x] Redesign macOS package onboarding and post-install setup guidance.
- [x] Add safe dry-run scan controls in the dashboard.
- [ ] Add repair guidance for missing permissions, browsers, assets, config, and ports.

## API and testing

- [x] Extend `/api/status` with scan state and delivery information.
- [x] Extend `/api/jobs` with pagination and state filters.
- [x] Add save, apply, restore, and delivery-history endpoints.
- [x] Keep secrets out of public status responses.
- [x] Add tests for configuration revisions, delivery retries, authorized commands, pagination, and triage state.
- [x] Build the static dashboard with webpack and copy it into `job_agent/static`.
- [x] Detect the newest compatible CPython runtime and isolate Tracky dependencies in a virtual environment.
- [x] Add local CV upload, explainable fit scoring, and best-fit job sorting.
- [x] Add optional Gemini CV analysis with an explicit API-key action.
- [x] Run frontend lint and Python compilation checks.
- [ ] Add frontend component and integration tests.
- [ ] Add automated accessibility checks.
- [ ] Add scraper and dashboard performance benchmarks.

## Build and release

- [x] Make `build:static` use the working webpack build path.
- [ ] Rebuild and install the final macOS `.pkg` after the remaining roadmap work is complete.
