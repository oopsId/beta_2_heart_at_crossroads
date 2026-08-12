#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


def patch_runtime():
    path = ROOT / 'assets/js/stage0j-runtime.js'
    text = path.read_text(encoding='utf-8')

    old = '''            z-index: 3;\n            pointer-events: none;\n            filter: drop-shadow(0 14px 24px rgba(0,0,0,.28));'''
    new = '''            z-index: 3;\n            pointer-events: none;\n            transform: none;\n            filter: drop-shadow(0 14px 24px rgba(0,0,0,.28));'''
    if 'pointer-events: none;\n            transform: none;' not in text:
        text = replace_once(text, old, new, 'desktop transform reset')

    old_media_end = '''            #phone-compose-overlay .stage0j-notification-copy span { max-width: 115px; }\n        }\n    `;'''
    new_media_end = '''            #phone-compose-overlay .stage0j-notification-copy span { max-width: 115px; }\n        }\n        /* Short landscape uses a side-by-side composition instead of stacking phone and dialogue. */\n        @media (max-height: 520px) and (orientation: landscape) {\n            #phone-compose-overlay {\n                left: 12px;\n                top: 8px;\n                transform: none;\n                width: min(190px, 29vw);\n                height: calc(100vh - 16px);\n                min-width: 0;\n                min-height: 0;\n                max-height: none;\n            }\n            body.stage0j-compose-scene .dialogue-box {\n                left: min(31vw, 210px);\n                right: 8px;\n                bottom: 8px;\n                width: auto;\n                min-height: 0;\n                max-height: calc(100vh - 16px);\n            }\n            #phone-compose-overlay .stage0j-phone-header { height: 46px; padding: 0 9px; }\n            #phone-compose-overlay .stage0j-header-avatar { width: 27px; height: 27px; }\n            #phone-compose-overlay .stage0j-notification-stack { top: 55px; left: 7px; right: 7px; gap: 5px; }\n            #phone-compose-overlay .stage0j-notification { min-height: 46px; padding: 5px 7px; grid-template-columns: 29px 1fr; gap: 6px; }\n            #phone-compose-overlay .stage0j-notification-avatar,\n            #phone-compose-overlay .stage0j-notification-initial { width: 29px; height: 29px; }\n            #phone-compose-overlay .stage0j-compose-input-wrap { left: 7px; right: 7px; bottom: 7px; min-height: 34px; }\n        }\n    `;'''
    if 'Short landscape uses a side-by-side composition' not in text:
        text = replace_once(text, old_media_end, new_media_end, 'landscape layout')

    # A completed image with zero natural width is not a successful decode.
    text = text.replace('finish(img.naturalWidth > 0 || img.complete);', 'finish(img.naturalWidth > 0);')
    path.write_text(text, encoding='utf-8')


def patch_smoke():
    path = ROOT / 'tools/runtime_smoke.mjs'
    text = path.read_text(encoding='utf-8')
    marker = '''results.phoneOverlay = true;\n\n// 9. Speaker focus follows the actual displayed character instead of hard-coded Anna/Vika positions.'''
    insertion = '''results.phoneOverlay = true;\n\n// 8b. Compose phone stays on-screen on desktop and never overlaps dialogue in short landscape.\nawait page.setViewportSize({ width: 1920, height: 1080 });\nresult = await page.evaluate(async () => {\n  const generation = beginRuntimeSession('0j-phone-desktop-layout');\n  resetGameState(false);\n  currentChapter = 2;\n  scriptData = await (await fetch('assets/data/chapter2.json')).json();\n  const scene = scriptData.scenes.find(candidate => candidate.id === 1);\n  document.getElementById('game-container').style.display = 'block';\n  const overlay = stage0jShowComposeOverlay(scene, generation);\n  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n  const rect = overlay.getBoundingClientRect();\n  const snapshot = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };\n  overlay.remove();\n  invalidateRuntimeSession('0j-phone-desktop-layout-done');\n  return snapshot;\n});\nassert(result.left >= 0 && result.top >= 0 && result.right <= result.width && result.bottom <= result.height, 'Compose phone is clipped off desktop viewport', JSON.stringify(result));\n\nawait page.setViewportSize({ width: 667, height: 375 });\nresult = await page.evaluate(async () => {\n  const generation = beginRuntimeSession('0j-phone-landscape-layout');\n  resetGameState(false);\n  currentChapter = 2;\n  scriptData = await (await fetch('assets/data/chapter2.json')).json();\n  const scene = scriptData.scenes.find(candidate => candidate.id === 1);\n  const game = document.getElementById('game-container');\n  const dialogue = document.querySelector('.dialogue-box');\n  game.style.display = 'block';\n  dialogue.style.display = 'flex';\n  document.body.classList.add('stage0j-compose-scene');\n  const overlay = stage0jShowComposeOverlay(scene, generation);\n  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));\n  const phoneRect = overlay.getBoundingClientRect();\n  const dialogueRect = dialogue.getBoundingClientRect();\n  const overlaps = !(phoneRect.right <= dialogueRect.left || phoneRect.left >= dialogueRect.right || phoneRect.bottom <= dialogueRect.top || phoneRect.top >= dialogueRect.bottom);\n  const snapshot = {\n    phone: { left: phoneRect.left, top: phoneRect.top, right: phoneRect.right, bottom: phoneRect.bottom },\n    dialogue: { left: dialogueRect.left, top: dialogueRect.top, right: dialogueRect.right, bottom: dialogueRect.bottom },\n    width: innerWidth,\n    height: innerHeight,\n    overlaps\n  };\n  overlay.remove();\n  document.body.classList.remove('stage0j-compose-scene');\n  invalidateRuntimeSession('0j-phone-landscape-layout-done');\n  return snapshot;\n});\nassert(result.phone.left >= 0 && result.phone.top >= 0 && result.phone.right <= result.width && result.phone.bottom <= result.height, 'Compose phone is clipped in short landscape', JSON.stringify(result));\nassert(result.overlaps === false, 'Compose phone overlaps dialogue in short landscape', JSON.stringify(result));\nresults.phoneLayout = true;\nawait page.setViewportSize({ width: 1280, height: 720 });\n\n// 9. Speaker focus follows the actual displayed character instead of hard-coded Anna/Vika positions.'''
    if '// 8b. Compose phone stays on-screen' not in text:
        text = replace_once(text, marker, insertion, 'phone layout smoke insertion')
    path.write_text(text, encoding='utf-8')


patch_runtime()
patch_smoke()
print('Stage 0J review fixes applied')
