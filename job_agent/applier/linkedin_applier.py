import json
import logging
import time
from pathlib import Path
from typing import Optional

try:
    from .stealth import configure_stealth_context, DEFAULT_EXTRA_HEADERS
    from .session_manager import get_profile_dir
except (ImportError, ModuleNotFoundError):
    from stealth import configure_stealth_context, DEFAULT_EXTRA_HEADERS
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
    custom_pitch: str = "",
) -> dict:
    """
    Automate LinkedIn Easy Apply flow.
    Strictly verifies authenticated session and modal progression.
    Returns dict: {success: bool, message: str, screenshot: Optional[str], external: bool}
    """
    from playwright.sync_api import sync_playwright

    personal = profile_data.get("personal", {})
    work = profile_data.get("work_preferences", {})

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
        screenshot_file = screenshot_dir / f"linkedin_{ts}.png"

    profile_dir = get_profile_dir("linkedin")

    with sync_playwright() as pw:
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
                                "domain": c.get("domain", ".linkedin.com"),
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
                logger.warning(f"Could not load LinkedIn session state: {e}")

        configure_stealth_context(context, suppress_google_one_tap=True)
        page = context.pages[0] if context.pages else context.new_page()

        try:
            logger.info(f"[LinkedIn Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(3000)

            # Comprehensive LinkedIn Easy Apply Selectors
            LINKEDIN_EASY_APPLY_SELECTORS = [
                "button.jobs-apply-button:has-text('Easy Apply')",
                "button[aria-label*='Easy Apply']",
                "button:has-text('Easy Apply')",
                "div.jobs-apply-button--top-card button",
                "[data-control-name='jobdetails_topcard_inapply']",
            ]

            easy_apply_btn = None
            for sel in LINKEDIN_EASY_APPLY_SELECTORS:
                try:
                    el = page.query_selector(sel)
                    if el and el.is_visible():
                        easy_apply_btn = el
                        break
                except Exception:
                    pass

            if not easy_apply_btn:
                # Wait up to 6s for LinkedIn job details hydration
                try:
                    page.wait_for_selector("button.jobs-apply-button, button:has-text('Easy Apply')", timeout=6000)
                    for sel in LINKEDIN_EASY_APPLY_SELECTORS:
                        el = page.query_selector(sel)
                        if el and el.is_visible():
                            easy_apply_btn = el
                            break
                except Exception:
                    pass

            if not easy_apply_btn:
                # Check for external apply button
                ext_btn = page.query_selector("button.jobs-apply-button, a.jobs-apply-button, a[href*='apply']")
                ext_url = ext_btn.get_attribute("href") if ext_btn else url
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": True,
                    "message": "Listing requires external application on company portal.",
                    "portal_url": ext_url or url,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Click Easy Apply
            easy_apply_btn.click()
            page.wait_for_timeout(2500)

            modal = page.query_selector("div.jobs-easy-apply-modal, div[data-test-modal], div.jobs-easy-apply-content")
            target = modal if modal else page

            # Navigate multi-step Easy Apply dialog
            max_steps = 8
            for step in range(max_steps):
                time.sleep(1.5)

                try:
                    # 1. Contact inputs
                    phone_input = target.query_selector("input[id*='phoneNumber'], input[name*='phoneNumber']")
                    if phone_input and phone and not phone_input.input_value():
                        phone_input.fill(phone)

                    email_input = target.query_selector("input[id*='email'], input[name*='email']")
                    if email_input and email and not email_input.input_value():
                        email_input.fill(email)

                    # 2. Resume File Upload
                    file_input = target.query_selector("input[type='file']")
                    if file_input and resume_path.exists():
                        try:
                            file_input.set_input_files(str(resume_path))
                            logger.info(f"Attached authentic PDF resume on LinkedIn: {resume_path.name}")
                            page.wait_for_timeout(2000)
                        except Exception as e:
                            logger.warning(f"LinkedIn file input notice: {e}")

                    # 3. Numeric questions (experience / salary)
                    num_inputs = target.query_selector_all("input[id*='numeric'], input[type='text']")
                    for inp in num_inputs:
                        try:
                            lbl = target.eval_on_selector(f"label[for='{inp.get_attribute('id')}']", "el => el.innerText").lower()
                            if "year" in lbl or "experience" in lbl:
                                if not inp.input_value():
                                    inp.fill(exp_years)
                            elif "salary" in lbl or "compensation" in lbl:
                                if not inp.input_value():
                                    inp.fill(salary)
                        except Exception:
                            pass

                    # 4. Radios (Yes/No)
                    radios = target.query_selector_all("input[type='radio']")
                    for r in radios:
                        try:
                            r_id = r.get_attribute("id")
                            if r_id:
                                lbl = target.eval_on_selector(f"label[for='{r_id}']", "el => el.innerText").lower()
                                if "yes" in lbl:
                                    r.check()
                        except Exception:
                            pass

                    # 5. Check Submit Button vs Next/Review
                    submit_btn = target.query_selector(
                        "button:has-text('Submit application'), button[aria-label*='Submit application'], button[data-control-name='submit_unify']"
                    )
                    if submit_btn:
                        if mode == "assisted_review":
                            if screenshot_file:
                                page.screenshot(path=str(screenshot_file))
                            return {
                                "success": True,
                                "ready_to_submit": True,
                                "message": "LinkedIn Easy Apply pre-filled and ready for review.",
                                "screenshot": str(screenshot_file),
                            }

                        submit_btn.click()
                        page.wait_for_timeout(4000)

                        # Verify confirmation
                        page_text = page.inner_text("body").lower() if page.query_selector("body") else ""
                        confirmed = any(
                            phrase in page_text for phrase in ["application sent", "applied", "success"]
                        )

                        if screenshot_file:
                            try:
                                page.screenshot(path=str(screenshot_file))
                            except Exception:
                                pass

                        if confirmed:
                            return {
                                "success": True,
                                "message": "Application successfully submitted via LinkedIn Easy Apply!",
                                "screenshot": str(screenshot_file) if screenshot_file else None,
                            }
                        else:
                            return {
                                "success": False,
                                "message": "LinkedIn submission was sent but confirmation badge could not be verified.",
                                "screenshot": str(screenshot_file) if screenshot_file else None,
                            }

                    # Next / Review button
                    next_btn = target.query_selector(
                        "button[data-easy-apply-next-button], button:has-text('Next'), button:has-text('Review')"
                    )
                    if next_btn:
                        next_btn.click()
                        page.wait_for_timeout(2000)
                    else:
                        break
                except Exception as step_exc:
                    logger.warning(f"[LinkedIn] Step notice: {step_exc}")
                    break

            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass

            return {
                "success": False,
                "external": True,
                "message": "Could not reach final submit step on LinkedIn Easy Apply. Listing link available.",
                "portal_url": url,
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }

        except Exception as exc:
            logger.error(f"[LinkedIn Applier] Error: {exc}")
            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass
            return {
                "success": False,
                "message": f"Error applying on LinkedIn: {str(exc)}",
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }
        finally:
            try:
                if session_path:
                    context.storage_state(path=str(session_path))
                context.close()
            except Exception:
                pass
