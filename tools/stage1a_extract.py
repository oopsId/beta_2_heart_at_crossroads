from pathlib import Path
import re

html_path = Path('heart_at_crossroads.html')
css_path = Path('assets/css/game.css')
raw = html_path.read_bytes()
text = raw.decode('utf-8')

start = text.find('<style>')
if start < 0:
    raise SystemExit('inline <style> not found')
end = text.find('</style>', start)
if end < 0:
    raise SystemExit('inline </style> not found')
if text.find('<style>', start + 1) != -1:
    raise SystemExit('more than one inline <style> block found')

css = text[start + len('<style>'):end]
# CSS url() is resolved relative to the external stylesheet, so preserve the
# original page-relative asset targets when moving the stylesheet to assets/css.
css = re.sub(r"url\((['\"]?)assets/", r"url(\1../", css)

css_path.parent.mkdir(parents=True, exist_ok=True)
css_path.write_text(css, encoding='utf-8', newline='')

replacement = '<link rel="stylesheet" href="assets/css/game.css">'
updated = text[:start] + replacement + text[end + len('</style>'):]
html_path.write_bytes(updated.encode('utf-8'))

if '<style>' in updated or '</style>' in updated:
    raise SystemExit('inline style tag remained after extraction')
if updated.count('assets/css/game.css') != 1:
    raise SystemExit('stylesheet link count is not exactly one')
if "url('assets/" in css or 'url("assets/' in css or 'url(assets/' in css:
    raise SystemExit('page-relative CSS asset URL remained after extraction')
print(f'extracted {len(css.encode("utf-8"))} CSS bytes to {css_path}')
