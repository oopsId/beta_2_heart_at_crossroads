// Stage 0J: flicker-free scene rendering + data-driven phone compose overlay.
// Loaded after stage0i-runtime.js and intentionally overrides only visual/phone paths.

const stage0jDecodedAssets = new Map();

window.stage0jDecodeImage = function stage0jDecodeImage(url) {
    if (!url) return Promise.resolve(true);
    if (stage0jDecodedAssets.has(url)) return stage0jDecodedAssets.get(url);

    const promise = new Promise(resolve => {
        const img = new Image();
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            resolve(Boolean(value));
        };
        const decodeLoaded = async () => {
            try {
                if (typeof img.decode === 'function') await img.decode();
                finish(img.naturalWidth > 0);
            } catch (_error) {
                finish(img.naturalWidth > 0);
            }
        };
        img.onload = decodeLoaded;
        img.onerror = () => finish(false);
        img.src = url;
        if (img.complete && img.naturalWidth > 0) void decodeLoaded();
    });

    stage0jDecodedAssets.set(url, promise);
    return promise;
};

function stage0jInjectStyles() {
    if (document.getElementById('stage0j-styles')) return;
    const style = document.createElement('style');
    style.id = 'stage0j-styles';
    style.textContent = `
        /* Never fade to an intermediate empty frame during technical scene swaps. */
        #background { transition: none !important; }
        #character-left, #character-right {
            animation: none !important;
            transition: transform .3s ease, filter .3s ease !important;
        }

        #phone-compose-overlay {
            position: absolute;
            left: clamp(24px, 5vw, 96px);
            top: clamp(22px, 6vh, 64px);
            width: min(280px, 28vw);
            height: min(430px, 70vh);
            min-width: 220px;
            min-height: 340px;
            z-index: 3;
            pointer-events: none;
            transform: none;
            filter: drop-shadow(0 14px 24px rgba(0,0,0,.28));
        }
        #phone-compose-overlay .stage0j-phone-shell {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            padding: 11px;
            border-radius: 30px;
            background: #2f2f2f;
            border: 2px solid #555;
        }
        #phone-compose-overlay .stage0j-phone-screen {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            border-radius: 21px;
            background:
                linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72)),
                url('assets/backgrounds/bg_phone_ui.png') center / cover no-repeat;
        }
        #phone-compose-overlay .stage0j-phone-header {
            height: 54px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 13px;
            box-sizing: border-box;
            background: rgba(255,255,255,.94);
            border-bottom: 1px solid rgba(0,0,0,.12);
        }
        #phone-compose-overlay .stage0j-header-avatar,
        #phone-compose-overlay .stage0j-notification-avatar {
            object-fit: cover;
            border-radius: 50%;
            background: #ddd;
        }
        #phone-compose-overlay .stage0j-header-avatar {
            width: 31px;
            height: 31px;
        }
        #phone-compose-overlay .stage0j-phone-header strong {
            color: #181818;
            font: 600 14px/1.2 Arial, sans-serif;
        }
        #phone-compose-overlay .stage0j-notification-stack {
            position: absolute;
            top: 67px;
            left: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        #phone-compose-overlay .stage0j-notification {
            display: grid;
            grid-template-columns: 34px 1fr;
            gap: 8px;
            align-items: center;
            min-height: 52px;
            padding: 7px 9px;
            box-sizing: border-box;
            border-radius: 13px;
            background: rgba(255,255,255,.93);
            box-shadow: 0 3px 10px rgba(0,0,0,.12);
            opacity: 0;
            transform: translateY(-7px) scale(.985);
            animation: stage0jNotificationIn .28s ease forwards;
        }
        #phone-compose-overlay .stage0j-notification-avatar {
            width: 34px;
            height: 34px;
        }
        #phone-compose-overlay .stage0j-notification-initial {
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: #e4e4e4;
            color: #333;
            font: 600 14px/1 Arial, sans-serif;
        }
        #phone-compose-overlay .stage0j-notification-copy {
            min-width: 0;
        }
        #phone-compose-overlay .stage0j-notification-copy strong {
            display: block;
            margin-bottom: 2px;
            color: #171717;
            font: 600 12px/1.2 Arial, sans-serif;
        }
        #phone-compose-overlay .stage0j-notification-copy span {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #353535;
            font: 12px/1.25 Arial, sans-serif;
        }
        #phone-compose-overlay .stage0j-compose-input-wrap {
            position: absolute;
            left: 11px;
            right: 11px;
            bottom: 12px;
            display: flex;
            align-items: center;
            min-height: 39px;
            padding: 0 13px;
            box-sizing: border-box;
            border-radius: 19px;
            background: rgba(255,255,255,.96);
            border: 1px solid rgba(0,0,0,.13);
        }
        #phone-compose-overlay .stage0j-compose-placeholder {
            color: #999;
            font: 12px/1 Arial, sans-serif;
        }
        #phone-compose-overlay .stage0j-compose-caret {
            display: inline-block;
            width: 1px;
            height: 18px;
            margin-left: 4px;
            background: #222;
            animation: stage0jCaretBlink 1s steps(1, end) infinite;
        }
        body.stage0j-compose-scene .dialogue-box {
            left: min(34vw, 390px);
            right: 2.5vw;
            bottom: 12%;
            width: auto;
        }
        @keyframes stage0jNotificationIn {
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes stage0jCaretBlink {
            0%, 48% { opacity: 1; }
            49%, 100% { opacity: 0; }
        }
        @media (max-width: 800px) {
            #phone-compose-overlay {
                left: 50%;
                top: 16px;
                transform: translateX(-50%);
                width: min(210px, 56vw);
                height: min(330px, 50vh);
                min-width: 170px;
                min-height: 270px;
            }
            body.stage0j-compose-scene .dialogue-box {
                left: 0;
                right: 0;
                bottom: 0;
                max-height: 45vh;
            }
            #phone-compose-overlay .stage0j-notification-copy span { max-width: 115px; }
        }
        /* Short landscape uses a side-by-side composition instead of stacking phone and dialogue. */
        @media (max-height: 520px) and (orientation: landscape) {
            #phone-compose-overlay {
                left: 12px;
                top: 8px;
                transform: none;
                width: min(190px, 29vw);
                height: calc(100vh - 16px);
                min-width: 0;
                min-height: 0;
                max-height: none;
            }
            body.stage0j-compose-scene .dialogue-box {
                left: min(31vw, 210px);
                right: 8px;
                bottom: 8px;
                width: auto;
                min-height: 0;
                max-height: calc(100vh - 16px);
            }
            #phone-compose-overlay .stage0j-phone-header { height: 46px; padding: 0 9px; }
            #phone-compose-overlay .stage0j-header-avatar { width: 27px; height: 27px; }
            #phone-compose-overlay .stage0j-notification-stack { top: 55px; left: 7px; right: 7px; gap: 5px; }
            #phone-compose-overlay .stage0j-notification { min-height: 46px; padding: 5px 7px; grid-template-columns: 29px 1fr; gap: 6px; }
            #phone-compose-overlay .stage0j-notification-avatar,
            #phone-compose-overlay .stage0j-notification-initial { width: 29px; height: 29px; }
            #phone-compose-overlay .stage0j-compose-input-wrap { left: 7px; right: 7px; bottom: 7px; min-height: 34px; }
        }
    `;
    document.head.appendChild(style);
}

