"""
Tracky GUI Dashboard Server.
Ultra-lightweight, zero-dependency local HTTP API and frontend server on http://127.0.0.1:5050.
"""
import io
import json

import logging
import mimetypes
import os
import shutil
import threading
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

import ai_parser
import db
import profile_manager
from applier import browser_manager
from applier.engine import apply_to_job, check_platform_sessions, SCREENSHOTS_DIR
from applier.session_manager import (
    launch_interactive_login,
    verify_and_save_active_session,
    cancel_active_login,
    get_all_session_statuses,
    get_session_details,
)


logger = logging.getLogger("dashboard_server")

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
CONFIG_PATH = BASE_DIR / "config.json"
STATUS_PATH = BASE_DIR / "status.json"
RUN_NOW_FLAG = BASE_DIR / "run_now.flag"
PORT = 5050


class DashboardAPIHandler(SimpleHTTPRequestHandler):
    """Handles REST API requests and static assets for the Tracky GUI."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def _send_json(self, data: dict | list, status: int = 200) -> None:
        payload = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(payload)

    def _send_file_bytes(self, data: bytes, content_type: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _read_body_json(self) -> dict:
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        body = self.rfile.read(content_len)
        try:
            return json.loads(body.decode("utf-8"))
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # ── API Routes ──────────────────────────────────────────────────────
        if path == "/api/status":
            conn = db.get_connection()
            stats = db.get_application_stats(conn)
            conn.close()
            status_data = {}
            if STATUS_PATH.exists():
                try:
                    status_data = json.loads(STATUS_PATH.read_text())
                except Exception:
                    pass
            config_data = {}
            if CONFIG_PATH.exists():
                try:
                    config_data = json.loads(CONFIG_PATH.read_text())
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
            })

        elif path == "/api/jobs":
            conn = db.get_connection()
            limit = int(query.get("limit", [100])[0])
            search = query.get("search", [None])[0]
            source = query.get("source", [None])[0]
            jobs = db.get_jobs(conn, limit=limit, search=search, source=source)
            conn.close()
            self._send_json({"jobs": jobs, "total": len(jobs)})

        elif path == "/api/profile":
            prof = profile_manager.get_profile()
            self._send_json(prof)

        elif path == "/api/resume/view":
            resume_path = profile_manager.get_resume_path()
            if resume_path and resume_path.exists():
                data = resume_path.read_bytes()
                self._send_file_bytes(data, "application/pdf")
            else:
                self._send_json({"error": "No resume uploaded yet."}, 404)

        elif path == "/api/sessions":
            sessions = check_platform_sessions()
            self._send_json({"sessions": sessions})

        elif path == "/api/applications":
            conn = db.get_connection()
            apps = db.get_applications(conn, limit=100)
            conn.close()
            self._send_json({"applications": apps})

        elif path.startswith("/api/screenshot/"):
            filename = Path(path.replace("/api/screenshot/", "")).name
            scr_path = (SCREENSHOTS_DIR / filename).resolve()
            if scr_path.is_relative_to(SCREENSHOTS_DIR.resolve()) and scr_path.exists() and scr_path.is_file():
                self._send_file_bytes(scr_path.read_bytes(), "image/png")
            else:
                self._send_json({"error": "Screenshot not found."}, 404)

        elif path == "/api/settings":
            if CONFIG_PATH.exists():
                try:
                    self._send_json(json.loads(CONFIG_PATH.read_text()))
                except Exception as e:
                    self._send_json({"error": str(e)}, 500)
            else:
                self._send_json({})

        elif path == "/api/browsers":
            try:
                browsers = browser_manager.detect_available_browsers()
                preferred = browser_manager.get_preferred_browser(CONFIG_PATH)
                self._send_json({
                    "browsers": browsers,
                    "preferred": preferred,
                })
            except Exception as e:
                self._send_json({"error": str(e)}, 500)

        else:
            # Serve Static Assets (HTML/CSS/JS/Images)
            super().do_GET()

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/scan-now":
            RUN_NOW_FLAG.touch()
            # Also try SIGUSR1 to daemon if PID exists
            pid_file = BASE_DIR / "daemon.pid"
            if pid_file.exists():
                try:
                    pid = int(pid_file.read_text().strip())
                    import signal
                    os.kill(pid, signal.SIGUSR1)
                except Exception:
                    pass
            self._send_json({"status": "triggered", "message": "Scan triggered successfully!"})

        elif path == "/api/profile":
            body = self._read_body_json()
            try:
                saved = profile_manager.save_profile(body)
                self._send_json({"status": "success", "profile": saved})
            except Exception as e:
                self._send_json({"error": str(e)}, 500)

        elif path == "/api/settings":
            body = self._read_body_json()
            try:
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    json.dump(body, f, indent=2)
                self._send_json({"status": "success", "settings": body})
            except Exception as e:
                self._send_json({"error": str(e)}, 500)

        elif path == "/api/resume/upload":
            content_type = self.headers.get("Content-Type", "")
            if not content_type.startswith("multipart/form-data"):
                self._send_json({"error": "Content-Type must be multipart/form-data"}, 400)
                return

            try:
                # Parse multipart body
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len)
                boundary = content_type.split("boundary=")[1].encode("utf-8")
                
                parts = body.split(b"--" + boundary)
                saved_path = None
                saved_name = ""

                for part in parts:
                    if b'filename="' in part:
                        headers_part, file_data = part.split(b"\r\n\r\n", 1)
                        # Extract filename
                        for line in headers_part.split(b"\r\n"):
                            if b"Content-Disposition" in line and b'filename="' in line:
                                filename_bytes = line.split(b'filename="')[1].split(b'"')[0]
                                saved_name = filename_bytes.decode("utf-8", errors="ignore")
                        # Clean trailing \r\n
                        if file_data.endswith(b"\r\n"):
                            file_data = file_data[:-2]

                        if saved_name and file_data:
                            saved_path = profile_manager.save_resume_file(saved_name, file_data)
                            break

                if saved_path:
                    # Trigger Gemini AI Resume Analysis & Profile Auto-Fill
                    updated_profile, ai_success, ai_msg = ai_parser.autofill_profile_from_resume(
                        Path(saved_path), CONFIG_PATH
                    )

                    self._send_json({
                        "status": "success",
                        "message": ai_msg,
                        "path": saved_path,
                        "ai_analyzed": ai_success,
                        "profile": updated_profile,
                    })
                else:
                    self._send_json({"error": "Could not parse uploaded PDF file."}, 400)
            except Exception as exc:
                logger.error(f"Upload error: {exc}")
                self._send_json({"error": f"Upload failed: {str(exc)}"}, 500)

        elif path == "/api/resume/analyze":
            resume_path = profile_manager.get_resume_path()

            if not resume_path or not resume_path.exists():
                self._send_json({"error": "No uploaded resume found to analyze."}, 400)
                return

            updated_profile, ai_success, ai_msg = ai_parser.autofill_profile_from_resume(
                resume_path, CONFIG_PATH
            )
            self._send_json({
                "status": "success" if ai_success else "error",
                "message": ai_msg,
                "ai_analyzed": ai_success,
                "profile": updated_profile,
            })


        elif path == "/api/browsers/preferred":
            body = self._read_body_json()
            browser_id = body.get("browser", "")
            if not browser_id:
                self._send_json({"error": "browser required"}, 400)
                return
            saved = browser_manager.set_preferred_browser(browser_id, CONFIG_PATH)
            self._send_json({"status": "success", "preferred": saved})

        elif path == "/api/sessions/login":
            body = self._read_body_json()
            platform = body.get("platform", "")
            browser_id = body.get("browser")
            if not platform:
                self._send_json({"error": "platform required"}, 400)
                return

            def _login_worker():
                try:
                    launch_interactive_login(platform)
                except Exception as exc:
                    logger.error(f"Login worker error: {exc}")

            threading.Thread(target=_login_worker, daemon=True).start()
            self._send_json({
                "status": "launched",
                "platform": platform,
                "message": f"Interactive session helper launched for {platform}. Log in and click 'Verify & Save' when done.",
            })

        elif path == "/api/sessions/verify":
            body = self._read_body_json()
            platform = body.get("platform", "")
            if not platform:
                self._send_json({"error": "platform required"}, 400)
                return
            result = verify_and_save_active_session(platform)
            self._send_json(result)

        elif path == "/api/sessions/cancel":
            body = self._read_body_json()
            platform = body.get("platform", "")
            if not platform:
                self._send_json({"error": "platform required"}, 400)
                return
            result = cancel_active_login(platform)
            self._send_json(result)

        elif path == "/api/apply":
            body = self._read_body_json()
            job_id = body.get("job_id")
            mode = body.get("mode", "manual")
            custom_note = body.get("custom_note", "")

            if not job_id:
                self._send_json({"error": "job_id is required"}, 400)
                return

            def _apply_worker():
                try:
                    apply_to_job(job_id=job_id, mode=mode, custom_note=custom_note)
                except Exception as exc:
                    logger.error(f"Apply worker error: {exc}")

            # Run in thread so API responds promptly
            threading.Thread(target=_apply_worker, daemon=True).start()
            self._send_json({
                "status": "started",
                "message": "Application process initiated! Check Application History tab for real-time progress.",
            })

        else:
            self._send_json({"error": "Endpoint not found."}, 404)


class ThreadingHTTPServer(HTTPServer):
    daemon_threads = True


def start_dashboard_server(port: int = PORT, background: bool = True) -> Optional[HTTPServer]:
    """Start the Tracky GUI Dashboard server."""
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    server_address = ("127.0.0.1", port)

    # Disable auto-apply mode by default when app starts up
    try:
        profile_manager.disable_auto_apply()
    except Exception as e:
        logger.warning(f"Could not disable auto apply on startup: {e}")

    try:

        httpd = ThreadingHTTPServer(server_address, DashboardAPIHandler)
        logger.info(f"🐶 Tracky Dashboard running at http://127.0.0.1:{port}")
        
        if background:
            server_thread = threading.Thread(
                target=httpd.serve_forever,
                name="dashboard_server",
                daemon=True,
            )
            server_thread.start()
            return httpd
        else:
            httpd.serve_forever()
            return httpd
    except Exception as exc:
        logger.error(f"Could not start dashboard server: {exc}")
        return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start_dashboard_server(background=False)
