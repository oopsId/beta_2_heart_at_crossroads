#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path('.')
HTML = ROOT / 'heart_at_crossroads.html'


def scene_spans(raw: str):
    marker = '"scenes"'
    p = raw.index(marker)
    p = raw.index('[', p) + 1
    spans = []
    depth = 0
    start = None
    in_string = False
    escaped = False
    i = p
    while i < len(raw):
        ch = raw[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
        elif ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                spans.append((start, i + 1))
                start = None
        elif ch == ']' and depth == 0:
            break
        i += 1
    return spans


def migrate_timed_json(path: Path):
    raw = path.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    replacements = []
    migrated = []
    chapter = json.loads(raw)['chapter']

    for start, end in scene_spans(raw):
        scene = json.loads(raw[start:end])
        timed = [c for c in scene.get('choices', []) if c.get('timer') is not None]
        if not timed:
            continue

        durations = {c.get('timer') for c in timed}
        if len(durations) != 1:
            raise SystemExit(f'{path} scene {scene.get("id")}: inconsistent timer durations {durations}')
        seconds = durations.pop()
        if not isinstance(seconds, (int, float)) or seconds <= 0:
            raise SystemExit(f'{path} scene {scene.get("id")}: invalid timeout duration {seconds}')

        for choice in scene.get('choices', []):
            choice.pop('timer', None)
        scene.pop('timer', None)

        ignore = next((c for c in scene.get('choices', []) if c.get('id') == 'ignore'), None)
        if ignore:
            scene['timeout'] = {'seconds': seconds, 'choiceId': 'ignore'}
            mode = 'choice:ignore'
        elif chapter == 2 and scene.get('id') == 1:
            # Existing content converges scenes 2/3/4 into scene 5. On timeout Anna
            # sends none of the three replies and reaches the common continuation
            # without relationship/stat effects. No new narrative text is invented.
            scene['timeout'] = {
                'seconds': seconds,
                'outcome': {
                    'id': 'no_reply',
                    'nextScene': 5
                }
            }
            mode = 'outcome:no_reply->5'
        else:
            raise SystemExit(f'{path} scene {scene.get("id")}: timed scene has no explicit timeout outcome')

        formatted = json.dumps(scene, ensure_ascii=False, indent=4)
        formatted = formatted.replace('\n', newline + '        ')
        replacements.append((start, end, formatted))
        migrated.append((scene.get('id'), seconds, mode))

    for start, end, formatted in reversed(replacements):
        raw = raw[:start] + formatted + raw[end:]

    if replacements:
        path.write_bytes(raw.encode('utf-8'))
    return migrated


helper_block = r'''    // Stage 0E: timeout behavior is explicit story data, never a magic choice id.
    function getTimeoutConfig(scene) {
        const timeout = scene?.timeout;
        if (timeout === undefined || timeout === null) return null;
        if (typeof timeout !== 'object' || Array.isArray(timeout)) {
            throw new Error(`Scene ${scene?.id}: invalid timeout config`);
        }

        const seconds = Number(timeout.seconds);
        if (!Number.isFinite(seconds) || seconds <= 0) {
            throw new Error(`Scene ${scene?.id}: timeout.seconds must be positive`);
        }

        if (typeof timeout.choiceId === 'string' && timeout.choiceId) {
            const exists = Array.isArray(scene.choices) && scene.choices.some(choice => choice.id === timeout.choiceId);
            if (!exists) throw new Error(`Scene ${scene?.id}: timeout choice ${timeout.choiceId} not found`);
            return { seconds, choiceId: timeout.choiceId };
        }

        if (timeout.outcome && typeof timeout.outcome === 'object' && typeof timeout.outcome.id === 'string') {
            const outcome = timeout.outcome;
            const hasRoute = Number.isInteger(outcome.nextScene)
                || Number.isInteger(outcome.nextChapter)
                || outcome.nextChapter === true
                || typeof outcome.leadsToEnding === 'string';
            if (!hasRoute) throw new Error(`Scene ${scene?.id}: timeout outcome has no route`);
            return { seconds, outcome };
        }

        throw new Error(`Scene ${scene?.id}: timeout requires choiceId or outcome`);
    }

    async function applyTimeoutOutcome(scene, timeoutConfig, options = {}) {
        if (timeoutConfig.choiceId) {
            const choice = scene.choices.find(candidate => candidate.id === timeoutConfig.choiceId);
            return await applyChoice(choice, options);
        }

        const outcome = timeoutConfig.outcome;
        return await applyChoice({
            id: outcome.id,
            nextScene: outcome.nextScene,
            nextChapter: outcome.nextChapter,
            leadsToEnding: outcome.leadsToEnding,
            effects: outcome.effects,
            memoryTag: outcome.memoryTag
        }, options);
    }

'''

show_timed = r'''    function showSceneWithTimer(scene) {
    console.log(`[showSceneWithTimer] Показ сцены ${scene.id} с явным timeout outcome`);

    const timeoutConfig = getTimeoutConfig(scene);
    const dialogueElement = document.getElementById('dialogue-text');
    const dialogueBox = document.querySelector('.dialogue-box');
    updateProgress(scene.id, scriptData.scenes.length);

    let displayText = scene.text[stats.language];
    if (stats.completionCount >= 1 && scene.second_playthrough_text) {
        displayText = scene.second_playthrough_text[stats.language];
    }

    const newBackground = scene.background || 'none';
    const lastScene = scriptData.scenes[scriptData.scenes.length - 1];
    const shouldFade = currentBackground !== newBackground || lastScene?.id === scene.id;

    const applyScene = async () => {
        currentBackground = await setupBackground(newBackground, stats.language);
        await setupCharacters(scene, stats.language, stats);

        const charLeft = document.getElementById('character-left');
        const charRight = document.getElementById('character-right');
        if (scene.characterLeftOffset) charLeft.style.left = scene.characterLeftOffset;
        if (scene.characterRightOffset) charRight.style.right = scene.characterRightOffset;

        clearDialogueHandlers(dialogueBox);
        dialogueBox.style.pointerEvents = 'none';

        const overlay = scene.phone === 1 ? showMessengerOverlay(scene.id) : null;

        if (scene.sound) playSound(scene.sound);
        if (scene.music) playMusic(scene.music);

        typeText(displayText, dialogueElement, () => {
            dialogueBox.style.pointerEvents = 'auto';

            let timer = null;
            let countdownInterval = null;
            let tickSound = null;

            const cleanupTimer = () => {
                if (countdownInterval) clearInterval(countdownInterval);
                if (timer) clearTimeout(timer);
                countdownInterval = null;
                timer = null;
                document.getElementById('timer-countdown')?.remove();
                if (tickSound) {
                    tickSound.pause();
                    tickSound.currentTime = 0;
                }
            };

            scene.choices.forEach(choice => {
                const btn = createChoiceButton(choice);
                if (choice.condition && !checkCondition(choice.condition)) {
                    btn.style.display = 'none';
                } else if (choice.cost && stats.diamonds < choice.cost) {
                    btn.disabled = true;
                } else {
                    const handleChoice = async (e) => {
                        e.preventDefault();
                        await applyChoice(choice, { overlay, cleanup: cleanupTimer });
                    };
                    btn.addEventListener('touchstart', handleChoice, { passive: false });
                    btn.addEventListener('click', handleChoice);
                }
                dialogueBox.appendChild(btn);
            });

            const timerDuration = timeoutConfig.seconds * 1000;
            let timeLeft = Math.ceil(timeoutConfig.seconds);

            const countdownElement = document.createElement('div');
            countdownElement.id = 'timer-countdown';
            countdownElement.textContent = timeLeft;
            document.getElementById('game-container').appendChild(countdownElement);

            tickSound = new Audio('assets/sounds/sfx_tick.mp3');
            tickSound.loop = false;
            tickSound.play().catch(err => console.warn('Ошибка воспроизведения sfx_tick:', err));

            countdownInterval = setInterval(() => {
                timeLeft = Math.max(0, timeLeft - 1);
                countdownElement.textContent = timeLeft;
                if (overlay) {
                    overlay.classList.add('flash-svg');
                    setTimeout(() => overlay?.classList.remove('flash-svg'), 500);
                }
                if ('vibrate' in navigator) navigator.vibrate(200);
                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    tickSound?.pause();
                }
            }, 1000);

            timer = setTimeout(async () => {
                console.log(`[showSceneWithTimer] Таймер сцены ${scene.id} истёк`);
                await applyTimeoutOutcome(scene, timeoutConfig, { overlay, cleanup: cleanupTimer });
            }, timerDuration);
        });

        return true;
    };

    if (shouldFade) {
        fadeOut(() => {
            applyScene();
            fadeIn();
        });
        return true;
    }

    applyScene();
    return true;
}

'''


def migrate_html():
    raw = HTML.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'

    old = 'let buttonText = choice.text[stats.language].replace(" (10 сек)", "").replace(" (10 sec)", "");'
    new = "let buttonText = choice.text[stats.language].replace(/\\s*\\(\\d+(?:[.,]\\d+)?\\s*(?:сек|sec)\\)/i, '').trim();"
    if old not in raw:
        raise SystemExit('createChoiceButton timer-text pattern not found')
    raw = raw.replace(old, new, 1)

    ordinary = "if (scene.choices.some(c => c.timer)) {"
    if ordinary not in raw:
        raise SystemExit('handleChoices timed detection not found')
    raw = raw.replace(ordinary, "if (getTimeoutConfig(scene)) {", 1)

    show_detect = "const hasTimedChoices = Array.isArray(scene.choices) && scene.choices.some(c => c.timer);"
    if show_detect not in raw:
        raise SystemExit('showScene timed detection not found')
    raw = raw.replace(show_detect, "const hasTimedChoices = getTimeoutConfig(scene) !== null;", 1)

    show_marker = '    async function showScene(sceneId) {'
    if show_marker not in raw:
        raise SystemExit('showScene marker not found')
    helper = helper_block.replace('\n', newline)
    raw = raw.replace(show_marker, helper + show_marker, 1)

    start_marker = '    function showSceneWithTimer(scene, timeoutMs = 10000) {'
    start = raw.find(start_marker)
    if start < 0:
        raise SystemExit('old showSceneWithTimer marker not found')
    end_marker = '        function showPremiumGallery() {'
    end = raw.find(end_marker, start)
    if end < 0:
        raise SystemExit('showPremiumGallery marker not found')
    replacement = show_timed.replace('\n', newline)
    raw = raw[:start] + replacement + raw[end:]

    forbidden = [
        "find(c => c.id === 'ignore')",
        '.some(c => c.timer)',
        'timeoutMs = 10000'
    ]
    for token in forbidden:
        if token in raw:
            raise SystemExit(f'legacy timed-choice token remains: {token}')

    HTML.write_bytes(raw.encode('utf-8'))


changed = []
for chapter_path in sorted((ROOT / 'assets/data').glob('chapter*.json')):
    migrated = migrate_timed_json(chapter_path)
    if migrated:
        changed.append((str(chapter_path), migrated))

migrate_html()
print('Stage 0E applied')
for path, scenes in changed:
    print(path, scenes)
