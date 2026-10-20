#!/usr/bin/env python3
"""Combines phone-sized screenshots from docs/evidence into labelled side-by-side figures for report §5.5.

    python3 scripts/evidence-groups.py      (needs Pillow; run after `npm run evidence`)

Each group is one user journey, so the report shows three phone screens per figure instead of one per page.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
EV = ROOT / 'docs/evidence'
OUT = EV / 'groups'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

GROUPS = {
    'g1-entry': [('00-public-home', 'Public home (visitor)'), ('01-login', 'Sign in'), ('33-guest-account', 'Guest: keep reports')],
    'g2-report': [('06-report-step2-details', 'Report: details'), ('05-report-validation-errors', 'Validation errors'), ('09-report-duplicate', 'Duplicate detected')],
    'g3-resolution': [('43-worker-completed', 'Worker: completed'), ('11-report-resolved-confirm', 'Resident: resolved'), ('12-rate-service', 'Resident: rating')],
    'g4-community': [('13-resident-alerts', 'Suburb alerts'), ('18-map-me-too', '"Me too" on the map'), ('19-offline-mode', 'Offline: report saved')],
    'g5-account': [('15-permission-denied', 'Access denied'), ('16-google-welcome', 'Google: first sign-in'), ('17-profile-popia', 'Profile and deletion')],
}

GAP, PAD, LABEL_H = 24, 16, 46


def build(name: str, items: list[tuple[str, str]]):
    shots = [Image.open(EV / f'{f}.png').convert('RGB') for f, _ in items]
    w, h = shots[0].size
    canvas = Image.new('RGB', (PAD * 2 + len(shots) * w + (len(shots) - 1) * GAP, PAD * 2 + h + LABEL_H), 'white')
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 22)
    for i, (img, (_, label)) in enumerate(zip(shots, items)):
        x = PAD + i * (w + GAP)
        canvas.paste(img, (x, PAD))
        draw.rectangle([x - 1, PAD - 1, x + w, PAD + h], outline=(203, 213, 225), width=1)
        text = f'({chr(97 + i)}) {label}'
        tw = draw.textlength(text, font=font)
        draw.text((x + (w - tw) / 2, PAD + h + 12), text, fill=(30, 41, 59), font=font)
    OUT.mkdir(exist_ok=True)
    canvas.save(OUT / f'{name}.png', optimize=True)
    print(f'{name}.png {canvas.size}')


if __name__ == '__main__':
    for name, items in GROUPS.items():
        build(name, items)
