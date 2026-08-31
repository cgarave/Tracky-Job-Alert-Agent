"""Send iMessages via macOS AppleScript with multi-recipient broadcast support."""
import logging
import subprocess
import time
from typing import Union

logger = logging.getLogger(__name__)


def parse_recipients(raw: Union[str, list[str], None]) -> list[str]:
    """
    Parse a recipient string (comma or newline separated) or list of recipients.
    Returns a deduplicated list of cleaned recipient addresses.
    """
    if not raw:
        return []

    items: list[str] = []
    if isinstance(raw, list):
        items = [str(x).strip() for x in raw if str(x).strip()]
    elif isinstance(raw, str):
        # Split by comma or semicolon or newline
        for chunk in raw.replace(";", ",").replace("\n", ",").split(","):
            cleaned = chunk.strip()
            if cleaned:
                items.append(cleaned)

    # Deduplicate while preserving order
    seen = set()
    result = []
    for item in items:
        if item.lower() not in seen:
            seen.add(item.lower())
            result.append(item)
    return result


def send_imessage(recipient: str, message: str) -> bool:
    """
    Send an iMessage to `recipient` (phone number or Apple ID email).
    Returns True on success, False on failure.
    Requires Messages.app to be running and the Mac to be logged in to iMessage.
    """
    if not recipient:
        logger.error("No recipient specified. Cannot send iMessage.")
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
            logger.error(f"AppleScript error for {recipient} (rc={result.returncode}): {result.stderr.strip()}")
            return False
        logger.debug(f"iMessage sent to {recipient}")
        return True
    except subprocess.TimeoutExpired:
        logger.error(f"Timed out waiting for AppleScript to send to {recipient}.")
        return False
    except Exception as exc:
        logger.error(f"Unexpected error sending iMessage to {recipient}: {exc}")
        return False


def format_job_alert(job: dict) -> str:
    """Format a single job dict into a readable actionable iMessage string."""
    title = job.get("title", "Unknown Title").strip()
    company = job.get("company", "Unknown Company").strip()
    source = job.get("source", "Job Board").strip()
    location = job.get("location", "").strip()
    salary = job.get("salary", "").strip()
    url = job.get("url", "").strip()

    lines = [
        "🐶 Tracky · New Job Alert!",
        "",
        f"📋 {title}",
        f"🏢 {company}",
        f"🌐 {source}",
    ]
    if location:
        lines.append(f"📍 {location}")
    if salary and salary.lower() != "negotiable":
        lines.append(f"💰 {salary}")
    lines.append(f"🔗 {url}")

    return "\n".join(lines)


def format_digest(jobs: list) -> str:
    """Format a multi-job digest message when many new jobs are found."""
    lines = [f"🐶 Tracky · {len(jobs)} new jobs discovered!\n"]
    for job in jobs[:10]:
        lines.append(f"• {job.get('title', 'Role')} @ {job.get('company', 'Company')} ({job.get('source', '')})")
    if len(jobs) > 10:
        lines.append(f"...and {len(jobs) - 10} more.")
    return "\n".join(lines)


def send_broadcast(recipients: Union[str, list[str]], message: str) -> None:
    """Broadcast a single message to all configured recipients."""
    targets = parse_recipients(recipients)
    for target in targets:
        send_imessage(target, message)
        time.sleep(1.0)


def send_job_alerts(recipients: Union[str, list[str]], jobs: list) -> None:
    """
    Broadcast job alerts to all verified recipients.
    Each job gets its own formatted message.
    """
    if not jobs:
        return

    targets = parse_recipients(recipients)
    if not targets:
        logger.warning("No valid recipients configured. Skipping alert delivery.")
        return

    cap = 25
    to_send = jobs[:cap]

    logger.info(f"Broadcasting {len(to_send)} job alert(s) to {len(targets)} recipient(s): {', '.join(targets)}")

    for target in targets:
        for job in to_send:
            send_imessage(target, format_job_alert(job))
            time.sleep(1.5)

        if len(jobs) > cap:
            send_imessage(
                target,
                f"ℹ️ {len(jobs) - cap} more jobs were discovered in this scan.\n"
                "Tip: Log in to the Tracky Dashboard to view the full listings feed."
            )
            time.sleep(1.0)
