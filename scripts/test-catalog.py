#!/usr/bin/env python3
"""Regenerates docs/trackers/test-catalog.md from the test titles in the codebase (single source of truth)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUITES = [
    ('Unit (Vitest)', 'packages/shared/test'),
    ('Security rules (emulator)', 'tests/rules'),
    ('Cloud Functions integration (emulator)', 'functions/test'),
    ('End-to-end and non-functional (Playwright)', 'tests/e2e'),
]
TITLE = re.compile(r"""\b(?:it|test)\(\s*(['"`])((?:UT|RT|IT|E2E|NFT)-[A-Z0-9.-]+(?:\.\.[0-9]+)?)\s+(.+?)\1""")
out = ['# Test Catalogue', '',
       'Generated from the test code by `python3 scripts/test-catalog.py`. Every ID cited in the report appears in a test title, '
       'so `grep -r "<ID>"` finds the test. Results for the submitted commit are in its GitHub Actions run.', '']
total = 0
for name, folder in SUITES:
    rows = []
    for f in sorted((ROOT / folder).rglob('*.ts')):
        for m in TITLE.finditer(f.read_text(encoding='utf8')):
            rows.append((m.group(2), m.group(3).replace('|', '/'), f.relative_to(ROOT)))
    total += len(rows)
    out += [f'## {name}: {len(rows)} tests', '', '| ID | Scenario | File |', '|---|---|---|']
    out += [f'| {i} | {t} | `{p}` |' for i, t, p in rows]
    out.append('')
out.insert(4, f'**Total: {total} automated tests.**\n')
(ROOT / 'docs/trackers/test-catalog.md').write_text('\n'.join(out), encoding='utf8')
print(total)
