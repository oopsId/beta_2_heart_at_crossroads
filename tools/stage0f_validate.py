#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'heart_at_crossroads.html').read_text(encoding='utf-8')
chapter10 = json.loads((ROOT / 'assets/data/chapter10.json').read_text(encoding='utf-8'))
finals = json.loads((ROOT / 'assets/data/finals.json').read_text(encoding='utf-8'))

expected = {
    6: 'freedom_with_dima',
    7: 'silence_with_mark',
    8: 'summit_with_sergey',
    9: 'friendship_above_all',
    10: 'lonely_path',
    11: 'new_start',
}
choice_routes = {
    'dima': 6,
    'mark': 7,
    'sergey': 8,
    'vika': 9,
    'alone': 10,
    'premium': 11,
}

scenes = {scene['id']: scene for scene in chapter10['scenes']}
assert set(expected).issubset(scenes), 'Chapter 10 terminal scenes missing'
for scene_id, ending_id in expected.items():
    scene = scenes[scene_id]
    assert scene.get('leadsToEnding') == ending_id, f'Scene {scene_id} wrong ending owner'
    assert scene.get('nextScene') is None, f'Scene {scene_id} must remain terminal'

choices = {choice['id']: choice for choice in scenes[5]['choices']}
assert set(choices) == set(choice_routes), f'Unexpected final choice set: {set(choices)}'
for choice_id, scene_id in choice_routes.items():
    choice = choices[choice_id]
    assert choice.get('nextScene') == scene_id, f'Choice {choice_id} wrong intermediate scene'
    assert 'leadsToEnding' not in choice, f'Choice {choice_id} still owns ending'

ending_ids = {ending['id'] for ending in finals['endings']}
assert ending_ids == set(expected.values()), f'Unexpected finals ids: {ending_ids}'
for ending in finals['endings']:
    assert 'requirements' not in ending, f"Executable requirements remain on {ending['id']}"
    assert 'legacyRequirements' in ending, f"Legacy requirements missing on {ending['id']}"

lonely = next(ending for ending in finals['endings'] if ending['id'] == 'lonely_path')
assert lonely['legacyRequirements'].get('crown') == '> heart + leaf', 'Lonely legacy design note was not preserved'

assert 'pendingEndingId' not in html, 'Transient pendingEndingId still exists'
assert 'checkRequirements(' not in html, 'Legacy requirements gate still exists'
assert 'normalizeEndingId(' not in html, 'Duplicate ending normalizer still exists'
assert "return await loadFinals(endingId);" in html, 'Ending transition does not propagate loadFinals result'
assert "if (!response.ok)" in html, 'Finals HTTP failure is not handled'
assert "showStartScreen();" not in html[html.index('async function loadFinals'):html.index('function showEnding')], 'loadFinals still dumps failures to start screen'

print('Stage 0F validator PASS')
print('Terminal ownership:', expected)
print('Legacy requirements retained:', len(finals['endings']))
