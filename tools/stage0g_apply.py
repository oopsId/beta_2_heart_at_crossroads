#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'heart_at_crossroads.html'
raw = HTML.read_bytes().decode('utf-8')
NL = '\r\n' if '\r\n' in raw else '\n'

if 'Stage 0G: runtime lifecycle generation/cancellation.' in raw:
    print('Stage 0G already applied')
    raise SystemExit(0)


def n(text: str) -> str:
    return text.replace('\n', NL)


def replace_once(old: str, new: str, label: str):
    global raw
    old_n = n(old)
    if raw.count(old_n) != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {raw.count(old_n)}')
    raw = raw.replace(old_n, n(new), 1)


def replace_between(start: str, end: str, replacement: str, label: str):
    global raw
    start_n, end_n = n(start), n(end)
    i = raw.find(start_n)
    if i < 0:
        raise SystemExit(f'{label}: start marker not found')
    j = raw.find(end_n, i)
    if j < 0:
        raise SystemExit(f'{label}: end marker not found')
    raw = raw[:i] + n(replacement) + raw[j:]


# 1) Lifecycle manager after core globals.
replace_once(
'''        const tempPassword = "999000";
''',
'''        const tempPassword = "999000";

        // Stage 0G: runtime lifecycle generation/cancellation.
        // Every playthrough owns one generation. Menu invalidates it synchronously,
        // so old timers, async callbacks, overlays and audio can never mutate a later/reset run.
        let runtimeGeneration = 0;
        let runtimeActive = false;
        const runtimeTimeouts = new Set();
        const runtimeIntervals = new Set();
        const runtimeAudios = new Set();

        function isRuntimeGenerationCurrent(generation) {
            return generation === runtimeGeneration;
        }

        function isRunCurrent(generation) {
            return runtimeActive && generation === runtimeGeneration;
        }

        function runtimeSetTimeout(callback, delay, generation = runtimeGeneration) {
            const timeoutId = window.setTimeout(() => {
                runtimeTimeouts.delete(timeoutId);
                if (!isRuntimeGenerationCurrent(generation)) return;
                callback();
            }, delay);
            runtimeTimeouts.add(timeoutId);
            return timeoutId;
        }

        function runtimeClearTimeout(timeoutId) {
            if (timeoutId === null || timeoutId === undefined) return;
            window.clearTimeout(timeoutId);
            runtimeTimeouts.delete(timeoutId);
        }

        function runtimeSetInterval(callback, delay, generation = runtimeGeneration) {
            const intervalId = window.setInterval(() => {
                if (!isRuntimeGenerationCurrent(generation)) return;
                callback();
            }, delay);
            runtimeIntervals.add(intervalId);
            return intervalId;
        }

        function runtimeClearInterval(intervalId) {
            if (intervalId === null || intervalId === undefined) return;
            window.clearInterval(intervalId);
            runtimeIntervals.delete(intervalId);
        }

        function registerRuntimeAudio(audio) {
            if (!audio) return null;
            runtimeAudios.add(audio);
            const forget = () => runtimeAudios.delete(audio);
            audio.addEventListener('ended', forget, { once: true });
            audio.addEventListener('error', forget, { once: true });
            return audio;
        }

        function createRuntimeAudio(src, options = {}) {
            const audio = registerRuntimeAudio(new Audio(src));
            audio.loop = options.loop === true;
            return audio;
        }

        function stopRuntimeAudioInstance(audio) {
            if (!audio) return;
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                console.warn('[runtime] Не удалось остановить audio:', error);
            }
            runtimeAudios.delete(audio);
            if (window.currentMusic === audio) window.currentMusic = null;
        }

        function clearDialogueRuntimeHandlers() {
            const dialogueBox = document.querySelector('.dialogue-box');
            if (!dialogueBox) return;
            if (dialogueBox.tapHandler) {
                dialogueBox.removeEventListener('touchstart', dialogueBox.tapHandler, { passive: false });
                dialogueBox.removeEventListener('click', dialogueBox.tapHandler);
                dialogueBox.tapHandler = null;
            }
            if (dialogueBox.touchHandler) {
                dialogueBox.removeEventListener('touchstart', dialogueBox.touchHandler, { passive: false });
                dialogueBox.removeEventListener('click', dialogueBox.touchHandler);
                dialogueBox.touchHandler = null;
            }
            dialogueBox.onclick = null;
            dialogueBox.ontouchstart = null;
            dialogueBox.style.pointerEvents = 'none';
        }

        function clearRuntimeDomArtifacts() {
            clearDialogueRuntimeHandlers();
            const dialogueElement = document.getElementById('dialogue-text');
            if (dialogueElement?.typeTimer) {
                runtimeClearTimeout(dialogueElement.typeTimer);
                dialogueElement.typeTimer = null;
            }
            isTyping = false;

            document.querySelectorAll(
                '.phone-overlay, #timer-countdown, .choice-btn, .choice-feedback, .memory-notification, #loading-overlay, #loading-status, .epilogue-overlay'
            ).forEach(element => element.remove());

            [
                document.getElementById('background'),
                document.getElementById('character-left'),
                document.getElementById('character-right'),
                document.querySelector('.dialogue-box')
            ].filter(Boolean).forEach(element => {
                element.classList.remove('fade-out');
                element.style.opacity = '';
                element.style.transition = '';
            });

            try {
                if ('vibrate' in navigator) navigator.vibrate(0);
            } catch (_) {}
        }

        function cancelRuntimeTasks() {
            for (const timeoutId of [...runtimeTimeouts]) window.clearTimeout(timeoutId);
            runtimeTimeouts.clear();
            for (const intervalId of [...runtimeIntervals]) window.clearInterval(intervalId);
            runtimeIntervals.clear();
            for (const audio of [...runtimeAudios]) stopRuntimeAudioInstance(audio);
            runtimeAudios.clear();
            if (window.currentMusic) stopRuntimeAudioInstance(window.currentMusic);
            if (window.gsap?.globalTimeline) window.gsap.globalTimeline.clear();
            clearRuntimeDomArtifacts();
        }

        function beginRuntimeSession(reason = 'start') {
            runtimeGeneration += 1;
            runtimeActive = true;
            cancelRuntimeTasks();
            transitionInFlight = false;
            choiceCommitInFlight = false;
            console.log(`[runtime] generation ${runtimeGeneration} started: ${reason}`);
            return runtimeGeneration;
        }

        function invalidateRuntimeSession(reason = 'invalidate') {
            runtimeGeneration += 1;
            runtimeActive = false;
            cancelRuntimeTasks();
            transitionInFlight = false;
            choiceCommitInFlight = false;
            console.log(`[runtime] generation ${runtimeGeneration} invalidated: ${reason}`);
            return runtimeGeneration;
        }
''',
'lifecycle insertion')

