#!/usr/bin/env python3
import json
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'data'
CORE_STATS = ('crown', 'heart', 'leaf', 'diamonds')
CORE_RELS = ('dima', 'mark', 'sergey', 'vika')
INITIAL = {'crown': 0, 'heart': 0, 'leaf': 0, 'diamonds': 10}
MAX_STATES = 750000


def load_chapters():
    return {i: json.loads((DATA / f'chapter{i}.json').read_text(encoding='utf-8')) for i in range(1, 11)}


def all_relationship_keys(chapters):
    keys = set()
    for chapter in chapters.values():
        for scene in chapter.get('scenes', []):
            items = list(scene.get('choices') or [])
            timeout = scene.get('timeout') or {}
            if isinstance(timeout, dict) and isinstance(timeout.get('outcome'), dict):
                items.append(timeout['outcome'])
            for item in items:
                effects = item.get('effects') or {}
                nested = effects.get('relationships')
                if isinstance(nested, dict):
                    keys.update(nested)
                for key in effects:
                    if key.startswith('relationships.'):
                        keys.add(key.split('.', 1)[1])
    return tuple(sorted(keys))


def assert_no_story_conditions(chapters):
    found = []
    for cid, chapter in chapters.items():
        for scene in chapter.get('scenes', []):
            for choice in scene.get('choices') or []:
                if choice.get('condition'):
                    found.append((cid, scene['id'], choice['id'], choice['condition']))
    if found:
        raise SystemExit(f'reachability requires condition support; found: {found[:10]}')


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
    return (chapter_id, scene['id'] + 1) if scene['id'] + 1 in ids else None


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


def apply_effects(stats, rels, effects, tracked_rels):
    stats = dict(stats)
    rels = dict(rels)
    for key, delta in (effects or {}).items():
        if key == 'relationships' and isinstance(delta, dict):
            for rel, amount in delta.items():
                if rel in tracked_rels:
                    rels[rel] = rels.get(rel, 0) + amount
        elif key.startswith('relationships.'):
            rel = key.split('.', 1)[1]
            if rel in tracked_rels:
                rels[rel] = rels.get(rel, 0) + delta
        elif key in stats and isinstance(delta, (int, float)):
            stats[key] += delta
    return stats, rels


def explore(chapters, tracked_stats, tracked_rels):
    tracked_stats = tuple(tracked_stats)
    tracked_rels = tuple(tracked_rels)

    def freeze(chapter, scene, stats, rels):
        return (
            chapter, scene,
            *(int(stats.get(k, 0)) for k in tracked_stats),
            *(int(rels.get(k, 0)) for k in tracked_rels),
        )

    def thaw(key):
        offset = 2
        stats = dict(zip(tracked_stats, key[offset:offset + len(tracked_stats)]))
        offset += len(tracked_stats)
        rels = dict(zip(tracked_rels, key[offset:offset + len(tracked_rels)]))
        return key[0], key[1], stats, rels

    base_stats = {k: INITIAL.get(k, 0) for k in tracked_stats}
    initial = freeze(1, 0, base_stats, {})
    seen = {initial}
    q = deque([initial])
    finals = set()

    while q:
        if len(seen) > MAX_STATES:
            raise SystemExit(f'reachability explosion for projection {tracked_stats}/{tracked_rels}: > {MAX_STATES}')
        key = q.popleft()
        chapter_id, scene_id, stats, rels = thaw(key)
        if chapter_id not in chapters:
            continue
        scene = scene_map(chapters[chapter_id]).get(scene_id)
        if not scene:
            continue
        if chapter_id == 10 and scene_id == 5:
            finals.add(tuple(stats.get(k, 0) for k in tracked_stats) + tuple(rels.get(k, 0) for k in tracked_rels))
            continue

        alternatives = list(scene.get('choices') or [])
        timeout = scene.get('timeout')
        if isinstance(timeout, dict) and not timeout.get('choiceId') and isinstance(timeout.get('outcome'), dict):
            alternatives.append(timeout['outcome'])

        if alternatives:
            for item in alternatives:
                new_stats = dict(stats)
                # diamonds controls authored cost availability even in small projections.
                if 'diamonds' in tracked_stats:
                    cost = int(item.get('cost') or 0)
                    if new_stats.get('diamonds', 0) < cost:
                        continue
                    new_stats['diamonds'] -= cost
                new_stats, new_rels = apply_effects(new_stats, rels, item.get('effects'), tracked_rels)
                target = next_for_choice(chapter_id, item)
                if not target:
                    continue
                nk = freeze(target[0], target[1], new_stats, new_rels)
                if nk not in seen:
                    seen.add(nk)
                    q.append(nk)
            continue

        target = next_for_scene(chapters, chapter_id, scene)
        if target:
            nk = freeze(target[0], target[1], stats, rels)
            if nk not in seen:
                seen.add(nk)
                q.append(nk)

    return seen, finals


def summarize_values(values):
    values = sorted(set(int(v) for v in values))
    return {'min': min(values), 'max': max(values), 'values': values}


def main():
    chapters = load_chapters()
    assert_no_story_conditions(chapters)
    rel_keys = all_relationship_keys(chapters)

    seen, core_final = explore(chapters, CORE_STATS, CORE_RELS)
    stat_ranges = {}
    rel_ranges = {}
    for idx, key in enumerate(CORE_STATS):
        stat_ranges[key] = summarize_values(row[idx] for row in core_final)
    base = len(CORE_STATS)
    for idx, key in enumerate(CORE_RELS):
        rel_ranges[key] = summarize_values(row[base + idx] for row in core_final)

    # Non-ending relationships are measured independently so they cannot explode the exact
    # ending frontier. No story condition currently depends on them.
    for rel in rel_keys:
        if rel in rel_ranges:
            continue
        _, rows = explore(chapters, ('diamonds',), (rel,))
        rel_ranges[rel] = summarize_values(row[1] for row in rows)

    # Cross-tab: for each candidate relationship score, show personality ranges that coexist
    # with that exact score. This is enough to design relationship + personality gates without
    # inventing impossible combinations.
    joint = {}
    for ridx, rel in enumerate(CORE_RELS):
        rel_col = base + ridx
        by_rel = {}
        for score in sorted(set(row[rel_col] for row in core_final)):
            subset = [row for row in core_final if row[rel_col] == score]
            by_rel[str(score)] = {
                stat: {'min': min(r[sidx] for r in subset), 'max': max(r[sidx] for r in subset)}
                for sidx, stat in enumerate(('crown', 'heart', 'leaf'))
            }
        joint[rel] = by_rel

    summary = {
        'exactProjection': {
            'stats': list(CORE_STATS),
            'relationships': list(CORE_RELS),
            'visitedStateCount': len(seen),
            'finalDecisionStateCount': len(core_final),
        },
        'stats': stat_ranges,
        'relationships': dict(sorted(rel_ranges.items())),
        'jointByRelationship': joint,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
