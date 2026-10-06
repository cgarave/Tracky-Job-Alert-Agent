"""SQLite job deduplication, tracking, dismissal, and alert delivery layer."""
import hashlib
import json
import time
import logging
import sqlite3
import re
import urllib.parse
import cv_match
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "seen_jobs.db"


def get_connection() -> sqlite3.Connection:
    """Open (or create) the SQLite database and ensure the schema exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")

    # 1. Base seen_jobs table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_jobs (
            job_id      TEXT PRIMARY KEY,
            title       TEXT,
            company     TEXT,
            url         TEXT,
            source      TEXT,
            location    TEXT DEFAULT '',
            salary      TEXT DEFAULT '',
            apply_type  TEXT DEFAULT 'unknown',
            description TEXT DEFAULT '',
            match_score INTEGER DEFAULT 0,
            seen_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_alerted  INTEGER DEFAULT 0,
            alerted_at  TIMESTAMP
        )
    """)

    # Auto-migration for existing databases
    for col_def in (
        "is_alerted INTEGER DEFAULT 0",
        "alerted_at TIMESTAMP",
        "search_keywords TEXT DEFAULT '[]'",
        "is_saved INTEGER DEFAULT 0",
        "application_status TEXT DEFAULT ''",
        "applied_at TIMESTAMP",
        "cv_score INTEGER",
        "cv_reasons TEXT DEFAULT '{}'",
        "cv_profile_hash TEXT",
    ):
        try:
            conn.execute(f"ALTER TABLE seen_jobs ADD COLUMN {col_def}")
        except sqlite3.OperationalError:
            pass  # Column already exists

    # 2. Dismissed / Ignored jobs table (prevents future re-scraping alerts)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dismissed_jobs (
            job_id       TEXT PRIMARY KEY,
            dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            job_payload  TEXT DEFAULT '{}'
        )
    """)
    try:
        conn.execute("ALTER TABLE dismissed_jobs ADD COLUMN job_payload TEXT DEFAULT '{}'")
    except sqlite3.OperationalError:
        pass

    # 3. Per-recipient alert delivery tracking (multi-channel / multi-recipient)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS job_alerts_sent (
            job_id       TEXT,
            recipient_id TEXT,
            platform     TEXT DEFAULT 'unknown',
            sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (job_id, recipient_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS delivery_queue (
            job_id TEXT NOT NULL, recipient_id TEXT NOT NULL,
            destination TEXT NOT NULL, platform TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt REAL NOT NULL DEFAULT 0, last_error TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (job_id, recipient_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_delivery_due ON delivery_queue(state, next_attempt)")

    # Performance Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_seen_at ON seen_jobs(seen_at DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_source ON seen_jobs(source)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_alerted ON seen_jobs(is_alerted)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_saved ON seen_jobs(is_saved)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_cv_score ON seen_jobs(cv_score DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dismissed_jobs_id ON dismissed_jobs(job_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_sent_rec ON job_alerts_sent(recipient_id)")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS source_health (
            source TEXT PRIMARY KEY,
            last_success_at TIMESTAMP,
            last_failure_at TIMESTAMP,
            last_duration_ms INTEGER,
            last_result_count INTEGER DEFAULT 0,
            last_error_category TEXT,
            last_error TEXT
        )
    """)

    conn.commit()
    return conn


def record_source_health(conn, source: str, *, duration_ms: int, result_count: int,
                         error: str | None = None, error_category: str | None = None) -> None:
    """Persist the latest source outcome for diagnosis across daemon restarts."""
    now = time.strftime('%Y-%m-%d %H:%M:%S')
    if error:
        conn.execute("""INSERT INTO source_health
            (source, last_failure_at, last_duration_ms, last_result_count, last_error_category, last_error)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(source) DO UPDATE SET last_failure_at=excluded.last_failure_at,
              last_duration_ms=excluded.last_duration_ms, last_result_count=excluded.last_result_count,
              last_error_category=excluded.last_error_category, last_error=excluded.last_error""",
                     (source, now, duration_ms, result_count, error_category or 'unknown', error[:500]))
    else:
        conn.execute("""INSERT INTO source_health
            (source, last_success_at, last_duration_ms, last_result_count, last_error_category, last_error)
            VALUES (?, ?, ?, ?, NULL, NULL)
            ON CONFLICT(source) DO UPDATE SET last_success_at=excluded.last_success_at,
              last_duration_ms=excluded.last_duration_ms, last_result_count=excluded.last_result_count,
              last_error_category=NULL, last_error=NULL""",
                     (source, now, duration_ms, result_count))
    conn.commit()


