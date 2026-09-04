"""
Gemini AI Application Intelligence Service.
Uses the official google-genai SDK with automatic multi-model failover (Gemini 3.x family)
and exponential retry to handle 503 high-demand spikes and model deprecations seamlessly.
"""
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Active Gemini 3.x production model family ordered by priority
FALLBACK_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
]


def get_genai_client(api_key: str):
    """Instantiate a Google GenAI client with the provided API key."""
    from google import genai
    return genai.Client(api_key=api_key)


def generate_content_with_fallback(
    client,
    primary_model: str,
    contents: Any,
    config: Any = None,
    max_retries_per_model: int = 2
) -> Any:
    """
    Execute generate_content with automatic multi-model failover and backoff.
    Guarantees resiliency against 503 high demand, 429 quota spikes, and model deprecations.
    """
    models_to_try = [primary_model] if primary_model else []
    for fb in FALLBACK_MODELS:
        if fb not in models_to_try:
            models_to_try.append(fb)

    last_error = None
    for model_name in models_to_try:
        for attempt in range(max_retries_per_model):
            try:
                kwargs: Dict[str, Any] = {"model": model_name, "contents": contents}
                if config is not None:
                    kwargs["config"] = config
                return client.models.generate_content(**kwargs)
            except Exception as exc:
                last_error = exc
                err_str = str(exc)
                logger.warning(
                    f"[Gemini AI] Model '{model_name}' (attempt {attempt + 1}) returned error: {err_str[:120]}"
                )

                # If deprecated (404) or quota exhausted (429), advance immediately to next model
                if any(x in err_str for x in ("404", "NOT_FOUND", "no longer available", "not found", "429", "RESOURCE_EXHAUSTED", "Quota exceeded")):
                    break

                # If temporary high demand (503), back off before retry
                if any(x in err_str for x in ("503", "UNAVAILABLE")):
                    time.sleep(1.0 * (attempt + 1))
                else:
                    break

    if last_error:
        raise last_error
    raise RuntimeError("All Gemini fallback models exhausted.")


def validate_gemini_key(api_key: str, model_name: str = "gemini-3.7-flash") -> Tuple[bool, str]:
    """Test if the provided Gemini API key is valid using active 3.x models."""
    if not api_key or not api_key.strip():
        return False, "API key cannot be empty."

    try:
        client = get_genai_client(api_key.strip())
        resp = generate_content_with_fallback(
            client=client,
            primary_model=model_name,
            contents="Say 'OK' in one word."
        )
        if resp.text:
            return True, f"Successfully connected to Google Gemini API!"
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
        resp = generate_content_with_fallback(
            client=client,
            primary_model=model_name,
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
        from google.genai import types

        client = get_genai_client(api_key)
        resp = generate_content_with_fallback(
            client=client,
            primary_model=model_name,
            contents=[json.dumps(prompt)],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.4
            )
        )
        return resp.text.strip() if resp.text else ""
    except Exception as exc:
        logger.error(f"Error generating cover letter: {exc}")
        return ""


def score_job_match(
    job_details: Dict[str, Any],
    profile_data: Dict[str, Any],
    api_key: str,
    model_name: str = "gemini-3.7-flash"
) -> int:
    """
    Score the candidate match against a job listing (0-100).
    """
    if not api_key:
        return 75  # Default reasonable score if no API key

    system_instruction = (
        "You are an expert technical recruiter. Evaluate how well the candidate's skills, experience, "
        "and preferences match the target job listing. Return ONLY a single integer score from 0 to 100."
    )

    prompt = {
        "candidate": {
            "title": profile_data.get("current_title"),
            "skills": profile_data.get("skills", []),
            "years_of_experience": profile_data.get("years_of_experience", 3),
            "summary": profile_data.get("summary", "")[:1000]
        },
        "job": {
            "title": job_details.get("title"),
            "company": job_details.get("company"),
            "description": job_details.get("description", "")[:1500]
        }
    }

    try:
        from google.genai import types

        client = get_genai_client(api_key)
        resp = generate_content_with_fallback(
            client=client,
            primary_model=model_name,
            contents=[json.dumps(prompt)],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1
            )
        )
        if resp.text:
            cleaned = "".join(c for c in resp.text.strip() if c.isdigit())
            if cleaned:
                score = int(cleaned)
                return max(0, min(100, score))
    except Exception as exc:
        logger.error(f"Error scoring job match: {exc}")

    return 75


