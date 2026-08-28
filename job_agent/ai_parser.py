"""
Gemini AI Resume Parser & Profile Auto-Fill Engine.
Uses Google Gemini API ("gemini-3.1-flash-lite") to analyze PDF resumes and auto-populate profile & screening Q&A fields.
"""
import json
import logging
import os
import re
from pathlib import Path
from typing import Optional, Tuple

try:
    import profile_manager
except ImportError:
    from job_agent import profile_manager


# Single primary model specified by reference: https://aistudio.google.com/docs/models
MODEL_NAME = "gemini-3.1-flash-lite"
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
        full_text = "\n".join(text_parts).strip()
        if full_text:
            return full_text
    except Exception as exc:
        logger.warning(f"pypdf extraction failed for {pdf_path}: {exc}")

    return ""


def get_gemini_api_key(config_path: Optional[Path] = None) -> Optional[str]:
    """Retrieve Gemini API key from environment variable GEMINI_API_KEY or config.json."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key and api_key.strip():
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


SYSTEM_PROMPT = """You are an expert AI Resume Analyst and Career Coach.
Analyze the candidate's resume below and extract all personal contact info, career experience, skills, and tailored screening responses into a single valid JSON object.

Required JSON Structure:
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
    "years_of_experience": 3,
    "current_title": "Job Title",
    "expected_salary_php": "100000",
    "notice_period_weeks": 4,
    "work_authorization": "Filipino Citizen / Authorized to work in Philippines",
    "remote_preference": "Remote / Hybrid",
    "skills": ["Skill1", "Skill2", "Skill3"]
  },
  "screening_answers": {
    "why_hire_me": "Concise 3-sentence professional value proposition pitch highlighting top skills and achievements from the resume.",
    "salary_expectation": "Target monthly compensation note.",
    "notice_period": "Notice period details.",
    "relocation": "Workplace and location preference note."
  }
}

Rules:
- Infer years_of_experience accurately from career work history date ranges.
- Extract all primary technical and professional skills into the 'skills' list.
- Create a compelling, professional 'why_hire_me' pitch derived directly from candidate achievements.
- Return ONLY the valid JSON object. Do not include markdown headers or extra text.
"""


def _clean_json_response(raw_text: str) -> dict:
    """Extract and parse valid JSON from Gemini output text."""
    text = raw_text.strip()
    if "```" in text:
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
        text = text.strip()

    match = re.search(r"(\{[\s\S]*\})", text)
    if match:
        text = match.group(1)

    return json.loads(text)


def analyze_resume_with_gemini(pdf_path: Path, api_key: str) -> dict:
    """Analyze PDF resume text using single model: gemini-3.1-flash-lite."""
    resume_text = extract_pdf_text(pdf_path)
    if not resume_text or len(resume_text) < 10:
        raise ValueError("Could not extract readable text from PDF. Please ensure the PDF contains selectable text.")

    logger.info(f"Analyzing resume text ({len(resume_text)} chars) with {MODEL_NAME}...")

    # Method 1: Try google.genai SDK
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[SYSTEM_PROMPT, f"Resume Text:\n\n{resume_text}"],
        )
        if response and response.text:
            return _clean_json_response(response.text)
    except Exception as exc_sdk:
        logger.warning(f"SDK call failed for {MODEL_NAME}: {exc_sdk}, trying REST endpoint...")

    # Method 2: Direct REST API Endpoint
    import requests
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{"text": f"{SYSTEM_PROMPT}\n\nResume Text:\n\n{resume_text}"}]
        }]
    }

    resp = requests.post(url, json=payload, timeout=45)
    if resp.status_code != 200:
        raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return _clean_json_response(raw_text)
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Could not parse Gemini API output structure: {data}") from e


def autofill_profile_from_resume(pdf_path: Path, config_path: Optional[Path] = None) -> Tuple[dict, bool, str]:
    """
    Main function: Checks API key, analyzes PDF resume via Gemini AI,
    and updates user_profile.json.
    
    Returns: (updated_profile, success: bool, message: str)
    """
    api_key = get_gemini_api_key(config_path)


    if not api_key:
        return (
            profile_manager.get_profile(),
            False,
            "GEMINI_API_KEY is missing. Please set GEMINI_API_KEY environment variable or enter your key in Search Settings.",
        )

    try:
        extracted = analyze_resume_with_gemini(pdf_path, api_key)
        profile = profile_manager.get_profile()

        # Update personal section
        if "personal" in extracted and isinstance(extracted["personal"], dict):
            for k, v in extracted["personal"].items():
                if v and isinstance(v, str):
                    profile["personal"][k] = v

        # Update work preferences
        if "work_preferences" in extracted and isinstance(extracted["work_preferences"], dict):
            for k, v in extracted["work_preferences"].items():
                if v is not None and v != "":
                    profile["work_preferences"][k] = v

        # Update screening Q&A
        if "screening_answers" in extracted and isinstance(extracted["screening_answers"], dict):
            for k, v in extracted["screening_answers"].items():
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