# 2) Audio helpers become lifecycle-owned.
replace_between(
'''        function playSound(sound) {''',
'''        function showErrorMessage(message) {''',
'''        function playSound(sound, generation = runtimeGeneration) {
            if (!sound) return null;
            const fileName = /\.(mp3|wav|ogg|m4a)$/i.test(sound) ? sound : `${sound}.mp3`;
            const audio = createRuntimeAudio(`assets/sounds/${fileName}`);
            audio.play().catch(error => {
                if (!isRuntimeGenerationCurrent(generation)) return;
                console.error(`Ошибка воспроизведения звука ${sound}:`, error);
                showErrorMessage(stats.language === "ru" ? `Звук ${sound} не найден` : `Sound ${sound} not found`);
            });
            return audio;
        }

        function playMusic(music, generation = runtimeGeneration) {
            if (!music) return null;
            if (window.currentMusic) stopRuntimeAudioInstance(window.currentMusic);

            const fileName = /\.(mp3|wav|ogg|m4a)$/i.test(music) ? music : `${music}.mp3`;
            const audio = createRuntimeAudio(`assets/sounds/${fileName}`, { loop: true });
            window.currentMusic = audio;
            audio.play().catch(error => {
                if (!isRuntimeGenerationCurrent(generation)) return;
                console.error(`Ошибка воспроизведения музыки ${music}:`, error);
                showErrorMessage(stats.language === "ru" ? `Музыка ${music} не найдена` : `Sound ${music} not found`);
            });
            return audio;
        }

''',
'audio functions')

replace_once(
'''        function showErrorMessage(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
        }
''',
'''        function showErrorMessage(message) {
            const generation = runtimeGeneration;
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
            runtimeSetTimeout(() => errorDiv.remove(), 3000, generation);
        }
''',
'global error timeout')

# 3) Continue/New Game/Menu create or invalidate generations explicitly.
replace_once(
'''                checkTempPassword(async () => {
                    const loaded = await loadSession();
                    if (loaded) startGame();
                });
''',
'''                checkTempPassword(async () => {
                    const generation = beginRuntimeSession('continue');
                    const loaded = await loadSession(generation);
                    if (!isRunCurrent(generation)) return;
                    if (loaded) {
                        await startGame(generation);
                    } else {
                        invalidateRuntimeSession('continue-without-run');
                    }
                });
''',
'continue handler')

replace_once(
'''            async function handleMenu(e) {
                e.preventDefault();
                console.log('handleMenu вызван: текущее прохождение уничтожается');
                stats.hasReturnedViaMenu = true;
                try {
                    await saveProfile();
                    await deleteRun();
                } catch (error) {
                    console.error('Не удалось удалить текущее прохождение:', error);
                }
                resetGameState(true);
                showStartScreen();
            }
''',
'''            async function handleMenu(e) {
                e.preventDefault();
                console.log('handleMenu вызван: текущее прохождение уничтожается');

                // Invalidate synchronously, before the first await. Nothing from the abandoned
                // generation is allowed to mutate state while profile/run deletion is pending.
                invalidateRuntimeSession('menu');
                stats.hasReturnedViaMenu = true;
                try {
                    await saveProfile();
                    await deleteRun();
                } catch (error) {
                    console.error('Не удалось удалить текущее прохождение:', error);
                }
                resetGameState(true);
                showStartScreen();
            }
''',
'menu handler')

replace_once(
'''        function resetGameState(hasReturnedViaMenu = false) {
            console.log('resetGameState вызван');
            currentChapter = 1;
            currentScene = 0;
            choices = [];
            stats = createFreshRunStats(hasReturnedViaMenu);
            currentBackground = null;
        }
''',
'''        function resetGameState(hasReturnedViaMenu = false) {
            console.log('resetGameState вызван');
            currentChapter = 1;
            currentScene = 0;
            choices = [];
            stats = createFreshRunStats(hasReturnedViaMenu);
            scriptData = null;
            currentBackground = null;
        }
''',
'reset state')

replace_once(
'''        async function startNewGame() {
            console.log('startNewGame вызван');
            resetGameState(false);
            await saveSession();
            startGame();
        }
''',
'''        async function startNewGame() {
            console.log('startNewGame вызван');
            const generation = beginRuntimeSession('new-game');
            resetGameState(false);
            await saveSession();
            if (!isRunCurrent(generation)) return false;
            return await startGame(generation);
        }
''',
'new game')

# loadSession: generation guard at async boundaries.
replace_once('''        async function loadSession() {
            try {
                await loadProfile();
                const rawSession = await getFromStorage(RUN_STORAGE_KEY);
''',
'''        async function loadSession(generation = runtimeGeneration) {
            try {
                if (!isRunCurrent(generation)) return false;
                await loadProfile();
                if (!isRunCurrent(generation)) return false;
                const rawSession = await getFromStorage(RUN_STORAGE_KEY);
                if (!isRunCurrent(generation)) return false;
''',
'load session guards')

