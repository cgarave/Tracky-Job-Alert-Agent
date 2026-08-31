"""
Anti-Bot Stealth and Cloudflare Turnstile Challenge Evasion Layer.
Provides stealth CDP masking, WebGL GPU spoofing, Google One Tap flap suppression, and Turnstile auto-solving.
"""
import logging
import random
import time
from typing import Optional

logger = logging.getLogger(__name__)

STEALTH_EVASION_SCRIPT = """
(() => {
    // 1. Delete and override navigator.webdriver
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
        });
        delete navigator.__proto__.webdriver;
    } catch (e) {}

    // 2. Mock Chrome Runtime & App APIs
    try {
        window.chrome = {
            runtime: {
                OnInstalledReason: {
                    CHROME_UPDATE: "chrome_update",
                    INSTALL: "install",
                    SHARED_MODULE_UPDATE: "shared_module_update",
                    UPDATE: "update"
                },
                OnRestartRequiredReason: {
                    APP_UPDATE: "app_update",
                    OS_UPDATE: "os_update",
                    PERIODIC: "periodic"
                },
                PlatformArch: {
                    ARM: "arm",
                    ARM64: "arm64",
                    MIPS: "mips",
                    MIPS64: "mips64",
                    X86_32: "x86-32",
                    X86_64: "x86-64"
                },
                PlatformNaclArch: {
                    ARM: "arm",
                    MIPS: "mips",
                    MIPS64: "mips64",
                    X86_32: "x86-32",
                    X86_64: "x86-64"
                },
                PlatformOs: {
                    ANDROID: "android",
                    CROS: "cros",
                    LINUX: "linux",
                    MAC: "mac",
                    OPENBSD: "openbsd",
                    WIN: "win"
                },
                RequestUpdateCheckStatus: {
                    NO_UPDATE: "no_update",
                    THROTTLED: "throttled",
                    UPDATE_AVAILABLE: "update_available"
                }
            },
            loadTimes: function() {},
            csi: function() {},
            app: {
                isInstalled: false,
                AppLifecycleState: {
                    DISABLED: "disabled",
                    INSTALLED: "installed",
                    RUNNING: "running",
                    UNINSTALLED: "uninstalled"
                },
                InstallState: {
                    DISABLED: "disabled",
                    INSTALLED: "installed",
                    NOT_INSTALLED: "not_installed"
                },
                RunningState: {
                    CANNOT_RUN: "cannot_run",
                    READY_TO_RUN: "ready_to_run",
                    RUNNING: "running"
                }
            }
        };
    } catch (e) {}

    // 3. Mock Plugins and Languages
    try {
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
            configurable: true
        });
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true
        });
    } catch (e) {}

    // 4. Mask WebGL Vendor / Renderer (Avoid SwiftShader / VM detection)
    try {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {
                return 'Apple Inc.';
            }
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {
                return 'Apple GPU';
            }
            return getParameter.apply(this, arguments);
        };
    } catch (e) {}

    // 5. Notification permissions query spoofing
    try {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    } catch (e) {}
})();
"""

DEFAULT_EXTRA_HEADERS = {
    "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "upgrade-insecure-requests": "1",
    "accept-language": "en-US,en;q=0.9",
}


def configure_stealth_context(context, suppress_google_one_tap: bool = True) -> None:
    """
    Applies stealth scripts and network route blocks to a Playwright browser context.
    Prevents Google One Tap background flapping and masks automation identifiers.
    """
    try:
        context.add_init_script(STEALTH_EVASION_SCRIPT)
    except Exception as exc:
        logger.warning(f"Failed to inject stealth script: {exc}")

    if suppress_google_one_tap:
        # Abort Google One Tap background iframes and SDK endpoints that cause flapping/twitching
        try:
            context.route("**/*google.com/gsi/*", lambda route: route.abort())
            context.route("**/*accounts.google.com/gsi/*", lambda route: route.abort())
            context.route("**/gsi/iframe**", lambda route: route.abort())
            context.route("**/gsi/select**", lambda route: route.abort())
            context.route("**/gsi/status**", lambda route: route.abort())
        except Exception as exc:
            logger.warning(f"Could not attach One Tap route filter: {exc}")


def solve_turnstile_challenge(page, timeout_ms: int = 15000) -> bool:
    """
    Detects and automatically resolves Cloudflare Turnstile / Bot challenge.
    Simulates humanized mouse movements to click the verification checkbox.
    Returns True if resolved or if not in a challenge, False if timed out.
    """
    # 1. Quick check: Is this genuinely a Cloudflare challenge?
    try:
        has_challenge_dom = page.query_selector(
            "#challenge-stage, #cf-stage, iframe[src*='challenges.cloudflare.com'], iframe[title*='Cloudflare']"
        )
        body_text = page.evaluate("() => document.body ? document.body.innerText : ''")
        is_blocked = "additional verification required" in body_text.lower() or "troubleshooting cloudflare errors" in body_text.lower()

        if not has_challenge_dom and not is_blocked:
            # Not an active Cloudflare block
            return True
    except Exception:
        pass

    start_time = time.time()
    logger.info("[Stealth] Cloudflare challenge detected — attempting automated resolution...")

    while (time.time() - start_time) * 1000 < timeout_ms:
        try:
            body_text = page.evaluate("() => document.body ? document.body.innerText : ''")
            if "additional verification required" not in body_text.lower() and "troubleshooting cloudflare errors" not in body_text.lower():
                if not page.query_selector("iframe[src*='challenges.cloudflare.com']"):
                    logger.info("[Stealth] Challenge cleared successfully!")
                    return True
        except Exception:
            pass

        # Check for Cloudflare Turnstile iframe
        turnstile_iframe = page.frame_locator(
            "iframe[src*='challenges.cloudflare.com'], iframe[title*='Cloudflare security challenge'], iframe[src*='turnstile'], iframe[title*='Turnstile']"
        )

        try:
            checkbox = turnstile_iframe.locator(
                "input[type='checkbox'], span.mark, div.ctp-checkbox-label, #challenge-stage, div.checkbox"
            )
            if checkbox.count() > 0 and checkbox.first.is_visible():
                box = checkbox.first.bounding_box()
                if box:
                    logger.info("[Stealth] Found Turnstile checkbox — clicking with humanized trajectory...")
                    x = box["x"] + box["width"] / 2 + random.uniform(-3, 3)
                    y = box["y"] + box["height"] / 2 + random.uniform(-3, 3)

                    # Multi-step natural mouse motion
                    page.mouse.move(x - 60, y - 40, steps=6)
                    time.sleep(random.uniform(0.15, 0.3))
                    page.mouse.move(x, y, steps=8)
                    time.sleep(random.uniform(0.1, 0.25))
                    page.mouse.click(x, y)
                    page.wait_for_timeout(2500)
                    logger.info("[Stealth] Clicked Turnstile checkbox. Awaiting verification...")
        except Exception as exc:
            logger.debug(f"[Stealth] Turnstile query notice: {exc}")

        page.wait_for_timeout(500)

    logger.warning("[Stealth] Turnstile resolution timed out.")
    return False