stage0jInjectStyles();

function stage0jResolveCharacterSource(source, runStats = stats) {
    if (!source) return null;
    return source.includes('${stats.appearance}')
        ? source.replace('${stats.appearance}', runStats.appearance)
        : source;
}

function stage0jCharacterUrl(source, runStats = stats) {
    const rendered = stage0jResolveCharacterSource(source, runStats);
    if (!rendered) return null;
    return `assets/characters/${rendered.split('_')[0]}/${rendered}.png`;
}

function stage0jPhoneAssetUrls(scene) {
    if (scene?.phoneMode !== 'compose') return [];
    const config = scene.phoneOverlay || {};
    const urls = ['assets/backgrounds/bg_phone_ui.png'];
    if (config.avatar) urls.push(config.avatar);
    for (const notification of Array.isArray(config.notifications) ? config.notifications : []) {
        if (notification?.avatar) urls.push(notification.avatar);
    }
    return urls;
}

async function stage0jPrepareSceneVisuals(scene, runStats = stats, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    const backgroundUrl = scene?.background && scene.background !== 'none'
        ? `assets/backgrounds/${scene.background}.png`
        : null;
    const leftUrl = stage0jCharacterUrl(scene?.characterLeft, runStats);
    const rightUrl = stage0jCharacterUrl(scene?.characterRight, runStats);
    const urls = [backgroundUrl, leftUrl, rightUrl, ...stage0jPhoneAssetUrls(scene)].filter(Boolean);
    const uniqueUrls = [...new Set(urls)];
    const decoded = await Promise.all(uniqueUrls.map(url => window.stage0jDecodeImage(url)));
    if (!isRunCurrent(generation)) return null;

    const failed = uniqueUrls.filter((_url, index) => !decoded[index]);
    if (failed.length) {
        console.error('[Stage 0J] visual decode failed:', failed);
        showErrorMessage(
            stats.language === 'ru'
                ? `Не удалось подготовить изображение: ${failed[0].split('/').pop()}`
                : `Could not prepare image: ${failed[0].split('/').pop()}`
        );
        return null;
    }

    return {
        backgroundUrl,
        leftUrl,
        rightUrl,
        leftSource: stage0jResolveCharacterSource(scene?.characterLeft, runStats),
        rightSource: stage0jResolveCharacterSource(scene?.characterRight, runStats)
    };
}