# 4) Start-game async chain is generation-aware.
replace_between(
'''        async function startGame() {''',
'''        function updateDiamondsDisplay() {''',
'''        async function startGame(generation = runtimeGeneration) {
            if (!isRunCurrent(generation)) return false;
            try {
                console.log(`startGame вызван для generation ${generation}`);
                showDebugMessage('Инициализация игры...');
                document.getElementById('game-container').style.display = 'block';
                document.getElementById('start-screen').style.display = 'none';
                document.getElementById('language-btn').style.display = 'none';

                const loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'loading-overlay';
                loadingOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:10;display:flex;justify-content:center;align-items:center;color:#fff;';
                loadingOverlay.innerHTML = '<span>Загрузка...</span>';
                document.body.appendChild(loadingOverlay);

                await preloadAssets(currentChapter, { generation });
                if (!isRunCurrent(generation)) return false;

                const chapterLoaded = await loadChapter(currentChapter, generation);
                if (!isRunCurrent(generation)) return false;
                if (!chapterLoaded) {
                    loadingOverlay.remove();
                    return false;
                }

                document.getElementById('background').style.display = 'block';
                document.getElementById('character-left').style.display = 'block';
                document.getElementById('character-right').style.display = 'block';
                document.getElementById('dialogue-box').style.display = 'block';
                document.getElementById('menu').style.display = 'flex';
                document.getElementById('progress-bar').style.display = 'block';
                document.getElementById('stats').style.display = stats.isAuthorized ? 'block' : 'none';
                updateDiamondsDisplay();

                loadingOverlay.remove();
                return await showScene(currentScene, generation);
            } catch (error) {
                if (!isRunCurrent(generation)) return false;
                console.error('Ошибка в startGame:', error);
                showDebugMessage(`Ошибка: ${error.message}`);
                alert(stats.language === "ru" ? 'Ошибка запуска игры.' : 'Game start error.');
                document.getElementById('loading-overlay')?.remove();
                invalidateRuntimeSession('start-game-error');
                showStartScreen();
                return false;
            }
        }

''',
'startGame')

replace_once(
'''        function showDebugMessage(message) {
            let debugDiv = document.getElementById('debug-message');
            if (!debugDiv) {
                debugDiv = document.createElement('div');
                debugDiv.id = 'debug-message';
                document.body.appendChild(debugDiv);
            }
            debugDiv.textContent = message;
            setTimeout(() => debugDiv.remove(), 5000);
        }
''',
'''        function showDebugMessage(message) {
            const generation = runtimeGeneration;
            let debugDiv = document.getElementById('debug-message');
            if (!debugDiv) {
                debugDiv = document.createElement('div');
                debugDiv.id = 'debug-message';
                document.body.appendChild(debugDiv);
            }
            debugDiv.textContent = message;
            runtimeSetTimeout(() => debugDiv.remove(), 5000, generation);
        }
''',
'debug timeout')

# 5) Preload callbacks cannot resurrect UI after generation invalidation.
replace_once(
'''        async function preloadAssets(chapterId, options = {}) {
            console.log(`Начало загрузки ресурсов для главы: ${chapterId}`);
            const language = options.language || 'ru';
''',
'''        async function preloadAssets(chapterId, options = {}) {
            const generation = options.generation ?? runtimeGeneration;
            if (!isRunCurrent(generation)) return { success: 0, failed: 0, failedImages: [], cancelled: true };
            console.log(`Начало загрузки ресурсов для главы: ${chapterId}`);
            const language = options.language || 'ru';
''',
'preload generation')

replace_once(
'''            const showErrorMessage = (message) => {
                const errorElement = document.createElement('div');
''',
'''            const showErrorMessage = (message) => {
                if (!isRunCurrent(generation)) return;
                const errorElement = document.createElement('div');
''',
'preload local error guard')

replace_once(
'''                setTimeout(() => {
                    errorElement.style.opacity = '0';
                    errorElement.style.transition = 'opacity 0.5s';
                    setTimeout(() => errorElement.remove(), 500);
                }, 3000);
''',
'''                runtimeSetTimeout(() => {
                    if (!isRunCurrent(generation)) return;
                    errorElement.style.opacity = '0';
                    errorElement.style.transition = 'opacity 0.5s';
                    runtimeSetTimeout(() => errorElement.remove(), 500, generation);
                }, 3000, generation);
''',
'preload local error timers')

replace_once(
'''                        img.onload = () => {
                            loaded++;
                            updateStatus();
                            console.log(`✅ ${texts.loading}: ${src}`);
                            resolve(true);
                        };
                        img.onerror = () => {
                            loaded++;
                            failedImages.push(src.split('/').pop());
                            updateStatus();
                            console.warn(`❌ ${texts.loadError}: ${src}`);
                            resolve(false);
                        };
''',
'''                        img.onload = () => {
                            if (!isRunCurrent(generation)) {
                                resolve(false);
                                return;
                            }
                            loaded++;
                            updateStatus();
                            console.log(`✅ ${texts.loading}: ${src}`);
                            resolve(true);
                        };
                        img.onerror = () => {
                            if (!isRunCurrent(generation)) {
                                resolve(false);
                                return;
                            }
                            loaded++;
                            failedImages.push(src.split('/').pop());
                            updateStatus();
                            console.warn(`❌ ${texts.loadError}: ${src}`);
                            resolve(false);
                        };
''',
'preload image guards')

