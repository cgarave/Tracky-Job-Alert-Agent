"""
Unit and integration tests for Tracky Application Engine, Profile Manager, and GUI API.
Uses isolated temporary directories so the real database and profile are never polluted.
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

# Ensure job_agent is on sys.path
BASE_DIR = Path(__file__).parent.parent / "job_agent"
sys.path.insert(0, str(BASE_DIR))

import db
import profile_manager
import commander
from applier.session_manager import get_all_session_statuses


class TestTrackyModules(unittest.TestCase):

    def setUp(self):
        # Create a temporary directory for isolated DB and profile testing
        self.test_dir = tempfile.mkdtemp()
        self.test_db_path = Path(self.test_dir) / "test_seen_jobs.db"

        # Patch db.DB_PATH to temporary test database
        self.orig_db_path = db.DB_PATH
        db.DB_PATH = self.test_db_path
        self.conn = db.get_connection()

    def tearDown(self):
        self.conn.close()
        db.DB_PATH = self.orig_db_path
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_database_schema_and_application_tracking(self):
        """Verify jobs and application recording in isolated database."""
        test_job_id = db.make_job_id("Senior Python Developer", "TestCorp", "https://example.com/job123")
        job = {
            "job_id": test_job_id,
            "title": "Senior Python Developer",
            "company": "TestCorp",
            "url": "https://example.com/job123",
            "source": "Indeed.ph",
            "location": "Taguig, Metro Manila",
            "salary": "PHP 120,000",
            "apply_type": "easy_apply",
        }
        db.mark_seen(self.conn, job)

        # Retrieve job
        fetched = db.get_job_by_id(self.conn, test_job_id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["title"], "Senior Python Developer")
        self.assertEqual(fetched["company"], "TestCorp")

        # Record application
        app_id = db.record_application(
            self.conn,
            job_id=test_job_id,
            status="submitted",
            mode="manual",
            notes="Applied with Juan_Resume.pdf",
            screenshot_path="test_screenshot.png",
        )
        self.assertGreater(app_id, 0)

        # Check applications list
        apps = db.get_applications(self.conn, limit=10)
        self.assertTrue(any(a["job_id"] == test_job_id for a in apps))

        # Check stats
        stats = db.get_application_stats(self.conn)
        self.assertEqual(stats["total_jobs"], 1)
        self.assertEqual(stats["total_applied"], 1)

    def test_profile_manager_and_authentic_resume_upload(self):
        """Verify profile saving and authentic resume PDF management in test directory."""
        orig_data_dir = profile_manager.DATA_DIR
        orig_resumes_dir = profile_manager.RESUMES_DIR
        orig_profile_path = profile_manager.PROFILE_PATH

        test_data_dir = Path(self.test_dir) / "data"
        test_resumes_dir = test_data_dir / "resumes"
        test_profile_path = test_data_dir / "user_profile.json"
        test_resumes_dir.mkdir(parents=True, exist_ok=True)

        profile_manager.DATA_DIR = test_data_dir
        profile_manager.RESUMES_DIR = test_resumes_dir
        profile_manager.PROFILE_PATH = test_profile_path

        try:
            prof = profile_manager.get_profile()
            self.assertIn("personal", prof)
            self.assertIn("work_preferences", prof)
            self.assertIn("resume", prof)

            # Test uploading a real/dummy PDF resume
            fake_pdf_bytes = b"%PDF-1.4 Fake PDF Resume Content for Testing"
            saved_path_str = profile_manager.save_resume_file("Juan_Dela_Cruz_Resume.pdf", fake_pdf_bytes)

            saved_path = Path(saved_path_str)
            self.assertTrue(saved_path.exists())
            self.assertEqual(saved_path.read_bytes(), fake_pdf_bytes)

            # Check get_resume_path
            retrieved_path = profile_manager.get_resume_path()
            self.assertIsNotNone(retrieved_path)
            self.assertEqual(retrieved_path, saved_path)

            # Screening context
            ctx = profile_manager.get_screening_context()
            self.assertIn("skills", ctx)
            self.assertIn("experience_years", ctx)
        finally:
            profile_manager.DATA_DIR = orig_data_dir
            profile_manager.RESUMES_DIR = orig_resumes_dir
            profile_manager.PROFILE_PATH = orig_profile_path

    def test_session_manager(self):
        """Verify session status retrieval."""
        statuses = get_all_session_statuses()
        self.assertIn("indeed", statuses)
        self.assertIn("jobstreet", statuses)
        self.assertIn("onlinejobs", statuses)

    def test_commander_new_commands(self):
        """Verify new iMessage commands (/apply, /autoapply, /dailycap, /dashboard)."""
        messages_sent = []

        def mock_send(msg):
            messages_sent.append(msg)

        # /dashboard
        commander.execute("/dashboard", mock_send)
        self.assertTrue(any("127.0.0.1:5050" in m for m in messages_sent))

        # /autoapply
        messages_sent.clear()
        commander.execute("/autoapply on", mock_send)
        self.assertTrue(any("Auto-apply ENABLED" in m for m in messages_sent))

        # /dailycap
        messages_sent.clear()
        commander.execute("/dailycap 10", mock_send)
        self.assertTrue(any("daily cap set to 10" in m for m in messages_sent))

        # /applications
        messages_sent.clear()
        commander.execute("/applications", mock_send)
        self.assertTrue(any("applications" in m.lower() for m in messages_sent))

    def test_dashboard_server_endpoints(self):
        """Verify dashboard server endpoints by spinning up server on test port."""
        import urllib.request
        from dashboard_server import start_dashboard_server

        test_port = 5058
        httpd = start_dashboard_server(port=test_port, background=True)
        self.assertIsNotNone(httpd)

        try:
            # 1. GET /
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/") as resp:
                self.assertEqual(resp.status, 200)
                html = resp.read().decode("utf-8")
                self.assertIn("Tracky", html)
                self.assertIn("Scraped Jobs", html)

            # 2. GET /api/status
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/api/status") as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(data["status"], "online")

            # 3. GET /api/profile
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/api/profile") as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertIn("personal", data)

            # 4. GET /api/jobs
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/api/jobs") as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertIn("jobs", data)

            # 5. GET /api/sessions
            with urllib.request.urlopen(f"http://127.0.0.1:{test_port}/api/sessions") as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertIn("sessions", data)
        finally:
            httpd.shutdown()

    def test_ai_parser_mock(self):

        import ai_parser
        # Verify get_gemini_api_key behavior when key is absent vs present
        old_env = os.environ.get("GEMINI_API_KEY")
        try:
            if "GEMINI_API_KEY" in os.environ:
                del os.environ["GEMINI_API_KEY"]
            self.assertIsNone(ai_parser.get_gemini_api_key(Path(self.test_dir) / "nonexistent.json"))

            os.environ["GEMINI_API_KEY"] = "test_key_12345"
            self.assertEqual(ai_parser.get_gemini_api_key(), "test_key_12345")
        finally:
            if old_env:
                os.environ["GEMINI_API_KEY"] = old_env
            else:
                os.environ.pop("GEMINI_API_KEY", None)


if __name__ == "__main__":
    unittest.main()