function stage0jApplyCharacterState(element, sourceName, url, speakerId, effect) {
    element.classList.remove('character-speaker', 'character-non-speaker', 'shiver', 'heartbeat');
    element.style.backgroundImage = url ? `url('${url}')` : 'none';
    if (url) {
        const characterId = stage0iSpriteCharacterId(sourceName);
        element.classList.add(speakerId && characterId === speakerId ? 'character-speaker' : 'character-non-speaker');
        if (effect === 'shiver' || effect === 'heartbeat') element.classList.add(effect);
    }
}

function stage0jCommitSceneVisuals(scene, prepared, language = stats.language, generation = runtimeGeneration) {
    if (!isRunCurrent(generation) || !prepared) return false;
    const background = document.getElementById('background');
    const charLeft = document.getElementById('character-left');
    const charRight = document.getElementById('character-right');
    const speakerId = stage0iSpeakerCharacterId(scene, language);

    // One synchronous commit: the browser cannot paint a half-cleared scene between these writes.
    background.style.backgroundImage = prepared.backgroundUrl ? `url('${prepared.backgroundUrl}')` : 'none';
    stage0jApplyCharacterState(charLeft, prepared.leftSource, prepared.leftUrl, speakerId, scene.characterLeftEffect);
    stage0jApplyCharacterState(charRight, prepared.rightSource, prepared.rightUrl, speakerId, scene.characterRightEffect);
    charLeft.style.left = scene.characterLeftOffset || '';
    charRight.style.right = scene.characterRightOffset || '';
    document.getElementById('speaker-name').textContent = scene.speaker?.[language] || '';
    document.body.classList.toggle('stage0j-compose-scene', scene.phoneMode === 'compose');
    currentBackground = scene.background || 'none';
    return true;
}

