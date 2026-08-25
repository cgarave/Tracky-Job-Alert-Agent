"""
JobStreet.ph Quick Apply Automator using Playwright.
Strictly uploads user's authentic PDF resume and completes Quick Apply.
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
    Automate JobStreet Quick Apply process.
    Returns dict: {success: bool, message: str, screenshot: Optional[str], external: bool}
    """
    from playwright.sync_api import sync_playwright

    personal = profile_data.get("personal", {})
    work = profile_data.get("work_preferences", {})

    first_name = personal.get("first_name", "")
    last_name = personal.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip()
    email = personal.get("email", "")
    phone = personal.get("phone", "")

    screenshot_file = None
    if screenshot_dir:
        ts = int(time.time())
        screenshot_file = screenshot_dir / f"jobstreet_{ts}.png"

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
            logger.info(f"[JobStreet Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)

            # Find Apply button
            apply_btn = page.query_selector(
                "[data-automation='job-detail-apply'], button:has-text('Apply'), a:has-text('Apply now')"
            )

            if not apply_btn:
                return {
                    "success": False,
                    "external": False,
                    "message": "Could not find JobStreet Apply button.",
                }

            # Check if button links to an external site directly
            href = apply_btn.get_attribute("href")
            if href and ("jobstreet.com" not in href and href.startswith("http")):
                return {
                    "success": False,
                    "external": True,
                    "message": "Job redirects to external employer website.",
                    "portal_url": href,
                }

            apply_btn.click()
            page.wait_for_timeout(3000)

            # Handle Resume Upload (Strictly user's authentic PDF)
            file_input = page.query_selector("input[type='file']")
            if file_input and resume_path.exists():
                try:
                    file_input.set_input_files(str(resume_path))
                    logger.info(f"Attached authentic PDF resume: {resume_path.name}")
                    page.wait_for_timeout(2000)
                except Exception as e:
                    logger.warning(f"Could not set file input: {e}")

            # Fill phone or email if blank
            phone_input = page.query_selector("input[name*='phone'], input[id*='phone']")
            if phone_input and phone:
                try:
                    if not phone_input.input_value():
                        phone_input.fill(phone)
                except Exception:
                    pass

            # Check submit button
            submit_btn = page.query_selector(
                "button[data-automation='apply-submit'], button:has-text('Submit application'), button:has-text('Submit')"
            )

            if submit_btn:
                if mode == "assisted_review":
                    if screenshot_file:
                        page.screenshot(path=str(screenshot_file))
                    return {
                        "success": True,
                        "ready_to_submit": True,
                        "message": "Application pre-filled and ready for review.",
                        "screenshot": str(screenshot_file),
                    }

                submit_btn.click()
                page.wait_for_timeout(4000)
                if screenshot_file:
                    page.screenshot(path=str(screenshot_file))
                return {
                    "success": True,
                    "message": "Application submitted via JobStreet Quick Apply!",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            if screenshot_file:
                page.screenshot(path=str(screenshot_file))

            return {
                "success": True,
                "message": "Navigated JobStreet application.",
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
            browser.close()
