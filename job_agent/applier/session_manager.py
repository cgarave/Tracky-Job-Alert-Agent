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
from typing import Optional

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


def get_all_session_statuses() -> dict:
    """Return connected status for all supported job boards."""
    result = {}
    for platform, info in PLATFORM_URLS.items():
        path = get_session_path(platform)
        active = is_session_active(platform)
        updated_at = ""
        if path.exists():
            updated_at = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(path.stat().st_mtime)
            )
        result[platform] = {
            "name": info["name"],
            "connected": active,
            "updated_at": updated_at,
            "session_file": str(path.name),
        }
    return result


def launch_interactive_login(platform: str, browser_id: Optional[str] = None) -> dict:
    """
    Open a visible browser window (Safari, Brave, Chrome, etc.) so the user can log in manually.
    Saves cookies and storage state cleanly once login is completed and browser is closed.
    Avoids active storage polling during interaction to prevent tab flickering and anti-bot challenge loops.
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

    with sync_playwright() as p:
        browser = browser_manager.launch_browser(
            p,
            browser_id=chosen_browser,
            headless=False,
        )

        context = browser.new_context(viewport=None)
        page = context.new_page()

        try:
            page.goto(info["login_url"], timeout=45000)
        except Exception as exc:
            logger.warning(f"Initial navigation notice for {info['name']}: {exc}")

        logger.info(f"Waiting for user to log in to {info['name']}. Please close the browser window when finished.")

        try:
            # Wait for user to interact and close the page/window naturally
            # Zero polling / zero CDP queries while open, preventing tab flicker or reloads
            page.wait_for_close(timeout=0)
        except Exception:
            pass

        # Capture and save authenticated session cookies & storage state
        try:
            context.storage_state(path=str(session_path))
            logger.info(f"Successfully saved session state for {plat} to {session_path}")
        except Exception as exc:
            logger.error(f"Error saving storage state for {plat}: {exc}")

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
    }
