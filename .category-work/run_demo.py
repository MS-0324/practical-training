import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.app import create_app, get_db
from werkzeug.security import generate_password_hash
app = create_app({'SECRET_KEY': 'local-ui-test-only',
                  'DATABASE': str(Path(__file__).with_name('ui.sqlite3'))})
with app.app_context():
    db = get_db()
    db.executescript(Path('src/schema.sql').read_text(encoding='utf-8'))
    db.execute('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, ?, ?)',
               ('demo@example.com', generate_password_hash('demo-password-only')))
    db.commit()
app.run(host='127.0.0.1', port=5051, use_reloader=False)
