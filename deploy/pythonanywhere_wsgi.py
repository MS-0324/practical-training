"""Copy this file into the PythonAnywhere Web tab's WSGI configuration."""
import sys
from pathlib import Path

from dotenv import load_dotenv

project = Path.home() / 'practical-training'
sys.path.insert(0, str(project))
# Keep this private file outside the Git checkout; console commands use it too.
load_dotenv(Path.home() / '.config' / 'practical-training.env', override=False)

from wsgi import application  # noqa: E402, F401
