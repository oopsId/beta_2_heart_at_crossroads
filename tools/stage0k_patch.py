#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# Preserve the monolith's CRLF exactly; only insert the new runtime include.
html_path = ROOT / 'heart_at_crossroads.html'
html = html_path.read_bytes()
needle = b'<script src="assets/js/stage0j-runtime.js"></script>\r\n'
replacement = needle + b'<script src="assets/js/stage0k-runtime.js"></script>\r\n'
if b'stage0k-runtime.js' not in html:
    if html.count(needle) != 1:
        raise RuntimeError(f'HTML stage0j include count: {html.count(needle)}')
    html = html.replace(needle, replacement, 1)
    html_path.write_bytes(html)

chapter_path = ROOT / 'assets/data/chapter2.json'
chapter = chapter_path.read_text(encoding='utf-8')
replacements = [
    (
        'Пальцы замерли над экраном. Три непрочитанных чата — три разные дороги. Я смотрю на мигающий курсор и не могу решить, кому ответить. Все тянут в разные стороны, а я не знаю, куда мне.',
        'Пальцы замерли над экраном. Лёша ждёт ответа, а я… Что я чувствую? Его зов или свою тень? Все тянут в разные стороны, а я не знаю, куда мне.',
        'chapter2 first-playthrough RU narration'
    ),
    (
        'My fingers hovered over the screen. Three unread chats — three different roads. I watch the blinking cursor and cannot decide who to answer. Everyone is pulling me in a different direction, and I do not know where I belong.',
        'My fingers hovered over the screen. Lyosha’s waiting for a reply, and I… What do I feel? His call or my shadow? Everyone’s pulling me in different directions, and I don’t know where I belong.',
        'chapter2 first-playthrough EN narration'
    ),
    (
        'Пальцы замерли над экраном — всё как в прошлый раз. Три чата, три ниточки. Теперь я уже знаю, что каждый ответ что-то меняет, и всё равно смотрю на курсор, не решаясь выбрать.',
        'Пальцы замерли над экраном — всё как в прошлый раз. Лёша ждёт, а я… знаю, что ты уже видел это, да? Но теперь я вижу их игру, и всё равно не знаю, куда идти.',
        'chapter2 replay RU narration'
    ),
    (
        'My fingers hovered over the screen — just like last time. Three chats, three threads. Now I already know that every answer changes something, and I still stare at the cursor, unable to choose.',
        'My fingers hovered over the screen — just like last time. Lyosha is waiting, and I… I know you have seen this before, right? But now I can see their game, and I still do not know where to go.',
        'chapter2 replay EN narration'
    ),
]
for old, new, label in replacements:
    if old in chapter:
        chapter = replace_once(chapter, old, new, label)
chapter_path.write_text(chapter, encoding='utf-8')

smoke_path = ROOT / 'tools/runtime_smoke.mjs'
smoke = smoke_path.read_text(encoding='utf-8')

old_wait = """  typeof stage0jRenderSceneVisuals === 'function' &&\n  typeof stage0jShowComposeOverlay === 'function'\n);"""
new_wait = """  typeof stage0jRenderSceneVisuals === 'function' &&\n  typeof stage0jShowComposeOverlay === 'function' &&\n  typeof stage0kDevForceFirstPlaythrough === 'function' &&\n  typeof stage0kApplyReplayOverride === 'function'\n);"""
if 'typeof stage0kDevForceFirstPlaythrough' not in smoke:
    smoke = replace_once(smoke, old_wait, new_wait, 'runtime wait for Stage 0K')

old_snapshot = """      hasCaret: Boolean(overlay?.querySelector('.stage0j-compose-caret')),\n      dialogue: scene.text.ru\n    };"""
new_snapshot = """      hasCaret: Boolean(overlay?.querySelector('.stage0j-compose-caret')),\n      phoneBackground: overlay ? getComputedStyle(overlay.querySelector('.stage0j-phone-screen')).backgroundImage : '',\n      dialogue: scene.text.ru\n    };"""
if 'phoneBackground:' not in smoke:
    smoke = replace_once(smoke, old_snapshot, new_snapshot, 'phone background snapshot')

