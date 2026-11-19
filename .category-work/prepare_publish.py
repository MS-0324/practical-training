"""Prepare only this task's edits against the verified GitHub branch head."""
import difflib
import json
from pathlib import Path
import subprocess

root = Path.cwd()
stage = root / '.category-work' / 'publish'
stage.mkdir(exist_ok=True)
paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', 'HEAD', '--',
                                 'src', 'tests', 'README.md', 'requirements.txt'], text=True).splitlines()
for name in paths:
    if '__pycache__' in name or name.endswith('.pyc'):
        continue
    destination = stage / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(subprocess.check_output(['git', 'show', 'HEAD:' + name]))

changed = ['src/app.py', 'src/schema.sql', 'src/analysis.py',
           'src/static/transactions.js', 'src/static/transactions.css',
           'src/templates/transaction_fields.html', 'README.md',
           'src/custom_categories.py', 'src/custom_categories.sql',
           'tests/test_custom_categories.py']
for name in changed:
    target = root / name
    current = target.read_text(encoding='utf-8')
    if name in ('src/app.py', 'src/schema.sql', 'README.md'):
        baseline = (root / '.category-work/baseline' / target.name).read_text(encoding='utf-8')
        original = (stage / name).read_text(encoding='utf-8')
        original_lines, baseline_lines = original.splitlines(keepends=True), baseline.splitlines(keepends=True)
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, original_lines, baseline_lines).get_opcodes():
            if tag == 'equal':
                continue
            previous_edit = ''.join(baseline_lines[j1:j2])
            if not previous_edit or current.count(previous_edit) != 1:
                raise RuntimeError('Pre-existing edit needs manual isolation: ' + name)
            current = current.replace(previous_edit, ''.join(original_lines[i1:i2]), 1)
    destination = stage / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(current, encoding='utf-8')
(root / '.category-work/publish-files.json').write_text(json.dumps(changed), encoding='utf-8')
print('Prepared task-only changes for', len(changed), 'files; pre-existing receipt edits excluded')
