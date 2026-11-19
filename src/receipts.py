"""Receipt review and atomic, idempotent batch import."""
import secrets
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from itsdangerous import BadSignature, URLSafeTimedSerializer

from .receipt_ocr import EXPENSE_CHOICES, EXPENSE_KEYS, MAX_IMAGE_BYTES, MAX_ITEMS, ReceiptError, extract_receipt

IMPORT_SCHEMA = '''CREATE TABLE IF NOT EXISTS receipt_imports (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)'''


def migrate_receipts(database):
    if not Path(database).is_file():
        return
    with closing(sqlite3.connect(database)) as db, db:
        if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").fetchone():
            db.execute(IMPORT_SCHEMA)


def register_receipts(app, get_db):
    bp = Blueprint('receipts', __name__)

    def signer():
        return URLSafeTimedSerializer(current_app.secret_key, salt='receipt-import')

    @bp.route('/receipts', methods=['GET', 'POST'])
    @login_required
    def review():
        errors = []
        items = []
        selected_date = date.today().isoformat()
        token = signer().dumps({'user_id': current_user.id, 'nonce': secrets.token_hex(16)})
        if request.method == 'POST':
            token = request.form.get('import_token', '')
            try:
                token_data = signer().loads(token, max_age=3600)
                if token_data['user_id'] != current_user.id:
                    raise BadSignature('wrong owner')
            except (BadSignature, KeyError, TypeError):
                return '確認画面の有効期限が切れています。レシート読み取り画面を開き直してください。', 400
            categories = request.form.getlist('category')
            amounts = request.form.getlist('amount')
            descriptions = request.form.getlist('description')
            selected_date = request.form.get('date', '')
            try:
                if date.fromisoformat(selected_date).isoformat() != selected_date:
                    raise ValueError
            except ValueError:
                errors.append('日付を正しく入力してください。')
            if not 1 <= len(categories) <= MAX_ITEMS or not len(categories) == len(amounts) == len(descriptions):
                errors.append('明細は1〜100行で入力してください。')
            else:
                for number, (category, amount, description) in enumerate(zip(categories, amounts, descriptions), 1):
                    item = {'category': category, 'amount': amount, 'description': description.strip()}
                    items.append(item)
                    if category not in EXPENSE_KEYS:
                        errors.append(f'{number}行目：支出カテゴリを選んでください。')
                    if not 1 <= len(amount) <= 10 or not amount.isascii() or not amount.isdecimal() or not 1 <= int(amount) <= 1_000_000_000:
                        errors.append(f'{number}行目：金額は1〜1,000,000,000円の整数にしてください。')
                    if len(item['description']) > 200:
                        errors.append(f'{number}行目：商品名・メモは200文字以内にしてください。')
            if request.form.get('confirmed') != 'yes':
                errors.append('内容と合計金額を確認してチェックを入れてください。')
            if not errors:
                db = get_db()
                with db:
                    inserted = db.execute('INSERT OR IGNORE INTO receipt_imports (token, user_id) VALUES (?, ?)',
                                          (token, current_user.id)).rowcount
                    if inserted:
                        labels = dict(EXPENSE_CHOICES)
                        db.executemany('INSERT INTO transactions (user_id, kind, amount, description, date, category) '
                                       "VALUES (?, 'expense', ?, ?, ?, ?)",
                                       [(current_user.id, int(item['amount']), item['description'] or labels[item['category']],
                                         selected_date, item['category']) for item in items])
                flash(f'レシートから支出を{len(items)}件登録しました。' if inserted else 'この確認内容は登録済みです。重複登録はしていません。')
                return redirect(url_for('dashboard', month=selected_date[:7]))
        return render_template('receipts.html', title='レシート読み取り', items=items, errors=errors,
                               selected_date=selected_date, import_token=token,
                               receipt_categories=EXPENSE_CHOICES,
                               ocr_available=bool(current_app.config['OPENAI_API_KEY'])), (422 if errors else 200)

    @bp.post('/receipts/scan')
    @login_required
    def scan():
        if not current_app.config['OPENAI_API_KEY']:
            return jsonify(error='読み取りAPIが未設定です。管理者に設定を依頼してください。'), 503
        upload = request.files.get('image')
        if upload is None:
            return jsonify(error='画像を選んでください。'), 400
        try:
            result = extract_receipt(upload.read(MAX_IMAGE_BYTES + 1), current_app.config['OPENAI_API_KEY'],
                                     current_app.config['OPENAI_RECEIPT_MODEL'])
        except ReceiptError as exc:
            return jsonify(error=str(exc)), 422
        return jsonify(result)

    app.register_blueprint(bp)
