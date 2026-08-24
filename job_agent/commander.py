"""
Parse and execute iMessage bot commands.
All command handlers edit config.json and reply via the provided send_fn callable.
"""
import json
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"

HELP_TEXT = (
    "🐶 Tracky Commands\n\n"
    "/status — current settings\n"
    "/keywords — list active keywords\n"
    "/add <keyword> — add a search keyword\n"
    "/remove <keyword> — remove a keyword\n"
    "/interval <minutes> — set check frequency\n"
    "/location <place> — set location filter\n"
    "/run — trigger an immediate scan\n"
    "/pause — pause the scraper\n"
    "/resume — resume the scraper\n"
    "/help — show this message"
)


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _load() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _save(config: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


# ---------------------------------------------------------------------------
# Command parser
# ---------------------------------------------------------------------------

def parse(text: str) -> tuple[str | None, str]:
    """
    Split a raw message into (command, argument).
    Returns (None, '') if the message is not a command.
    """
    text = text.strip()
    if not text.startswith("/"):
        return None, ""
    parts = text.split(maxsplit=1)
    cmd = parts[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""
    return cmd, arg


# ---------------------------------------------------------------------------
# Command executor
# ---------------------------------------------------------------------------

def execute(text: str, send_fn, run_now_event: threading.Event | None = None) -> bool:
    """
    Parse `text` as a command and execute it.

    Args:
        text:          Raw message string from the user.
        send_fn:       Callable(message: str) that sends an iMessage reply.
        run_now_event: Optional threading.Event to signal an immediate scrape.

    Returns:
        True  if the text was a recognised command (even if it had bad args).
        False if the text was not a command at all (no leading '/').
    """
    cmd, arg = parse(text)
    if cmd is None:
        return False

    config = _load()

    # ── /help ────────────────────────────────────────────────────────────────
    if cmd == "/help":
        send_fn(HELP_TEXT)

    # ── /status ──────────────────────────────────────────────────────────────
    elif cmd == "/status":
        keywords = config.get("keywords", [])
        kw_list = "\n".join(f"  \u2022 {k}" for k in keywords) or "  (none)"
        state = "\U0001f534 Paused" if config.get("paused") else "\U0001f7e2 Active"
        interval = config.get("check_interval_minutes", 60)
        location = config.get("location", "Philippines")
        total = _db_total()
        send_fn(
            f"📊 Tracky Status\n\n"
            f"{state}\n"
            f"⏱ Interval: every {interval} min\n"
            f"📍 Location: {location}\n"
            f"🔍 Keywords ({len(keywords)}):\n{kw_list}\n"
            f"📦 Jobs tracked: {total}"
        )

    # ── /keywords ─────────────────────────────────────────────────────────────
    elif cmd == "/keywords":
        keywords = config.get("keywords", [])
        if keywords:
            kw_list = "\n".join(f"  {i + 1}. {k}" for i, k in enumerate(keywords))
            send_fn(f"\U0001f50d Active keywords ({len(keywords)}):\n{kw_list}")
        else:
            send_fn("\u26a0\ufe0f No keywords set. Use /add <keyword> to add one.")

    # ── /add ──────────────────────────────────────────────────────────────────
    elif cmd == "/add":
        if not arg:
            send_fn("\u274c Usage: /add <keyword>\nExample: /add python developer")
        else:
            existing = [k.lower() for k in config.get("keywords", [])]
            if arg.lower() in existing:
                send_fn(f"\u2139\ufe0f \u201c{arg}\u201d is already in your keyword list.")
            else:
                config.setdefault("keywords", []).append(arg)
                _save(config)
                send_fn(f"\u2705 Added \u201c{arg}\u201d to your keyword list.")

    # ── /remove ───────────────────────────────────────────────────────────────
    elif cmd == "/remove":
        if not arg:
            send_fn("\u274c Usage: /remove <keyword>\nExample: /remove react developer")
        else:
            original = config.get("keywords", [])
            updated = [k for k in original if k.lower() != arg.lower()]
            if len(updated) == len(original):
                send_fn(f"\u274c \u201c{arg}\u201d not found. Use /keywords to see your list.")
            else:
                config["keywords"] = updated
                _save(config)
                send_fn(f"\u2705 Removed \u201c{arg}\u201d from your keyword list.")

    # ── /interval ─────────────────────────────────────────────────────────────
    elif cmd == "/interval":
        try:
            minutes = int(arg)
            if minutes < 5:
                send_fn("\u274c Minimum interval is 5 minutes.")
            else:
                config["check_interval_minutes"] = minutes
                _save(config)
                send_fn(
                    f"\u2705 Check interval set to every {minutes} minute{'s' if minutes != 1 else ''}.\n"
                    f"\u26a0\ufe0f The new interval takes effect after the current sleep cycle ends."
                )
        except (ValueError, TypeError):
            send_fn("\u274c Usage: /interval <minutes>\nExample: /interval 30")

    # ── /location ─────────────────────────────────────────────────────────────
    elif cmd == "/location":
        if not arg:
            send_fn("\u274c Usage: /location <place>\nExample: /location Remote")
        else:
            config["location"] = arg
            _save(config)
            send_fn(f"\u2705 Location set to \u201c{arg}\u201d.")

    # ── /pause ────────────────────────────────────────────────────────────────
    elif cmd == "/pause":
        config["paused"] = True
        _save(config)
        send_fn("\u23f8 Scraper paused. Text /resume to restart job scanning.")

    # ── /resume ───────────────────────────────────────────────────────────────
    elif cmd == "/resume":
        config["paused"] = False
        _save(config)
        send_fn("\u25b6\ufe0f Scraper resumed! Next scan coming up.")

    # ── /run ──────────────────────────────────────────────────────────────────
    elif cmd == "/run":
        send_fn("\U0001f504 Triggering job scan now\u2026 I\u2019ll message you with any new listings.")
        if run_now_event is not None:
            run_now_event.set()
        else:
            logger.warning("/run command received but no run_now_event provided.")

    # ── Unknown ───────────────────────────────────────────────────────────────
    else:
        send_fn(f"\u2753 Unknown command: {cmd}\nText /help to see all available commands.")

    return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _db_total() -> int:
    """Return total jobs tracked, gracefully returning 0 on any error."""
    try:
        import db
        conn = db.get_connection()
        total = db.total_seen(conn)
        conn.close()
        return total
    except Exception:
        return 0
