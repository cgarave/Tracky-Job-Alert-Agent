"""
User Profile and Authentic Resume Management Layer.
Guarantees authentic PDF resume upload storage and profile configuration.
"""
import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
RESUMES_DIR = DATA_DIR / "resumes"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
SESSIONS_DIR = DATA_DIR / "sessions"
PROFILE_PATH = DATA_DIR / "user_profile.json"

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
RESUMES_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PROFILE = {
    "personal": {
        "first_name": "",
        "last_name": "",
        "email": "",
        "phone": "",
        "location": "Metro Manila, Philippines",
        "headline": "Software Engineer",
        "linkedin_url": "",
        "github_url": "",
        "portfolio_url": "",
    },
    "work_preferences": {
        "years_of_experience": 3,
        "current_title": "Software Engineer",
        "expected_salary_php": "100000",
        "notice_period_weeks": 4,
        "work_authorization": "Filipino Citizen / Authorized to work in Philippines",
        "remote_preference": "Remote / Hybrid",
        "willing_to_relocate": False,
        "skills": ["Python", "JavaScript", "React", "Node.js", "SQL", "Git"],
    },
    "screening_answers": {
        "why_hire_me": "I have extensive hands-on experience building scalable applications, solving complex technical challenges, and delivering clean, maintainable code in agile team environments.",
        "notice_period": "My notice period is standard 30 days, but negotiable depending on onboarding timelines.",
        "salary_expectation": "My target gross monthly compensation is around PHP 100,000, open to discussion based on overall benefits.",
        "relocation": "I am open to hybrid work within Metro Manila or fully remote setups.",
    },
    "resume": {
        "filename": "",
        "path": "",
        "uploaded_at": "",
        "file_size_bytes": 0,
    },
    "auto_apply": {
        "enabled": False,
        "daily_cap": 5,
        "match_threshold": 75,
        "blacklisted_companies": [],
        "blacklisted_keywords": ["unpaid", "internship"],
    },
}


def get_profile() -> dict:
    """Load user profile from disk or return default template."""
    if not PROFILE_PATH.exists():
        save_profile(DEFAULT_PROFILE)
        return DEFAULT_PROFILE.copy()
    try:
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure all default top-level keys exist
            for k, v in DEFAULT_PROFILE.items():
                if k not in data:
                    data[k] = v
            return data
    except Exception as exc:
        logger.error(f"Error reading profile: {exc}")
        return DEFAULT_PROFILE.copy()


def save_profile(profile_data: dict) -> dict:
    """Save user profile to disk safely."""
    try:
        with open(PROFILE_PATH, "w", encoding="utf-8") as f:
            json.dump(profile_data, f, indent=2, ensure_ascii=False)
        return profile_data
    except Exception as exc:
        logger.error(f"Error saving profile: {exc}")
        raise


def save_resume_file(filename: str, file_bytes: bytes) -> str:
    """
    Save the user's authentic PDF resume to the secure data directory.
    Replaces any previously uploaded resume.
    """
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF resume files (.pdf) are supported.")

    clean_name = "resume_" + "".join(c for c in filename if c.isalnum() or c in (".", "_", "-"))
    dest_path = RESUMES_DIR / clean_name

    # Clear older resumes
    for old_file in RESUMES_DIR.glob("*.pdf"):
        try:
            old_file.unlink(missing_ok=True)
        except Exception:
            pass

    # Write new file
    with open(dest_path, "wb") as f:
        f.write(file_bytes)

    # Update profile record
    profile = get_profile()
    profile["resume"] = {
        "filename": filename,
        "path": str(dest_path),
        "uploaded_at": datetime.now().isoformat(timespec="seconds"),
        "file_size_bytes": len(file_bytes),
    }
    save_profile(profile)
    logger.info(f"Saved authentic user resume to {dest_path}")
    return str(dest_path)


def get_resume_path() -> Optional[Path]:
    """Return Path to user's uploaded resume if exists."""
    profile = get_profile()
    resume_path_str = profile.get("resume", {}).get("path")
    if resume_path_str:
        p = Path(resume_path_str)
        if p.exists():
            return p
    # Fallback search in directory
    pdf_files = list(RESUMES_DIR.glob("*.pdf"))
    if pdf_files:
        return pdf_files[0]
    return None


def get_screening_context() -> dict:
    """Return combined profile information ready for screening question generation."""
    p = get_profile()
    personal = p.get("personal", {})
    work = p.get("work_preferences", {})
    qa = p.get("screening_answers", {})
    return {
        "name": f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip(),
        "email": personal.get("email", ""),
        "phone": personal.get("phone", ""),
        "location": personal.get("location", ""),
        "headline": personal.get("headline", ""),
        "experience_years": work.get("years_of_experience", 0),
        "skills": work.get("skills", []),
        "expected_salary": work.get("expected_salary_php", ""),
        "notice_period": work.get("notice_period_weeks", 4),
        "work_authorization": work.get("work_authorization", ""),
        "standard_answers": qa,
    }
