"""SQLite job deduplication, tracking, dismissal, and alert delivery layer."""
import hashlib
import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "seen_jobs.db"


def get_connection() -> sqlite3.Connection:
    """Open (or create) the SQLite database and ensure the schema exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

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
    ):
        try:
            conn.execute(f"ALTER TABLE seen_jobs ADD COLUMN {col_def}")
        except sqlite3.OperationalError:
            pass  # Column already exists

    # 2. Dismissed / Ignored jobs table (prevents future re-scraping alerts)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dismissed_jobs (
            job_id       TEXT PRIMARY KEY,
            dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Performance Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_seen_at ON seen_jobs(seen_at DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_source ON seen_jobs(source)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_jobs_alerted ON seen_jobs(is_alerted)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dismissed_jobs_id ON dismissed_jobs(job_id)")

    conn.commit()
    return conn


def make_job_id(title: str, company: str, url: str) -> str:
    """Produce a stable MD5 fingerprint for a job listing."""
    key = f"{title.lower().strip()}|{company.lower().strip()}|{url.strip()}"
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
    conn.commit()


def mark_jobs_alerted(conn: sqlite3.Connection, job_ids: list[str]) -> int:
    """Mark job listings as alerted via iMessage with timestamp."""
    if not job_ids:
        return 0
    placeholders = ",".join("?" for _ in job_ids)
    cur = conn.execute(
        f"UPDATE seen_jobs SET is_alerted = 1, alerted_at = CURRENT_TIMESTAMP WHERE job_id IN ({placeholders})",
        job_ids,
    )
    conn.commit()
    return cur.rowcount


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
    limit: int = 100,
    offset: int = 0,
    source: Optional[str] = None,
    search: Optional[str] = None,
    alert_status: Optional[str] = None,
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

    if search:
        query += " AND (title LIKE ? OR company LIKE ? OR location LIKE ? OR description LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    query += " ORDER BY seen_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cur = conn.execute(query, params)
    return [dict(row) for row in cur.fetchall()]


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
        conn.executemany(
            "INSERT OR IGNORE INTO dismissed_jobs (job_id) VALUES (?)",
            [(jid,) for jid in job_ids],
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
