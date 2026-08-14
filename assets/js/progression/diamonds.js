// Persistent diamond bank and completion reward.
(() => {
    const economy = Object.freeze({ initialDiamonds: 70, completionReward: 100, galleryPaidCardCost: 50, galleryPaidUnlockAfterCompletions: 1, galleryReplayUnlockAfterCompletions: 2 });
    window.heartEconomy = economy;
    const INITIAL_DIAMONDS = economy.initialDiamonds;
    const COMPLETION_REWARD = economy.completionReward;
    const BANK_KEY = 'diamondBank';
    function readBank(){try{const raw=localStorage.getItem(storageKey(BANK_KEY));if(raw===null)return null;const value=Number(raw);return Number.isFinite(value)&&value>=0?Math.floor(value):null}catch(_){return null}}
    function legacyRunBalance(){try{const raw=localStorage.getItem(storageKey(RUN_STORAGE_KEY));if(!raw)return null;const value=Number(JSON.parse(raw)?.stats?.diamonds);return Number.isFinite(value)&&value>=0?Math.floor(value):null}catch(_){return null}}
    function writeBank(value){const numeric=Number(value);const normalized=Number.isFinite(numeric)&&numeric>=0?Math.floor(numeric):INITIAL_DIAMONDS;try{localStorage.setItem(storageKey(BANK_KEY),String(normalized))}catch(error){console.error('[economy] persist failed',error)}return normalized}
    const baseCreateFreshRunStats=createFreshRunStats;
    createFreshRunStats=function stage2dCreateFreshRunStats(...args){const fresh=baseCreateFreshRunStats(...args);fresh.diamonds=readBank()??INITIAL_DIAMONDS;return fresh};
    let existingBank=readBank();if(existingBank===null)existingBank=writeBank(legacyRunBalance()??INITIAL_DIAMONDS);if(!runtimeActive){stats.diamonds=existingBank;updateDiamondsDisplay()}
    const baseLoadSession=loadSession;
    loadSession=async function stage2dLoadSession(...args){const ok=await baseLoadSession(...args);if(!ok)return ok;const bank=readBank();stats.diamonds=bank??writeBank(stats.diamonds);updateDiamondsDisplay();return ok};
    const baseSaveSession=saveSession;
    saveSession=async function stage2dSaveSession(...args){writeBank(stats.diamonds);return await baseSaveSession(...args)};
    let pendingCompletion=null;
    const baseShowEpilogue=showEpilogue;
    showEpilogue=function stage2dShowEpilogue(...args){if(window.heartDevForceFirstPlaythrough?.()){pendingCompletion=null;return baseShowEpilogue(...args)}pendingCompletion={completionCount:Number(stats.completionCount)||0};return baseShowEpilogue(...args)};
    const baseSaveProfile=saveProfile;
    saveProfile=async function stage2dSaveProfile(...args){if(pendingCompletion&&Number(stats.completionCount)>pendingCompletion.completionCount){stats.diamonds=Math.max(0,Number(stats.diamonds)||0)+COMPLETION_REWARD;updateDiamondsDisplay();pendingCompletion=null}writeBank(stats.diamonds);return await baseSaveProfile(...args)};
    window.stage0oInitialDiamonds=INITIAL_DIAMONDS;window.stage0oCompletionReward=COMPLETION_REWARD;window.stage0oReadDiamondBank=readBank;window.stage0oWriteDiamondBank=writeBank;window.stage2dEconomy=economy;window.stage2dReadDiamondBank=readBank;window.stage2dWriteDiamondBank=writeBank;
})();
