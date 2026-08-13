// Stage 0K: compose-scene layout hotfix + developer replay-text override.
// This layer intentionally leaves the Stage 0J atomic renderer untouched.

(() => {
    const DEV_FIRST_PLAYTHROUGH_KEY = 'heart_at_crossroads_beta2:dev:force_first_playthrough';

    function devForceFirstPlaythrough() {
        return localStorage.getItem(DEV_FIRST_PLAYTHROUGH_KEY) === '1';
    }

    function setDevForceFirstPlaythrough(enabled) {
        if (enabled) localStorage.setItem(DEV_FIRST_PLAYTHROUGH_KEY, '1');
        else localStorage.removeItem(DEV_FIRST_PLAYTHROUGH_KEY);
        if (typeof scriptData === 'object' && scriptData) applyReplayOverride(scriptData);
    }

    function applyReplayOverride(root) {
        const forceFirst = devForceFirstPlaythrough();
        const seen = new WeakSet();

        function visit(value) {
            if (!value || typeof value !== 'object' || seen.has(value)) return;
            seen.add(value);

            if (Object.prototype.hasOwnProperty.call(value, 'second_playthrough_text')) {
                if (!Object.prototype.hasOwnProperty.call(value, '__stage0kSecondPlaythroughText')) {
                    Object.defineProperty(value, '__stage0kSecondPlaythroughText', {
                        value: value.second_playthrough_text,
                        writable: true,
                        configurable: true,
                        enumerable: false
                    });
                }
                if (forceFirst) {
                    delete value.second_playthrough_text;
                }
            } else if (!forceFirst && Object.prototype.hasOwnProperty.call(value, '__stage0kSecondPlaythroughText')) {
                value.second_playthrough_text = value.__stage0kSecondPlaythroughText;
            }

            if (!forceFirst && Object.prototype.hasOwnProperty.call(value, '__stage0kSecondPlaythroughText') && !Object.prototype.hasOwnProperty.call(value, 'second_playthrough_text')) {
                value.second_playthrough_text = value.__stage0kSecondPlaythroughText;
            }

            if (Array.isArray(value)) {
                value.forEach(visit);
            } else {
                Object.values(value).forEach(visit);
            }
        }

        visit(root);
        return root;
    }

    window.stage0kDevForceFirstPlaythrough = devForceFirstPlaythrough;
    window.stage0kSetDevForceFirstPlaythrough = setDevForceFirstPlaythrough;
    window.stage0kApplyReplayOverride = applyReplayOverride;

    const style = document.createElement('style');
    style.id = 'stage0k-styles';
    style.textContent = `
        /* Restore the cinematic centered phone composition. */
        #phone-compose-overlay {
            left: 50% !important;
            top: clamp(22px, 6vh, 64px) !important;
            transform: translateX(-50%) !important;
            width: clamp(260px, 18vw, 320px) !important;
            height: min(480px, 70vh) !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-height: none !important;
        }
        #phone-compose-overlay .stage0j-phone-screen {
            background: #dcebd5 url('assets/backgrounds/bg_phone_ui.png') center / cover no-repeat !important;
        }

        /* Compose scenes use the normal VN dialogue layout; never push/crop it sideways. */
        body.stage0j-compose-scene .dialogue-box {
            left: 0 !important;
            right: 0 !important;
            bottom: 20% !important;
            width: auto !important;
            min-height: 150px !important;
            max-height: 50vh !important;
        }

        #stage0k-dev-replay-control {
            position: fixed;
            left: 12px;
            bottom: 10px;
            z-index: 5005;
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 6px 9px;
            border-radius: 8px;
            background: rgba(20, 20, 20, .68);
            color: #fff;
            font: 12px/1.2 Arial, sans-serif;
            pointer-events: auto;
            user-select: none;
        }
        #stage0k-dev-replay-control input { margin: 0; }

        @media (max-width: 800px) {
            #phone-compose-overlay {
                top: 12px !important;
                width: clamp(190px, 48vw, 240px) !important;
                height: min(360px, 54vh) !important;
            }
            body.stage0j-compose-scene .dialogue-box {
                bottom: 0 !important;
                max-height: 45vh !important;
            }
        }

        /* Short landscape: keep the phone centered above the normal full-width dialogue. */
        @media (max-height: 520px) and (orientation: landscape) {
            #phone-compose-overlay {
                left: 50% !important;
                top: 6px !important;
                transform: translateX(-50%) !important;
                width: min(150px, 24vw) !important;
                height: min(205px, 55vh) !important;
                min-width: 0 !important;
                min-height: 0 !important;
            }
            body.stage0j-compose-scene .dialogue-box {
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: auto !important;
                min-height: 140px !important;
                max-height: 42vh !important;
            }
        }
    `;
    document.head.appendChild(style);

    function mountDevControl() {
        if (document.getElementById('stage0k-dev-replay-control')) return;
        const label = document.createElement('label');
        label.id = 'stage0k-dev-replay-control';
        label.title = 'Только beta/dev: не изменяет completionCount и настоящий профиль.';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = devForceFirstPlaythrough();
        checkbox.setAttribute('aria-label', 'Игнорировать текст повторного прохождения');
        checkbox.addEventListener('change', () => {
            setDevForceFirstPlaythrough(checkbox.checked);
        });

        const text = document.createElement('span');
        text.textContent = 'DEV: обычный текст (без replay)';

        label.append(checkbox, text);
        document.body.appendChild(label);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountDevControl, { once: true });
    } else {
        mountDevControl();
    }

    // Keep the profile's real completionCount untouched. We only hide/restore the alternate text
    // in the in-memory chapter/ending object used by the renderer.
    if (typeof loadChapter === 'function') {
        const baseLoadChapter = loadChapter;
        loadChapter = async function stage0kLoadChapter(...args) {
            const ok = await baseLoadChapter(...args);
            if (ok && typeof scriptData === 'object' && scriptData) applyReplayOverride(scriptData);
            return ok;
        };
    }

    if (typeof showScene === 'function') {
        const baseShowScene = showScene;
        showScene = async function stage0kShowScene(...args) {
            if (typeof scriptData === 'object' && scriptData) applyReplayOverride(scriptData);
            return await baseShowScene(...args);
        };
    }

    if (typeof showSceneWithTimer === 'function') {
        const baseShowSceneWithTimer = showSceneWithTimer;
        showSceneWithTimer = function stage0kShowSceneWithTimer(scene, ...args) {
            applyReplayOverride(scene);
            return baseShowSceneWithTimer(scene, ...args);
        };
    }

    if (typeof showEnding === 'function') {
        const baseShowEnding = showEnding;
        showEnding = function stage0kShowEnding(ending, ...args) {
            applyReplayOverride(ending);
            return baseShowEnding(ending, ...args);
        };
    }
})();