replace_once(
'''            } finally {
                loadingStatus.style.opacity = '0';
                loadingStatus.style.transition = 'opacity 0.5s';
                setTimeout(() => loadingStatus.remove(), 500);
            }
''',
'''            } finally {
                if (isRunCurrent(generation) && loadingStatus.isConnected) {
                    loadingStatus.style.opacity = '0';
                    loadingStatus.style.transition = 'opacity 0.5s';
                    runtimeSetTimeout(() => loadingStatus.remove(), 500, generation);
                } else {
                    loadingStatus.remove();
                }
            }
''',
'preload finally')

# 6) Chapter fetch is fail-closed for stale generations.
replace_between(
'''        async function loadChapter(chapterId) {''',
'''        function createChoiceButton(choice) {''',
'''        async function loadChapter(chapterId, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    console.log(`Загрузка главы ${chapterId}`);
    const jsonPath = `assets/data/chapter${chapterId}.json`;
    try {
        const response = await fetch(jsonPath, {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Accept': 'application/json'
            }
        });
        if (!isRunCurrent(generation)) return false;
        if (!response.ok) {
            console.error(`Ошибка загрузки ${jsonPath}: ${response.status} ${response.statusText}`);
            showErrorMessage(stats.language === "ru" ? `Глава ${chapterId} не найдена` : `Chapter ${chapterId} not found`);
            showStartScreen();
            return false;
        }
        const text = await response.text();
        if (!isRunCurrent(generation)) return false;
        const data = JSON.parse(text);
        if (!data || !data.scenes || !Array.isArray(data.scenes)) {
            throw new Error('Некорректный формат JSON');
        }
        if (!isRunCurrent(generation)) return false;
        scriptData = data;
        console.log(`Глава ${chapterId} загружена:`, scriptData);
        return true;
    } catch (error) {
        if (!isRunCurrent(generation)) return false;
        console.error(`Ошибка загрузки главы ${chapterId}:`, error);
        showErrorMessage(stats.language === "ru" ? `Ошибка загрузки главы ${chapterId}` : `Error loading chapter ${chapterId}`);
        showStartScreen();
        return false;
    }
}

''',
'loadChapter')

# 7) Choice commits and transitions own the same generation.
replace_between(
'''        async function saveChoice(choiceId, effects, memoryTag, options = {}) {''',
'''    // Stage 0D: one transition engine for scene, chapter and ending routes.''',
'''        async function saveChoice(choiceId, effects, memoryTag, options = {}) {
        const generation = options.generation ?? runtimeGeneration;
        if (!isRunCurrent(generation)) return false;
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
            runtimeSetTimeout(() => notification.remove(), 3000, generation);
        }

        if (options.persist !== false) {
            await saveSession();
            if (!isRunCurrent(generation)) return false;
        }
        return true;
    }

''',
'saveChoice')

replace_between(
'''    let transitionInFlight = false;
    let choiceCommitInFlight = false;
''',
'''            // Обновление прогресс-бара''',
'''    let transitionInFlight = false;
    let choiceCommitInFlight = false;

    async function transitionTo(target, options = {}) {
        const generation = options.generation ?? runtimeGeneration;
        if (!isRunCurrent(generation)) return false;
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
            if (!isRunCurrent(generation)) return false;

            if (target.type === 'scene') {
                currentScene = target.sceneId;
                await saveSession();
                if (!isRunCurrent(generation)) return false;
                return await showScene(currentScene, generation);
            }

            if (target.type === 'chapter') {
                currentChapter = target.chapterId ?? (currentChapter + 1);
                currentScene = 0;
                const loaded = await loadChapter(currentChapter, generation);
                if (!isRunCurrent(generation)) return false;
                if (!loaded) {
                    currentChapter = previousChapter;
                    currentScene = previousScene;
                    return false;
                }
                await saveSession();
                if (!isRunCurrent(generation)) return false;
                return await showScene(currentScene, generation);
            }

            if (target.type === 'ending') {
                const endingId = resolveEndingId(target.endingId);
                await saveSession();
                if (!isRunCurrent(generation)) return false;
                return await loadFinals(endingId, generation);
            }

            console.error('[transitionTo] Неизвестный тип перехода:', target);
            return false;
        } finally {
            if (isRuntimeGenerationCurrent(generation)) transitionInFlight = false;
        }
    }

    async function applyChoice(choice, options = {}) {
        const generation = options.generation ?? runtimeGeneration;
        if (!isRunCurrent(generation)) return false;
        if (!choice || choiceCommitInFlight) return false;
        if (choice.condition && !checkCondition(choice.condition)) return false;
        if (choice.cost && stats.diamonds < choice.cost) return false;

        choiceCommitInFlight = true;
        try {
            if (choice.cost) stats.diamonds -= choice.cost;
            updateDiamondsDisplay();

            const saved = await saveChoice(choice.id, choice.effects, choice.memoryTag, { persist: false, generation });
            if (!saved || !isRunCurrent(generation)) return false;
            if (choice.effects) showChoiceEffects(choice.effects, generation);

            if (typeof options.cleanup === 'function') options.cleanup();
            if (options.overlay) options.overlay.remove();
            document.querySelectorAll('.choice-btn').forEach(btn => btn.remove());
            if (!isRunCurrent(generation)) return false;

            const target = resolveChoiceTransition(choice);
            if (target.type === 'none') {
                await saveSession();
                return isRunCurrent(generation);
            }

            return await transitionTo(target, { generation });
        } finally {
            if (isRuntimeGenerationCurrent(generation)) choiceCommitInFlight = false;
        }
    }

''',
'transition/applyChoice')

