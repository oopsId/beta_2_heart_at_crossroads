#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'assets' / 'data'
phone = []
effects = []
for chapter_id in range(1, 11):
    data = json.loads((root / f'chapter{chapter_id}.json').read_text(encoding='utf-8'))
    for scene in data.get('scenes', []):
        if scene.get('timeout') or scene.get('phone') is not None or scene.get('phoneSenderName') or scene.get('phoneMessages'):
            phone.append({
                'chapter': chapter_id,
                'scene': scene['id'],
                'speaker': scene.get('speaker'),
                'timeout': scene.get('timeout'),
                'phone': scene.get('phone'),
                'phoneSenderId': scene.get('phoneSenderId'),
                'phoneSenderName': scene.get('phoneSenderName'),
                'phoneMessages': scene.get('phoneMessages'),
            })
        interesting = {k: v for k, v in scene.items() if any(token in k.lower() for token in ('shiver', 'heartbeat', 'effect', 'offset', 'speaker'))}
        if any(k.lower() != 'speaker' for k in interesting):
            effects.append({'chapter': chapter_id, 'scene': scene['id'], **interesting})
print(json.dumps({'phoneScenes': phone, 'effectScenes': effects}, ensure_ascii=False, indent=2))
