#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def patch_html():
    path = ROOT / 'heart_at_crossroads.html'
    text = path.read_text(encoding='utf-8')
    old = '<script src="assets/js/stage0i-runtime.js"></script>'
    new = old + '\n<script src="assets/js/stage0j-runtime.js"></script>'
    if 'stage0j-runtime.js' not in text:
        text = replace_once(text, old, new, 'html stage0j script tag')
    path.write_text(text, encoding='utf-8')


def patch_chapter2():
    path = ROOT / 'assets' / 'data' / 'chapter2.json'
    text = path.read_text(encoding='utf-8')

    replacements = [
        (
            '"ru": "Пальцы замерли над экраном. Лёша ждёт ответа, а я… Что я чувствую? Его зов или свою тень? Катя в WhatsApp: ‘Ань, ты пропала!’ Сергей вчера писал: ‘Хочу поговорить’. Марк тоже: ‘Ты где?’ Все тянут в разные стороны, а я не знаю, куда мне.",',
            '"ru": "Пальцы замерли над экраном. Три непрочитанных чата — три разные дороги. Я смотрю на мигающий курсор и не могу решить, кому ответить. Все тянут в разные стороны, а я не знаю, куда мне.",',
            'chapter2 scene1 ru text'
        ),
        (
            '"en": "My fingers hovered over the screen. Lyosha’s waiting for a reply, and I… What do I feel? His call or my shadow? Katya on WhatsApp: ‘Anya, you’ve disappeared!’ Sergey wrote yesterday: ‘Want to talk.’ Mark too: ‘Where are you?’ Everyone’s pulling me in different directions, and I don’t know where I belong."',
            '"en": "My fingers hovered over the screen. Three unread chats — three different roads. I watch the blinking cursor and cannot decide who to answer. Everyone is pulling me in a different direction, and I do not know where I belong."',
            'chapter2 scene1 en text'
        ),
        (
            '"ru": "Пальцы замерли над экраном — всё как в прошлый раз. Лёша ждёт, а я… знаю, что ты уже видел это, да? Катя в WhatsApp: ‘Ань, ты пропала!’ — опять. Сергей и Марк — те же слова, те же ниточки, тянущие меня. Но теперь я вижу их игру, и всё равно не знаю, куда идти.",',
            '"ru": "Пальцы замерли над экраном — всё как в прошлый раз. Три чата, три ниточки. Теперь я уже знаю, что каждый ответ что-то меняет, и всё равно смотрю на курсор, не решаясь выбрать.",',
            'chapter2 scene1 ru second text'
        ),
        (
            '"en": "My fingers hovered over the screen — just like last time. Lyosha’s waiting, and I… you’ve seen this before, haven’t you? Katya on WhatsApp: ‘Anya, you’ve disappeared!’ — again. Sergey and Mark — same words, same threads pulling me. But now I see their game, and still don’t know where to go."',
            '"en": "My fingers hovered over the screen — just like last time. Three chats, three threads. Now I already know that every answer changes something, and I still stare at the cursor, unable to choose."',
            'chapter2 scene1 en second text'
        )
    ]
    for old, new, label in replacements:
        if old in text:
            text = replace_once(text, old, new, label)

    old_phone = '            "phoneMode": "messenger"\n'
    new_phone = '''            "phoneMode": "compose",\n            "phoneOverlay": {\n                "header": {\n                    "ru": "Анна",\n                    "en": "Anna"\n                },\n                "avatar": "assets/characters/anna/anna_messenger_ava.png",\n                "inputPlaceholder": {\n                    "ru": "Сообщение",\n                    "en": "Message"\n                },\n                "notifications": [\n                    {\n                        "senderId": "lyosha",\n                        "sender": {\n                            "ru": "Лёша",\n                            "en": "Lyosha"\n                        },\n                        "message": {\n                            "ru": "Ань, вечером в клуб, без отмазок!",\n                            "en": "Anya, club tonight, no excuses!"\n                        },\n                        "avatar": "assets/characters/lyosha/lyosha_messenger_ava.png"\n                    },\n                    {\n                        "senderId": "mark",\n                        "sender": {\n                            "ru": "Марк",\n                            "en": "Mark"\n                        },\n                        "message": {\n                            "ru": "Ты где?",\n                            "en": "Where are you?"\n                        },\n                        "avatar": "assets/characters/mark/mark_messenger_ava.png"\n                    },\n                    {\n                        "senderId": "sergey",\n                        "sender": {\n                            "ru": "Сергей",\n                            "en": "Sergey"\n                        },\n                        "message": {\n                            "ru": "Хочу поговорить",\n                            "en": "Want to talk"\n                        }\n                    }\n                ]\n            }\n'''
    if '"phoneMode": "compose"' not in text:
        text = replace_once(text, old_phone, new_phone, 'chapter2 compose phone')

    path.write_text(text, encoding='utf-8')