# 8) Background/character async rendering is guarded.
replace_between(
'''// Настройка фона с проверкой
async function setupBackground(newBackground, language) {''',
'''// Создание оверлея''',
'''// Настройка фона с проверкой
async function setupBackground(newBackground, language, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    console.log(`[setupBackground] Устанавливаем фон: ${newBackground}`);
    const bgUrl = newBackground === 'none' ? 'none' : `assets/backgrounds/${newBackground}.png`;
    if (bgUrl !== 'none') {
        const exists = await checkAssetExists(bgUrl);
        if (!isRunCurrent(generation)) return null;
        console.log(`[setupBackground] Проверка фона ${bgUrl}: ${exists ? 'найден' : 'не найден'}`);
        if (!exists) {
            console.warn(`Фон ${newBackground}.png не найден`);
            showErrorMessage(language === "ru" ? `Фон ${newBackground} не найден` : `Background ${newBackground} not found`);
        }
    }
    if (!isRunCurrent(generation)) return null;
    document.getElementById('background').style.backgroundImage = bgUrl === 'none' ? 'none' : `url('${bgUrl}')`;
    return newBackground;
}

// Настройка персонажей
async function setupCharacters(scene, language, runStats, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    console.log(`[setupCharacters] Настройка персонажей для сцены ${scene.id}`);
    const charLeft = document.getElementById('character-left');
    const charRight = document.getElementById('character-right');
    const speakerName = scene.speaker ? scene.speaker[language] : '';

    charLeft.style.backgroundImage = 'none';
    charRight.style.backgroundImage = 'none';
    charLeft.classList.remove('character-speaker', 'character-non-speaker', 'shiver', 'heartbeat');
    charRight.classList.remove('character-speaker', 'character-non-speaker', 'shiver', 'heartbeat');

    if (scene.characterLeft) {
        const leftChar = scene.characterLeft.includes('${stats.appearance}')
            ? scene.characterLeft.replace('${stats.appearance}', runStats.appearance)
            : scene.characterLeft;
        const leftCharUrl = `assets/characters/${leftChar.split('_')[0]}/${leftChar}.png`;
        const exists = await checkAssetExists(leftCharUrl);
        if (!isRunCurrent(generation)) return false;
        console.log(`[setupCharacters] Проверка персонажа ${leftCharUrl}: ${exists ? 'найден' : 'не найден'}`);
        if (!exists) {
            console.warn(`Персонаж ${leftChar}.png не найден`);
            showErrorMessage(language === "ru" ? `Персонаж ${leftChar} не найден` : `Character ${leftChar} not found`);
        }
        charLeft.style.backgroundImage = `url('${leftCharUrl}')`;
        charLeft.classList.add(speakerName === "Анна" || speakerName === "Anna" ? 'character-speaker' : 'character-non-speaker');
    }

    if (scene.characterRight) {
        const rightChar = scene.characterRight.includes('${stats.appearance}')
            ? scene.characterRight.replace('${stats.appearance}', runStats.appearance)
            : scene.characterRight;
        const rightCharUrl = `assets/characters/${rightChar.split('_')[0]}/${rightChar}.png`;
        const exists = await checkAssetExists(rightCharUrl);
        if (!isRunCurrent(generation)) return false;
        console.log(`[setupCharacters] Проверка персонажа ${rightCharUrl}: ${exists ? 'найден' : 'не найден'}`);
        if (!exists) {
            console.warn(`Персонаж ${rightChar}.png не найден`);
            showErrorMessage(language === "ru" ? `Персонаж ${rightChar} не найден` : `Character ${rightChar} not found`);
        }
        charRight.style.backgroundImage = `url('${rightCharUrl}')`;
        charRight.classList.add(speakerName === "Вика" || speakerName === "Vika" ? 'character-speaker' : 'character-non-speaker');
    }

    if (!isRunCurrent(generation)) return false;
    document.getElementById('speaker-name').textContent = speakerName;
    console.log(`[setupCharacters] Имя спикера: ${speakerName}`);
    return true;
}

''',
'setup background/characters')

# 9) Choice handlers and transition taps carry generation.
replace_between(
'''  // Обработка выбора
   function handleChoices(scene, dialogueBox, overlay) {''',
'''    // Stage 0E: timeout behavior is explicit story data, never a magic choice id.''',
'''  // Обработка выбора
   function handleChoices(scene, dialogueBox, overlay, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return;
    dialogueBox.style.pointerEvents = 'auto';
    if (!scene.choices || scene.choices.length === 0) return;

    console.log(`[handleChoices] Обработка выбора для сцены ${scene.id}`);

    if (getTimeoutConfig(scene)) {
        showSceneWithTimer(scene, generation);
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
                if (!isRunCurrent(generation)) return;
                await applyChoice(choice, { overlay, generation });
            };
            btn.addEventListener('touchstart', handleChoice, { passive: false });
            btn.addEventListener('click', handleChoice);
        }

        dialogueBox.appendChild(btn);
    });
   }

   function bindTransitionHandler(dialogueBox, target, overlay, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return;
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
        if (!isRunCurrent(generation)) return;
        dialogueBox.style.pointerEvents = 'none';
        dialogueBox.removeEventListener('touchstart', handleNext, { passive: false });
        dialogueBox.removeEventListener('click', handleNext);
        dialogueBox.touchHandler = null;
        await transitionTo(target, { overlay, generation });
    };

    dialogueBox.touchHandler = handleNext;
    dialogueBox.addEventListener('touchstart', handleNext, { passive: false });
    dialogueBox.addEventListener('click', handleNext);
    dialogueBox.style.pointerEvents = 'auto';
   }
   
''',
'choice handlers')

