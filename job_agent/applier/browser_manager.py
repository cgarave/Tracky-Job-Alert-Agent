"""
Browser Manager for Job Agent & Platform Sessions.
Detects installed browsers on macOS, Windows, and Linux, and manages browser launching.
Supports Safari (WebKit), Brave, Google Chrome, Microsoft Edge, Arc, Firefox, Opera, Vivaldi, and Playwright Chromium.
"""
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def _expand_path(path_str: str) -> str:
    """Expand environment variables and user home directory."""
    expanded = os.path.expandvars(path_str)
    return os.path.expanduser(expanded)


def detect_available_browsers() -> List[Dict[str, Any]]:
    """
    Detect all installed web browsers on the host operating system.
    Returns a list of browser dicts with availability status and metadata.
    """
    browsers: List[Dict[str, Any]] = []

    # 1. Safari / WebKit (Native on macOS, WebKit Playwright engine)
    safari_native = sys.platform == "darwin" and Path("/Applications/Safari.app").exists()
    browsers.append({
        "id": "safari",
        "name": "Safari",
        "engine": "webkit",
        "installed": safari_native or True,
        "is_native": safari_native,
        "icon": "safari",
        "description": "Apple Safari (WebKit Engine)" if safari_native else "WebKit Engine",
    })

    # 2. Brave Browser
    brave_paths = [
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"%PROGRAMFILES%\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"%PROGRAMFILES(X86)%\BraveSoftware\Brave-Browser\Application\brave.exe",
        "/usr/bin/brave-browser",
        "/usr/bin/brave",
    ]
    brave_exec = next((_expand_path(p) for p in brave_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "brave",
        "name": "Brave Browser",
        "engine": "chromium",
        "installed": brave_exec is not None,
        "executable_path": brave_exec,
        "icon": "brave",
        "description": "Brave Shield Privacy Browser",
    })

    # 3. Google Chrome
    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe",
        r"%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe",
        r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chrome",
    ]
    chrome_exec = next((_expand_path(p) for p in chrome_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "chrome",
        "name": "Google Chrome",
        "engine": "chromium",
        "channel": "chrome",
        "installed": chrome_exec is not None,
        "executable_path": chrome_exec,
        "icon": "chrome",
        "description": "Google Chrome Web Browser",
    })

    # 4. Microsoft Edge
    edge_paths = [
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe",
        r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe",
        r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
    ]
    edge_exec = next((_expand_path(p) for p in edge_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "edge",
        "name": "Microsoft Edge",
        "engine": "chromium",
        "channel": "msedge",
        "installed": edge_exec is not None,
        "executable_path": edge_exec,
        "icon": "edge",
        "description": "Microsoft Edge Browser",
    })

    # 5. Arc Browser
    arc_paths = [
        "/Applications/Arc.app/Contents/MacOS/Arc",
        r"%LOCALAPPDATA%\Arc\Arc.exe",
    ]
    arc_exec = next((_expand_path(p) for p in arc_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "arc",
        "name": "Arc Browser",
        "engine": "chromium",
        "installed": arc_exec is not None,
        "executable_path": arc_exec,
        "icon": "arc",
        "description": "The Arc Browser",
    })

    # 6. Mozilla Firefox
    firefox_paths = [
        "/Applications/Firefox.app/Contents/MacOS/firefox",
        r"%PROGRAMFILES%\Mozilla Firefox\firefox.exe",
        r"%PROGRAMFILES(X86)%\Mozilla Firefox\firefox.exe",
        "/usr/bin/firefox",
    ]
    firefox_exec = next((_expand_path(p) for p in firefox_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "firefox",
        "name": "Mozilla Firefox",
        "engine": "firefox",
        "installed": firefox_exec is not None or True,
        "executable_path": firefox_exec,
        "icon": "firefox",
        "description": "Mozilla Firefox Browser",
    })

    # 7. Opera / Opera GX
    opera_paths = [
        "/Applications/Opera.app/Contents/MacOS/Opera",
        "/Applications/Opera GX.app/Contents/MacOS/Opera GX",
        r"%LOCALAPPDATA%\Programs\Opera\launcher.exe",
        r"%LOCALAPPDATA%\Programs\Opera GX\launcher.exe",
        "/usr/bin/opera",
    ]
    opera_exec = next((_expand_path(p) for p in opera_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "opera",
        "name": "Opera",
        "engine": "chromium",
        "installed": opera_exec is not None,
        "executable_path": opera_exec,
        "icon": "opera",
        "description": "Opera Web Browser",
    })

    # 8. Vivaldi
    vivaldi_paths = [
        "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
        r"%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe",
        "/usr/bin/vivaldi",
    ]
    vivaldi_exec = next((_expand_path(p) for p in vivaldi_paths if Path(_expand_path(p)).exists()), None)
    browsers.append({
        "id": "vivaldi",
        "name": "Vivaldi",
        "engine": "chromium",
        "installed": vivaldi_exec is not None,
        "executable_path": vivaldi_exec,
        "icon": "vivaldi",
        "description": "Vivaldi Browser",
    })

    # 9. Playwright Built-in Chromium (Standard Fallback)
    browsers.append({
        "id": "chromium",
        "name": "Chromium (Testing)",
        "engine": "chromium",
        "installed": True,
        "icon": "chromium",
        "description": "Playwright Built-in Chromium Browser",
    })

    return browsers