def patch_smoke():
    path = ROOT / 'tools' / 'runtime_smoke.mjs'
    text = path.read_text(encoding='utf-8')

    old_phone_block = '''// 8. Stage 0E timed messenger scenes still render the phone overlay (chapter 2 / scene 1 regression).\nresult = await page.evaluate(async () => {\n  const generation = beginRuntimeSession('0i-phone');\n  resetGameState(false);\n  currentChapter = 2;\n  currentScene = 1;\n  scriptData = await (await fetch('assets/data/chapter2.json')).json();\n  const scene = scriptData.scenes.find(candidate => candidate.id === 1);\n  const originalTypeText = typeText;\n  const originalPlaySound = playSound;\n  const originalPlayMusic = playMusic;\n  try {\n    currentBackground = scene.background;\n    typeText = (_text, _element, callback) => { callback?.(); return true; };\n    playSound = () => null;\n    playMusic = () => null;\n    showSceneWithTimer(scene, generation);\n    await new Promise(resolve => window.setTimeout(resolve, 250));\n    const overlay = document.getElementById('messenger-overlay');\n    const hrefs = overlay ? [...overlay.querySelectorAll('image')].map(image => image.getAttribute('href') || '') : [];\n    const snapshot = {\n      phoneMode: scene.phoneMode,\n      exists: Boolean(overlay),\n      text: overlay?.textContent || '',\n      hasAnnaAvatar: hrefs.some(href => href.includes('anna_messenger_ava.png'))\n    };\n    invalidateRuntimeSession('0i-phone-done');\n    return snapshot;\n  } finally {\n    typeText = originalTypeText;\n    playSound = originalPlaySound;\n    playMusic = originalPlayMusic;\n  }\n});\nassert(result.phoneMode === 'messenger' && result.exists, 'Timed messenger overlay disappeared after Stage 0E', JSON.stringify(result));\nassert((result.text.includes('Анна') || result.text.includes('Anna')) && result.hasAnnaAvatar, 'Chapter 2 messenger overlay lost Anna header/avatar', JSON.stringify(result));\nresults.phoneOverlay = true;\n'''

    new_phone_block = '''// 8. Chapter 2 / scene 1 uses the compose overlay: Anna header, empty input caret, three notifications, no duplicated narration.\nresult = await page.evaluate(async () => {\n  const generation = beginRuntimeSession('0j-phone-compose');\n  resetGameState(false);\n  currentChapter = 2;\n  currentScene = 1;\n  scriptData = await (await fetch('assets/data/chapter2.json')).json();\n  const scene = scriptData.scenes.find(candidate => candidate.id === 1);\n  const originalTypeText = typeText;\n  const originalPlaySound = playSound;\n  const originalPlayMusic = playMusic;\n  try {\n    typeText = (_text, _element, callback) => { callback?.(); return true; };\n    playSound = () => null;\n    playMusic = () => null;\n    showSceneWithTimer(scene, generation);\n    await new Promise(resolve => window.setTimeout(resolve, 250));\n    const overlay = document.getElementById('phone-compose-overlay');\n    const notifications = overlay ? [...overlay.querySelectorAll('.stage0j-notification')] : [];\n    const hrefs = overlay ? [...overlay.querySelectorAll('img')].map(image => image.getAttribute('src') || '') : [];\n    const snapshot = {\n      phoneMode: scene.phoneMode,\n      exists: Boolean(overlay),\n      text: overlay?.textContent || '',\n      notifications: notifications.length,\n      senders: notifications.map(node => node.dataset.senderId),\n      hasAnnaAvatar: hrefs.some(href => href.includes('anna_messenger_ava.png')),\n      hasCaret: Boolean(overlay?.querySelector('.stage0j-compose-caret')),\n      dialogue: scene.text.ru\n    };\n    invalidateRuntimeSession('0j-phone-compose-done');\n    return snapshot;\n  } finally {\n    typeText = originalTypeText;\n    playSound = originalPlaySound;\n    playMusic = originalPlayMusic;\n  }\n});\nassert(result.phoneMode === 'compose' && result.exists, 'Compose phone overlay did not render', JSON.stringify(result));\nassert(result.hasAnnaAvatar && result.hasCaret && result.notifications === 3, 'Compose overlay lost Anna avatar/caret/notifications', JSON.stringify(result));\nassert(result.senders.join(',') === 'lyosha,mark,sergey', 'Compose notification senders drifted from final choices', JSON.stringify(result));\nassert(!result.text.includes('Пальцы замерли') && !result.text.includes('My fingers hovered'), 'Phone overlay duplicates narration text', JSON.stringify(result));\nassert(!result.dialogue.includes('Катя в WhatsApp'), 'Scene narration still contains stale Katya branch that is not selectable', JSON.stringify(result));\nresults.phoneOverlay = true;\n'''

    if '// 8. Chapter 2 / scene 1 uses the compose overlay' not in text:
        text = replace_once(text, old_phone_block, new_phone_block, 'runtime smoke phone block')

    marker = "results.typewriter = true;\n\nconsole.log(JSON.stringify({ status: 'PASS', ...results }, null, 2));"
    atomic_test = '''results.typewriter = true;\n\n// 11. Visual swap is atomic: old scene remains visible while replacement images decode, then all visual slots commit together.\nresult = await page.evaluate(async () => {\n  const generation = beginRuntimeSession('0j-atomic-render');\n  resetGameState(false);\n  const bg = document.getElementById('background');\n  const left = document.getElementById('character-left');\n  const right = document.getElementById('character-right');\n  bg.style.backgroundImage = 'url("old-bg")';\n  left.style.backgroundImage = 'url("old-left")';\n  right.style.backgroundImage = 'url("old-right")';\n\n  const originalDecode = window.stage0jDecodeImage;\n  const resolvers = [];\n  window.stage0jDecodeImage = () => new Promise(resolve => resolvers.push(resolve));\n  const scene = {\n    id: 999,\n    background: 'bg_apartment_morning',\n    characterLeft: 'anna_thoughtful_style2',\n    characterRight: 'lyosha_happy_style1',\n    speaker: { ru: 'Анна', en: 'Anna' }\n  };\n\n  const renderPromise = window.stage0jRenderSceneVisuals(scene, 'ru', stats, generation);\n  await new Promise(resolve => window.setTimeout(resolve, 30));\n  const before = { bg: bg.style.backgroundImage, left: left.style.backgroundImage, right: right.style.backgroundImage };\n  resolvers.splice(0).forEach(resolve => resolve(true));\n  const ok = await renderPromise;\n  const after = { bg: bg.style.backgroundImage, left: left.style.backgroundImage, right: right.style.backgroundImage };\n  window.stage0jDecodeImage = originalDecode;\n  invalidateRuntimeSession('0j-atomic-render-done');\n  return { ok, before, after };\n});\nassert(result.before.bg.includes('old-bg') && result.before.left.includes('old-left') && result.before.right.includes('old-right'), 'Renderer cleared old scene before replacement decoded', JSON.stringify(result));\nassert(result.ok && result.after.bg.includes('bg_apartment_morning.png') && result.after.left.includes('anna_thoughtful_style2.png') && result.after.right.includes('lyosha_happy_style1.png'), 'Atomic visual commit did not install complete new scene', JSON.stringify(result));\nresults.atomicVisualSwap = true;\n\nconsole.log(JSON.stringify({ status: 'PASS', ...results }, null, 2));'''
    if '// 11. Visual swap is atomic' not in text:
        text = replace_once(text, marker, atomic_test, 'runtime smoke atomic test')

    wait_old = "  typeof stage0iEndingEligible === 'function'\n);"
    wait_new = "  typeof stage0iEndingEligible === 'function' &&\n  typeof stage0jRenderSceneVisuals === 'function' &&\n  typeof stage0jShowComposeOverlay === 'function'\n);"
    if "typeof stage0jRenderSceneVisuals" not in text:
        text = replace_once(text, wait_old, wait_new, 'runtime smoke stage0j readiness')

    path.write_text(text, encoding='utf-8')


def main():
    patch_html()
    patch_chapter2()
    patch_smoke()
    print('Stage 0J migration applied')


if __name__ == '__main__':
    main()