window.stage0jPrepareSceneVisuals = stage0jPrepareSceneVisuals;
window.stage0jCommitSceneVisuals = stage0jCommitSceneVisuals;
window.stage0jRenderSceneVisuals = async function stage0jRenderSceneVisuals(scene, language = stats.language, runStats = stats, generation = runtimeGeneration) {
    const prepared = await stage0jPrepareSceneVisuals(scene, runStats, generation);
    if (!prepared || !isRunCurrent(generation)) return false;
    return stage0jCommitSceneVisuals(scene, prepared, language, generation);
};

// Keep legacy callers safe too: neither helper clears the old image before the replacement is decoded.
setupBackground = async function stage0jSetupBackground(newBackground, language, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    const url = newBackground === 'none' ? null : `assets/backgrounds/${newBackground}.png`;
    if (url && !(await window.stage0jDecodeImage(url))) {
        if (isRunCurrent(generation)) showErrorMessage(language === 'ru' ? `Фон ${newBackground} не найден` : `Background ${newBackground} not found`);
        return null;
    }
    if (!isRunCurrent(generation)) return null;
    document.getElementById('background').style.backgroundImage = url ? `url('${url}')` : 'none';
    return newBackground;
};

setupCharacters = async function stage0jSetupCharacters(scene, language, runStats, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const leftSource = stage0jResolveCharacterSource(scene.characterLeft, runStats);
    const rightSource = stage0jResolveCharacterSource(scene.characterRight, runStats);
    const leftUrl = stage0jCharacterUrl(scene.characterLeft, runStats);
    const rightUrl = stage0jCharacterUrl(scene.characterRight, runStats);
    const urls = [leftUrl, rightUrl].filter(Boolean);
    const ok = await Promise.all(urls.map(url => window.stage0jDecodeImage(url)));
    if (!isRunCurrent(generation) || ok.some(value => !value)) return false;

    const charLeft = document.getElementById('character-left');
    const charRight = document.getElementById('character-right');
    const speakerId = stage0iSpeakerCharacterId(scene, language);
    stage0jApplyCharacterState(charLeft, leftSource, leftUrl, speakerId, scene.characterLeftEffect);
    stage0jApplyCharacterState(charRight, rightSource, rightUrl, speakerId, scene.characterRightEffect);
    charLeft.style.left = scene.characterLeftOffset || '';
    charRight.style.right = scene.characterRightOffset || '';
    document.getElementById('speaker-name').textContent = scene.speaker?.[language] || '';
    return true;
};

function stage0jRemovePhoneOverlays() {
    document.getElementById('phone-compose-overlay')?.remove();
    document.getElementById('messenger-overlay')?.remove();
    document.getElementById('default-phone-overlay')?.remove();
}

function stage0jLocalized(value, fallback = '') {
    if (value && typeof value === 'object') return value[stats.language] || value.ru || value.en || fallback;
    return value == null ? fallback : String(value);
}

