#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'data'


def main():
    # The legacy data set has mixed line endings. Git history shows chapter1 is CRLF while
    # chapter2..10 and finals.json are LF. Preserve that baseline so the Stage 0I PR exposes
    # semantic edits instead of whole-file newline churn.
    for path in sorted(DATA.glob('*.json')):
        raw = path.read_text(encoding='utf-8-sig')
        normalized = raw.replace('\r\n', '\n').replace('\r', '\n')
        if path.name == 'chapter1.json':
            output = normalized.replace('\n', '\r\n')
        else:
            output = normalized
        path.write_bytes(output.encode('utf-8'))

    print('Stage 0I baseline line endings restored')


if __name__ == '__main__':
    main()
