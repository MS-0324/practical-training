import os
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import click
from flask import Flask, abort, current_app, flash, g, redirect, render_template, request, session, url_for
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from flask_wtf import CSRFProtect, FlaskForm
from werkzeug.security import check_password_hash, generate_password_hash
from wtforms import DateField, IntegerField, PasswordField, SelectField, StringField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Length, NumberRange


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


class User(UserMixin):
    def __init__(self, row):
        self.id = row['id']
        self.username = row['username']


class RegisterForm(FlaskForm):
    email = StringField('メールアドレス', filters=[lambda value: value.strip() if value else value],
                        validators=[DataRequired(), Length(max=254), Email(message='有効なメールアドレスを入力してください。')])
    password = PasswordField('パスワード', validators=[DataRequired(), Length(min=12, max=128)])
    confirm = PasswordField('パスワード（確認）', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('登録')


class LoginForm(FlaskForm):
    username = StringField('メールアドレス（既存のユーザー名も使用できます）',
                           filters=[lambda value: value.strip() if value else value],
                           validators=[DataRequired(), Length(max=254)])
    password = PasswordField('パスワード', validators=[DataRequired(), Length(max=128)])
    submit = SubmitField('ログイン')


class TransactionForm(FlaskForm):
    kind = SelectField('種別', choices=[('income', '収入'), ('expense', '支出')])
    amount = IntegerField('金額（円）', validators=[DataRequired(), NumberRange(min=1, max=1000000000)])
    description = StringField('内容', validators=[DataRequired(), Length(max=200)])
    date = DateField('日付', validators=[DataRequired()])
    submit = SubmitField('保存')


class ActionForm(FlaskForm):
    submit = SubmitField('実行')


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY'),
        DATABASE=os.environ.get('DATABASE_PATH') or str(Path(app.instance_path) / 'app.sqlite3'),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=os.environ.get('SESSION_COOKIE_SECURE') == '1',
        PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
        SESSION_REFRESH_EACH_REQUEST=False,
        MAX_CONTENT_LENGTH=16384,
    )
    if test_config:
        app.config.update(test_config)
    if not app.config['SECRET_KEY']:
        raise RuntimeError('SECRET_KEY環境変数を設定してください。')
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    database = Path(app.config['DATABASE']).expanduser()
    if not database.is_absolute():
        raise RuntimeError('DATABASE_PATHには絶対パスを指定してください。')
    database.parent.mkdir(parents=True, exist_ok=True)
    app.config['DATABASE'] = str(database)
    CSRFProtect(app)
    manager = LoginManager(app)
    manager.login_view = 'login'
    manager.session_protection = 'strong'
    # Used to keep password verification work similar for unknown usernames.
    dummy_hash = generate_password_hash('unused-dummy-password')

    @manager.user_loader
    def load_user(user_id):
        row = get_db().execute('SELECT id, username FROM users WHERE id = ?', (user_id,)).fetchone()
        return User(row) if row else None

    @app.teardown_appcontext
    def close_db(error=None):
        db = g.pop('db', None)
        if db is not None:
            db.close()

    @app.cli.command('init-db')
    def init_db():
        with app.open_resource('schema.sql') as schema:
            get_db().executescript(schema.read().decode('utf-8'))
        click.echo('データベースを初期化しました（既存データは保持）。')

    @app.context_processor
    def action_form():
        return {'action_form': ActionForm()}

    @app.after_request
    def private_response(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        return response

    @app.route('/')
    def index():
        return redirect(url_for('dashboard' if current_user.is_authenticated else 'login'))

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        form = RegisterForm()
        if form.validate_on_submit():
            db = get_db()
            try:
                with db:
                    db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                               (form.email.data, generate_password_hash(form.password.data)))
            except sqlite3.IntegrityError:
                form.email.errors.append('このメールアドレスは使用されています。')
            else:
                flash('登録しました。ログインしてください。')
                return redirect(url_for('login'))
        return render_template('register.html', title='ユーザー登録', form=form)

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        form = LoginForm()
        if form.validate_on_submit():
            row = get_db().execute('SELECT * FROM users WHERE username = ?', (form.username.data,)).fetchone()
            valid = check_password_hash(row['password_hash'] if row else dummy_hash, form.password.data)
            if row and valid:
                session.clear()
                login_user(User(row), remember=False)
                session.permanent = True
                return redirect(url_for('dashboard'))
            form.password.errors.append('メールアドレスまたはユーザー名、パスワードが違います。')
        return render_template('form.html', title='ログイン', form=form)

    @app.post('/logout')
    @login_required
    def logout():
        logout_user()
        session.clear()
        return redirect(url_for('login'))

    @app.get('/dashboard')
    @login_required
    def dashboard():
        rows = get_db().execute('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC', (current_user.id,)).fetchall()
        balance = sum(row['amount'] if row['kind'] == 'income' else -row['amount'] for row in rows)
        return render_template('dashboard.html', transactions=rows, balance=balance)

    def owned_transaction(transaction_id):
        row = get_db().execute('SELECT * FROM transactions WHERE id = ? AND user_id = ?', (transaction_id, current_user.id)).fetchone()
        if row is None:
            abort(404)
        return row

    @app.route('/transactions/new', methods=['GET', 'POST'])
    @login_required
    def transaction_new():
        form = TransactionForm()
        if form.validate_on_submit():
            db = get_db()
            with db:
                db.execute('INSERT INTO transactions (user_id, kind, amount, description, date) VALUES (?, ?, ?, ?, ?)',
                           (current_user.id, form.kind.data, form.amount.data, form.description.data, form.date.data.isoformat()))
            return redirect(url_for('dashboard'))
        return render_template('form.html', title='収支登録', form=form)

    @app.route('/transactions/<int:transaction_id>/edit', methods=['GET', 'POST'])
    @login_required
    def transaction_edit(transaction_id):
        row = owned_transaction(transaction_id)
        form = TransactionForm()
        if request.method == 'GET':
            form.kind.data, form.amount.data, form.description.data = row['kind'], row['amount'], row['description']
            form.date.data = date.fromisoformat(row['date'])
        if form.validate_on_submit():
            db = get_db()
            with db:
                db.execute('UPDATE transactions SET kind = ?, amount = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
                           (form.kind.data, form.amount.data, form.description.data, form.date.data.isoformat(), transaction_id, current_user.id))
            return redirect(url_for('dashboard'))
        return render_template('form.html', title='収支更新', form=form)

    @app.post('/transactions/<int:transaction_id>/delete')
    @login_required
    def transaction_delete(transaction_id):
        owned_transaction(transaction_id)
        db = get_db()
        with db:
            db.execute('DELETE FROM transactions WHERE id = ? AND user_id = ?', (transaction_id, current_user.id))
        return redirect(url_for('dashboard'))

    return app