function stage0jShowComposeOverlay(scene, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    stage0jRemovePhoneOverlays();
    const config = scene.phoneOverlay || {};
    const overlay = document.createElement('div');
    overlay.id = 'phone-compose-overlay';
    overlay.className = 'phone-overlay';
    overlay.dataset.phoneMode = 'compose';

    const shell = document.createElement('div');
    shell.className = 'stage0j-phone-shell';
    const screen = document.createElement('div');
    screen.className = 'stage0j-phone-screen';

    const header = document.createElement('div');
    header.className = 'stage0j-phone-header';
    if (config.avatar) {
        const avatar = document.createElement('img');
        avatar.className = 'stage0j-header-avatar';
        avatar.src = config.avatar;
        avatar.alt = '';
        header.appendChild(avatar);
    }
    const headerName = document.createElement('strong');
    headerName.textContent = stage0jLocalized(config.header, stats.language === 'ru' ? 'Анна' : 'Anna');
    header.appendChild(headerName);

    const stack = document.createElement('div');
    stack.className = 'stage0j-notification-stack';
    const notifications = Array.isArray(config.notifications) ? config.notifications : [];
    notifications.forEach((notification, index) => {
        const card = document.createElement('div');
        card.className = 'stage0j-notification';
        card.style.animationDelay = `${0.18 + index * 0.42}s`;
        card.dataset.senderId = notification.senderId || '';

        if (notification.avatar) {
            const avatar = document.createElement('img');
            avatar.className = 'stage0j-notification-avatar';
            avatar.src = notification.avatar;
            avatar.alt = '';
            card.appendChild(avatar);
        } else {
            const initial = document.createElement('div');
            initial.className = 'stage0j-notification-initial';
            const sender = stage0jLocalized(notification.sender, '?');
            initial.textContent = sender.trim().charAt(0).toUpperCase() || '?';
            card.appendChild(initial);
        }

        const copy = document.createElement('div');
        copy.className = 'stage0j-notification-copy';
        const senderName = document.createElement('strong');
        senderName.textContent = stage0jLocalized(notification.sender, '');
        const message = document.createElement('span');
        message.textContent = stage0jLocalized(notification.message, '');
        copy.append(senderName, message);
        card.appendChild(copy);
        stack.appendChild(card);
    });

    const input = document.createElement('div');
    input.className = 'stage0j-compose-input-wrap';
    input.setAttribute('aria-label', stage0jLocalized(config.inputPlaceholder, stats.language === 'ru' ? 'Сообщение' : 'Message'));
    const placeholder = document.createElement('span');
    placeholder.className = 'stage0j-compose-placeholder';
    placeholder.textContent = stage0jLocalized(config.inputPlaceholder, stats.language === 'ru' ? 'Сообщение' : 'Message');
    const caret = document.createElement('span');
    caret.className = 'stage0j-compose-caret';
    caret.setAttribute('aria-hidden', 'true');
    input.append(placeholder, caret);

    screen.append(header, stack, input);
    shell.appendChild(screen);
    overlay.appendChild(shell);
    document.getElementById('game-container').appendChild(overlay);
    return overlay;
}

window.stage0jShowComposeOverlay = stage0jShowComposeOverlay;

function stage0jCreatePhoneOverlay(scene, generation = runtimeGeneration, hasTimer = false) {
    if (!isRunCurrent(generation)) return null;
    if (scene.phoneMode === 'compose') return stage0jShowComposeOverlay(scene, generation);
    if (scene.phoneMode === 'messenger') return showMessengerOverlay(scene.id, generation);
    if (scene.phone === 1) return hasTimer ? showMessengerOverlay(scene.id, generation) : createDefaultOverlay(scene.id, scene);
    return null;
}

createOverlayIfNeeded = function stage0jCreateOverlayIfNeeded(sceneId, _displayText, hasTimer = false, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return null;
    const scene = scriptData?.scenes?.find(candidate => candidate.id === sceneId) || {};
    return stage0jCreatePhoneOverlay(scene, generation, hasTimer);
};

showScene = async function stage0jShowScene(sceneId, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const scene = scriptData?.scenes?.find(candidate => candidate.id === sceneId);
    if (!scene) {
        showErrorMessage(stats.language === 'ru' ? `Сцена ${sceneId} не найдена` : `Scene ${sceneId} not found`);
        return false;
    }
    if (getTimeoutConfig(scene)) return showSceneWithTimer(scene, generation);

    updateProgress(sceneId, scriptData.scenes.length);
    const dialogueBox = document.querySelector('.dialogue-box');
    const dialogueElement = document.getElementById('dialogue-text');
    const lastScene = scriptData.scenes[scriptData.scenes.length - 1];
    let displayText = scene.text[stats.language];
    if (stats.completionCount >= 1 && scene.second_playthrough_text) displayText = scene.second_playthrough_text[stats.language];

    const visualsReady = await window.stage0jRenderSceneVisuals(scene, stats.language, stats, generation);
    if (!visualsReady || !isRunCurrent(generation)) return false;

    clearDialogueHandlers(dialogueBox);
    dialogueBox.style.pointerEvents = 'none';
    const overlay = createOverlayIfNeeded(sceneId, displayText, false, generation);

    if (scene.sound) playSound(scene.sound, generation);
    if (scene.music) playMusic(scene.music, generation);
    else if (window.currentMusic) stopRuntimeAudioInstance(window.currentMusic);

    typeText(displayText, dialogueElement, async () => {
        if (!isRunCurrent(generation)) return;
        dialogueBox.style.pointerEvents = 'auto';
        if (scene.choices?.length) {
            await handleChoices(scene, dialogueBox, overlay, generation);
            return;
        }
        const target = resolveSceneTransition(scene);
        if (target.type === 'none') return;
        if (target.type === 'chapter' && lastScene?.id === scene.id) {
            await transitionTo(target, { overlay, generation });
            return;
        }
        bindTransitionHandler(dialogueBox, target, overlay, generation);
    }, generation);
    return true;
};