def get_source_health(conn) -> list[dict]:
    return [dict(row) for row in conn.execute(
        "SELECT * FROM source_health ORDER BY source").fetchall()]


def make_job_id(title: str, company: str, url: str) -> str:
    """Produce a stable MD5 fingerprint for a job listing."""
    parsed = urllib.parse.urlsplit(url.strip())
    canonical_url = urllib.parse.urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip('/'), '', ''))
    clean = lambda value: re.sub(r"\s+", " ", str(value or "").strip().lower())
    key = f"{clean(title)}|{clean(company)}|{canonical_url}"
    return hashlib.md5(key.encode()).hexdigest()


def is_new(conn: sqlite3.Connection, job_id: str) -> bool:
    """Return True if this job_id has never been seen or dismissed before."""
    cur = conn.execute("""
        SELECT 1 FROM seen_jobs WHERE job_id = ?
        UNION
        SELECT 1 FROM dismissed_jobs WHERE job_id = ?
    """, (job_id, job_id))
    return cur.fetchone() is None


def mark_seen(conn: sqlite3.Connection, job: dict) -> None:
    """Record a job as seen. Updates metadata if it already exists."""
    conn.execute(
        """
        INSERT INTO seen_jobs (
            job_id, title, company, url, source, location, salary, apply_type, description, match_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
            title=excluded.title,
            company=excluded.company,
            url=excluded.url,
            location=excluded.location,
            salary=excluded.salary,
            apply_type=excluded.apply_type,
            description=excluded.description,
            match_score=excluded.match_score
        """,
        (
            job.get("job_id"),
            job.get("title", "Unknown Title"),
            job.get("company", "Unknown Company"),
            job.get("url", ""),
            job.get("source", "Unknown"),
            job.get("location", ""),
            job.get("salary", ""),
            job.get("apply_type", "unknown"),
            job.get("description", ""),
            job.get("match_score", 0),
        ),
    )
    conn.execute("UPDATE seen_jobs SET search_keywords = ? WHERE job_id = ?",
                 (json.dumps(job.get('search_keywords', [])), job['job_id']))
    profile = cv_match.load()
    if profile:
        score, reasons = cv_match.score(profile, job)
        conn.execute("UPDATE seen_jobs SET cv_score = ?, cv_reasons = ?, cv_profile_hash = ? WHERE job_id = ?",
                     (score, json.dumps(reasons), profile['hash'], job['job_id']))
    conn.commit()


def rescore_jobs(conn: sqlite3.Connection, profile: dict | None) -> int:
    """Recompute local fit scores after the CV changes without deleting job state."""
    if profile is None:
        cur = conn.execute("UPDATE seen_jobs SET cv_score = NULL, cv_reasons = '{}', cv_profile_hash = NULL")
        conn.commit()
        return cur.rowcount
    rows = conn.execute("SELECT job_id, title, description FROM seen_jobs").fetchall()
    updates = []
    for row in rows:
        value, reasons = cv_match.score(profile, dict(row))
        updates.append((value, json.dumps(reasons), profile['hash'], row['job_id']))
    conn.executemany("UPDATE seen_jobs SET cv_score = ?, cv_reasons = ?, cv_profile_hash = ? WHERE job_id = ?", updates)
    conn.commit()
    return len(updates)


def mark_jobs_alerted(conn: sqlite3.Connection, job_ids: list[str]) -> int:
    """Mark job listings as alerted with timestamp."""
    if not job_ids:
        return 0
    placeholders = ",".join("?" for _ in job_ids)
    cur = conn.execute(
        f"UPDATE seen_jobs SET is_alerted = 1, alerted_at = CURRENT_TIMESTAMP WHERE job_id IN ({placeholders})",
        job_ids,
    )
    conn.commit()
    return cur.rowcount


