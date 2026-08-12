#!/usr/bin/env python3
import json
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

# Story ownership: the intermediate branch scene owns the ending.
chapter10 = json.loads(CH10.read_text(encoding='utf-8'))
scene_by_id = {scene['id']: scene for scene in chapter10['scenes']}
final_choice_scene = scene_by_id[5]
for choice in final_choice_scene['choices']:
    choice.pop('leadsToEnding', None)
for scene_id, ending_id in ENDING_BY_SCENE.items():
    scene_by_id[scene_id]['leadsToEnding'] = ending_id
CH10.write_text(json.dumps(chapter10, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')

# Requirements are retained only as historical design material, never as an executable gate.
finals = json.loads(FINALS.read_text(encoding='utf-8'))
normalized_endings = []
for ending in finals['endings']:
    rewritten = {}
    for key, value in ending.items():
        if key == 'requirements':
            rewritten['legacyRequirements'] = value
        else:
            rewritten[key] = value
    normalized_endings.append(rewritten)
finals['endings'] = normalized_endings
FINALS.write_text(json.dumps(finals, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')

html = HTML.read_text(encoding='utf-8')

# pendingEndingId is no longer a source of truth.
html = html.replace(
    "        const pendingEnding = window.pendingEndingId ? resolveEndingId(window.pendingEndingId) : null;\n",
    ""
)
html = html.replace(
    "        // A selected final route may currently live in pendingEndingId until Stage 0F\n"
    "        // moves ending ownership into validated/persisted story state.\n"
    "        if (pendingEnding && (!hasNextScene || scene.nextScene === null)) {\n"
    "            return { type: 'ending', endingId: pendingEnding, reason: 'pending-ending' };\n"
    "        }\n\n",
    ""
)
html = html.replace(
    "                window.pendingEndingId = null;\n"
    "                await saveSession();\n"
    "                await loadFinals(endingId);\n"
    "                return true;",
    "                await saveSession();\n"
    "                return await loadFinals(endingId);"
)
html = html.replace(
    "            if (choice.leadsToEnding) {\n"
    "                window.pendingEndingId = resolveEndingId(choice.leadsToEnding);\n"
    "            } else {\n"
    "                window.pendingEndingId = null;\n"
    "            }\n\n",
    ""
)

# Remove the duplicate ending-id normalizer and the obsolete requirements gate.
# loadFinals now resolves one authoritative ending id, fails closed on load/missing data,
# and never dumps a valid selected route to the start screen because of legacy stats.
finals_runtime = re.compile(
    r"\n\s*function normalizeEndingId\(endingId\)\s*\{.*?\n\s*function showEnding\(ending\)\s*\{",
    re.S,
)
replacement = r'''

        async function loadFinals(endingId) {
            const normalizedEndingId = resolveEndingId(endingId);

            try {
                const response = await fetch('assets/data/finals.json');
                if (!response.ok) {
                    throw new Error(`Finals HTTP ${response.status}`);
                }

                const finalsData = await response.json();
                const ending = Array.isArray(finalsData?.endings)
                    ? finalsData.endings.find(candidate => candidate.id === normalizedEndingId)
                    : null;

                if (!ending) {
                    console.error(`[loadFinals] Ending not found: ${normalizedEndingId}`);
                    showErrorMessage(
                        stats.language === "ru"
                            ? `Финал ${normalizedEndingId} не найден`
                            : `Ending ${normalizedEndingId} not found`
                    );
                    return false;
                }

                showEnding(ending);
                return true;
            } catch (error) {
                console.error('[loadFinals] Не удалось загрузить финал:', error);
                showErrorMessage(
                    stats.language === "ru"
                        ? 'Не удалось загрузить финал. Попробуйте ещё раз.'
                        : 'Failed to load ending. Please try again.'
                );
                return false;
            }
        }

        function showEnding(ending) {'''
html, count = finals_runtime.subn(replacement, html, count=1)
if count != 1:
    raise SystemExit(f'Expected one legacy finals runtime block, replaced {count}')

if 'pendingEndingId' in html:
    raise SystemExit('pendingEndingId still present after Stage 0F migration')
if 'checkRequirements(' in html:
    raise SystemExit('checkRequirements still present after Stage 0F migration')
if 'normalizeEndingId(' in html:
    raise SystemExit('duplicate normalizeEndingId still present after Stage 0F migration')

HTML.write_text(html, encoding='utf-8')
print('Stage 0F applied')