old_phone_assert = """assert(result.senders.join(',') === 'lyosha,mark,sergey', 'Compose notification senders drifted from final choices', JSON.stringify(result));\nassert(!result.text.includes('Пальцы замерли') && !result.text.includes('My fingers hovered'), 'Phone overlay duplicates narration text', JSON.stringify(result));"""
new_phone_assert = """assert(result.senders.join(',') === 'lyosha,mark,sergey', 'Compose notification senders drifted from final choices', JSON.stringify(result));\nassert(result.phoneBackground.includes('bg_phone_ui.png') && !result.phoneBackground.includes('linear-gradient'), 'Compose phone lost green messenger background', JSON.stringify(result));\nassert(!result.text.includes('Пальцы замерли') && !result.text.includes('My fingers hovered'), 'Phone overlay duplicates narration text', JSON.stringify(result));"""
if 'Compose phone lost green messenger background' not in smoke:
    smoke = replace_once(smoke, old_phone_assert, new_phone_assert, 'green phone assertion')

old_desktop_assert = """assert(result.left >= 0 && result.top >= 0 && result.right <= result.width && result.bottom <= result.height, 'Compose phone is clipped off desktop viewport', JSON.stringify(result));\n\nawait page.setViewportSize({ width: 667, height: 375 });"""
new_desktop_assert = """assert(result.left >= 0 && result.top >= 0 && result.right <= result.width && result.bottom <= result.height, 'Compose phone is clipped off desktop viewport', JSON.stringify(result));\nassert(Math.abs(((result.left + result.right) / 2) - (result.width / 2)) <= 2, 'Compose phone is not horizontally centered on desktop', JSON.stringify(result));\n\nawait page.setViewportSize({ width: 667, height: 375 });"""
if 'not horizontally centered on desktop' not in smoke:
    smoke = replace_once(smoke, old_desktop_assert, new_desktop_assert, 'desktop centering assertion')

old_landscape_asserts = """assert(result.phone.left >= 0 && result.phone.top >= 0 && result.phone.right <= result.width && result.phone.bottom <= result.height, 'Compose phone is clipped in short landscape', JSON.stringify(result));\nassert(result.overlaps === false, 'Compose phone overlaps dialogue in short landscape', JSON.stringify(result));\nresults.phoneLayout = true;"""
new_landscape_asserts = """assert(result.phone.left >= 0 && result.phone.top >= 0 && result.phone.right <= result.width && result.phone.bottom <= result.height, 'Compose phone is clipped in short landscape', JSON.stringify(result));\nassert(Math.abs(((result.phone.left + result.phone.right) / 2) - (result.width / 2)) <= 2, 'Compose phone is not centered in short landscape', JSON.stringify(result));\nassert(result.dialogue.left <= 1 && result.dialogue.right >= result.width - 1, 'Compose scene displaced/cropped the normal dialogue box', JSON.stringify(result));\nassert(result.overlaps === false, 'Compose phone overlaps dialogue in short landscape', JSON.stringify(result));\nresults.phoneLayout = true;"""
if 'Compose scene displaced/cropped the normal dialogue box' not in smoke:
    smoke = replace_once(smoke, old_landscape_asserts, new_landscape_asserts, 'landscape centered/full-width assertions')

marker = """results.phoneLayout = true;\nawait page.setViewportSize({ width: 1280, height: 720 });\n\n// 9. Speaker focus follows the actual displayed character instead of hard-coded Anna/Vika positions."""
insert = """results.phoneLayout = true;\nawait page.setViewportSize({ width: 1280, height: 720 });\n\n// 8c. Developer replay override hides alternate narration without changing real completionCount.\nresult = await page.evaluate(async () => {\n  const key = 'heart_at_crossroads_beta2:dev:force_first_playthrough';\n  const previousCompletion = stats.completionCount;\n  stats.completionCount = 3;\n  localStorage.setItem(key, '1');\n  const chapter = await (await fetch('assets/data/chapter2.json')).json();\n  const scene = chapter.scenes.find(candidate => candidate.id === 1);\n  stage0kApplyReplayOverride(chapter);\n  const hidden = !Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text');\n  const completionWhileForced = stats.completionCount;\n  localStorage.removeItem(key);\n  stage0kApplyReplayOverride(chapter);\n  const restored = Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text');\n  stats.completionCount = previousCompletion;\n  return { hidden, restored, completionWhileForced };\n});\nassert(result.hidden && result.restored, 'Developer replay override did not hide/restore second_playthrough_text', JSON.stringify(result));\nassert(result.completionWhileForced === 3, 'Developer replay override modified completionCount', JSON.stringify(result));\nresults.devReplayOverride = true;\n\n// 9. Speaker focus follows the actual displayed character instead of hard-coded Anna/Vika positions."""
if '// 8c. Developer replay override' not in smoke:
    smoke = replace_once(smoke, marker, insert, 'developer replay smoke')

smoke_path.write_text(smoke, encoding='utf-8')
print('Stage 0K patch applied')