# 10) Scene/timed-scene runtime rewritten around generation-owned timers.
replace_between(
'''    async function showScene(sceneId) {''',
'''        function showPremiumGallery() {''',
'''    async function showScene(sceneId, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    console.log(`Показ сцены ${sceneId}`);
    const scene = scriptData?.scenes?.find(s => s.id === sceneId);

    if (!scene) {
        if (!isRunCurrent(generation)) return false;
        console.error('Сцена не найдена:', sceneId);
        showErrorMessage(stats.language === "ru" ? `Сцена ${sceneId} не найдена` : `Scene ${sceneId} not found`);
        return false;
    }

    const hasTimedChoices = getTimeoutConfig(scene) !== null;
    if (hasTimedChoices) return showSceneWithTimer(scene, generation);

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
        if (!isRunCurrent(generation)) return false;
        const background = await setupBackground(newBackground, stats.language, generation);
        if (!isRunCurrent(generation) || background === null) return false;
        currentBackground = background;
        const charactersReady = await setupCharacters(scene, stats.language, stats, generation);
        if (!isRunCurrent(generation) || !charactersReady) return false;

        clearDialogueHandlers(dialogueBox);
        dialogueBox.style.pointerEvents = 'none';
        const overlay = createOverlayIfNeeded(sceneId, displayText, false, generation);

        if (scene.sound) playSound(scene.sound, generation);
        if (scene.music) {
            playMusic(scene.music, generation);
        } else if (window.currentMusic) {
            stopRuntimeAudioInstance(window.currentMusic);
        }

        typeText(displayText, dialogueElement, async () => {
            if (!isRunCurrent(generation)) return;
            try {
                dialogueBox.style.pointerEvents = 'auto';
                if (scene.choices && scene.choices.length > 0) {
                    handleChoices(scene, dialogueBox, overlay, generation);
                    return;
                }

                const target = resolveSceneTransition(scene);
                console.log('[showScene] resolved transition:', target);
                if (target.type === 'none') {
                    console.warn(`[showScene] Сцена ${scene.id} не имеет маршрута выхода`);
                    return;
                }

                if (target.type === 'chapter' && lastScene?.id === scene.id) {
                    await transitionTo(target, { overlay, generation });
                    return;
                }

                bindTransitionHandler(dialogueBox, target, overlay, generation);
            } catch (err) {
                if (isRunCurrent(generation)) console.error('[showScene callback] crash:', err);
            }
        }, generation);

        return true;
    };

    if (shouldFade) {
        fadeOut(() => {
            if (!isRunCurrent(generation)) return;
            void applyScene();
            fadeIn(generation);
        }, generation);
        return true;
    }

    return await applyScene();
}

    function showSceneWithTimer(scene, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
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
        if (!isRunCurrent(generation)) return false;
        const background = await setupBackground(newBackground, stats.language, generation);
        if (!isRunCurrent(generation) || background === null) return false;
        currentBackground = background;
        const charactersReady = await setupCharacters(scene, stats.language, stats, generation);
        if (!isRunCurrent(generation) || !charactersReady) return false;

        const charLeft = document.getElementById('character-left');
        const charRight = document.getElementById('character-right');
        if (scene.characterLeftOffset) charLeft.style.left = scene.characterLeftOffset;
        if (scene.characterRightOffset) charRight.style.right = scene.characterRightOffset;

        clearDialogueHandlers(dialogueBox);
        dialogueBox.style.pointerEvents = 'none';
        const overlay = scene.phone === 1 ? showMessengerOverlay(scene.id, generation) : null;

        if (scene.sound) playSound(scene.sound, generation);
        if (scene.music) playMusic(scene.music, generation);

        typeText(displayText, dialogueElement, () => {
            if (!isRunCurrent(generation)) return;
            dialogueBox.style.pointerEvents = 'auto';

            let timer = null;
            let countdownInterval = null;
            let tickSound = null;

            const cleanupTimer = () => {
                runtimeClearInterval(countdownInterval);
                runtimeClearTimeout(timer);
                countdownInterval = null;
                timer = null;
                document.getElementById('timer-countdown')?.remove();
                if (tickSound) stopRuntimeAudioInstance(tickSound);
                tickSound = null;
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
                        if (!isRunCurrent(generation)) return;
                        await applyChoice(choice, { overlay, cleanup: cleanupTimer, generation });
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

            tickSound = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
            tickSound.play().catch(err => {
                if (isRunCurrent(generation)) console.warn('Ошибка воспроизведения sfx_tick:', err);
            });

            countdownInterval = runtimeSetInterval(() => {
                if (!isRunCurrent(generation)) return;
                timeLeft = Math.max(0, timeLeft - 1);
                countdownElement.textContent = timeLeft;
                if (overlay) {
                    overlay.classList.add('flash-svg');
                    runtimeSetTimeout(() => {
                        if (isRunCurrent(generation)) overlay?.classList.remove('flash-svg');
                    }, 500, generation);
                }
                if ('vibrate' in navigator) navigator.vibrate(200);
                if (timeLeft <= 0) {
                    runtimeClearInterval(countdownInterval);
                    countdownInterval = null;
                    if (tickSound) stopRuntimeAudioInstance(tickSound);
                    tickSound = null;
                }
            }, 1000, generation);

            timer = runtimeSetTimeout(async () => {
                if (!isRunCurrent(generation)) return;
                console.log(`[showSceneWithTimer] Таймер сцены ${scene.id} истёк`);
                await applyTimeoutOutcome(scene, timeoutConfig, { overlay, cleanup: cleanupTimer, generation });
            }, timerDuration, generation);
        }, generation);

        return true;
    };

    if (shouldFade) {
        fadeOut(() => {
            if (!isRunCurrent(generation)) return;
            void applyScene();
            fadeIn(generation);
        }, generation);
        return true;
    }

    void applyScene();
    return true;
}

''',
'showScene/timer')

# 11) Overlay interval is tracked; overlay creators receive generation.
replace_once(
'''               function showMessengerOverlay(sceneId) {
    console.log(`Создание оверлея для сцены ${sceneId}`);
''',
'''               function showMessengerOverlay(sceneId, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    console.log(`Создание оверлея для сцены ${sceneId}`);
''',
'messenger signature')

