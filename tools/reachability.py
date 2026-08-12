#!/usr/bin/env python3
import json
from collections import deque, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'data'

BASE_STATS = ('crown', 'heart', 'leaf', 'diamonds')
INITIAL = {'crown': 0, 'heart': 0, 'leaf': 0, 'diamonds': 10}
MAX_STATES = 500000


def load_chapters():
    return {i: json.loads((DATA / f'chapter{i}.json').read_text(encoding='utf-8')) for i in range(1, 11)}


def effect_relationship_keys(chapters):
    keys = set()
    for chapter in chapters.values():
        for scene in chapter.get('scenes', []):
            candidates = list(scene.get('choices') or [])
            timeout = scene.get('timeout') or {}
            if isinstance(timeout, dict) and isinstance(timeout.get('outcome'), dict):
                candidates.append(timeout['outcome'])
            for choice in candidates:
                effects = choice.get('effects') or {}
                rels = effects.get('relationships')
                if isinstance(rels, dict):
                    keys.update(rels)
                for key in effects:
                    if key.startswith('relationships.'):
                        keys.add(key.split('.', 1)[1])
    return tuple(sorted(keys))


def parse_condition(condition, stats, rels):
    if not condition:
        return True
    # Current story has no choice-history conditions. Unknown structured conditions are
    # intentionally rejected so this analyzer cannot silently overestimate reachability.
    if isinstance(condition, dict):
        raise ValueError(f'Unsupported structured story condition: {condition}')
    parts = str(condition).split()
    if len(parts) != 3:
        raise ValueError(f'Unsupported story condition: {condition}')
    key, op, raw = parts
    if key.startswith('relationships.'):
        left = rels.get(key.split('.', 1)[1], 0)
    elif key in rels:
        left = rels.get(key, 0)
    else:
        left = stats.get(key, 0)
    right = int(raw)
    return {
        '>': left > right,
        '<': left < right,
        '>=': left >= right,
        '<=': left <= right,
        '==': left == right,
        '!=': left != right,
    }[op]


def apply_effects(stats, rels, effects):
    stats = dict(stats)
    rels = dict(rels)
    for key, delta in (effects or {}).items():
        if key == 'relationships' and isinstance(delta, dict):
            for rel, amount in delta.items():
                rels[rel] = rels.get(rel, 0) + amount
        elif key.startswith('relationships.'):
            rel = key.split('.', 1)[1]
            rels[rel] = rels.get(rel, 0) + delta
        elif key in stats and isinstance(delta, (int, float)):
            stats[key] += delta
    return stats, rels


def scene_map(chapter):
    return {s['id']: s for s in chapter.get('scenes', [])}


def next_for_scene(chapters, chapter_id, scene):
    if isinstance(scene.get('nextScene'), int):
        return chapter_id, scene['nextScene']
    if isinstance(scene.get('nextChapter'), int):
        return scene['nextChapter'], 0
    if scene.get('nextChapter') is True:
        return chapter_id + 1, 0
    if scene.get('leadsToEnding'):
        return None
    if 'nextScene' in scene and scene.get('nextScene') is None:
        return (chapter_id + 1, 0) if chapter_id < 10 else None
    scenes = chapters[chapter_id].get('scenes', [])
    if scenes and scenes[-1]['id'] == scene['id']:
        return (chapter_id + 1, 0) if chapter_id < 10 else None
    ids = {s['id'] for s in scenes}
    if scene['id'] + 1 in ids:
        return chapter_id, scene['id'] + 1
    return None


def next_for_choice(chapter_id, choice):
    if isinstance(choice.get('nextScene'), int):
        return chapter_id, choice['nextScene']
    if isinstance(choice.get('nextChapter'), int):
        return choice['nextChapter'], 0
    if choice.get('nextChapter') is True:
        return chapter_id + 1, 0
    if choice.get('leadsToEnding'):
        return None
    if 'nextScene' in choice and choice.get('nextScene') is None:
        return (chapter_id + 1, 0) if chapter_id < 10 else None
    return None


def freeze(chapter, scene, stats, rels, rel_keys):
    return (
        chapter, scene,
        *(int(stats.get(k, 0)) for k in BASE_STATS),
        *(int(rels.get(k, 0)) for k in rel_keys),
    )


def thaw(key, rel_keys):
    chapter, scene = key[0], key[1]
    offset = 2
    stats = dict(zip(BASE_STATS, key[offset:offset + len(BASE_STATS)]))
    offset += len(BASE_STATS)
    rels = dict(zip(rel_keys, key[offset:offset + len(rel_keys)]))
    return chapter, scene, stats, rels


def main():
    chapters = load_chapters()
    rel_keys = effect_relationship_keys(chapters)
    initial = freeze(1, 0, INITIAL, {}, rel_keys)
    q = deque([initial])
    seen = {initial}
    final_states = []
    terminal = defaultdict(int)

    while q:
        if len(seen) > MAX_STATES:
            raise SystemExit(f'reachability explosion: > {MAX_STATES} states')
        key = q.popleft()
        chapter_id, scene_id, stats, rels = thaw(key, rel_keys)
        if chapter_id not in chapters:
            terminal['past-last-chapter'] += 1
            continue
        scene = scene_map(chapters[chapter_id]).get(scene_id)
        if not scene:
            terminal[f'missing-scene-{chapter_id}:{scene_id}'] += 1
            continue

        if chapter_id == 10 and scene_id == 5:
            final_states.append((stats, rels))
            continue

        choices = list(scene.get('choices') or [])
        alternatives = []
        for choice in choices:
            if not parse_condition(choice.get('condition'), stats, rels):
                continue
            cost = int(choice.get('cost') or 0)
            if stats.get('diamonds', 0) < cost:
                continue
            alternatives.append(choice)

        timeout = scene.get('timeout')
        if isinstance(timeout, dict) and not timeout.get('choiceId') and isinstance(timeout.get('outcome'), dict):
            alternatives.append(timeout['outcome'])

        if alternatives:
            for choice in alternatives:
                new_stats = dict(stats)
                new_rels = dict(rels)
                cost = int(choice.get('cost') or 0)
                new_stats['diamonds'] = new_stats.get('diamonds', 0) - cost
                new_stats, new_rels = apply_effects(new_stats, new_rels, choice.get('effects'))
                target = next_for_choice(chapter_id, choice)
                if not target:
                    terminal['choice-terminal'] += 1
                    continue
                new_key = freeze(target[0], target[1], new_stats, new_rels, rel_keys)
                if new_key not in seen:
                    seen.add(new_key)
                    q.append(new_key)
            continue

        target = next_for_scene(chapters, chapter_id, scene)
        if not target:
            terminal['scene-terminal'] += 1
            continue
        new_key = freeze(target[0], target[1], stats, rels, rel_keys)
        if new_key not in seen:
            seen.add(new_key)
            q.append(new_key)

    def values(getter):
        vals = [getter(s, r) for s, r in final_states]
        return {'min': min(vals), 'max': max(vals), 'values': sorted(set(vals))} if vals else None

    summary = {
        'visitedStateCount': len(seen),
        'finalDecisionStateCount': len(final_states),
        'relationshipKeys': list(rel_keys),
        'stats': {k: values(lambda s, r, k=k: s.get(k, 0)) for k in BASE_STATS},
        'relationships': {k: values(lambda s, r, k=k: r.get(k, 0)) for k in rel_keys},
        'terminalCounts': dict(terminal),
        'finalStates': [
            {'stats': s, 'relationships': r}
            for s, r in final_states
        ],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
