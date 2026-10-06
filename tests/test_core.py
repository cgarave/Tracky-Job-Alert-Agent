import json, sqlite3, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'job_agent'))
import config_store, db, listener, python_runtime, cv_match

class CoreTests(unittest.TestCase):
    def test_python_runtime_selection(self):
        runtime = python_runtime.select()
        self.assertEqual(runtime.implementation, 'cpython')
        self.assertGreaterEqual((runtime.major, runtime.minor), (3, 11))
        self.assertTrue(Path(runtime.path).exists())

    def test_cv_extraction_and_explainable_score(self):
        profile = cv_match.analyze('Senior Python developer with React, SQL, and AWS experience.', 'cv.txt')
        value, reasons = cv_match.score(profile, {'title': 'Python React Engineer', 'description': 'Build APIs with Python and React.'})
        self.assertGreaterEqual(value, 50)
        self.assertIn('python', reasons['matched_skills'])
        self.assertEqual(profile['analysis'], 'local')

    def test_config_validation_and_revision(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'config.json'; path.write_text(json.dumps({'keywords':['python'],'location':'PH','paused':True,'check_interval_minutes':60,'max_results_per_keyword':10}))
            cfg=config_store.update({'paused':False}, path=path, expected_revision=0)
            self.assertEqual(cfg['_revision'], 1)
            with self.assertRaises(config_store.ConflictError): config_store.update({'paused':True}, path=path, expected_revision=0)
            with self.assertRaises(ValueError): config_store.update({'check_interval_minutes': 1}, path=path)
    def test_delivery_retry_queue(self):
        with tempfile.TemporaryDirectory() as d:
            old=db.DB_PATH; db.DB_PATH=Path(d)/'jobs.db'
            try:
                c=db.get_connection(); job={'job_id':'j','title':'Python','company':'Acme','url':'u','source':'x','search_keywords':['python']}; db.mark_seen(c,job)
                rec={'id':'r','destination':'x','platform':'imessage','enabled':True,'keywords':['python']}
                db.enqueue_deliveries(c,[rec],lambda j,k: True); self.assertEqual(len(db.due_deliveries(c,rec)),1)
                db.record_delivery(c,rec,['j'],[]); self.assertEqual(len(db.due_deliveries(c,rec,at=10**12)),1)
                db.record_delivery(c,rec,['j'],['j']); self.assertEqual(len(db.due_deliveries(c,rec,at=10**12)),0)
            finally: c.close(); db.DB_PATH=old
    def test_job_pagination_and_triage_state(self):
        with tempfile.TemporaryDirectory() as d:
            old=db.DB_PATH; db.DB_PATH=Path(d)/'jobs.db'
            try:
                c=db.get_connection()
                for i in range(5): db.mark_seen(c, {'job_id':f'j{i}','title':f'Python {i}','company':'Acme','url':f'https://example.com/{i}','source':'Indeed.ph'})
                self.assertEqual(db.count_jobs(c, search='Python'), 5)
                self.assertEqual(len(db.get_jobs(c, limit=2, offset=2)), 2)
                self.assertEqual(db.update_job_state(c, ['j1'], saved=True), 1)
                self.assertEqual(db.count_jobs(c, saved=True), 1)
                db.update_job_state(c, ['j1'], application_status='applied')
                self.assertEqual(db.count_jobs(c, application_status='applied'), 1)
                self.assertEqual(db.delete_jobs(c, ['j2'], True), 1)
                self.assertEqual(len(db.get_dismissed(c)), 1)
                self.assertEqual(db.restore_jobs(c, ['j2']), 1)
                self.assertIsNotNone(db.get_job_by_id(c, 'j2'))
            finally: c.close(); db.DB_PATH=old
    def test_listener_rejects_unauthorized(self):
        with tempfile.TemporaryDirectory() as d:
            old=listener.CHAT_DB; listener.CHAT_DB=Path(d)/'chat.db'
            try:
                c=sqlite3.connect(listener.CHAT_DB); c.executescript('CREATE TABLE message(ROWID INTEGER PRIMARY KEY,text,date,is_from_me,handle_id); CREATE TABLE handle(ROWID INTEGER PRIMARY KEY,id); CREATE TABLE chat_message_join(message_id,chat_id); CREATE TABLE chat_handle_join(chat_id,handle_id);'); c.execute('INSERT INTO message(text,date,is_from_me,handle_id) VALUES("/pause", ?, 0, 1)', (listener._unix_to_mac_ts(100),)); c.execute('INSERT INTO handle VALUES(1,"+639999999999")'); c.execute('INSERT INTO chat_message_join VALUES(1,1)'); c.execute('INSERT INTO chat_handle_join VALUES(1,1)'); c.commit(); c.close(); self.assertEqual(listener.get_messages_since(['+639171234567'],90),[])
            finally: listener.CHAT_DB=old
if __name__ == '__main__': unittest.main()
