#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'heart_at_crossroads.html'
CH10 = ROOT / 'assets/data/chapter10.json'
FINALS = ROOT / 'assets/data/finals.json'

ENDING_BY_SCENE = {
    6: 'freedom_with_dima',
    7: 'silence_with_mark',
    8: 'summit_with_sergey',
    9: 'friendship_above_all',
    10: 'lonely_path',
    11: 'new_start',
}
ENDING_TITLES = [
    'Свобода с Димой',
    'Тишина с Марком',
    'Вершина с Сергеем',
    'Дружба превыше всего',
    'Одинокий путь',
    'Новый старт',
]


def read_preserving_newlines(path: Path):
    text = path.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in text else '\n'
    return text, newline


def write_preserving_newlines(path: Path, text: str):
    path.write_bytes(text.encode('utf-8'))


# chapter10: final choice owns only the branch scene; terminal branch scene owns the ending.
chapter10, ch_nl = read_preserving_newlines(CH10)
for title in ENDING_TITLES:
    pattern = re.compile(
        r'(?m)^([ \t]*)\},\r?\n\1"leadsToEnding": "' + re.escape(title) + r'"$'
    )
    chapter10, count = pattern.subn(r'\1}', chapter10, count=1)
    if count != 1:
        raise SystemExit(f'Expected one final-choice ending field for {title}, found {count}')

for scene_id, ending_id in ENDING_BY_SCENE.items():
    pattern = re.compile(
        rf'("id": {scene_id},.*?"nextScene": null)(\r?\n)([ \t]*)\}}',
        re.S,
    )

    def add_owner(match, ending_id=ending_id):
        newline = match.group(2)
        closing_indent = match.group(3)
        property_indent = closing_indent + '    '
        return (
            match.group(1) + ',' + newline
            + property_indent + f'"leadsToEnding": "{ending_id}"' + newline
            + closing_indent + '}'
        )

    chapter10, count = pattern.subn(add_owner, chapter10, count=1)
    if count != 1:
        raise SystemExit(f'Expected one terminal scene {scene_id}, found {count}')

write_preserving_newlines(CH10, chapter10)

# finals: preserve old balancing ideas as explicitly non-executable metadata.
finals, finals_nl = read_preserving_newlines(FINALS)
requirements_count = finals.count('"requirements": {')
if requirements_count != 6:
    raise SystemExit(f'Expected 6 legacy requirements blocks, found {requirements_count}')
finals = finals.replace('"requirements": {', '"legacyRequirements": {')
write_preserving_newlines(FINALS, finals)

# Runtime: remove transient ending ownership and old stats gate.
html, html_nl = read_preserving_newlines(HTML)
nl = html_nl

old = f"        const pendingEnding = window.pendingEndingId ? resolveEndingId(window.pendingEndingId) : null;{nl}"
if old not in html:
    raise SystemExit('pendingEnding declaration not found')
html = html.replace(old, '', 1)

old = (
    f"        // A selected final route may currently live in pendingEndingId until Stage 0F{nl}"
    f"        // moves ending ownership into validated/persisted story state.{nl}"
    f"        if (pendingEnding && (!hasNextScene || scene.nextScene === null)) {{{nl}"
    f"            return {{ type: 'ending', endingId: pendingEnding, reason: 'pending-ending' }};{nl}"
    f"        }}{nl}{nl}"
)
if old not in html:
    raise SystemExit('pendingEnding fallback block not found')
html = html.replace(old, '', 1)

old = (
    f"                window.pendingEndingId = null;{nl}"
    f"                await saveSession();{nl}"
    f"                await loadFinals(endingId);{nl}"
    f"                return true;"
)
new = (
    f"                await saveSession();{nl}"
    f"                return await loadFinals(endingId);"
)
if old not in html:
    raise SystemExit('ending transition block not found')
html = html.replace(old, new, 1)

old = (
    f"            if (choice.leadsToEnding) {{{nl}"
    f"                window.pendingEndingId = resolveEndingId(choice.leadsToEnding);{nl}"
    f"            }} else {{{nl}"
    f"                window.pendingEndingId = null;{nl}"
    f"            }}{nl}{nl}"
)
if old not in html:
    raise SystemExit('applyChoice pending ending block not found')
html = html.replace(old, '', 1)

runtime_pattern = re.compile(
    r'(?:\r?\n)[ \t]*function normalizeEndingId\(endingId\)[ \t]*\{.*?'
    r'(?:\r?\n)[ \t]*function showEnding\(ending\)[ \t]*\{',
    re.S,
)
load_finals_lines = [
    '',
    '        async function loadFinals(endingId) {',
    '            const normalizedEndingId = resolveEndingId(endingId);',
    '',
    '            try {',
    "                const response = await fetch('assets/data/finals.json');",
    '                if (!response.ok) {',
    '                    throw new Error(`Finals HTTP ${response.status}`);',
    '                }',
    '',
    '                const finalsData = await response.json();',
    '                const ending = Array.isArray(finalsData?.endings)',
    '                    ? finalsData.endings.find(candidate => candidate.id === normalizedEndingId)',
    '                    : null;',
    '',
    '                if (!ending) {',
    '                    console.error(`[loadFinals] Ending not found: ${normalizedEndingId}`);',
    '                    showErrorMessage(',
    '                        stats.language === "ru"',
    '                            ? `Финал ${normalizedEndingId} не найден`',
    '                            : `Ending ${normalizedEndingId} not found`',
    '                    );',
    '                    return false;',
    '                }',
    '',
    '                showEnding(ending);',
    '                return true;',
    '            } catch (error) {',
    "                console.error('[loadFinals] Не удалось загрузить финал:', error);",
    '                showErrorMessage(',
    '                    stats.language === "ru"',
    "                        ? 'Не удалось загрузить финал. Попробуйте ещё раз.'",
    "                        : 'Failed to load ending. Please try again.'",
    '                );',
    '                return false;',
    '            }',
    '        }',
    '',
    '        function showEnding(ending) {',
]
replacement = nl.join(load_finals_lines)
html, count = runtime_pattern.subn(lambda _m: replacement, html, count=1)
if count != 1:
    raise SystemExit(f'Expected one legacy finals runtime block, replaced {count}')

if 'pendingEndingId' in html:
    raise SystemExit('pendingEndingId still present after migration')
if 'checkRequirements(' in html:
    raise SystemExit('checkRequirements still present after migration')
if 'normalizeEndingId(' in html:
    raise SystemExit('normalizeEndingId still present after migration')

write_preserving_newlines(HTML, html)
print('Stage 0F applied with original line endings preserved')
