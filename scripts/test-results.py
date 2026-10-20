#!/usr/bin/env python3
"""Runs every automated suite with JSON reporters and writes docs/evidence/test-results.{json,md}.

  python3 scripts/test-results.py            # run all suites (≈ 8 min) and summarise
  python3 scripts/test-results.py --parse    # only summarise existing reports in test-reports/

The Markdown table is included in the final report's appendix (complete automated test results).
"""
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-reports'  # Playwright wipes test-results/, so Vitest output lives here
ID = re.compile(r'^((?:UT|RT|IT|E2E|NFT)-[A-Z0-9.-]+(?:\.\.[0-9]+)?)\s+(.*)$')


def run(cmd: str):
    print(f'$ {cmd}', flush=True)
    subprocess.run(cmd, shell=True, cwd=ROOT, check=False)


def run_all():
    OUT.mkdir(exist_ok=True)
    run('npm run build -w functions >/dev/null')
    run(f'npx vitest run --project shared --reporter=json --outputFile={OUT}/unit.json')
    run('npx firebase emulators:exec --only auth,firestore,functions '
        f'"npx vitest run --project rules --reporter=json --outputFile={OUT}/rules.json; '
        f'npx vitest run --project functions --reporter=json --outputFile={OUT}/functions.json"')
    run('npm run test:e2e')
    run(f'cp test-results/e2e.json {OUT}/e2e.json')
    run('npm run test:pwa')
    run(f'cp test-results/pwa.json {OUT}/pwa.json')


def vitest(file: str, suite: str):
    rows = []
    p = OUT / file
    if not p.exists():
        return rows
    for f in json.loads(p.read_text())['testResults']:
        for a in f['assertionResults']:
            rows.append((a['title'], suite, 'Pass' if a['status'] == 'passed' else a['status'].capitalize()))
    return rows


def playwright(file: str, suite: str):
    rows = []
    p = OUT / file
    if not p.exists():
        return rows

    def walk(s):
        for spec in s.get('specs', []):
            for t in spec['tests']:
                status = t['results'][-1]['status'] if t['results'] else 'skipped'
                rows.append((spec['title'], f"{suite} ({t.get('projectName', '')})", 'Pass' if status == 'passed' else status.capitalize()))
        for c in s.get('suites', []):
            walk(c)

    for s in json.loads(p.read_text())['suites']:
        walk(s)
    return rows


def main():
    if '--parse' not in sys.argv:
        run_all()
    rows = (vitest('unit.json', 'Unit') + vitest('rules.json', 'Security rules') + vitest('functions.json', 'Integration')
            + playwright('e2e.json', 'E2E') + playwright('pwa.json', 'PWA'))
    commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
    when = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    passed = sum(1 for r in rows if r[2] == 'Pass')
    data = {'date': when, 'commit': commit, 'total': len(rows), 'passed': passed,
            'tests': [{'title': t, 'suite': s, 'result': r} for t, s, r in rows]}
    ev = ROOT / 'docs/evidence'
    (ev / 'test-results.json').write_text(json.dumps(data, indent=2))
    lines = [f'Run {when} on commit `{commit}`: **{passed} of {len(rows)} passed**.', '',
             'Table: Complete automated test results', '', '| Test ID | Scenario | Suite | Result |', '|---|---|---|---|']
    for t, s, r in rows:
        m = ID.match(t)
        tid, scen = (m.group(1), m.group(2)) if m else ('—', t)
        lines.append(f"| {tid} | {scen.replace('|', '/')} | {s} | {r} |")
    (ev / 'test-results.md').write_text('\n'.join(lines) + '\n')
    print(f'{passed}/{len(rows)} passed → docs/evidence/test-results.md')


if __name__ == '__main__':
    main()
