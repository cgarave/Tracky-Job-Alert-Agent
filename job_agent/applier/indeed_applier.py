"""
Indeed.ph Easy Apply Automator using Playwright.
Strictly uploads user's authentic PDF resume and answers screening questions.
"""
import logging
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
        browser = pw.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )

        context_kwargs = {"user_agent": USER_AGENT}
        if session_path and session_path.exists():
            try:
                context_kwargs["storage_state"] = str(session_path)
            except Exception as e:
                logger.warning(f"Could not load session state: {e}")

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        try:
            logger.info(f"[Indeed Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2000)

            # Check if this is an external company redirect or Easy Apply
            external_btn = page.query_selector(
                "a:has-text('Apply on company site'), button:has-text('Apply on company site')"
            )
            apply_btn = page.query_selector(
                "button#indeedApplyButton, button:has-text('Apply now'), button:has-text('Easily apply'), [data-gnav-element='indeedApplyButton']"
            )

            if not apply_btn and external_btn:
                ext_url = external_btn.get_attribute("href") or url
                return {
                    "success": False,
                    "external": True,
                    "message": "Job requires application on external company portal.",
                    "portal_url": ext_url,
                }

            if not apply_btn:
                # Try finding any primary apply button
                apply_btn = page.query_selector("button[class*='apply'], a[class*='apply']")

            if not apply_btn:
                return {
                    "success": False,
                    "external": False,
                    "message": "Could not find 'Apply now' or 'Easily apply' button on this listing.",
                }

            # Click Apply
            apply_btn.click()
            page.wait_for_timeout(3000)

            # Check for iframe modal (Indeed uses iframe or new container)
            frame = None
            for f in page.frames:
                if "smartapply" in f.url or "indeed" in f.url:
                    frame = f
                    break
            target = frame if frame else page

            # Navigate through the multi-step application form (up to 10 steps)
            max_steps = 10
            for step in range(max_steps):
                time.sleep(1.5)

                # 1. Fill Text Inputs (Name, Email, Phone, Salary, Experience)
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

                # 2. Handle Resume Upload (Strictly user's uploaded authentic PDF)
                file_input = target.query_selector("input[type='file']")
                if file_input and resume_path.exists():
                    try:
                        file_input.set_input_files(str(resume_path))
                        logger.info(f"Uploaded authentic resume PDF: {resume_path.name}")
                        page.wait_for_timeout(2000)
                    except Exception as e:
                        logger.warning(f"Resume upload field error: {e}")

                # 3. Check for Radio Buttons / Checkboxes (e.g. Yes/No questions)
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

                # 4. Check for Final Submit Button vs Continue Button
                submit_btn = target.query_selector(
                    "button:has-text('Submit your application'), button:has-text('Submit application'), button:has-text('Submit')"
                )
                if submit_btn:
                    if mode == "assisted_review":
                        # In assisted review, we stop before final submit
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

            if screenshot_file:
                page.screenshot(path=str(screenshot_file))

            return {
                "success": True,
                "message": "Completed application steps on Indeed.",
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
                "message": f"Error applying on Indeed: {str(exc)}",
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }
        finally:
            browser.close()
