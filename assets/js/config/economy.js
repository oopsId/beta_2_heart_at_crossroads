// Stage 2D: single source of truth for the beta economy.
(() => {
    const config = Object.freeze({
        initialDiamonds: 70,
        completionReward: 100,
        storyPremiumChoiceDefault: 5,
        galleryPaidCardCost: 50,
        galleryPaidUnlockAfterCompletions: 1,
        galleryReplayUnlockAfterCompletions: 2
    });

    window.heartEconomy = config;
})();
