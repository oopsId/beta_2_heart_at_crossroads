// Stage 0I: behavioral hardening layered over the stabilized 0A-0H runtime.
// This file intentionally stays separate from the legacy monolithic HTML so the VN-specific
// behavior (eligibility, speaker focus, typewriter rhythm) is reviewable and regression-testable.

let stage0iFinalsCache = null;
let stage0iFinalsPromise = null;

function stage0iCompare(left, operator, right) {
    switch (operator) {
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==': return left === right;
        case '!=': return left !== right;
        default: return false;
    }
}

function stage0iRequirementValue(expression) {
    if (typeof expression === 'number' && Number.isFinite(expression)) return expression;
    if (!expression || typeof expression !== 'object' || Array.isArray(expression)) return NaN;

    if (typeof expression.stat === 'string') {
        return Number(stats?.[expression.stat] ?? 0);
    }
    if (typeof expression.relationship === 'string') {
        return Number(stats?.relationships?.[expression.relationship] ?? 0);
    }
    if (Array.isArray(expression.sum)) {
        return expression.sum.reduce((total, item) => total + stage0iRequirementValue(item), 0);
    }
    if (Array.isArray(expression.max) && expression.max.length) {
        return Math.max(...expression.max.map(stage0iRequirementValue));
    }
    if (Array.isArray(expression.min) && expression.min.length) {
        return Math.min(...expression.min.map(stage0iRequirementValue));
    }
    if (Array.isArray(expression.subtract) && expression.subtract.length === 2) {
        return stage0iRequirementValue(expression.subtract[0]) - stage0iRequirementValue(expression.subtract[1]);
    }
    return NaN;
}

function stage0iEvaluateRequirement(requirement) {
    if (!requirement) return true;
    if (typeof requirement !== 'object' || Array.isArray(requirement)) return false;

    if (Array.isArray(requirement.all)) {
        return requirement.all.every(stage0iEvaluateRequirement);
    }
    if (Array.isArray(requirement.any)) {
        return requirement.any.some(stage0iEvaluateRequirement);
    }
    if (Object.prototype.hasOwnProperty.call(requirement, 'not')) {
        return !stage0iEvaluateRequirement(requirement.not);
    }
    if (typeof requirement.choice === 'string') {
        return Array.isArray(choices) && choices.includes(requirement.choice);
    }
    if (typeof requirement.memory === 'string') {
        return Array.isArray(stats?.memories) && stats.memories.includes(requirement.memory);
    }
    if (typeof requirement.stat === 'string' && typeof requirement.op === 'string') {
        return stage0iCompare(Number(stats?.[requirement.stat] ?? 0), requirement.op, Number(requirement.value));
    }
    if (typeof requirement.relationship === 'string' && typeof requirement.op === 'string') {
        return stage0iCompare(Number(stats?.relationships?.[requirement.relationship] ?? 0), requirement.op, Number(requirement.value));
    }
    if (requirement.compare && typeof requirement.compare === 'object') {
        const { left, op, right } = requirement.compare;
        const leftValue = stage0iRequirementValue(left);
        const rightValue = stage0iRequirementValue(right);
        return Number.isFinite(leftValue) && Number.isFinite(rightValue) && stage0iCompare(leftValue, op, rightValue);
    }
    return false;
}

