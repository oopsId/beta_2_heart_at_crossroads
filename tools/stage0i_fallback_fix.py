#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'data'


def update_finals():
    path = DATA / 'finals.json'
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    ending = next((item for item in data.get('endings', []) if item.get('id') == 'new_start'), None)
    if not ending:
        raise RuntimeError('new_start ending missing')
    ending['fallback'] = True
    ending['requirements'] = {'all': []}
    text = json.dumps(data, ensure_ascii=False, indent=4)
    path.write_text(text, encoding='utf-8')


def update_validator():
    path = ROOT / 'tools' / 'validate_eligibility.py'
    text = path.read_text(encoding='utf-8')
    anchor = "    endings = {ending['id']: ending for ending in finals.get('endings', []) if isinstance(ending, dict) and ending.get('id')}\n\n"
    insertion = anchor + "    fallbacks = [ending for ending in endings.values() if ending.get('fallback') is True]\n    if len(fallbacks) != 1:\n        raise SystemExit(f'exactly one fallback ending is required, found {[ending.get(\"id\") for ending in fallbacks]}')\n    fallback = fallbacks[0]\n    if fallback.get('requirements') != {'all': []}:\n        raise SystemExit(f'fallback ending {fallback.get(\"id\")} must be unconditional')\n\n"
    if 'exactly one fallback ending is required' not in text:
        if text.count(anchor) != 1:
            raise RuntimeError('validator fallback anchor missing')
        text = text.replace(anchor, insertion, 1)
    path.write_text(text, encoding='utf-8')


def update_smoke():
    path = ROOT / 'tools' / 'runtime_smoke.mjs'
    text = path.read_text(encoding='utf-8')
    old = "  const lockedDima = box.querySelector('[data-choice-id=\"dima\"]')?.disabled === true;\n  const lockedMark = box.querySelector('[data-choice-id=\"mark\"]')?.disabled === true;\n  const forced = await applyChoice(scene5.choices.find(choice => choice.id === 'mark'), { generation });\n"
    new = "  const lockedDima = box.querySelector('[data-choice-id=\"dima\"]')?.disabled === true;\n  const lockedMark = box.querySelector('[data-choice-id=\"mark\"]')?.disabled === true;\n  const fallbackButton = box.querySelector('[data-choice-id=\"premium\"]');\n  const fallbackAvailable = fallbackButton?.disabled === false && fallbackButton?.dataset.eligible === 'true';\n  const forced = await applyChoice(scene5.choices.find(choice => choice.id === 'mark'), { generation });\n"
    if 'const fallbackAvailable =' not in text:
        if text.count(old) != 1:
            raise RuntimeError('smoke fallback setup anchor missing')
        text = text.replace(old, new, 1)

    old2 = "    lockedMark,\n    forced,\n    unlockedDima,\n"
    new2 = "    lockedMark,\n    fallbackAvailable,\n    forced,\n    unlockedDima,\n"
    if text.count(old2) != 1:
        raise RuntimeError('smoke snapshot anchor missing')
    text = text.replace(old2, new2, 1)

    old3 = "assert(result.lockedDima && result.lockedMark && result.forced === false, 'Locked final route can be selected before eligibility', JSON.stringify(result));\n"
    new3 = old3 + "assert(result.fallbackAvailable, 'Reachable final state can have every ending locked; New Start fallback must remain available', JSON.stringify(result));\n"
    if 'New Start fallback must remain available' not in text:
        if text.count(old3) != 1:
            raise RuntimeError('smoke assertion anchor missing')
        text = text.replace(old3, new3, 1)
    path.write_text(text, encoding='utf-8')


def main():
    update_finals()
    update_validator()
    update_smoke()
    print('Stage 0I fallback fix applied')


if __name__ == '__main__':
    main()
