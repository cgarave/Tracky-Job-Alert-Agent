"""
OnlineJobs.ph Direct Application / Message Automator using Playwright.
Submits employer pitch using authentic user profile context.
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
    custom_pitch: str = "",
) -> dict:
    """
    Automate OnlineJobs.ph application messaging.
    Returns dict: {success: bool, message: str, screenshot: Optional[str], external: bool}
    """
    from playwright.sync_api import sync_playwright

    personal = profile_data.get("personal", {})
    work = profile_data.get("work_preferences", {})
    qa = profile_data.get("screening_answers", {})

    full_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Applicant"
    email = personal.get("email", "")
    headline = personal.get("headline", "Software Engineer")
    skills = ", ".join(work.get("skills", []))

    # Draft cover pitch if custom not provided
    pitch = custom_pitch.strip()
    if not pitch:
        pitch = (
            f"Hi,\n\n"
            f"I am writing to express my strong interest in this position. With my background as a {headline} "
            f"and hands-on expertise in {skills}, I am confident in my ability to deliver immediate value to your team.\n\n"
            f"{qa.get('why_hire_me', '')}\n\n"
            f"Best regards,\n"
            f"{full_name}\n"
            f"{email}"
        )

    screenshot_file = None
    if screenshot_dir:
        ts = int(time.time())
        screenshot_file = screenshot_dir / f"onlinejobs_{ts}.png"

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
            logger.info(f"[OnlineJobs Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2000)

            # Check if logged in / apply button exists
            apply_btn = page.query_selector(
                "a:has-text('Apply to this Job'), button:has-text('Apply to this Job'), button:has-text('Apply for this Job'), a[href*='apply']"
            )

            if not apply_btn:
                # Check if login prompt is visible
                login_prompt = page.query_selector("a:has-text('Login to Apply'), a:has-text('Sign In')")
                if login_prompt:
                    return {
                        "success": False,
                        "external": False,
                        "message": "OnlineJobs.ph session expired or not logged in. Please connect your account in the dashboard.",
                    }

            if apply_btn:
                apply_btn.click()
                page.wait_for_timeout(2000)

            # Fill message textarea
            message_box = page.query_selector("textarea[name*='message'], textarea[name*='cover_letter'], textarea[id*='message']")
            if message_box:
                message_box.fill(pitch)
                logger.info("Filled application pitch on OnlineJobs.ph")

            # Check subject field if available
            subject_box = page.query_selector("input[name*='subject'], input[id*='subject']")
            if subject_box and not subject_box.input_value():
                subject_box.fill(f"Application: {headline} - {full_name}")

            # Check for submit button
            send_btn = page.query_selector("button:has-text('Send Application'), input[type='submit'][value*='Send'], button:has-text('Apply')")

            if send_btn:
                if mode == "assisted_review":
                    if screenshot_file:
                        page.screenshot(path=str(screenshot_file))
                    return {
                        "success": True,
                        "ready_to_submit": True,
                        "message": "OnlineJobs pitch prepared for review.",
                        "screenshot": str(screenshot_file),
                    }

                send_btn.click()
                page.wait_for_timeout(3500)
                if screenshot_file:
                    page.screenshot(path=str(screenshot_file))
                return {
                    "success": True,
                    "message": "Application message sent on OnlineJobs.ph!",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            if screenshot_file:
                page.screenshot(path=str(screenshot_file))

            return {
                "success": True,
                "message": "Navigated OnlineJobs application form.",
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }

        except Exception as exc:
            logger.error(f"[OnlineJobs Applier] Error: {exc}")
            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass
            return {
                "success": False,
                "message": f"Error applying on OnlineJobs: {str(exc)}",
                "screenshot": str(screenshot_file) if screenshot_file else None,
            }
        finally:
            browser.close()
