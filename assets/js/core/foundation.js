
         // Добавляем данные о карточках в начало скрипта
        const cardSeries = {
            "romance": {
                title: "Романтика",
                titleEn: "Romance",
                cards: [                    { id: "card_sergey_and_wife", name: "Сергей и его жена", nameEn: "Sergey and his wife", unlock: "второе прохождение", unlockEn: "second playthrough" },                    { id: "card_anna_and_dima_final", name: "Анна и Дима: фото из финала", nameEn: "Anna and Dima: final photo", unlock: "второе прохождение", unlockEn: "second playthrough" },                    { id: "card_mark_childhood", name: "Марк в детстве", nameEn: "Mark as a child", unlock: "50", unlockEn: "50" },                    { id: "card_katya_and_anna_bff_birthday", name: "Катя и Анна: подруги на дне рожденья", nameEn: "Katya and Anna: friends at a birthday party", unlock: "50", unlockEn: "50" }                ],
                style: "Прошлое остается навсегда",
                styleEn: "The past remains forever"
            }
        };

        // Добавляем SVG украшения
        const svgDecorations = {
            rosePetal: `<svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <path d="M10,25 Q25,5 40,25 Q25,45 10,25 Z" fill="#f8d7da" stroke="#e8b5b9" stroke-width="1" opacity="0.8" />
                <path d="M15,25 Q25,10 35,25 Q25,40 15,25 Z" fill="#f0c1c4" stroke="none" opacity="0.6" />
            </svg>`,
            filmScratch: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <filter id="noise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 0.15 0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#noise)" opacity="0.08" />
                <line x1="${Math.random() * 100}%" y1="0" x2="${Math.random() * 100}%" y2="100%" stroke="white" stroke-width="0.5" opacity="0.2" />
                <line x1="${Math.random() * 100}%" y1="0" x2="${Math.random() * 100}%" y2="100%" stroke="white" stroke-width="0.8" opacity="0.1" />
            </svg>`
        };

        // Stage 0C: one browser runtime, with isolated run/profile persistence.
        const STORAGE_NAMESPACE = 'heart_at_crossroads_beta2:v1:';
        const RUN_STORAGE_KEY = 'run';
        const PROFILE_STORAGE_KEY = 'profile';
        const ACCESS_STORAGE_KEY = 'tempAccessGranted';
        const STATE_VERSION = 1;

        const DEFAULT_PROFILE_STATE = Object.freeze({
            language: "ru",
            isAuthorized: false,
            memories: [],
            completionCount: 0
        });

        let profileState = {
            ...DEFAULT_PROFILE_STATE,
            memories: []
        };

        function createFreshRunStats(hasReturnedViaMenu = false) {
            return {
                crown: 0,
                heart: 0,
                leaf: 0,
                diamonds: 10,
                relationships: { mark: 0, lera: 0, vika: 0, sergey: 0, anna: 0, dima: 0, lyosha: 0 },
                appearance: "style1",
                hasReturnedViaMenu,
                language: profileState.language,
                isAuthorized: profileState.isAuthorized,
                memories: [...profileState.memories],
                completionCount: profileState.completionCount
            };
        }

        let currentChapter = 1;
        let currentScene = 0;
        let choices = [];
        let stats = createFreshRunStats(false);
        let isTyping = false;
        let scriptData = null;
        let currentBackground = null;
        const correctPassword = "umbertoeco";
        const tempPassword = "999000";

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

        function playSound(sound, generation = runtimeGeneration) {
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

        function showErrorMessage(message) {
            const generation = runtimeGeneration;
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
            runtimeSetTimeout(() => errorDiv.remove(), 3000, generation);
        }

        // Browser-only persistence. Keys are namespaced because all oopsid.github.io projects share one origin.
        function storageKey(key) {
            return `${STORAGE_NAMESPACE}${key}`;
        }

        function saveToStorage(key, value) {
            return new Promise((resolve, reject) => {
                try {
                    localStorage.setItem(storageKey(key), String(value));
                    resolve();
                } catch (error) {
                    console.error(`Ошибка сохранения в localStorage: ${key}`, error);
                    reject(error);
                }
            });
        }

        function getFromStorage(key) {
            return new Promise((resolve, reject) => {
                try {
                    resolve(localStorage.getItem(storageKey(key)));
                } catch (error) {
                    console.error(`Ошибка чтения localStorage: ${key}`, error);
                    reject(error);
                }
            });
        }

        function removeFromStorage(key) {
            return new Promise((resolve, reject) => {
                try {
                    localStorage.removeItem(storageKey(key));
                    resolve();
                } catch (error) {
                    console.error(`Ошибка удаления из localStorage: ${key}`, error);
                    reject(error);
                }
            });
        }

        function normalizeProfile(candidate) {
            const value = candidate && typeof candidate === 'object' ? candidate : {};
            return {
                language: value.language === 'en' ? 'en' : 'ru',
                isAuthorized: value.isAuthorized === true,
                memories: Array.isArray(value.memories) ? [...new Set(value.memories.filter(v => typeof v === 'string'))] : [],
                completionCount: Number.isInteger(value.completionCount) && value.completionCount >= 0 ? value.completionCount : 0
            };
        }

        function syncProfileFromStats() {
            profileState = normalizeProfile({
                language: stats.language,
                isAuthorized: stats.isAuthorized,
                memories: stats.memories,
                completionCount: stats.completionCount
            });
        }

        function applyProfileToStats() {
            stats.language = profileState.language;
            stats.isAuthorized = profileState.isAuthorized;
            stats.memories = [...profileState.memories];
            stats.completionCount = profileState.completionCount;
        }

        async function saveProfile() {
            syncProfileFromStats();
            await saveToStorage(PROFILE_STORAGE_KEY, JSON.stringify({
                version: STATE_VERSION,
                ...profileState
            }));
        }

        async function loadProfile() {
            const rawProfile = await getFromStorage(PROFILE_STORAGE_KEY);
            if (!rawProfile) {
                profileState = normalizeProfile(DEFAULT_PROFILE_STATE);
                applyProfileToStats();
                return false;
            }
            try {
                const parsed = JSON.parse(rawProfile);
                profileState = normalizeProfile(parsed);
                applyProfileToStats();
                return true;
            } catch (error) {
                console.warn('Повреждён профиль beta_2, использованы значения по умолчанию:', error);
                profileState = normalizeProfile(DEFAULT_PROFILE_STATE);
                applyProfileToStats();
                return false;
            }
        }

        function serializeRunState() {
            return {
                version: STATE_VERSION,
                currentScene,
                currentChapter,
                choices: [...choices],
                stats: {
                    crown: stats.crown,
                    heart: stats.heart,
                    leaf: stats.leaf,
                    diamonds: stats.diamonds,
                    relationships: { ...stats.relationships },
                    appearance: stats.appearance,
                    hasReturnedViaMenu: stats.hasReturnedViaMenu === true
                }
            };
        }

        function validateRunState(session) {
            if (!session || typeof session !== 'object') throw new Error('run state is not an object');
            if (session.version !== STATE_VERSION) throw new Error(`unsupported run version: ${session.version}`);
            if (!Number.isInteger(session.currentChapter) || session.currentChapter < 1 || session.currentChapter > 10) throw new Error('invalid currentChapter');
            if (!Number.isInteger(session.currentScene) || session.currentScene < 0) throw new Error('invalid currentScene');
            if (!Array.isArray(session.choices)) throw new Error('invalid choices');
            if (!session.stats || typeof session.stats !== 'object') throw new Error('invalid stats');
            return session;
        }

        async function saveSession() {
            try {
                await saveProfile();
                await saveToStorage(RUN_STORAGE_KEY, JSON.stringify(serializeRunState()));
                console.log('Прохождение beta_2 сохранено');
                return true;
            } catch (error) {
                console.error('Ошибка сохранения прохождения:', error);
                showDebugMessage('Ошибка сохранения сессии');
                return false;
            }
        }

        async function deleteRun() {
            await removeFromStorage(RUN_STORAGE_KEY);
        }

        // Утилита для событий
        const addEventListeners = (element, events, handler) => {
            events.forEach(event => {
                element.addEventListener(event, handler);
                console.log(`Привязан ${event} к ${element.id}`);
            });
        };

        // Загрузка DOM
        document.addEventListener('DOMContentLoaded', () => {
            const startGameBtn = document.getElementById('start-game');
            const continueGameBtn = document.getElementById('continue-game');
            const showPasswordBtn = document.getElementById('show-password');
            const passwordSubmitBtn = document.getElementById('password-submit');
            const menuBtn = document.getElementById('menu-btn');
            const statsBtn = document.getElementById('stats');
            const galleryBtn = document.getElementById('gallery-btn');
            const languageBtn = document.getElementById('language-btn');
            const languageIcon = document.getElementById('language-icon');

            if (!startGameBtn) console.error('Кнопка start-game не найдена!');
            updateLanguage(stats.language);

            // Обработчики с логированием
            function handleStartGame(e) {
                e.preventDefault();
                console.log('handleStartGame вызван');
                checkTempPassword(() => startNewGame());
            }

            function handleContinueGame(e) {
                e.preventDefault();
                console.log('handleContinueGame вызван');
                checkTempPassword(async () => {
                    const generation = beginRuntimeSession('continue');
                    const loaded = await loadSession(generation);
                    if (!isRunCurrent(generation)) return;
                    if (loaded) {
                        await startGame(generation);
                    } else {
                        invalidateRuntimeSession('continue-without-run');
                    }
                });
            }

            function handleShowPassword(e) {
                e.preventDefault();
                console.log('handleShowPassword вызван');
                document.getElementById('password-form').style.display = 'flex';
                document.querySelector('.start-buttons').style.display = 'none';
            }

            async function handlePasswordSubmit(e) {
                e.preventDefault();
                console.log('handlePasswordSubmit вызван');
                const inputPassword = document.getElementById('password-input').value;
                try {
                    if (inputPassword === tempPassword || inputPassword === correctPassword) {
                        await saveToStorage('tempAccessGranted', true);
                        if (inputPassword === correctPassword) {
                            stats.isAuthorized = true;
                        }
                        startNewGame();
                    } else {
                        alert(stats.language === "ru" ? 'Неверный пароль!' : 'Incorrect password!');
                    }
                } catch (error) {
                    console.error('Ошибка обработки пароля:', error);
                    alert(stats.language === "ru" ? 'Ошибка авторизации.' : 'Authorization error.');
                }
            }

            async function handleMenu(e) {
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

            function handleShowStats(e) {
                e.preventDefault();
                console.log('handleShowStats вызван');
                const statsText = stats.language === "ru" ?
                    `Короны: ${stats.crown}\nСердце: ${stats.heart}\nЛист: ${stats.leaf}\nБриллианты: ${stats.diamonds}\nОтношения:\nМарк: ${stats.relationships.mark}\nЛера: ${stats.relationships.lera}\nВика: ${stats.relationships.vika}\nСергей: ${stats.relationships.sergey}\nАнна: ${stats.relationships.anna}\nДима: ${stats.relationships.dima}\nЛёша: ${stats.relationships.lyosha}` :
                    `Crowns: ${stats.crown}\nHeart: ${stats.heart}\nLeaf: ${stats.leaf}\nDiamonds: ${stats.diamonds}\nRelationships:\nMark: ${stats.relationships.mark}\nLera: ${stats.relationships.lera}\nVika: ${stats.relationships.vika}\nSergey: ${stats.relationships.sergey}\nAnna: ${stats.relationships.anna}\nDima: ${stats.relationships.dima}\nLesha: ${stats.relationships.lyosha}`;
                alert(statsText);
            }

            function handleShowGallery(e) {
            e.preventDefault();
            console.log('handleShowGallery вызван');
            showPremiumGallery();
                }

            function handleLanguageSwitch(e) {
                e.preventDefault();
                console.log('handleLanguageSwitch вызван');
                stats.language = stats.language === "ru" ? "en" : "ru";
                languageIcon.textContent = stats.language === "ru" ? "🇷🇺" : "🇬🇧";
                updateLanguage(stats.language);
                saveProfile();
            }

            // Привязка событий
            addEventListeners(startGameBtn, ['click', 'touchstart'], handleStartGame);
            addEventListeners(continueGameBtn, ['click', 'touchstart'], handleContinueGame);
            addEventListeners(showPasswordBtn, ['click', 'touchstart'], handleShowPassword);
            addEventListeners(passwordSubmitBtn, ['click', 'touchstart'], handlePasswordSubmit);
            addEventListeners(menuBtn, ['click', 'touchstart'], handleMenu);
            addEventListeners(statsBtn, ['click', 'touchstart'], handleShowStats);
            addEventListeners(galleryBtn, ['click', 'touchstart'], (e) => e.preventDefault());
            addEventListeners(galleryBtn, ['click', 'touchstart'], handleShowGallery);
            addEventListeners(languageBtn, ['click', 'touchstart'], handleLanguageSwitch);

            // Кнопка "Назад"
            const backButton = document.createElement('button');
            backButton.id = 'back-button';
            backButton.textContent = stats.language === "ru" ? "Назад" : "Back";
            addEventListeners(backButton, ['click', 'touchstart'], (e) => {
                e.preventDefault();
                console.log('backButton вызван');
                document.getElementById('password-form').style.display = 'none';
                document.querySelector('.start-buttons').style.display = 'flex';
            });
            document.getElementById('password-form').appendChild(backButton);

            // Инициализация: профиль переживает reload, run загружается только кнопкой «Продолжить».
            loadProfile()
                .then(() => {
                    updateLanguage(stats.language);
                    languageIcon.textContent = stats.language === "ru" ? "🇷🇺" : "🇬🇧";
                    showStartScreen();
                })
                .catch(error => {
                    console.error('Ошибка загрузки профиля:', error);
                    showStartScreen();
                });
        });

        // Остальные функции
        function clearEventListeners(element, events) {
        events.forEach(event => {
        element.removeEventListener(event, element[event + 'Handler']);
        element[event + 'Handler'] = null;
       });
       }

    function showStartScreen() {
    console.log('showStartScreen вызван');
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const galleryContainer = document.getElementById('gallery-container');
    const languageBtn = document.getElementById('language-btn');

    startScreen.style.display = 'flex';
    languageBtn.style.display = 'block';
    gameContainer.style.display = 'none';
    galleryContainer.style.display = 'none'; // Убеждаемся, что галерея скрыта
}

        function resetGameState(hasReturnedViaMenu = false) {
            console.log('resetGameState вызван');
            currentChapter = 1;
            currentScene = 0;
            choices = [];
            stats = createFreshRunStats(hasReturnedViaMenu);
            scriptData = null;
            currentBackground = null;
        }

        function updateLanguage(lang) {
            console.log('updateLanguage вызван с языком:', lang);
            document.getElementById('start-game').textContent = document.getElementById('start-game').getAttribute(`data-${lang}`);
            document.getElementById('continue-game').textContent = document.getElementById('continue-game').getAttribute(`data-${lang}`);
            document.getElementById('show-password').textContent = document.getElementById('show-password').getAttribute(`data-${lang}`);
            document.getElementById('password-submit').textContent = document.getElementById('password-submit').getAttribute(`data-${lang}`);
            document.getElementById('menu-btn').textContent = document.getElementById('menu-btn').getAttribute(`data-${lang}`);
            document.getElementById('gallery-btn').textContent = document.getElementById('gallery-btn').getAttribute(`data-${lang}`);
            const title = document.getElementById('title');
            title.innerHTML = lang === "ru" ? '<span>Сердце</span><span>на перекрёстке</span>' : '<span>Heart</span><span>at the Crossroads</span>';
            title.className = lang === "ru" ? "ru" : "en";
        }

        async function checkTempPassword(callback) {
            try {
                const granted = await getFromStorage('tempAccessGranted');
                if (granted) {
                    console.log('Временный доступ уже предоставлен');
                    callback();
                } else {
                    const input = prompt(stats.language === "ru" ? 'Игра закрыта на доработку. Введите пароль:' : 'Game is under refinement. Enter password:');
                    if (input === tempPassword || input === correctPassword) {
                        await saveToStorage('tempAccessGranted', true);
                        if (input === correctPassword) stats.isAuthorized = true;
                        console.log('Пароль верный, доступ предоставлен');
                        callback();
                    } else {
                        alert(stats.language === "ru" ? 'Неверный пароль!' : 'Incorrect password!');
                    }
                }
            } catch (error) {
                console.error('Ошибка проверки пароля:', error);
                alert(stats.language === "ru" ? 'Ошибка доступа.' : 'Access error.');
            }
        }

        async function startNewGame() {
            console.log('startNewGame вызван');
            const generation = beginRuntimeSession('new-game');
            resetGameState(false);
            await saveSession();
            if (!isRunCurrent(generation)) return false;
            return await startGame(generation);
        }

        async function loadSession(generation = runtimeGeneration) {
            try {
                if (!isRunCurrent(generation)) return false;
                await loadProfile();
                if (!isRunCurrent(generation)) return false;
                const rawSession = await getFromStorage(RUN_STORAGE_KEY);
                if (!isRunCurrent(generation)) return false;
                if (!rawSession) {
                    showErrorMessage(stats.language === "ru" ? 'Нет сохранённого прохождения' : 'No saved playthrough');
                    return false;
                }

                const session = validateRunState(JSON.parse(rawSession));
                const runStats = session.stats;
                currentChapter = session.currentChapter;
                currentScene = session.currentScene;
                choices = [...session.choices];
                stats = createFreshRunStats(runStats.hasReturnedViaMenu === true);
                stats.crown = Number(runStats.crown) || 0;
                stats.heart = Number(runStats.heart) || 0;
                stats.leaf = Number(runStats.leaf) || 0;
                stats.diamonds = Number.isFinite(Number(runStats.diamonds)) ? Number(runStats.diamonds) : 10;
                stats.relationships = {
                    ...stats.relationships,
                    ...(runStats.relationships && typeof runStats.relationships === 'object' ? runStats.relationships : {})
                };
                // Stage 0I: migrate pre-0I beta saves that could contain both lesha and lyosha.
                const legacyLesha = Number(stats.relationships.lesha) || 0;
                stats.relationships.lyosha = (Number(stats.relationships.lyosha) || 0) + legacyLesha;
                delete stats.relationships.lesha;
                stats.appearance = typeof runStats.appearance === 'string' ? runStats.appearance : 'style1';
                applyProfileToStats();
                console.log('Прохождение beta_2 восстановлено:', { currentChapter, currentScene });
                return true;
            } catch (error) {
                console.error('Ошибка загрузки прохождения:', error);
                await deleteRun().catch(() => {});
                showErrorMessage(stats.language === "ru" ? 'Сохранение повреждено и удалено' : 'Saved game was corrupted and removed');
                return false;
            }
        }

               function showMessengerOverlay(sceneId, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    console.log(`Создание оверлея для сцены ${sceneId}`);
    const existingOverlay = document.getElementById('messenger-overlay');
    if (existingOverlay) existingOverlay.remove();

    const sceneData = scriptData.scenes.find(s => s.id === sceneId) || {};

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'messenger-overlay');
    svg.setAttribute('width', '240');
    svg.setAttribute('height', '400');
    svg.setAttribute('viewBox', '0 0 300 500');
    svg.classList.add('phone-overlay');

    let avatarSrc = '';
    let senderName = '';
    let messages = [];

    if (currentChapter === 1 && sceneId === 7) {
        avatarSrc = "assets/characters/lyosha/lyosha_messenger_ava.png";
        senderName = "Лёша";
        messages = [
            "Тусим вечером",
            "Дима будет",
            "Приходи"
        ];
    } else if (currentChapter === 1 && sceneId === 21) {
        avatarSrc = "assets/characters/mark/mark_messenger_ava.png";
        senderName = "Марк";
        messages = stats.language === "ru"
            ? ["Ты красивая,", "когда теряешься"]
            : ["You’re beautiful", "when you’re lost"];
    } else if (sceneData.phoneSenderName && sceneData.phoneMessages) {
        const senderId = sceneData.phoneSenderId || 'unknown';
        senderName = sceneData.phoneSenderName[stats.language] || sceneData.phoneSenderName.ru || "Unknown";
        avatarSrc = `assets/characters/${senderId}/${senderId}_messenger_ava.png`;

        const rawMessages = sceneData.phoneMessages[stats.language] || [];
        messages = Array.isArray(rawMessages) ? rawMessages : [String(rawMessages)];
    } else {
        // Последний fallback — только чтобы не падало, но не для красоты
        senderName = sceneData.speaker?.[stats.language] || "Unknown";

        const senderId = (
            sceneData.speaker?.en?.toLowerCase() ||
            sceneData.speaker?.ru?.toLowerCase() ||
            "unknown"
        );

        avatarSrc = `assets/characters/${senderId}/${senderId}_messenger_ava.png`;

        const fallbackText = sceneData.text?.[stats.language] || "Сообщение...";
        messages = [fallbackText.length > 28 ? `${fallbackText.slice(0, 28)}...` : fallbackText];
    }

    const bubbleX = 50;
    const bubbleWidth = 180;
    const bubblePaddingTop = 18;
    const bubbleLineHeight = 18;
    const bubbleGap = 14;

    let currentY = 120;

    const renderedMessages = messages.map((msg, idx) => {
        const lines = wrapTextForSvg(msg, 18);
        const bubbleHeight = Math.max(40, 18 + lines.length * bubbleLineHeight);

        const tspans = lines.map((line, lineIdx) => {
            const dy = lineIdx === 0 ? 0 : bubbleLineHeight;
            return `<tspan x="${bubbleX + 12}" dy="${dy}">${escapeXml(line)}</tspan>`;
        }).join('');

        const block = `
            <rect id="msg${idx + 1}" x="${bubbleX}" y="${currentY}" width="${bubbleWidth}" height="${bubbleHeight}" rx="10" fill="#E1F5C4"/>
            <text id="text${idx + 1}" x="${bubbleX + 12}" y="${currentY + bubblePaddingTop}" fill="#000" font-size="14" font-family="Arial, sans-serif">
                ${tspans}
            </text>
        `;

        currentY += bubbleHeight + bubbleGap;
        return block;
    }).join('');

    const replyBubbleY = currentY + 20;

    svg.innerHTML = `
        <rect x="20" y="20" width="260" height="460" rx="30" fill="#333" stroke="#555" stroke-width="2"/>
        <rect x="30" y="50" width="240" height="400" rx="10" fill="#fff"/>
        <image href="assets/backgrounds/bg_phone_ui.png" x="30" y="50" width="240" height="400" preserveAspectRatio="xMidYMid slice" opacity="0.3"/>

        <rect x="30" y="50" width="240" height="50" fill="#fff"/>
        <clipPath id="avatarClip">
            <circle cx="60" cy="75" r="15"/>
        </clipPath>
        <image href="${avatarSrc}" x="45" y="60" width="30" height="30" clip-path="url(#avatarClip)"/>
        <circle cx="60" cy="75" r="15" fill="none" stroke="#ccc" stroke-width="1"/>
        <text x="85" y="85" fill="#000" font-size="16" font-family="Arial, sans-serif">${escapeXml(senderName)}</text>
        <line x1="30" y1="100" x2="270" y2="100" stroke="#ccc" stroke-width="1"/>

        <g class="messages">
            ${renderedMessages}
            <rect id="reply-msg" x="120" y="${replyBubbleY}" width="100" height="40" rx="10" fill="#fff" stroke="#ccc" stroke-width="1"/>
            <text id="reply-text" x="130" y="${replyBubbleY + 25}" fill="#000" font-size="14" font-family="Arial, sans-serif" opacity="0">...</text>
        </g>
    `;

    document.getElementById('game-container').appendChild(svg);

    if (window.gsap) {
        gsap.from(svg, { y: -20, opacity: 0, duration: 0.5 });
        gsap.to('#reply-text', {
            opacity: 1,
            duration: 0,
            delay: 0.6,
            onStart: function () {
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
        });
    }

    return svg;
}

function wrapTextForSvg(text, maxCharsPerLine) {
    const words = String(text).split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function createDefaultOverlay(sceneId, sceneData = {}) {
    console.log(`Создание стандартного оверлея для сцены ${sceneId}`);

    const existingOverlay = document.getElementById('default-phone-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'default-phone-overlay';
    overlay.classList.add('phone-overlay');

    overlay.style.background = 'url(assets/backgrounds/bg_phone_ui.png) no-repeat center/cover';
    overlay.style.position = 'absolute';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.width = '240px';
    overlay.style.height = '400px';
    overlay.style.borderRadius = '24px';
    overlay.style.overflow = 'hidden';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2';

    const header = document.createElement('div');
    header.textContent = stats.language === 'ru' ? 'Ответить' : 'Reply';
    header.style.position = 'absolute';
    header.style.top = '18px';
    header.style.left = '0';
    header.style.right = '0';
    header.style.textAlign = 'center';
    header.style.fontSize = '16px';
    header.style.fontWeight = 'bold';
    header.style.color = '#222';
    overlay.appendChild(header);

    const body = document.createElement('div');
    body.style.position = 'absolute';
    body.style.top = '70px';
    body.style.left = '20px';
    body.style.right = '20px';
    body.style.bottom = '30px';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.justifyContent = 'flex-start';
    body.style.gap = '10px';
    overlay.appendChild(body);

    const rawChoices = Array.isArray(sceneData.choices) ? sceneData.choices : [];
    const visibleChoices = rawChoices
        .filter(choice => choice && choice.text && choice.text[stats.language])
        .slice(0, 3);

    if (visibleChoices.length > 0) {
        visibleChoices.forEach(choice => {
            const bubble = document.createElement('div');

            let text = choice.text[stats.language]
                .replace(/\s*\(\d+\s*сек\)/i, '')
                .replace(/\s*\(\d+\s*sec\)/i, '')
                .replace(/\s*\(\d+\s*бриллиант(?:ов|а)?\)/i, '')
                .replace(/\s*\(\d+\s*diamonds?\)/i, '')
                .trim();

            bubble.textContent = text;
            bubble.style.alignSelf = 'flex-end';
            bubble.style.maxWidth = '80%';
            bubble.style.padding = '10px 12px';
            bubble.style.borderRadius = '14px';
            bubble.style.background = '#DCF8C6';
            bubble.style.color = '#111';
            bubble.style.fontSize = '13px';
            bubble.style.lineHeight = '1.3';
            bubble.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';

            body.appendChild(bubble);
        });
    } else {
        const draftBubble = document.createElement('div');
        draftBubble.textContent = stats.language === 'ru' ? '...' : '...';
        draftBubble.style.alignSelf = 'flex-end';
        draftBubble.style.maxWidth = '50%';
        draftBubble.style.padding = '10px 12px';
        draftBubble.style.borderRadius = '14px';
        draftBubble.style.background = '#DCF8C6';
        draftBubble.style.color = '#111';
        draftBubble.style.fontSize = '13px';
        draftBubble.style.lineHeight = '1.3';
        draftBubble.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';

        body.appendChild(draftBubble);
    }

    document.getElementById('game-container').appendChild(overlay);
    return overlay;
}


