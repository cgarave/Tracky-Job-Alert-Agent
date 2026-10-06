"""Read commands only from authorized one-to-one iMessage conversations."""
import logging
import re
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)
CHAT_DB = Path.home() / 'Library' / 'Messages' / 'chat.db'
MAC_EPOCH_OFFSET = 978307200
_seen_rowids = set()


def _unix_to_mac_ts(value):
    return int((value - MAC_EPOCH_OFFSET) * 1_000_000_000)


def _mac_ts_to_unix(value):
    return value / 1_000_000_000 + MAC_EPOCH_OFFSET


def normalize_address(value):
    value = value.strip().lower()
    if '@' in value:
        return value
    digits = re.sub(r'\D', '', value)
    if len(digits) == 11 and digits.startswith('09'):
        digits = '63' + digits[1:]
    return digits


def get_messages_since(recipients, since_unix):
    if isinstance(recipients, str):
        recipients = [recipients]
    authorized = {normalize_address(r): r for r in recipients if r.strip()}
    if not authorized or not CHAT_DB.exists():
        return []
    try:
        with sqlite3.connect(f'file:{CHAT_DB}?mode=ro', uri=True, timeout=5) as conn:
            rows = conn.execute('''
                SELECT m.ROWID, m.text, m.date, m.is_from_me, h.id, cm.chat_id
                FROM message m
                LEFT JOIN handle h ON h.ROWID=m.handle_id
                JOIN chat_message_join cm ON cm.message_id=m.ROWID
                WHERE m.date>? AND m.text LIKE '/%' AND LENGTH(m.text)>1
                ORDER BY m.date, m.ROWID
            ''', (_unix_to_mac_ts(since_unix),)).fetchall()
            messages = []
            for rowid, text, date, from_me, sender, chat_id in rows:
                if rowid in _seen_rowids:
                    continue
                participants = [normalize_address(r[0]) for r in conn.execute('''
                    SELECT h.id FROM chat_handle_join ch JOIN handle h ON h.ROWID=ch.handle_id
                    WHERE ch.chat_id=?
                ''', (chat_id,))]
                # Exclude groups, even if one participant is authorized.
                if len(participants) != 1 or participants[0] not in authorized:
                    continue
                origin = participants[0] if from_me else normalize_address(sender or '')
                if origin != participants[0] or origin not in authorized:
                    continue
                _seen_rowids.add(rowid)
                messages.append({'rowid': rowid, 'text': text.strip(),
                                 'timestamp': _mac_ts_to_unix(date), 'reply_to': authorized[origin]})
            return messages
    except sqlite3.Error:
        logger.warning('Cannot read authorized Messages conversations; check Full Disk Access and Messages schema')
        return []
