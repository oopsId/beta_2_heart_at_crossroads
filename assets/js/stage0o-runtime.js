// Stage 0O: phone-safe layout + persistent diamond economy + completion reward.
(() => {
    const INITIAL_DIAMONDS = 70;
    const COMPLETION_REWARD = 100;
    const BANK_KEY = 'diamondBank';

    function readBank() {
        try {
            const raw = localStorage.getItem(storageKey(BANK_KEY));
            if (raw === null) return null;
            const value = Number(raw);
            return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
        } catch (_) {
            return null;
        }
    }

    function writeBank(value) {
        const normalized = Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : INITIAL_DIAMONDS;
        try {
            localStorage.setItem(storageKey(BANK_KEY), String(normalized));
        } catch (error) {
            console.error('[Stage 0O] Failed to persist diamond bank:', error);
        }
        return normalized;
    }

    const baseCreateFreshRunStats = createFreshRunStats;
    createFreshRunStats = function stage0oCreateFreshRunStats(...args) {
        const fresh = baseCreateFreshRunStats(...args);
        fresh.diamonds = readBank() ?? INITIAL_DIAMONDS;
        return fresh;
    };

    const existingBank = readBank();
    if (existingBank === null) writeBank(Number(stats.diamonds) || INITIAL_DIAMONDS);
    else if (!runtimeActive) {
        stats.diamonds = existingBank;
        updateDiamondsDisplay();
    }

    let pendingCompletion = null;
    const baseShowEpilogue = showEpilogue;
    showEpilogue = function stage0oShowEpilogue(...args) {
        pendingCompletion = { completionCount: Number(stats.completionCount) || 0 };
        return baseShowEpilogue(...args);
    };

    const baseSaveProfile = saveProfile;
    saveProfile = async function stage0oSaveProfile(...args) {
        if (pendingCompletion && Number(stats.completionCount) > pendingCompletion.completionCount) {
            stats.diamonds = Math.max(0, Number(stats.diamonds) || 0) + COMPLETION_REWARD;
            updateDiamondsDisplay();
            pendingCompletion = null;
        }
        writeBank(stats.diamonds);
        return await baseSaveProfile(...args);
    };

    const style = document.createElement('style');
    style.id = 'stage0o-phone-layout';
    style.textContent = `
        body.stage0j-compose-scene {
            --stage0o-phone-top: 4px;
            --stage0o-phone-height: min(430px, calc(100vh - 245px));
            --stage0o-phone-gap: 12px;
        }
        #phone-compose-overlay {
            top: var(--stage0o-phone-top, 4px) !important;
            height: var(--stage0o-phone-height, min(430px, calc(100vh - 245px))) !important;
        }
        body.stage0j-compose-scene .dialogue-box {
            bottom: 0 !important;
            max-height: calc(100vh - var(--stage0o-phone-top) - var(--stage0o-phone-height) - var(--stage0o-phone-gap)) !important;
        }
        @media (max-width: 800px) {
            body.stage0j-compose-scene {
                --stage0o-phone-top: 4px;
                --stage0o-phone-height: min(350px, 48vh);
                --stage0o-phone-gap: 10px;
            }
        }
        @media (max-height: 520px) and (orientation: landscape) {
            body.stage0j-compose-scene {
                --stage0o-phone-top: 2px;
                --stage0o-phone-height: min(180px, 48vh);
                --stage0o-phone-gap: 8px;
            }
        }
    `;
    document.head.appendChild(style);

    window.stage0oInitialDiamonds = INITIAL_DIAMONDS;
    window.stage0oCompletionReward = COMPLETION_REWARD;
    window.stage0oReadDiamondBank = readBank;
    window.stage0oWriteDiamondBank = writeBank;
})();
