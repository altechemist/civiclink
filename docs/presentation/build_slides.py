#!/usr/bin/env python3
"""Builds the 6-slide presentation (docs/presentation/CivicLink_Presentation.pptx).
Requires python-pptx 1.0.2. Run from the repository root:  python3 docs/presentation/build_slides.py
"""
import json
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/presentation/CivicLink_Presentation.pptx'
# Test counts come from the latest full run (scripts/test-results.py).
RESULTS = json.loads((ROOT / 'docs/evidence/test-results.json').read_text())
count = lambda prefix: sum(1 for t in RESULTS['tests'] if t['suite'].startswith(prefix))
BRAND = RGBColor(0x0B, 0x4F, 0x6C)
INK = RGBColor(0x1E, 0x29, 0x3B)
MUTED = RGBColor(0x47, 0x55, 0x69)

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[6]


def slide(title: str, kicker: str = ''):
    s = prs.slides.add_slide(BLANK)
    bar = s.shapes.add_shape(1, 0, 0, prs.slide_width, Inches(0.12))
    bar.fill.solid()
    bar.fill.fore_color.rgb = BRAND
    bar.line.fill.background()
    if kicker:
        k = s.shapes.add_textbox(Inches(0.6), Inches(0.35), Inches(12), Inches(0.4)).text_frame
        k.text = kicker.upper()
        k.paragraphs[0].runs[0].font.size = Pt(13)
        k.paragraphs[0].runs[0].font.bold = True
        k.paragraphs[0].runs[0].font.color.rgb = BRAND
    t = s.shapes.add_textbox(Inches(0.6), Inches(0.7), Inches(12.1), Inches(0.9)).text_frame
    t.text = title
    run = t.paragraphs[0].runs[0]
    run.font.size, run.font.bold, run.font.color.rgb = Pt(30), True, INK
    foot = s.shapes.add_textbox(Inches(0.6), Inches(7.0), Inches(12), Inches(0.3)).text_frame
    foot.text = 'CivicLink · Nthoroane KP (202328762) · NPRJ740 2026'
    foot.paragraphs[0].runs[0].font.size = Pt(10)
    foot.paragraphs[0].runs[0].font.color.rgb = MUTED
    return s


def bullets(s, items, left=0.6, top=1.8, width=6.2, size=18):
    tf = s.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(5)).text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        bold, _, rest = item.partition('|')
        r = p.add_run()
        r.text = bold if rest else '• ' + bold
        r.font.size, r.font.color.rgb = Pt(size), INK
        if rest:
            r.font.bold = True
            r2 = p.add_run()
            r2.text = ' ' + rest
            r2.font.size, r2.font.color.rgb = Pt(size), MUTED
        p.space_after = Pt(10)
    return tf


def picture(s, path, left, top, width=None, height=None):
    kw = {}
    if width:
        kw['width'] = Inches(width)
    if height:
        kw['height'] = Inches(height)
    s.shapes.add_picture(str(ROOT / path), Inches(left), Inches(top), **kw)


# 1. Title + problem
s = slide('CivicLink: municipal incident reporting and community alerts', 'Sol Plaatje Local Municipality · Kimberley')
bullets(s, [
    'The problem:|reports by phone, walk-in and WhatsApp; no location or photos; duplicates; phone dispatch with no record; residents never hear back',
    '31 March 2026:|a workers\' strike closed roads across Kimberley, with no official way to warn residents or commuters',
    'The purpose:|one accountable workflow from report to resolution, with targeted alerts and an audit trail',
], width=6.4)
picture(s, 'docs/evidence/03-resident-home.png', 7.6, 1.5, height=5.3)
picture(s, 'docs/evidence/13-resident-alerts.png', 10.2, 1.5, height=5.3)

