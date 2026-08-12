#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(path: Path, old: str, new: str, expected=1):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{path}: expected {expected} occurrences of {old!r}, found {count}')
    path.write_text(text.replace(old, new), encoding='utf-8')


def main():
    smoke = ROOT / 'tools' / 'runtime_smoke.mjs'
    replace_exact(
        smoke,
        "assert(result.text.includes('Анна') && result.hasAnnaAvatar, 'Chapter 2 messenger overlay lost Anna header/avatar', JSON.stringify(result));",
        "assert((result.text.includes('Анна') || result.text.includes('Anna')) && result.hasAnnaAvatar, 'Chapter 2 messenger overlay lost Anna header/avatar', JSON.stringify(result));",
    )

    validator = ROOT / 'tools' / 'validate_game.py'
    replace_exact(
        validator,
        'CANONICAL_RELATIONSHIPS = {"mark", "lera", "vika", "sergey", "anna", "dima", "lesha"}',
        'CANONICAL_RELATIONSHIPS = {"mark", "lera", "vika", "sergey", "anna", "dima", "lyosha"}',
    )

    workflow = ROOT / '.github' / 'workflows' / 'validate-game.yml'
    text = workflow.read_text(encoding='utf-8')
    anchor = '          python3 tools/validate_game.py --report artifacts/structural-validation.json\n'
    addition = anchor + '          python3 tools/validate_eligibility.py | tee artifacts/eligibility-validation.json\n'
    if 'python3 tools/validate_eligibility.py' not in text:
        if text.count(anchor) != 1:
            raise RuntimeError('validate-game workflow structural anchor missing')
        text = text.replace(anchor, addition, 1)
    workflow.write_text(text, encoding='utf-8')

    # The source story JSON is CRLF in main. The migration intentionally parsed and rewrote
    # JSON semantically; restore line endings so Git shows only real data edits.
    for path in sorted((ROOT / 'assets' / 'data').glob('*.json')):
        raw = path.read_text(encoding='utf-8-sig')
        normalized = raw.replace('\r\n', '\n').replace('\r', '\n')
        path.write_bytes(normalized.replace('\n', '\r\n').encode('utf-8'))

    print('Stage 0I final cleanup applied')


if __name__ == '__main__':
    main()
