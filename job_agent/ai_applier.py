"""
Gemini AI Application Intelligence Service.
Uses the official google-genai SDK to answer job application screening questions
and generate customized cover letters/messages tailored to candidate profile.
"""
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def get_genai_client(api_key: str):
    """Instantiate a Google GenAI client with the provided API key."""
    from google import genai
    return genai.Client(api_key=api_key)


def validate_gemini_key(api_key: str, model_name: str = "gemini-3.7-flash") -> Tuple[bool, str]:
    """Test if the provided Gemini API key is valid."""
    if not api_key or not api_key.strip():
        return False, "API key cannot be empty."

    try:
        client = get_genai_client(api_key.strip())
        resp = client.models.generate_content(
            model=model_name,
            contents="Say 'OK' in one word."
        )
        if resp.text:
            return True, f"Successfully connected to Gemini using {model_name}!"
        return False, "Received empty response from Gemini API."
    except Exception as exc:
        logger.error(f"Gemini API key validation failed: {exc}")
        return False, f"Connection failed: {str(exc)}"


def answer_screening_questions(
    questions: List[Dict[str, Any]],
    job_details: Dict[str, Any],
    profile_data: Dict[str, Any],
    api_key: str,
    model_name: str = "gemini-3.7-flash"
) -> List[Dict[str, Any]]:
    """
    Given a list of form questions from a job application modal/page,
    return accurate, structured answers matching the candidate's profile.
    """
    if not api_key:
        logger.warning("No Gemini API key provided for answering screening questions.")
        return []

    system_instruction = (
        "You are an expert AI Job Application Assistant acting on behalf of the candidate. "
        "Your task is to accurately, truthfully, and professionally answer job application screening questions "
        "using the candidate's profile, resume summary, skills, and preset preferences.\n\n"
        "Guidelines:\n"
        "1. For multiple choice / dropdown / radio questions, select the option that best matches the candidate.\n"
        "2. For numeric questions (e.g. 'Years of experience with React?'), return a single clean integer or number.\n"
        "3. For Yes/No questions (e.g. 'Are you legally authorized to work in the Philippines?'), answer truthfully based on profile defaults.\n"
        "4. For open-ended questions (e.g. 'Why are you a good fit?'), provide a crisp, compelling 2-3 sentence answer tailored to the job description.\n"
        "5. Output MUST be valid JSON array of objects with keys: 'question_id', 'answer', 'confidence'."
    )

    prompt = {
        "candidate_profile": {
            "name": profile_data.get("full_name"),
            "current_title": profile_data.get("current_title"),
            "skills": profile_data.get("skills", []),
            "years_of_experience": profile_data.get("years_of_experience", 3),
            "summary": profile_data.get("summary", ""),
            "screening_defaults": profile_data.get("screening_defaults", {})
        },
        "target_job": {
            "title": job_details.get("title", ""),
            "company": job_details.get("company", ""),
            "description_snippet": job_details.get("description", "")[:1000]
        },
        "questions_to_answer": questions
    }

    try:
        from google.genai import types

        client = get_genai_client(api_key)
        resp = client.models.generate_content(
            model=model_name,
            contents=[json.dumps(prompt)],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.2,
            )
        )

        if resp.text:
            answers = json.loads(resp.text)
            if isinstance(answers, list):
                return answers
            elif isinstance(answers, dict) and "answers" in answers:
                return answers["answers"]
    except Exception as exc:
        logger.error(f"Error answering screening questions with Gemini: {exc}")

    return []


def generate_tailored_cover_letter(
    job_details: Dict[str, Any],
    profile_data: Dict[str, Any],
    api_key: str,
    model_name: str = "gemini-3.7-flash"
) -> str:
    """
    Generate a tailored cover message (ideal for OnlineJobs.ph and LinkedIn message notes).
    """
    if not api_key:
        return ""

    system_instruction = (
        "You are an expert career copywriter. Write a concise, natural, and persuasive application message "
        "(under 180 words) for the candidate applying to this specific role. Highlight 2-3 relevant skills "
        "and show clear understanding of what the employer needs. Do not use generic filler. Be direct and polite."
    )

    prompt = {
        "candidate": {
            "name": profile_data.get("full_name"),
            "title": profile_data.get("current_title"),
            "skills": profile_data.get("skills", []),
            "years_of_experience": profile_data.get("years_of_experience", 3),
            "summary": profile_data.get("summary", "")
        },
        "job": {
            "title": job_details.get("title"),
            "company": job_details.get("company"),
            "description": job_details.get("description", "")[:1500]
        }
    }

    try:
        client = get_genai_client(api_key)
        resp = client.models.generate_content(
            model=model_name,
            contents=[json.dumps(prompt)],
            config={"system_instruction": system_instruction, "temperature": 0.4}
        )
        return resp.text.strip() if resp.text else ""
    except Exception as exc:
        logger.error(f"Error generating cover letter: {exc}")
        return ""
