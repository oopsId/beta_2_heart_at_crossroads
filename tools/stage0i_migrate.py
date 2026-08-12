#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'data'
HTML = ROOT / 'heart_at_crossroads.html'

REQUIREMENTS = {
    'freedom_with_dima': {
        'all': [
            {'stat': 'heart', 'op': '>=', 'value': 15},
            {'relationship': 'dima', 'op': '>=', 'value': 2},
        ]
    },
    'silence_with_mark': {
        'all': [
            {'stat': 'heart', 'op': '>=', 'value': 15},
            {'stat': 'leaf', 'op': '>=', 'value': 10},
            {'relationship': 'mark', 'op': '>=', 'value': 4},
        ]
    },
    'summit_with_sergey': {
        'all': [
            {'stat': 'crown', 'op': '>=', 'value': 6},
            {'relationship': 'sergey', 'op': '>=', 'value': 3},
        ]
    },
    'friendship_above_all': {
        'all': [
            {'stat': 'leaf', 'op': '>=', 'value': 15},
            {'relationship': 'vika', 'op': '>=', 'value': 1},
        ]
    },
    'lonely_path': {
        'all': [
            {'stat': 'crown', 'op': '>=', 'value': 5},
            {'compare': {'left': {'sum': [{'stat': 'crown'}, 2]}, 'op': '>=', 'right': {'stat': 'heart'}}},
            {'compare': {'left': {'sum': [{'stat': 'crown'}, 2]}, 'op': '>=', 'right': {'stat': 'leaf'}}},
        ]
    },
    'new_start': {
        'all': [
            {'stat': 'crown', 'op': '>=', 'value': 5},
            {'stat': 'heart', 'op': '>=', 'value': 5},
            {'stat': 'leaf', 'op': '>=', 'value': 5},
            {'compare': {
                'left': {'subtract': [
                    {'max': [{'stat': 'crown'}, {'stat': 'heart'}, {'stat': 'leaf'}]},
                    {'min': [{'stat': 'crown'}, {'stat': 'heart'}, {'stat': 'leaf'}]},
                ]},
                'op': '<=',
                'right': 5,
            }},
        ]
    },
}

FINAL_CHOICE_MAP = {
    'dima': 'freedom_with_dima',
    'mark': 'silence_with_mark',
    'sergey': 'summit_with_sergey',
    'vika': 'friendship_above_all',
    'alone': 'lonely_path',
    'premium': 'new_start',
}


def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')


def migrate_finals():
    path = DATA / 'finals.json'
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    seen = set()
    for ending in data.get('endings', []):
        eid = ending.get('id')
        if eid in REQUIREMENTS:
            ending['requirements'] = REQUIREMENTS[eid]
            seen.add(eid)
    missing = set(REQUIREMENTS) - seen
    if missing:
        raise RuntimeError(f'missing endings for requirements: {sorted(missing)}')
    dump(path, data)


def migrate_chapters():
    moved_memory_tags = 0
    timed_scenes = 0
    for chapter_id in range(1, 11):
        path = DATA / f'chapter{chapter_id}.json'
        data = json.loads(path.read_text(encoding='utf-8-sig'))
        for scene in data.get('scenes', []):
            if isinstance(scene.get('timeout'), dict):
                scene['phoneMode'] = 'messenger'
                timed_scenes += 1

            for choice in scene.get('choices') or []:
                effects = choice.get('effects')
                if isinstance(effects, dict) and 'memoryTag' in effects:
                    nested = effects.pop('memoryTag')
                    existing = choice.get('memoryTag')
                    if existing is not None and existing != nested:
                        raise RuntimeError(f'conflicting memoryTag in chapter {chapter_id} scene {scene.get("id")} choice {choice.get("id")}')
                    choice['memoryTag'] = nested
                    moved_memory_tags += 1

        if chapter_id == 10:
            scene5 = next((scene for scene in data.get('scenes', []) if scene.get('id') == 5), None)
            if not scene5:
                raise RuntimeError('chapter10 scene5 missing')
            found = set()
            for choice in scene5.get('choices') or []:
                if choice.get('id') in FINAL_CHOICE_MAP:
                    choice['endingId'] = FINAL_CHOICE_MAP[choice['id']]
                    found.add(choice['id'])
                    if choice['id'] == 'premium':
                        # The authored 20-diamond price is unreachable: the exact graph reaches
                        # the final choice with at most 10 diamonds. Eligibility is the final gate.
                        choice.pop('cost', None)
                        for lang in ('ru', 'en'):
                            text = choice.get('text', {}).get(lang)
                            if isinstance(text, str):
                                choice['text'][lang] = text.replace(' (20 бриллиантов)', '').replace(' (20 diamonds)', '')
            missing = set(FINAL_CHOICE_MAP) - found
            if missing:
                raise RuntimeError(f'chapter10 final choices missing: {sorted(missing)}')
        dump(path, data)

    if timed_scenes != 6:
        raise RuntimeError(f'expected 6 timed scenes, found {timed_scenes}')
    if moved_memory_tags != 6:
        raise RuntimeError(f'expected to move 6 nested memoryTags, moved {moved_memory_tags}')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one occurrence, found {count}')
    return text.replace(old, new, 1)


