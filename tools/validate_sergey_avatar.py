#!/usr/bin/env python3
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
data = json.loads((root / "assets/data/chapter2.json").read_text(encoding="utf-8"))
scene = next(s for s in data["scenes"] if s["id"] == 1)
notes = scene["phoneOverlay"]["notifications"]
expected = {
    "lyosha": "assets/characters/lyosha/lyosha_messenger_ava.png",
    "mark": "assets/characters/mark/mark_messenger_ava.png",
    "sergey": "assets/characters/sergey/sergey_messenger_ava.png",
}
for note in notes:
    sid = note["senderId"]
    assert note.get("avatar") == expected[sid], f"{sid}: missing/wrong messenger avatar"
    assert (root / note["avatar"]).is_file(), f"{sid}: avatar asset missing"
assert len(notes) == 3
print("PASS: compose notifications have 3 real messenger avatars")
