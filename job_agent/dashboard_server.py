"""
Tracky Dashboard HTTP Server & AI Extension API Gateway
Serves static Next.js GUI build and provides REST APIs for settings, scraper controls,
job listings, candidate profile, and Gemini AI application automation.
"""
import base64
import json
import logging
import os
import signal
import sys
import threading
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from datetime import datetime
import time
from pathlib import Path
from typing import Any, Dict, List

import db
import profile_manager
import ai_applier

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
STATUS_PATH = BASE_DIR / "status.json"
RUN_NOW_FLAG = BASE_DIR / "run_now.flag"
STATIC_DIR = BASE_DIR.parent / "frontend" / "out"

AI_SESSION_STATE: Dict[str, Any] = {
    "active": False,
    "paused": False,
    "mode": "batch",
    "current_job": None,
    "session_id": "",
    "started_at": "",
    "daily_max": 10,
    "applied_today": 0,
    "log": []
}


class DashboardAPIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve from frontend/out if it exists, otherwise project root
        static_path = STATIC_DIR if STATIC_DIR.exists() else BASE_DIR
        super().__init__(*args, directory=str(static_path), **kwargs)

    def _send_json(self, data: Any, status: int = 200) -> None:
        payload = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(payload)

    def _read_body_json(self) -> Dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length == 0:
                return {}
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # ── API Routes ──────────────────────────────────────────────────────
        if path == "/api/status":
            stats = {"total_jobs": 0, "today_new_jobs": 0, "total_alerted": 0, "total_applied": 0, "sources": {}}
            try:
                conn = db.get_connection()
                stats = db.get_stats(conn)
                conn.close()
            except Exception as exc:
                logger.error(f"Error fetching stats in /api/status: {exc}")

            status_data = {}
            if STATUS_PATH.exists():
                try:
                    status_data = json.loads(STATUS_PATH.read_text(encoding="utf-8"))
                except Exception:
                    pass
            config_data = {}
            if CONFIG_PATH.exists():
                try:
                    config_data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                except Exception:
                    pass

            self._send_json({
                "status": "online",
                "last_scan_time": status_data.get("last_scan_time", "Never"),
                "stats": stats,
                "paused": config_data.get("paused", False),
                "interval": config_data.get("check_interval_minutes", 60),
                "location": config_data.get("location", "Philippines"),
                "keywords": config_data.get("keywords", []),
                "recipient": config_data.get("recipient", ""),
            })

        elif path == "/api/jobs":
            try:
                conn = db.get_connection()
                limit = int(query.get("limit", [100])[0])
                search = query.get("search", [None])[0]
                source = query.get("source", [None])[0]
                alert_status = query.get("alert_status", [None])[0]
                jobs = db.get_jobs(conn, limit=limit, search=search, source=source, alert_status=alert_status)
                conn.close()
                self._send_json({"jobs": jobs, "total": len(jobs)})
            except Exception as exc:
                logger.error(f"Error fetching jobs in /api/jobs: {exc}")
                self._send_json({"jobs": [], "total": 0, "error": str(exc)}, 500)

        elif path == "/api/settings":
            if CONFIG_PATH.exists():
                try:
                    self._send_json(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
                except Exception as e:
                    self._send_json({"error": str(e)}, 500)
            else:
                self._send_json({})

        elif path == "/api/profile":
            prof = profile_manager.load_profile()
            self._send_json(prof)

        elif path == "/api/applications":
            try:
                conn = db.get_connection()
                limit = int(query.get("limit", [100])[0])
                apps = db.get_applications(conn, limit=limit)
                conn.close()
                self._send_json({"applications": apps, "total": len(apps)})
            except Exception as exc:
                logger.error(f"Error fetching applications: {exc}")
                self._send_json({"applications": [], "total": 0, "error": str(exc)}, 500)

        elif path == "/api/ai/session/status":
            try:
                conn = db.get_connection()
                applied_today = db.count_today_applications(conn)
                conn.close()
                AI_SESSION_STATE["applied_today"] = applied_today
            except Exception:
                pass
            self._send_json(AI_SESSION_STATE)

        elif path == "/api/ai/session/next-job":
            try:
                conn = db.get_connection()
                profile = profile_manager.load_profile()
                ai_settings = profile.get("ai_settings", {})
                min_score = int(ai_settings.get("min_match_score", 60))
                pending = db.get_pending_jobs(conn, limit=1, min_match_score=min_score)
                conn.close()
                if pending:
                    self._send_json({"job": pending[0]})
                else:
                    self._send_json({"job": None, "message": "No pending jobs matching score threshold."})
            except Exception as exc:
                logger.error(f"Error getting next batch job: {exc}")
                self._send_json({"job": None, "error": str(exc)}, 500)

        elif path == "/api/ai/session-settings":
            prof = profile_manager.load_profile()
            self._send_json(prof.get("ai_settings", {}))

        else:
            # Serve Static Assets (HTML/CSS/JS/Images)
            super().do_GET()

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/scan-now":
            RUN_NOW_FLAG.touch()
            pid_file = BASE_DIR / "daemon.pid"
            if pid_file.exists():
                try:
                    pid = int(pid_file.read_text().strip())
                    os.kill(pid, signal.SIGUSR1)
                except Exception:
                    pass
            self._send_json({"status": "triggered", "message": "Scan triggered successfully!"})

        elif path == "/api/pause":
            if CONFIG_PATH.exists():
                try:
                    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                    cfg["paused"] = True
                    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
                    self._send_json({"status": "success", "paused": True})
                    return
                except Exception as e:
                    self._send_json({"error": str(e)}, 500)
                    return
            self._send_json({"error": "config not found"}, 404)

        elif path == "/api/resume":
            if CONFIG_PATH.exists():
                try:
                    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                    cfg["paused"] = False
                    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
                    self._send_json({"status": "success", "paused": False})
                    return
                except Exception as e:
                    self._send_json({"error": str(e)}, 500)
                    return
            self._send_json({"error": "config not found"}, 404)

        elif path == "/api/settings":
            body = self._read_body_json()
            try:
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(body, f, indent=2)
                self._send_json({"status": "success", "settings": body})
            except Exception as e:
                self._send_json({"error": str(e)}, 500)

        elif path == "/api/profile":
            body = self._read_body_json()
            ok = profile_manager.save_profile(body)
            if ok:
                self._send_json({"status": "success", "profile": body})
            else:
                self._send_json({"error": "Failed to save profile"}, 500)

        elif path == "/api/profile/resume-upload":
            body = self._read_body_json()
            filename = body.get("filename", "resume.pdf")
            b64_content = body.get("content_base64", "")

            if not b64_content:
                self._send_json({"error": "Missing PDF content"}, 400)
                return

            try:
                pdf_bytes = base64.b64decode(b64_content)
                extracted_text = profile_manager.extract_text_from_pdf(pdf_bytes)
                parsed_fields = profile_manager.parse_resume_fields(extracted_text)

                profile = profile_manager.load_profile()
                profile["resume_filename"] = filename
                profile["summary"] = extracted_text[:1500] if not profile.get("summary") else profile["summary"]
                for k, v in parsed_fields.items():
                    if v and (not profile.get(k) or k == "skills"):
                        profile[k] = v

                profile_manager.save_profile(profile)
                self._send_json({
                    "status": "success",
                    "filename": filename,
                    "extracted_length": len(extracted_text),
                    "parsed_fields": parsed_fields,
                    "profile": profile
                })
            except Exception as exc:
                logger.error(f"Error processing resume upload: {exc}")
                self._send_json({"error": str(exc)}, 500)

        elif path == "/api/ai/test-key":
            body = self._read_body_json()
            api_key = body.get("api_key", "")
            model_name = body.get("model_name", "gemini-3.7-flash")
            ok, msg = ai_applier.validate_gemini_key(api_key, model_name=model_name)
            self._send_json({"success": ok, "message": msg})

        elif path == "/api/ai/answer-form":
            body = self._read_body_json()
            questions = body.get("questions", [])
            job_details = body.get("job_details", {})
            profile = profile_manager.load_profile()
            api_key = profile.get("ai_settings", {}).get("gemini_api_key", "")
            model_name = profile.get("ai_settings", {}).get("gemini_model", "gemini-3.7-flash")

            answers = ai_applier.answer_screening_questions(
                questions=questions,
                job_details=job_details,
                profile_data=profile,
                api_key=api_key,
                model_name=model_name
            )
            self._send_json({"answers": answers})

        elif path == "/api/ai/cover-letter":
            body = self._read_body_json()
            job_details = body.get("job_details", {})
            profile = profile_manager.load_profile()
            api_key = profile.get("ai_settings", {}).get("gemini_api_key", "")
            model_name = profile.get("ai_settings", {}).get("gemini_model", "gemini-3.7-flash")

            letter = ai_applier.generate_tailored_cover_letter(
                job_details=job_details,
                profile_data=profile,
                api_key=api_key,
                model_name=model_name
            )
            self._send_json({"cover_letter": letter})

        elif path == "/api/ai/navigate":
            body = self._read_body_json()
            screenshot_b64 = body.get("screenshot_b64", "")
            page_url = body.get("page_url", "")
            page_title = body.get("page_title", "")
            history = body.get("history", [])
            job_context = body.get("job_context", {})
            dom_snapshot = body.get("dom_snapshot", "")
            form_schema = body.get("form_schema", None)

            profile = profile_manager.load_profile()
            api_key = profile.get("ai_settings", {}).get("gemini_api_key", "")
            model_name = profile.get("ai_settings", {}).get("gemini_model", "gemini-3.7-flash")

            action_data = ai_applier.navigate_browser_step(
                screenshot_b64=screenshot_b64,
                page_url=page_url,
                page_title=page_title,
                history=history,
                profile_data=profile,
                job_context=job_context,
                api_key=api_key,
                model_name=model_name,
                dom_snapshot=dom_snapshot,
                form_schema=form_schema
            )

            if action_data and action_data.get("reasoning"):
                if "current_steps" not in AI_SESSION_STATE:
                    AI_SESSION_STATE["current_steps"] = []
                AI_SESSION_STATE["current_steps"].append({
                    "step": len(AI_SESSION_STATE["current_steps"]) + 1,
                    "action": action_data.get("action", "inspect"),
                    "reasoning": action_data.get("reasoning", ""),
                    "fields": action_data.get("fields", []),
                    "timestamp": datetime.now().strftime("%I:%M:%S %p")
                })

            self._send_json(action_data)

        elif path == "/api/ai/score-job":
            body = self._read_body_json()
            job_details = body.get("job_details", {})
            profile = profile_manager.load_profile()
            api_key = profile.get("ai_settings", {}).get("gemini_api_key", "")
            model_name = profile.get("ai_settings", {}).get("gemini_model", "gemini-3.7-flash")
            score = ai_applier.score_job_match(job_details, profile, api_key, model_name)
            self._send_json({"match_score": score})

        elif path == "/api/ai/session/start":
            body = self._read_body_json()
            mode = body.get("mode", "batch")
            job = body.get("job", None)
            AI_SESSION_STATE["active"] = True
            AI_SESSION_STATE["paused"] = False
            AI_SESSION_STATE["mode"] = mode
            AI_SESSION_STATE["current_job"] = job
            AI_SESSION_STATE["current_steps"] = []
            AI_SESSION_STATE["session_id"] = str(int(time.time()))
            AI_SESSION_STATE["started_at"] = datetime.now().isoformat()
            self._send_json({"status": "started", "session": AI_SESSION_STATE})

        elif path == "/api/ai/session/pause":
            AI_SESSION_STATE["paused"] = True
            self._send_json({"status": "paused", "session": AI_SESSION_STATE})

        elif path == "/api/ai/session/resume":
            AI_SESSION_STATE["paused"] = False
            self._send_json({"status": "resumed", "session": AI_SESSION_STATE})

        elif path == "/api/ai/session/stop":
            AI_SESSION_STATE["active"] = False
            AI_SESSION_STATE["paused"] = False
            AI_SESSION_STATE["current_job"] = None
            AI_SESSION_STATE["current_steps"] = []
            self._send_json({"status": "stopped", "session": AI_SESSION_STATE})

        elif path == "/api/ai/session/record-job":
            body = self._read_body_json()
            try:
                conn = db.get_connection()
                app_id = db.record_application(conn, body)
                applied_today = db.count_today_applications(conn)
                conn.close()
                AI_SESSION_STATE["applied_today"] = applied_today
            except Exception as exc:
                logger.error(f"Error recording session job: {exc}")
                app_id = 0

            log_entry = {
                "title": body.get("title", "Unknown Role"),
                "company": body.get("company", "Unknown"),
                "source": body.get("source", "Web"),
                "match_score": body.get("match_score", 85),
                "status": body.get("status", "applied"),
                "reasoning_steps": body.get("reasoning_steps", AI_SESSION_STATE.get("current_steps", [])),
                "timestamp": datetime.now().strftime("%I:%M %p")
            }
            AI_SESSION_STATE["log"].insert(0, log_entry)
            AI_SESSION_STATE["current_steps"] = []
            if len(AI_SESSION_STATE["log"]) > 50:
                AI_SESSION_STATE["log"] = AI_SESSION_STATE["log"][:50]

            self._send_json({"status": "recorded", "application_id": app_id, "session": AI_SESSION_STATE})

        elif path == "/api/ai/session-settings":
            body = self._read_body_json()
            try:
                profile = profile_manager.load_profile()
                if "ai_settings" not in profile:
                    profile["ai_settings"] = {}
                profile["ai_settings"].update(body)
                profile_manager.save_profile(profile)
                self._send_json({"status": "success", "ai_settings": profile["ai_settings"]})
            except Exception as exc:
                logger.error(f"Error saving session settings: {exc}")
                self._send_json({"error": str(exc)}, 500)

        elif path == "/api/applications/record":
            body = self._read_body_json()
            try:
                conn = db.get_connection()
                app_id = db.record_application(conn, body)
                conn.close()
                self._send_json({"status": "success", "application_id": app_id})
            except Exception as exc:
                logger.error(f"Error recording application: {exc}")
                self._send_json({"error": str(exc)}, 500)

        else:
            self._send_json({"error": f"Unknown endpoint: {path}"}, 404)

    def do_DELETE(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/jobs":
            # Bulk delete or delete all
            body = self._read_body_json()
            job_ids = body.get("job_ids", [])
            delete_all = body.get("delete_all", False)
            block_future = body.get("block_future", True)
            source = body.get("source", None)
            search = body.get("search", None)

            conn = db.get_connection()
            if delete_all:
                count = db.delete_all_jobs(conn, block_future=block_future, source=source, search=search)
            else:
                count = db.delete_jobs(conn, job_ids, block_future=block_future)
            conn.close()

            self._send_json({
                "status": "success",
                "deleted_count": count,
                "message": f"Successfully deleted {count} job listing(s)."
            })
        else:
            self._send_json({"error": f"Unknown DELETE endpoint: {path}"}, 404)

    def log_message(self, format, *args) -> None:
        pass


def start_dashboard_server(port: int = 5050, background: bool = True) -> ThreadingHTTPServer:
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, DashboardAPIHandler)

    if background:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True, name="dashboard_server")
        thread.start()
        logger.info(f"🚀 Tracky Dashboard Server running in background at http://127.0.0.1:{port}")
    else:
        logger.info(f"🚀 Tracky Dashboard Server running at http://127.0.0.1:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.server_close()
            logger.info("Dashboard server stopped.")
    return httpd


def start_server():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
    start_dashboard_server(port=port, background=False)


if __name__ == "__main__":
    start_server()
