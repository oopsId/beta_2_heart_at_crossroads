from pathlib import Path
import re

root = Path('.')
source_path = root / 'assets/js/core-runtime.js'
html_path = root / 'heart_at_crossroads.html'
validator_path = root / 'tools/validate_game.py'
source = source_path.read_text(encoding='utf-8')

markers = [
    '        async function startGame(generation = runtimeGeneration) {',
    '        function showPremiumGallery() {',
    '        async function loadFinals(endingId, generation = runtimeGeneration) {'
]
pos = [source.index(marker) for marker in markers]
if pos != sorted(pos) or len(set(pos)) != 3:
    raise SystemExit('core split markers are missing or out of order')

chunks = [source[:pos[0]], source[pos[0]:pos[1]], source[pos[1]:pos[2]], source[pos[2]:]]
names = [
    'assets/js/core/foundation.js',
    'assets/js/core/story-runtime.js',
    'assets/js/core/gallery-legacy.js',
    'assets/js/core/endings-presentation.js'
]
for name, chunk in zip(names, chunks):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(chunk, encoding='utf-8', newline='')
if ''.join((root / name).read_text(encoding='utf-8') for name in names) != source:
    raise SystemExit('split files do not concatenate to the original core runtime')

html = html_path.read_text(encoding='utf-8')
old_include = '<script src="assets/js/core-runtime.js"></script>'
new_includes = '\n'.join(f'<script src="{name}"></script>' for name in names)
if html.count(old_include) != 1:
    raise SystemExit('expected exactly one core-runtime include')
html_path.write_text(html.replace(old_include, new_includes, 1), encoding='utf-8', newline='')

validator = validator_path.read_text(encoding='utf-8')
pattern = re.compile(
    r'    core_path = ROOT / "assets" / "js" / "core-runtime\.js"\n'
    r'.*?'
    r'    runtime_source = html \+ "\\n" \+ core_runtime\n\n',
    re.S,
)
replacement = '''    script_refs = re.findall(r'<script[^>]+src=["\\\'](assets/js/[^"\\\']+\\.js)["\\\']', html, re.I)
    if not script_refs:
        error("RUNTIME_INVARIANT", "heart_at_crossroads.html", "no local runtime scripts are included")
    runtime_parts = [html]
    for ref in script_refs:
        path = ROOT / ref
        try:
            runtime_parts.append(path.read_text(encoding="utf-8"))
        except Exception as exc:
            error("RUNTIME_READ", ref, str(exc))
    runtime_source = "\\n".join(runtime_parts)

'''
validator, count = pattern.subn(lambda _: replacement, validator, count=1)
if count != 1:
    raise SystemExit('Stage 1B validator block not found')
validator_path.write_text(validator, encoding='utf-8', newline='')

source_path.unlink()
print({name: len(chunk.encode('utf-8')) for name, chunk in zip(names, chunks)})
