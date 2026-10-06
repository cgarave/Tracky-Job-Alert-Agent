"""
Tracky — main daemon entry point.

Runs two concurrent threads:
  • Scraper thread  — sleeps for the configured interval, scrapes all job boards,
                      sends iMessage alerts for any new listings found.
  • Listener thread — polls ~/Library/Messages/chat.db every 10 s for incoming
                      commands from the user and dispatches them to commander.py.

Also supports cross-process communication with the menu bar app via:
  • daemon.pid    — PID file read by the menu bar to send SIGUSR1
  • run_now.flag  — flag file written by the menu bar to request an immediate scan
  • status.json   — written after every scan so the menu bar can show live stats

Usage:
    python3 main.py            # Normal daemon mode
    python3 main.py --dry-run  # One-shot scrape, prints results, no messages sent
"""
import json
import logging
import os
import signal
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Logging
# When running as a launchd daemon, stdout is already redirected to the log
# file via StandardOutPath in the plist — adding a StreamHandler here would
# cause every line to be written twice.  Only attach StreamHandler when
# running interactively in a terminal.
# ---------------------------------------------------------------------------
def configure_logging():
    path = Path.home() / "Library" / "Logs" / "jobagent.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                        handlers=[logging.FileHandler(path), logging.StreamHandler()])

import config_store
from scan_state import ScanState, now
scan_state = ScanState()

logger = logging.getLogger("job_agent")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
CONFIG_PATH  = BASE_DIR / "config.json"
STATUS_PATH  = BASE_DIR / "status.json"   # Read by menu bar app
PID_PATH     = BASE_DIR / "daemon.pid"    # Read by menu bar app
RUN_NOW_FLAG = BASE_DIR / "run_now.flag"  # Written by menu bar app

# ---------------------------------------------------------------------------
# Shared event — set by the /run iMessage command OR by SIGUSR1 from the
# menu bar app to trigger an immediate scrape without waiting for the interval.
# ---------------------------------------------------------------------------
run_now_event = scan_state.event


# ---------------------------------------------------------------------------
# Signal handler (SIGUSR1 sent by the menu bar "Run Now" button)
# ---------------------------------------------------------------------------

def _handle_sigusr1(signum, frame) -> None:
    logger.info("SIGUSR1 received — triggering immediate scan.")
    scan_state.request()

def _handle_sigterm(signum, frame) -> None:
    logger.info("SIGTERM received — shutting down Tracky daemon.")
    _delete_pid()
    sys.exit(0)




# ---------------------------------------------------------------------------
# PID file — written on startup, deleted on exit
# ---------------------------------------------------------------------------

def _write_pid() -> None:
    PID_PATH.write_text(str(os.getpid()))
    logger.debug(f"PID {os.getpid()} written to {PID_PATH}")


def _delete_pid() -> None:
    PID_PATH.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Status file — written after every scan for the menu bar to display
# ---------------------------------------------------------------------------

