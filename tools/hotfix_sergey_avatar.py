#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
chapter = root / 'assets/data/chapter2.json'
raw = chapter.read_text(encoding='utf-8')
old = '''                        "message": {\n                            "ru": "Хочу поговорить",\n                            "en": "Want to talk"\n                        }\n                    }'''
new = '''                        "message": {\n                            "ru": "Хочу поговорить",\n                            "en": "Want to talk"\n                        },\n                        "avatar": "assets/characters/sergey/sergey_messenger_ava.png"\n                    }'''
if old not in raw:
    if '"avatar": "assets/characters/sergey/sergey_messenger_ava.png"' in raw:
        print('Sergey avatar already present')
    else:
        raise SystemExit('Sergey notification block not found')
else:
    chapter.write_text(raw.replace(old, new, 1), encoding='utf-8')

check = root / 'tools/validate_sergey_avatar.py'
check.write_text('''#!/usr/bin/env python3\nimport json\nfrom pathlib import Path\nroot = Path(__file__).resolve().parents[1]\ndata = json.loads((root / "assets/data/chapter2.json").read_text(encoding="utf-8"))\nscene = next(s for s in data["scenes"] if s["id"] == 1)\nnotes = scene["phoneOverlay"]["notifications"]\nexpected = {\n    "lyosha": "assets/characters/lyosha/lyosha_messenger_ava.png",\n    "mark": "assets/characters/mark/mark_messenger_ava.png",\n    "sergey": "assets/characters/sergey/sergey_messenger_ava.png",\n}\nfor note in notes:\n    sid = note["senderId"]\n    assert note.get("avatar") == expected[sid], f"{sid}: missing/wrong messenger avatar"\n    assert (root / note["avatar"]).is_file(), f"{sid}: avatar asset missing"\nassert len(notes) == 3\nprint("PASS: compose notifications have 3 real messenger avatars")\n''', encoding='utf-8')
print('patched')
