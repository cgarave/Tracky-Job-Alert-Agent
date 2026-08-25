"""
Session and Cookie Manager for Job Platforms.
Enables 1-click interactive login and persistent cookie storage.
"""
import json
import logging
import threading
import time
from pathlib import Path
from typing import Optional

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
        data = json.loads(path.read_text())
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


def launch_interactive_login(platform: str) -> dict:
    """
    Open a visible browser window so the user can log in manually.
    Saves cookies and storage state once login is completed or browser is closed.
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

    logger.info(f"Launching interactive login window for {info['name']}...")

    with sync_playwright() as p:
        # Launch visible browser for user to log in
        browser = p.chromium.launch(
            headless=False,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )

        # Load existing state if available
        context_kwargs = {"viewport": None}
        if session_path.exists():
            try:
                context_kwargs["storage_state"] = str(session_path)
            except Exception:
                pass

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        page.goto(info["login_url"], timeout=45000)

        # Wait for user to finish login (keep window open until user closes it or navigates to home)
        logger.info("Waiting for user to log in. Please close the browser window when finished.")
        
        try:
            # Poll until browser/page is closed by user
            while not page.is_closed():
                try:
                    # Save state intermittently if logged in
                    context.storage_state(path=str(session_path))
                except Exception:
                    pass
                time.sleep(2)
        except Exception:
            pass

        try:
            if not page.is_closed():
                context.storage_state(path=str(session_path))
                browser.close()
        except Exception:
            pass

    logger.info(f"Saved session state for {plat} to {session_path}")
    return {"status": "success", "platform": plat, "saved_to": str(session_path)}