async function stage0iEnsureFinals(generation = runtimeGeneration) {
    if (stage0iFinalsCache) return stage0iFinalsCache;
    if (!stage0iFinalsPromise) {
        stage0iFinalsPromise = fetch('assets/data/finals.json')
            .then(response => {
                if (!response.ok) throw new Error(`Finals HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (!data || !Array.isArray(data.endings)) throw new Error('Invalid finals.json');
                stage0iFinalsCache = data;
                return data;
            })
            .finally(() => {
                stage0iFinalsPromise = null;
            });
    }
    const data = await stage0iFinalsPromise;
    if (!isRunCurrent(generation)) return null;
    return data;
}

function stage0iFindEnding(endingId, finalsData = stage0iFinalsCache) {
    const normalized = resolveEndingId(endingId);
    return Array.isArray(finalsData?.endings)
        ? finalsData.endings.find(ending => ending.id === normalized) || null
        : null;
}

function stage0iEndingEligible(endingId, finalsData = stage0iFinalsCache) {
    const ending = stage0iFindEnding(endingId, finalsData);
    return Boolean(ending) && stage0iEvaluateRequirement(ending.requirements);
}

function stage0iLockedEndingMessage() {
    return stats.language === 'ru'
        ? 'Этот путь не открыт вашими решениями в этом прохождении'
        : 'Your choices in this playthrough have not opened this path';
}

// Expose read-only helpers for permanent browser regression tests.
window.stage0iEvaluateRequirement = stage0iEvaluateRequirement;
window.stage0iEndingEligible = stage0iEndingEligible;
window.stage0iEnsureFinals = stage0iEnsureFinals;

const stage0iBaseApplyChoice = applyChoice;
applyChoice = async function stage0iApplyChoice(choice, options = {}) {
    const generation = options.generation ?? runtimeGeneration;
    if (!isRunCurrent(generation)) return false;

    if (choice?.endingId) {
        let finalsData;
        try {
            finalsData = await stage0iEnsureFinals(generation);
        } catch (error) {
            if (isRunCurrent(generation)) {
                console.error('[eligibility] Unable to load finals:', error);
                showErrorMessage(stats.language === 'ru' ? 'Не удалось проверить доступность финала' : 'Could not check ending availability');
            }
            return false;
        }
        if (!isRunCurrent(generation) || !finalsData) return false;
        if (!stage0iEndingEligible(choice.endingId, finalsData)) {
            showErrorMessage(stage0iLockedEndingMessage());
            return false;
        }
    }

    return await stage0iBaseApplyChoice(choice, options);
};

handleChoices = async function stage0iHandleChoices(scene, dialogueBox, overlay, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    dialogueBox.style.pointerEvents = 'auto';
    if (!scene.choices || scene.choices.length === 0) return false;

    if (getTimeoutConfig(scene)) {
        showSceneWithTimer(scene, generation);
        return true;
    }

    const hasEndingChoices = scene.choices.some(choice => typeof choice.endingId === 'string');
    let finalsData = null;
    if (hasEndingChoices) {
        try {
            finalsData = await stage0iEnsureFinals(generation);
        } catch (error) {
            if (isRunCurrent(generation)) {
                console.error('[eligibility] Unable to prepare final choices:', error);
                showErrorMessage(stats.language === 'ru' ? 'Не удалось проверить финальные пути' : 'Could not check final paths');
            }
        }
        if (!isRunCurrent(generation)) return false;
    }

    for (const choice of scene.choices) {
        const btn = createChoiceButton(choice);
        btn.dataset.choiceId = choice.id || '';
        if (choice.endingId) btn.dataset.endingId = resolveEndingId(choice.endingId);

        let blocked = false;
        if (choice.condition && !checkCondition(choice.condition)) {
            btn.style.display = 'none';
            blocked = true;
        } else if (choice.cost && stats.diamonds < choice.cost) {
            btn.disabled = true;
            blocked = true;
        } else if (choice.endingId && (!finalsData || !stage0iEndingEligible(choice.endingId, finalsData))) {
            btn.disabled = true;
            btn.classList.add('ending-locked');
            btn.dataset.eligible = 'false';
            btn.setAttribute('aria-disabled', 'true');
            btn.title = stage0iLockedEndingMessage();
            btn.textContent = `${btn.textContent} 🔒`;
            blocked = true;
        } else if (choice.endingId) {
            btn.dataset.eligible = 'true';
        }

        if (!blocked) {
            const handleChoice = async (event) => {
                event.preventDefault();
                if (!isRunCurrent(generation)) return;
                await applyChoice(choice, { overlay, generation });
            };
            // One state-changing event path: modern mobile browsers synthesize click from touch.
            btn.addEventListener('click', handleChoice);
        }
        dialogueBox.appendChild(btn);
    }
    return true;
};

loadFinals = async function stage0iLoadFinals(endingId, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const normalizedEndingId = resolveEndingId(endingId);
    try {
        const finalsData = await stage0iEnsureFinals(generation);
        if (!isRunCurrent(generation) || !finalsData) return false;
        const ending = stage0iFindEnding(normalizedEndingId, finalsData);
        if (!ending) {
            showErrorMessage(stats.language === 'ru' ? `Финал ${normalizedEndingId} не найден` : `Ending ${normalizedEndingId} not found`);
            return false;
        }
        if (!stage0iEvaluateRequirement(ending.requirements)) {
            console.warn(`[eligibility] blocked direct ending load: ${normalizedEndingId}`);
            showErrorMessage(stage0iLockedEndingMessage());
            return false;
        }
        showEnding(ending, generation);
        return true;
    } catch (error) {
        if (!isRunCurrent(generation)) return false;
        console.error('[loadFinals] Stage 0I ending load failed:', error);
        showErrorMessage(stats.language === 'ru' ? 'Не удалось загрузить финал. Попробуйте ещё раз.' : 'Failed to load ending. Please try again.');
        return false;
    }
};

function stage0iSpeakerCharacterId(scene, language) {
    const english = String(scene?.speaker?.en || '').trim().toLowerCase();
    const englishAliases = {
        anna: 'anna', dima: 'dima', mark: 'mark', sergey: 'sergey', vika: 'vika',
        lyosha: 'lyosha', lesha: 'lyosha', lera: 'lera', katya: 'katya'
    };
    if (englishAliases[english]) return englishAliases[english];

    const russian = String(scene?.speaker?.ru || '').trim().toLowerCase();
    const russianAliases = {
        'анна': 'anna', 'дима': 'dima', 'марк': 'mark', 'сергей': 'sergey', 'вика': 'vika',
        'лёша': 'lyosha', 'леша': 'lyosha', 'лера': 'lera', 'катя': 'katya'
    };
    return russianAliases[russian] || null;
}

function stage0iSpriteCharacterId(spriteName) {
    return typeof spriteName === 'string' && spriteName ? spriteName.split('_')[0].toLowerCase() : null;
}

setupCharacters = async function stage0iSetupCharacters(scene, language, runStats, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    const charLeft = document.getElementById('character-left');
    const charRight = document.getElementById('character-right');
    const speakerName = scene.speaker ? scene.speaker[language] : '';
    const speakerId = stage0iSpeakerCharacterId(scene, language);

    for (const element of [charLeft, charRight]) {
        element.style.backgroundImage = 'none';
        element.classList.remove('character-speaker', 'character-non-speaker', 'shiver', 'heartbeat');
    }
    charLeft.style.left = '';
    charRight.style.right = '';

    async function renderCharacter(element, source, side) {
        if (!source) return true;
        const rendered = source.includes('${stats.appearance}')
            ? source.replace('${stats.appearance}', runStats.appearance)
            : source;
        const url = `assets/characters/${rendered.split('_')[0]}/${rendered}.png`;
        const exists = await checkAssetExists(url);
        if (!isRunCurrent(generation)) return false;
        if (!exists) {
            console.warn(`Персонаж ${rendered}.png не найден`);
            showErrorMessage(language === 'ru' ? `Персонаж ${rendered} не найден` : `Character ${rendered} not found`);
        }
        element.style.backgroundImage = `url('${url}')`;
        const characterId = stage0iSpriteCharacterId(rendered);
        element.classList.add(speakerId && characterId === speakerId ? 'character-speaker' : 'character-non-speaker');

        // Preserve authored micro-effects if later story data uses them.
        const effect = side === 'left' ? scene.characterLeftEffect : scene.characterRightEffect;
        if (effect === 'shiver' || effect === 'heartbeat') element.classList.add(effect);
        return true;
    }

    if (!await renderCharacter(charLeft, scene.characterLeft, 'left')) return false;
    if (!await renderCharacter(charRight, scene.characterRight, 'right')) return false;
    if (!isRunCurrent(generation)) return false;
    document.getElementById('speaker-name').textContent = speakerName;
    return true;
};

// Strict VN reading contract:
// - click while a part is typing: reveal that part and stop;
// - next click: start the next || part;
// - after the final part is fully visible, the following click belongs to choices/transition.
typeText = function stage0iTypeText(text, element, callback, generation = runtimeGeneration) {
    if (!isRunCurrent(generation)) return false;
    if (isTyping) return false;

    const parts = String(text).split('||').map(part => part.trim()).filter(Boolean);
    if (!parts.length) parts.push('');
    const dialogueBox = document.querySelector('.dialogue-box');
    const speed = 50;
    let partIndex = 0;
    let charIndex = 0;
    let waitingBetweenParts = false;
    let callbackDone = false;

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

    function finishFinalPart() {
        if (!isRunCurrent(generation) || callbackDone) return;
        callbackDone = true;
        isTyping = false;
        waitingBetweenParts = false;
        element.typeTimer = null;
        clearHandlers();
        if (callback) callback();
    }

    function partComplete() {
        if (!isRunCurrent(generation)) return;
        isTyping = false;
        element.typeTimer = null;
        if (partIndex === parts.length - 1) {
            finishFinalPart();
        } else {
            waitingBetweenParts = true;
        }
    }

    function typeCharacter() {
        if (!isRunCurrent(generation)) return;
        const part = parts[partIndex];
        if (charIndex < part.length) {
            element.textContent += part.charAt(charIndex++);
            element.typeTimer = runtimeSetTimeout(typeCharacter, speed, generation);
            return;
        }
        partComplete();
    }

    function startPart() {
        if (!isRunCurrent(generation)) return;
        waitingBetweenParts = false;
        isTyping = true;
        charIndex = 0;
        element.textContent = '';
        typeCharacter();
    }

    function handleTap(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!isRunCurrent(generation)) return;

        if (isTyping) {
            runtimeClearTimeout(element.typeTimer);
            element.typeTimer = null;
            element.textContent = parts[partIndex];
            charIndex = parts[partIndex].length;
            partComplete();
            return;
        }

        if (waitingBetweenParts && partIndex < parts.length - 1) {
            partIndex += 1;
            startPart();
        }
    }

    if (element.typeTimer) runtimeClearTimeout(element.typeTimer);
    clearHandlers();
    element.textContent = '';
    if (dialogueBox) {
        dialogueBox.tapHandler = handleTap;
        dialogueBox.addEventListener('touchstart', handleTap, { passive: false });
        dialogueBox.addEventListener('click', handleTap);
        dialogueBox.style.pointerEvents = 'auto';
    }
    startPart();
    return true;
};