def is_alerted_for_recipient(conn: sqlite3.Connection, job_id: str, recipient_id: str) -> bool:
    """Return True if this job has already been alerted to this specific recipient."""
    cur = conn.execute(
        "SELECT 1 FROM job_alerts_sent WHERE job_id = ? AND recipient_id = ?",
        (job_id, recipient_id),
    )
    return cur.fetchone() is not None


def mark_batch_alerted_for_recipient(
    conn: sqlite3.Connection,
    job_ids: list[str],
    recipient_id: str,
    platform: str = "imessage",
) -> int:
    """Record that a batch of job alerts was sent to a specific recipient and update seen_jobs."""
    if not job_ids:
        return 0

    rows = [(jid, recipient_id, platform) for jid in job_ids]
    conn.executemany(
        """
        INSERT OR IGNORE INTO job_alerts_sent (job_id, recipient_id, platform)
        VALUES (?, ?, ?)
        """,
        rows,
    )

    placeholders = ",".join("?" for _ in job_ids)
    conn.execute(
        f"UPDATE seen_jobs SET is_alerted = 1, alerted_at = CURRENT_TIMESTAMP WHERE job_id IN ({placeholders})",
        job_ids,
    )
    conn.commit()
    return len(job_ids)


def total_seen(conn: sqlite3.Connection) -> int:
    """Return the total number of jobs tracked so far."""
    cur = conn.execute("SELECT COUNT(*) FROM seen_jobs")
    return cur.fetchone()[0]


def count_today_jobs(conn: sqlite3.Connection) -> int:
    """Return count of new jobs discovered today in Philippine Standard Time (UTC+8)."""
    cur = conn.execute(
        """
        SELECT COUNT(*) FROM seen_jobs 
        WHERE (
            date(seen_at, '+8 hours') = date('now', '+8 hours')
            OR date(seen_at, 'localtime') = date('now', 'localtime')
            OR date(seen_at) = date('now')
        )
        """
    )
    row = cur.fetchone()
    return row[0] if row else 0


def get_jobs(
    conn: sqlite3.Connection,
    limit: Optional[int] = None,
    offset: int = 0,
    source: Optional[str] = None,
    search: Optional[str] = None,
    alert_status: Optional[str] = None,
    saved: Optional[bool] = None,
    application_status: Optional[str] = None,
    since: Optional[str] = None,
    sort: str = 'newest',
) -> list[dict]:
    """Retrieve tracked jobs ordered by discovery time with optional alert status filtering."""
    query = "SELECT * FROM seen_jobs WHERE 1=1"
    params: list = []

    if source:
        query += " AND source = ?"
        params.append(source)
    if alert_status == "alerted":
        query += " AND is_alerted = 1"
    elif alert_status == "unalerted":
        query += " AND (is_alerted = 0 OR is_alerted IS NULL)"
    if saved is True:
        query += " AND is_saved = 1"
    if application_status:
        query += " AND application_status = ?"
        params.append(application_status)
    if since:
        query += " AND seen_at >= ?"
        params.append(since)

    if search:
        query += " AND (title LIKE ? OR company LIKE ? OR location LIKE ? OR description LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    if sort not in ('newest', 'cv_fit'):
        raise ValueError('sort must be newest or cv_fit')
    query += " ORDER BY cv_score DESC NULLS LAST, seen_at DESC" if sort == 'cv_fit' else " ORDER BY seen_at DESC"
    if limit is not None:
        query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    elif offset > 0:
        query += " LIMIT -1 OFFSET ?"
        params.append(offset)

    cur = conn.execute(query, params)
    result = [dict(row) for row in cur.fetchall()]
    for job in result:
        job['cv_reasons'] = json.loads(job.get('cv_reasons') or '{}')
    return result


