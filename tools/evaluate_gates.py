#!/usr/bin/env python3
import json
from reachability import ENDING_PROJECTIONS, explore, load_chapters

PROPOSED = {
    'freedom_with_dima': lambda v: v['heart'] >= 15 and v['dima'] >= 2,
    'silence_with_mark': lambda v: v['heart'] >= 15 and v['leaf'] >= 10 and v['mark'] >= 4,
    'summit_with_sergey': lambda v: v['crown'] >= 6 and v['sergey'] >= 3,
    'friendship_above_all': lambda v: v['leaf'] >= 15 and v['vika'] >= 1,
    'lonely_path': lambda v: v['crown'] > v['heart'] + v['leaf'],
    'new_start': lambda v: v['crown'] >= 6 and v['heart'] >= 10 and v['leaf'] >= 10,
}


def main():
    chapters = load_chapters()
    out = {}
    failed = False
    for ending_id, (stats, rels) in ENDING_PROJECTIONS.items():
        _, rows = explore(chapters, stats, rels)
        columns = list(stats) + list(rels)
        decoded = [dict(zip(columns, row)) for row in rows]
        eligible = [row for row in decoded if PROPOSED[ending_id](row)]
        out[ending_id] = {
            'projectedStates': len(decoded),
            'eligibleStates': len(eligible),
            'eligiblePercent': round((len(eligible) / len(decoded) * 100), 2) if decoded else 0,
            'sample': eligible[:5],
        }
        if not eligible:
            failed = True
    print(json.dumps(out, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit('one or more proposed ending gates are unreachable')


if __name__ == '__main__':
    main()
