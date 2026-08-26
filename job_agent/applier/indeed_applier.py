"""
Indeed.ph Easy Apply Automator using Playwright.
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
                logger.warning(f"Could not load session state: {e}")

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        # Stealth anti-detection injection
        try:
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception:
            pass

        try:
            logger.info(f"[Indeed Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(3000)

            # Check if blocked by Cloudflare Turnstile
            page_title = page.title() or ""
            if "blocked" in page_title.lower() or "just a moment" in page_title.lower():
                logger.info("[Indeed Applier] Waiting for Cloudflare verification to resolve...")
                page.wait_for_timeout(5000)
                page_title = page.title() or ""
                if "blocked" in page_title.lower():
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

            # Check if this is an external company portal or Easy Apply
            external_btn = None
            try:
                external_btn = page.query_selector(
                    "a:has-text('Apply on company site'), button:has-text('Apply on company site'), a[href*='applyUrl']"
                )
            except Exception:
                pass

            apply_btn = None
            try:
                apply_btn = page.query_selector(
                    "button#indeedApplyButton, button:has-text('Apply now'), button:has-text('Easily apply'), [data-gnav-element='indeedApplyButton']"
                )
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
                try:
                    apply_btn = page.query_selector("button[class*='apply'], a[class*='apply']")
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
                    "message": "Direct Easy Apply button not present on listing. External application link available.",
                    "portal_url": url,
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Click Apply button
            apply_btn.click()
            page.wait_for_timeout(3000)

            # Check for iframe modal (Indeed uses smartapply iframe or modal dialog)
            frame = None
            for f in page.frames:
                if "smartapply" in f.url or "indeed" in f.url:
                    frame = f
                    break
            target = frame if frame else page

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
                        if screenshot_file:
                            page.screenshot(path=str(screenshot_file))
                        return {
                            "success": True,
                            "message": "Application successfully submitted via Indeed Easy Apply!",
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
                browser.close()
            except Exception:
                pass
