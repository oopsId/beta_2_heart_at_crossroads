#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]

chapter = root / 'assets' / 'data' / 'chapter10.json'
raw = chapter.read_bytes()
pattern = re.compile(rb'(?m)^([ \t]*)"nextScene": null,\r?\n([ \t]*)"leadsToEnding":')
raw, count = pattern.subn(rb'\2"leadsToEnding":', raw)
if count != 6:
    raise SystemExit(f'expected 6 redundant chapter10 nextScene:null lines, found {count}')
chapter.write_bytes(raw)

html = root / 'heart_at_crossroads.html'
raw = html.read_bytes()
old = b'assets/images/shoebox_texture.png'
new = b'assets/backgrounds/shoebox_texture.png'
count = raw.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one old shoebox path, found {count}')
html.write_bytes(raw.replace(old, new, 1))

print('Stage 0H cleanup applied: 6 redundant final null routes removed; shoebox path repaired')
