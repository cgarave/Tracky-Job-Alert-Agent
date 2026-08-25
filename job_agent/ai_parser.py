"""
Gemini AI Resume Parser & Profile Auto-Fill Engine.
Uses Google Gemini API to analyze PDF resumes and auto-populate profile & screening Q&A fields.
"""
import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def extract_pdf_text(pdf_path: Path) -> str:
    """Extract plain text from a PDF resume using pypdf."""
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        text_parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
        return "\n".join(text_parts).strip()
    except Exception as exc:
        logger.error(f"pypdf extraction error: {exc}")
        return ""


def get_gemini_api_key(config_path: Optional[Path] = None) -> Optional[str]:
    """Retrieve Gemini API key from environment variable GEMINI_API_KEY or config.json."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        return api_key.strip()

    if config_path and config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                key = cfg.get("gemini_api_key", "").strip()
                if key:
                    return key
        except Exception:
            pass
    return None


SYSTEM_PROMPT = """
You are an expert AI Resume Analyst and Career Assistant.
Your task is to analyze the provided resume text and extract structured candidate profile details and tailored screening question responses into valid JSON matching the exact schema below.

Required Output JSON Schema:
{
  "personal": {
    "first_name": "Candidate First Name",
    "last_name": "Candidate Last Name",
    "email": "candidate@example.com",
    "phone": "+63...",
    "location": "City/Region, Country",
    "headline": "Professional Title / Target Role",
    "linkedin_url": "https://linkedin.com/in/...",
    "github_url": "https://github.com/...",
    "portfolio_url": "https://..."
  },
  "work_preferences": {
    "years_of_experience": 5,
    "current_title": "Current or Recent Job Title",
    "expected_salary_php": "120000",
    "notice_period_weeks": 4,
    "work_authorization": "Filipino Citizen / Authorized to work in Philippines",
    "remote_preference": "Remote / Hybrid",
    "skills": ["Skill1", "Skill2", "Skill3"]
  },
  "screening_answers": {
    "why_hire_me": "Concise 3-sentence professional value proposition pitch highlighting top skills and achievements from the resume.",
    "salary_expectation": "Target monthly compensation note based on senior level.",
    "notice_period": "Notice period details.",
    "relocation": "Workplace and location preference note."
  }
}

Rules:
- Infer years_of_experience accurately from work history date ranges in the resume.
- Extract all primary technical and professional skills into the 'skills' array.
- Create a compelling, professional 'why_hire_me' pitch derived directly from candidate achievements.
- Return ONLY valid JSON, with no markdown codeblocks or extra text.
"""


def analyze_resume_with_gemini(pdf_path: Path, api_key: str) -> dict:
    """Analyze PDF resume text using Google Gemini API."""
    resume_text = extract_pdf_text(pdf_path)
    if not resume_text:
        raise ValueError("Could not extract readable text from PDF file.")

    logger.info(f"Analyzing resume text ({len(resume_text)} chars) with Gemini AI...")

    # Method 1: Try google.genai SDK
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[SYSTEM_PROMPT, f"Resume Text:\n\n{resume_text}"],
        )
        raw_text = response.text.strip()
    except Exception as e1:
        logger.warning(f"google.genai SDK failed ({e1}), falling back to direct REST API...")
        # Method 2: Direct REST API via requests
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": f"{SYSTEM_PROMPT}\n\nResume Text:\n\n{resume_text}"}]
            }]
        }
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()

    # Clean markdown backticks if present
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        raw_text = "\n".join(lines).strip()

    extracted = json.loads(raw_text)
    return extracted


def autofill_profile_from_resume(pdf_path: Path, config_path: Optional[Path] = None) -> tuple[dict, bool, str]:
    """
    Main function: Checks API key, analyzes PDF resume via Gemini AI,
    and updates user_profile.json.
    
    Returns: (updated_profile, success: bool, message: str)
    """
    import profile_manager

    api_key = get_gemini_api_key(config_path)
    if not api_key:
        return (
            profile_manager.get_profile(),
            False,
            "GEMINI_API_KEY environment variable is not set. Please add GEMINI_API_KEY to your environment or settings to enable AI auto-fill.",
        )

    try:
        extracted = analyze_resume_with_gemini(pdf_path, api_key)
        profile = profile_manager.get_profile()

        # Update profile sections with AI extracted values
        if "personal" in extracted:
            p_ai = extracted["personal"]
            for k, v in p_ai.items():
                if v and isinstance(v, str):
                    profile["personal"][k] = v

        if "work_preferences" in extracted:
            w_ai = extracted["work_preferences"]
            for k, v in w_ai.items():
                if v is not None and v != "":
                    profile["work_preferences"][k] = v

        if "screening_answers" in extracted:
            s_ai = extracted["screening_answers"]
            for k, v in s_ai.items():
                if v and isinstance(v, str):
                    profile["screening_answers"][k] = v

        saved_profile = profile_manager.save_profile(profile)
        logger.info("✨ Successfully auto-filled profile fields with Gemini AI!")
        return (
            saved_profile,
            True,
            "✨ Resume analyzed with Gemini AI! Profile & screening answers populated successfully.",
        )

    except Exception as exc:
        logger.error(f"Gemini AI resume analysis failed: {exc}")
        return (
            profile_manager.get_profile(),
            False,
            f"Resume uploaded, but Gemini AI analysis failed: {str(exc)}",
        )
