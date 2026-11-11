# practical-training
for practical training
みんなコメントしてね！
こんにちは

## 収支管理アプリ

Python 3.11以上を使用します。既存の `src/a.py` は保持しています。

### セットアップ（PowerShell）

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:SECRET_KEY = (python -c "import secrets; print(secrets.token_hex(32))")
python -m flask --app src.app:create_app init-db
python -m flask --app src.app:create_app run
```

表示されたローカルURLを開き、メールアドレスでユーザー登録後にログインしてください。メールアドレスは254文字以内、パスワードは12〜128文字です。登録時には確認用パスワードも入力します。既存のユーザー名によるログインも引き続き利用できます。金額は整数の円単位（1〜1,000,000,000円）です。

macOS/Linuxでは `source .venv/bin/activate` と `export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"` を使用します。

SECRET_KEYは環境変数から取得し、未設定では起動を拒否します。実運用では生成した値を秘密管理サービスなどで保持し、再起動後も同じ値を注入してください。変更すると既存セッションは無効になります。`.env`は自動読込しません。秘密鍵・パスワード・実データはコミットしないでください。

SQLiteは `instance/app.sqlite3` に保存します。`init-db`は既存テーブル・データを削除しません。既存の別スキーマを移行する機能ではありません。バックアップはアプリ停止後にこのファイルを安全な場所へコピーしてください。

### 構成と認証の流れ

- `src/app.py`：アプリ生成、フォーム、ユーザーロード、認証、収支CRUD。
- `src/schema.sql`：usersと所有者外部キー付きtransactions、制約と索引。
- `src/templates/`：登録・ログイン・収支フォームとダッシュボード。
- `src/templates/register.html`：登録専用フォーム。`base.html`を継承し、フラッシュメッセージと共通ナビゲーションを表示します。
- `tests/test_app.py`：認証、CSRF、所有者制限などの回帰テスト。

登録時はWerkzeugのscryptでパスワードをハッシュ化して保存します。ログインでハッシュを検証し、既存セッションをクリアしてFlask-LoginにユーザーIDを登録します。Cookieは署名付きで、暗号化ではありません。パスワードや収支はCookieに保存しません。永続ログインは使わず、セッションはログインから30分で期限切れになります。ログアウトはCSRF付きPOSTでセッションをクリアします。

すべてのPOSTはFlask-WTFのCSRF検証を通ります。ログイン後は新しいCSRFトークンを発行します。収支は常にログインユーザーIDで絞り込み、他人のIDを指定しても404です。ユーザーIDのフォーム指定は信用しません。SQLはパラメータを使い、HTMLはJinjaでエスケープします。`next`パラメータは使用せず、ログイン後はダッシュボードへ移動します。

### テスト

新規登録のフィールド名は`email`、`password`、`confirm`です。既存データとの互換性のため、メールアドレスは既存の`users.username`列に保存し、ログインのフィールド名も`username`を維持します。DBの移行は不要です。メールアドレスの形式は検証しますが、確認メールの送信・所有確認は行いません。

```powershell
python -m unittest discover -s tests -v
```

一時DBとテスト専用鍵を使います。CSRFは無効化せずに検証します。

### 公開運用

開発サーバーはローカル学習用です。公開時はHTTPSと本番用WSGIサーバーを使用し、`SESSION_COOKIE_SECURE=1`を設定してください。CookieはHttpOnlyとSameSite=Laxを設定しています。デバッグを有効にして公開しないでください。ログイン試行の回数制限、パスワード再設定、メール確認、MFAは未実装のため、一般公開前に追加してください。


## カテゴリ分類・一覧からの収支追加

ダッシュボードの「＋ 収支を追加」を押し、種別→アイコン付きカテゴリ→金額・日付・任意メモを入力します。
支出22種類・収入8種類です。種別変更時はカテゴリを選び直します。
JavaScript有効時は画面遷移せず一覧・残高・月間支出状況を更新します。
JavaScript無効時も同じ画面のフォームを通常送信できます（カテゴリは全種類表示）。
入力エラー時は値を保持してパネルを開きます。キャンセル・Escapeで閉じます。
旧登録URLは追加パネルへ誘導します。編集画面でもカテゴリを変更できます。
メモ省略時は既存のdescription列の制約を保持するためカテゴリ名を保存します。

### 既存SQLiteの移行

アプリ起動時、既存transactionsテーブルにcategory列がない場合のみ自動移行します。
`flask --app src.app:create_app init-db`でも移行できます。
SQLite backup APIで同じディレクトリへ`app.sqlite3.before-categories-<識別子>.bak`を作成後、
トランザクション内で列を追加します。バックアップが失敗すると移行しません。
既存の収支・ユーザー・月間目標・ID・メモは保持され、既存カテゴリは「未分類」です。
再起動・再初期化で同じ列を追加しません。移行前は書き込みを停止してアプリを再起動してください。
DBディレクトリにはバックアップ作成権限と空き容量が必要です。
復旧する場合は全アプリを停止し、バックアップを別名のSQLiteとして指定して旧版アプリを起動してください。
バックアップには個人データが含まれるためDBと同等に保護してください（Git対象外）。

検証: `python -m unittest discover -s tests -v` および `node --test tests/transactions.test.cjs`（Node.js 18以上、追加パッケージ不要）
