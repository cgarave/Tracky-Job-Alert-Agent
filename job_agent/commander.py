"""
Parse and execute iMessage bot commands.
Supports job scraping, settings management, and 1-click job applications.
"""
import json
import logging
import threading
from pathlib import Path

import db
import profile_manager

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"

HELP_TEXT = (
    "🐶 Tracky Commands\n\n"
    "📋 Job Search:\n"
    "/status — current settings & stats\n"
    "/keywords — list active keywords\n"
    "/add <kw> — add search keyword\n"
    "/remove <kw> — remove a keyword\n"
    "/interval <min> — set check frequency\n"
    "/location <place> — set location filter\n"
    "/run — trigger immediate scan\n"
    "/pause | /resume — pause/resume scraper\n\n"
    "🚀 Application Engine:\n"
    "/apply <job_id> — apply to a job with your resume\n"
    "/autoapply on|off — toggle auto-pilot apply\n"
    "/dailycap <n> — set max auto applications/day\n"
    "/applications — list recent applications\n"
    "/dashboard — link to web control center\n\n"
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
        send_fn("🖥️ Tracky Dashboard is available at:\nhttp://127.0.0.1:5050\n\nOpen in your Mac browser to view jobs, upload your resume, and configure auto-apply.")

    # ── /status ──────────────────────────────────────────────────────────────
    elif cmd == "/status":
        keywords = config.get("keywords", [])
        kw_list = "\n".join(f"  • {k}" for k in keywords) or "  (none)"
        state = "🔴 Paused" if config.get("paused") else "🟢 Active"
        interval = config.get("check_interval_minutes", 60)
        location = config.get("location", "Philippines")
        
        conn = db.get_connection()
        stats = db.get_application_stats(conn)
        conn.close()

        prof = profile_manager.get_profile()
        auto_state = "🟢 Enabled" if prof.get("auto_apply", {}).get("enabled") else "⚪ Disabled"
        resume_name = prof.get("resume", {}).get("filename") or "None uploaded"

        send_fn(
            f"📊 Tracky Status\n\n"
            f"{state} · Auto-Apply: {auto_state}\n"
            f"⏱ Interval: every {interval} min\n"
            f"📍 Location: {location}\n"
            f"📄 Resume: {resume_name}\n"
            f"🔍 Keywords ({len(keywords)}):\n{kw_list}\n\n"
            f"📦 Jobs tracked: {stats['total_jobs']}\n"
            f"🚀 Total Applied: {stats['total_applied']} (Today: {stats['today_applied']})"
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

    # ── /apply <job_id> ───────────────────────────────────────────────────────
    elif cmd == "/apply":
        if not arg:
            send_fn("❌ Usage: /apply <job_id>\nExample: /apply a1b2c3d4")
        else:
            from applier.engine import apply_to_job
            send_fn(f"⏳ Submitting application for Job ID {arg} using your authentic PDF resume...")

            def _async_apply():
                try:
                    res = apply_to_job(job_id=arg, mode="manual")
                    if res.get("success"):
                        send_fn(f"✅ Application submitted successfully for Job {arg}!\n{res.get('message', '')}")
                    else:
                        send_fn(f"⚠️ Application outcome for Job {arg}:\n{res.get('message', '')}")
                except Exception as e:
                    send_fn(f"❌ Error applying: {str(e)}")

            threading.Thread(target=_async_apply, daemon=True).start()

    # ── /autoapply <on|off> ───────────────────────────────────────────────────
    elif cmd == "/autoapply":
        prof = profile_manager.get_profile()
        val = arg.lower()
        if val in ("on", "true", "1", "enable"):
            prof.setdefault("auto_apply", {})["enabled"] = True
            profile_manager.save_profile(prof)
            send_fn("🤖 Auto-apply ENABLED! High-matching jobs will be applied to automatically.")
        elif val in ("off", "false", "0", "disable"):
            prof.setdefault("auto_apply", {})["enabled"] = False
            profile_manager.save_profile(prof)
            send_fn("⚪ Auto-apply DISABLED.")
        else:
            send_fn("❌ Usage: /autoapply on OR /autoapply off")

    # ── /dailycap <n> ─────────────────────────────────────────────────────────
    elif cmd == "/dailycap":
        try:
            cap = int(arg)
            if cap < 1 or cap > 50:
                send_fn("❌ Daily cap must be between 1 and 50.")
            else:
                prof = profile_manager.get_profile()
                prof.setdefault("auto_apply", {})["daily_cap"] = cap
                profile_manager.save_profile(prof)
                send_fn(f"✅ Auto-apply daily cap set to {cap} application(s) per day.")
        except (ValueError, TypeError):
            send_fn("❌ Usage: /dailycap <number>\nExample: /dailycap 5")

    # ── /applications ─────────────────────────────────────────────────────────
    elif cmd == "/applications":
        conn = db.get_connection()
        apps = db.get_applications(conn, limit=5)
        conn.close()
        if not apps:
            send_fn("📊 No applications recorded yet.")
        else:
            lines = ["📊 Recent Applications:"]
            for a in apps:
                status_emoji = "✅" if a["status"] == "submitted" else "⚠️"
                lines.append(f"{status_emoji} {a.get('title', 'Role')} @ {a.get('company', 'Company')} ({a.get('source', '')})\n  Status: {a['status']} ({a.get('applied_at', '')})")
            send_fn("\n\n".join(lines))

    # ── Unknown ───────────────────────────────────────────────────────────────
    else:
        send_fn(f"❓ Unknown command: {cmd}\nText /help to see all available commands.")

    return True
