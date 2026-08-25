"""SQLite job deduplication and application tracking layer."""
import sqlite3
import hashlib
import logging
from datetime import datetime
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
            seen_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Check and add missing columns if upgrading existing table
    cursor = conn.execute("PRAGMA table_info(seen_jobs)")
    existing_cols = {row["name"] for row in cursor.fetchall()}
    for col, col_type in [
        ("location", "TEXT DEFAULT ''"),
        ("salary", "TEXT DEFAULT ''"),
        ("apply_type", "TEXT DEFAULT 'unknown'"),
        ("description", "TEXT DEFAULT ''"),
        ("match_score", "INTEGER DEFAULT 0"),
    ]:
        if col not in existing_cols:
            try:
                conn.execute(f"ALTER TABLE seen_jobs ADD COLUMN {col} {col_type}")
            except Exception as e:
                logger.debug(f"Column {col} alter ignored: {e}")

    # 2. Applications history table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id          TEXT NOT NULL,
            status          TEXT NOT NULL,
            mode            TEXT NOT NULL DEFAULT 'manual',
            applied_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes           TEXT DEFAULT '',
            screenshot_path TEXT DEFAULT '',
            error_message   TEXT DEFAULT '',
            FOREIGN KEY (job_id) REFERENCES seen_jobs (job_id)
        )
    """)
    conn.commit()
    return conn


def make_job_id(title: str, company: str, url: str) -> str:
    """Produce a stable MD5 fingerprint for a job listing."""
    key = f"{title.lower().strip()}|{company.lower().strip()}|{url.strip()}"
    return hashlib.md5(key.encode()).hexdigest()


def is_new(conn: sqlite3.Connection, job_id: str) -> bool:
    """Return True if this job_id has never been seen before."""
    cur = conn.execute("SELECT 1 FROM seen_jobs WHERE job_id = ?", (job_id,))
    return cur.fetchone() is None


def mark_seen(conn: sqlite3.Connection, job: dict) -> None:
    """Record a job as seen. No-op if it already exists (INSERT OR IGNORE)."""
    conn.execute(
        """
        INSERT OR IGNORE INTO seen_jobs (
            job_id, title, company, url, source, location, salary, apply_type, description, match_score
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
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


def total_seen(conn: sqlite3.Connection) -> int:
    """Return the total number of jobs tracked so far."""
    cur = conn.execute("SELECT COUNT(*) FROM seen_jobs")
    return cur.fetchone()[0]


def get_jobs(
    conn: sqlite3.Connection,
    limit: int = 100,
    offset: int = 0,
    source: Optional[str] = None,
    search: Optional[str] = None,
    apply_type: Optional[str] = None,
) -> list[dict]:
    """Retrieve tracked jobs with optional filtering."""
    query = """
        SELECT j.*, 
               a.status as application_status,
               a.applied_at as applied_at,
               a.mode as application_mode,
               a.screenshot_path as application_screenshot
        FROM seen_jobs j
        LEFT JOIN applications a ON j.job_id = a.job_id
        WHERE 1=1
    """
    params: list = []

    if source:
        query += " AND j.source = ?"
        params.append(source)
    if apply_type:
        query += " AND j.apply_type = ?"
        params.append(apply_type)
    if search:
        query += " AND (j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY j.seen_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cur = conn.execute(query, params)
    return [dict(row) for row in cur.fetchall()]


def get_job_by_id(conn: sqlite3.Connection, job_id: str) -> Optional[dict]:
    """Retrieve a single job listing by ID."""
    cur = conn.execute(
        """
        SELECT j.*, 
               a.status as application_status,
               a.applied_at as applied_at,
               a.notes as application_notes,
               a.screenshot_path as application_screenshot,
               a.error_message as application_error
        FROM seen_jobs j
        LEFT JOIN applications a ON j.job_id = a.job_id
        WHERE j.job_id = ?
        """,
        (job_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def record_application(
    conn: sqlite3.Connection,
    job_id: str,
    status: str,
    mode: str = "manual",
    notes: str = "",
    screenshot_path: str = "",
    error_message: str = "",
) -> int:
    """Record a submitted, failed, or pending application attempt."""
    cur = conn.execute(
        """
        INSERT INTO applications (job_id, status, mode, notes, screenshot_path, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (job_id, status, mode, notes, screenshot_path, error_message),
    )
    conn.commit()
    return cur.lastrowid


def get_applications(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    """Get all past application attempts with job details."""
    cur = conn.execute(
        """
        SELECT a.*, j.title, j.company, j.url, j.source, j.location
        FROM applications a
        JOIN seen_jobs j ON a.job_id = j.job_id
        ORDER BY a.applied_at DESC
        LIMIT ?
        """,
        (limit,),
    )
    return [dict(row) for row in cur.fetchall()]


def count_today_applications(conn: sqlite3.Connection) -> int:
    """Return the number of applications submitted today (UTC/local day)."""
    cur = conn.execute(
        """
        SELECT COUNT(*) FROM applications 
        WHERE DATE(applied_at) = DATE('now') AND status = 'submitted'
        """
    )
    return cur.fetchone()[0]


def get_application_stats(conn: sqlite3.Connection) -> dict:
    """Return summary statistics for the dashboard."""
    total_jobs = total_seen(conn)
    
    cur = conn.execute("SELECT COUNT(*) FROM applications WHERE status = 'submitted'")
    total_applied = cur.fetchone()[0]

    cur = conn.execute("SELECT COUNT(*) FROM applications WHERE status = 'failed'")
    total_failed = cur.fetchone()[0]

    today_applied = count_today_applications(conn)

    return {
        "total_jobs": total_jobs,
        "total_applied": total_applied,
        "total_failed": total_failed,
        "today_applied": today_applied,
    }
