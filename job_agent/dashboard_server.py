"""Loopback dashboard API with same-origin access and CSRF-protected mutations."""
import hmac
import base64
import binascii
import json
import logging
import secrets
import threading
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import config_store
import db
import cv_match
import notifier

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / 'static'
CONFIG_PATH = BASE_DIR / 'config.json'
PORT = 5050
logger = logging.getLogger(__name__)
MAX_BODY = 128 * 1024


class DashboardAPIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def _send_json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        origin = self.headers.get('Origin')
        if origin in ('http://localhost:3000', 'http://127.0.0.1:3000'):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Tracky-Token')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(payload)

    def _authorized(self, mutation=False):
        host = self.headers.get('Host', '')
        hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if host not in hosts:
            self._send_json({'error': 'Invalid Host'}, 403)
            return False
        origin = self.headers.get('Origin')
        allowed_origins = {f'http://{host}', 'http://localhost:3000', 'http://127.0.0.1:3000'}
        if origin is not None and origin not in allowed_origins:
            self._send_json({'error': 'Cross-origin requests are not allowed'}, 403)
            return False
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self._send_json({'error': 'Cross-site requests are not allowed'}, 403)
            return False
        if mutation and not hmac.compare_digest(self.headers.get('X-Tracky-Token', ''), self.server.csrf_token):
            self._send_json({'error': 'Refresh the dashboard session and retry'}, 403)
            return False
        return True

    def _read_body_json(self, max_body=MAX_BODY):
        if self.headers.get('Transfer-Encoding'):
            raise ValueError('Transfer-Encoding is not supported')
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 <= length <= max_body:
            raise ValueError('Request body is too large')
        if not length:
            return {}
        if self.headers.get_content_type() != 'application/json':
            raise ValueError('Content-Type must be application/json')
        body = json.loads(self.rfile.read(length))
        if not isinstance(body, dict):
            raise ValueError('Request body must be an object')
        return body

    def do_OPTIONS(self):
        origin = self.headers.get('Origin')
        if origin in ('http://localhost:3000', 'http://127.0.0.1:3000'):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Tracky-Token')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            self.end_headers()
            return
        if self._authorized():
            self._send_json({'error': 'Cross-origin access is not supported'}, 403)

    def do_HEAD(self):
        if self._authorized():
            super().do_HEAD()

    def do_GET(self):
        if not self._authorized():
            return
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path == '/api/session':
                self._send_json({'token': self.server.csrf_token})
            elif parsed.path == '/api/status':
                cfg = config_store.load(CONFIG_PATH)
                conn = db.get_connection()
                try:
                    stats = db.get_stats(conn)
                    deliveries = db.delivery_stats(conn)
                    source_health = db.get_source_health(conn)
                finally:
                    conn.close()
                controller = self.server.scan_controller
                scan = controller.snapshot() if controller else {'state': 'unavailable'}
                scan['deliveries'] = deliveries
                scan['source_health_history'] = source_health
                self._send_json({'status': 'online', 'last_scan_time': scan.get('completed_at') or 'Never',
                                 'stats': stats, 'paused': cfg['paused'], 'interval': cfg['check_interval_minutes'],
                                 'location': cfg['location'], 'keywords': cfg['keywords'],
                                 'source_health': source_health, 'scan': scan})
            elif parsed.path == '/api/settings':
                self._send_json(config_store.public_settings(config_store.load(CONFIG_PATH)))
            elif parsed.path == '/api/cv':
                self._send_json(cv_match.summary(cv_match.load()))
            elif parsed.path == '/api/jobs':
                page = max(1, int(query.get('page', ['1'])[0]))
                page_size = int(query.get('page_size', query.get('limit', ['25']))[0])
                if not 1 <= page_size <= 100:
                    raise ValueError('page_size must be between 1 and 100')
                filters = {'search': query.get('search', [None])[0], 'source': query.get('source', [None])[0],
                           'alert_status': query.get('alert_status', [None])[0],
                           'saved': query.get('saved', ['false'])[0].lower() == 'true',
                           'application_status': query.get('application_status', [None])[0],
                           'since': query.get('since', [None])[0]}
                conn = db.get_connection()
                try:
                    total = db.count_jobs(conn, **filters)
                    jobs = db.get_jobs(conn, limit=page_size, offset=(page - 1) * page_size,
                                       sort=query.get('sort', ['newest'])[0], **filters)
                finally:
                    conn.close()
                self._send_json({'jobs': jobs, 'total': total, 'page': page, 'page_size': page_size,
                                 'has_next': page * page_size < total})
            elif parsed.path == '/api/dismissed':
                conn = db.get_connection()
                try:
                    self._send_json({'jobs': db.get_dismissed(conn)})
                finally: conn.close()
            elif parsed.path == '/api/delivery-history':
                conn = db.get_connection()
                try:
                    rows = conn.execute('SELECT * FROM delivery_queue ORDER BY updated_at DESC LIMIT 100').fetchall()
                    self._send_json({'deliveries': [dict(row) for row in rows]})
                finally: conn.close()
            elif parsed.path.startswith('/api/'):
                self._send_json({'error': 'Unknown endpoint'}, 404)
            else:
                super().do_GET()
        except ValueError as exc:
            self._send_json({'error': str(exc)}, 400)
        except Exception:
            logger.exception('Dashboard read failed')
            self._send_json({'error': 'Unable to read dashboard data'}, 500)

    def do_POST(self):
        self._mutate()

    def do_DELETE(self):
        self._mutate()

    def _mutate(self):
        if not self._authorized(mutation=True):
            return
        try:
            path = urllib.parse.urlparse(self.path).path
            body = self._read_body_json(6 * 1024 * 1024 if path == '/api/cv' else MAX_BODY)
            if self.command == 'DELETE' and path == '/api/jobs':
                ids = body.get('job_ids', [])
                if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids):
                    raise ValueError('job_ids must be an array of strings')
                if type(body.get('all', False)) is not bool or type(body.get('block_future', True)) is not bool:
                    raise ValueError('all and block_future must be booleans')
                conn = db.get_connection()
                try:
                    count = db.delete_all_jobs(conn, body.get('block_future', True), body.get('source'), body.get('search')) if body.get('all') else db.delete_jobs(conn, ids, body.get('block_future', True))
                    self._send_json({'status': 'success', 'deleted_count': count, 'stats': db.get_stats(conn)})
                finally:
                    conn.close()
            elif self.command != 'POST':
                self._send_json({'error': 'Unknown endpoint'}, 404)
            elif path == '/api/scan-now':
                controller = self.server.scan_controller
                if controller is None:
                    self._send_json({'error': 'Scanner is unavailable. Start the Tracky daemon.'}, 503)
                else:
                    queued = controller.request()
                    self._send_json({'status': controller.snapshot()['state'],
                                     'message': 'Scan queued.' if queued else 'A scan is already queued or running.'}, 202)
            elif path == '/api/scan-dry-run':
                controller = self.server.scan_controller
                if controller is None:
                    self._send_json({'error': 'Scanner is unavailable. Start the Tracky daemon.'}, 503)
                else:
                    queued = controller.request(dry_run=True)
                    self._send_json({'status': controller.snapshot()['state'],
                                     'message': 'Safe test scan queued; notifications are disabled.' if queued else 'A scan is already queued or running.'}, 202)
            elif path in ('/api/pause', '/api/resume'):
                cfg = config_store.update({'paused': path == '/api/pause'}, path=CONFIG_PATH)
                self._send_json({'status': 'success', 'paused': cfg['paused']})
            elif path == '/api/settings':
                if type(body.get('_revision')) is not int:
                    raise ValueError('A settings revision is required; reload settings')
                cfg = config_store.update(body, path=CONFIG_PATH, expected_revision=body['_revision'])
                self._send_json({'status': 'success', 'settings': config_store.public_settings(cfg)})
            elif path == '/api/cv':
                filename = body.get('filename')
                encoded = body.get('data')
                if not isinstance(filename, str) or not isinstance(encoded, str):
                    raise ValueError('A CV filename and file data are required')
                try:
                    content = base64.b64decode(encoded, validate=True)
                except (binascii.Error, ValueError):
                    raise ValueError('CV file data is invalid')
                profile = cv_match.analyze(cv_match.extract_text(content, filename), filename)
                cv_match.save(profile)
                conn = db.get_connection()
                try: count = db.rescore_jobs(conn, profile)
                finally: conn.close()
                self._send_json({**cv_match.summary(profile), 'scored_jobs': count})
            elif path == '/api/cv/remove':
                cv_match.PROFILE_PATH.unlink(missing_ok=True)
                conn = db.get_connection()
                try: count = db.rescore_jobs(conn, None)
                finally: conn.close()
                self._send_json({'uploaded': False, 'scored_jobs': count})
            elif path == '/api/cv/analyze':
                profile = cv_match.load()
                if not profile:
                    raise ValueError('Upload a CV before using Gemini analysis')
                analyzed = cv_match.analyze_with_gemini(profile, body.get('api_key', ''))
                cv_match.save(analyzed)
                conn = db.get_connection()
                try: count = db.rescore_jobs(conn, analyzed)
                finally: conn.close()
                self._send_json({**cv_match.summary(analyzed), 'scored_jobs': count})
            elif path == '/api/test-notification':
                for key in ('platform', 'destination', 'bot_token'):
                    if key in body and not isinstance(body[key], str):
                        raise ValueError(f'{key} must be a string')
                token = body.get('bot_token') or config_store.load(CONFIG_PATH).get('telegram_bot_token', '')
                result = notifier.send_test_notification(body.get('platform', 'imessage'), body.get('destination', ''), token)
                self._send_json(result)
            elif path in ('/api/jobs/save', '/api/jobs/apply', '/api/jobs/restore'):
                ids = body.get('job_ids', [])
                if not isinstance(ids, list) or not ids or any(not isinstance(i, str) for i in ids):
                    raise ValueError('job_ids must be a non-empty array of strings')
                conn = db.get_connection()
                try:
                    if path.endswith('/save'):
                        count = db.update_job_state(conn, ids, saved=bool(body.get('saved', True)))
                    elif path.endswith('/apply'):
                        status = body.get('status', 'applied')
                        if status not in ('applied', ''):
                            raise ValueError('Application status must be applied or empty')
                        count = db.update_job_state(conn, ids, application_status=status)
                    else:
                        count = db.restore_jobs(conn, ids)
                    self._send_json({'status': 'success', 'updated_count': count})
                finally: conn.close()
            else:
                self._send_json({'error': 'Unknown endpoint'}, 404)
        except config_store.ConflictError as exc:
            self._send_json({'error': str(exc)}, 409)
        except (ValueError, TypeError) as exc:
            self._send_json({'error': str(exc)}, 400)
        except Exception as exc:
            logger.exception('Dashboard update failed')
            msg = str(exc).strip()
            self._send_json({'error': msg if msg else 'Unable to update dashboard data'}, 500)


class ReusableHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def get_request(self):
        sock, address = super().get_request()
        sock.settimeout(10)
        return sock, address


def start_dashboard_server(port=PORT, background=False, scan_controller=None):
    httpd = ReusableHTTPServer(('127.0.0.1', port), DashboardAPIHandler)
    httpd.csrf_token = secrets.token_urlsafe(32)
    httpd.scan_controller = scan_controller
    if background:
        threading.Thread(target=httpd.serve_forever, daemon=True, name='dashboard_server').start()
        return httpd
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == '__main__':
    start_dashboard_server()