def count_jobs(conn: sqlite3.Connection, **filters) -> int:
    """Count jobs using the same filters as get_jobs, without loading rows."""
    filters = {**filters, "limit": None}
    query = "SELECT COUNT(*) FROM seen_jobs WHERE 1=1"
    params = []
    if filters.get("source"):
        query += " AND source = ?"; params.append(filters["source"])
    if filters.get("alert_status") == "alerted": query += " AND is_alerted = 1"
    if filters.get("alert_status") == "unalerted": query += " AND (is_alerted = 0 OR is_alerted IS NULL)"
    if filters.get("saved") is True: query += " AND is_saved = 1"
    if filters.get("application_status"): query += " AND application_status = ?"; params.append(filters["application_status"])
    if filters.get("since"): query += " AND seen_at >= ?"; params.append(filters["since"])
    if filters.get("search"):
        query += " AND (title LIKE ? OR company LIKE ? OR location LIKE ? OR description LIKE ?)"
        term = f"%{filters['search']}%"; params.extend([term] * 4)
    return conn.execute(query, params).fetchone()[0]


def update_job_state(conn, job_ids: list[str], *, saved=None, application_status=None) -> int:
    if not job_ids or (saved is None and application_status is None): return 0
    sets, params = [], []
    if saved is not None: sets.append("is_saved = ?"); params.append(1 if saved else 0)
    if application_status is not None:
        sets.extend(["application_status = ?", "applied_at = CASE WHEN ? = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END"])
        params.extend([application_status, application_status])
    placeholders = ",".join("?" for _ in job_ids)
    cur = conn.execute(f"UPDATE seen_jobs SET {', '.join(sets)} WHERE job_id IN ({placeholders})", params + job_ids)
    conn.commit(); return cur.rowcount


def restore_jobs(conn, job_ids: list[str]) -> int:
    if not job_ids: return 0
    placeholders = ",".join("?" for _ in job_ids)
    rows = conn.execute(f"SELECT job_payload FROM dismissed_jobs WHERE job_id IN ({placeholders})", job_ids).fetchall()
    for row in rows:
        payload = json.loads(row[0] or "{}")
        if payload.get("job_id"):
            mark_seen(conn, payload)
    cur = conn.execute(f"DELETE FROM dismissed_jobs WHERE job_id IN ({placeholders})", job_ids)
    conn.commit(); return cur.rowcount


