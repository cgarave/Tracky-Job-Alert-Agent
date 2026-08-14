"""
Job Agent — main daemon entry point.

Runs two concurrent threads:
  • Scraper thread  — sleeps for the configured interval, scrapes all job boards,
                      sends iMessage alerts for any new listings found.
  • Listener thread — polls ~/Library/Messages/chat.db every 10 s for incoming
                      commands from the user and dispatches them to commander.py.

Usage:
    python3 main.py            # Normal daemon mode
    python3 main.py --dry-run  # One-shot scrape, prints results, no messages sent
"""
import json
import logging
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
CONFIG_PATH = BASE_DIR / "config.json"

# ---------------------------------------------------------------------------
# Shared event — set by the /run command to trigger an immediate scrape
# ---------------------------------------------------------------------------
run_now_event = threading.Event()


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
    from scrapers import indeed, jobstreet, onlinejobs
    import db as db_module

    keywords = config.get("keywords", [])
    location = config.get("location", "Philippines")
    max_results = config.get("max_results_per_keyword", 10)

    new_jobs: list[dict] = []
    seen_ids: set[str] = set()  # deduplicate within a single run

    for keyword in keywords:
        for scraper in (indeed, jobstreet, onlinejobs):
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
            send_job_alerts(recipient, new_jobs)
        elif not recipient:
            logger.warning("No recipient set in config.json — job alerts cannot be sent.")

        interval_minutes = config.get("check_interval_minutes", 60)
        logger.info(f"Next scan in {interval_minutes} minute(s).")

        # Sleep for the interval, but wake early if /run command fires
        run_now_event.wait(timeout=interval_minutes * 60)
        run_now_event.clear()


# ---------------------------------------------------------------------------
# Listener thread
# ---------------------------------------------------------------------------

def listener_loop() -> None:
    """
    Polls chat.db every 10 s for incoming messages from the configured recipient.
    Passes any recognised commands to commander.execute().
    """
    from listener import get_messages_since
    import commander
    from notifier import send_imessage

    config = load_config()
    recipient = config.get("recipient", "")

    if not recipient:
        logger.error("No recipient in config.json — listener loop cannot start.")
        return

    logger.info(f"Command listener started (polling every 10 s for messages from {recipient})")

    # Start from "now" so we don't re-process old messages on startup
    last_check = time.time()

    while True:
        time.sleep(10)
        try:
            messages = get_messages_since(recipient, last_check)
            last_check = time.time()

            for msg in messages:
                text = msg["text"]
                logger.info(f"Incoming message: {text!r}")

                def send_fn(reply: str, _recipient: str = recipient) -> None:
                    send_imessage(_recipient, reply)

                handled = commander.execute(text, send_fn, run_now_event)
                if handled:
                    logger.info(f"Command handled: {text!r}")

        except Exception as exc:
            logger.error(f"Listener loop error: {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        logger.info("=== Job Agent — DRY RUN ===")
        scraper_loop(dry_run=True)
        return

    config = load_config()
    recipient = config.get("recipient", "")

    logger.info("=== Job Agent starting ===")

    if not recipient:
        logger.error(
            "No recipient configured in config.json. "
            "Run install.sh again or manually set 'recipient' in job_agent/config.json."
        )
        sys.exit(1)

    # Start listener in a background daemon thread
    listener_thread = threading.Thread(
        target=listener_loop,
        name="listener",
        daemon=True,  # Dies automatically when main thread exits
    )
    listener_thread.start()

    # Run the scraper in the main thread (keeps the process alive)
    try:
        scraper_loop(dry_run=False)
    except KeyboardInterrupt:
        logger.info("Job Agent stopped by user.")


if __name__ == "__main__":
    main()
