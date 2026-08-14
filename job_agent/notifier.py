"""Send iMessages via macOS AppleScript."""
import subprocess
import logging
import time

logger = logging.getLogger(__name__)


def send_imessage(recipient: str, message: str) -> bool:
    """
    Send an iMessage to `recipient` (phone number or Apple ID email).
    Returns True on success, False on failure.
    Requires Messages.app to be running and the Mac to be logged in to iMessage.
    """
    if not recipient:
        logger.error("No recipient configured. Cannot send iMessage.")
        return False

    # Escape backslashes first, then double-quotes for AppleScript string literal
    escaped = message.replace("\\", "\\\\").replace('"', '\\"')

    script = f"""
    tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "{recipient}" of targetService
        send "{escaped}" to targetBuddy
    end tell
    """

    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            logger.error(f"AppleScript error (rc={result.returncode}): {result.stderr.strip()}")
            return False
        logger.debug(f"iMessage sent to {recipient}")
        return True
    except subprocess.TimeoutExpired:
        logger.error("Timed out waiting for AppleScript to complete.")
        return False
    except Exception as exc:
        logger.error(f"Unexpected error sending iMessage: {exc}")
        return False


def format_job_alert(job: dict) -> str:
    """Format a single job dict into a readable iMessage string."""
    return (
        f"\U0001f195 New Job Alert!\n\n"
        f"\U0001f4cb {job['title']}\n"
        f"\U0001f3e2 {job['company']}\n"
        f"\U0001f310 {job['source']}\n"
        f"\U0001f517 {job['url']}"
    )


def format_digest(jobs: list) -> str:
    """Format a multi-job digest message when >5 new jobs are found."""
    lines = [f"\U0001f195 {len(jobs)} new jobs found!\n"]
    for job in jobs[:10]:
        lines.append(f"\u2022 {job['title']} @ {job['company']} ({job['source']})")
    if len(jobs) > 10:
        lines.append(f"...and {len(jobs) - 10} more.")
    return "\n".join(lines)


def send_job_alerts(recipient: str, jobs: list) -> None:
    """Send one individual iMessage per new job found.

    Each job gets its own message so they appear as actionable notifications
    on your iPhone.  A 1.5 s delay is added between sends to avoid rate-
    limiting by Messages.app.  If more than 30 jobs are found in a single
    run you likely need narrower keywords; a closing summary note is appended.
    """
    if not jobs:
        return

    cap = 30
    to_send = jobs[:cap]

    for job in to_send:
        send_imessage(recipient, format_job_alert(job))
        time.sleep(1.5)

    if len(jobs) > cap:
        send_imessage(
            recipient,
            f"\u2139\ufe0f {len(jobs) - cap} more jobs were found but not listed.\n"
            "Tip: use /add and /remove to narrow your keywords."
        )
