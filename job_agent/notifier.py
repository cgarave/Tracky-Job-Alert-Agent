"""Send iMessages via macOS AppleScript with 10-job bubble batching and multi-recipient broadcast support."""
import logging
import subprocess
import time
from typing import Union

logger = logging.getLogger(__name__)

NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]


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
        for chunk in raw.replace(";", ",").replace("\n", ",").split(","):
            cleaned = chunk.strip()
            if cleaned:
                items.append(cleaned)

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
            timeout=20,
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


def format_batch_message(
    chunk: list[dict],
    batch_idx: int,
    total_batches: int,
    total_found: int,
    start_index: int = 1,
) -> str:
    """
    Format up to 10 jobs cleanly into a single iMessage text bubble with structured metadata and dividers.
    """
    header = f"🐶 Tracky · Batch {batch_idx}/{total_batches} ({len(chunk)} Listings)"
    lines = [
        header,
        "═══════════════════════",
        "",
    ]

    for idx, job in enumerate(chunk):
        num_label = NUMBER_EMOJIS[idx] if idx < len(NUMBER_EMOJIS) else f"#{start_index + idx}"
        title = job.get("title", "Unknown Title").strip()
        company = job.get("company", "Unknown Company").strip()
        source = job.get("source", "Job Board").strip()
        location = job.get("location", "").strip()
        salary = job.get("salary", "").strip()
        url = job.get("url", "").strip()

        item_block = [
            f"{num_label} {title}",
            f"🏢 {company} · 🌐 {source}",
        ]

        meta_parts = []
        if location:
            meta_parts.append(f"📍 {location}")
        if salary and salary.lower() != "negotiable":
            meta_parts.append(f"💰 {salary}")
        if meta_parts:
            item_block.append(" · ".join(meta_parts))

        if url:
            item_block.append(f"🔗 {url}")

        lines.extend(item_block)
        if idx < len(chunk) - 1:
            lines.append("")
            lines.append("───────────────────────")
            lines.append("")

    lines.append("")
    lines.append("═══════════════════════")
    end_index = start_index + len(chunk) - 1
    lines.append(f"📱 Showing {start_index}–{end_index} of {total_found} fresh jobs")

    return "\n".join(lines)


def send_broadcast(recipients: Union[str, list[str]], message: str) -> None:
    """Broadcast a single message to all configured recipients."""
    targets = parse_recipients(recipients)
    for target in targets:
        send_imessage(target, message)
        time.sleep(1.0)


def send_job_alerts(recipients: Union[str, list[str]], jobs: list) -> list[str]:
    """
    Broadcast job alerts grouped into 10-job message bubbles (capped at 30 jobs maximum per scan).
    Returns list of alerted job IDs.
    """
    if not jobs:
        return []

    targets = parse_recipients(recipients)
    if not targets:
        logger.warning("No valid recipients configured. Skipping alert delivery.")
        return []

    # Cap at 30 jobs per scan (up to 3 message bubbles of 10)
    cap = 30
    to_send = jobs[:cap]
    chunk_size = 10
    chunks = [to_send[i:i + chunk_size] for i in range(0, len(to_send), chunk_size)]
    total_batches = len(chunks)

    logger.info(
        f"Broadcasting {len(to_send)} job alert(s) in {total_batches} bubble(s) of 10 to {len(targets)} recipient(s): {', '.join(targets)}"
    )

    for target in targets:
        start_idx = 1
        for batch_idx, chunk in enumerate(chunks, start=1):
            batch_msg = format_batch_message(
                chunk=chunk,
                batch_idx=batch_idx,
                total_batches=total_batches,
                total_found=len(jobs),
                start_index=start_idx,
            )
            send_imessage(target, batch_msg)
            start_idx += len(chunk)
            time.sleep(2.0)  # Safe delay between bubble deliveries

        if len(jobs) > cap:
            summary_msg = (
                f"ℹ️ {len(jobs) - cap} more jobs were discovered in this scan beyond the 30-job alert limit.\n\n"
                "🖥️ Open the Tracky Dashboard to view and search all listings:\n"
                "http://127.0.0.1:5050"
            )
            send_imessage(target, summary_msg)
            time.sleep(1.0)

    return [j["job_id"] for j in to_send if "job_id" in j]
