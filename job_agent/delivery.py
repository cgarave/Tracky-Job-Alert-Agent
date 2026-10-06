"""Persistent, bounded delivery attempts independent of new-job discovery."""
import logging
import db
import notifier

logger = logging.getLogger(__name__)


def dispatch(conn, recipients, bot_token=''):
    db.enqueue_deliveries(conn, recipients, notifier.matches_recipient_keywords)
    for rec in recipients:
        if not rec.get('enabled', True):
            continue
        jobs = db.due_deliveries(conn, rec)
        # Persist each batch immediately so a later batch failure cannot lose successes.
        for start in range(0, len(jobs), 10):
            chunk = jobs[start:start + 10]
            try:
                sent = notifier.send_recipient_alerts(rec, chunk, bot_token=bot_token)
            except Exception:
                logger.exception('Notification batch failed')
                sent = []
            db.record_delivery(conn, rec, [j['job_id'] for j in chunk], sent)
    return db.delivery_stats(conn)
