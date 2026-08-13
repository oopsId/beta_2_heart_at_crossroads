#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "heart_at_crossroads.html"

EXPECTED_CSS = [
    "assets/css/game.css",
    "assets/css/hud.css",
    "assets/css/phone.css",
]
EXPECTED_JS = [
    "assets/js/core/foundation.js",
    "assets/js/core/story-runtime.js",
    "assets/js/core/endings-presentation.js",
    "assets/js/runtime/vn-behavior.js",
    "assets/js/render/scene-renderer.js",
    "assets/js/runtime/replay-progression.js",
    "assets/js/ui/gallery.js",
    "assets/js/ui/gallery-polish.js",
    "assets/js/progression/diamonds.js",
]
OBSOLETE_FILES = [
    "assets/js/core-runtime.js",
    "assets/js/core/gallery-legacy.js",
    "assets/js/stage0k-runtime.js",
    "assets/js/stage0i-runtime.js",
    "assets/js/stage0j-runtime.js",
    "assets/js/stage0k-runtime-base.js",
    "assets/js/stage0n-gallery.js",
    "assets/js/stage0p-gallery-polish.js",
    "assets/js/stage0o-runtime.js",
    "assets/hud-hotfix.css",
    "assets/phone-compact.css",
    ".github/workflows/refactor-branch-helper.yml",
]

errors = []

def fail(message: str) -> None:
    errors.append(message)

try:
    html = HTML_PATH.read_text(encoding="utf-8")
except Exception as exc:
    print(f"ARCHITECTURE FAIL: cannot read heart_at_crossroads.html: {exc}", file=sys.stderr)
    raise SystemExit(1)

if re.search(r"<style\b", html, re.I):
    fail("inline <style> block returned; CSS must stay external")

for match in re.finditer(r"<script\b([^>]*)>(.*?)</script>", html, re.I | re.S):
    attrs = match.group(1)
    if not re.search(r"\bsrc\s*=", attrs, re.I):
        fail("inline <script> block returned; runtime JS must stay external")

css_refs = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']', html, re.I)
local_css = [ref for ref in css_refs if ref.startswith("assets/")]
if local_css != EXPECTED_CSS:
    fail(f"local stylesheet order changed: expected {EXPECTED_CSS}, got {local_css}")

js_refs = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, re.I)
local_js = [ref for ref in js_refs if ref.startswith("assets/js/")]
if local_js != EXPECTED_JS:
    fail(f"local runtime order changed: expected {EXPECTED_JS}, got {local_js}")

for ref in EXPECTED_CSS + EXPECTED_JS:
    path = ROOT / ref
    if not path.is_file():
        fail(f"required external file missing: {ref}")

for ref in OBSOLETE_FILES:
    if (ROOT / ref).exists():
        fail(f"obsolete refactor/bootstrap artifact returned: {ref}")

for ref in EXPECTED_JS:
    path = ROOT / ref
    if not path.is_file():
        continue
    source = path.read_text(encoding="utf-8")
    if "document.write(" in source:
        fail(f"dynamic document.write bootstrap returned in {ref}")

for ref in EXPECTED_JS[:3]:
    path = ROOT / ref
    if path.is_file() and path.stat().st_size > 60_000:
        fail(f"core module grew beyond 60 KB monolith guard: {ref} ({path.stat().st_size} bytes)")

stage1_helpers = sorted((ROOT / "tools").glob("stage1*_*.py"))
if stage1_helpers:
    fail("temporary Stage 1 helper scripts remain: " + ", ".join(str(p.relative_to(ROOT)) for p in stage1_helpers))

if errors:
    print("ARCHITECTURE VALIDATION: FAIL", file=sys.stderr)
    for item in errors:
        print(f"- {item}", file=sys.stderr)
    raise SystemExit(1)

print("ARCHITECTURE VALIDATION: PASS")
print(f"CSS: {len(EXPECTED_CSS)} external stylesheets")
print(f"JS: {len(EXPECTED_JS)} ordered local runtime scripts")
print("Inline style/script blocks: 0")
print("Temporary refactor helpers: 0")
