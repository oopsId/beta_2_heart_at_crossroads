#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

HEADER = {
    "header": {"ru": "Анна", "en": "Anna"},
    "avatar": "assets/characters/anna/anna_messenger_ava.png",
    "inputPlaceholder": {"ru": "Сообщение", "en": "Message"},
}

CONFIGS = {
    ("assets/data/chapter1.json", 7): [
        ("lyosha", "Лёша", "Lyosha", "Тусим вечером, Дима будет. Приходи!", "Party tonight, Dima will be there. Come!", "assets/characters/lyosha/lyosha_messenger_ava.png"),
    ],
    ("assets/data/chapter1.json", 21): [
        ("mark", "Марк", "Mark", "Ты красивая, когда теряешься.", "You're beautiful when you're lost.", "assets/characters/mark/mark_messenger_ava.png"),
    ],
    ("assets/data/chapter3.json", 1): [
        ("mark", "Марк", "Mark", "Ты как?", "You okay?", "assets/characters/mark/mark_messenger_ava.png"),
        ("sergey", "Сергей", "Sergey", "Жду в офисе сегодня.", "Waiting at the office today.", "assets/characters/sergey/sergey_messenger_ava.png"),
    ],
    ("assets/data/chapter3.json", 10): [
        ("mark", "Марк", "Mark", "Ты как после вчера?", "How are you after yesterday?", "assets/characters/mark/mark_messenger_ava.png"),
    ],
    ("assets/data/chapter6.json", 6): [
        ("mark", "Марк", "Mark", "Ты в офисе? Что-то странное творится.", "You at the office? Something weird's going on.", "assets/characters/mark/mark_messenger_ava.png"),
        ("dima", "Дима", "Dima", "Вечеринка сегодня, приходи!", "Party tonight, come!", "assets/characters/dima/dima_messenger_ava.png"),
    ],
}


def newline_for(text):
    return "\r\n" if "\r\n" in text else "\n"


def overlay_block(notifications, nl):
    lines = [
        '"phoneMode": "compose",',
        '            "phoneOverlay": {',
        '                "header": {',
        '                    "ru": "Анна",',
        '                    "en": "Anna"',
        '                },',
        '                "avatar": "assets/characters/anna/anna_messenger_ava.png",',
        '                "inputPlaceholder": {',
        '                    "ru": "Сообщение",',
        '                    "en": "Message"',
        '                },',
        '                "notifications": ['
    ]
    for index, (sender_id, ru_sender, en_sender, ru_msg, en_msg, avatar) in enumerate(notifications):
        comma = ',' if index < len(notifications) - 1 else ''
        lines += [
            '                    {',
            f'                        "senderId": "{sender_id}",',
            '                        "sender": {',
            f'                            "ru": "{ru_sender}",',
            f'                            "en": "{en_sender}"',
            '                        },',
            '                        "message": {',
            f'                            "ru": "{ru_msg}",',
            f'                            "en": "{en_msg}"',
            '                        },',
            f'                        "avatar": "{avatar}"',
            f'                    }}{comma}'
        ]
    lines += [
        '                ]',
        '            }'
    ]
    return nl.join(lines)


def patch_scene(path_str, scene_id, notifications):
    path = ROOT / path_str
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    nl = newline_for(text)
    scene_marker = f'            "id": {scene_id},'
    start = text.find(scene_marker)
    if start < 0:
        raise RuntimeError(f'{path_str}: scene {scene_id} not found')
    next_scene = text.find(f'{nl}        {{', start + len(scene_marker))
    end = len(text) if next_scene < 0 else next_scene
    segment = text[start:end]
    old = '"phoneMode": "messenger"'
    if old not in segment:
        if '"phoneMode": "compose"' in segment and '"phoneOverlay"' in segment:
            return
        raise RuntimeError(f'{path_str}: scene {scene_id} legacy phoneMode not found')
    segment = segment.replace(old, overlay_block(notifications, nl), 1)
    text = text[:start] + segment + text[end:]
    path.write_bytes(text.encode('utf-8'))


