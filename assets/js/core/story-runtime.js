        async function startGame(generation = runtimeGeneration) {
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

        function updateDiamondsDisplay() {
            document.getElementById('diamonds-count').textContent = stats.diamonds;
        }

        function showDebugMessage(message) {
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

        function checkAssetExists(url) {
            return fetch(url, { method: 'HEAD' })
                .then(res => res.ok)
                .catch(() => false);
        }
        

        async function preloadAssets(chapterId, options = {}) {
            const generation = options.generation ?? runtimeGeneration;
            if (!isRunCurrent(generation)) return { success: 0, failed: 0, failedImages: [], cancelled: true };
            console.log(`Начало загрузки ресурсов для главы: ${chapterId}`);
            const language = options.language || 'ru';
            const texts = {
                loading: language === 'ru' ? 'Загрузка' : 'Loading',
                imageNotFound: language === 'ru' ? 'Изображение не найдено' : 'Image not found',
                loadError: language === 'ru' ? 'Не удалось загрузить' : 'Failed to load'
            };
            const loadingStatus = document.createElement('div');
            loadingStatus.id = 'loading-status';
            loadingStatus.style.cssText = 'position: fixed; bottom: 10px; left: 10px; color: white; font-size: 12px; z-index: 11; background: rgba(0,0,0,0.5); padding: 5px 10px; border-radius: 3px;';
            document.body.appendChild(loadingStatus);
            const images = [
                'assets/backgrounds/start_screen.png',
                'assets/backgrounds/bg_apartment_morning.png',
                'assets/backgrounds/bg_coffee_shop.png',
                'assets/backgrounds/bg_phone_messenger.png',
                'assets/backgrounds/bg_street_day_trash.png',
                'assets/backgrounds/bg_street_dusk_end.png',
                'assets/backgrounds/bg_street_night.png',
                'assets/backgrounds/bg_webstudio_day.png',
                'assets/backgrounds/bg_webstudio_night.png',
                'assets/characters/anna/anna_angry_style1.png',
                'assets/characters/anna/anna_happy_style1.png',
                'assets/characters/anna/anna_happy_style2.png',
                'assets/characters/anna/anna_neutral_style1.png',
                'assets/characters/anna/anna_neutral_style1_summer.png',
                'assets/characters/anna/anna_neutral_style2.png',
                'assets/characters/anna/anna_neutral_style3.png',
                'assets/characters/anna/anna_sad_style1.png',
                'assets/characters/anna/anna_sad_style2.png',
                'assets/characters/anna/anna_smile_style1.png',
                'assets/characters/anna/anna_smile_style1_summer.png',
                'assets/characters/anna/anna_smile_style2.png',
                'assets/characters/anna/anna_smile_style2_summer.png',
                'assets/characters/anna/anna_style2.png',
                'assets/characters/anna/anna_surprised_style1.png',
                'assets/characters/anna/anna_surprised_style2.png',
                'assets/characters/anna/anna_thoughtful_style1.png',
                'assets/characters/anna/anna_thoughtful_style1_summer.png',
                'assets/characters/anna/anna_thoughtful_style2.png',
                'assets/characters/anna/anna_worry_style1.png',
                'assets/characters/anna/anna_worry_style2.png',
                'assets/characters/dima/dima_happy_style1.png',
                'assets/characters/dima/dima_neutral_style1.png',
                'assets/characters/dima/dima_sad_style1.png',
                'assets/characters/dima/dima_smile_style1.png',
                'assets/characters/dima/dima_surprised_style1.png',
                'assets/characters/dima/dima_thoughtful_style1.png',
                'assets/characters/dima/dima_worry_style1.png',
                'assets/characters/lyosha/lyosha_happy_style1.png',
                'assets/characters/lyosha/lyosha_messenger_ava.png',
                'assets/characters/lyosha/lyosha_neutral_style1.png',
                'assets/characters/lyosha/lyosha_sad_style1.png',
                'assets/characters/lyosha/lyosha_smile_style1.png',
                'assets/characters/lyosha/lyosha_surprised_style1.png',
                'assets/characters/lyosha/lyosha_thoughtful_style1.png',
                'assets/characters/lyosha/lyosha_worry_style1.png',
                'assets/characters/mark/mark_happy_style1.png',
                'assets/characters/mark/mark_messenger_ava.png',
                'assets/characters/mark/mark_neutral_style1.png',
                'assets/characters/mark/mark_sad_style1.png',
                'assets/characters/mark/mark_smile_style1.png',
                'assets/characters/mark/mark_surprised_style1.png',
                'assets/characters/mark/mark_thoughtful_style1.png',
                'assets/characters/mark/mark_worry_style1.png',
                'assets/characters/sergey/sergey_happy_style1.png',
                'assets/characters/sergey/sergey_neutral_style1.png',
                'assets/characters/sergey/sergey_sad_style1.png',
                'assets/characters/sergey/sergey_smile_style1.png',
                'assets/characters/sergey/sergey_surprised_style1.png',
                'assets/characters/sergey/sergey_thoughtful_style1.png',
                'assets/characters/sergey/sergey_worry_style1.png',
                'assets/characters/vika/vika_confident_style1.png',
                'assets/characters/vika/vika_happy_style1.png',
                'assets/characters/vika/vika_happy_style1_summer.png',
                'assets/characters/vika/vika_neutral_style1.png',
                'assets/characters/vika/vika_sad_style1.png',
                'assets/characters/vika/vika_sad_style1_summer.png',
                'assets/characters/vika/vika_smile_style1.png',
                'assets/characters/vika/vika_surprised_style1.png',
                'assets/characters/vika/vika_thoughtful_style1.png',
                'assets/characters/dima/dima_confident_style1.png',
                'assets/characters/mark/mark_blush_style1.png',
                'assets/characters/mark/mark_concerned_style1.png',
                'assets/characters/sergey/sergey_confident_style1.png',
                'assets/characters/vika/vika_worry_style1.png'
            ];
            let loaded = 0;
            const totalImages = images.length;
            const failedImages = [];
            const updateStatus = () => {
                const percentage = Math.floor((loaded / totalImages) * 100);
                loadingStatus.textContent = `${texts.loading}: ${loaded}/${totalImages} (${percentage}%)`;
            };
            const showErrorMessage = (message) => {
                if (!isRunCurrent(generation)) return;
                const errorElement = document.createElement('div');
                errorElement.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(255,0,0,0.7); color: white; padding: 10px; z-index: 9999; border-radius: 5px;';
                errorElement.textContent = message;
                document.body.appendChild(errorElement);
                runtimeSetTimeout(() => {
                    if (!isRunCurrent(generation)) return;
                    errorElement.style.opacity = '0';
                    errorElement.style.transition = 'opacity 0.5s';
                    runtimeSetTimeout(() => errorElement.remove(), 500, generation);
                }, 3000, generation);
            };
            updateStatus();
            try {
                const promises = images.map(src => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
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
                        img.src = src;
                    });
                });
                const results = await Promise.all(promises);
                const successCount = results.filter(success => success).length;
                console.log(`✅ ${texts.loading}: ${successCount}/${totalImages} успешно загружены`);
                if (failedImages.length > 0) {
                    failedImages.slice(0, 3).forEach(img => {
                        showErrorMessage(`${texts.imageNotFound}: ${img}`);
                    });
                    if (failedImages.length > 3) {
                        showErrorMessage(`${texts.imageNotFound}: ${failedImages.length - 3} more...`);
                    }
                }
                return { 
                    success: successCount, 
                    failed: failedImages.length, 
                    failedImages 
                };
            } catch (error) {
                console.error('Ошибка при загрузке изображений:', error);
                throw error;
            } finally {
                if (isRunCurrent(generation) && loadingStatus.isConnected) {
                    loadingStatus.style.opacity = '0';
                    loadingStatus.style.transition = 'opacity 0.5s';
                    runtimeSetTimeout(() => loadingStatus.remove(), 500, generation);
                } else {
                    loadingStatus.remove();
                }
            }
        }

        async function loadChapter(chapterId, generation = runtimeGeneration) {
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

        function createChoiceButton(choice) {
            const btn = document.createElement('button');
            const hasCostInText = choice.text[stats.language].includes(`${choice.cost}`);
            let buttonText = choice.text[stats.language].replace(/\s*\(\d+(?:[.,]\d+)?\s*(?:сек|sec)\)/i, '').trim();
            btn.textContent = choice.cost && !hasCostInText 
                ? `${buttonText} (${choice.cost} бриллиантов)` 
                : buttonText;
            btn.className = 'choice-btn';
            if (choice.text[stats.language].length > 30) btn.style.fontSize = '12px';
            if (choice.text[stats.language].length > 60) btn.style.minHeight = '64px';
            return btn;
        }

        async function saveChoice(choiceId, effects, memoryTag, options = {}) {
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

            // Обновление прогресс-бара
function updateProgress(sceneId, totalScenes) {
    console.log(`[updateProgress] Обновляем прогресс: ${sceneId + 1}/${totalScenes}`);
    const progressElement = document.getElementById('progress');
    const progressPercent = ((sceneId + 1) / totalScenes) * 100;
    progressElement.style.width = `${progressPercent}%`;
}

// Настройка фона с проверкой
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

// Создание оверлея
   function createOverlayIfNeeded(sceneId, displayText, hasTimer = false, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    console.log(`[createOverlayIfNeeded] Проверка сцены ${sceneId}, hasTimer: ${hasTimer}`);
    const sceneData = scriptData.scenes.find(s => s.id === sceneId) || {};
    
    // Проверяем поле phone в данных сцены
    const hasPhoneField = sceneData.phone === 1;
    
    if (hasPhoneField) {
        if (hasTimer) {
            console.log(`[createOverlayIfNeeded] Создаём showMessengerOverlay для сцены ${sceneId} (phone=1, hasTimer=true)`);
			 
            return showMessengerOverlay(sceneId, generation);
        } else {
            console.log(`[createOverlayIfNeeded] Создаём createDefaultOverlay для сцены ${sceneId} (phone=1, hasTimer=false)`);
			
            return createDefaultOverlay(sceneId, sceneData);
        }
        }
	 
      return null;
      }

// Очистка обработчиков
function clearDialogueHandlers(dialogueBox) {
    console.log('[clearDialogueHandlers] Очистка старых обработчиков');
    dialogueBox.onclick = null;
    dialogueBox.ontouchstart = null;
    document.querySelectorAll('.choice-btn').forEach(btn => btn.remove());
}

  // Обработка выбора
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
   
    // Stage 0E: timeout behavior is explicit story data, never a magic choice id.
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

    async function showScene(sceneId, generation = runtimeGeneration) {
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
        const overlay = (scene.phoneMode === 'messenger' || scene.phone === 1) ? showMessengerOverlay(scene.id, generation) : null;

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

