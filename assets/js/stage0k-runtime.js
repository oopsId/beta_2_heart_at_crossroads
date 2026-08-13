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
                if (forceFirst) delete value.second_playthrough_text;
            } else if (!forceFirst && Object.prototype.hasOwnProperty.call(value, '__stage0kSecondPlaythroughText')) {
                value.second_playthrough_text = value.__stage0kSecondPlaythroughText;
            }

            if (!forceFirst && Object.prototype.hasOwnProperty.call(value, '__stage0kSecondPlaythroughText') && !Object.prototype.hasOwnProperty.call(value, 'second_playthrough_text')) {
                value.second_playthrough_text = value.__stage0kSecondPlaythroughText;
            }

            if (Array.isArray(value)) value.forEach(visit);
            else Object.values(value).forEach(visit);
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
        checkbox.addEventListener('change', () => setDevForceFirstPlaythrough(checkbox.checked));
        const text = document.createElement('span');
        text.textContent = 'DEV: обычный текст (без replay)';
        label.append(checkbox, text);
        document.body.appendChild(label);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountDevControl, { once: true });
    else mountDevControl();

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

// Stage 0M: temporary beta balance + repaired four-card gallery.
(() => {
    const TEST_STARTING_DIAMONDS = 70;
    const baseCreateFreshRunStats = createFreshRunStats;
    createFreshRunStats = function stage0mCreateFreshRunStats(...args) {
        const fresh = baseCreateFreshRunStats(...args);
        fresh.diamonds = TEST_STARTING_DIAMONDS;
        return fresh;
    };
    // The initial page state predates this late layer. Continue subsequently restores its saved balance.
    if (!runtimeActive) {
        stats.diamonds = TEST_STARTING_DIAMONDS;
        updateDiamondsDisplay();
    }

    const galleryStyle = document.createElement('style');
    galleryStyle.id = 'stage0m-gallery-styles';
    galleryStyle.textContent = `
        #gallery-container.stage0m-gallery {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding: 28px 24px 42px !important;
            background: url('assets/backgrounds/shoebox_texture.png') center / cover no-repeat !important;
            z-index: 4000 !important;
            opacity: 1 !important;
            align-items: center !important;
        }
        #gallery-container.stage0m-gallery .stage0m-gallery-grid {
            width: min(720px, 94vw);
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px;
            margin: 18px auto 0;
            padding-bottom: 30px;
        }
        #gallery-container.stage0m-gallery .premium-card,
        #gallery-container.stage0m-gallery .premium-card:not(.front),
        #gallery-container.stage0m-gallery .premium-card.front,
        #gallery-container.stage0m-gallery .premium-card.peek {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 1 / 1 !important;
            min-height: 0 !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            overflow: hidden !important;
            border-radius: 12px !important;
            border: 2px solid rgba(245,230,201,.72) !important;
            background: #d8c4a4 !important;
            box-shadow: 0 10px 28px rgba(0,0,0,.38) !important;
            cursor: pointer;
        }
        #gallery-container.stage0m-gallery .premium-card.locked .unlock-text {
            left: 0 !important;
            right: 0 !important;
            bottom: 58px !important;
            width: auto !important;
            padding: 8px 10px !important;
            background: rgba(245,240,225,.9);
            color: #5D4037 !important;
            font: 600 14px/1.25 Arial, sans-serif !important;
            text-shadow: none !important;
        }
        #gallery-container.stage0m-gallery .premium-card .card-name {
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: auto !important;
            box-sizing: border-box;
            background: linear-gradient(transparent, rgba(20,12,8,.82));
            color: #fff !important;
            padding: 32px 10px 10px !important;
            text-shadow: 0 1px 3px #000 !important;
        }
        #gallery-container.stage0m-gallery .card-unlock-button {
            bottom: 12px !important;
            white-space: nowrap;
        }
        #gallery-container.stage0m-gallery .card-unlock-button:disabled {
            opacity: .5;
            cursor: not-allowed;
        }
        .stage0m-card-detail-backdrop {
            position: fixed;
            inset: 0;
            z-index: 5000;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 22px;
            box-sizing: border-box;
            background: rgba(0,0,0,.82);
            cursor: pointer;
        }
        .stage0m-card-detail {
            position: relative;
            width: min(620px, 92vw);
            max-height: 88vh;
            aspect-ratio: 1 / 1;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 16px 48px rgba(0,0,0,.6);
        }
        .stage0m-card-detail img { width:100%; height:100%; object-fit:contain; background:#111; }
        .stage0m-card-detail div {
            position:absolute; left:0; right:0; bottom:0; padding:34px 14px 12px;
            color:#fff; text-align:center; background:linear-gradient(transparent,rgba(0,0,0,.85));
            font-size:1.2rem; text-shadow:0 1px 3px #000;
        }
        @media (max-width: 620px) {
            #gallery-container.stage0m-gallery { padding: 20px 14px 34px !important; }
            #gallery-container.stage0m-gallery .stage0m-gallery-grid {
                width: min(360px, 92vw);
                grid-template-columns: 1fr;
                gap: 18px;
            }
        }
    `;
    document.head.appendChild(galleryStyle);

    const cards = () => Array.isArray(cardSeries?.romance?.cards) ? cardSeries.romance.cards : [];
    const ruleFor = card => {
        const ru = String(card?.unlock ?? '').trim().toLowerCase();
        const en = String(card?.unlockEn ?? '').trim().toLowerCase();
        if (ru === 'второе прохождение' || en === 'second playthrough') return { type: 'completion', minCompletionCount: 2 };
        const cost = Number(card?.unlock);
        if (Number.isFinite(cost) && cost > 0) return { type: 'diamonds', cost, minCompletionCount: 1 };
        return { type: 'unknown' };
    };
    const isUnlocked = card => Boolean(card?.id) && Array.isArray(stats.memories) && stats.memories.includes(card.id);

    async function syncGalleryProgress() {
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

    function canBuyGalleryCard(card) {
        const rule = ruleFor(card);
        if (isUnlocked(card)) return { ok: false, reason: 'already-unlocked', rule };
        if (rule.type !== 'diamonds') return { ok: false, reason: 'not-purchasable', rule };
        if (stats.completionCount < rule.minCompletionCount) return { ok: false, reason: 'first-playthrough-required', rule };
        if (stats.diamonds < rule.cost) return { ok: false, reason: 'not-enough-diamonds', rule };
        return { ok: true, reason: 'ok', rule };
    }

    async function purchaseGalleryCard(card) {
        const state = canBuyGalleryCard(card);
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
        const count = all.filter(isUnlocked).length;
        title.textContent = stats.language === 'ru' ? `Серия: Романтика ${count}/${all.length}` : `Series: Romance ${count}/${all.length}`;
    }

    function galleryNotice(message) {
        document.getElementById('stage0m-gallery-notice')?.remove();
        const element = document.createElement('div');
        element.id = 'stage0m-gallery-notice';
        element.textContent = message;
        element.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:5500;padding:10px 16px;border-radius:12px;background:rgba(30,22,17,.94);color:#F5E6C9;font:16px/1.3 Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
        document.body.appendChild(element);
        window.setTimeout(() => element.remove(), 2400);
    }

    function renderUnlockedCard(card, element, isRussian) {
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

    function showCardDetail(card, isRussian) {
        document.querySelector('.stage0m-card-detail-backdrop')?.remove();
        const backdrop = document.createElement('div');
        backdrop.className = 'stage0m-card-detail-backdrop';
        const detail = document.createElement('div');
        detail.className = 'stage0m-card-detail';
        const image = document.createElement('img');
        image.src = `assets/memories/${card.id}.png`;
        image.alt = isRussian ? card.name : card.nameEn;
        const name = document.createElement('div');
        name.textContent = isRussian ? card.name : card.nameEn;
        detail.append(image, name);
        backdrop.appendChild(detail);
        backdrop.addEventListener('click', () => backdrop.remove());
        detail.addEventListener('click', event => event.stopPropagation());
        detail.addEventListener('dblclick', () => backdrop.remove());
        document.body.appendChild(backdrop);
    }

    createCardElement = function stage0mCreateCardElement(card, _seriesKey, _cardsContainer, clickSound, isRussian) {
        const element = document.createElement('div');
        element.className = 'premium-card';
        element.dataset.cardId = card.id;
        if (isUnlocked(card)) {
            renderUnlockedCard(card, element, isRussian);
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
        button.textContent = isRussian ? `Открыть за ${rule.cost} 💎` : `Unlock for ${rule.cost} 💎`;
        button.disabled = stats.diamonds < rule.cost;
        let busy = false;
        const handleUnlock = async event => {
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            busy = true;
            try {
                const result = await purchaseGalleryCard(card);
                if (!result.ok) {
                    galleryNotice(result.reason === 'not-enough-diamonds'
                        ? (isRussian ? 'Недостаточно бриллиантов' : 'Not enough diamonds')
                        : (isRussian ? 'Карточка пока недоступна' : 'Card is not available yet'));
                    return;
                }
                renderUnlockedCard(card, element, isRussian);
                updateSeriesTitle();
                new Audio('assets/sounds/sfx_card_unlock.mp3').play().catch(() => {});
                const clickPromise = clickSound?.play?.();
                clickPromise?.catch?.(() => {});
            } finally {
                busy = false;
            }
        };
        button.addEventListener('touchstart', handleUnlock, { passive: false });
        button.addEventListener('click', handleUnlock);
        element.appendChild(button);
        return element;
    };

    showPremiumGallery = async function stage0mShowPremiumGallery() {
        await syncGalleryProgress();
        const isRussian = stats.language === 'ru';
        const gallery = document.getElementById('gallery-container');
        const start = document.getElementById('start-screen');
        const clickSound = new Audio('assets/sounds/sfx_camera_click.mp3');
        document.body.style.overflow = 'hidden';
        start.style.display = 'none';
        gallery.classList.add('stage0m-gallery');
        gallery.style.display = 'flex';
        gallery.innerHTML = '';

        const close = document.createElement('button');
        close.type = 'button';
        close.setAttribute('aria-label', isRussian ? 'Закрыть галерею' : 'Close gallery');
        close.textContent = '×';
        close.style.cssText = 'position:fixed;top:14px;right:18px;z-index:4100;width:44px;height:44px;border-radius:50%;border:1px solid rgba(245,230,201,.7);background:rgba(40,28,20,.78);color:#F5E6C9;font:32px/38px Arial;cursor:pointer;';
        close.addEventListener('click', () => {
            document.querySelector('.stage0m-card-detail-backdrop')?.remove();
            gallery.innerHTML = '';
            gallery.classList.remove('stage0m-gallery');
            gallery.style.display = 'none';
            document.body.style.overflow = '';
            start.style.display = 'flex';
        });

        const header = document.createElement('div');
        header.className = 'gallery-header';
        header.style.cssText = 'opacity:1;margin:0 0 4px;color:#F5E6C9;';
        header.textContent = isRussian ? 'Коллекционные карточки' : 'Collection Cards';
        const subtitle = document.createElement('div');
        subtitle.style.cssText = 'color:#F5E6C9;font-size:1.45rem;text-align:center;text-shadow:2px 2px 4px rgba(0,0,0,.5);';
        subtitle.textContent = isRussian ? 'Прошлое остаётся навсегда' : 'The past remains forever';
        const series = document.createElement('div');
        series.className = 'series-title';
        series.style.cssText = 'color:#e0c18e;font-size:1.2rem;margin:8px 0 0;text-align:center;';
        const grid = document.createElement('div');
        grid.className = 'stage0m-gallery-grid';

        for (const card of cards()) {
            const element = createCardElement(card, 'romance', grid, clickSound, isRussian);
            element.addEventListener('click', event => {
                if (event.target.closest('.card-unlock-button')) return;
                if (isUnlocked(card)) showCardDetail(card, isRussian);
            });
            grid.appendChild(element);
        }

        gallery.append(close, header, subtitle, series, grid);
        updateSeriesTitle();
        return true;
    };

    showSimpleGallery = showPremiumGallery;

    window.stage0mTestStartingDiamonds = TEST_STARTING_DIAMONDS;
    window.stage0mGalleryRule = ruleFor;
    window.stage0mSyncGalleryProgress = syncGalleryProgress;
    window.stage0mCanBuyGalleryCard = canBuyGalleryCard;
    window.stage0mPurchaseGalleryCard = purchaseGalleryCard;
})();
