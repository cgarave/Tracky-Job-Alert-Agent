"""
Session and Cookie Manager for Job Platforms.
Enables 1-click interactive login with user-chosen browsers (Safari, Brave, Chrome, Edge, Firefox, etc.)
and persistent cookie storage for automated runs.
"""
import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from . import browser_manager

logger = logging.getLogger(__name__)

SESSIONS_DIR = Path(__file__).parent.parent / "data" / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

PLATFORM_URLS = {
    "indeed": {
        "login_url": "https://secure.indeed.com/account/login",
        "home_url": "https://ph.indeed.com",
        "name": "Indeed.ph",
    },
    "jobstreet": {
        "login_url": "https://www.jobstreet.com.ph/login",
        "home_url": "https://www.jobstreet.com.ph",
        "name": "JobStreet.ph",
    },
    "linkedin": {
        "login_url": "https://www.linkedin.com/login",
        "home_url": "https://www.linkedin.com/jobs",
        "name": "LinkedIn.com",
    },
    "onlinejobs": {
        "login_url": "https://www.onlinejobs.ph/jobseekers/login",
        "home_url": "https://www.onlinejobs.ph",
        "name": "OnlineJobs.ph",
    },
}

# In-memory registry of active login sessions: platform -> { context, page, browser, save_event, close_event }
_active_logins: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def get_session_path(platform: str) -> Path:
    """Return the JSON session storage path for a platform."""
    return SESSIONS_DIR / f"session_{platform.lower()}.json"


def is_session_active(platform: str) -> bool:
    """Check if a saved session file exists and is non-empty."""
    path = get_session_path(platform)
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cookies = data.get("cookies", [])
        return len(cookies) > 0
    except Exception:
        return False


def get_session_details(platform: str) -> dict:
    """Get detailed cookie count and timestamps for a platform session."""
    plat = platform.lower()
    path = get_session_path(plat)
    info = PLATFORM_URLS.get(plat, {"name": plat.capitalize(), "login_url": "", "home_url": ""})
    active = is_session_active(plat)

    updated_at = ""
    cookie_count = 0
    if path.exists():
        try:
            updated_at = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(path.stat().st_mtime)
            )
            data = json.loads(path.read_text(encoding="utf-8"))
            cookie_count = len(data.get("cookies", []))
        except Exception:
            pass

    is_running = False
    with _lock:
        is_running = plat in _active_logins

    return {
        "platform": plat,
        "name": info["name"],
        "login_url": info["login_url"],
        "home_url": info["home_url"],
        "connected": active,
        "cookie_count": cookie_count,
        "updated_at": updated_at,
        "is_helper_open": is_running,
        "session_file": str(path.name),
    }


def get_all_session_statuses() -> dict:
    """Return connected status and URLs for all supported job boards."""
    result = {}
    for platform in PLATFORM_URLS:
        result[platform] = get_session_details(platform)
    return result


def verify_and_save_active_session(platform: str) -> dict:
    """
    Called when the user clicks 'I have logged in' in the GUI dashboard.
    Signals the active browser helper to snapshot cookies and close.
    """
    plat = platform.lower()
    with _lock:
        session_info = _active_logins.get(plat)

    if session_info:
        logger.info(f"Triggering on-demand session save for {plat}...")
        save_event: threading.Event = session_info["save_event"]
        save_event.set()
        # Wait briefly for worker thread to flush storage state to disk
        time.sleep(1.2)

    active = is_session_active(plat)
    details = get_session_details(plat)
    return {
        "status": "success" if active else "pending",
        "connected": active,
        "details": details,
        "message": "Session verified and saved successfully!" if active else "No active session cookies detected yet.",
    }


def cancel_active_login(platform: str) -> dict:
    """Cancel and close an active browser helper window."""
    plat = platform.lower()
    with _lock:
        session_info = _active_logins.get(plat)

    if session_info:
        close_event: threading.Event = session_info["close_event"]
        close_event.set()

    return {"status": "closed", "platform": plat}


def launch_interactive_login(platform: str, browser_id: Optional[str] = None) -> dict:
    """
    Open a visible browser window (Safari, Brave, Chrome, etc.) so the user can log in manually.
    Saves cookies and storage state cleanly once login is completed or verified in GUI.
    """
    plat = platform.lower()
    if plat not in PLATFORM_URLS:
        raise ValueError(f"Unsupported platform: {platform}")

    info = PLATFORM_URLS[plat]
    session_path = get_session_path(plat)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError("Playwright is not installed.")

    chosen_browser = (browser_id or browser_manager.get_preferred_browser()).lower()
    logger.info(f"Launching interactive login window for {info['name']} using browser '{chosen_browser}'...")

    save_event = threading.Event()
    close_event = threading.Event()

    with sync_playwright() as p:
        browser = browser_manager.launch_browser(
            p,
            browser_id=chosen_browser,
            headless=False,
        )

        context = browser.new_context(viewport=None)
        page = context.new_page()

        # Register in active logins map
        with _lock:
            _active_logins[plat] = {
                "browser": browser,
                "context": context,
                "page": page,
                "save_event": save_event,
                "close_event": close_event,
            }

        try:
            page.goto(info["login_url"], timeout=45000)
        except Exception as exc:
            logger.warning(f"Initial navigation notice for {info['name']}: {exc}")

        logger.info(f"Waiting for user to log in to {info['name']}. Log in and click 'Verify & Save' or close browser when done.")

        # Wait loop: monitor window status and GUI save/close signals
        while True:
            try:
                if not browser.is_connected():
                    break
                if not context.pages or all(p.is_closed() for p in context.pages):
                    break
                if save_event.is_set() or close_event.is_set():
                    break
                time.sleep(0.4)
            except Exception:
                break

        # Capture and save authenticated session cookies & storage state
        try:
            context.storage_state(path=str(session_path))
            logger.info(f"Successfully saved session state for {plat} to {session_path}")
        except Exception as exc:
            logger.error(f"Error saving storage state for {plat}: {exc}")

        # Cleanup active registration
        with _lock:
            _active_logins.pop(plat, None)

        try:
            context.close()
            browser.close()
        except Exception:
            pass

    return {
        "status": "success",
        "platform": plat,
        "browser": chosen_browser,
        "saved_to": str(session_path),
        "connected": is_session_active(plat),
    }
