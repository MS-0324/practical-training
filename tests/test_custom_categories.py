import sqlite3
import unittest
from contextlib import closing
from pathlib import Path

import test_app as support
from src.app import create_app, get_db
from src.analysis import monthly_expense_reports
from src.custom_categories import migrate_custom_categories


class CustomCategoryTest(unittest.TestCase):
    setUp = support.AppTest.setUp
    post = support.AppTest.post
    register = support.AppTest.register
    login = support.AppTest.login

    def start(self):
        self.register()
        self.login()

    def create(self, name='ライブ', kind='expense', **extra):
        return self.post('/dashboard', {'category_action': 'create',
                                       'new_category_name': name, 'kind': kind, **extra})

    def transaction(self, key='custom_1', **extra):
        return {'kind': 'expense', 'category': key, 'amount': '2500',
                'date': '2026-11-19', 'description': '', **extra}

    def test_create_select_save_edit_and_persist(self):
        self.start()
        response = self.create(amount='2500', date='2026-11-19', description='入力途中のメモ')
        html = response.get_data(as_text=True)
        self.assertIn('value="custom_1" checked', html)
        self.assertIn('value="2500"', html)
        self.assertIn('入力途中のメモ', html)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT COUNT(*) FROM transactions').fetchone()[0], 0)
        self.assertIn('ライブ', self.client.get('/dashboard').get_data(as_text=True))
        self.assertEqual(self.post('/dashboard', self.transaction()).status_code, 302)
        with self.app.app_context():
            report = monthly_expense_reports(get_db(), 1)[0]
            self.assertEqual(report['categories'][0]['label'], '🏷️ ライブ')
            self.assertEqual(report['total'], 2500)
            self.assertIn('hsl(', report['gradient'])
        self.assertEqual(self.post('/transactions/1/edit', self.transaction(amount='3000')).status_code, 302)
        restarted = create_app(dict(self.app.config))
        with restarted.app_context():
            self.assertEqual(get_db().execute('SELECT name FROM custom_categories').fetchone()[0], 'ライブ')

    def test_income_kind_and_user_isolation(self):
        self.start()
        self.create('特別報酬', 'income')
        self.assertEqual(self.post('/dashboard', self.transaction()).status_code, 200)
        self.assertEqual(self.post('/dashboard', self.transaction(kind='income')).status_code, 302)
        other = self.app.test_client()
        self.register('bob', other)
        self.login('bob', other)
        self.assertNotIn('特別報酬', other.get('/dashboard').get_data(as_text=True))
        self.assertEqual(self.post('/dashboard', self.transaction(kind='income'), other).status_code, 200)
        self.assertEqual(self.post('/dashboard', {'delete_category': 'custom_1'}, other).status_code, 404)
        self.post('/dashboard', {'kind': 'income', 'category_action': 'create',
                                 'new_category_name': '特別報酬'}, other)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT COUNT(*) FROM custom_categories').fetchone()[0], 2)
            self.assertEqual(get_db().execute('SELECT COUNT(*) FROM transactions').fetchone()[0], 1)

    def test_delete_preserves_history_and_only_existing_record_can_keep_it(self):
        self.start()
        self.create()
        self.post('/dashboard', self.transaction())
        self.post('/dashboard', self.transaction(key='food'))
        deleted = self.post('/dashboard', {**self.transaction(), 'delete_category': 'custom_1'})
        html = deleted.get_data(as_text=True)
        self.assertIn('過去の収支と集計はそのまま', html)
        self.assertNotIn('value="custom_1"', html)
        self.assertIn('🏷️ ライブ', html)
        self.assertEqual(self.post('/dashboard', self.transaction()).status_code, 200)
        self.assertEqual(self.post('/transactions/2/edit', self.transaction()).status_code, 200)
        self.assertIn('value="custom_1" checked', self.client.get('/transactions/1/edit').get_data(as_text=True))
        self.assertEqual(self.post('/transactions/1/edit', self.transaction(amount='3100')).status_code, 302)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT COUNT(*) FROM transactions').fetchone()[0], 2)
            report = monthly_expense_reports(get_db(), 1)[0]
            self.assertEqual(report['categories'][0]['label'], '🏷️ ライブ')
        # Re-adding the same name restores its stable ID and aggregate history.
        self.create()
        with self.app.app_context():
            self.assertEqual(tuple(get_db().execute('SELECT id, is_active FROM custom_categories').fetchone()), (1, 1))
        self.assertIn('value="custom_1"', self.client.get('/dashboard').get_data(as_text=True))

    def test_names_duplicates_escaping_and_csrf(self):
        self.start()
        for name in ['', '   ', 'x' * 31, 'a\x00b', '食費']:
            self.assertIn('role="alert"', self.create(name).get_data(as_text=True))
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT COUNT(*) FROM custom_categories').fetchone()[0], 0)
        self.create(' ＡＢＣ ')
        self.create('abc')
        self.create('ABC', 'income')
        self.create('<script>x</script>')
        html = self.client.get('/dashboard').get_data(as_text=True)
        self.assertIn('&lt;script&gt;x&lt;/script&gt;', html)
        self.assertNotIn('<script>x</script>', html)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT COUNT(*) FROM custom_categories').fetchone()[0], 3)
        self.assertEqual(self.client.post('/dashboard', data={'category_action': 'create', 'new_category_name': 'bad'}).status_code, 400)
        self.assertEqual(self.client.post('/dashboard', data={'delete_category': 'custom_1'}).status_code, 400)
        self.assertEqual(self.post('/dashboard', {'delete_category': 'food'}).status_code, 404)

    def test_edit_screen_can_add_without_saving_transaction(self):
        self.start()
        self.post('/dashboard', self.transaction(key='food'))
        response = self.post('/transactions/1/edit', {**self.transaction(key='food', amount='4500'),
                             'category_action': 'create', 'new_category_name': '旅行準備'})
        html = response.get_data(as_text=True)
        self.assertIn('value="custom_1" checked', html)
        self.assertIn('value="4500"', html)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT amount FROM transactions').fetchone()[0], 2500)
        self.assertEqual(self.post('/transactions/1/edit', self.transaction(amount='4500')).status_code, 302)

    def test_existing_database_migration_is_additive_and_repeatable(self):
        self.start()
        self.post('/dashboard', self.transaction(key='food'))
        path = self.app.config['DATABASE']
        with closing(sqlite3.connect(path)) as db, db:
            db.execute('DROP TABLE custom_categories')
        migrate_custom_categories(path)
        migrate_custom_categories(path)
        with closing(sqlite3.connect(path)) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM users').fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT amount, category FROM transactions').fetchone(), (2500, 'food'))
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')


if __name__ == '__main__':
    unittest.main()
