"""
JobStreet.ph (SEEK Unified Platform) Quick Apply Automator using Playwright.
Strictly uploads user's authentic PDF resume and answers screening questions.
"""
import logging
import time
from pathlib import Path
from typing import Optional

from . import browser_manager

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
    Automate JobStreet Quick Apply process.
    Strictly verifies authenticated session and genuine post-submit confirmation.
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

    screenshot_file = None
    if screenshot_dir:
        ts = int(time.time())
        screenshot_file = screenshot_dir / f"jobstreet_{ts}.png"

    with sync_playwright() as pw:
        headless = mode != "interactive"
        browser = browser_manager.launch_browser(
            pw,
            headless=headless,
        )

        context_kwargs = {
            "user_agent": USER_AGENT,
            "viewport": {"width": 1280, "height": 800},
            "locale": "en-US",
        }
        if session_path and session_path.exists():
            try:
                context_kwargs["storage_state"] = str(session_path)
            except Exception as e:
                logger.warning(f"Could not load JobStreet session state: {e}")

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        try:
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception:
            pass

        try:
            logger.info(f"[JobStreet Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(3000)

            # Comprehensive SEEK / JobStreet Apply Selectors
            JOBSTREET_APPLY_SELECTORS = [
                "[data-automation='job-detail-apply']",
                "[data-automation='applyButton']",
                "a[data-automation='job-detail-apply']",
                "button[data-automation='job-detail-apply']",
                "a[href*='/apply']",
                "button:has-text('Apply now')",
                "button:has-text('Apply')",
                "a:has-text('Apply now')",
                "a:has-text('Apply')",
            ]

            apply_btn = None
            for sel in JOBSTREET_APPLY_SELECTORS:
                try:
                    el = page.query_selector(sel)
                    if el and el.is_visible():
                        apply_btn = el
                        break
                except Exception:
                    pass

            if not apply_btn:
                # Wait up to 6s for SEEK React hydration
                try:
                    page.wait_for_selector(
                        "[data-automation='job-detail-apply'], [data-automation='applyButton'], a[href*='apply']",
                        timeout=6000,
                    )
                    for sel in JOBSTREET_APPLY_SELECTORS:
                        el = page.query_selector(sel)
                        if el and el.is_visible():
                            apply_btn = el
                            break
                except Exception:
                    pass

            if not apply_btn:
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": True,
                    "message": "JobStreet apply button not detected. Please apply via direct link.",
                    "portal_url": url,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            href = apply_btn.get_attribute("href") or ""
            if href and ("jobstreet.com" not in href and "seek.com" not in href and href.startswith("http")):
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": True,
                    "message": "Job requires application on external employer career portal.",
                    "portal_url": href,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Click Apply to enter application wizard
            apply_btn.click()
            page.wait_for_timeout(3000)

            # Check if login prompt appeared
            login_prompt = page.query_selector("input[type='password'], button:has-text('Sign in'), a:has-text('Sign in to apply'), form[action*='login']")
            if login_prompt or "/login" in page.url:
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": False,
                    "requires_session": True,
                    "message": "JobStreet.ph requires authentication to apply. Please re-sync your JobStreet account under Platform Accounts tab.",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Step through multi-screen SEEK application form
            max_steps = 8
            for step in range(max_steps):
                time.sleep(1.5)

                try:
                    # 1. Resume Upload
                    file_input = page.query_selector(
                        "input[type='file'][data-automation='resume-upload-input'], input[type='file']"
                    )
                    if file_input and resume_path.exists():
                        try:
                            file_input.set_input_files(str(resume_path))
                            logger.info(f"Attached authentic PDF resume on JobStreet: {resume_path.name}")
                            page.wait_for_timeout(2000)
                        except Exception as e:
                            logger.warning(f"JobStreet file input notice: {e}")

                    # 2. Fill Phone / Contact details if present
                    phone_input = page.query_selector(
                        "input[data-automation='phone-number-input'], input[name*='phone'], input[id*='phone']"
                    )
                    if phone_input and phone:
                        try:
                            if not phone_input.input_value():
                                phone_input.fill(phone)
                        except Exception:
                            pass

                    # 3. Screening Radio Questions
                    radios = page.query_selector_all("fieldset[data-automation*='question'] input[type='radio'], input[type='radio']")
                    for r in radios:
                        try:
                            r_id = r.get_attribute("id")
                            if r_id:
                                label_txt = page.eval_on_selector(f"label[for='{r_id}']", "el => el.innerText").lower()
                                if "yes" in label_txt:
                                    r.check()
                        except Exception:
                            pass

                    # 4. Check for Submit Button vs Continue
                    submit_btn = page.query_selector(
                        "button[data-automation='apply-submit'], button[data-automation='review-submit-button'], button:has-text('Submit application'), button:has-text('Submit')"
                    )
                    if submit_btn:
                        if mode == "assisted_review":
                            if screenshot_file:
                                page.screenshot(path=str(screenshot_file))
                            return {
                                "success": True,
                                "ready_to_submit": True,
                                "message": "Application pre-filled on JobStreet and ready for review.",
                                "screenshot": str(screenshot_file),
                            }

                        submit_btn.click()
                        page.wait_for_timeout(4000)

                        # Verify confirmation
                        page_text = page.inner_text("body").lower() if page.query_selector("body") else ""
                        confirmed = any(
                            phrase in page_text or phrase in page.url.lower()
                            for phrase in ["success", "application sent", "applied", "application submitted"]
                        )

                        if screenshot_file:
                            try:
                                page.screenshot(path=str(screenshot_file))
                            except Exception:
                                pass

                        if confirmed:
                            return {
                                "success": True,
                                "message": "Application successfully submitted via JobStreet Quick Apply!",
                                "screenshot": str(screenshot_file) if screenshot_file else None,
                            }
                        else:
                            return {
                                "success": False,
                                "message": "Submitted on JobStreet but confirmation status could not be verified.",
                                "screenshot": str(screenshot_file) if screenshot_file else None,
                            }

                    # Next / Continue
                    next_btn = page.query_selector(
                        "button[data-automation='continue-button'], button:has-text('Continue'), button:has-text('Next')"
                    )
                    if next_btn:
                        next_btn.click()
                        page.wait_for_timeout(2000)
                    else:
                        break
                except Exception as step_exc:
                    logger.warning(f"[JobStreet] Step notice: {step_exc}")
                    break

            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass

            return {
                "success": False,
                "message": "Could not reach final submit step on JobStreet application form.",
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }

        except Exception as exc:
            logger.error(f"[JobStreet Applier] Error: {exc}")
            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass
            return {
                "success": False,
                "message": f"Error applying on JobStreet: {str(exc)}",
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }
        finally:
            try:
                browser.close()
            except Exception:
                pass