# 2. Solution & scope
s = slide('Four roles, one lifecycle: all 39 requirements delivered', 'Solution and final scope')
bullets(s, [
    'Residents|report in 3 steps (map pin, photos, severity), even offline; get a reference, follow it live, confirm with a rating or reopen',
    'Officials|department queue, triage, assign (one or many), escalate, suburb alerts now or scheduled, live analytics',
    'Field workers|accept, start and complete with notes and proof photos',
    'Administrators|staff accounts, roles, departments, SLA targets, system log',
    'Accounts|Google sign-in, password reset, profile, POPIA self-deletion with anonymised records',
    'Reach|web push, SMS for emergencies, "Me too" on the map, installable app that saves reports offline',
    'Open to everyone|a public home with alerts and open issues nearby; report as a guest, keep it with an account later; public time-to-fix figures from the CDN',
], width=7.4, size=17)
picture(s, 'docs/diagrams/state-report.png', 8.2, 1.6, width=4.7)

# 3. Architecture
s = slide('Commands on the server, real-time reads in the browser', 'Architecture')
picture(s, 'docs/diagrams/architecture.png', 0.6, 1.6, height=5.2)
bullets(s, [
    'React SPA|reads Firestore through live listeners, under Security Rules',
    'Node command API|one registry of 36 commands: auth, roles, Zod validation, transactions; served by Vercel (deployed) or Cloud Functions (local)',
    'Shared domain package|state machines, duplicate/SLA policies, used on both sides',
    'Free tier|Vercel + Firebase Spark; photos stored in Firestore; emulator for offline demo and tests',
], left=8.5, width=4.3, size=15)

# 4. Decisions
s = slide('Decisions that shaped the system', 'Engineering decisions')
bullets(s, [
    'D1: Every state change is a server command in a transaction|Rules alone cannot enforce "one active task", reference counters or the 100 m duplicate search. TX-1 submit, TX-2 assign, TX-3 complete are atomic; two simultaneous assignments → exactly one wins.',
    'D3: Free-tier deployment without Cloud Functions|Firebase Spark + a Node API on Vercel; photos compressed to ≤ 700 KB and stored in Firestore with real-type checks. One command registry, two adapters, and CI runs every E2E test through both.',
    'D5: Offline reports through an outbox and idempotent commands|Saved on the phone (IndexedDB) and sent on reconnect with a device-chosen id, so a resend is stored once. Works in every browser, unlike Background Sync.',
    'Also:|public figures from the CDN cache (D6); enforced CSP + HSTS; Leaflet + OpenStreetMap instead of Google Maps; React SPA instead of Next.js.',
], width=12, size=18)

# 5. Verification
s = slide(f"{RESULTS['total']} automated tests, all green", 'Verification')
bullets(s, [
    f"Unit ({count('Unit')})|state machines, duplicate boundaries 99/100/101 m and 71/72/73 h, SLA, schedules, ratings, SMS text; 97.9% coverage",
    f"Security rules ({count('Security rules')})|every cell of the permission matrix, allow and deny",
    f"API integration ({count('Integration')})|validation, authorisation, wrong-state and concurrency for every command; push and SMS with fake gateways",
    f"End-to-end, PWA, live site ({count('E2E') + count('PWA') + count('Deployed')})|full lifecycle across 3 browsers, offline drafts, scheduled alerts, bulk assign, transparency, access denied, Google sign-in; CDN and CSP on the live site",
    'NFRs|update reaches the resident in 2.5 s (target 5 s), screens < 1.1 s, p95 command 28 ms, 0 WCAG and 0 CSP violations',
], width=7.6, size=16)
picture(s, 'docs/evidence/23-triage-assign.png', 8.4, 1.7, width=4.5)

# 6. Evaluation
s = slide('All five success criteria achieved', 'Evaluation and next steps')
bullets(s, [
    'SC-01 End-to-end lifecycle|E2E-01 passes in Chromium and Firefox',
    'SC-02 Server-side rules|BR-03 to BR-11 tested through the API, bypassing the UI',
    'SC-03 Access control|20 rule tests + authorisation tests + E2E-04',
    'SC-04 Timely information|0.09 s to the official, 2.47 s to the resident',
    'SC-05 Live visibility|analytics verified against the dataset',
    'Next|a paid SMS gateway with a send queue; Cloud Scheduler for exact alert times; a pilot with one department',
], width=12, size=18)

prs.save(OUT)
print(f'Wrote {OUT.relative_to(ROOT)} ({len(prs.slides)} slides)')
