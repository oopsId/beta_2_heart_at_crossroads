#!/usr/bin/env python3
from pathlib import Path
import re
import sys

path = Path('heart_at_crossroads.html')
raw = path.read_bytes().decode('utf-8')
text = raw.replace('\r\n', '\n')


def sub(pattern, replacement, count=1, flags=re.S):
    global text
    text, n = re.subn(pattern, replacement, text, count=count, flags=flags)
    if n != count:
        raise SystemExit(f'Expected {count} replacement(s), got {n}: {pattern[:120]}')

# Fail closed when a chapter cannot be loaded during start/resume.
sub(
    r"                await preloadAssets\(currentChapter\);\n                await loadChapter\(currentChapter\);",
    """                await preloadAssets(currentChapter);
                const chapterLoaded = await loadChapter(currentChapter);
                if (!chapterLoaded) {
                    loadingOverlay.remove();
                    return;
                }"""
)

# Replace choice mutation with an awaitable primitive and add the Stage 0D transition engine.
sub(
    r"        function saveChoice\(choiceId, effects, memoryTag\) \{.*?\n   \}\n\n            // Обновление прогресс-бара",
    r'''        async function saveChoice(choiceId, effects, memoryTag, options = {}) {
        choices.push(choiceId);

        if (effects) {
            for (const [key, delta] of Object.entries(effects)) {
                if (key === 'relationships' && typeof delta === 'object' && delta !== null) {
                    for (const [rel, relDelta] of Object.entries(delta)) {
                        stats.relationships[rel] = (stats.relationships[rel] || 0) + relDelta;
                    }
                } else if (key.startsWith('relationships.')) {
                    const rel = key.split('.')[1];
                    stats.relationships[rel] = (stats.relationships[rel] || 0) + delta;
                } else {
                    stats[key] = (stats[key] || 0) + delta;
                }
            }
        }

        if (memoryTag) {
            stats.memories.push(memoryTag);
            const notification = document.createElement('div');
            notification.className = 'memory-notification';
            notification.textContent = stats.language === "ru"
                ? "Вика запомнит ваш выбор"
                : "Vika will remember your choice";
            document.getElementById('game-container').appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }

        if (options.persist !== false) {
            await saveSession();
        }
    }

    // Stage 0D: one transition engine for scene, chapter and ending routes.
    const ENDING_ID_MAP = Object.freeze({
        "Свобода с Димой": "freedom_with_dima",
        "Тишина с Марком": "silence_with_mark",
        "Вершина с Сергеем": "summit_with_sergey",
        "Дружба превыше всего": "friendship_above_all",
        "Одинокий путь": "lonely_path",
        "Новый старт": "new_start"
    });

    function resolveEndingId(endingId) {
        return ENDING_ID_MAP[endingId] || endingId;
    }

    function resolveChoiceTransition(choice) {
        const hasNextScene = Object.prototype.hasOwnProperty.call(choice, 'nextScene');

        if (Number.isInteger(choice.nextScene)) {
            return { type: 'scene', sceneId: choice.nextScene, reason: 'choice-next-scene' };
        }

        if (Number.isInteger(choice.nextChapter)) {
            return { type: 'chapter', chapterId: choice.nextChapter, reason: 'choice-next-chapter' };
        }

        if (choice.nextChapter === true) {
            return { type: 'chapter', chapterId: currentChapter + 1, reason: 'choice-next-chapter' };
        }

        if (choice.leadsToEnding) {
            return { type: 'ending', endingId: resolveEndingId(choice.leadsToEnding), reason: 'choice-ending' };
        }

        if (hasNextScene && choice.nextScene === null) {
            return { type: 'chapter', chapterId: currentChapter + 1, reason: 'choice-terminal-null' };
        }

        return { type: 'none', reason: 'choice-no-route' };
    }

    function resolveSceneTransition(scene) {
        const hasNextScene = Object.prototype.hasOwnProperty.call(scene, 'nextScene');
        const explicitEnding = scene.leadsToEnding ? resolveEndingId(scene.leadsToEnding) : null;
        const pendingEnding = window.pendingEndingId ? resolveEndingId(window.pendingEndingId) : null;

        if (Number.isInteger(scene.nextScene)) {
            return { type: 'scene', sceneId: scene.nextScene, reason: 'scene-next-scene' };
        }

        if (Number.isInteger(scene.nextChapter)) {
            return { type: 'chapter', chapterId: scene.nextChapter, reason: 'scene-next-chapter' };
        }

        if (scene.nextChapter === true) {
            return { type: 'chapter', chapterId: currentChapter + 1, reason: 'scene-next-chapter' };
        }

        if (explicitEnding) {
            return { type: 'ending', endingId: explicitEnding, reason: 'scene-ending' };
        }

        // A selected final route may currently live in pendingEndingId until Stage 0F
        // moves ending ownership into validated/persisted story state.
        if (pendingEnding && (!hasNextScene || scene.nextScene === null)) {
            return { type: 'ending', endingId: pendingEnding, reason: 'pending-ending' };
        }

        // Explicit null is a terminal branch marker. Never fall through to id + 1.
        if (hasNextScene && scene.nextScene === null) {
            return { type: 'chapter', chapterId: currentChapter + 1, reason: 'terminal-null' };
        }

        const chapterScenes = Array.isArray(scriptData?.scenes) ? scriptData.scenes : [];
        const lastScene = chapterScenes[chapterScenes.length - 1];
        if (lastScene && lastScene.id === scene.id) {
            return { type: 'chapter', chapterId: currentChapter + 1, reason: 'chapter-last-scene' };
        }

        // Legacy compatibility only: if nextScene is omitted, an existing id+1 scene
        // may still be used. Explicit null never reaches this branch.
        if (!hasNextScene) {
            const implicitNext = chapterScenes.find(candidate => candidate.id === scene.id + 1);
            if (implicitNext) {
                return { type: 'scene', sceneId: implicitNext.id, reason: 'legacy-implicit-next' };
            }
        }

        return { type: 'none', reason: 'scene-no-route' };
    }

    let transitionInFlight = false;
    let choiceCommitInFlight = false;

    async function transitionTo(target, options = {}) {
        if (!target || target.type === 'none') {
            console.warn('[transitionTo] Нет маршрута перехода:', target);
            return false;
        }
        if (transitionInFlight) {
            console.warn('[transitionTo] Переход уже выполняется, повтор проигнорирован');
            return false;
        }

        transitionInFlight = true;
        const previousChapter = currentChapter;
        const previousScene = currentScene;

        try {
            if (options.overlay) options.overlay.remove();

            if (target.type === 'scene') {
                currentScene = target.sceneId;
                await saveSession();
                await showScene(currentScene);
                return true;
            }

            if (target.type === 'chapter') {
                currentChapter = target.chapterId ?? (currentChapter + 1);
                currentScene = 0;
                const loaded = await loadChapter(currentChapter);
                if (!loaded) {
                    currentChapter = previousChapter;
                    currentScene = previousScene;
                    return false;
                }
                await saveSession();
                await showScene(currentScene);
                return true;
            }

            if (target.type === 'ending') {
                const endingId = resolveEndingId(target.endingId);
                window.pendingEndingId = null;
                await saveSession();
                await loadFinals(endingId);
                return true;
            }

            console.error('[transitionTo] Неизвестный тип перехода:', target);
            return false;
        } finally {
            transitionInFlight = false;
        }
    }

    async function applyChoice(choice, options = {}) {
        if (!choice || choiceCommitInFlight) return false;
        if (choice.condition && !checkCondition(choice.condition)) return false;
        if (choice.cost && stats.diamonds < choice.cost) return false;

        choiceCommitInFlight = true;
        try {
            if (choice.cost) stats.diamonds -= choice.cost;
            updateDiamondsDisplay();

            if (choice.leadsToEnding) {
                window.pendingEndingId = resolveEndingId(choice.leadsToEnding);
            } else {
                window.pendingEndingId = null;
            }

            await saveChoice(choice.id, choice.effects, choice.memoryTag, { persist: false });
            if (choice.effects) showChoiceEffects(choice.effects);

            if (typeof options.cleanup === 'function') options.cleanup();
            if (options.overlay) options.overlay.remove();
            document.querySelectorAll('.choice-btn').forEach(btn => btn.remove());

            const target = resolveChoiceTransition(choice);
            if (target.type === 'none') {
                await saveSession();
                return true;
            }

            return await transitionTo(target);
        } finally {
            choiceCommitInFlight = false;
        }
    }

            // Обновление прогресс-бара'''
)

