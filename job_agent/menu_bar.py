"""
Tracky — macOS Menu Bar App

Lives as a 🐶 icon in the menu bar. Provides a GUI for:
  • Viewing live status (active/paused/stopped, jobs tracked, next scan time)
  • Running an immediate scan
  • Pausing / resuming / starting the scraper daemon
  • Adding and removing job keywords
  • Changing interval, location, and iMessage recipient
  • Viewing logs
  • Quitting the menu bar app or stopping everything cleanly

Communicates with the background daemon (main.py) via shared files in the
same job_agent/ directory:
  config.json    — settings read and written by both processes
  status.json    — written by daemon after each scan; read here for display
  daemon.pid     — daemon's PID; used to send SIGUSR1 for instant wake-up
  run_now.flag   — created here as a fallback if SIGUSR1 fails
"""
import json
import logging
import os
import signal
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import rumps

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR      = Path(__file__).parent
CONFIG_PATH   = BASE_DIR / "config.json"
STATUS_PATH   = BASE_DIR / "status.json"
PID_PATH      = BASE_DIR / "daemon.pid"
RUN_NOW_FLAG  = BASE_DIR / "run_now.flag"
LOG_PATH      = Path.home() / "Library" / "Logs" / "jobagent.log"
PLIST_DAEMON  = Path.home() / "Library" / "LaunchAgents" / "com.jobagent.plist"

