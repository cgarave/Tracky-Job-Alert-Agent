# Backend Technical Audit & Architectural Health Report

**Generated Date:** 2026-08-28  
**Scope:** `job_agent/` (API Server, Automation Appliers, Scrapers, Session Security, Database Layer)  
**Author:** Backend Engineer Agent

---

## 1. Executive Summary

A deep technical audit of the entire backend codebase in `job_agent/` was conducted across all core subsystems:
1. **API Server & Routing Layer (`dashboard_server.py`)**
2. **Session Security & Cookie Management (`session_manager.py`)**
3. **Browser Lifecycle & Launcher (`browser_manager.py`)**
4. **Application Dispatcher & Engine (`engine.py`, `*_applier.py`)**
5. **Daemon & Concurrency Loop (`main.py`, `commander.py`, `notifier.py`, `listener.py`)**
6. **Persistence & Deduplication Layer (`db.py`)**
7. **Multi-Source Job Scrapers (`scrapers/indeed.py`, `scrapers/jobstreet.py`, `scrapers/onlinejobs.py`, `scrapers/linkedin.py`)**

The backend architecture is functional, modular, and has zero external database dependencies (using SQLite + Playwright). However, the audit identified several **critical correctness bugs, session verification false positives, performance bottlenecks, and obsolete/redundant browser selector code** that require targeted hardening.

---

## 2. Detailed Findings by Module

### 2.1 API & Server Layer (`job_agent/dashboard_server.py`)
- **Port Alignment**: Runs on `http://127.0.0.1:5050` using `ThreadingHTTPServer`.
- **Unbounded Worker Thread Spawning (Bottleneck / Denial-of-Service Risk)**:
  - When `/api/apply` or `/api/sessions/login` is called, a new unmanaged `threading.Thread(target=..., daemon=True)` is spawned immediately.
  - If a user triggers multiple applications rapidly, multiple heavyweight Playwright Chromium processes launch simultaneously, consuming several gigabytes of RAM and saturating the CPU.
  - *Recommendation*: Introduce a task queue or semaphore (`threading.BoundedSemaphore(value=2)`) to limit concurrent browser automation processes.
- **Multipart Upload Parsing (`/api/resume/upload`)**:
  - The custom multipart parser splits on `\r\n\r\n` and extracts filename with string splitting. While lightweight, it loads the entire payload into RAM at once without an enforced payload size cap (e.g. 20MB limit).
  - *Recommendation*: Add Content-Length validation before parsing.
- **Redundant Browser Selector Endpoints**:
  - `GET /api/browsers` and `POST /api/browsers/preferred` remain active despite the requirement to remove the "Default Login Browser" option in the UI and rely on automatic Chromium engine resolution.

---

### 2.2 Session Verification & Cookie Security (`job_agent/applier/session_manager.py`)
- **Guest Cookie False Positive in `is_session_active()`**:
  - `is_session_active(platform)` checks only if `session_{platform}.json` exists and `len(data.get("cookies", [])) > 0`.
  - **Issue**: Visiting any login page sets unauthenticated guest cookies (e.g. Cloudflare `__cf_bm`, session identifiers, load balancer cookies). If a user opens the browser helper and closes it without logging in, `session_*.json` is saved with guest cookies, causing `is_session_active` to return `True` (Connected) even though the user is **NOT authenticated**.
  - *Recommendation*: Check for specific platform auth cookies:
    - **LinkedIn**: `li_at` or `JSESSIONID`
    - **Indeed**: `SURF`, `SHOE`, `CTK`, or `SHARED_INDEED_CSRF_TOKEN`
    - **JobStreet**: `SEEK_AUTH_TOKEN`, `oauth_token`, or `JSESSIONID`
    - **OnlineJobs**: `session_id`, `oj_user`, or user session cookies
- **Asynchronous Save Verification Timing**:
  - `verify_and_save_active_session` uses an arbitrary `time.sleep(1.2)` to wait for disk flushing. If disk I/O is slow, it might check status before the storage state is written. A synchronization event (`save_complete_event`) should be used instead.

---

### 2.3 Browser Lifecycle & Redundant Logic (`job_agent/applier/browser_manager.py`)
- **Redundant Browser Detection Matrix**:
  - Scans for 9 browser variations across macOS, Windows, and Linux (`safari`, `brave`, `chrome`, `edge`, `arc`, `firefox`, `opera`, `vivaldi`, `chromium`).
  - Per user requirements, the frontend "Default Login Browser" selection is being removed. The backend can simplify default selection to prioritize Playwright Chromium / Installed Chrome with standard headless fallback without requiring user configuration.
- **WebKit Limitations on macOS**:
  - `safari` launches Playwright's WebKit build rather than Apple's native Safari application session, which can have differences in storage and extension support. Chromium with anti-bot evasion remains the most reliable engine.

