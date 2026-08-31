"""
Parse and execute iMessage bot commands.
Supports job scraping, settings management, and live status reports.
"""
import json
import logging
import threading
from pathlib import Path

import db

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"

HELP_TEXT = (
    "🐶 Tracky Commands\n\n"
    "📋 Job Alerts:\n"
    "/status — current settings & stats\n"
    "/keywords — list active keywords\n"
    "/add <kw> — add search keyword\n"
    "/remove <kw> — remove a keyword\n"
    "/interval <min> — set check frequency\n"
    "/location <place> — set location filter\n"
    "/run — trigger immediate scan\n"
    "/pause | /resume — pause/resume scraper\n\n"
    "🖥️ Dashboard:\n"
    "/dashboard — link to web dashboard\n\n"
    "/help — show this message"
)


def _load() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _save(config: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def parse(text: str) -> tuple[str | None, str]:
    """Split a raw message into (command, argument)."""
    text = text.strip()
    if not text.startswith("/"):
        return None, ""
    parts = text.split(maxsplit=1)
    cmd = parts[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""
    return cmd, arg


def execute(text: str, send_fn, run_now_event: threading.Event | None = None) -> bool:
    """Parse `text` as a command and execute it."""
    cmd, arg = parse(text)
    if cmd is None:
        return False

    config = _load()

    # ── /help ────────────────────────────────────────────────────────────────
    if cmd == "/help":
        send_fn(HELP_TEXT)

    # ── /dashboard | /gui ───────────────────────────────────────────────────
    elif cmd in ("/dashboard", "/gui"):
        send_fn("🖥️ Tracky Dashboard is available at:\nhttp://127.0.0.1:5050\n\nOpen in your Mac browser to view discovered jobs and configure alert settings.")

    # ── /status ──────────────────────────────────────────────────────────────
    elif cmd == "/status":
        keywords = config.get("keywords", [])
        kw_list = "\n".join(f"  • {k}" for k in keywords) or "  (none)"
        state = "🔴 Paused" if config.get("paused") else "🟢 Active"
        interval = config.get("check_interval_minutes", 60)
        location = config.get("location", "Philippines")

        conn = db.get_connection()
        stats = db.get_stats(conn)
        conn.close()

        send_fn(
            f"📊 Tracky Status\n\n"
            f"Status: {state}\n"
            f"⏱ Interval: every {interval} min\n"
            f"📍 Location: {location}\n"
            f"🔍 Keywords ({len(keywords)}):\n{kw_list}\n\n"
            f"📦 Total Jobs Tracked: {stats['total_jobs']}\n"
            f"✨ Discovered Today: {stats['today_new_jobs']}"
        )

    # ── /keywords ─────────────────────────────────────────────────────────────
    elif cmd == "/keywords":
        keywords = config.get("keywords", [])
        if keywords:
            kw_list = "\n".join(f"  {i + 1}. {k}" for i, k in enumerate(keywords))
            send_fn(f"🔍 Active keywords ({len(keywords)}):\n{kw_list}")
        else:
            send_fn("⚠️ No keywords set. Use /add <keyword> to add one.")

    # ── /add ──────────────────────────────────────────────────────────────────
    elif cmd == "/add":
        if not arg:
            send_fn("❌ Usage: /add <keyword>\nExample: /add python developer")
        else:
            existing = [k.lower() for k in config.get("keywords", [])]
            if arg.lower() in existing:
                send_fn(f"ℹ️ “{arg}” is already in your keyword list.")
            else:
                config.setdefault("keywords", []).append(arg)
                _save(config)
                send_fn(f"✅ Added “{arg}” to your keyword list.")

    # ── /remove ───────────────────────────────────────────────────────────────
    elif cmd == "/remove":
        if not arg:
            send_fn("❌ Usage: /remove <keyword>\nExample: /remove react developer")
        else:
            original = config.get("keywords", [])
            updated = [k for k in original if k.lower() != arg.lower()]
            if len(updated) == len(original):
                send_fn(f"❌ “{arg}” not found. Use /keywords to see your list.")
            else:
                config["keywords"] = updated
                _save(config)
                send_fn(f"✅ Removed “{arg}” from your keyword list.")

    # ── /interval ─────────────────────────────────────────────────────────────
    elif cmd == "/interval":
        try:
            minutes = int(arg)
            if minutes < 5:
                send_fn("❌ Minimum interval is 5 minutes.")
            else:
                config["check_interval_minutes"] = minutes
                _save(config)
                send_fn(f"✅ Check interval set to every {minutes} minute{'s' if minutes != 1 else ''}.")
        except (ValueError, TypeError):
            send_fn("❌ Usage: /interval <minutes>\nExample: /interval 30")

    # ── /location ─────────────────────────────────────────────────────────────
    elif cmd == "/location":
        if not arg:
            send_fn("❌ Usage: /location <place>\nExample: /location Remote")
        else:
            config["location"] = arg
            _save(config)
            send_fn(f"✅ Location set to “{arg}”.")

    # ── /pause ────────────────────────────────────────────────────────────────
    elif cmd == "/pause":
        config["paused"] = True
        _save(config)
        send_fn("⏸ Scraper paused. Text /resume to restart job scanning.")

    # ── /resume ───────────────────────────────────────────────────────────────
    elif cmd == "/resume":
        config["paused"] = False
        _save(config)
        send_fn("▶️ Scraper resumed! Next scan coming up.")

    # ── /run ──────────────────────────────────────────────────────────────────
    elif cmd == "/run":
        send_fn("🔄 Triggering job scan now… I’ll message you with any new listings.")
        if run_now_event is not None:
            run_now_event.set()

    # ── Unknown ───────────────────────────────────────────────────────────────
    else:
        send_fn(f"❓ Unknown command: {cmd}\nText /help to see all available commands.")

    return True
