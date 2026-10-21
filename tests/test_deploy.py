import importlib
import os
import sqlite3
import sys
import threading
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen

from waitress import create_server

from backup_db import backup
from src.app import create_app


class DeploymentTest(unittest.TestCase):
    def test_database_path_and_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / 'persistent' / 'ledger.sqlite3')
            with patch.dict(os.environ, {'DATABASE_PATH': path, 'SECRET_KEY': 'x' * 64}):
                app = create_app()
                self.assertEqual(app.config['DATABASE'], path)
                self.assertEqual(app.test_cli_runner().invoke(args=['init-db']).exit_code, 0)
                with closing(sqlite3.connect(path)) as db, db:
                    db.execute("INSERT INTO users VALUES (1, 'legacy', 'existing-hash')")
                restarted = create_app()
                self.assertEqual(restarted.test_cli_runner().invoke(args=['init-db']).exit_code, 0)
                with closing(sqlite3.connect(path)) as db:
                    self.assertEqual(db.execute('SELECT password_hash FROM users').fetchone()[0], 'existing-hash')
                destination = Path(directory) / 'backup.sqlite3'
                backup(path, destination)
                with closing(sqlite3.connect(destination)) as db:
                    self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0], 1)
                with self.assertRaises(FileExistsError):
                    backup(path, destination)
                with self.assertRaises(FileExistsError):
                    backup(path, path)

    def test_missing_backup_source_not_created(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.sqlite3'
            with self.assertRaises(FileNotFoundError):
                backup(path, Path(directory) / 'backup.sqlite3')
            self.assertFalse(path.exists())

    def test_production_guards_and_cookie(self):
        with tempfile.TemporaryDirectory() as directory:
            environment = {'SECRET_KEY': 'a' * 64, 'SESSION_COOKIE_SECURE': '1',
                           'DATABASE_PATH': str(Path(directory) / 'db.sqlite3')}
            for key in environment:
                with patch.dict(os.environ, {**environment, key: ''}):
                    sys.modules.pop('wsgi', None)
                    with self.assertRaises(RuntimeError):
                        importlib.import_module('wsgi')
            with patch.dict(os.environ, environment):
                sys.modules.pop('wsgi', None)
                app = importlib.import_module('wsgi').application
                self.assertFalse(app.debug)
                self.assertFalse(Path(environment['DATABASE_PATH']).exists())
                response = app.test_client().get('/login', base_url='https://localhost')
                self.assertEqual(response.status_code, 200)
                cookies = response.headers.getlist('Set-Cookie')
                self.assertTrue(any(cookie.startswith('session=') and 'Secure;' in cookie for cookie in cookies))
                server = create_server(app, host='127.0.0.1', port=0, threads=1)
                thread = threading.Thread(target=server.run, daemon=True)
                thread.start()
                try:
                    with urlopen(f'http://127.0.0.1:{server.effective_port}/login', timeout=5) as response:
                        self.assertEqual(response.status, 200)
                        self.assertIn(b'csrf_token', response.read())
                finally:
                    server.close()
                    server.task_dispatcher.shutdown()
                    thread.join(timeout=5)
            sys.modules.pop('wsgi', None)

    def test_relative_path_rejected(self):
        with self.assertRaises(RuntimeError):
            create_app({'SECRET_KEY': 'test', 'DATABASE': 'relative.sqlite3'})