replace_once(
'''            onStart: function () {
                let text = "...";
                let index = 0;
                let interval = setInterval(() => {
                    const el = document.getElementById('reply-text');
                    if (!el) {
                        clearInterval(interval);
                        return;
                    }
                    el.textContent = text.slice(0, index);
                    index++;
                    if (index > text.length) clearInterval(interval);
                }, 100);
            }
''',
'''            onStart: function () {
                if (!isRunCurrent(generation)) return;
                let text = "...";
                let index = 0;
                let interval = runtimeSetInterval(() => {
                    if (!isRunCurrent(generation)) return;
                    const el = document.getElementById('reply-text');
                    if (!el) {
                        runtimeClearInterval(interval);
                        return;
                    }
                    el.textContent = text.slice(0, index);
                    index++;
                    if (index > text.length) runtimeClearInterval(interval);
                }, 100, generation);
            }
''',
'messenger typing interval')

replace_once(
'''   function createOverlayIfNeeded(sceneId, displayText, hasTimer = false) {
''',
'''   function createOverlayIfNeeded(sceneId, displayText, hasTimer = false, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
''',
'overlay factory signature')
replace_once('''            return showMessengerOverlay(sceneId);
''','''            return showMessengerOverlay(sceneId, generation);
''','overlay messenger call')

# 12) Finals/epilogue cannot complete after Menu.
replace_between(
'''        async function loadFinals(endingId) {''',
'''function checkCondition(condition) {''',
'''        async function loadFinals(endingId, generation = runtimeGeneration) {
            if (!isRunCurrent(generation)) return false;
            const normalizedEndingId = resolveEndingId(endingId);

            try {
                const response = await fetch('assets/data/finals.json');
                if (!isRunCurrent(generation)) return false;
                if (!response.ok) throw new Error(`Finals HTTP ${response.status}`);

                const finalsData = await response.json();
                if (!isRunCurrent(generation)) return false;
                const ending = Array.isArray(finalsData?.endings)
                    ? finalsData.endings.find(candidate => candidate.id === normalizedEndingId)
                    : null;

                if (!ending) {
                    console.error(`[loadFinals] Ending not found: ${normalizedEndingId}`);
                    showErrorMessage(
                        stats.language === "ru"
                            ? `Финал ${normalizedEndingId} не найден`
                            : `Ending ${normalizedEndingId} not found`
                    );
                    return false;
                }

                showEnding(ending, generation);
                return true;
            } catch (error) {
                if (!isRunCurrent(generation)) return false;
                console.error('[loadFinals] Не удалось загрузить финал:', error);
                showErrorMessage(
                    stats.language === "ru"
                        ? 'Не удалось загрузить финал. Попробуйте ещё раз.'
                        : 'Failed to load ending. Please try again.'
                );
                return false;
            }
        }

        function showEnding(ending, generation = runtimeGeneration) {
            if (!isRunCurrent(generation)) return false;
            const scene = ending.scenes[0];
            const backgroundElement = document.getElementById('background');
            const charLeft = document.getElementById('character-left');
            const charRight = document.getElementById('character-right');
            const dialogueElement = document.getElementById('dialogue-text');
            const speakerName = document.getElementById('speaker-name');

            const bgUrl = `assets/backgrounds/${scene.background}.png`;
            checkAssetExists(bgUrl).then(exists => {
                if (!isRunCurrent(generation)) return;
                if (!exists) {
                    console.warn(`Фон ${scene.background}.png не найден`);
                    showErrorMessage(stats.language === "ru" ? `Фон ${scene.background} не найден` : `Background ${scene.background} not found`);
                }
                backgroundElement.style.backgroundImage = `url('${bgUrl}')`;
            });

            if (scene.characterLeft) {
                const leftCharUrl = `assets/characters/${scene.characterLeft.split('_')[0]}/${scene.characterLeft}.png`;
                checkAssetExists(leftCharUrl).then(exists => {
                    if (!isRunCurrent(generation)) return;
                    if (!exists) {
                        console.warn(`Персонаж ${scene.characterLeft}.png не найден`);
                        showErrorMessage(stats.language === "ru" ? `Персонаж ${scene.characterLeft} не найден` : `Character ${scene.characterLeft} not found`);
                    }
                    charLeft.style.backgroundImage = `url('${leftCharUrl}')`;
                });
            } else charLeft.style.backgroundImage = 'none';

            if (scene.characterRight) {
                const rightCharUrl = `assets/characters/${scene.characterRight.split('_')[0]}/${scene.characterRight}.png`;
                checkAssetExists(rightCharUrl).then(exists => {
                    if (!isRunCurrent(generation)) return;
                    if (!exists) {
                        console.warn(`Персонаж ${scene.characterRight}.png не найден`);
                        showErrorMessage(stats.language === "ru" ? `Персонаж ${scene.characterRight} не найден` : `Character ${scene.characterRight} not found`);
                    }
                    charRight.style.backgroundImage = `url('${rightCharUrl}')`;
                });
            } else charRight.style.backgroundImage = 'none';

            speakerName.textContent = scene.speaker[stats.language];
            typeText(
                stats.completionCount >= 1 && scene.second_playthrough_text
                    ? scene.second_playthrough_text[stats.language]
                    : scene.text[stats.language],
                dialogueElement,
                () => {
                    if (isRunCurrent(generation)) showEpilogue(ending.epilogue[stats.language], generation);
                },
                generation
            );

            if (scene.sound) playSound(scene.sound, generation);
            if (scene.music) playMusic(scene.music, generation);
            return true;
        }

        function showEpilogue(epilogueText, generation = runtimeGeneration) {
            if (!isRunCurrent(generation)) return false;
            const epilogueDiv = document.createElement('div');
            epilogueDiv.className = 'epilogue-overlay';
            epilogueDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); color: white; display: flex; justify-content: center; align-items: center; text-align: center; padding: 20px; z-index: 10;';
            epilogueDiv.textContent = epilogueText;
            document.body.appendChild(epilogueDiv);
            runtimeSetTimeout(async () => {
                if (!isRunCurrent(generation)) return;
                epilogueDiv.remove();
                stats.completionCount++;
                await saveProfile();
                if (!isRunCurrent(generation)) return;
                await deleteRun();
                if (!isRunCurrent(generation)) return;
                invalidateRuntimeSession('ending-complete');
                resetGameState(false);
                showStartScreen();
            }, 5000, generation);
            return true;
        }



     
''',
'finals lifecycle')

