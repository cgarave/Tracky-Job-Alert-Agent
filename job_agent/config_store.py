"""Validated configuration with process locking and atomic replacement."""
import copy
import fcntl
import json
import os
import re
import tempfile
import threading
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / 'config.json'
_LOCK = threading.RLock()
DEFAULTS = {'keywords': [], 'location': 'Philippines', 'check_interval_minutes': 60,
            'max_results_per_keyword': 10, 'scan_workers': 4, 'source_timeout_seconds': 45,
            'paused': True, 'recipient': ''}

class ConflictError(ValueError):
    pass


def atomic_json(path, data):
    path = Path(path)
    fd, name = tempfile.mkstemp(prefix=path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def load(path=None):
    path = Path(path or CONFIG_PATH)
    value = json.loads(path.read_text()) if path.exists() else {}
    if not isinstance(value, dict):
        raise ValueError('Configuration must be an object')
    return {**copy.deepcopy(DEFAULTS), '_revision': 0, **value}


def _strings(value, label):
    if not isinstance(value, list) or len(value) > 200 or any(not isinstance(v, str) or not v.strip() or len(v) > 200 for v in value):
        raise ValueError(f'{label} must contain nonempty strings (maximum 200)')
    return list(dict.fromkeys(v.strip() for v in value))


def validate(cfg):
    for key, low, high in [('check_interval_minutes', 5, 1440), ('max_results_per_keyword', 1, 100),
                           ('scan_workers', 1, 8), ('source_timeout_seconds', 5, 300)]:
        if type(cfg.get(key)) is not int or not low <= cfg[key] <= high:
            raise ValueError(f'{key} must be an integer between {low} and {high}')
    if type(cfg.get('paused')) is not bool:
        raise ValueError('paused must be a boolean')
    cfg['keywords'] = _strings(cfg['keywords'], 'keywords')
    for key in ('location', 'recipient', 'telegram_bot_token'):
        if key in cfg and (not isinstance(cfg[key], str) or len(cfg[key]) > 4096):
            raise ValueError(f'{key} must be a string of at most 4096 characters')
    if not cfg['location'].strip():
        raise ValueError('location must not be empty')
    if 'recipients' in cfg:
        if not isinstance(cfg['recipients'], list) or len(cfg['recipients']) > 100:
            raise ValueError('recipients must be an array of at most 100 entries')
        ids = set()
        for rec in cfg['recipients']:
            if not isinstance(rec, dict):
                raise ValueError('Each recipient must be an object')
            for key in ('id', 'name', 'destination'):
                if not isinstance(rec.get(key), str) or not rec[key].strip() or len(rec[key]) > 200:
                    raise ValueError(f'Recipient {key} is required (maximum 200 characters)')
            if rec['id'] in ids:
                raise ValueError('Recipient IDs must be unique')
            ids.add(rec['id'])
            if rec.get('platform') not in ('imessage', 'telegram') or type(rec.get('enabled')) is not bool:
                raise ValueError('Invalid recipient platform or enabled flag')
            rec['keywords'] = _strings(rec.get('keywords', []), 'Recipient keywords')
        cfg['recipient'] = ', '.join(r['destination'] for r in cfg['recipients'] if r['platform'] == 'imessage' and r['enabled'])
    return cfg


def update(patch=None, *, mutate=None, path=None, expected_revision=None):
    path = Path(path or CONFIG_PATH)
    with _LOCK, open(str(path) + '.lock', 'a') as lock:
        os.chmod(lock.name, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        cfg = load(path)
        revision = cfg.get('_revision', 0)
        if expected_revision is not None and expected_revision != revision:
            raise ConflictError('Settings changed elsewhere. Reload settings before saving again.')
        if patch is not None:
            if not isinstance(patch, dict):
                raise ValueError('Settings must be an object')
            allowed = set(DEFAULTS) | {'recipients', 'telegram_bot_token', '_revision', 'telegram_bot_token_configured'}
            if set(patch) - allowed:
                raise ValueError('Unknown settings field')
            patch = {k: v for k, v in patch.items() if k not in ('_revision', 'telegram_bot_token_configured')}
            if patch.get('telegram_bot_token') == '':
                patch.pop('telegram_bot_token')
            # Legacy editors update iMessage destinations without discarding Telegram recipients.
            if 'recipient' in patch and 'recipients' not in patch:
                old = cfg.get('recipients', [])
                if not isinstance(patch['recipient'], str):
                    raise ValueError('recipient must be a string')
                destinations = [v.strip() for v in re.split(r'[,;\n]', patch['recipient']) if v.strip()]
                patch['recipients'] = [r for r in old if r['platform'] != 'imessage'] + [
                    next((r for r in old if r['platform'] == 'imessage' and r['destination'] == dest),
                         {'id': f'legacy_{i}_{dest}', 'name': dest, 'platform': 'imessage',
                          'destination': dest, 'keywords': cfg['keywords'], 'enabled': True})
                    for i, dest in enumerate(destinations)]
            cfg.update(copy.deepcopy(patch))
        if mutate:
            mutate(cfg)
        validate(cfg)
        cfg['_revision'] = revision + 1
        atomic_json(path, cfg)
        return cfg


def public_settings(cfg):
    result = copy.deepcopy(cfg)
    result['telegram_bot_token_configured'] = bool(result.pop('telegram_bot_token', ''))
    return result
