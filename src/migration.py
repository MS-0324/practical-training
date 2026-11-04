"""Additive, repeatable SQLite migration; never rebuild existing tables."""
import sqlite3
from contextlib import closing
from pathlib import Path
from uuid import uuid4


def migrate_categories(database):
    path = Path(database)
    if not path.is_file():
        return
    with closing(sqlite3.connect(database)) as db, db:
        columns = {row[1] for row in db.execute('PRAGMA table_info(transactions)')}
        if not columns or 'category' in columns:
            return
        # SQLite backup includes committed WAL data, unlike copying the main file.
        backup = path.with_name(path.name + '.before-categories-' + uuid4().hex + '.bak')
        with closing(sqlite3.connect(backup)) as target:
            db.backup(target)
        # Serialize concurrent application startups and recheck under the lock.
        db.execute('BEGIN IMMEDIATE')
        columns = {row[1] for row in db.execute('PRAGMA table_info(transactions)')}
        if 'category' not in columns:
            db.execute("ALTER TABLE transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'uncategorized'")
