#!/usr/bin/env python3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'heart_at_crossroads.html'
base = subprocess.check_output(['git', 'show', 'origin/main:heart_at_crossroads.html'])
needle = b'<script src="assets/js/stage0i-runtime.js"></script>'
insert = needle + b'\r\n<script src="assets/js/stage0j-runtime.js"></script>'
if base.count(needle) != 1:
    raise SystemExit(f'expected one stage0i script tag in main, found {base.count(needle)}')
path.write_bytes(base.replace(needle, insert, 1))
print('restored main HTML bytes and inserted Stage 0J script tag')