def _write_status(jobs_tracked: int) -> None:
    try:
        config_store.atomic_json(STATUS_PATH, {
            "last_scan_time": scan_state.snapshot().get('completed_at'),
            "jobs_tracked": jobs_tracked, "scan": scan_state.snapshot(),
        })
    except OSError:
        logger.warning("Could not persist scan status")


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Config & Recipient Helpers
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Read config.json from disk (called fresh on every loop iteration)."""
    return config_store.load(CONFIG_PATH)


def get_active_recipients(config: dict) -> list[dict]:
    """
    Extract normalized list of recipient dicts from config.
    Supports new `recipients` array as well as legacy `recipient` comma-separated string.
    """
    raw_recipients = config.get("recipients")
    if isinstance(raw_recipients, list):
        results = []
        for idx, r in enumerate(raw_recipients):
            if not isinstance(r, dict):
                continue
            r_id = str(r.get("id") or f"rec_{idx}_{r.get('destination', '')}")
            results.append({
                "id": r_id,
                "name": str(r.get("name") or r.get("destination") or f"Recipient {idx+1}"),
                "platform": str(r.get("platform", "imessage")).lower().strip(),
                "destination": str(r.get("destination", "")).strip(),
                "keywords": [str(k).strip() for k in r.get("keywords", []) if str(k).strip()],
                "enabled": bool(r.get("enabled", True)),
            })
        return results

    # Fallback to legacy single/comma-separated recipient string
    from notifier import parse_recipients
    legacy_rec = config.get("recipient", "")
    parsed = parse_recipients(legacy_rec)
    fallback_keywords = config.get("keywords", [])
    results = []
    for idx, dest in enumerate(parsed):
        results.append({
            "id": f"legacy_{idx}_{dest}",
            "name": f"Recipient {idx+1}",
            "platform": "imessage",
            "destination": dest,
            "keywords": fallback_keywords,
            "enabled": True,
        })
    return results


def get_all_scraping_keywords(config: dict) -> list[str]:
    """
    Collect the unified list of keywords to scrape across all enabled recipients
    and global fallback keywords.
    """
    seen_lower = set()
    unified: list[str] = []

    # 1. Global keywords
    for kw in config.get("keywords", []):
        cleaned = str(kw).strip()
        if cleaned and cleaned.lower() not in seen_lower:
            seen_lower.add(cleaned.lower())
            unified.append(cleaned)

    # 2. Recipient keywords
    for rec in get_active_recipients(config):
        if not rec.get("enabled", True):
            continue
        for kw in rec.get("keywords", []):
            cleaned = str(kw).strip()
            if cleaned and cleaned.lower() not in seen_lower:
                seen_lower.add(cleaned.lower())
                unified.append(cleaned)

    return unified


# ---------------------------------------------------------------------------
# Scraper thread
# ---------------------------------------------------------------------------

def _run_scrape(config: dict, db_conn, dry_run: bool = False) -> list[dict]:
    """
    Execute all scrapers for all configured keywords.
    Returns a list of NEW job dicts (not yet seen in the DB).
    Marks new jobs as seen in the DB unless dry_run is True.
    """
    from scrapers import indeed, jobstreet, onlinejobs, linkedin
    import db as db_module

    keywords = get_all_scraping_keywords(config)
    location = config.get("location", "Philippines")
    max_results = config.get("max_results_per_keyword", 10)

    if not keywords:
        logger.warning("No keywords configured for scraping.")
        return []

    new_jobs: list[dict] = []
    seen_ids: set[str] = set()  # deduplicate within a single run
    sources = (indeed, jobstreet, onlinejobs, linkedin)
    workers = max(1, min(8, int(config.get('scan_workers', 4))))
    timeout_seconds = max(5, min(300, int(config.get('source_timeout_seconds', 45))))
    tasks = [(keyword, scraper) for keyword in keywords for scraper in sources]

    def scrape_one(keyword, scraper):
        return scraper.scrape(keyword, location, max_results)

    scan_state.update(total_tasks=len(tasks))
    executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix='tracky-scraper')
    futures = {executor.submit(scrape_one, keyword, scraper): (keyword, scraper) for keyword, scraper in tasks}
    try:
        for future in as_completed(futures):
            keyword, scraper = futures[future]
            source = scraper.__name__.split('.')[-1]
            error = None
            source_started = time.monotonic()
            result_count = 0
            try:
                jobs = future.result(timeout=timeout_seconds)
                result_count = len(jobs)
                for job in jobs:
                    job_id = db_module.make_job_id(job["title"], job["company"], job["url"])
                    job["job_id"] = job_id
                    job["search_keyword"] = keyword
                    if "search_keywords" not in job:
                        job["search_keywords"] = []
                    if keyword not in job["search_keywords"]:
                        job["search_keywords"].append(keyword)

                    if job_id not in seen_ids and db_module.is_new(db_conn, job_id):
                        seen_ids.add(job_id)
                        new_jobs.append(job)
                        if not dry_run:
                            db_module.mark_seen(db_conn, job)
                    elif job_id in seen_ids:
                        # Append search keyword to the in-flight job object
                        for existing_job in new_jobs:
                            if existing_job.get("job_id") == job_id:
                                if "search_keywords" not in existing_job:
                                    existing_job["search_keywords"] = []
                                if keyword not in existing_job["search_keywords"]:
                                    existing_job["search_keywords"].append(keyword)
            except FuturesTimeoutError:
                future.cancel()
                error = f'Source exceeded {timeout_seconds}s deadline'
                logger.error("Scraper timed out: %s", source)
            except Exception as exc:
                error = str(exc)
                logger.error("Scraper failed: %s", source)
            finally:
                duration_ms = round((time.monotonic() - source_started) * 1000)
                category = ('timeout' if error and 'deadline' in error else
                            'rate_limited' if error and any(word in error.lower() for word in ('429', 'rate')) else
                            'blocked' if error and any(word in error.lower() for word in ('captcha', 'blocked', 'forbidden')) else
                            'parser' if error and any(word in error.lower() for word in ('parse', 'selector')) else
                            'unavailable' if error and any(word in error.lower() for word in ('connect', 'unavailable', 'timeout')) else None)
                scan_state.task_done(source, keyword, error, duration_ms, result_count)
                db_module.record_source_health(db_conn, source, duration_ms=duration_ms,
                                               result_count=result_count, error=error,
                                               error_category=category)
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    if not dry_run:
        # Persist all discovery keywords after duplicate results have been merged.
        for job in new_jobs:
            db_module.mark_seen(db_conn, job)
    return new_jobs


def run_scan(config, conn, dry_run=False):
    import db
    import delivery
    scan_state.begin(0)
    scan_state.update(dry_run=bool(dry_run))
    try:
        jobs = _run_scrape(config, conn, dry_run=dry_run)
        if not dry_run:
            counts = delivery.dispatch(conn, get_active_recipients(config), config.get('telegram_bot_token', ''))
            scan_state.update(deliveries=counts)
        scan_state.finish(len(jobs))
        return jobs
    except Exception as exc:
        scan_state.finish(error=str(exc))
        logger.exception('Scan failed')
        return []
    finally:
        if not dry_run:
            _write_status(db.total_seen(conn))


def scraper_loop(dry_run: bool = False) -> None:
    """Poll settings promptly, schedule scans, and drain pending deliveries."""
    import db
    import delivery
    conn = db.get_connection()
    last_scan = None
    last_delivery = 0
    was_paused = True
    try:
        if dry_run:
            jobs = run_scan(load_config(), conn, dry_run=True)
            print(f"[DRY RUN] {len(jobs)} new listings; no notifications sent.")
            return
        while True:
            try:
                config = load_config()
                if RUN_NOW_FLAG.exists():
                    RUN_NOW_FLAG.unlink(missing_ok=True)
                    scan_state.request()
                paused = config.get('paused', True)
                manual = run_now_event.is_set()
                manual_dry_run = scan_state.consume_request_mode() if manual else False
                due = not paused and (was_paused or last_scan is None or
                      time.monotonic() - last_scan >= config['check_interval_minutes'] * 60)
                was_paused = paused
                if manual or due:
                    run_scan(config, conn, dry_run=manual_dry_run)
                    last_scan = time.monotonic()
                    last_delivery = last_scan
                elif not paused and time.monotonic() - last_delivery >= 60:
                    counts = delivery.dispatch(conn, get_active_recipients(config), config.get('telegram_bot_token', ''))
                    scan_state.update(deliveries=counts)
                    last_delivery = time.monotonic()
            except Exception:
                logger.exception('Daemon cycle failed; retrying on next tick')
            run_now_event.wait(timeout=1)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Listener thread
# ---------------------------------------------------------------------------

def listener_loop() -> None:
    """
    Polls chat.db every 10 s for incoming messages from any configured iMessage recipients.
    Passes any recognised commands to commander.execute().
    Also checks for run_now.flag written by the menu bar app.
    """
    from listener import get_messages_since
    import commander
    from notifier import send_imessage

    logger.info("Command listener started (polling chat.db every 10 s for incoming bot commands)")

    # Start from "now" so we don't re-process old messages on startup
    last_check = time.time()

    while True:
        time.sleep(10)
        try:
            config = load_config()
            recipients = [
                r['destination'] for r in get_active_recipients(config)
                if r.get('enabled', True) and r['platform'] == 'imessage' and r['destination']
            ]
            # Use the poll start as the next boundary so arrivals during processing aren't lost.
            poll_started = time.time()
            for msg in get_messages_since(recipients, last_check):
                commander.execute(msg['text'], lambda reply, dest=msg['reply_to']: send_imessage(dest, reply), scan_state)
            last_check = poll_started
        except Exception as exc:
            logger.error(f"Listener loop error: {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    configure_logging()
    signal.signal(signal.SIGUSR1, _handle_sigusr1)
    signal.signal(signal.SIGTERM, _handle_sigterm)
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        logger.info("=== Tracky — DRY RUN ===")
        scraper_loop(dry_run=True)
        return

    config = load_config()
    recipients = get_active_recipients(config)

    logger.info("=== Tracky starting ===")

    if not recipients and not config.get("recipient"):
        logger.info(
            "No recipients configured yet in config.json — dashboard server is online at http://127.0.0.1:5050 to configure recipients."
        )

    # Write PID file so the menu bar app can send SIGUSR1
    _write_pid()

    try:
        # Start GUI dashboard server on http://127.0.0.1:5050
        http_server = None
        try:
            from dashboard_server import start_dashboard_server
            http_server = start_dashboard_server(port=5050, background=True, scan_controller=scan_state)
            logger.info("🐶 Tracky Control Center Dashboard started at http://127.0.0.1:5050")
        except Exception as exc:
            logger.warning(f"Could not start dashboard server: {exc}")

        # Start listener in a background daemon thread
        listener_thread = threading.Thread(
            target=listener_loop,
            name="listener",
            daemon=True,
        )
        listener_thread.start()

        # Run the scraper in the main thread (keeps the process alive)
        scraper_loop(dry_run=False)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Tracky stopped.")
    finally:
        if 'http_server' in locals() and http_server:
            try:
                http_server.shutdown()
                http_server.server_close()
            except Exception:
                pass
        _delete_pid()
        logger.info("Tracky exited.")



if __name__ == "__main__":
    main()
