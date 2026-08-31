"""
Central Application Orchestration Engine.
Coordinates authentic PDF resume injection, platform routing, session enforcement, and audit logging.
"""
import logging
from pathlib import Path
from typing import Optional

try:
    from db import get_connection, get_job_by_id, record_application
    from profile_manager import get_profile, get_resume_path
except (ImportError, ModuleNotFoundError):
    from ..db import get_connection, get_job_by_id, record_application
    from ..profile_manager import get_profile, get_resume_path

from .session_manager import get_session_path, get_all_session_statuses, is_session_active
from . import indeed_applier, jobstreet_applier, onlinejobs_applier, linkedin_applier

logger = logging.getLogger(__name__)

SCREENSHOTS_DIR = Path(__file__).parent.parent / "data" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def check_platform_sessions() -> dict:
    """Return live session statuses across all supported platforms."""
    return get_all_session_statuses()


def apply_to_job(
    job_id: str,
    mode: str = "manual",
    custom_note: str = "",
) -> dict:
    """
    Execute an application submission to a tracked job listing.

    Args:
        job_id: Stable MD5 job ID in seen_jobs.db.
        mode: 'manual', 'assisted_review', or 'auto'.
        custom_note: Optional custom message or pitch.

    Returns:
        Dict summarizing outcome: {success, message, screenshot, external, portal_url}
    """
    conn = get_connection()
    job = get_job_by_id(conn, job_id)

    if not job:
        conn.close()
        return {
            "success": False,
            "message": f"Job ID {job_id} was not found in the database.",
        }

    # 1. Resume Verification: Must use authentic user-uploaded PDF
    resume_path = get_resume_path()
    if not resume_path or not resume_path.exists():
        conn.close()
        return {
            "success": False,
            "message": "No authentic resume uploaded! Please upload your PDF resume in the Tracky Dashboard first.",
        }

    profile = get_profile()
    source = job.get("source", "").lower()
    url = job.get("url", "")

    result = {
        "success": False,
        "message": "Platform not supported for automated apply.",
        "screenshot": None,
        "external": False,
    }

    try:
        if "indeed" in source:
            session = get_session_path("indeed")
            result = indeed_applier.apply(
                url=url,
                resume_path=resume_path,
                profile_data=profile,
                session_path=session if session.exists() else None,
                screenshot_dir=SCREENSHOTS_DIR,
                mode=mode,
            )
        elif "jobstreet" in source:
            session = get_session_path("jobstreet")
            result = jobstreet_applier.apply(
                url=url,
                resume_path=resume_path,
                profile_data=profile,
                session_path=session if session.exists() else None,
                screenshot_dir=SCREENSHOTS_DIR,
                mode=mode,
            )
        elif "onlinejobs" in source:
            if not is_session_active("onlinejobs"):
                result = {
                    "success": False,
                    "external": False,
                    "requires_session": True,
                    "message": "OnlineJobs.ph session is not connected. Please log in under Platform Accounts tab first.",
                }
            else:
                session = get_session_path("onlinejobs")
                result = onlinejobs_applier.apply(
                    url=url,
                    resume_path=resume_path,
                    profile_data=profile,
                    session_path=session,
                    screenshot_dir=SCREENSHOTS_DIR,
                    mode=mode,
                    custom_pitch=custom_note,
                )
        elif "linkedin" in source:
            session = get_session_path("linkedin")
            result = linkedin_applier.apply(
                url=url,
                resume_path=resume_path,
                profile_data=profile,
                session_path=session if session.exists() else None,
                screenshot_dir=SCREENSHOTS_DIR,
                mode=mode,
                custom_pitch=custom_note,
            )
        else:
            result = {
                "success": False,
                "external": True,
                "message": f"Source '{job.get('source')}' requires manual application via web link.",
                "portal_url": url,
            }

        # 2. Record application in DB audit log
        # Strict validation: ONLY mark 'submitted' if result['success'] is True AND not external
        if result.get("success") and not result.get("external"):
            status = "submitted"
        elif result.get("external"):
            status = "external_link"
        else:
            status = "failed"

        screenshot_rel = ""
        if result.get("screenshot"):
            screenshot_rel = Path(result["screenshot"]).name

        record_application(
            conn=conn,
            job_id=job_id,
            status=status,
            mode=mode,
            notes=custom_note or result.get("message", ""),
            screenshot_path=screenshot_rel,
            error_message="" if (result.get("success") and not result.get("external")) else result.get("message", ""),
        )

    except Exception as exc:
        logger.error(f"Application engine failure: {exc}")
        record_application(
            conn=conn,
            job_id=job_id,
            status="failed",
            mode=mode,
            notes=custom_note,
            error_message=str(exc),
        )
        result = {"success": False, "message": f"Application error: {str(exc)}"}
    finally:
        conn.close()

    return result
