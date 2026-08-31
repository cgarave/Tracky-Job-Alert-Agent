"""
Session and Cookie Manager for Job Platforms.
Enables persistent profile sessions, interactive login sync, direct cookie paste/import, and robust storage state tracking.
"""
import json
import logging
import re
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from .stealth import configure_stealth_context, DEFAULT_EXTRA_HEADERS
except (ImportError, ModuleNotFoundError):
    from stealth import configure_stealth_context, DEFAULT_EXTRA_HEADERS

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
SESSIONS_DIR = DATA_DIR / "sessions"
PROFILES_DIR = DATA_DIR / "profiles"

SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)

PLATFORM_URLS = {
    "indeed": {
        "login_url": "https://secure.indeed.com/account/login",
        "home_url": "https://ph.indeed.com",
        "domain": ".indeed.com",
        "name": "Indeed.ph",
    },
    "jobstreet": {
        "login_url": "https://www.jobstreet.com.ph/login",
        "home_url": "https://www.jobstreet.com.ph",
        "domain": ".jobstreet.com.ph",
        "name": "JobStreet.ph",
    },
    "linkedin": {
        "login_url": "https://www.linkedin.com/login",
        "home_url": "https://www.linkedin.com/jobs",
        "domain": ".linkedin.com",
        "name": "LinkedIn.com",
    },
    "onlinejobs": {
        "login_url": "https://www.onlinejobs.ph/jobseekers/login",
        "home_url": "https://www.onlinejobs.ph/jobseekers/job-search",
        "domain": ".onlinejobs.ph",
        "name": "OnlineJobs.ph",
    },
}

AUTH_COOKIE_SIGNATURES = {
    "linkedin": ["li_at", "JSESSIONID", "bcookie", "li_sugr"],
    "indeed": ["CTK", "SURF", "SHARED_INDEED_CSRF_TOKEN", "INDEED_CSRF_TOKEN", "LOGIN_PERSISTENCE", "LV", "cf_clearance"],
    "jobstreet": ["seekSession", "user", "identity", "JobseekerSession", "token", "auth"],
    "onlinejobs": ["ci_session", "oj_session", "logged_in", "user_id"],
}

_active_logins: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def get_session_path(platform: str) -> Path:
    """Return the JSON session storage path for a platform."""
    return SESSIONS_DIR / f"session_{platform.lower()}.json"


def get_profile_dir(platform: str) -> Path:
    """Return the persistent browser profile directory for a platform."""
    pdir = PROFILES_DIR / platform.lower()
    pdir.mkdir(parents=True, exist_ok=True)
    return pdir


def is_session_active(platform: str) -> bool:
    """Check if a genuine authenticated session file or persistent profile exists with valid login cookies."""
    plat = platform.lower()
    path = get_session_path(plat)
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cookies = data.get("cookies", [])
        if not cookies:
            return False

        cookie_names = {c.get("name", "").lower() for c in cookies}
        expected_sigs = [s.lower() for s in AUTH_COOKIE_SIGNATURES.get(plat, [])]

        # Check for matching platform auth signatures
        has_auth_cookie = any(sig in name for sig in expected_sigs for name in cookie_names)
        
        # Filter out guest-only Cloudflare/analytics tracking cookies
        meaningful_cookies = [
            c for c in cookies
            if not c.get("name", "").startswith("__cf") 
            and not c.get("name", "").startswith("_ga")
            and not c.get("name", "").startswith("_gid")
        ]

        return has_auth_cookie or len(meaningful_cookies) >= 3
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
    """Verify session cookies, signal active helper if running, and touch timestamp."""
    plat = platform.lower()
    with _lock:
        session_info = _active_logins.get(plat)

    if session_info:
        logger.info(f"Triggering on-demand session save for {plat}...")
        save_event: threading.Event = session_info["save_event"]
        save_event.set()
        time.sleep(1.2)

    path = get_session_path(plat)
    if path.exists():
        try:
            path.touch()
        except Exception:
            pass

    active = is_session_active(plat)
    details = get_session_details(plat)
    return {
        "status": "success" if active else "pending",
        "connected": active,
        "details": details,
        "message": (
            "Session verified and saved successfully!"
            if active
            else "No active authenticated session detected. Please complete login or paste cookies."
        ),
    }


def cancel_active_login(platform: str) -> dict:
    """Cancel and close an active helper session."""
    plat = platform.lower()
    with _lock:
        session_info = _active_logins.get(plat)

    if session_info:
        close_event: threading.Event = session_info["close_event"]
        close_event.set()

    return {"status": "closed", "platform": plat}


