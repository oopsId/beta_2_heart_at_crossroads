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
        } catch (_) { return null; }
    }

    function legacyRunBalance() {
        try {
            const raw = localStorage.getItem(storageKey(RUN_STORAGE_KEY));
            if (!raw) return null;
            const value = Number(JSON.parse(raw)?.stats?.diamonds);
            return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
        } catch (_) { return null; }
    }

    function writeBank(value) {
        const normalized = Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : INITIAL_DIAMONDS;
        try { localStorage.setItem(storageKey(BANK_KEY), String(normalized)); }
        catch (error) { console.error('[Stage 0O] Failed to persist diamond bank:', error); }
        return normalized;
    }

    const baseCreateFreshRunStats = createFreshRunStats;
    createFreshRunStats = function stage0oCreateFreshRunStats(...args) {
        const fresh = baseCreateFreshRunStats(...args);
        fresh.diamonds = readBank() ?? legacyRunBalance() ?? INITIAL_DIAMONDS;
        return fresh;
    };

    let existingBank = readBank();
    if (existingBank === null) {
        const current = Number(stats.diamonds);
        const seed = legacyRunBalance() ?? (Number.isFinite(current) && current >= 0 ? Math.floor(current) : INITIAL_DIAMONDS);
        existingBank = writeBank(seed);
    }
    if (!runtimeActive) {
        stats.diamonds = existingBank;
        updateDiamondsDisplay();
    }

    const baseLoadSession = loadSession;
    loadSession = async function stage0oLoadSession(...args) {
        const ok = await baseLoadSession(...args);
        if (!ok) return ok;
        const bank = readBank();
        if (bank !== null) {
            stats.diamonds = bank;
            updateDiamondsDisplay();
        }
        return ok;
    };

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
                --stage0o-phone-height: min(205px, 55vh);
                --stage0o-phone-gap: 8px;
            }
            #phone-compose-overlay .stage0j-phone-header { height: 42px !important; padding: 0 7px !important; }
            #phone-compose-overlay .stage0j-header-avatar { width: 24px !important; height: 24px !important; }
            #phone-compose-overlay .stage0j-notification-stack {
                top: 46px !important; bottom: 43px !important; left: 6px !important; right: 6px !important;
                gap: 2px !important; overflow-y: auto !important; overscroll-behavior: contain;
                scrollbar-width: none; pointer-events: auto;
            }
            #phone-compose-overlay .stage0j-notification-stack::-webkit-scrollbar { display: none; }
            #phone-compose-overlay .stage0j-notification {
                min-height: 30px !important; padding: 2px 4px !important;
                grid-template-columns: 24px 1fr !important; gap: 4px !important; flex: 0 0 auto;
            }
            #phone-compose-overlay .stage0j-notification-avatar,
            #phone-compose-overlay .stage0j-notification-initial { width: 24px !important; height: 24px !important; }
            #phone-compose-overlay .stage0j-notification-copy strong { margin-bottom: 0 !important; font-size: 10px !important; }
            #phone-compose-overlay .stage0j-notification-copy span { font-size: 10px !important; }
            #phone-compose-overlay .stage0j-compose-input-wrap {
                left: 6px !important; right: 6px !important; bottom: 6px !important; min-height: 30px !important;
            }
        }
    `;
    document.head.appendChild(style);

    window.stage0oInitialDiamonds = INITIAL_DIAMONDS;
    window.stage0oCompletionReward = COMPLETION_REWARD;
    window.stage0oReadDiamondBank = readBank;
    window.stage0oWriteDiamondBank = writeBank;
})();
