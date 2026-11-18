import os
import sqlite3
import requests
from datetime import date, datetime, timedelta
from pathlib import Path

import click
from flask import Flask, abort, current_app, flash, g, redirect, render_template, request, session, url_for, jsonify
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from flask_wtf import CSRFProtect, FlaskForm
from werkzeug.security import check_password_hash, generate_password_hash
from wtforms import DateField, IntegerField, TextAreaField, PasswordField, SelectField, StringField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Length, NumberRange, Regexp

def search_yahoo_product(jan_code):
    client_id = os.environ.get('YAHOO_CLIENT_ID')

    if not client_id:
        return None

    url = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch'

    params = {
        'appid': client_id,
        'jan_code': jan_code,
        'results': 1
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        current_app.logger.info(f'検索したJANコード: {jan_code}')

        data = response.json()
        hits = data.get('hits', [])
        current_app.logger.info(f'Yahoo検索結果: {data}')

        if hits and hits[0].get('janCode') == jan_code:
            return hits[0].get('name')

        return None

    except requests.RequestException as error:
        current_app.logger.error(
            f'Yahoo!商品検索エラー: {error}'
        )
        return None
    
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

expense_categories = [('food', '🍚食事'),('transport','🚃交通'),('housing','🏠住居'),('daily','🧴生活用品'),
                    ('education','📚教育'),('entertainment','🎮娯楽'),('medical_beauty','💊医療・娯楽'),('other','📦その他')]
income_categories = [('salary','💰給与'),('allowance','🎁仕送り'),('temporary','✨臨時収入'),('other','💵その他')]

class TransactionForm(FlaskForm):
    kind = SelectField('種別', choices=[('income', '収入'), ('expense', '支出')])
    amount = IntegerField('金額（円）', validators=[DataRequired(), NumberRange(min=1, max=1000000000)])
    description = TextAreaField('内容', validators=[DataRequired(), Length(max=200)],
                                render_kw={'rows': 5,'styale': 'width:100%; box-sizing:border-box; resize:vertical;'})
    category = SelectField('カテゴリー', choices=[],validators=[DataRequired()])
    date = DateField('日付', validators=[DataRequired()])
    submit = SubmitField('保存')

class MonthlySpendingGoalForm(FlaskForm):
    month = StringField(
        '対象月',
        validators = [
            DataRequired(),
            Regexp(
                r'^\d{4}-(0[1-9]|1[0-2])$',
                message='対象月を正しく選択してください。'
            )
        ],
        render_kw = {'type':'month'}
    )
    amount = IntegerField(
        '支出上限(円)',
        validators = [
            DataRequired(),
            NumberRange(min = 1, max = 1000000000)
        ]
    )
    submit = SubmitField('目標を保存')

class ActionForm(FlaskForm):
    submit = SubmitField('実行')


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY'),
        DATABASE=str(Path(app.instance_path) / 'app.sqlite3'),
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
        db = get_db()
        with app.open_resource('schema.sql') as schema:
            get_db().executescript(schema.read().decode('utf-8'))
        columns = db.execute(
            "PRAGMA table_info(transactions)"
        ).fetchall()
        if not any(column['name'] == 'category' for column in columns):
            db.execute(
                "ALTER TABLE transactions ADD COLUMN category TEXT"
            )
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

    @app.get('/api/product/<jan_code>')
    @login_required
    def api_product(jan_code):
        if not jan_code.isdigit():
            return jsonify({'product_name': None}), 400

        product_name = search_yahoo_product(jan_code)

        return jsonify({
            'product_name': product_name
        })

    @app.get('/dashboard')
    @login_required
    def dashboard():
        db = get_db()

        rows = db.execute(
            '''
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY date DESC, id DESC
            ''', 
            (current_user.id,)
        ).fetchall()

        balance = sum(
            row['amount'] if row['kind'] == 'income' else -row['amount'] 
            for row in rows
        )

        selected_month = request.args.get(
            'month', date.today().strftime('%Y-%m')
        )

        try:
            selected_month = datetime.strptime(selected_month, '%Y-%m').strftime('%Y-%m')
        except ValueError:
            selected_month = date.today().strftime('%Y-%m')

        current_month = datetime.strptime(selected_month, '%Y-%m')

        previous_month = (
            current_month.replace(day=1) - timedelta(days=1)
        ).strftime('%Y-%m')

        next_month = (
            current_month.replace(day=28) + timedelta(days=4)
        ).replace(day=1).strftime('%Y-%m')

        monthly_totals = db.execute(
            '''
            SELECT kind, COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE user_id = ?
              AND substr(date, 1, 7) = ?
            GROUP BY kind
            ''',
            (current_user.id, selected_month)
        ).fetchall()

        monthly_income = 0
        monthly_expense = 0

        for item in monthly_totals:
            if item['kind'] == 'income':
                monthly_income = item['total']
            else:
                monthly_expense = item['total']

        category_rows = db.execute(
            '''
            SELECT COALESCE(category, 'other') AS category,
                   SUM(CASE WHEN kind = 'expense' THEN amount ELSE 0 END) AS expense_total,
                   SUM(CASE WHEN kind = 'income' THEN amount ELSE 0 END) AS income_total
            FROM transactions
            WHERE user_id = ?
              AND substr(date, 1, 7) = ?
            GROUP BY category
            HAVING SUM(CASE WHEN kind = 'expense' THEN amount ELSE 0 END) > 0
            ORDER BY expense_total DESC
            ''',
            (current_user.id, selected_month)
        ).fetchall()

        category_labels = dict(expense_categories)
        category_colors = {
            'food': '#F59E0B',
            'transport': '#3B82F6',
            'housing': '#8B5CF6',
            'daily': '#10B981',
            'education': '#06B6D4',
            'entertainment': '#EC4899',
            'medical_beauty': '#EF4444',
            'other': '#9CA3AF'
        }
        category_totals = []
        for item in category_rows:
            category = item['category']
            expense_total = item['expense_total']
            income_total = item['income_total']

            category_totals.append({
                'category': category,
                'label': category_labels.get(category, '📦その他'),
                'total': expense_total,
                'income_total': income_total,
                'expense_total': expense_total,
                'percent': round(
                    expense_total / monthly_expense * 100, 1 
                ) if monthly_expense else 0,
                'color': category_colors.get(category, '#9CA3AF')
            })

        category_records = {}

        record_rows = db.execute(
            '''
            SELECT id, kind, amount, description, date, category
            FROM transactions
            WHERE user_id = ?
              AND substr(date, 1, 7) = ?
            ORDER BY date DESC, id DESC
            ''',
            (current_user.id, selected_month)
        ).fetchall()

        for row in record_rows:
            category = row['category'] or 'other'

            category_records.setdefault(category, []).append({
                'id': row['id'],
                'kind': row['kind'],
                'amount': row['amount'],
                'description': row['description'],
                'date': row['date']
            })

        for item in category_totals:
            item['records'] = category_records.get(item['category'], [])

        recent_transactions = db.execute(
            '''
            SELECT *
            FROM transactions
            WHERE user_id = ?
            ORDER BY date DESC, id DESC
            LIMIT 3
            ''',
            (current_user.id,)
        ).fetchall()

        year, month = map(int, selected_month.split('-'))
        comparison_months = []

        for _ in range(4):
            month_text = f'{year:04d}-{month:02d}'
            expense = db.execute(
                '''
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM transactions
                WHERE user_id = ?
                  AND kind = 'expense'
                  AND substr(date, 1, 7) = ?
                ''',
                (current_user.id, month_text)
            ).fetchone()

            comparison_months.append({
                'month': month_text,
                'total': expense['total']
            })

            month -= 1
            if month == 0:
                month = 12
                year -= 1

        comparison_months.reverse()

        goal_row = db.execute(
            '''
            SELECT amount
            FROM monthly_spending_goals
            WHERE user_id = ? AND month = ?
            ''',
            (current_user.id, selected_month)
        ).fetchone()

        goal_amount = goal_row['amount'] if goal_row else None
        remaining_amount = (
            goal_amount - monthly_expense
            if goal_amount is not None else None
        )

        usage_percent = (
            round(monthly_expense / goal_amount * 100, 1)
            if goal_amount is not None else 0
        )

        usage_bar_percent = min(usage_percent, 100)

        return render_template(
            'dashboard.html',
            transactions=recent_transactions,
            balance=balance,
            selected_month=selected_month,
            previous_month=previous_month,
            next_month=next_month,
            monthly_income=monthly_income,
            monthly_expense=monthly_expense,
            category_totals=category_totals,
            goal_amount=goal_amount,
            remaining_amount=remaining_amount,
            usage_percent=usage_percent,
            usage_bar_percent=usage_bar_percent,
            comparison_months=comparison_months
        )

    @app.route('/goals', methods=['GET', 'POST'])
    @login_required
    def spending_goal():
        form = MonthlySpendingGoalForm()

        if form.validate_on_submit():
            db = get_db()

            with db:
                db.execute(
                    '''
                    INSERT INTO monthly_spending_goals
                    (user_id, month, amount)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, month)
                    DO UPDATE SET amount = excluded.amount
                    ''',
                    (
                        current_user.id,
                        form.month.data,
                        form.amount.data
                    )
                )

            flash('月間支出目標を保存しました。')
            return redirect(url_for('dashboard', month=form.month.data))

        form.month.data = date.today().strftime('%Y-%m')

        return render_template(
            'form.html',
            title='月間支出目標',
            form=form
        )

    @app.get('/transactions/category/<category>')
    @login_required
    def category_transactions(category):
        db = get_db()

        category_labels = dict(expense_categories)

        if category not in category_labels:
            abort(404)

        selected_month = request.args.get(
            'month', date.today().strftime('%Y-%m')
        )

        try:
            selected_month = datetime.strptime(
                selected_month, '%Y-%m'
            ).strftime('%Y-%m')
        except ValueError:
            selected_month = date.today().strftime('%Y-%m')

        transactions = db.execute(
            '''
            SELECT *
            FROM transactions
            WHERE user_id = ?
              AND kind = 'expense'
              AND category = ?
              AND substr(date, 1, 7) = ?
            ORDER BY date DESC, id DESC
            ''',
            (current_user.id, category, selected_month)
        ).fetchall()

        total = sum(row['amount'] for row in transactions)

        return render_template(
            'category_transactions.html',
            transactions=transactions,
            category_label=category_labels[category],
            selected_month=selected_month,
            total=total,
            action_form=FlaskForm()
        )
    
    @app.route('/transactions/new', methods=['GET', 'POST'])
    @login_required
    def transaction_new():
        form = TransactionForm()

        form.category.choices = (
            income_categories
            if form.kind.data == 'income'
            else expense_categories
        )

        if form.validate_on_submit():
            db = get_db()

            with db:
                db.execute(
                    '''
                    INSERT INTO transactions
                    (user_id, kind, amount, description, category, date)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        current_user.id,
                        form.kind.data,
                        form.amount.data,
                        form.description.data,
                        form.category.data,
                        form.date.data.isoformat()
                    )
                )

            flash('収支を登録しました。')
            return redirect(url_for('dashboard'))

        return render_template(
            'form.html',
            title='収支登録',
            form=form
        )

    @app.route('/transactions/<int:transaction_id>/edit', methods=['GET', 'POST'])
    @login_required
    def transaction_edit(transaction_id):
        db = get_db()

        row = db.execute(
            '''
            SELECT *
            FROM transactions
            WHERE id = ? AND user_id = ?
            ''',
            (transaction_id, current_user.id)
        ).fetchone()

        if row is None:
            abort(404)

        form = TransactionForm()

        if request.method == 'GET':
            form.kind.data = row['kind']
            form.amount.data = row['amount']
            form.description.data = row['description']
            form.category.data = row['category']
            form.date.data = date.fromisoformat(row['date'])

        form.category.choices = (
            income_categories
            if form.kind.data == 'income'
            else expense_categories
        )

        if form.validate_on_submit():
            with db:
                db.execute(
                    '''
                    UPDATE transactions
                    SET kind = ?, amount = ?, description = ?,
                        category = ?, date = ?
                    WHERE id = ? AND user_id = ?
                    ''',
                    (
                        form.kind.data,
                        form.amount.data,
                        form.description.data,
                        form.category.data,
                        form.date.data.isoformat(),
                        transaction_id,
                        current_user.id
                    )
                )

            flash('収支を更新しました。')
            return redirect(url_for('dashboard'))

        return render_template(
            'form.html',
            title='収支編集',
            form=form
        )  

    @app.post('/transactions/<int:transaction_id>/delete')
    @login_required
    def transaction_delete(transaction_id):
        db = get_db()

        row = db.execute(
            '''
            SELECT id
            FROM transactions
            WHERE id = ? AND user_id = ?
            ''',
            (transaction_id, current_user.id)
        ).fetchone()

        if row is None:
            abort(404)

        with db:
            db.execute(
                '''
                DELETE FROM transactions
                WHERE id = ? AND user_id = ?
                ''',
                (transaction_id, current_user.id)
            )

        flash('収支を削除しました。')
        return redirect(url_for('dashboard')) 
    return app