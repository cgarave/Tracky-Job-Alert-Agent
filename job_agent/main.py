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
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Logging
# When running as a launchd daemon, stdout is already redirected to the log
# file via StandardOutPath in the plist — adding a StreamHandler here would
# cause every line to be written twice.  Only attach StreamHandler when
# running interactively in a terminal.
# ---------------------------------------------------------------------------
LOG_PATH = Path.home() / "Library" / "Logs" / "jobagent.log"
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

_handlers: list[logging.Handler] = [logging.FileHandler(LOG_PATH)]
if sys.stdout.isatty():
    _handlers.append(logging.StreamHandler(sys.stdout))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=_handlers,
)
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
run_now_event = threading.Event()


# ---------------------------------------------------------------------------
# Signal handler (SIGUSR1 sent by the menu bar "Run Now" button)
# ---------------------------------------------------------------------------

def _handle_sigusr1(signum, frame) -> None:
    logger.info("SIGUSR1 received — triggering immediate scan.")
    run_now_event.set()

signal.signal(signal.SIGUSR1, _handle_sigusr1)


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
        STATUS_PATH.write_text(
            json.dumps(
                {
                    "last_scan_time": datetime.now().isoformat(timespec="seconds"),
                    "jobs_tracked": jobs_tracked,
                },
                indent=2,
            )
        )
    except Exception as exc:
        logger.warning(f"Could not write status.json: {exc}")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Read config.json from disk (called fresh on every loop iteration)."""
    with open(CONFIG_PATH) as f:
        return json.load(f)


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

    keywords = config.get("keywords", [])
    location = config.get("location", "Philippines")
    max_results = config.get("max_results_per_keyword", 10)

    new_jobs: list[dict] = []
    seen_ids: set[str] = set()  # deduplicate within a single run

    for keyword in keywords:
        for scraper in (indeed, jobstreet, onlinejobs, linkedin):

            try:
                jobs = scraper.scrape(keyword, location, max_results)
                for job in jobs:
                    job_id = db_module.make_job_id(job["title"], job["company"], job["url"])
                    job["job_id"] = job_id
                    if job_id not in seen_ids and db_module.is_new(db_conn, job_id):
                        seen_ids.add(job_id)
                        new_jobs.append(job)
                        if not dry_run:
                            db_module.mark_seen(db_conn, job)
            except Exception as exc:
                logger.error(f"Scraper error ({scraper.__name__}, '{keyword}'): {exc}")

    return new_jobs


def scraper_loop(dry_run: bool = False) -> None:
    """
    Main scraper loop.  In normal mode this runs forever; in --dry-run mode
    it executes exactly once and returns.
    """
    import db as db_module
    from notifier import send_job_alerts, send_imessage

    db_conn = db_module.get_connection()

    while True:
        config = load_config()
        recipient = config.get("recipient", "")

        # Check for flag file written by menu bar "Run Now" button
        if RUN_NOW_FLAG.exists():
            RUN_NOW_FLAG.unlink(missing_ok=True)
            run_now_event.set()

        if config.get("paused", False):
            logger.info("Scraper is paused. Sleeping 60 s...")
            if dry_run:
                return
            run_now_event.wait(timeout=60)
            run_now_event.clear()
            continue

        logger.info("=== Job scan starting ===")
        new_jobs = _run_scrape(config, db_conn, dry_run=dry_run)
        logger.info(f"=== Scan complete — {len(new_jobs)} new job(s) found ===")

        # Update status.json for the menu bar
        if not dry_run:
            _write_status(db_module.total_seen(db_conn))

        if dry_run:
            if new_jobs:
                print(f"\n[DRY RUN] {len(new_jobs)} new job(s) would be sent:\n")
                for job in new_jobs[:10]:
                    print(f"  • {job['title']} @ {job['company']} ({job['source']})")
                    print(f"    {job['url']}\n")
            else:
                print("\n[DRY RUN] No new jobs found (or all already seen).")
            return  # Exit after one pass in dry-run mode

        if new_jobs and recipient:
            alerted_ids = send_job_alerts(recipient, new_jobs)
            if alerted_ids:
                db_module.mark_jobs_alerted(db_conn, alerted_ids)
                logger.info(f"Marked {len(alerted_ids)} jobs as alerted in seen_jobs database.")
        elif not recipient:
            logger.warning("No recipient set in config.json — job alerts cannot be sent.")

        interval_minutes = config.get("check_interval_minutes", 60)
        logger.info(f"Next scan in {interval_minutes} minute(s).")


        # Sleep for the interval, but wake early if /run command or SIGUSR1 fires
        run_now_event.wait(timeout=interval_minutes * 60)
        run_now_event.clear()


# ---------------------------------------------------------------------------
# Listener thread
# ---------------------------------------------------------------------------

def listener_loop() -> None:
    """
    Polls chat.db every 10 s for incoming messages from any of the configured recipients.
    Passes any recognised commands to commander.execute().
    Also checks for run_now.flag written by the menu bar app.
    """
    from listener import get_messages_since
    import commander
    from notifier import send_imessage, parse_recipients

    logger.info("Command listener started (polling chat.db every 10 s for incoming bot commands)")

    # Start from "now" so we don't re-process old messages on startup
    last_check = time.time()

    while True:
        time.sleep(10)
        try:
            config = load_config()
            recipients = parse_recipients(config.get("recipient", ""))
            if not recipients:
                continue

            # Check for menu bar "Run Now" flag file
            if RUN_NOW_FLAG.exists():
                RUN_NOW_FLAG.unlink(missing_ok=True)
                logger.info("run_now.flag detected — triggering immediate scan.")
                run_now_event.set()

            for target in recipients:
                messages = get_messages_since(target, last_check)
                for msg in messages:
                    text = msg["text"]
                    logger.info(f"Incoming message from {target}: {text!r}")

                    def make_send_fn(dest: str):
                        return lambda reply: send_imessage(dest, reply)

                    handled = commander.execute(text, make_send_fn(target), run_now_event)
                    if handled:
                        logger.info(f"Command handled for {target}: {text!r}")

            last_check = time.time()
        except Exception as exc:
            logger.error(f"Listener loop error: {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        logger.info("=== Tracky — DRY RUN ===")
        scraper_loop(dry_run=True)
        return

    config = load_config()
    recipient = config.get("recipient", "")

    logger.info("=== Tracky starting ===")

    # Initialize app daemon in PAUSED state on startup
    try:
        if CONFIG_PATH.exists():
            cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            cfg["paused"] = True
            CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            logger.info("⏸ App daemon initialized in PAUSED state by default.")
    except Exception as exc:
        logger.warning(f"Could not set initial paused state: {exc}")


    if not recipient:
        logger.warning(
            "No recipient configured yet in config.json. "
            "Tracky will remain paused until recipient is configured via Dashboard (http://127.0.0.1:5050) or Menu Bar."
        )

    # Write PID file so the menu bar app can send SIGUSR1
    _write_pid()

    try:
        # Start GUI dashboard server on http://127.0.0.1:5050
        try:
            from dashboard_server import start_dashboard_server
            start_dashboard_server(port=5050, background=True)
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
    except KeyboardInterrupt:
        logger.info("Tracky stopped by user.")
    finally:
        _delete_pid()
        logger.info("Tracky exited.")



if __name__ == "__main__":
    main()
