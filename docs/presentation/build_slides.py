#!/usr/bin/env python3
"""Builds the presentation (docs/presentation/CivicLink_Presentation.pptx): problem, then the design and
implementation decisions, then verification. Each slide has speaker notes.
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


def notes(s, text: str):
    s.notes_slide.notes_text_frame.text = text


def picture(s, path, left, top, width=None, height=None):
    kw = {}
    if width:
        kw['width'] = Inches(width)
    if height:
        kw['height'] = Inches(height)
    s.shapes.add_picture(str(ROOT / path), Inches(left), Inches(top), **kw)


# 1. Problem and purpose
s = slide('CivicLink: reporting service problems and warning residents', 'Sol Plaatje Local Municipality · Kimberley')
bullets(s, [
    'The problem|Reports come in by phone, walk-in and WhatsApp, with no location or photo. The same burst pipe is reported many times, teams are dispatched by phone with no record, and residents never hear back.',
    '31 March 2026|A workers\' strike closed roads across Kimberley and there was no official way to warn people.',
    'What I built|One web app where a report goes from the resident\'s phone to the right department, to a field worker and back, with alerts and a full audit trail.',
], width=6.4, size=17)
picture(s, 'docs/evidence/groups/g1-entry.png', 7.2, 1.7, width=5.6)
notes(s, 'Start with the strike story, then the everyday problem: no location, duplicates, no record, no feedback. CivicLink puts the whole process in one place.')

# 2. Scope
s = slide(f"All 39 requirements built and tested ({RESULTS['total']} automated tests)", 'What the system does')
bullets(s, [
    'Residents|report in 3 steps (map pin, photos, severity), even offline or as a guest; follow it live; confirm with a rating or reopen',
    'Officials|department queue, triage, assign one or many, escalate; alerts now or scheduled; analytics',
    'Field workers|accept, start and complete tasks with notes and a proof photo',
    'Administrators|staff, roles, departments, SLA targets, system log, SMS outbox',
    'Everyone|public home with alerts and open issues nearby, transparency page, install on the phone',
], width=6.6, size=17)
picture(s, 'docs/diagrams/state-report.png', 7.4, 1.8, width=5.4)
notes(s, 'The report state machine on the right is shared by the server and the interface, so the app only offers actions that are allowed.')

# 3. Architecture
s = slide('Reads from the database, changes through commands', 'Decision D1: architecture')
picture(s, 'docs/diagrams/overview.png', 0.5, 1.6, width=7.6)
bullets(s, [
    'Reads|the app listens to Firestore directly, so screens update by themselves. Security Rules decide who can read what.',
    'Changes|36 server commands: check the caller and role, validate with the same Zod schemas as the forms, then run a transaction.',
    'Why|Security Rules cannot check rules that span documents (reference numbers, duplicates, one active task).',
], left=8.4, width=4.5, size=15)
notes(s, 'This is the main design decision. Rules alone could not enforce the multi-document rules, so all writes are commands. The shared domain package means the browser and the server use the same validation and state machines.')

# 4. Transactions and idempotency
s = slide('Transactions and idempotent retries', 'Implementation: data integrity')
bullets(s, [
    'TX-1 submit|takes the next reference number, searches for duplicates within 100 m and saves the report, history, map entry and notifications together.',
    'TX-2 assign|re-checks "one active task per report" inside the transaction: if two officials assign at the same moment, exactly one wins (test IT-ASG-07).',
    'TX-3 complete|the task and the report are resolved together or not at all.',
    'Idempotent submit|the phone sends a random clientId; the server builds the report id from the user and that clientId. If the same report arrives twice, it returns the first one instead of creating a duplicate (IT-OFF-01).',
], width=12, size=17)
notes(s, 'Idempotency matters because offline reports are retried until the phone gets an answer. A lost response would otherwise create two reports.')

# 5. Free-tier deployment
s = slide('Running on free tiers without changing the code', 'Decision D2: deployment')
picture(s, 'docs/diagrams/deploy-simple.png', 0.5, 1.8, width=7.4)
bullets(s, [
    'Problem|Cloud Functions and Cloud Storage need Firebase\'s paid plan.',
    'Solution|the same command registry runs on Vercel through a small Node adapter; Firebase stays on the free Spark plan.',
    'Photos|compressed in the browser to ≤ 700 KB and stored in Firestore; the server checks the real file type from its first bytes.',
    'Schedules|GitHub Actions calls the maintenance endpoint hourly (Vercel\'s free cron is daily).',
], left=8.2, width=4.7, size=14)
notes(s, 'Because commands did not depend on how they were called, the second adapter was small. CI runs every end-to-end test through both adapters so they cannot drift apart.')

# 6. Caching and CDN
s = slide('Caching and the CDN: fast for residents, cheap for the database', 'Implementation: performance')
bullets(s, [
    'App files|hashed build files are cached for a year ("immutable"); the page itself is checked on every visit, so updates appear immediately.',
    'Public data|the transparency figures (5 min) and the public feed (1 min) are cached at Vercel\'s edge. However many people visit, Firestore is read about once per window.',
    'Server cache|each server instance also keeps the last result for up to a minute.',
    'Evidence|NFT-11 on the live site: x-vercel-cache = HIT on repeat requests.',
], width=6.6, size=16)
picture(s, 'docs/evidence/02-transparency.png', 7.4, 1.8, width=5.5)
notes(s, 'The public pages are open to anyone, so I could not let every visitor read the database. The CDN cache solves both speed and cost, and no Security Rule had to be opened to anonymous users.')

# 7. PWA and offline
s = slide('Installable app that keeps working offline', 'Decision D3: PWA and offline access')
bullets(s, [
    'Install|web app manifest + service worker: CivicLink installs on the home screen like an app.',
    'Open offline|at install the service worker saves every app file (the build writes the list into sw.js); pages fall back to the saved copy.',
    'Saved data|Firestore\'s offline cache shows reports and alerts already seen; up to 400 map tiles are kept.',
    'Report offline|"Save and send later" puts the report in an IndexedDB outbox; it is sent automatically on reconnect, with the same clientId.',
    'Lessons|the security policy also applies inside the service worker (DEF-14), and saved files must be matched ignoring Vary (DEF-16).',
], width=6.6, size=15)
picture(s, 'docs/evidence/groups/g4-community.png', 7.3, 1.8, width=5.6)
notes(s, 'I chose an IndexedDB outbox over Background Sync because Background Sync does not work in Firefox or Safari. Both defects were found by testing on the live site and on a phone.')

# 8. Maps
s = slide('Maps and location without paid APIs', 'Implementation: maps')
bullets(s, [
    'Leaflet + OpenStreetMap|no API key or billing; the suburb comes from a list, so no reverse geocoding is needed.',
    'Location|GPS or tap/drag the pin; a position outside Sol Plaatje is explained instead of silently used, and the nearest suburb is suggested.',
    'Duplicates|each report stores a geohash; a range query finds open reports of the same category within 100 m and 72 h.',
    'Privacy|the public map uses locations rounded to about 100 m and never shows names, descriptions or photos.',
    'Phones|open issues are also listed under the map, with "Me too" to confirm an issue instead of reporting it again.',
], width=6.6, size=15)
picture(s, 'docs/evidence/00-public-home.png', 8.0, 1.6, height=5.2)
notes(s, 'The geohash lets Firestore do a proximity search without a geo database; the exact distance is then checked by the duplicate policy, which is unit-tested at 99, 100 and 101 metres.')

# 9. Notifications and SMS
s = slide('Reaching residents: in-app, push and SMS', 'Implementation: notifications')
bullets(s, [
    'In-app|notifications are written in the same transaction as the status change and appear live.',
    'Web push|messages are collected while a command runs and sent only after it commits, so a failed command never notifies anyone; dead device tokens are removed.',
    'SMS|Emergency alerts go by SMS to residents who opted in. An SmsGateway interface has a Twilio and a simulated implementation; every message is stored with its status.',
    'Twilio trial|trial accounts only send preset templates, so a setting sends the template while the real text stays in the outbox.',
    'Scheduled alerts|published by the maintenance run, claimed in a transaction so they go out exactly once.',
], width=6.6, size=15)
picture(s, 'docs/evidence/32-sms-outbox.png', 7.3, 1.8, width=5.6)
notes(s, 'The gateway interface meant I could test SMS with a fake gateway and still send real messages through Twilio by configuration only.')

# 10. Analytics
s = slide('Analytics computed from live data', 'Implementation: analytics and transparency')
bullets(s, [
    'How|the server reads the reports and runs one pure function, computeAnalytics, that is unit-tested against a known dataset.',
    'Figures|open reports, resolution time, SLA compliance per department, 30-day trend and the average resident rating.',
    'Empty data|returns "no data" instead of NaN (UT-ANL-01).',
    'Public version|the same function feeds the transparency page, but only counts and averages leave the server.',
], width=6.4, size=16)
picture(s, 'docs/evidence/28-analytics.png', 7.2, 1.8, width=5.7)
notes(s, 'Keeping the calculation in one pure function meant the official dashboard and the public page always agree, and it is easy to test.')

# 11. Security
s = slide('Security and privacy', 'Implementation: access control')
bullets(s, [
    'Roles|signed custom claims + Security Rules for every read; every command re-checks the role and refuses deactivated accounts.',
    'Validation|the same Zod schemas in the forms and on the server; photo types checked from their bytes.',
    'Browser|enforced Content Security Policy and HSTS; no eval, so the validation library runs in "jitless" mode.',
    'Guests (D4)|anonymous Firebase sign-in, so all the normal rules still apply; 3 reports an hour, 10 guest sessions per network per hour.',
    'POPIA|residents can delete their account; reports stay as "Former resident"; data stays in South Africa.',
], width=12, size=17)
notes(s, 'For guests I chose anonymous sign-in over an open endpoint so there is only one authorisation path to get right.')

# 12. Verification and evaluation
s = slide(f"{RESULTS['total']} tests passing, all five success criteria met", 'Verification and evaluation')
bullets(s, [
    f"Levels|unit ({count('Unit')}), security rules ({count('Security rules')}), API integration ({count('Integration')}), end-to-end/PWA/live site ({count('E2E') + count('PWA') + count('Deployed')}); CI on every push.",
    'Performance|update reaches the resident in 1.9 s (target 5 s); screens < 1.4 s; p95 command 73 ms; 0 accessibility and 0 CSP violations.',
    'Live checks|the same tests run against the deployed site; push and SMS checked on a real phone.',
    'Defects|17 logged and fixed, several found only on the live site or a phone (tiles, offline, notifications panel).',
    'Next|paid SMS gateway with a queue, a paid scheduler, and a pilot with one department.',
], width=12, size=17)
notes(s, 'Finish with the success criteria and what I would do next. Then move to the live demo.')

def set_properties(cp, title):
    """Document properties show the author, not the generator or template author."""
    from datetime import datetime, timezone
    cp.title, cp.author, cp.last_modified_by = title, 'Nthoroane KP', 'Nthoroane KP'
    cp.comments = ''
    cp.modified = datetime.now(timezone.utc).replace(tzinfo=None)


set_properties(prs.core_properties, 'CivicLink Final Presentation')
prs.save(OUT)
print(f'Wrote {OUT.relative_to(ROOT)} ({len(prs.slides)} slides)')
