"""Thread-safe scan requests and observable scan lifecycle."""
import copy
import threading
import time
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


class ScanState:
    def __init__(self):
        self.lock = threading.RLock()
        self.event = threading.Event()
        self.data = {'state': 'idle', 'started_at': None, 'completed_at': None,
                     'completed_tasks': 0, 'total_tasks': 0, 'source_errors': [],
                     'new_jobs': 0, 'deliveries': {}, 'error': None, 'source_health': {},
                     'dry_run': False, 'requested_dry_run': False}

    def snapshot(self):
        with self.lock:
            return copy.deepcopy(self.data)

    def update(self, **values):
        with self.lock:
            self.data.update(values)

    def request(self, dry_run=False):
        with self.lock:
            if self.data['state'] in ('queued', 'running'):
                return False
            self.data['state'] = 'queued'
            self.data['requested_dry_run'] = bool(dry_run)
            self.event.set()
            return True

    def begin(self, total_tasks):
        with self.lock:
            self.event.clear()
            self.data.update(state='running', started_at=now(), completed_at=None,
                             completed_tasks=0, total_tasks=total_tasks, source_errors=[],
                             new_jobs=0, error=None, source_health={}, dry_run=False)

    def consume_request_mode(self):
        with self.lock:
            mode = bool(self.data.get('requested_dry_run', False))
            self.data['requested_dry_run'] = False
            return mode

    def task_done(self, source, keyword, error=None, duration_ms=None, result_count=0):
        with self.lock:
            self.data['completed_tasks'] += 1
            if error:
                self.data['source_errors'].append({'source': source, 'keyword': keyword, 'error': error})
            self.data['source_health'][source] = {
                'status': 'failed' if error else 'ok', 'keyword': keyword,
                'duration_ms': duration_ms, 'result_count': result_count,
                'error': error, 'updated_at': now(),
            }

    def finish(self, new_jobs=0, error=None):
        with self.lock:
            self.data.update(state='failed' if error else ('partial' if self.data['source_errors'] else 'completed'),
                             completed_at=now(), new_jobs=new_jobs, error=error)
