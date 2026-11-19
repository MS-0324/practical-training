import io
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from PIL import Image
from werkzeug.datastructures import MultiDict
from werkzeug.security import generate_password_hash

from src.app import create_app, get_db
from src.receipt_ocr import ReceiptError, extract_receipt, prepare_image


def sample_image():
    output = io.BytesIO()
    Image.new('RGB', (100, 200), 'white').save(output, 'PNG')
    return output.getvalue()


def extracted():
    return {'date': '2026-11-18', 'total': 850, 'notes': '', 'items': [
        {'description': 'おにぎり', 'category': 'food', 'amount': 350},
        {'description': 'ノート', 'category': 'supplies', 'amount': 500},
    ]}


def api_response(data=None, status='completed'):
    return io.BytesIO(json.dumps({'status': status, 'output': [{'type': 'message', 'content': [
        {'type': 'output_text', 'text': json.dumps(data if data is not None else extracted())},
    ]}]}).encode())


class ReceiptApiTest(unittest.TestCase):
    @patch('src.receipt_ocr.urlopen')
    def test_image_and_structured_response(self, call):
        call.return_value = api_response()
        self.assertEqual(extract_receipt(sample_image(), 'test-key', 'gpt-4.1-mini'), extracted())
        request = call.call_args.args[0]
        self.assertEqual(request.full_url, 'https://api.openai.com/v1/responses')
        payload = json.loads(request.data)
        self.assertFalse(payload['store'])
        self.assertTrue(payload['text']['format']['strict'])
        self.assertTrue(payload['input'][0]['content'][1]['image_url'].startswith('data:image/jpeg;base64,'))
        self.assertEqual(call.call_count, 1)

    @patch('src.receipt_ocr.urlopen')
    def test_bad_image_and_missing_key_do_not_call_api(self, call):
        for image, key in [(b'not an image', 'key'), (sample_image(), ''), (b'x' * (8 * 1024 * 1024 + 1), 'key')]:
            with self.assertRaises(ReceiptError):
                extract_receipt(image, key, 'model')
        call.assert_not_called()

    @patch('src.receipt_ocr.urlopen')
    def test_service_failures_and_partial_output(self, call):
        for failure in [TimeoutError(), URLError('offline'), HTTPError('url', 401, 'secret service body', {}, None), HTTPError('url', 429, 'quota', {}, None)]:
            call.side_effect = failure
            with self.assertRaises(ReceiptError) as error:
                extract_receipt(sample_image(), 'secret-key', 'model')
            self.assertNotIn('secret', str(error.exception))
        call.side_effect = None
        call.return_value = api_response(status='incomplete')
        with self.assertRaises(ReceiptError):
            extract_receipt(sample_image(), 'key', 'model')
        for invalid in [{**extracted(), 'items': []}, {**extracted(), 'items': [{'description': 'x', 'category': 'salary', 'amount': 100}]},
                        {**extracted(), 'items': [{'description': 'x', 'category': 'food', 'amount': -100}]}]:
            call.return_value = api_response(invalid)
            with self.assertRaises(ReceiptError):
                extract_receipt(sample_image(), 'key', 'model')

    def test_metadata_removed_and_unsupported_formats(self):
        image = Image.new('RGB', (100, 50), 'white')
        exif = Image.Exif()
        exif[274] = 6
        exif[270] = 'private metadata'
        output = io.BytesIO()
        image.save(output, 'JPEG', exif=exif)
        with Image.open(io.BytesIO(prepare_image(output.getvalue()))) as clean:
            self.assertEqual(clean.size, (50, 100))
            self.assertFalse(clean.getexif())
        output = io.BytesIO()
        image.save(output, 'GIF')
        with self.assertRaises(ReceiptError):
            prepare_image(output.getvalue())


class ReceiptFlowTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'test-secret', 'OPENAI_API_KEY': 'test-api-secret',
                               'DATABASE': str(Path(self.temp.name) / 'test.sqlite3')})
        self.assertEqual(self.app.test_cli_runner().invoke(args=['init-db']).exit_code, 0)
        with self.app.app_context():
            db = get_db()
            with db:
                db.executemany('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                               [('alice', generate_password_hash('password')), ('bob', generate_password_hash('password'))])
        self.client = self.app.test_client()
        self.login(self.client, 'alice')

    def token(self, html, name='csrf_token'):
        return re.search(r'name="' + name + r'"[^>]*value="([^"]+)"', html).group(1)

    def login(self, client, name):
        csrf = self.token(client.get('/login').get_data(as_text=True))
        self.assertEqual(client.post('/login', data={'username': name, 'password': 'password', 'csrf_token': csrf}).status_code, 302)

    def form(self):
        html = self.client.get('/receipts').get_data(as_text=True)
        self.assertNotIn('test-api-secret', html)
        return MultiDict([('csrf_token', self.token(html)), ('import_token', self.token(html, 'import_token')),
                          ('date', '2026-11-18'), ('confirmed', 'yes'),
                          ('category', 'food'), ('description', '修正した商品'), ('amount', '400'),
                          ('category', 'books'), ('description', '<script>test</script>'), ('amount', '500')])

    def counts(self):
        with self.app.app_context():
            return get_db().execute('SELECT count(*) FROM transactions').fetchone()[0]

    @patch('src.receipt_ocr.urlopen')
    def test_read_review_edit_save_and_duplicate(self, call):
        form = self.form()
        call.return_value = api_response()
        response = self.client.post('/receipts/scan', data={'image': (io.BytesIO(sample_image()), 'receipt.png')},
                                    headers={'X-CSRFToken': form['csrf_token']})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, extracted())
        self.assertEqual(self.counts(), 0)  # Scanning must never save transactions.
        response = self.client.post('/receipts', data=form)
        self.assertEqual(response.location, '/dashboard?month=2026-11')
        self.assertEqual(self.counts(), 2)
        self.assertEqual(self.client.post('/receipts', data=form).status_code, 302)
        self.assertEqual(self.counts(), 2)
        with self.app.app_context():
            rows = get_db().execute('SELECT user_id, kind, category, amount, description FROM transactions ORDER BY id').fetchall()
            self.assertEqual(tuple(rows[0]), (1, 'expense', 'food', 400, '修正した商品'))
        dashboard = self.client.get(response.location).get_data(as_text=True)
        self.assertIn('900 円', dashboard)
        self.assertIn('&lt;script&gt;test', dashboard)
        self.assertIn('conic-gradient', dashboard)

    def test_invalid_rows_are_atomic_and_preserved(self):
        for name, value in [('amount', '0'), ('amount', '-5'), ('amount', '1.5'), ('amount', '9' * 5000),
                            ('category', 'salary'), ('date', '2026-02-30'), ('confirmed', ''), ('description', 'x' * 201)]:
            form = self.form()
            if name in ('amount', 'category', 'description'):
                values = form.getlist(name)
                values[-1] = value
                form.setlist(name, values)
            else:
                form[name] = value
            response = self.client.post('/receipts', data=form)
            self.assertEqual(response.status_code, 422)
            self.assertIn('修正した商品', response.get_data(as_text=True))
            self.assertEqual(self.counts(), 0)

    def test_auth_csrf_and_token_ownership(self):
        anonymous = self.app.test_client()
        self.assertEqual(anonymous.get('/receipts').status_code, 302)
        self.assertEqual(self.client.post('/receipts/scan').status_code, 400)
        self.assertEqual(self.client.post('/receipts').status_code, 400)
        form = self.form()
        bob = self.app.test_client()
        self.login(bob, 'bob')
        form['csrf_token'] = self.token(bob.get('/receipts').get_data(as_text=True))
        self.assertEqual(bob.post('/receipts', data=form).status_code, 400)
        self.assertEqual(self.counts(), 0)
        form = self.form()
        form['import_token'] = 'forged'
        self.assertEqual(self.client.post('/receipts', data=form).status_code, 400)

    @patch('src.receipt_ocr.urlopen')
    def test_upload_limits_missing_key_and_bad_image(self, call):
        form = self.form()
        headers = {'X-CSRFToken': form['csrf_token']}
        self.app.config['OPENAI_API_KEY'] = ''
        self.assertEqual(self.client.post('/receipts/scan', headers=headers).status_code, 503)
        self.app.config['OPENAI_API_KEY'] = 'key'
        self.assertEqual(self.client.post('/receipts/scan', headers=headers).status_code, 400)
        for data, expected in [(b'invalid image', 422), (b'x' * (9 * 1024 * 1024), 413)]:
            response = self.client.post('/receipts/scan', headers=headers, data={'image': (io.BytesIO(data), 'receipt.png')})
            self.assertEqual(response.status_code, expected)
        call.assert_not_called()
        self.assertEqual(self.counts(), 0)

    def test_existing_database_migration_and_rollback(self):
        form = self.form()
        with self.app.app_context():
            db = get_db()
            db.execute('DROP TABLE receipt_imports')
            db.commit()
        create_app({'TESTING': True, 'SECRET_KEY': 'test-secret', 'DATABASE': self.app.config['DATABASE']})
        with self.app.app_context():
            db = get_db()
            db.execute("CREATE TRIGGER fail_second BEFORE INSERT ON transactions WHEN NEW.category='books' BEGIN SELECT RAISE(ABORT, 'test failure'); END")
            db.commit()
        import sqlite3
        with self.assertRaises(sqlite3.IntegrityError):
            self.client.post('/receipts', data=form)
        self.assertEqual(self.counts(), 0)
        with self.app.app_context():
            self.assertEqual(get_db().execute('SELECT count(*) FROM receipt_imports').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