def migrate_html():
    raw = HTML.read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in raw else '\n'

    raw = replace_once(
        raw,
        'relationships: { mark: 0, lera: 0, vika: 0, sergey: 0, anna: 0, dima: 0, lesha: 0 }',
        'relationships: { mark: 0, lera: 0, vika: 0, sergey: 0, anna: 0, dima: 0, lyosha: 0 }',
        'fresh relationship schema',
    )
    raw = raw.replace('stats.relationships.lesha', 'stats.relationships.lyosha')

    merge_marker = (
        '                stats.relationships = {' + nl +
        '                    ...stats.relationships,' + nl +
        "                    ...(runStats.relationships && typeof runStats.relationships === 'object' ? runStats.relationships : {})" + nl +
        '                };'
    )
    merge_replacement = merge_marker + nl + (
        '                // Stage 0I: migrate pre-0I beta saves that could contain both lesha and lyosha.' + nl +
        '                const legacyLesha = Number(stats.relationships.lesha) || 0;' + nl +
        '                stats.relationships.lyosha = (Number(stats.relationships.lyosha) || 0) + legacyLesha;' + nl +
        '                delete stats.relationships.lesha;'
    )
    raw = replace_once(raw, merge_marker, merge_replacement, 'legacy relationship migration')

    raw = replace_once(
        raw,
        '    if (sceneId === 7) {',
        '    if (currentChapter === 1 && sceneId === 7) {',
        'lyosha messenger special case',
    )
    raw = replace_once(
        raw,
        '    } else if (sceneId === 21) {',
        '    } else if (currentChapter === 1 && sceneId === 21) {',
        'mark messenger special case',
    )
    raw = replace_once(
        raw,
        '        const overlay = scene.phone === 1 ? showMessengerOverlay(scene.id, generation) : null;',
        "        const overlay = (scene.phoneMode === 'messenger' || scene.phone === 1) ? showMessengerOverlay(scene.id, generation) : null;",
        'timed messenger routing',
    )

    preload_anchor = "                'assets/characters/vika/vika_worry_style1.png'"
    if 'assets/characters/dima/dima_confident_style1.png' not in raw:
        insertion = (
            "                'assets/characters/dima/dima_confident_style1.png'," + nl +
            "                'assets/characters/mark/mark_blush_style1.png'," + nl +
            "                'assets/characters/mark/mark_concerned_style1.png'," + nl +
            "                'assets/characters/sergey/sergey_confident_style1.png'," + nl
        )
        pos = raw.find(preload_anchor)
        if pos < 0:
            raise RuntimeError('preload anchor missing')
        raw = raw[:pos] + insertion + raw[pos:]

    tag = '<script src="assets/js/stage0i-runtime.js"></script>'
    if tag not in raw:
        raw = replace_once(raw, '</body>', f'    {tag}{nl}</body>', 'Stage 0I script tag')

    HTML.write_bytes(raw.encode('utf-8'))


def main():
    migrate_finals()
    migrate_chapters()
    migrate_html()
    print('Stage 0I migration completed')


if __name__ == '__main__':
    main()
