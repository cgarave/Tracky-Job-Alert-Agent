"""SQLite job deduplication layer."""
import sqlite3
import hashlib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "seen_jobs.db"


def get_connection() -> sqlite3.Connection:
    """Open (or create) the SQLite database and ensure the schema exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_jobs (
            job_id   TEXT PRIMARY KEY,
            title    TEXT,
            company  TEXT,
            url      TEXT,
            source   TEXT,
            seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        "INSERT OR IGNORE INTO seen_jobs (job_id, title, company, url, source) VALUES (?,?,?,?,?)",
        (job["job_id"], job["title"], job["company"], job["url"], job["source"]),
    )
    conn.commit()


def total_seen(conn: sqlite3.Connection) -> int:
    """Return the total number of jobs tracked so far."""
    cur = conn.execute("SELECT COUNT(*) FROM seen_jobs")
    return cur.fetchone()[0]