# 13) Typewriter and fades are generation-bound and cancellable.
replace_between(
''' function typeText(text, element, callback) {''',
'''        
function fadeOut(callback) {''',
''' function typeText(text, element, callback, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    if (isTyping) {
        console.log(`[${Date.now()}] typeText уже идёт, пропускаем`);
        return false;
    }

    const callId = Date.now();
    isTyping = true;
    element.textContent = '';
    if (element.typeTimer) runtimeClearTimeout(element.typeTimer);

    const parts = text.split('||').map(part => part.trim()).filter(part => part.length > 0);
    let partIndex = 0;
    let i = 0;
    const speed = 50;
    const dialogueBox = document.querySelector('.dialogue-box');

    function clearHandlers() {
        if (!dialogueBox) return;
        if (dialogueBox.tapHandler) {
            dialogueBox.removeEventListener('touchstart', dialogueBox.tapHandler, { passive: false });
            dialogueBox.removeEventListener('click', dialogueBox.tapHandler);
            dialogueBox.tapHandler = null;
        }
        if (dialogueBox.touchHandler) {
            dialogueBox.removeEventListener('touchstart', dialogueBox.touchHandler, { passive: false });
            dialogueBox.removeEventListener('click', dialogueBox.touchHandler);
            dialogueBox.touchHandler = null;
        }
    }

    function finish() {
        if (!isRunCurrent(generation)) return;
        isTyping = false;
        element.typeTimer = null;
        clearHandlers();
        if (callback) callback();
    }

    function type() {
        if (!isRunCurrent(generation)) return;
        if (partIndex >= parts.length) {
            finish();
            return;
        }
        if (i < parts[partIndex].length) {
            element.textContent += parts[partIndex].charAt(i);
            i++;
            element.typeTimer = runtimeSetTimeout(type, speed, generation);
            return;
        }

        isTyping = false;
        element.typeTimer = null;
        if (partIndex === parts.length - 1) {
            finish();
        } else {
            partIndex++;
            i = 0;
            element.textContent = '';
            isTyping = true;
            type();
        }
    }

    function handleTap(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!isRunCurrent(generation)) return;

        if (isTyping) {
            runtimeClearTimeout(element.typeTimer);
            element.typeTimer = null;
            element.textContent = parts[partIndex];
            i = parts[partIndex].length;
            isTyping = false;
            if (partIndex === parts.length - 1) {
                finish();
            } else {
                partIndex++;
                i = 0;
                element.textContent = '';
                isTyping = true;
                type();
            }
        } else if (partIndex < parts.length - 1) {
            partIndex++;
            i = 0;
            element.textContent = '';
            isTyping = true;
            type();
        } else {
            finish();
        }
    }

    clearHandlers();
    if (dialogueBox) {
        dialogueBox.tapHandler = handleTap;
        dialogueBox.addEventListener('touchstart', handleTap, { passive: false });
        dialogueBox.addEventListener('click', handleTap);
        dialogueBox.style.pointerEvents = 'auto';
    }

    type();
    return true;
}


        
''',
'typeText')

replace_between(
'''function fadeOut(callback) {''',
'''function showChoiceEffects(effects) {''',
'''function fadeOut(callback, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const elements = [
        document.getElementById('background'),
        document.getElementById('character-left'),
        document.getElementById('character-right'),
        document.querySelector('.dialogue-box')
    ].filter(Boolean);
    elements.forEach(el => el.classList.add('fade-out'));
    runtimeSetTimeout(() => {
        if (!isRunCurrent(generation)) return;
        elements.forEach(el => el.classList.remove('fade-out'));
        if (callback) callback();
    }, 1000, generation);
    return true;
}

function fadeIn(generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const elements = [
        document.getElementById('background'),
        document.getElementById('character-left'),
        document.getElementById('character-right'),
        document.querySelector('.dialogue-box')
    ].filter(Boolean);
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 1s ease';
        runtimeSetTimeout(() => {
            if (isRunCurrent(generation)) el.style.opacity = '1';
        }, 10, generation);
    });
    return true;
}

''',
'fades')

replace_once(
'''function showChoiceEffects(effects) {
    const feedback = document.createElement('img');
    feedback.className = 'choice-feedback';
    if (effects.crown) feedback.src = 'assets/ui/crown.png';
    else if (effects.heart) feedback.src = 'assets/ui/heart.png';
    else if (effects.leaf) feedback.src = 'assets/ui/leaf.png';
    else return;
    document.getElementById('game-container').appendChild(feedback);
    setTimeout(() => feedback.remove(), 3000);
}
''',
'''function showChoiceEffects(effects, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return;
    const feedback = document.createElement('img');
    feedback.className = 'choice-feedback';
    if (effects.crown) feedback.src = 'assets/ui/crown.png';
    else if (effects.heart) feedback.src = 'assets/ui/heart.png';
    else if (effects.leaf) feedback.src = 'assets/ui/leaf.png';
    else return;
    document.getElementById('game-container').appendChild(feedback);
    runtimeSetTimeout(() => feedback.remove(), 3000, generation);
}
''',
'choice effect timeout')

HTML.write_bytes(raw.encode('utf-8'))
print('Stage 0G applied with original line endings preserved')