logging.basicConfig(level=logging.WARNING)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_config() -> dict:
    try:
        with open(CONFIG_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def _save_config(config: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def _load_status() -> dict:
    try:
        with open(STATUS_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def _daemon_pid() -> int | None:
    try:
        return int(PID_PATH.read_text().strip())
    except Exception:
        return None


def _is_daemon_running() -> bool:
    pid = _daemon_pid()
    if pid is not None:
        try:
            os.kill(pid, 0)
            return True
        except (ProcessLookupError, PermissionError):
            return False
    return False


def _trigger_run_now() -> None:
    """Signal the daemon to run an immediate scan."""
    pid = _daemon_pid()
    if pid:
        try:
            os.kill(pid, signal.SIGUSR1)
            return
        except (ProcessLookupError, PermissionError):
            pass
    # Fallback: flag file picked up within 10 s
    RUN_NOW_FLAG.touch()


def _build_kw_items(kw_menu: rumps.MenuItem, keywords: list[str],
                    add_cb, remove_cb) -> None:
    """Populate `kw_menu` with keyword labels + Add/Remove actions.

    Isolated so the same logic can be used during __init__ (no .clear())
    and during _rebuild_keywords() (after .clear()).
    """
    for kw in keywords:
        item = rumps.MenuItem(f"   {kw}")
        item.set_callback(None)
        kw_menu.add(item)
    if keywords:
        kw_menu.add(rumps.separator)
    kw_menu.add(rumps.MenuItem("   ＋  Add Keyword…",    callback=add_cb))
    kw_menu.add(rumps.MenuItem("   ✕  Remove Keyword…", callback=remove_cb))


# ---------------------------------------------------------------------------
# Menu Bar App
# ---------------------------------------------------------------------------

import webbrowser

class TrackyApp(rumps.App):

    def __init__(self):
        super().__init__("🐶", quit_button=None)

        config   = _load_config()
        keywords = config.get("keywords", [])
        interval = config.get("check_interval_minutes", 60)
        location = config.get("location", "Philippines")

        # ── Status rows (non-clickable) ──────────────────────────────────────
        self._status_item    = rumps.MenuItem("Loading…")
        self._next_scan_item = rumps.MenuItem("")
        self._status_item.set_callback(None)
        self._next_scan_item.set_callback(None)

        # ── Dashboard ────────────────────────────────────────────────────────
        self._dashboard_item = rumps.MenuItem("🖥️  Open Dashboard…", callback=self._on_open_dashboard)

        # ── Action items ─────────────────────────────────────────────────────
        self._run_item   = rumps.MenuItem("▶  Run Now", callback=self._on_run_now)
        self._pause_item = rumps.MenuItem("⏸  Pause Scraper", callback=self._on_toggle_pause)

        # ── Keywords submenu — built inline (no .clear() safe at this stage) ─
        self._kw_menu = rumps.MenuItem(f"🔍  Keywords ({len(keywords)})")
        _build_kw_items(self._kw_menu, keywords,
                        self._on_add_keyword, self._on_remove_keyword)

        # ── Settings submenu ─────────────────────────────────────────────────
        self._interval_item  = rumps.MenuItem(
            f"⏱  Interval: {interval} min…", callback=self._on_set_interval
        )
        self._location_item  = rumps.MenuItem(
            f"📍  Location: {location}…", callback=self._on_set_location
        )
        self._recipient_item = rumps.MenuItem(
            "📱  Set Recipient…", callback=self._on_set_recipient
        )

        settings = rumps.MenuItem("⚙  Settings")
        settings.add(self._interval_item)
        settings.add(self._location_item)
        settings.add(rumps.separator)
        settings.add(self._recipient_item)

        # ── Top-level menu ───────────────────────────────────────────────────
        self.menu = [
            self._status_item,
            self._next_scan_item,
            rumps.separator,
            self._dashboard_item,
            rumps.separator,
            self._run_item,
            self._pause_item,
            rumps.separator,
            self._kw_menu,
            rumps.separator,
            settings,
            rumps.separator,
            rumps.MenuItem("📄  View Logs", callback=self._on_view_logs),
            rumps.separator,
            rumps.MenuItem("Quit Menu Bar", callback=self._on_quit_menubar),
            rumps.MenuItem("🛑  Stop Agent & Quit All…", callback=self._on_stop_all),
        ]


        # First status refresh (only updates titles, safe before run loop)
        self._refresh_status()

        # Auto-refresh every 30 seconds
        self._timer = rumps.Timer(self._on_timer, 30)
        self._timer.start()

    # ------------------------------------------------------------------
    # Timer
    # ------------------------------------------------------------------

    def _on_timer(self, _):
        self._refresh_status()

    # ------------------------------------------------------------------
    # Status refresh (only mutates existing item titles — always safe)
    # ------------------------------------------------------------------

    def _refresh_status(self):
        config         = _load_config()
        status         = _load_status()
        daemon_running = _is_daemon_running()
        paused         = config.get("paused", False)

        interval = config.get("check_interval_minutes", 60)
        location = config.get("location", "Philippines")
        self._interval_item.title = f"⏱  Interval: {interval} min…"
        self._location_item.title = f"📍  Location: {location}…"

        jobs = status.get("jobs_tracked", 0)

        if not daemon_running:
            self.title = "🔴🐶"
            self._status_item.title = "🔴 Daemon Stopped"
            self._next_scan_item.title = "Background scraper is not running"
            self._pause_item.title = "▶  Start Agent"
            return

        if paused:
            self.title = "⏸🐶"
            self._status_item.title = f"⏸ Paused  ·  {jobs} jobs tracked"
            self._next_scan_item.title = "Scraper paused"
            self._pause_item.title = "▶  Resume Scraper"
        else:
            self.title = "🐶"
            self._status_item.title = f"🟢 Active  ·  {jobs} jobs tracked"
            self._pause_item.title = "⏸  Pause Scraper"

            last = status.get("last_scan_time")
            if last:
                try:
                    last_dt = datetime.fromisoformat(last)
                    next_dt = last_dt + timedelta(minutes=interval)
                    secs    = (next_dt - datetime.now()).total_seconds()
                    mins    = max(0, int(secs / 60))
                    self._next_scan_item.title = (
                        f"Next scan in {mins} min" if mins > 0 else "Scanning soon…"
                    )
                except Exception:
                    self._next_scan_item.title = f"Every {interval} min"
            else:
                self._next_scan_item.title = f"Every {interval} min"

    # ------------------------------------------------------------------
    # Keywords submenu rebuild
    # Called only after user actions (add/remove) — safe post-init.
    # ------------------------------------------------------------------

    def _rebuild_keywords(self):
        config   = _load_config()
        keywords = config.get("keywords", [])

        self._kw_menu.title = f"🔍  Keywords ({len(keywords)})"

        try:
            self._kw_menu.clear()
        except Exception:
            pass  # Defensive: should not happen post-init

        _build_kw_items(self._kw_menu, keywords,
                        self._on_add_keyword, self._on_remove_keyword)

    # ------------------------------------------------------------------
    # Callbacks
    # ------------------------------------------------------------------

    def _on_open_dashboard(self, _):
        """Open Tracky Web GUI Control Center in browser or app mode."""
        url = "http://127.0.0.1:5050"
        webbrowser.open(url)


    def _on_run_now(self, _):
        if not _is_daemon_running():
            rumps.alert("The background agent is stopped. Start it first before running a scan.")
            return

        _trigger_run_now()
        rumps.notification(
            title="Tracky",
            subtitle="",
            message="Scan triggered — new jobs will arrive as iMessages.",
            sound=False,
        )

    def _on_toggle_pause(self, _):
        if not _is_daemon_running():
            # Start daemon via launchctl
            if PLIST_DAEMON.exists():
                subprocess.run(["launchctl", "load", str(PLIST_DAEMON)], check=False)
                rumps.notification("Tracky", "", "Starting background daemon…", sound=False)
            self._refresh_status()
            return

        config = _load_config()
        config["paused"] = not config.get("paused", False)
        _save_config(config)
        self._refresh_status()

    def _on_add_keyword(self, _):
        w = rumps.Window(
            message="Enter a job keyword to track:",
            title="Add Keyword",
            default_text="",
            ok="Add",
            cancel="Cancel",
            dimensions=(300, 24),
        )
        r = w.run()
        if not r.clicked or not r.text.strip():
            return

        kw     = r.text.strip()
        config = _load_config()
        kws    = config.setdefault("keywords", [])

        if kw.lower() in [k.lower() for k in kws]:
            rumps.alert(f'"{kw}" is already in your keyword list.')
            return

        kws.append(kw)
        _save_config(config)
        self._rebuild_keywords()
        rumps.notification("Tracky", "", f'Added: "{kw}"', sound=False)

    def _on_remove_keyword(self, _):
        config   = _load_config()
        keywords = config.get("keywords", [])

        if not keywords:
            rumps.alert("No keywords to remove.")
            return

        listed = "\n".join(f"  {i + 1}. {k}" for i, k in enumerate(keywords))
        w = rumps.Window(
            message=f"Current keywords:\n{listed}\n\nType the keyword to remove:",
            title="Remove Keyword",
            default_text="",
            ok="Remove",
            cancel="Cancel",
            dimensions=(300, 24),
        )
        r = w.run()
        if not r.clicked or not r.text.strip():
            return

        term    = r.text.strip()
        updated = [k for k in keywords if k.lower() != term.lower()]

        if len(updated) == len(keywords):
            rumps.alert(f'"{term}" not found in your keyword list.')
            return

        config["keywords"] = updated
        _save_config(config)
        self._rebuild_keywords()
        rumps.notification("Tracky", "", f'Removed: "{term}"', sound=False)

    def _on_set_interval(self, _):
        config  = _load_config()
        current = str(config.get("check_interval_minutes", 60))
        w = rumps.Window(
            message="Check for new jobs every how many minutes?\n(Minimum: 5)",
            title="Set Check Interval",
            default_text=current,
            ok="Save",
            cancel="Cancel",
            dimensions=(200, 24),
        )
        r = w.run()
        if not r.clicked or not r.text.strip():
            return
        try:
            mins = int(r.text.strip())
        except ValueError:
            rumps.alert("Please enter a whole number.")
            return
        if mins < 5:
            rumps.alert("Minimum interval is 5 minutes.")
            return
        config["check_interval_minutes"] = mins
        _save_config(config)
        self._refresh_status()
        rumps.notification("Tracky", "", f"Interval: every {mins} min.", sound=False)

    def _on_set_location(self, _):
        config  = _load_config()
        current = config.get("location", "Philippines")
        w = rumps.Window(
            message="Enter location filter (e.g. Philippines, Remote):",
            title="Set Location",
            default_text=current,
            ok="Save",
            cancel="Cancel",
            dimensions=(280, 24),
        )
        r = w.run()
        if not r.clicked or not r.text.strip():
            return
        config["location"] = r.text.strip()
        _save_config(config)
        self._refresh_status()

    def _on_set_recipient(self, _):
        config  = _load_config()
        current = config.get("recipient", "")
        w = rumps.Window(
            message="Enter your phone number or Apple ID:\n(e.g. +639171234567 or you@icloud.com)",
            title="iMessage Recipient",
            default_text=current,
            ok="Save",
            cancel="Cancel",
            dimensions=(300, 24),
        )
        r = w.run()
        if not r.clicked or not r.text.strip():
            return
        config["recipient"] = r.text.strip()
        _save_config(config)
        rumps.notification("Tracky", "", "Recipient updated.", sound=False)

    def _on_view_logs(self, _):
        if LOG_PATH.exists():
            subprocess.run(["open", str(LOG_PATH)], check=False)
        else:
            rumps.alert("No log file found yet.")

    def _on_quit_menubar(self, _):
        """Quit just the menu bar app. The background daemon continues running."""
        rumps.quit_application()

    def _on_stop_all(self, _):
        """Prompt user, stop the background daemon, and quit the menu bar app."""
        response = rumps.alert(
            title="Stop Tracky?",
            message=(
                "This will stop the background job scanner and close the menu bar app.\n\n"
                "You will not receive any new job alerts until you start the agent again."
            ),
            ok="Stop & Quit",
            cancel="Cancel",
        )
        if response != 1:  # 1 is OK button in rumps
            return

        if PLIST_DAEMON.exists():
            subprocess.run(["launchctl", "unload", str(PLIST_DAEMON)], check=False)
        else:
            pid = _daemon_pid()
            if pid:
                try:
                    os.kill(pid, signal.SIGTERM)
                except Exception:
                    pass

        rumps.quit_application()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    TrackyApp().run()