def get_preferred_browser(config_file: Optional[Path] = None) -> str:
    """
    Get the configured preferred browser or pick the best available installed browser.
    Prefers Brave -> Safari -> Chrome -> Edge -> Arc -> Firefox -> Chromium.
    """
    cfg_path = config_file or CONFIG_PATH
    if cfg_path.exists():
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            pref = cfg.get("preferred_browser")
            if pref:
                return str(pref).lower()
        except Exception:
            pass

    # Default fallback hierarchy based on installed browsers
    detected = detect_available_browsers()
    installed_ids = {b["id"] for b in detected if b.get("installed")}

    priority = ["brave", "safari", "chrome", "edge", "arc", "firefox", "chromium"]
    for pid in priority:
        if pid in installed_ids:
            return pid

    return "chromium"


def set_preferred_browser(browser_id: str, config_file: Optional[Path] = None) -> str:
    """Save the user's preferred browser to config.json."""
    cfg_path = config_file or CONFIG_PATH
    cfg = {}
    if cfg_path.exists():
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:
            cfg = {}

    clean_id = str(browser_id).lower().strip()
    cfg["preferred_browser"] = clean_id

    try:
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        logger.error(f"Could not save preferred browser to config: {e}")

    return clean_id


def launch_browser(
    playwright_instance: Any,
    browser_id: Optional[str] = None,
    headless: bool = False,
    extra_args: Optional[List[str]] = None,
) -> Any:
    """
    Launch a browser using Playwright tailored to the specified browser ID.
    If the requested browser fails, falls back gracefully to standard Chromium.
    """
    p = playwright_instance
    bid = (browser_id or get_preferred_browser()).lower().strip()
    available = {b["id"]: b for b in detect_available_browsers()}
    browser_info = available.get(bid, {})

    args = list(extra_args or [])
    if not headless and "--start-maximized" not in args:
        args.append("--start-maximized")
    if "--disable-blink-features=AutomationControlled" not in args:
        args.append("--disable-blink-features=AutomationControlled")

    logger.info(f"Attempting to launch browser: {bid} (headless={headless})")

    # 1. Safari / WebKit Engine
    if bid in ("safari", "webkit"):
        try:
            return p.webkit.launch(headless=headless)
        except Exception as exc:
            logger.warning(f"WebKit launch failed ({exc}), falling back to Chromium...")

    # 2. Firefox Engine
    elif bid == "firefox":
        try:
            exec_path = browser_info.get("executable_path")
            launch_kwargs = {"headless": headless}
            if exec_path and Path(exec_path).exists():
                launch_kwargs["executable_path"] = exec_path
            return p.firefox.launch(**launch_kwargs)
        except Exception as exc:
            logger.warning(f"Firefox launch failed ({exc}), falling back to Chromium...")

    # 3. Chromium-based browsers with specific executable paths (Brave, Arc, Opera, Vivaldi, Custom Chrome)
    else:
        exec_path = browser_info.get("executable_path")
        channel = browser_info.get("channel")

        # Try launching with custom executablePath
        if exec_path and Path(exec_path).exists():
            try:
                return p.chromium.launch(
                    executable_path=exec_path,
                    headless=headless,
                    args=args,
                )
            except Exception as exc:
                logger.warning(f"Custom executable launch for {bid} failed ({exc}). Trying channel/default...")

        # Try launching with Playwright channel
        if channel:
            try:
                return p.chromium.launch(
                    channel=channel,
                    headless=headless,
                    args=args,
                )
            except Exception as exc:
                logger.warning(f"Channel launch for {channel} failed ({exc}). Trying default Chromium...")

    # 4. Universal Fallback: Default Playwright Chromium
    logger.info("Launching standard Playwright Chromium browser.")
    return p.chromium.launch(
        headless=headless,
        args=args,
    )
