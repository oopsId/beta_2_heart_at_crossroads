#!/usr/bin/env python3
import json
from pathlib import Path
from reachability import ENDING_PROJECTIONS, explore, load_chapters

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'data'
EXPECTED_CHOICES = {
    'dima': 'freedom_with_dima',
    'mark': 'silence_with_mark',
    'sergey': 'summit_with_sergey',
    'vika': 'friendship_above_all',
    'alone': 'lonely_path',
    'premium': 'new_start',
}
OPS = {
    '>': lambda a, b: a > b,
    '<': lambda a, b: a < b,
    '>=': lambda a, b: a >= b,
    '<=': lambda a, b: a <= b,
    '==': lambda a, b: a == b,
    '!=': lambda a, b: a != b,
}


def value(expr, state):
    if isinstance(expr, (int, float)) and not isinstance(expr, bool):
        return expr
    if not isinstance(expr, dict):
        raise ValueError(f'invalid requirement expression: {expr!r}')
    if isinstance(expr.get('stat'), str):
        return state.get(expr['stat'], 0)
    if isinstance(expr.get('relationship'), str):
        return state.get(expr['relationship'], 0)
    if isinstance(expr.get('sum'), list):
        return sum(value(item, state) for item in expr['sum'])
    if isinstance(expr.get('max'), list) and expr['max']:
        return max(value(item, state) for item in expr['max'])
    if isinstance(expr.get('min'), list) and expr['min']:
        return min(value(item, state) for item in expr['min'])
    if isinstance(expr.get('subtract'), list) and len(expr['subtract']) == 2:
        return value(expr['subtract'][0], state) - value(expr['subtract'][1], state)
    raise ValueError(f'unsupported requirement expression: {expr!r}')


def evaluate(node, state):
    if not isinstance(node, dict):
        raise ValueError(f'requirement node must be object: {node!r}')
    if 'all' in node:
        if not isinstance(node['all'], list): raise ValueError('requirements.all must be array')
        return all(evaluate(item, state) for item in node['all'])
    if 'any' in node:
        if not isinstance(node['any'], list): raise ValueError('requirements.any must be array')
        return any(evaluate(item, state) for item in node['any'])
    if 'not' in node:
        return not evaluate(node['not'], state)
    if 'stat' in node:
        if node.get('op') not in OPS or not isinstance(node.get('value'), (int, float)):
            raise ValueError(f'invalid stat requirement: {node!r}')
        return OPS[node['op']](state.get(node['stat'], 0), node['value'])
    if 'relationship' in node:
        if node.get('op') not in OPS or not isinstance(node.get('value'), (int, float)):
            raise ValueError(f'invalid relationship requirement: {node!r}')
        return OPS[node['op']](state.get(node['relationship'], 0), node['value'])
    if 'compare' in node:
        compare = node['compare']
        if not isinstance(compare, dict) or compare.get('op') not in OPS:
            raise ValueError(f'invalid compare requirement: {node!r}')
        return OPS[compare['op']](value(compare.get('left'), state), value(compare.get('right'), state))
    # choice/memory are supported by runtime for future narrative gates, but current exact
    # reachability projection does not carry history. Fail if they enter active finals now.
    if 'choice' in node or 'memory' in node:
        raise ValueError('choice/memory final gates require extending reachability history projection first')
    raise ValueError(f'unsupported requirement node: {node!r}')


def main():
    chapters = load_chapters()
    finals = json.loads((DATA / 'finals.json').read_text(encoding='utf-8-sig'))
    endings = {ending['id']: ending for ending in finals.get('endings', []) if isinstance(ending, dict) and ending.get('id')}

    if set(endings) != set(ENDING_PROJECTIONS):
        raise SystemExit(f'ending ids mismatch: data={sorted(endings)}, analyzer={sorted(ENDING_PROJECTIONS)}')

    chapter10 = chapters[10]
    scene5 = next((scene for scene in chapter10.get('scenes', []) if scene.get('id') == 5), None)
    if not scene5:
        raise SystemExit('chapter10 scene5 missing')
    choices = {choice.get('id'): choice for choice in scene5.get('choices', []) if isinstance(choice, dict)}
    for choice_id, ending_id in EXPECTED_CHOICES.items():
        choice = choices.get(choice_id)
        if not choice or choice.get('endingId') != ending_id:
            raise SystemExit(f'final choice {choice_id!r} must declare endingId={ending_id!r}')
    if len({choice.get('endingId') for choice in choices.values() if choice.get('endingId')}) != 6:
        raise SystemExit('final choice endingId mapping must contain six unique endings')
    if 'cost' in choices['premium']:
        raise SystemExit('new_start final choice must not carry the unreachable legacy diamond cost')

    report = {}
    for ending_id, (stats, rels) in ENDING_PROJECTIONS.items():
        requirement = endings[ending_id].get('requirements')
        if not isinstance(requirement, dict):
            raise SystemExit(f'{ending_id}: executable requirements missing')
        _, rows = explore(chapters, stats, rels)
        columns = list(stats) + list(rels)
        decoded = [dict(zip(columns, row)) for row in rows]
        try:
            eligible = [state for state in decoded if evaluate(requirement, state)]
        except (ValueError, KeyError) as exc:
            raise SystemExit(f'{ending_id}: invalid requirements: {exc}') from exc
        if not eligible:
            raise SystemExit(f'{ending_id}: requirements are unreachable in exact projection')
        report[ending_id] = {
            'projectedStates': len(decoded),
            'eligibleStates': len(eligible),
            'eligiblePercent': round(len(eligible) / len(decoded) * 100, 2),
        }

    print(json.dumps({'status': 'PASS', 'endings': report}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
