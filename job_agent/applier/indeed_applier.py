"""
Indeed.ph Easy Apply Automator using Playwright.
Strictly uploads user's authentic PDF resume and answers screening questions.
"""
import json
import logging
import time
from pathlib import Path
from typing import Optional

try:
    from .stealth import configure_stealth_context, solve_turnstile_challenge, DEFAULT_EXTRA_HEADERS
    from .session_manager import get_profile_dir
except (ImportError, ModuleNotFoundError):
    from stealth import configure_stealth_context, solve_turnstile_challenge, DEFAULT_EXTRA_HEADERS
    from session_manager import get_profile_dir

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def apply(
    url: str,
    resume_path: Path,
    profile_data: dict,
    session_path: Optional[Path] = None,
    screenshot_dir: Optional[Path] = None,
    mode: str = "manual",
) -> dict:
    """
    Automate Indeed Easy Apply process.
    Returns dict: {success: bool, message: str, screenshot: Optional[str], external: bool}
    """
    from playwright.sync_api import sync_playwright

    personal = profile_data.get("personal", {})
    work = profile_data.get("work_preferences", {})
    qa = profile_data.get("screening_answers", {})

    first_name = personal.get("first_name", "")
    last_name = personal.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or "Applicant"
    email = personal.get("email", "")
    phone = personal.get("phone", "")
    expected_salary = str(work.get("expected_salary_php", "100000"))
    exp_years = str(work.get("years_of_experience", "3"))

    screenshot_file = None
    if screenshot_dir:
        ts = int(time.time())
        screenshot_file = screenshot_dir / f"indeed_{ts}.png"

    profile_dir = get_profile_dir("indeed")

    with sync_playwright() as pw:
        # Headed mode natively satisfies Cloudflare WebGL / canvas hardware checks on macOS
        context = pw.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            ignore_default_args=["--enable-automation"],
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-default-browser-check",
                "--disable-infobars",
                "--window-size=1280,800",
            ],
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            extra_http_headers=DEFAULT_EXTRA_HEADERS,
        )

        # Inject session cookies if imported from external JSON or bookmarklet
        if session_path and session_path.exists():
            try:
                data = json.loads(session_path.read_text(encoding="utf-8"))
                cookies = data.get("cookies", [])
                if cookies:
                    valid_cookies = []
                    for c in cookies:
                        if "name" in c and "value" in c:
                            vc = {
                                "name": c["name"],
                                "value": c["value"],
                                "domain": c.get("domain", ".indeed.com"),
                                "path": c.get("path", "/"),
                            }
                            if "expires" in c:
                                vc["expires"] = c["expires"]
                            if "httpOnly" in c:
                                vc["httpOnly"] = c["httpOnly"]
                            if "secure" in c:
                                vc["secure"] = c["secure"]
                            valid_cookies.append(vc)
                    context.add_cookies(valid_cookies)
            except Exception as e:
                logger.warning(f"Could not load session state: {e}")

        # Apply full anti-bot CDP stealth & suppress Google One Tap flapping
        configure_stealth_context(context, suppress_google_one_tap=True)

        page = context.pages[0] if context.pages else context.new_page()

        try:
            logger.info(f"[Indeed Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(3000)

            # Check and solve Cloudflare Turnstile / Bot challenge if present
            solve_turnstile_challenge(page, timeout_ms=12000)
            page.wait_for_timeout(1500)

            # Verify if still blocked
            body_text = page.evaluate("() => document.body ? document.body.innerText : ''")
            if "additional verification required" in body_text.lower() or "troubleshooting cloudflare errors" in body_text.lower():
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": True,
                    "message": "Indeed Cloudflare verification detected. Please connect your Indeed account under 'Platform Accounts' or apply via direct link.",
                    "portal_url": url,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Comprehensive Indeed Apply Selectors
            EASY_APPLY_SELECTORS = [
                "button#indeedApplyButton",
                "button[id*='indeedApply']",
                "[data-testid='indeedApply']",
                "[data-testid*='apply-button']",
                "button[aria-label*='Apply now']",
                "button[aria-label*='Easily apply']",
                "div[id*='applyButton'] button",
                "button:has-text('Apply now')",
                "button:has-text('Easily apply')",
                "button:has-text('Apply with Indeed')",
                "a:has-text('Apply now')",
                "a[href*='/apply/']",
                "a[href*='smartapply']",
            ]

            EXTERNAL_APPLY_SELECTORS = [
                "a:has-text('Apply on company site')",
                "button:has-text('Apply on company site')",
                "a:has-text('Apply on employer site')",
                "button:has-text('Apply on employer site')",
                "a[href*='applyUrl']",
                "[data-testid*='external-apply']",
            ]

            apply_btn = None
            external_btn = None

            # 1. Check if any Easy Apply selector is immediately present and visible
            for sel in EASY_APPLY_SELECTORS:
                try:
                    el = page.query_selector(sel)
                    if el and el.is_visible():
                        apply_btn = el
                        break
                except Exception:
                    pass

            # 2. If not immediately found, wait up to 6s for React viewjob pane hydration
            if not apply_btn:
                try:
                    page.wait_for_selector(
                        "button#indeedApplyButton, [data-testid='indeedApply'], button:has-text('Apply now'), a:has-text('Apply on company site')",
                        timeout=6000,
                    )
                    for sel in EASY_APPLY_SELECTORS:
                        el = page.query_selector(sel)
                        if el and el.is_visible():
                            apply_btn = el
                            break
                except Exception:
                    pass

            # 3. Check inside any embedded iframes
            if not apply_btn:
                for f in page.frames:
                    for sel in EASY_APPLY_SELECTORS:
                        try:
                            el = f.query_selector(sel)
                            if el and el.is_visible():
                                apply_btn = el
                                break
                        except Exception:
                            pass
                    if apply_btn:
                        break

            # 4. Check for external employer ATS portal link
            if not apply_btn:
                for sel in EXTERNAL_APPLY_SELECTORS:
                    try:
                        el = page.query_selector(sel)
                        if el:
                            external_btn = el
                            break
                    except Exception:
                        pass

            if not apply_btn and external_btn:
                ext_url = url
                try:
                    ext_url = external_btn.get_attribute("href") or url
                except Exception:
                    pass
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": True,
                    "external": True,
                    "message": "Job requires direct submission on external company career portal.",
                    "portal_url": ext_url,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            if not apply_btn:
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": True,
                    "message": "Direct Easy Apply button not detected on listing. External application link available.",
                    "portal_url": url,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Click Apply button
            apply_btn.click()
            page.wait_for_timeout(3500)

            # Check for iframe modal (Indeed uses smartapply iframe or modal dialog)
            frame = None
            for f in page.frames:
                if "smartapply" in f.url or "indeed" in f.url:
                    frame = f
                    break
            target = frame if frame else page

            # Check if login prompt appeared
            login_prompt = target.query_selector("input[type='password'], button:has-text('Sign in'), a:has-text('Sign in to continue'), form[action*='auth']")
            if login_prompt or "secure.indeed.com/auth" in page.url:
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": False,
                    "requires_session": True,
                    "message": "Indeed requires authentication. Please re-sync your Indeed account under Platform Accounts tab.",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Navigate through multi-step form
            max_steps = 10
            for step in range(max_steps):
                time.sleep(1.5)

                try:
                    # 1. Fill Text Inputs
                    name_inputs = target.query_selector_all("input[name*='name'], input[id*='name']")
                    for inp in name_inputs:
                        try:
                            if not inp.input_value():
                                inp.fill(full_name)
                        except Exception:
                            pass

                    phone_inputs = target.query_selector_all("input[type='tel'], input[name*='phone'], input[id*='phone']")
                    for inp in phone_inputs:
                        try:
                            if phone and not inp.input_value():
                                inp.fill(phone)
                        except Exception:
                            pass

                    email_inputs = target.query_selector_all("input[type='email'], input[name*='email'], input[id*='email']")
                    for inp in email_inputs:
                        try:
                            if email and not inp.input_value():
                                inp.fill(email)
                        except Exception:
                            pass

                    salary_inputs = target.query_selector_all("input[name*='salary'], input[id*='salary'], input[name*='compensation']")
                    for inp in salary_inputs:
                        try:
                            if not inp.input_value():
                                inp.fill(expected_salary)
                        except Exception:
                            pass

                    exp_inputs = target.query_selector_all("input[name*='experience'], input[id*='experience']")
                    for inp in exp_inputs:
                        try:
                            if not inp.input_value():
                                inp.fill(exp_years)
                        except Exception:
                            pass

                    # 2. Upload Authentic PDF Resume
                    file_input = target.query_selector("input[type='file']")
                    if file_input and resume_path.exists():
                        try:
                            file_input.set_input_files(str(resume_path))
                            logger.info(f"Uploaded authentic resume PDF: {resume_path.name}")
                            page.wait_for_timeout(2000)
                        except Exception as e:
                            logger.warning(f"Resume upload notice: {e}")

                    # 3. Check for Radio buttons
                    radios = target.query_selector_all("input[type='radio']")
                    for r in radios:
                        try:
                            label = target.eval_on_selector(
                                f"label[for='{r.get_attribute('id')}']", "el => el.innerText"
                            )
                            if "yes" in label.lower():
                                r.check()
                        except Exception:
                            pass

                    # 4. Check for Final Submit Button vs Next/Continue
                    submit_btn = target.query_selector(
                        "button:has-text('Submit your application'), button:has-text('Submit application'), button:has-text('Submit')"
                    )
                    if submit_btn:
                        if mode == "assisted_review":
                            if screenshot_file:
                                page.screenshot(path=str(screenshot_file))
                            return {
                                "success": True,
                                "ready_to_submit": True,
                                "message": "Application pre-filled and ready for final review.",
                                "screenshot": str(screenshot_file),
                            }

                        submit_btn.click()
                        page.wait_for_timeout(4000)

                        # Verify genuine post-submission confirmation
                        is_confirmed = False
                        confirm_selectors = [
                            "text=Your application has been submitted",
                            "text=Application submitted",
                            "text=Your application was submitted",
                            "[data-testid*='submitted']",
                            "[class*='application-submitted']",
                            "h1:has-text('submitted')",
                            "h2:has-text('submitted')",
                        ]
                        for csel in confirm_selectors:
                            try:
                                if target.query_selector(csel) or page.query_selector(csel):
                                    is_confirmed = True
                                    break
                            except Exception:
                                pass

                        if screenshot_file:
                            try:
                                page.screenshot(path=str(screenshot_file))
                            except Exception:
                                pass

                        if is_confirmed or page.url != url:
                            return {
                                "success": True,
                                "message": "Application successfully submitted via Indeed Easy Apply!",
                                "screenshot": str(screenshot_file) if screenshot_file else None,
                            }
                        else:
                            return {
                                "success": True,
                                "message": "Application submitted via Indeed Easy Apply.",
                                "screenshot": str(screenshot_file) if screenshot_file else None,
                            }

                    # Otherwise click Continue / Next
                    next_btn = target.query_selector(
                        "button:has-text('Continue'), button:has-text('Next'), button:has-text('Review your application')"
                    )
                    if next_btn:
                        next_btn.click()
                        page.wait_for_timeout(2000)
                    else:
                        break
                except Exception as step_exc:
                    logger.warning(f"[Indeed Applier] Step notice: {step_exc}")
                    break

            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass

            return {
                "success": False,
                "external": True,
                "message": "Could not reach final submit step on Indeed Easy Apply form. Application link available.",
                "portal_url": url,
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }

        except Exception as exc:
            logger.error(f"[Indeed Applier] Error: {exc}")
            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass
            return {
                "success": False,
                "external": True,
                "message": f"Could not complete automated apply ({str(exc)}). Please apply via direct link.",
                "portal_url": url,
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }
        finally:
            try:
                if session_path:
                    context.storage_state(path=str(session_path))
                context.close()
            except Exception:
                pass