for (path, scene_id), notifications in CONFIGS.items():
    patch_scene(path, scene_id, notifications)

# Create a real messenger avatar for Dima by cropping the existing canonical sprite.
src = ROOT / 'assets/characters/dima/dima_neutral_style1.png'
dst = ROOT / 'assets/characters/dima/dima_messenger_ava.png'
img = Image.open(src).convert('RGBA')
# Existing source is 512x512; this crop isolates the face and shoulders without regenerating art.
crop = img.crop((170, 10, 345, 185)).resize((256, 256), Image.Resampling.LANCZOS)
crop.save(dst, optimize=True)

# Extend permanent Chromium smoke: all timed phone scenes must use compose, and ch6/6 must show Mark+Dima avatars.
smoke_path = ROOT / 'tools/runtime_smoke.mjs'
smoke = smoke_path.read_text(encoding='utf-8')
marker = "results.phoneOverlay = true;\n\n// 8b. Compose phone stays on-screen on desktop and never overlaps dialogue in short landscape."
if '// 8a. All timed phone scenes use real-avatar compose overlays.' not in smoke:
    block = r'''results.phoneOverlay = true;

// 8a. All timed phone scenes use real-avatar compose overlays; legacy messenger renderer is forbidden here.
result = await page.evaluate(async () => {
  const chapters = await Promise.all([1, 2, 3, 6].map(async chapter => await (await fetch(`assets/data/chapter${chapter}.json`)).json()));
  const legacyTimed = [];
  for (const chapter of chapters) {
    for (const scene of chapter.scenes) {
      if (scene.timeout && scene.phoneMode === 'messenger') legacyTimed.push(`${chapter.chapter}/${scene.id}`);
    }
  }

  const generation = beginRuntimeSession('0l-phone-avatars');
  resetGameState(false);
  currentChapter = 6;
  scriptData = chapters.find(chapter => chapter.chapter === 6);
  const scene = scriptData.scenes.find(candidate => candidate.id === 6);
  const overlay = stage0jShowComposeOverlay(scene, generation);
  await new Promise(resolve => window.setTimeout(resolve, 80));
  const notifications = overlay ? [...overlay.querySelectorAll('.stage0j-notification')] : [];
  const imageSources = overlay ? [...overlay.querySelectorAll('.stage0j-notification-avatar')].map(image => image.getAttribute('src') || '') : [];
  const fallbacks = overlay ? overlay.querySelectorAll('.stage0j-notification-initial').length : -1;
  const dimaDecoded = await stage0jDecodeImage('assets/characters/dima/dima_messenger_ava.png');
  const snapshot = {
    legacyTimed,
    phoneMode: scene.phoneMode,
    senders: notifications.map(node => node.dataset.senderId),
    imageSources,
    fallbacks,
    dimaDecoded
  };
  overlay?.remove();
  invalidateRuntimeSession('0l-phone-avatars-done');
  return snapshot;
});
assert(result.legacyTimed.length === 0, 'Timed scene still uses legacy messenger overlay', JSON.stringify(result));
assert(result.phoneMode === 'compose' && result.senders.join(',') === 'mark,dima', 'Chapter 6 scene 6 did not migrate to Mark+Dima compose notifications', JSON.stringify(result));
assert(result.imageSources.some(src => src.includes('mark_messenger_ava.png')) && result.imageSources.some(src => src.includes('dima_messenger_ava.png')), 'Chapter 6 scene 6 is missing real Mark/Dima avatars', JSON.stringify(result));
assert(result.fallbacks === 0 && result.dimaDecoded === true, 'Compose notification fell back to an initial or Dima avatar failed to decode', JSON.stringify(result));
results.phoneAvatars = true;

// 8b. Compose phone stays on-screen on desktop and never overlaps dialogue in short landscape.'''
    if marker not in smoke:
        raise RuntimeError('runtime smoke marker not found')
    smoke = smoke.replace(marker, block, 1)
    smoke_path.write_text(smoke, encoding='utf-8')

print('Stage 0L patch applied')
