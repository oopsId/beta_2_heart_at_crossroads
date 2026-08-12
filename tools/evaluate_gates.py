#!/usr/bin/env python3
import json
from reachability import ENDING_PROJECTIONS, explore, load_chapters

BASE_GATES = {
    'freedom_with_dima': lambda v: v['heart'] >= 15 and v['dima'] >= 2,
    'silence_with_mark': lambda v: v['heart'] >= 15 and v['leaf'] >= 10 and v['mark'] >= 4,
    'summit_with_sergey': lambda v: v['crown'] >= 6 and v['sergey'] >= 3,
    'friendship_above_all': lambda v: v['leaf'] >= 15 and v['vika'] >= 1,
}

CANDIDATES = {
    'lonely_path': {
        'dominant_crown_5': lambda v: v['crown'] >= 5 and v['crown'] >= v['heart'] and v['crown'] >= v['leaf'],
        'dominant_crown_margin2': lambda v: v['crown'] >= 5 and v['crown'] + 2 >= v['heart'] and v['crown'] + 2 >= v['leaf'],
        'low_attachment_crown6': lambda v: v['crown'] >= 6 and v['heart'] <= 8 and v['leaf'] <= 8,
    },
    'new_start': {
        'high_balance_oldish': lambda v: v['crown'] >= 6 and v['heart'] >= 10 and v['leaf'] >= 10,
        'moderate_balance': lambda v: v['crown'] >= 5 and v['heart'] >= 8 and v['leaf'] >= 8,
        'balanced_spread5': lambda v: min(v['crown'], v['heart'], v['leaf']) >= 5 and (max(v['crown'], v['heart'], v['leaf']) - min(v['crown'], v['heart'], v['leaf'])) <= 5,
        'balanced_spread7': lambda v: min(v['crown'], v['heart'], v['leaf']) >= 4 and (max(v['crown'], v['heart'], v['leaf']) - min(v['crown'], v['heart'], v['leaf'])) <= 7,
    },
}


def evaluate(decoded, predicate):
    eligible = [row for row in decoded if predicate(row)]
    return {
        'projectedStates': len(decoded),
        'eligibleStates': len(eligible),
        'eligiblePercent': round((len(eligible) / len(decoded) * 100), 2) if decoded else 0,
        'sample': eligible[:5],
    }


def main():
    chapters = load_chapters()
    projections = {}
    for ending_id, (stats, rels) in ENDING_PROJECTIONS.items():
        _, rows = explore(chapters, stats, rels)
        columns = list(stats) + list(rels)
        projections[ending_id] = [dict(zip(columns, row)) for row in rows]

    out = {
        ending_id: evaluate(projections[ending_id], predicate)
        for ending_id, predicate in BASE_GATES.items()
    }
    out['lonely_path'] = {
        name: evaluate(projections['lonely_path'], predicate)
        for name, predicate in CANDIDATES['lonely_path'].items()
    }
    out['new_start'] = {
        name: evaluate(projections['new_start'], predicate)
        for name, predicate in CANDIDATES['new_start'].items()
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))

    if any(out[e]['eligibleStates'] == 0 for e in BASE_GATES):
        raise SystemExit('one or more base character ending gates are unreachable')
    if any(result['eligibleStates'] == 0 for group in ('lonely_path', 'new_start') for result in out[group].values()):
        raise SystemExit('one or more candidate ending gates are unreachable')


if __name__ == '__main__':
    main()
