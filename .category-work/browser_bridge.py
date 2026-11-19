"""Serve test-client responses over stdin/stdout, without a network server."""
import base64
import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.app import create_app, get_db
from werkzeug.security import generate_password_hash
with tempfile.TemporaryDirectory() as folder:
    app = create_app({'TESTING': True, 'SECRET_KEY': 'offline-browser-test',
                      'DATABASE': str(Path(folder) / 'test.sqlite3')})
    app.test_cli_runner().invoke(args=['init-db'])
    with app.app_context():
        db = get_db()
        db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                   ('demo@example.com', generate_password_hash('demo-password-only')))
        db.commit()
    client = app.test_client()
    for line in sys.stdin:
        message = json.loads(line)
        response = client.open(message['path'], method=message['method'],
                               data=base64.b64decode(message.get('body', '')),
                               headers=message.get('headers', {}), base_url='http://budget.test',
                               follow_redirects=True)
        print(json.dumps({'status': response.status_code, 'headers': dict(response.headers),
                          'body': base64.b64encode(response.data).decode()}), flush=True)