// Stage 0M: test balance + gallery progression repair.
(() => {
    const TEST_STARTING_DIAMONDS = 70;
    const baseCreateFreshRunStats = createFreshRunStats;
    createFreshRunStats = function stage0mCreateFreshRunStats(...args) {
        const fresh = baseCreateFreshRunStats(...args);
        fresh.diamonds = TEST_STARTING_DIAMONDS;
        return fresh;
    };
    if (!runtimeActive) {
        stats.diamonds = TEST_STARTING_DIAMONDS;
        updateDiamondsDisplay();
    }

    const cards = () => Array.isArray(cardSeries?.romance?.cards) ? cardSeries.romance.cards : [];
    const ruleFor = card => {
        const ru = String(card?.unlock ?? '').trim().toLowerCase();
        const en = String(card?.unlockEn ?? '').trim().toLowerCase();
        if (ru === 'второе прохождение' || en === 'second playthrough') return { type: 'completion', minCompletionCount: 2 };
        const cost = Number(card?.unlock);
        if (Number.isFinite(cost) && cost > 0) return { type: 'diamonds', cost, minCompletionCount: 1 };
        return { type: 'unknown' };
    };
    const unlocked = card => Boolean(card?.id) && Array.isArray(stats.memories) && stats.memories.includes(card.id);

    async function syncProgress() {
        if (!Array.isArray(stats.memories)) stats.memories = [];
        let changed = false;
        for (const card of cards()) {
            const rule = ruleFor(card);
            if (rule.type === 'completion' && stats.completionCount >= rule.minCompletionCount && !stats.memories.includes(card.id)) {
                stats.memories.push(card.id);
                changed = true;
            }
        }
        if (changed) {
            stats.memories = [...new Set(stats.memories)];
            await saveProfile();
        }
        return changed;
    }

    function canBuy(card) {
        const rule = ruleFor(card);
        if (unlocked(card)) return { ok: false, reason: 'already-unlocked', rule };
        if (rule.type !== 'diamonds') return { ok: false, reason: 'not-purchasable', rule };
        if (stats.completionCount < rule.minCompletionCount) return { ok: false, reason: 'first-playthrough-required', rule };
        if (stats.diamonds < rule.cost) return { ok: false, reason: 'not-enough-diamonds', rule };
        return { ok: true, reason: 'ok', rule };
    }

    async function purchase(card) {
        const state = canBuy(card);
        if (!state.ok) return state;
        stats.diamonds -= state.rule.cost;
        if (!Array.isArray(stats.memories)) stats.memories = [];
        stats.memories = [...new Set([...stats.memories, card.id])];
        updateDiamondsDisplay();
        await saveProfile();
        return { ok: true, reason: 'purchased', rule: state.rule, diamonds: stats.diamonds };
    }

    function updateSeriesTitle() {
        const title = document.querySelector('#gallery-container .series-title');
        if (!title) return;
        const all = cards();
        const count = all.filter(unlocked).length;
        title.textContent = stats.language === 'ru' ? `Серия: Романтика ${count}/${all.length}` : `Series: Romance ${count}/${all.length}`;
    }

    function notice(message) {
        document.getElementById('stage0m-gallery-notice')?.remove();
        const element = document.createElement('div');
        element.id = 'stage0m-gallery-notice';
        element.textContent = message;
        element.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:5000;padding:10px 16px;border-radius:12px;background:rgba(30,22,17,.92);color:#F5E6C9;font:16px/1.3 Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
        document.body.appendChild(element);
        window.setTimeout(() => element.remove(), 2400);
    }

    function renderUnlocked(card, element, isRussian) {
        element.classList.remove('locked');
        element.innerHTML = '';
        const image = document.createElement('img');
        image.src = `assets/memories/${card.id}.png`;
        image.alt = isRussian ? card.name : card.nameEn;
        image.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        element.appendChild(image);
        const shine = document.createElement('div');
        shine.className = 'card-shine-effect';
        element.appendChild(shine);
        const name = document.createElement('div');
        name.className = 'card-name';
        name.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        name.textContent = isRussian ? card.name : card.nameEn;
        element.appendChild(name);
    }

    createCardElement = function stage0mCreateCardElement(card, _seriesKey, _cardsContainer, clickSound, isRussian) {
        const element = document.createElement('div');
        element.className = 'premium-card';
        element.dataset.cardId = card.id;
        if (unlocked(card)) {
            renderUnlocked(card, element, isRussian);
            return element;
        }

        element.classList.add('locked');
        const lockedImage = document.createElement('img');
        lockedImage.src = 'assets/memories/card_locked.png';
        lockedImage.alt = '';
        lockedImage.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        element.appendChild(lockedImage);

        const info = document.createElement('div');
        info.className = 'unlock-text';
        info.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        const rule = ruleFor(card);
        if (rule.type === 'completion') {
            info.textContent = isRussian ? 'Откроется после второго прохождения' : 'Unlocks after the second playthrough';
            element.appendChild(info);
            return element;
        }
        if (rule.type !== 'diamonds') {
            info.textContent = isRussian ? 'Условие открытия неизвестно' : 'Unknown unlock condition';
            element.appendChild(info);
            return element;
        }
        if (stats.completionCount < 1) {
            info.textContent = isRussian ? 'Покупка откроется после первого прохождения' : 'Purchase unlocks after the first playthrough';
            element.appendChild(info);
            return element;
        }

        info.textContent = isRussian ? `Цена: ${rule.cost} 💎` : `Price: ${rule.cost} 💎`;
        element.appendChild(info);
        const button = document.createElement('button');
        button.className = 'card-unlock-button';
        button.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        button.textContent = isRussian ? `Открыть за ${rule.cost} 💎` : `Unlock for ${rule.cost} 💎`;
        button.disabled = stats.diamonds < rule.cost;
        let busy = false;
        const handle = async event => {
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            busy = true;
            try {
                const result = await purchase(card);
                if (!result.ok) {
                    notice(result.reason === 'not-enough-diamonds'
                        ? (isRussian ? 'Недостаточно бриллиантов' : 'Not enough diamonds')
                        : (isRussian ? 'Карточка пока недоступна' : 'Card is not available yet'));
                    return;
                }
                renderUnlocked(card, element, isRussian);
                updateSeriesTitle();
                if (typeof showUnlockNotification === 'function' && window.gsap) showUnlockNotification(card, isRussian);
                new Audio('assets/sounds/sfx_card_unlock.mp3').play().catch(() => {});
                const clickPromise = clickSound?.play?.();
                clickPromise?.catch?.(() => {});
            } finally {
                busy = false;
            }
        };
        button.addEventListener('touchstart', handle, { passive: false });
        button.addEventListener('click', handle);
        element.appendChild(button);
        return element;
    };

    const baseShowPremiumGallery = showPremiumGallery;
    showPremiumGallery = async function stage0mShowPremiumGallery() {
        await syncProgress();
        baseShowPremiumGallery();
        updateSeriesTitle();
    };
    const baseShowSimpleGallery = showSimpleGallery;
    showSimpleGallery = async function stage0mShowSimpleGallery() {
        await syncProgress();
        return baseShowSimpleGallery();
    };

    window.stage0mTestStartingDiamonds = TEST_STARTING_DIAMONDS;
    window.stage0mGalleryRule = ruleFor;
    window.stage0mSyncGalleryProgress = syncProgress;
    window.stage0mCanBuyGalleryCard = canBuy;
    window.stage0mPurchaseGalleryCard = purchase;
})();
