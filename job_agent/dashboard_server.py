"""
Tracky GUI Dashboard Server.
Ultra-lightweight, zero-dependency local HTTP API and frontend server on http://127.0.0.1:5050.
"""
import json
import logging
import os
import signal
import threading
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

import db

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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # ── API Routes ──────────────────────────────────────────────────────
        if path == "/api/status":
            stats = {"total_jobs": 0, "today_new_jobs": 0, "sources": {}}
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
            conn = db.get_connection()
            limit = int(query.get("limit", [100])[0])
            search = query.get("search", [None])[0]
            source = query.get("source", [None])[0]
            jobs = db.get_jobs(conn, limit=limit, search=search, source=source)
            conn.close()
            self._send_json({"jobs": jobs, "total": len(jobs)})

        elif path == "/api/settings":
            if CONFIG_PATH.exists():
                try:
                    self._send_json(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
                except Exception as e:
                    self._send_json({"error": str(e)}, 500)
            else:
                self._send_json({})

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

        else:
            self._send_json({"error": f"Unknown endpoint: {path}"}, 404)

    def do_DELETE(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/jobs":
            body = self._read_body_json()
            job_ids = body.get("job_ids", [])
            delete_all = body.get("all", False)
            block_future = body.get("block_future", True)
            source = body.get("source") or (query.get("source", [None])[0] if query.get("source") else None)
            search = body.get("search") or (query.get("search", [None])[0] if query.get("search") else None)

            conn = db.get_connection()
            deleted_count = 0
            try:
                if delete_all:
                    deleted_count = db.delete_all_jobs(
                        conn, block_future=block_future, source=source, search=search
                    )
                elif job_ids:
                    deleted_count = db.delete_jobs(conn, job_ids, block_future=block_future)
                stats = db.get_stats(conn)
                self._send_json({
                    "status": "success",
                    "deleted_count": deleted_count,
                    "stats": stats,
                })
            except Exception as exc:
                logger.error(f"Error in do_DELETE /api/jobs: {exc}")
                self._send_json({"error": str(exc)}, 500)
            finally:
                conn.close()
        else:
            self._send_json({"error": f"Unknown endpoint: {path}"}, 404)


def start_dashboard_server(port: int = PORT, background: bool = False) -> Optional[HTTPServer]:
    """Start the dashboard HTTP server."""
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, DashboardAPIHandler)
    logger.info(f"🚀 Tracky Dashboard Server running at http://127.0.0.1:{port}")

    if background:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True, name="dashboard_server")
        thread.start()
        return httpd
    else:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Dashboard server shutting down...")
        finally:
            httpd.server_close()
        return None


def start_server(port: int = PORT) -> None:
    start_dashboard_server(port=port, background=False)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    start_server()