---

### 2.4 Application Engine & Post-Submit Verification (`job_agent/applier/engine.py` & Appliers)
- **Zero False-Positive Verification Comparison**:
  | Applier | Post-Submit DOM Element Confirmation | Stealth Evasion (`navigator.webdriver`) | Cloudflare / External Routing |
  | :--- | :--- | :--- | :--- |
  | `jobstreet_applier.py` | ✅ Strict (`"success"`, `"application sent"`, `"applied"`) | ✅ Injected | ✅ Detected & Routed |
  | `onlinejobs_applier.py` | ✅ Strict (`"sent successfully"`, `"application sent"`) | ✅ Injected | ✅ Requires Session |
  | `linkedin_applier.py` | ✅ Strict (`"application sent"`, `"applied"`, `"success"`) | ✅ Injected | ✅ Detected & Routed |
  | `indeed_applier.py` | ❌ **GAP: Returns `success: True` after click + 4s sleep without post-submit DOM validation** | ✅ Injected | ✅ Detected & Routed |
- **Indeed Applier False-Positive Risk**:
  - In `indeed_applier.py`, after clicking `submit_btn`, it immediately captures a screenshot and returns `{"success": True}` without checking whether a form validation error occurred, whether a captcha was triggered, or whether the confirmation message appeared.
  - *Recommendation*: Add strict confirmation verification checking for `application submitted`, `your application has been sent`, or checkmark badges before marking `success: True`.

---

### 2.5 Persistence & Database Layer (`job_agent/db.py`)
- **Duplicate Job Rows Bug on `get_jobs()`**:
  - Current SQL query:
    ```sql
    SELECT j.*, a.status as application_status, a.applied_at, a.mode, a.screenshot_path
    FROM seen_jobs j
    LEFT JOIN applications a ON j.job_id = a.job_id
    ORDER BY j.seen_at DESC LIMIT ? OFFSET ?
    ```
  - **Critical Issue**: Because `applications` has a 1-to-many relationship with `seen_jobs` (e.g. initial failed attempt followed by retry), this `LEFT JOIN` returns multiple duplicate rows for the same job listing in the dashboard jobs view.
  - *Fix*: Join against a subquery selecting only the latest application record per `job_id`:
    ```sql
    LEFT JOIN (
        SELECT job_id, status, applied_at, mode, screenshot_path, error_message, MAX(id) as max_id
        FROM applications
        GROUP BY job_id
    ) a ON j.job_id = a.job_id
    ```
- **Missing Database Performance Indexes**:
  - `seen_jobs(seen_at DESC)` — heavily used for sorting
  - `seen_jobs(source)` — used for filtering
  - `applications(job_id)` — used for foreign key joins
  - `applications(applied_at)` — used for daily cap counts

---

### 2.6 Background Daemon & Scraper Resiliency (`job_agent/main.py` & Scrapers)
- **SQLite Connection Lifetime in Daemon Loop**:
  - `main.py` creates a single `db_conn = db_module.get_connection()` that stays open for days. Long-lived single SQLite connections can lock transactions or hold stale read states across multiple threads.
  - *Recommendation*: Use fresh context-managed connections (`with get_connection() as conn:`) per scan cycle.
- **Scraper Browser Context Reuse**:
  - `scrapers/jobstreet.py` launches and closes a new Chromium instance for every search keyword. If 5 keywords are configured, 5 separate browser processes are launched consecutively.
  - *Recommendation*: Pass a shared browser context or execute queries within a single browser session.

---

## 3. Prioritized Action Plan

| Priority | Component | Action Item | Expected Impact |
| :---: | :--- | :--- | :--- |
| **P0** | `job_agent/db.py` | Fix duplicate job rows in `get_jobs()` via latest application subquery. Add indexes. | Eliminates duplicated rows in dashboard and improves query speed. |
| **P0** | `job_agent/applier/indeed_applier.py` | Implement strict post-submit confirmation DOM verification. | Ensures 100% zero false-positive applications on Indeed. |
| **P0** | `job_agent/applier/session_manager.py` | Validate specific auth cookies in `is_session_active()` rather than `len(cookies) > 0`. | Prevents unauthenticated guest cookies from being flagged as valid logins. |
| **P1** | `job_agent/dashboard_server.py` | Add concurrency semaphore for Playwright worker threads and payload size guard. | Prevents browser process memory spikes and resource contention. |
| **P1** | `job_agent/main.py` | Use scoped database connections per scan iteration instead of a single permanent connection. | Prevents SQLite database lock timeouts. |
| **P2** | `job_agent/applier/browser_manager.py` | Clean up redundant browser options and standardize on optimized Chromium launcher. | Streamlines codebase and removes deprecated settings logic. |