def navigate_browser_step(
    screenshot_b64: str = "",
    page_url: str = "",
    page_title: str = "",
    history: List[str] = None,
    profile_data: Dict[str, Any] = None,
    job_context: Dict[str, Any] = None,
    api_key: str = "",
    model_name: str = "gemini-3.7-flash",
    dom_snapshot: str = "",
    form_schema: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Multimodal Gemini Vision & DOM-First Semantic Navigation step with automatic failover.
    """
    if history is None:
        history = []
    if profile_data is None:
        profile_data = {}
    if job_context is None:
        job_context = {}

    if not api_key:
        return {
            "action": "stuck",
            "reason": "Missing Gemini API key. Please configure in Tracky Dashboard.",
            "reasoning": "No Gemini API key configured."
        }

    import base64
    from google.genai import types

    # Load remembered Q&A memory pairs from local SQLite
    qa_memory_list = []
    try:
        conn = db.get_connection()
        qa_memory_list = db.get_all_qa_memory(conn)
        conn.close()
    except Exception as e:
        logger.warning(f"Could not load QA memory: {e}")

    system_instruction = (
        "You are Tracky AI — an intelligent, human-like universal job application co-pilot for the user across all professions and career fields. "
        "You receive structured form schemas (or screenshot / DOM structure), page URL, navigation history, "
        "and the candidate's complete profile.\n\n"
        "ANSWER PRIORITY HIERARCHY (Follow strictly):\n"
        "1. TIER 1 (AUTHORITATIVE GROUND TRUTH): Candidate Profile & Universal Screening Defaults (Name, Contact, City/Country, Target Salary, Notice Period, Work Authorization, Shift Availability, Education Level, Background Check Consent, Driver License). Always take top priority.\n"
        "2. TIER 2: Parsed Resume Experience, Skills, Titles & Professional Summary.\n"
        "3. TIER 3: Persistent Q&A Memory (past answers the user previously provided to custom employer questions).\n"
        "4. TIER 4 (FALLBACK): Situational reasoning from career summary, or 'ask_user' if an unusual question cannot be reliably inferred.\n\n"
        "AVAILABLE ACTIONS:\n"
        "1. 'fill_step': STRONGLY RECOMMENDED for form steps. When you see one or multiple input fields, radio buttons, checkboxes, or dropdowns to answer on the current step/page.\n"
        "   Required keys:\n"
        "     - 'fields': Array of objects: [{'selector': CSS selector, 'action_type': 'type' | 'click' | 'upload_resume', 'value': string to type (or empty for click), 'label': field label}]\n"
        "     - 'next_selector': (Optional) CSS selector of the Next / Continue / Review button to click after filling all fields on this step.\n"
        "     - 'reasoning': 1-2 sentence narration of what you filled on this step and what action comes next.\n"
        "2. 'click': When you only need to click a single button, link, or tab (e.g. initial 'Apply' button, modal trigger).\n"
        "   Required keys: 'selector' (valid, specific CSS selector to click), 'reasoning'\n"
        "3. 'type': When you need to type into a single isolated input field.\n"
        "   Required keys: 'selector' (CSS selector), 'text' (exact string to type), 'reasoning'\n"
        "4. 'scroll': When visible fields are complete and more questions/submit buttons are located below the fold.\n"
        "   Required keys: 'direction' ('down' or 'up'), 'reasoning'\n"
        "5. 'upload_resume': When you see a file upload field/dropzone for Resume/CV.\n"
        "   Required keys: 'selector' (input[type='file'] or upload dropzone selector), 'reasoning'\n"
        "6. 'ask_user': When there is an unusual, custom, or critical question you cannot answer from profile or memory.\n"
        "   Required keys: 'question' (clear human-readable question), 'field_selector', 'reasoning'\n"
        "7. 'request_approval': When all form steps are filled and you reach the FINAL Review/Submit step.\n"
        "   Required keys: 'submit_selector', 'summary' (brief bullet summary of what was filled), 'reasoning'\n"
        "8. 'new_tab_expected': When clicking a button that redirects to an external employer ATS (Workday/Greenhouse/etc.).\n"
        "   Required keys: 'selector', 'reasoning'\n"
        "9. 'captcha': When you detect a Cloudflare Turnstile, reCAPTCHA, hCaptcha, or bot challenge.\n"
        "   Required keys: 'reasoning'\n"
        "10. 'stuck': When the page is unreadable, completely unexpected, or unable to find next steps.\n"
        "   Required keys: 'reason', 'reasoning'\n"
        "11. 'done': When the application has been successfully submitted (confirmation / thank you message).\n"
        "   Required keys: 'reasoning'\n\n"
        "CRITICAL RULES:\n"
        "- Whenever multiple form questions or inputs are present in form_schema, ALWAYS use 'fill_step' to answer them all in one batch. This minimizes API round trips.\n"
        "- Reason step-by-step. Your 'reasoning' should sound like a smart, friendly co-pilot narrating its thought process to the user in 1-2 concise sentences.\n"
        "- Always prefer precise CSS selectors (e.g. 'button.ia-IndeedApplyButton', 'input[name=\"email\"]', 'button[aria-label*=\"Easy Apply\"]').\n"
        "- Check the 'history' array so you do NOT repeat an action you already performed.\n"
        "- Return ONLY a single valid JSON object."
    )

    clean_profile = {
        "full_name": profile_data.get("full_name", ""),
        "email": profile_data.get("email", ""),
        "phone": profile_data.get("phone", ""),
        "location": profile_data.get("location", "Philippines"),
        "skills": profile_data.get("skills", []),
        "languages": profile_data.get("languages", []),
        "years_of_experience": profile_data.get("years_of_experience", 3),
        "current_title": profile_data.get("current_title", ""),
        "screening_defaults": profile_data.get("screening_defaults", {}),
        "summary": profile_data.get("summary", "")[:800]
    }

    user_prompt_data = {
        "page_url": page_url,
        "page_title": page_title,
        "navigation_history": history[-8:] if history else [],
        "target_job": {
            "title": job_context.get("title", ""),
            "company": job_context.get("company", ""),
            "description": job_context.get("description", "")[:800]
        },
        "candidate_profile": clean_profile,
        "remembered_qa_memory": qa_memory_list[:25]
    }

    if form_schema:
        user_prompt_data["form_schema"] = form_schema
    elif dom_snapshot:
        user_prompt_data["dom_snapshot"] = dom_snapshot[:2000]

    try:
        contents_list = []
        if screenshot_b64 and len(screenshot_b64) > 100 and not form_schema:
            raw_b64 = screenshot_b64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            try:
                image_bytes = base64.b64decode(raw_b64)
                image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
                contents_list.append(image_part)
            except Exception as img_err:
                logger.warning(f"Could not parse image bytes: {img_err}")

        contents_list.append(
            f"Here is the structured job application form context:\n{json.dumps(user_prompt_data, indent=2)}\n\nDetermine the next action:"
        )

        client = get_genai_client(api_key)
        resp = generate_content_with_fallback(
            client=client,
            primary_model=model_name,
            contents=contents_list,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.2,
            )
        )

        if resp.text:
            action_data = json.loads(resp.text)
            if isinstance(action_data, dict) and "action" in action_data:
                return action_data
    except Exception as exc:
        logger.error(f"Error in navigate_browser_step with Gemini: {exc}")
        return {
            "action": "stuck",
            "reason": f"AI Perception error: {str(exc)}",
            "reasoning": f"Encountered an issue analyzing the page ({str(exc)[:60]}...)"
        }

    return {
        "action": "stuck",
        "reason": "Unable to determine next action from page",
        "reasoning": "I analyzed the page but couldn't find a clear next step."
    }
