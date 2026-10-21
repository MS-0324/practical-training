# 無料公開（PythonAnywhere、2026-10-21確認）

SQLiteを変更せず利用するため、PythonAnywhereの無料Webアプリを第一候補とします。
外部サービスのアカウント作成・GitHub連携・実データのアップロードは所有者が承認してから行います。

## 制限と保存先の選択

* PythonAnywhere: 無料は1アプリ、外向き通信制限あり。新規無料アカウントは定期実行・MySQLが対象外で、未使用Webアプリの期限は1か月。Webタブの期限と延長操作を確認してください。SQLiteはホーム領域に保存しますが、容量制限・アカウント停止・操作ミスに備えて別端末にバックアップが必要です。登録画面の最新容量制限も確認してください。無期限の無人運用や可用性は保証されません。
* Render Free: ローカルファイルは再起動・再デプロイで消失し、永続ディスクは無料枠対象外。このSQLiteアプリの実データ保存には使用しません。無料Postgresも期限があるため単純な代替にしません。
* 自動バックアップや安定した可用性が必要なら有料の永続ディスク、または外部DBを選択します。外部DB化は別途SQL・移行テストが必要で、今回の変更には含めません。

公式資料: [料金](https://www.pythonanywhere.com/pricing/)、[無料枠変更](https://blog.pythonanywhere.com/221/)、[Flask設定](https://help.pythonanywhere.com/pages/Flask/)、[環境変数](https://help.pythonanywhere.com/pages/EnvironmentVariables/)、[Render無料枠](https://render.com/docs/free)、[永続ディスク](https://render.com/docs/disks)。

## 新規デプロイ

1. PythonAnywhereの無料アカウントを作成し、Bashコンソールを開きます。無料枠であることを画面で確認します。
2. このPRをマージした後、以下を実行します。非公開リポジトリなら所有者自身の認証、またはソースのアップロードが必要です。トークンをURLやソースに書かないでください。

```bash
git clone https://github.com/MS-0324/practical-training.git ~/practical-training
cd ~/practical-training
python3.11 -m venv ~/.virtualenvs/practical-training
source ~/.virtualenvs/practical-training/bin/activate
python -m pip install -r requirements.txt
mkdir -p ~/.config ~/practical-training-data
chmod 700 ~/.config ~/practical-training-data
```

3. Files画面で `~/.config/practical-training.env` を作成し、次を保存します。`YOUR_USERNAME`を置換し、鍵は `python -c 'import secrets; print(secrets.token_hex(32))'` で生成した値に置換します。鍵は再起動しても維持し、GitHubに保存しません。

```text
SECRET_KEY=REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
SESSION_COOKIE_SECURE=1
DATABASE_PATH=/home/YOUR_USERNAME/practical-training-data/app.sqlite3
```

```bash
chmod 600 ~/.config/practical-training.env
set -a
source ~/.config/practical-training.env
set +a
python -m flask --app src.app:create_app init-db
```

`init-db`はCREATE IF NOT EXISTSのみです。自動起動時には実行しません。新しい保存先を選ぶと既存データは表示されません。既存データがある場合は先に下記の移行手順を実行します。

4. Webタブ → Add a new web app → Manual configuration → Python 3.11（利用可能な3.11以上でvenvと一致させる）。Source codeを `/home/YOUR_USERNAME/practical-training`、Virtualenvを `/home/YOUR_USERNAME/.virtualenvs/practical-training` にします。
5. WebタブのWSGI configuration fileを `deploy/pythonanywhere_wsgi.py` の内容に置換します。クローン先を変えた場合はprojectの値も合わせます。PythonAnywhere管理の本番WSGIサーバーが `application` を実行します。自分でFlask開発サーバーやWaitressを起動しません。
6. HTTPS強制を有効にしてReloadし、表示されるHTTPS URLで登録・ログイン・収支追加・編集・削除・ログアウトを確認します。Reload後も収支が残ることを確認してください。DB・env・ホーム領域を静的ファイル配信に指定しないでください。

## 既存SQLiteの移行とバックアップ

本番データにはテストを実行しません。ログインユーザーと収支は同一SQLiteに入っています。

```bash
python backup_db.py /ABSOLUTE/PATH/TO/EXISTING/app.sqlite3 /ABSOLUTE/PATH/TO/NEW/backup-20261021.sqlite3
```

SQLite backup APIで整合したコピーを作成し、integrity_checkします。元DBがなければ失敗し、既存の出力は上書きしません。出力先フォルダーは事前に用意します。

移行前に元アプリの書き込みを停止し、最終バックアップを作成・別端末にも保存します。バックアップをPythonAnywhereのデータフォルダーへアップロードし、既存ファイルを上書きせず新しい名前で配置してDATABASE_PATHをその絶対パスに合わせます。WSGIとコンソール両方で同じenvを読み、init-db実行後に件数・旧ユーザーのログイン・収支を確認します。切替確認が終わるまで元DBを保持し、両方のアプリへの並行書き込みを避けます。

運用時も更新前と入力後にバックアップし、Files画面から別端末へダウンロードしてください。同一サーバーのコピーだけではアカウント消失に備えられません。バックアップはメールアドレス・家計データ・パスワードハッシュを含むため非公開で保管します。復旧はアプリ停止後にバックアップを新しい名前で配置し、DATABASE_PATHを変更してReloadします。最後のバックアップ以降の入力は復旧できません。無料枠の手動作業が難しければ自動バックアップ可能な運用へ変更してください。

## 他の永続サーバーでの起動

環境変数3つを設定し、HTTPSを終端するリバースプロキシの背後で以下を実行します。WaitressはWindows/Linux対応の本番WSGIサーバーです。公開ポート・TLS・プロセス監視はサーバー側で設定してください。無条件に転送ヘッダーを信頼する設定は追加していません。

```bash
waitress-serve --host=127.0.0.1 --port=8080 --threads=4 wsgi:application
```

既存ログイン・CSRF・ユーザー分離は維持しています。ログイン試行制限、パスワード再設定、メール所有確認、MFAは未実装です。不特定多数への利用募集前に追加を検討してください。
