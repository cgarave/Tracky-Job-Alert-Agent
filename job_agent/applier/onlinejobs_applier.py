"""
OnlineJobs.ph Direct Application / Message Automator using Playwright.
Submits employer pitch using authentic user profile context only when verified session is present.
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
    custom_pitch: str = "",
) -> dict:
    """
    Automate OnlineJobs.ph application messaging.
    Strictly verifies that an authenticated session is active and that submission was confirmed.
    Returns dict: {success: bool, message: str, screenshot: Optional[str], external: bool}
    """
    from playwright.sync_api import sync_playwright

    # 1. Require session file
    if not session_path or not session_path.exists():
        return {
            "success": False,
            "external": False,
            "requires_session": True,
            "message": "OnlineJobs.ph account is not connected. Please connect your account under 'Platform Accounts' first.",
        }

    personal = profile_data.get("personal", {})
    work = profile_data.get("work_preferences", {})
    qa = profile_data.get("screening_answers", {})

    first_name = personal.get("first_name", "")
    last_name = personal.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or "Applicant"
    email = personal.get("email", "")
    headline = personal.get("headline", "Software Engineer")
    skills = ", ".join(work.get("skills", []))

    # Draft pitch
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
        browser = browser_manager.launch_browser(
            pw,
            headless=headless,
        )

        context_kwargs = {
            "user_agent": USER_AGENT,
            "viewport": {"width": 1280, "height": 800},
            "storage_state": str(session_path),
        }

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        try:
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception:
            pass

        try:
            logger.info(f"[OnlineJobs Applier] Navigating to {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)

            # Check if user is logged in
            login_prompt = page.query_selector("a:has-text('Login to Apply'), a:has-text('Sign In to Apply')")
            if login_prompt:
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": False,
                    "requires_session": True,
                    "message": "OnlineJobs.ph session is expired or not authenticated. Please re-connect your account in Platform Accounts tab.",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Find Apply button if on job overview
            apply_btn = page.query_selector(
                "a:has-text('Apply to this Job'), button:has-text('Apply to this Job'), button:has-text('Apply for this Job'), a[href*='apply']"
            )
            if apply_btn:
                apply_btn.click()
                page.wait_for_timeout(2000)

            # Find message textarea
            message_box = page.query_selector(
                "textarea[name*='message'], textarea[name*='cover_letter'], textarea[id*='message'], textarea"
            )
            if not message_box:
                # Check if already applied
                already_applied = page.query_selector(":has-text('You have already applied'), :has-text('Applied on')")
                if already_applied:
                    if screenshot_file:
                        try:
                            page.screenshot(path=str(screenshot_file))
                        except Exception:
                            pass
                    return {
                        "success": True,
                        "message": "You have already applied to this OnlineJobs.ph listing.",
                        "screenshot": str(screenshot_file) if screenshot_file else None,
                    }

                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": False,
                    "message": "Could not find application message box on OnlineJobs.ph listing.",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            # Fill message textarea
            message_box.fill(pitch)
            logger.info("Filled application pitch on OnlineJobs.ph")

            # Check subject field if available
            subject_box = page.query_selector("input[name*='subject'], input[id*='subject']")
            if subject_box and not subject_box.input_value():
                subject_box.fill(f"Application: {headline} - {full_name}")

            # Check for submit button
            send_btn = page.query_selector(
                "button:has-text('Send Application'), input[type='submit'][value*='Send'], button:has-text('Submit'), button:has-text('Apply')"
            )

            if not send_btn:
                if screenshot_file:
                    try:
                        page.screenshot(path=str(screenshot_file))
                    except Exception:
                        pass
                return {
                    "success": False,
                    "external": False,
                    "message": "Could not locate 'Send Application' button on OnlineJobs.ph.",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }

            if mode == "assisted_review":
                if screenshot_file:
                    page.screenshot(path=str(screenshot_file))
                return {
                    "success": True,
                    "ready_to_submit": True,
                    "message": "OnlineJobs pitch prepared for review.",
                    "screenshot": str(screenshot_file),
                }

            # Submit the form
            send_btn.click()
            page.wait_for_timeout(4000)

            # Strictly verify post-submission confirmation
            page_text = page.inner_text("body").lower() if page.query_selector("body") else ""
            confirmed = any(
                phrase in page_text
                for phrase in [
                    "sent successfully",
                    "your message has been sent",
                    "application sent",
                    "applied successfully",
                    "you have already applied",
                    "success",
                ]
            )

            if screenshot_file:
                try:
                    page.screenshot(path=str(screenshot_file))
                except Exception:
                    pass

            if confirmed:
                return {
                    "success": True,
                    "message": "Application message sent successfully on OnlineJobs.ph!",
                    "screenshot": str(screenshot_file) if screenshot_file else None,
                }
            else:
                return {
                    "success": False,
                    "message": "Form was submitted but OnlineJobs confirmation message could not be verified.",
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
            try:
                browser.close()
            except Exception:
                pass
