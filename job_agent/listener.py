"""Poll ~/Library/Messages/chat.db for incoming iMessage commands.

Design notes
------------
* We scan ALL recent messages that start with '/' rather than filtering by
  a specific handle.  This is because when a user texts their own number on
  iMessage, macOS may store the message as is_from_me=1 (self-sent) rather
  than is_from_me=0 (received), making a simple sender-filter unreliable.
* Messages are deduplicated by their ROWID so we never process the same
  message twice, even across repeated polls.
* Full Disk Access must be granted to Terminal (or the running process) in
  System Settings → Privacy & Security → Full Disk Access.
"""
import logging
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

CHAT_DB = Path.home() / "Library" / "Messages" / "chat.db"

# Apple's CoreData epoch starts at 2001-01-01 00:00:00 UTC.
# This offset converts it to/from Unix time.
MAC_EPOCH_OFFSET = 978_307_200

# In-process cache of already-processed message ROWIDs.
# Persists for the lifetime of the daemon (reset on restart, which is fine
# because we also use the timestamp window to avoid re-processing old messages).
_seen_rowids: set[int] = set()


# ---------------------------------------------------------------------------
# Epoch helpers
# ---------------------------------------------------------------------------

def _mac_ts_to_unix(mac_ts: int) -> float:
    """Convert Mac Absolute Time (nanoseconds since 2001-01-01) → Unix float."""
    return mac_ts / 1_000_000_000 + MAC_EPOCH_OFFSET


def _unix_to_mac_ts(unix_ts: float) -> int:
    """Convert Unix timestamp → Mac Absolute Time nanoseconds."""
    return int((unix_ts - MAC_EPOCH_OFFSET) * 1_000_000_000)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_messages_since(recipient: str, since_unix: float) -> list[dict]:
    """
    Return all unprocessed messages that look like commands (start with '/')
    and were stored in chat.db after `since_unix` (Unix timestamp).

    We intentionally do NOT filter by sender/handle because:
      • Texting yourself on iMessage stores the message as is_from_me=1.
      • The handle.id format (+63…, 09…, Apple ID email) may not match the
        exact string stored in config.json.

    Instead we grab every recent '/' message, deduplicate by ROWID, and
    let the command layer ignore anything that isn't a known command.

    Args:
        recipient:   Stored for future use / logging; not used for DB filtering.
        since_unix:  Only return messages stored after this Unix timestamp.

    Returns:
        List of dicts: {text: str, timestamp: float, rowid: int}
    """
    global _seen_rowids

    if not CHAT_DB.exists():
        logger.error(
            f"chat.db not found at {CHAT_DB}. "
            "Is Messages.app set up on this Mac?"
        )
        return []

    mac_since = _unix_to_mac_ts(since_unix)

    try:
        conn = sqlite3.connect(
            f"file:{CHAT_DB}?mode=ro", uri=True, timeout=5
        )
        cursor = conn.cursor()

        # Grab any recent message that begins with '/' from ANY sender/direction.
        # is_from_me is included in the SELECT for debug logging only.
        cursor.execute(
            """
            SELECT m.ROWID, m.text, m.date, m.is_from_me
            FROM   message m
            WHERE  m.date        >  ?
              AND  m.text        IS NOT NULL
              AND  m.text        != ''
              AND  m.text        LIKE '/%'
              AND  LENGTH(m.text) > 1
            ORDER  BY m.date ASC
            """,
            (mac_since,),
        )
        rows = cursor.fetchall()
        conn.close()

    except sqlite3.OperationalError as exc:
        err = str(exc).lower()
        if "unable to open" in err or "authorization" in err or "permission" in err:
            logger.error(
                "Cannot read chat.db — Full Disk Access not granted. "
                "System Settings → Privacy & Security → Full Disk Access → enable Terminal."
            )
        else:
            logger.error(f"chat.db read error: {exc}")
        return []
    except Exception as exc:
        logger.error(f"Unexpected listener error: {exc}")
        return []

    new_messages: list[dict] = []
    for rowid, text, mac_date, is_from_me in rows:
        if rowid in _seen_rowids:
            continue
        _seen_rowids.add(rowid)
        unix_ts = _mac_ts_to_unix(mac_date)
        direction = "sent" if is_from_me else "received"
        logger.debug(f"Command candidate [{direction}] ROWID={rowid}: {text!r}")
        new_messages.append(
            {"rowid": rowid, "text": text.strip(), "timestamp": unix_ts}
        )

    if new_messages:
        logger.info(f"Listener: {len(new_messages)} new command(s) detected.")

    return new_messages
