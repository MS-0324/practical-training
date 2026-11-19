"""User-owned categories; archiving preserves the meaning of past records."""
import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path

from .categories import CATEGORIES, CATEGORY_LABELS


def migrate_custom_categories(database):
    if not Path(database).is_file():
        return
    with closing(sqlite3.connect(database)) as db, db:
        # This additive migration never rewrites transactions or their labels.
        schema = Path(__file__).with_name('custom_categories.sql').read_text(encoding='utf-8')
        db.executescript(schema)


def category_key(category_id):
    return f'custom_{category_id}'


def custom_categories(db, user_id, include_archived=False):
    sql = 'SELECT * FROM custom_categories WHERE user_id = ?'
    if not include_archived:
        sql += ' AND is_active = 1'
    return db.execute(sql + ' ORDER BY id', (user_id,)).fetchall()


def category_definitions(db, user_id, include_archived=False):
    return list(CATEGORIES) + [
        (category_key(row['id']), row['kind'], '🏷️', row['name'])
        for row in custom_categories(db, user_id, include_archived)
    ]


def category_labels(db, user_id):
    labels = dict(CATEGORY_LABELS)
    labels.update({category_key(row['id']): '🏷️ ' + row['name']
                   for row in custom_categories(db, user_id, include_archived=True)})
    return labels


def normalized_name(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split())


def create_category(db, user_id, kind, raw_name):
    name = normalized_name(raw_name)
    if kind not in ('income', 'expense'):
        raise ValueError('収入または支出を選んでください。')
    if not 1 <= len(name) <= 30:
        raise ValueError('カテゴリ名を1〜30文字で入力してください。')
    if any(unicodedata.category(char).startswith('C') for char in name):
        raise ValueError('カテゴリ名に制御文字は使えません。')
    key_name = name.casefold()
    if any(normalized_name(label).casefold() == key_name and category_kind == kind
           for _, category_kind, _, label in CATEGORIES):
        raise ValueError('同じ名前の標準カテゴリがあります。一覧から選んでください。')
    with db:
        # Repeated submissions reuse the same ID. Re-adding an archived name
        # restores it, so historical and new records remain grouped together.
        db.execute('''INSERT INTO custom_categories (user_id, kind, name, normalized_name)
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT(user_id, kind, normalized_name)
                      DO UPDATE SET is_active = 1''', (user_id, kind, name, key_name))
        row = db.execute('''SELECT * FROM custom_categories
                            WHERE user_id = ? AND kind = ? AND normalized_name = ?''',
                         (user_id, kind, key_name)).fetchone()
    return row


def archive_category(db, user_id, key):
    # Match the full opaque key and owner, never a client-supplied user_id.
    with db:
        changed = db.execute('''UPDATE custom_categories SET is_active = 0
                                WHERE user_id = ? AND 'custom_' || id = ?''',
                             (user_id, key)).rowcount
    return bool(changed)


def custom_category_color(key):
    if key.startswith('custom_') and key[7:].isdigit():
        return f'hsl({int(key[7:]) * 137 % 360} 65% 65%)'
    return '#94a3b8'