def import_raw_cookies(platform: str, raw_input: str) -> dict:
    """
    Import cookies from JSON array, JSON object, or key=value string.
    Saves directly to session_{platform}.json and returns verified status.
    """
    plat = platform.lower()
    if plat not in PLATFORM_URLS:
        return {"status": "error", "message": f"Unsupported platform: {platform}"}

    plat_info = PLATFORM_URLS[plat]
    default_domain = plat_info.get("domain", f".{plat}.com")
    session_path = get_session_path(plat)

    parsed_cookies: List[dict] = []
    raw_str = raw_input.strip()

    # Try parsing as JSON
    try:
        data = json.loads(raw_str)
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "name" in item and "value" in item:
                    cookie = {
                        "name": str(item["name"]),
                        "value": str(item["value"]),
                        "domain": item.get("domain", default_domain),
                        "path": item.get("path", "/"),
                        "httpOnly": item.get("httpOnly", False),
                        "secure": item.get("secure", True),
                        "sameSite": item.get("sameSite", "Lax"),
                    }
                    if "expires" in item:
                        cookie["expires"] = item["expires"]
                    parsed_cookies.append(cookie)
        elif isinstance(data, dict):
            if "cookies" in data and isinstance(data["cookies"], list):
                parsed_cookies = data["cookies"]
            else:
                for k, v in data.items():
                    parsed_cookies.append({
                        "name": str(k),
                        "value": str(v),
                        "domain": default_domain,
                        "path": "/",
                        "httpOnly": False,
                        "secure": True,
                        "sameSite": "Lax",
                    })
    except Exception:
        # Fallback to key=value; key2=val2 string parsing
        for pair in raw_str.split(";"):
            pair = pair.strip()
            if "=" in pair:
                k, v = pair.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k:
                    parsed_cookies.append({
                        "name": k,
                        "value": v,
                        "domain": default_domain,
                        "path": "/",
                        "httpOnly": False,
                        "secure": True,
                        "sameSite": "Lax",
                    })

    if not parsed_cookies:
        return {
            "status": "error",
            "message": "Could not parse valid cookies. Please paste a valid JSON array or cookie string.",
        }

    storage_data = {
        "cookies": parsed_cookies,
        "origins": [
            {
                "origin": plat_info["home_url"],
                "localStorage": [],
            }
        ],
    }

    try:
        session_path.write_text(json.dumps(storage_data, indent=2), encoding="utf-8")
        logger.info(f"Imported {len(parsed_cookies)} cookies for {plat} to {session_path}")
    except Exception as exc:
        return {"status": "error", "message": f"Failed to save cookies: {exc}"}

    active = is_session_active(plat)
    details = get_session_details(plat)
    return {
        "status": "success",
        "connected": active,
        "details": details,
        "message": f"Successfully imported {len(parsed_cookies)} cookies for {plat_info['name']}!",
    }


def launch_interactive_login(platform: str) -> dict:
    """
    Launch persistent browser profile window for authentic login.
    Uses launch_persistent_context so Google SSO and Cloudflare trust tokens are saved natively.
    """
    plat = platform.lower()
    if plat not in PLATFORM_URLS:
        raise ValueError(f"Unsupported platform: {platform}")

    with _lock:
        if plat in _active_logins:
            logger.info(f"Login helper window for {plat} is already open.")
            return {"status": "already_open", "platform": plat}

    info = PLATFORM_URLS[plat]
    session_path = get_session_path(plat)
    profile_dir = get_profile_dir(plat)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError("Playwright is not installed.")

    logger.info(f"Launching persistent login helper window for {info['name']}...")

    save_event = threading.Event()
    close_event = threading.Event()

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            ignore_default_args=["--enable-automation"],
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-default-browser-check",
                "--disable-infobars",
                "--window-size=1280,850",
            ],
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 850},
            extra_http_headers=DEFAULT_EXTRA_HEADERS,
        )

        # Apply stealth CDP script & suppress Google One Tap background flapping
        configure_stealth_context(context, suppress_google_one_tap=True)

        # Use the initial page created by persistent context
        page = context.pages[0] if context.pages else context.new_page()

        with _lock:
            _active_logins[plat] = {
                "context": context,
                "page": page,
                "save_event": save_event,
                "close_event": close_event,
            }

        try:
            page.goto(info["login_url"], timeout=45000)
        except Exception as exc:
            logger.warning(f"Initial navigation notice for {info['name']}: {exc}")

        # Monitoring loop: wait until window is closed or save/close event signaled
        while True:
            try:
                # Check if all pages closed
                if not context.pages or all(p.is_closed() for p in context.pages):
                    time.sleep(0.5)
                    if not context.pages or all(p.is_closed() for p in context.pages):
                        break
                if close_event.is_set() or save_event.is_set():
                    break
                time.sleep(0.5)
            except Exception:
                break

        # Snapshot storage state on close or save
        try:
            context.storage_state(path=str(session_path))
            logger.info(f"Successfully saved session state for {plat} to {session_path}")
        except Exception as exc:
            logger.error(f"Error saving storage state for {plat}: {exc}")

        with _lock:
            _active_logins.pop(plat, None)

        try:
            context.close()
        except Exception:
            pass

    return {
        "status": "success",
        "platform": plat,
        "saved_to": str(session_path),
        "connected": is_session_active(plat),
    }
