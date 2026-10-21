"""Production entry point. No schema changes or development server on import."""
import os

from src.app import create_app

if os.environ.get('SESSION_COOKIE_SECURE') != '1':
    raise RuntimeError('本番環境では SESSION_COOKIE_SECURE=1 が必要です。')
if len(os.environ.get('SECRET_KEY', '')) < 32:
    raise RuntimeError('本番環境では32文字以上のランダムな SECRET_KEY が必要です。')
if not os.environ.get('DATABASE_PATH'):
    raise RuntimeError('本番環境では永続領域の DATABASE_PATH を明示してください。')

application = create_app()
application.config.update(DEBUG=False, TESTING=False)
