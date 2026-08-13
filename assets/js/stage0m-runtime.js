// Stage 0M: temporary test economy + repaired gallery progression.
// Gallery rules intentionally reuse the original card metadata:
// - "second playthrough" cards unlock automatically after completionCount >= 2;
// - numeric cards cost that many diamonds, but can only be bought after completionCount >= 1.

(() => {
    const romanceCards = () => Array.isArray(cardSeries?.romance?.cards) ? cardSeries.romance.cards : [];

    function stage0mGalleryRule(card) {
        if (!card || typeof card !== 'object') return { type: 'unknown' };
        const ru = String(card.unlock ?? '').trim().toLowerCase();
        const en = String(card.unlockEn ?? '').trim().toLowerCase();
        if (ru === 'второе прохождение' || en === 'second playthrough') {
            return { type: 'completion', minCompletionCount: 2 };
        }
        const cost = Number(card.unlock);
        if (Number.isFinite(cost) && cost > 0) {
            return { type: 'diamonds', cost, minCompletionCount: 1 };
        }
        return { type: 'unknown' };
    }

    function stage0mIsGalleryCardUnlocked(card) {
        return Boolean(card?.id) && Array.isArray(stats.memories) && stats.memories.includes(card.id);
    }

    async function stage0mSyncGalleryProgress() {
        if (!Array.isArray(stats.memories)) stats.memories = [];
        let changed = false;
        for (const card of romanceCards()) {
            const rule = stage0mGalleryRule(card);
            if (
                rule.type === 'completion' &&
                stats.completionCount >= rule.minCompletionCount &&
                !stats.memories.includes(card.id)
            ) {
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

    function stage0mCanBuyGalleryCard(card) {
        const rule = stage0mGalleryRule(card);
        if (stage0mIsGalleryCardUnlocked(card)) return { ok: false, reason: 'already-unlocked', rule };
        if (rule.type !== 'diamonds') return { ok: false, reason: 'not-purchasable', rule };
        if (stats.completionCount < rule.minCompletionCount) return { ok: false, reason: 'first-playthrough-required', rule };
        if (stats.diamonds < rule.cost) return { ok: false, reason: 'not-enough-diamonds', rule };
        return { ok: true, reason: 'ok', rule };
    }

    async function stage0mPurchaseGalleryCard(card) {
        const availability = stage0mCanBuyGalleryCard(card);
        if (!availability.ok) return availability;

        stats.diamonds -= availability.rule.cost;
        if (!Array.isArray(stats.memories)) stats.memories = [];
        stats.memories = [...new Set([...stats.memories, card.id])];
        updateDiamondsDisplay();
        await saveProfile();
        return { ok: true, reason: 'purchased', rule: availability.rule, diamonds: stats.diamonds };
    }

    function stage0mUpdateSeriesTitle() {
        const title = document.querySelector('#gallery-container .series-title');
        if (!title) return;
        const cards = romanceCards();
        const unlocked = cards.filter(stage0mIsGalleryCardUnlocked).length;
        title.textContent = stats.language === 'ru'
            ? `Серия: Романтика ${unlocked}/${cards.length}`
            : `Series: Romance ${unlocked}/${cards.length}`;
    }

    function stage0mGalleryNotice(message) {
        document.getElementById('stage0m-gallery-notice')?.remove();
        const notice = document.createElement('div');
        notice.id = 'stage0m-gallery-notice';
        notice.textContent = message;
        notice.style.cssText = [
            'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
            'z-index:5000', 'padding:10px 16px', 'border-radius:12px',
            'background:rgba(30,22,17,.92)', 'color:#F5E6C9',
            'font:16px/1.3 Arial,sans-serif', 'box-shadow:0 6px 24px rgba(0,0,0,.35)'
        ].join(';');
        document.body.appendChild(notice);
        window.setTimeout(() => notice.remove(), 2400);
    }

    function stage0mRenderUnlockedCard(card, cardElement, isRussian) {
        cardElement.classList.remove('locked');
        cardElement.innerHTML = '';

        const cardImg = document.createElement('img');
        cardImg.src = `assets/memories/${card.id}.png`;
        cardImg.alt = isRussian ? card.name : card.nameEn;
        cardImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        cardElement.appendChild(cardImg);

        const shineEffect = document.createElement('div');
        shineEffect.className = 'card-shine-effect';
        cardElement.appendChild(shineEffect);

        const cardName = document.createElement('div');
        cardName.className = 'card-name';
        cardName.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
        cardName.textContent = isRussian ? card.name : card.nameEn;
        cardElement.appendChild(cardName);
    }

    createCardElement = function stage0mCreateCardElement(card, _seriesKey, cardsContainer, clickSound, isRussian) {
        const unlocked = stage0mIsGalleryCardUnlocked(card);
        const rule = stage0mGalleryRule(card);
        const cardElement = document.createElement('div');
        cardElement.className = 'premium-card';
        cardElement.dataset.cardId = card.id;
        if (unlocked) {
            stage0mRenderUnlockedCard(card, cardElement, isRussian);
            return cardElement;
        }

        cardElement.classList.add('locked');
        const lockImg = document.createElement('img');
        lockImg.src = 'assets/memories/card_locked.png';
        lockImg.alt = '';
        lockImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        cardElement.appendChild(lockImg);

        const unlockText = document.createElement('div');
        unlockText.className = 'unlock-text';
        unlockText.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';

        if (rule.type === 'completion') {
            unlockText.textContent = isRussian
                ? 'Откроется после второго прохождения'
                : 'Unlocks after the second playthrough';
            cardElement.appendChild(unlockText);
            return cardElement;
        }

        if (rule.type === 'diamonds') {
            const diamondIcon = `<img src="assets/ui/diamonds.png" alt="" style="width:16px;height:16px;vertical-align:middle;">`;
            if (stats.completionCount < rule.minCompletionCount) {
                unlockText.textContent = isRussian
                    ? 'Покупка откроется после первого прохождения'
                    : 'Purchase unlocks after the first playthrough';
                cardElement.appendChild(unlockText);
                return cardElement;
            }

            unlockText.innerHTML = isRussian
                ? `Цена: ${rule.cost} ${diamondIcon}`
                : `Price: ${rule.cost} ${diamondIcon}`;
            cardElement.appendChild(unlockText);

            const unlockButton = document.createElement('button');
            unlockButton.className = 'card-unlock-button';
            unlockButton.style.fontFamily = isRussian ? 'GoodVibesCyr, cursive' : 'GreatVibes, cursive';
            unlockButton.textContent = isRussian ? `Открыть за ${rule.cost} 💎` : `Unlock for ${rule.cost} 💎`;
            unlockButton.disabled = stats.diamonds < rule.cost;
            if (unlockButton.disabled) {
                unlockButton.title = isRussian ? 'Недостаточно бриллиантов' : 'Not enough diamonds';
            }
            unlockButton.addEventListener('click', async event => {
                event.preventDefault();
                event.stopPropagation();
                const result = await stage0mPurchaseGalleryCard(card);
                if (!result.ok) {
                    const messages = {
                        'first-playthrough-required': isRussian ? 'Сначала завершите первое прохождение' : 'Finish the first playthrough first',
                        'not-enough-diamonds': isRussian ? 'Недостаточно бриллиантов' : 'Not enough diamonds'
                    };
                    stage0mGalleryNotice(messages[result.reason] || (isRussian ? 'Карточка пока недоступна' : 'Card is not available yet'));
                    return;
                }

                stage0mRenderUnlockedCard(card, cardElement, isRussian);
                stage0mUpdateSeriesTitle();
                if (typeof showUnlockNotification === 'function' && window.gsap) showUnlockNotification(card, isRussian);
                const unlockSound = new Audio('assets/sounds/sfx_card_unlock.mp3');
                unlockSound.play().catch(() => {});
                clickSound?.play?.().catch?.(() => {});
            });
            cardElement.appendChild(unlockButton);
            return cardElement;
        }

        unlockText.textContent = isRussian ? 'Условие открытия неизвестно' : 'Unknown unlock condition';
        cardElement.appendChild(unlockText);
        return cardElement;
    };

    unlockCard = async function stage0mUnlockCard(card, cardsContainer, clickSound, isRussian) {
        const result = await stage0mPurchaseGalleryCard(card);
        if (!result.ok) {
            const message = result.reason === 'first-playthrough-required'
                ? (isRussian ? 'Сначала завершите первое прохождение' : 'Finish the first playthrough first')
                : (isRussian ? 'Недостаточно бриллиантов или карточка недоступна' : 'Not enough diamonds or card unavailable');
            stage0mGalleryNotice(message);
            return false;
        }
        const cardElement = cardsContainer?.querySelector?.(`[data-card-id="${card.id}"]`);
        if (cardElement) stage0mRenderUnlockedCard(card, cardElement, isRussian);
        stage0mUpdateSeriesTitle();
        if (typeof showUnlockNotification === 'function' && window.gsap) showUnlockNotification(card, isRussian);
        clickSound?.play?.().catch?.(() => {});
        return true;
    };

    const baseShowPremiumGallery = showPremiumGallery;
    showPremiumGallery = async function stage0mShowPremiumGallery() {
        await stage0mSyncGalleryProgress();
        baseShowPremiumGallery();
        stage0mUpdateSeriesTitle();
    };

    const baseShowSimpleGallery = showSimpleGallery;
    showSimpleGallery = async function stage0mShowSimpleGallery() {
        await stage0mSyncGalleryProgress();
        return baseShowSimpleGallery();
    };

    window.stage0mGalleryRule = stage0mGalleryRule;
    window.stage0mSyncGalleryProgress = stage0mSyncGalleryProgress;
    window.stage0mCanBuyGalleryCard = stage0mCanBuyGalleryCard;
    window.stage0mPurchaseGalleryCard = stage0mPurchaseGalleryCard;
})();