def get_dismissed(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    rows = conn.execute("SELECT job_id, dismissed_at, job_payload FROM dismissed_jobs ORDER BY dismissed_at DESC LIMIT ?", (limit,)).fetchall()
    result = []
    for row in rows:
        payload = json.loads(row["job_payload"] or "{}")
        payload["dismissed_at"] = row["dismissed_at"]
        result.append(payload)
    return result


def get_job_by_id(conn: sqlite3.Connection, job_id: str) -> Optional[dict]:
    """Retrieve a single job listing by ID."""
    cur = conn.execute("SELECT * FROM seen_jobs WHERE job_id = ?", (job_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def delete_jobs(conn: sqlite3.Connection, job_ids: list[str], block_future: bool = True) -> int:
    """
    Delete jobs by ID list from seen_jobs.
    If block_future is True, record IDs into dismissed_jobs to avoid future alerts.
    Returns the count of deleted rows.
    """
    if not job_ids:
        return 0

    if block_future:
        rows = conn.execute(f"SELECT * FROM seen_jobs WHERE job_id IN ({','.join('?' for _ in job_ids)})", job_ids).fetchall()
        conn.executemany(
            "INSERT OR REPLACE INTO dismissed_jobs (job_id, job_payload) VALUES (?, ?)",
            [(row["job_id"], json.dumps(dict(row))) for row in rows],
        )

    placeholders = ",".join("?" for _ in job_ids)
    cur = conn.execute(f"DELETE FROM seen_jobs WHERE job_id IN ({placeholders})", job_ids)
    conn.commit()
    return cur.rowcount


def delete_all_jobs(
    conn: sqlite3.Connection,
    block_future: bool = True,
    source: Optional[str] = None,
    search: Optional[str] = None,
) -> int:
    """
    Delete all jobs matching the optional filter criteria (or all jobs in database).
    Returns count of deleted rows.
    """
    query = "SELECT job_id FROM seen_jobs WHERE 1=1"
    params: list = []

    if source:
        query += " AND source = ?"
        params.append(source)
    if search:
        query += " AND (title LIKE ? OR company LIKE ? OR location LIKE ? OR description LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    cur = conn.execute(query, params)
    matching_ids = [row["job_id"] for row in cur.fetchall()]
    if not matching_ids:
        return 0

    return delete_jobs(conn, matching_ids, block_future=block_future)


def get_stats(conn: sqlite3.Connection) -> dict:
    """Return dashboard summary stats."""
    total_jobs = total_seen(conn)
    today_new = count_today_jobs(conn)

    cur = conn.execute("SELECT COUNT(*) FROM seen_jobs WHERE is_alerted = 1")
    total_alerted = cur.fetchone()[0]

    # Breakdown by source
    cur = conn.execute("SELECT source, COUNT(*) FROM seen_jobs GROUP BY source")
    source_counts = dict(cur.fetchall())

    return {
        "total_jobs": total_jobs,
        "today_new_jobs": today_new,
        "total_alerted": total_alerted,
        "sources": source_counts,
    }


def enqueue_deliveries(conn, recipients, matches):
    """Reconcile stored jobs with recipients; failed sends and overflow survive restarts."""
    jobs = conn.execute("SELECT * FROM seen_jobs").fetchall()
    with conn:
        for rec in recipients:
            if not rec.get('enabled', True) or not rec.get('destination'):
                continue
            for row in jobs:
                job = dict(row)
                job['search_keywords'] = json.loads(job.get('search_keywords') or '[]')
                if not matches(job, rec.get('keywords', [])):
                    continue
                if is_alerted_for_recipient(conn, job['job_id'], rec['id']):
                    continue
                conn.execute("""INSERT OR IGNORE INTO delivery_queue
                    (job_id, recipient_id, destination, platform) VALUES (?, ?, ?, ?)""",
                    (job['job_id'], rec['id'], rec['destination'], rec['platform']))


def due_deliveries(conn, recipient, limit=30, at=None):
    rows = conn.execute("""SELECT j.* FROM delivery_queue q
        JOIN seen_jobs j ON j.job_id=q.job_id
        WHERE q.recipient_id=? AND q.destination=? AND q.platform=?
        AND q.state IN ('pending', 'failed') AND q.next_attempt<=?
        ORDER BY q.next_attempt, j.seen_at, j.job_id LIMIT ?""",
        (recipient['id'], recipient['destination'], recipient['platform'],
         time.time() if at is None else at, limit)).fetchall()
    jobs = [dict(row) for row in rows]
    for job in jobs:
        job['search_keywords'] = json.loads(job.get('search_keywords') or '[]')
    return jobs


def record_delivery(conn, recipient, attempted_ids, sent_ids, error='Delivery failed; will retry'):
    sent = set(sent_ids)
    with conn:
        for job_id in attempted_ids:
            row = conn.execute('SELECT attempts FROM delivery_queue WHERE job_id=? AND recipient_id=?',
                               (job_id, recipient['id'])).fetchone()
            if row is None:
                continue
            attempts = row[0] + 1
            success = job_id in sent
            conn.execute("""UPDATE delivery_queue SET state=?, attempts=?, next_attempt=?,
                last_error=?, updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND recipient_id=?""",
                ('sent' if success else 'failed', attempts,
                 0 if success else time.time() + min(3600, 60 * 2 ** min(attempts - 1, 6)),
                 None if success else error, job_id, recipient['id']))
            if success:
                conn.execute('INSERT OR IGNORE INTO job_alerts_sent (job_id, recipient_id, platform) VALUES (?, ?, ?)',
                             (job_id, recipient['id'], recipient['platform']))
                conn.execute('UPDATE seen_jobs SET is_alerted=1, alerted_at=CURRENT_TIMESTAMP WHERE job_id=?', (job_id,))


def delivery_stats(conn):
    return dict(conn.execute("SELECT state, COUNT(*) FROM delivery_queue q WHERE EXISTS "
                            "(SELECT 1 FROM seen_jobs j WHERE j.job_id=q.job_id) GROUP BY state").fetchall())
