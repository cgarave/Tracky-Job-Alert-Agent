"""
Candidate Profile & Resume Manager for Tracky AI Auto-Applier.
Handles profile persistence in profile.json and PDF resume extraction using pypdf.
"""
import io
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

PROFILE_PATH = Path(__file__).parent / "profile.json"
RESUME_STORAGE_DIR = Path(__file__).parent / "resumes"

DEFAULT_PROFILE: Dict[str, Any] = {
    "full_name": "",
    "email": "",
    "phone": "",
    "location": "Philippines",
    "linkedin_url": "",
    "github_url": "",
    "portfolio_url": "",
    "summary": "",
    "skills": [],
    "years_of_experience": 3,
    "current_title": "",
    "screening_defaults": {
        "expected_salary_monthly_php": "80,000 - 120,000",
        "expected_salary_hourly_usd": "25",
        "notice_period_weeks": "2",
        "work_authorization": "Yes",
        "require_sponsorship": "No",
        "willing_to_relocate": "No",
        "remote_preferred": "Yes",
        "custom_notes": ""
    },
    "ai_settings": {
        "gemini_api_key": "",
        "gemini_model": "gemini-3.7-flash",
        "enable_ghost_cursor": True,
        "application_mode": "review_before_submit"  # "review_before_submit" | "full_auto"
    },
    "resume_filename": "",
    "resume_uploaded_at": ""
}


def load_profile() -> Dict[str, Any]:
    """Load candidate profile from disk, merging with defaults."""
    if not PROFILE_PATH.exists():
        save_profile(DEFAULT_PROFILE)
        return dict(DEFAULT_PROFILE)

    try:
        data = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
        merged = dict(DEFAULT_PROFILE)
        merged.update(data)
        # Deep merge dicts
        merged["screening_defaults"] = {
            **DEFAULT_PROFILE["screening_defaults"],
            **data.get("screening_defaults", {})
        }
        merged["ai_settings"] = {
            **DEFAULT_PROFILE["ai_settings"],
            **data.get("ai_settings", {})
        }
        return merged
    except Exception as exc:
        logger.error(f"Error loading profile.json: {exc}")
        return dict(DEFAULT_PROFILE)


def save_profile(profile_data: Dict[str, Any]) -> bool:
    """Save candidate profile to profile.json."""
    try:
        PROFILE_PATH.write_text(json.dumps(profile_data, indent=2), encoding="utf-8")
        return True
    except Exception as exc:
        logger.error(f"Error saving profile.json: {exc}")
        return False


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract plain text from PDF resume bytes using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t)
        return "\n\n".join(pages_text).strip()
    except Exception as exc:
        logger.error(f"Error reading PDF with pypdf: {exc}")
        return ""


def parse_resume_fields(resume_text: str) -> Dict[str, Any]:
    """Extract basic heuristics from resume text (email, phone, skills)."""
    parsed: Dict[str, Any] = {}

    # Email extraction
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", resume_text)
    if email_match:
        parsed["email"] = email_match.group(0)

    # Phone extraction
    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", resume_text)
    if phone_match:
        parsed["phone"] = phone_match.group(0)

    # Links
    li_match = re.search(r"linkedin\.com/in/[\w\-]+", resume_text, re.IGNORECASE)
    if li_match:
        parsed["linkedin_url"] = f"https://{li_match.group(0)}"

    gh_match = re.search(r"github\.com/[\w\-]+", resume_text, re.IGNORECASE)
    if gh_match:
        parsed["github_url"] = f"https://{gh_match.group(0)}"

    # Common technical skill keywords
    known_skills = [
        "React", "Next.js", "TypeScript", "JavaScript", "Python", "Node.js", "Tailwind CSS",
        "HTML", "CSS", "SQL", "PostgreSQL", "MySQL", "MongoDB", "GraphQL", "REST API",
        "FastAPI", "Django", "Flask", "Docker", "AWS", "GCP", "Git", "Redux", "Vue.js",
        "Angular", "Figma", "UI/UX", "Linux", "CI/CD", "Playwright", "Selenium"
    ]
    found_skills = []
    text_lower = resume_text.lower()
    for s in known_skills:
        pattern = r"\b" + re.escape(s.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found_skills.append(s)

    if found_skills:
        parsed["skills"] = found_skills

    return parsed