# Replace the duplicated ordinary-choice/next-scene routing with applyChoice + transitionTo.
sub(
    r"  // Обработка выбора\n   function handleChoices\(scene, dialogueBox, overlay\) \{.*?\n}\t\n   \n    async function showScene",
    r'''  // Обработка выбора
   function handleChoices(scene, dialogueBox, overlay) {
    dialogueBox.style.pointerEvents = 'auto';
    if (!scene.choices || scene.choices.length === 0) return;

    console.log(`[handleChoices] Обработка выбора для сцены ${scene.id}`);

    if (scene.choices.some(c => c.timer)) {
        showSceneWithTimer(scene);
        return;
    }

    scene.choices.forEach(choice => {
        const btn = createChoiceButton(choice);

        if (choice.condition && !checkCondition(choice.condition)) {
            btn.style.display = 'none';
        } else if (choice.cost && stats.diamonds < choice.cost) {
            btn.disabled = true;
        } else {
            const handleChoice = async (e) => {
                e.preventDefault();
                await applyChoice(choice, { overlay });
            };
            btn.addEventListener('touchstart', handleChoice, { passive: false });
            btn.addEventListener('click', handleChoice);
        }

        dialogueBox.appendChild(btn);
    });
   }

   function bindTransitionHandler(dialogueBox, target, overlay) {
    if (!dialogueBox || !target || target.type === 'none') {
        console.warn('[bindTransitionHandler] Нет доступного перехода:', target);
        return;
    }

    if (dialogueBox.touchHandler) {
        dialogueBox.removeEventListener('touchstart', dialogueBox.touchHandler, { passive: false });
        dialogueBox.removeEventListener('click', dialogueBox.touchHandler);
    }

    const handleNext = async (e) => {
        e.preventDefault();
        dialogueBox.style.pointerEvents = 'none';
        dialogueBox.removeEventListener('touchstart', handleNext, { passive: false });
        dialogueBox.removeEventListener('click', handleNext);
        dialogueBox.touchHandler = null;
        await transitionTo(target, { overlay });
    };

    dialogueBox.touchHandler = handleNext;
    dialogueBox.addEventListener('touchstart', handleNext, { passive: false });
    dialogueBox.addEventListener('click', handleNext);
    dialogueBox.style.pointerEvents = 'auto';
   }
   
    async function showScene'''
)

