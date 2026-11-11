import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.app import create_app, get_db
from werkzeug.security import check_password_hash, generate_password_hash


class AppTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'test-only-secret',
                               'DATABASE': str(Path(self.temp.name) / 'test.sqlite3')})
        self.client = self.app.test_client()
        result = self.app.test_cli_runner().invoke(args=['init-db'])
        self.assertEqual(result.exit_code, 0)

    def post(self, url, data=None, client=None, page=None):
        client = client or self.client
        html = client.get(page or url, follow_redirects=True).get_data(as_text=True)
        token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
        return client.post(url, data={**(data or {}), 'csrf_token': token})

    def register(self, name='alice', client=None):
        return self.post('/register', {'email': name + '@example.com', 'password': 'long-test-password',
                                     'confirm': 'long-test-password'}, client)

    def login(self, name='alice', client=None):
        return self.post('/login', {'username': name + '@example.com', 'password': 'long-test-password'}, client)

    def test_registration_page_and_validation(self):
        response = self.client.get('/register')
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn('name="email"', html)
        self.assertIn('type="email"', html)
        self.assertIn('name="csrf_token"', html)
        self.assertIn('name="confirm"', html)
        self.assertIn('href="/login"', html)
        valid = {'email': 'alice@example.com', 'password': 'long-test-password',
                 'confirm': 'long-test-password'}
        for invalid in [{'email': 'not-an-email'}, {'email': ''},
                        {'password': 'short', 'confirm': 'short'}, {'confirm': 'different-password'}]:
            self.assertEqual(self.post('/register', {**valid, **invalid}).status_code, 200)
            with self.app.app_context():
                self.assertEqual(get_db().execute('SELECT count(*) FROM users').fetchone()[0], 0)
        response = self.post('/register', {**valid, 'email': ' alice@example.com '})
        self.assertEqual(response.location, '/login')
        self.assertIn('登録しました。ログインしてください。', self.client.get('/login').get_data(as_text=True))
        self.assertIn('使用されています', self.register('ALICE').get_data(as_text=True))
        self.assertEqual(self.login('ALICE').location, '/dashboard')

    def test_existing_username_login(self):
        with self.app.app_context():
            db = get_db()
            with db:
                db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                           ('legacy_user', generate_password_hash('long-test-password')))
        response = self.post('/login', {'username': 'legacy_user', 'password': 'long-test-password'})
        self.assertEqual(response.location, '/dashboard')

    def test_secret_required(self):
        with patch.dict('os.environ', {'SECRET_KEY': ''}):
            with self.assertRaises(RuntimeError):
                create_app()

    def test_authentication(self):
        self.assertEqual(self.client.get('/dashboard').status_code, 302)
        self.assertEqual(self.register().status_code, 302)
        self.assertIn('使用されています', self.register('ALICE').get_data(as_text=True))
        with self.app.app_context():
            row = get_db().execute('SELECT * FROM users').fetchone()
            self.assertNotEqual(row['password_hash'], 'long-test-password')
            self.assertTrue(check_password_hash(row['password_hash'], 'long-test-password'))
        self.assertIn('違います', self.post('/login', {'username': 'alice', 'password': 'wrong'}).get_data(as_text=True))
        self.assertEqual(self.login().status_code, 302)
        self.assertEqual(self.client.get('/dashboard').status_code, 200)
        self.assertEqual(self.client.get('/logout').status_code, 405)
        self.assertEqual(self.post('/logout', page='/dashboard').status_code, 302)
        self.assertEqual(self.client.get('/dashboard').status_code, 302)

    def test_csrf(self):
        for url in ['/register', '/login', '/logout', '/transactions/new',
                    '/transactions/1/edit', '/transactions/1/delete']:
            self.assertEqual(self.client.post(url, data={}).status_code, 400)
            self.assertEqual(self.client.post(url, data={'csrf_token': 'forged'}).status_code, 400)

    def test_session_and_login_redirect(self):
        self.register()
        html = self.client.get('/login').get_data(as_text=True)
        old_token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
        response = self.client.post('/login?next=https://example.com', data={
            'username': 'alice@example.com', 'password': 'long-test-password', 'csrf_token': old_token})
        self.assertEqual(response.location, '/dashboard')
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', response.headers['Set-Cookie'])
        with self.client.session_transaction() as session:
            self.assertTrue(session.permanent)
            self.assertNotIn('password', session)
        self.assertEqual(self.client.post('/logout', data={'csrf_token': old_token}).status_code, 400)
        self.assertEqual(self.app.config['PERMANENT_SESSION_LIFETIME'].total_seconds(), 1800)
        secure = create_app({'TESTING': True, 'SECRET_KEY': 'test', 'SESSION_COOKIE_SECURE': True, 'DATABASE': self.app.config['DATABASE']})
        self.assertTrue(secure.config['SESSION_COOKIE_SECURE'])

    def test_crud_and_owner_isolation(self):
        self.register()
        self.login()
        data = {'kind': 'income', 'category': 'salary', 'amount': '100', 'description': '<script>private</script>', 'date': '2026-10-18', 'user_id': '999'}
        self.assertEqual(self.post('/transactions/new', data).status_code, 302)
        dashboard = self.client.get('/dashboard').get_data(as_text=True)
        self.assertIn('&lt;script&gt;private', dashboard)
        self.assertNotIn('<script>private', dashboard)
        other = self.app.test_client()
        self.register('bob', other)
        self.login('bob', other)
        self.assertNotIn('private', other.get('/dashboard').get_data(as_text=True))
        self.assertEqual(other.get('/transactions/1/edit').status_code, 404)
        for route in ['edit', 'delete']:
            self.assertEqual(self.post('/transactions/1/' + route, data, other, '/dashboard').status_code, 404)
        self.assertEqual(self.post('/transactions/1/edit', {**data, 'amount': '200'}).status_code, 302)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT amount FROM transactions').fetchone()[0], 200)
        self.assertEqual(self.post('/transactions/1/delete', page='/dashboard').status_code, 302)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT count(*) FROM transactions').fetchone()[0], 0)

    def test_validation_and_non_destructive_init(self):
        self.register()
        self.login()
        valid = {'kind': 'expense', 'category': 'food', 'amount': '10', 'description': 'lunch', 'date': '2026-10-18'}
        for invalid in [{'amount': '0'}, {'amount': '-1'}, {'amount': '1.5'}, {'amount': '1000000001'},
                        {'kind': 'unknown'}, {'date': '2026-02-30'}, {'category': 'salary'}, {'category': 'unknown'}, {'category': ''}, {'description': 'x' * 201}]:
            self.assertEqual(self.post('/transactions/new', {**valid, **invalid}).status_code, 200)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT count(*) FROM transactions').fetchone()[0], 0)
        self.app.test_cli_runner().invoke(args=['init-db'])
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT count(*) FROM users').fetchone()[0], 1)

    def test_dashboard_category_flow(self):
        from src.categories import CATEGORIES
        self.assertEqual(len(CATEGORIES), 30)
        self.assertEqual(len({c[0] for c in CATEGORIES}), 30)
        self.register()
        self.login()
        html = self.client.get('/dashboard?month=2026-11').get_data(as_text=True)
        self.assertIn('id="add-panel"', html)
        self.assertEqual(html.count('class="category-option"'), 30)
        data = {'kind': 'expense', 'category': 'food', 'amount': '500',
                'date': '2026-11-04', 'description': ''}
        response = self.post('/dashboard?month=2026-11', data)
        self.assertEqual(response.location, '/dashboard?month=2026-11')
        with self.app.app_context():
            row = get_db().execute('SELECT * FROM transactions').fetchone()
            self.assertEqual(row['category'], 'food')
            self.assertEqual(row['amount'], 500)
        invalid = self.post('/dashboard', {**data, 'category': 'salary'})
        self.assertIn('id="add-panel" open', invalid.get_data(as_text=True))
        for key, kind, icon, label in CATEGORIES:
            self.assertEqual(self.post('/dashboard', {**data, 'kind': kind, 'category': key}).status_code, 302)
        self.assertEqual(self.post('/transactions/1/edit', {**data, 'kind': 'income', 'category': 'salary'}).status_code, 302)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT category FROM transactions WHERE id = 1').fetchone()[0], 'salary')

    def test_legacy_migration_backup_and_repeat(self):
        import sqlite3
        from contextlib import closing
        from src.migration import migrate_categories
        path = Path(self.temp.name) / 'legacy.sqlite3'
        with closing(sqlite3.connect(path)) as db, db:
            schema = Path('src/schema.sql').read_text(encoding='utf-8')
            schema = schema.replace("    category TEXT NOT NULL DEFAULT 'uncategorized',\n", '')
            db.executescript(schema)
            db.execute("INSERT INTO users VALUES (1, 'legacy', 'hash')")
            db.execute("INSERT INTO transactions VALUES (1, 1, 'expense', 100, 'old memo', '2026-11-01')")
            db.execute("INSERT INTO monthly_spending_goals VALUES (1, 1, '2026-11', 10000)")
        create_app({'TESTING': True, 'SECRET_KEY': 'migration', 'DATABASE': str(path)})
        backups = list(path.parent.glob(path.name + '.before-categories-*.bak'))
        self.assertEqual(len(backups), 1)
        migrate_categories(str(path))
        with closing(sqlite3.connect(path)) as db:
            self.assertEqual(db.execute('SELECT * FROM transactions').fetchone(),
                             (1, 1, 'expense', 100, 'old memo', '2026-11-01', 'uncategorized'))
            self.assertEqual(db.execute('SELECT amount FROM monthly_spending_goals').fetchone()[0], 10000)
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        with closing(sqlite3.connect(backups[0])) as db:
            self.assertNotIn('category', [row[1] for row in db.execute('PRAGMA table_info(transactions)')])
            self.assertEqual(db.execute('SELECT description FROM transactions').fetchone()[0], 'old memo')
        self.assertEqual(list(path.parent.glob(path.name + '.before-categories-*.bak')), backups)

    def test_legacy_category_can_be_edited(self):
        self.register()
        self.login()
        with self.app.app_context():
            db = get_db()
            with db:
                db.execute("INSERT INTO transactions (user_id, kind, amount, description, date) VALUES (1, 'expense', 10, 'legacy', '2026-11-01')")
        self.assertIn('value="uncategorized" checked', self.client.get('/transactions/1/edit').get_data(as_text=True))
        self.assertEqual(self.post('/transactions/1/edit', {'kind': 'expense', 'category': 'uncategorized', 'amount': '20', 'date': '2026-11-01'}).status_code, 302)


if __name__ == '__main__':
    unittest.main()