showSceneWithTimer = function stage0jShowSceneWithTimer(scene, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const timeoutConfig = getTimeoutConfig(scene);
    const dialogueElement = document.getElementById('dialogue-text');
    const dialogueBox = document.querySelector('.dialogue-box');
    updateProgress(scene.id, scriptData.scenes.length);

    let displayText = scene.text[stats.language];
    if (stats.completionCount >= 1 && scene.second_playthrough_text) displayText = scene.second_playthrough_text[stats.language];

    void (async () => {
        const visualsReady = await window.stage0jRenderSceneVisuals(scene, stats.language, stats, generation);
        if (!visualsReady || !isRunCurrent(generation)) return;

        clearDialogueHandlers(dialogueBox);
        dialogueBox.style.pointerEvents = 'none';
        const overlay = stage0jCreatePhoneOverlay(scene, generation, true);

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
                    const handleChoice = async event => {
                        event.preventDefault();
                        if (!isRunCurrent(generation)) return;
                        await applyChoice(choice, { overlay, cleanup: cleanupTimer, generation });
                    };
                    btn.addEventListener('click', handleChoice);
                }
                dialogueBox.appendChild(btn);
            });

            let timeLeft = Math.ceil(timeoutConfig.seconds);
            const countdownElement = document.createElement('div');
            countdownElement.id = 'timer-countdown';
            countdownElement.textContent = timeLeft;
            document.getElementById('game-container').appendChild(countdownElement);

            tickSound = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
            tickSound.play().catch(() => {});
            countdownInterval = runtimeSetInterval(() => {
                if (!isRunCurrent(generation)) return;
                timeLeft = Math.max(0, timeLeft - 1);
                countdownElement.textContent = timeLeft;
                if (overlay) {
                    overlay.classList.add('flash-svg');
                    runtimeSetTimeout(() => {
                        if (isRunCurrent(generation)) overlay.classList.remove('flash-svg');
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
                await applyTimeoutOutcome(scene, timeoutConfig, { overlay, cleanup: cleanupTimer, generation });
            }, timeoutConfig.seconds * 1000, generation);
        }, generation);
    })();
    return true;
};

showEnding = function stage0jShowEnding(ending, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const scene = ending?.scenes?.[0];
    if (!scene) return false;
    void (async () => {
        const visualsReady = await window.stage0jRenderSceneVisuals(scene, stats.language, stats, generation);
        if (!visualsReady || !isRunCurrent(generation)) return;
        const dialogueElement = document.getElementById('dialogue-text');
        const text = stats.completionCount >= 1 && scene.second_playthrough_text
            ? scene.second_playthrough_text[stats.language]
            : scene.text[stats.language];
        typeText(text, dialogueElement, () => {
            if (isRunCurrent(generation)) showEpilogue(ending.epilogue[stats.language], generation);
        }, generation);
        if (scene.sound) playSound(scene.sound, generation);
        if (scene.music) playMusic(scene.music, generation);
    })();
    return true;
};