# Rewrite ordinary scene routing around resolveSceneTransition().
sub(
    r"    async function showScene\(sceneId\) \{.*?\n}\n\n    function showSceneWithTimer",
    r'''    async function showScene(sceneId) {
    console.log(`Показ сцены ${sceneId}`);
    const scene = scriptData?.scenes?.find(s => s.id === sceneId);

    if (!scene) {
        console.error('Сцена не найдена:', sceneId);
        showErrorMessage(stats.language === "ru" ? `Сцена ${sceneId} не найдена` : `Scene ${sceneId} not found`);
        return false;
    }

    const hasTimedChoices = Array.isArray(scene.choices) && scene.choices.some(c => c.timer);
    if (hasTimedChoices) {
        return showSceneWithTimer(scene);
    }

    updateProgress(sceneId, scriptData.scenes.length);

    const dialogueBox = document.querySelector('.dialogue-box');
    const dialogueElement = document.getElementById('dialogue-text');

    let displayText = scene.text[stats.language];
    if (stats.completionCount >= 1 && scene.second_playthrough_text) {
        displayText = scene.second_playthrough_text[stats.language];
    }

    const newBackground = scene.background || 'none';
    const lastScene = scriptData.scenes[scriptData.scenes.length - 1];
    const shouldFade = currentBackground !== newBackground || lastScene?.id === sceneId;

    const applyScene = async () => {
        currentBackground = await setupBackground(newBackground, stats.language);
        await setupCharacters(scene, stats.language, stats);

        clearDialogueHandlers(dialogueBox);
        dialogueBox.style.pointerEvents = 'none';

        const overlay = createOverlayIfNeeded(sceneId, displayText, false);

        if (scene.sound) playSound(scene.sound);
        if (scene.music) {
            playMusic(scene.music);
        } else if (window.currentMusic) {
            window.currentMusic.pause();
            window.currentMusic.currentTime = 0;
            window.currentMusic = null;
        }

        typeText(displayText, dialogueElement, async () => {
            try {
                dialogueBox.style.pointerEvents = 'auto';

                if (scene.choices && scene.choices.length > 0) {
                    handleChoices(scene, dialogueBox, overlay);
                    return;
                }

                const target = resolveSceneTransition(scene);
                console.log('[showScene] resolved transition:', target);

                if (target.type === 'none') {
                    console.warn(`[showScene] Сцена ${scene.id} не имеет маршрута выхода`);
                    return;
                }

                // Preserve the legacy pacing of the numeric last scene: chapter advance
                // happens immediately after its text finishes. Other terminal branches wait for tap.
                if (target.type === 'chapter' && lastScene?.id === scene.id) {
                    await transitionTo(target, { overlay });
                    return;
                }

                bindTransitionHandler(dialogueBox, target, overlay);
            } catch (err) {
                console.error('[showScene callback] crash:', err);
            }
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

    await applyScene();
    return true;
}

    function showSceneWithTimer'''
)

