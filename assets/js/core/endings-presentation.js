        async function loadFinals(endingId, generation = runtimeGeneration) {
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



     
function checkCondition(condition) {
    if (!condition) return true;
    const [key, operator, value] = condition.split(' ');
    const statValue = stats[key] || stats.relationships[key] || 0;
    const compareValue = parseInt(value);
    switch (operator) {
        case '>': return statValue > compareValue;
        case '<': return statValue < compareValue;
        case '>=': return statValue >= compareValue;
        case '<=': return statValue <= compareValue;
        case '==': return statValue == compareValue;
        case '!=': return statValue != compareValue;
        default: return false;
    }
}

 function typeText(text, element, callback, generation = runtimeGeneration) {
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


        
        
function fadeOut(callback, generation = runtimeGeneration) {
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

function showChoiceEffects(effects, generation = runtimeGeneration) {
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

