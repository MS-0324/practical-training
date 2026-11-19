"""Run the packaged chart adapter with a Windows-safe exclusive file copy."""
import os
import runpy
import shutil
import sys
from pathlib import Path

workspace = Path(__file__).resolve().parent
original_link = os.link

def exclusive_link(source, destination, **kwargs):
    try:
        return original_link(source, destination, **kwargs)
    except PermissionError:
        source, destination = Path(source).resolve(), Path(destination).resolve()
        if not source.is_relative_to(workspace) or not destination.is_relative_to(workspace):
            raise
        with source.open('rb') as incoming, destination.open('xb') as outgoing:
            shutil.copyfileobj(incoming, outgoing)

os.link = exclusive_link
helper = Path('C:/Users/maeya/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations/container_tools/materialize_literal_chart_workbooks.py')
sys.path.insert(0, str(helper.parent))
sys.argv = [str(helper), str(workspace / 'redesign-candidate.pptx'),
            str(workspace / 'redesign-portable.pptx'), '--workspace', str(workspace),
            '--receipt', str(workspace / 'redesign-chart-data.json')]
runpy.run_path(str(helper), run_name='__main__')