# Rewrite timed choices so manual and default choices use the same applyChoice() path.
sub(
    r"    function showSceneWithTimer\(scene, timeoutMs = 10000\) \{.*?\n}\n\n        function showPremiumGallery",
    r'''    function showSceneWithTimer(scene, timeoutMs = 10000) {
    console.log(`[showSceneWithTimer] Показ сцены ${scene.id} с таймером`);

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

        let overlay = null;
        if (scene.choices && scene.choices.some(c => c.timer)) {
            overlay = showMessengerOverlay(scene.id);
        }

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
                document.getElementById('timer-countdown')?.remove();
                if (tickSound) tickSound.pause();
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

            const timerDuration = scene.choices.find(c => c.timer)?.timer * 1000 || timeoutMs;
            let timeLeft = timerDuration / 1000;

            const countdownElement = document.createElement('div');
            countdownElement.id = 'timer-countdown';
            countdownElement.textContent = timeLeft;
            document.getElementById('game-container').appendChild(countdownElement);

            tickSound = new Audio('assets/sounds/sfx_tick.mp3');
            tickSound.loop = false;
            tickSound.play().catch(err => console.warn('Ошибка воспроизведения sfx_tick:', err));

            countdownInterval = setInterval(() => {
                timeLeft--;
                countdownElement.textContent = Math.max(0, timeLeft);
                if (overlay) {
                    overlay.classList.add('flash-svg');
                    setTimeout(() => overlay?.classList.remove('flash-svg'), 500);
                }
                if ('vibrate' in navigator) navigator.vibrate(200);
                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
                    tickSound?.pause();
                }
            }, 1000);

            timer = setTimeout(async () => {
                const defaultChoice = scene.choices.find(c => c.id === 'ignore');
                console.log(`[showSceneWithTimer] Таймер истёк, default=${defaultChoice?.id || 'не найден'}`);

                if (defaultChoice) {
                    await applyChoice(defaultChoice, { overlay, cleanup: cleanupTimer });
                    return;
                }

                cleanupTimer();
                if (lastScene?.id === scene.id) {
                    await transitionTo({ type: 'chapter', chapterId: currentChapter + 1, reason: 'legacy-timer-last-scene' }, { overlay });
                } else {
                    console.warn('Нет явно определённого исхода таймера; Stage 0E должен описать timeout outcome');
                }
            }, timerDuration);
        });
    };

    if (shouldFade) {
        fadeOut(() => {
            applyScene();
            fadeIn();
        });
    } else {
        applyScene();
    }
}

        function showPremiumGallery'''
)

# Stage 0D invariants.
for forbidden in [
    'fallback переход к сцене',
    'const handleFallbackNext',
    'function handleNextScene(',
]:
    if forbidden in text:
        raise SystemExit(f'Forbidden legacy transition token remains: {forbidden}')

required = [
    'function resolveSceneTransition(scene)',
    'function resolveChoiceTransition(choice)',
    'async function transitionTo(target, options = {})',
    'async function applyChoice(choice, options = {})',
    "scene.nextScene === null",
    "reason: 'terminal-null'",
    "reason: 'legacy-implicit-next'",
    'await applyChoice(choice, { overlay',
    'const chapterLoaded = await loadChapter(currentChapter);',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Required Stage 0D token missing: {token}')

if text.count('function resolveEndingId(') != 1:
    raise SystemExit(f'Expected exactly one resolveEndingId, got {text.count("function resolveEndingId(")}')

out = text.replace('\n', '\r\n')
if out == raw:
    print('Stage 0D already applied')
    sys.exit(0)
path.write_bytes(out.encode('utf-8'))
print('Stage 0D applied')
