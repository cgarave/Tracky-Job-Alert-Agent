"""
Send alerts via macOS iMessage (AppleScript) and Telegram Bot API.
Supports 10-job batching, per-recipient keyword filtering, and multi-channel dispatch.
Telegram alerts strictly adhere to zero-emoji formatting.
"""
import html
import json
import logging
import subprocess
import time
import urllib.parse
from typing import Optional, Union
import requests
import urllib3

# Suppress insecure request warnings if fallback SSL context is needed
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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


# ---------------------------------------------------------------------------
# iMessage Delivery (macOS AppleScript)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Telegram Bot API Delivery (Zero Emojis, Clean HTML)
# ---------------------------------------------------------------------------

def send_telegram_message(
    bot_token: str,
    chat_id: str,
    text: str,
    parse_mode: str = "HTML",
    inline_buttons: Optional[list] = None,
) -> tuple[bool, str]:
    """
    Send a message via Telegram Bot API with HTML formatting and optional inline keyboard buttons.
    Strictly zero emojis.
    Returns (success: bool, detail_message: str).
    """
    if not bot_token or not chat_id:
        logger.error("Telegram bot token and chat ID are required.")
        return False, "Telegram bot token and chat ID are required."

    url = f"https://api.telegram.org/bot{bot_token.strip()}/sendMessage"
    payload = {
        "chat_id": chat_id.strip(),
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    if inline_buttons:
        payload["reply_markup"] = {"inline_keyboard": inline_buttons}

    resp = None
    try:
        resp = requests.post(url, json=payload, timeout=15)
    except (requests.exceptions.SSLError, requests.exceptions.ConnectionError):
        # Fallback to unverified SSL if system certificate chain fails on macOS
        try:
            resp = requests.post(url, json=payload, timeout=15, verify=False)
        except Exception as exc:
            logger.error(f"Telegram network connection error for {chat_id}: {exc}")
            return False, f"Network error connecting to Telegram API: {exc}"
    except Exception as exc:
        logger.error(f"Unexpected error sending Telegram message to {chat_id}: {exc}")
        return False, f"Connection error: {exc}"

    if resp is None:
        return False, "No response from Telegram API."

    try:
        body = resp.json()
    except Exception:
        body = {}

    if resp.status_code == 200 and body.get("ok"):
        logger.debug(f"Telegram message sent to {chat_id}")
        return True, "Message delivered successfully."
    else:
        err_desc = body.get("description") or resp.text or f"HTTP {resp.status_code}"
        logger.error(f"Telegram API error {resp.status_code} for {chat_id}: {err_desc}")
        return False, f"Telegram API error ({resp.status_code}): {err_desc}"


def format_telegram_batch(
    chunk: list[dict],
    batch_idx: int,
    total_batches: int,
    total_found: int,
    start_index: int = 1,
) -> tuple[str, list]:
    """
    Format up to 10 jobs cleanly for Telegram in HTML mode with ZERO emojis.
    Returns (html_text, inline_keyboard_rows).
    """
    header = f"<b>TRACKY JOB ALERT · BATCH {batch_idx}/{total_batches} ({len(chunk)} LISTINGS)</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    blocks = [header]
    inline_buttons = []

    for idx, job in enumerate(chunk):
        item_num = start_index + idx
        raw_title = job.get("title", "Unknown Title").strip()
        raw_company = job.get("company", "Unknown Company").strip()
        raw_source = job.get("source", "Job Board").strip()
        raw_location = job.get("location", "").strip()
        raw_salary = job.get("salary", "").strip()
        url = job.get("url", "").strip()

        title = html.escape(raw_title, quote=False)
        company = html.escape(raw_company, quote=False)
        source = html.escape(raw_source, quote=False)
        location = html.escape(raw_location, quote=False)
        salary = html.escape(raw_salary, quote=False)

        job_lines = [
            f"<b>{item_num}. {title}</b>",
            f"Company: {company} | Source: {source}",
        ]

        meta_parts = []
        if location:
            meta_parts.append(f"Location: {location}")
        if salary and salary.lower() != "negotiable":
            meta_parts.append(f"Salary: {salary}")
        if meta_parts:
            job_lines.append(" | ".join(meta_parts))

        if url:
            job_lines.append(f'Link: <a href="{url}">View Listing</a>')
            # Add inline button (up to 2 per row if desired)
            short_company = raw_company[:18] + ("..." if len(raw_company) > 18 else "")
            inline_buttons.append([
                {"text": f"#{item_num} {short_company}", "url": url}
            ])

        blocks.append("\n".join(job_lines))

    end_index = start_index + len(chunk) - 1
    footer = f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nShowing {start_index}–{end_index} of {total_found} fresh listings"
    blocks.append(footer)

    return "\n\n".join(blocks), inline_buttons


# ---------------------------------------------------------------------------
# Keyword Matching & Per-Recipient Dispatch
# ---------------------------------------------------------------------------

def matches_recipient_keywords(job: dict, recipient_keywords: list[str]) -> bool:
    """
    Check if a job listing matches a recipient's specific keywords.
    If recipient_keywords is empty, matches ALL jobs.
    Otherwise, matches if any keyword is a substring in title, company, or description.
    """
    if not recipient_keywords:
        return True

    title = job.get("title", "").lower()
    company = job.get("company", "").lower()
    description = job.get("description", "").lower()

    for kw in recipient_keywords:
        cleaned_kw = kw.strip().lower()
        if not cleaned_kw:
            continue
        if cleaned_kw in title or cleaned_kw in company or cleaned_kw in description:
            return True

    return False


def send_recipient_alerts(
    recipient_config: dict,
    jobs: list[dict],
    bot_token: str = "",
) -> list[str]:
    """
    Send matching job alerts to a specific recipient (iMessage or Telegram).
    Capped at 30 jobs maximum per scan.
    Returns list of job IDs sent.
    """
    if not recipient_config.get("enabled", True):
        return []

    platform = recipient_config.get("platform", "imessage").lower().strip()
    destination = recipient_config.get("destination", "").strip()
    keywords = recipient_config.get("keywords", [])

    if not destination:
        logger.warning(f"Recipient '{recipient_config.get('name', 'Unknown')}' has no destination configured.")
        return []

    # Filter jobs matching this recipient's keywords
    matching_jobs = [j for j in jobs if matches_recipient_keywords(j, keywords)]
    if not matching_jobs:
        return []

    cap = 30
    to_send = matching_jobs[:cap]
    chunk_size = 10
    chunks = [to_send[i:i + chunk_size] for i in range(0, len(to_send), chunk_size)]
    total_batches = len(chunks)

    recipient_name = recipient_config.get("name", destination)
    logger.info(
        f"Dispatching {len(to_send)} alert(s) across {total_batches} batch(es) to '{recipient_name}' via {platform.upper()}"
    )

    sent_ids: list[str] = []

    if platform == "telegram":
        if not bot_token:
            logger.error(f"Cannot deliver to Telegram recipient '{recipient_name}': Bot token is not configured.")
            return []

        start_idx = 1
        for batch_idx, chunk in enumerate(chunks, start=1):
            text, inline_btns = format_telegram_batch(
                chunk=chunk,
                batch_idx=batch_idx,
                total_batches=total_batches,
                total_found=len(matching_jobs),
                start_index=start_idx,
            )
            success, detail = send_telegram_message(
                bot_token=bot_token,
                chat_id=destination,
                text=text,
                inline_buttons=inline_btns,
            )
            if success:
                sent_ids.extend([j["job_id"] for j in chunk if "job_id" in j])
            else:
                logger.error(f"Failed delivering Telegram batch to '{recipient_name}': {detail}")
            start_idx += len(chunk)
            time.sleep(1.5)

        if len(matching_jobs) > cap:
            summary = (
                f"Notice: {len(matching_jobs) - cap} additional jobs were discovered beyond the 30-job limit.\n\n"
                f"Open the Tracky Dashboard to view all listings:\nhttp://127.0.0.1:5050"
            )
            send_telegram_message(bot_token=bot_token, chat_id=destination, text=summary)

    else:  # iMessage
        start_idx = 1
        for batch_idx, chunk in enumerate(chunks, start=1):
            batch_msg = format_batch_message(
                chunk=chunk,
                batch_idx=batch_idx,
                total_batches=total_batches,
                total_found=len(matching_jobs),
                start_index=start_idx,
            )
            success = send_imessage(destination, batch_msg)
            if success:
                sent_ids.extend([j["job_id"] for j in chunk if "job_id" in j])
            start_idx += len(chunk)
            time.sleep(2.0)

        if len(matching_jobs) > cap:
            summary_msg = (
                f"ℹ️ {len(matching_jobs) - cap} more jobs were discovered in this scan beyond the 30-job alert limit.\n\n"
                "🖥️ Open the Tracky Dashboard to view and search all listings:\n"
                "http://127.0.0.1:5050"
            )
            send_imessage(destination, summary_msg)

    return sent_ids


def send_test_notification(
    platform: str,
    destination: str,
    bot_token: str = "",
) -> dict:
    """
    Send an immediate test verification notification to iMessage or Telegram.
    Returns {"success": bool, "message": str}.
    """
    platform = platform.lower().strip()
    destination = destination.strip()

    if not destination:
        return {"success": False, "message": "Destination address/chat ID is required."}

    if platform == "telegram":
        if not bot_token:
            return {"success": False, "message": "Telegram Bot Token is required."}

        test_text = (
            "<b>TRACKY NOTIFICATION TEST</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Your Telegram alerts are configured correctly.\n"
            "You will receive real-time job notifications here."
        )
        ok, detail = send_telegram_message(
            bot_token=bot_token,
            chat_id=destination,
            text=test_text,
            inline_buttons=[[{"text": "Open Tracky Dashboard", "url": "http://127.0.0.1:5050"}]],
        )
        if ok:
            return {"success": True, "message": f"Test message successfully delivered to Telegram chat {destination}."}
        else:
            return {
                "success": False,
                "message": detail or f"Failed to send Telegram message to {destination}.",
            }

    elif platform == "imessage":
        test_msg = (
            "🐶 Tracky Notification Test\n"
            "═══════════════════════\n"
            "Your iMessage alerts are configured correctly.\n"
            "You will receive real-time job notifications here."
        )
        ok = send_imessage(destination, test_msg)
        if ok:
            return {"success": True, "message": f"Test iMessage successfully sent to {destination}."}
        else:
            return {
                "success": False,
                "message": f"Failed to send iMessage to {destination}. Make sure Messages.app is open and recipient is valid.",
            }

    else:
        return {"success": False, "message": f"Unsupported platform: {platform}"}


# ---------------------------------------------------------------------------
# Legacy Broadcast Helpers (Backward Compatibility)
# ---------------------------------------------------------------------------

def send_broadcast(recipients: Union[str, list[str]], message: str) -> None:
    """Broadcast a single message to all configured recipients."""
    targets = parse_recipients(recipients)
    for target in targets:
        send_imessage(target, message)
        time.sleep(1.0)


def send_job_alerts(recipients: Union[str, list[str]], jobs: list) -> list[str]:
    """
    Legacy helper: broadcast job alerts grouped into 10-job message bubbles to iMessage recipients.
    Returns list of alerted job IDs.
    """
    if not jobs:
        return []

    targets = parse_recipients(recipients)
    if not targets:
        logger.warning("No valid recipients configured. Skipping alert delivery.")
        return []

    cap = 30
    to_send = jobs[:cap]
    chunk_size = 10
    chunks = [to_send[i:i + chunk_size] for i in range(0, len(to_send), chunk_size)]
    total_batches = len(chunks)

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
            time.sleep(2.0)

        if len(jobs) > cap:
            summary_msg = (
                f"ℹ️ {len(jobs) - cap} more jobs were discovered in this scan beyond the 30-job alert limit.\n\n"
                "🖥️ Open the Tracky Dashboard to view and search all listings:\n"
                "http://127.0.0.1:5050"
            )
            send_imessage(target, summary_msg)
            time.sleep(1.0)

    return [j["job_id"] for j in to_send if "job_id" in j]
