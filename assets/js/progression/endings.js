// Stage 2D: final choice is player agency; accumulated history grades the route but never locks it.
(() => {
    const profile = Object.freeze({
        freedom_with_dima: Object.freeze({ relationship: 'dima', strong: s => s.relationships.dima >= 2 && s.heart >= 12, mixed: s => s.relationships.dima >= 1 || s.heart >= 10 }),
        silence_with_mark: Object.freeze({ relationship: 'mark', strong: s => s.relationships.mark >= 3 && (s.heart >= 10 || s.leaf >= 8), mixed: s => s.relationships.mark >= 1 || s.heart >= 8 || s.leaf >= 6 }),
        summit_with_sergey: Object.freeze({ relationship: 'sergey', strong: s => s.relationships.sergey >= 2 && s.crown >= 4, mixed: s => s.relationships.sergey >= 1 || s.crown >= 3 }),
        friendship_above_all: Object.freeze({ relationship: 'vika', strong: s => s.relationships.vika >= 1 && s.leaf >= 10, mixed: s => s.relationships.vika >= 0 || s.leaf >= 7 }),
        lonely_path: Object.freeze({ strong: s => s.crown >= 5 && s.crown + 3 >= s.heart && s.crown + 3 >= s.leaf, mixed: s => s.crown >= 4 }),
        new_start: Object.freeze({ intentional: true })
    });

    function snapshot(source = stats) {
        return {
            crown: Number(source?.crown) || 0,
            heart: Number(source?.heart) || 0,
            leaf: Number(source?.leaf) || 0,
            relationships: {
                dima: Number(source?.relationships?.dima) || 0,
                mark: Number(source?.relationships?.mark) || 0,
                sergey: Number(source?.relationships?.sergey) || 0,
                vika: Number(source?.relationships?.vika) || 0
            }
        };
    }

    function routeStrength(endingId, source = stats) {
        const id = resolveEndingId(endingId);
        const rule = profile[id];
        const state = snapshot(source);
        if (!rule) return { endingId: id, level: 'unknown', snapshot: state };
        if (rule.intentional) return { endingId: id, level: 'intentional', snapshot: state };
        if (rule.strong(state)) return { endingId: id, level: 'strong', snapshot: state };
        if (rule.mixed(state)) return { endingId: id, level: 'mixed', snapshot: state };
        return { endingId: id, level: 'impulsive', snapshot: state };
    }

    // Preserve the old evaluator for analytics/tests, but ending eligibility is no longer a user-facing gate.
    const legacyEndingEligible = stage0iEndingEligible;
    stage0iEndingEligible = function stage2dEndingSelectable(endingId, finalsData = stage0iFinalsCache) {
        return Boolean(stage0iFindEnding(endingId, finalsData));
    };

    const baseApplyChoice = applyChoice;
    applyChoice = async function stage2dApplyChoice(choice, options = {}) {
        if (choice?.endingId) {
            const result = routeStrength(choice.endingId, stats);
            stats.endingRouteStrength = result;
            window.stage2dLastRouteStrength = result;
        }
        return await baseApplyChoice(choice, options);
    };

    loadFinals = async function stage2dLoadFinals(endingId, generation = runtimeGeneration) {
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
            showEnding(ending, generation);
            return true;
        } catch (error) {
            if (!isRunCurrent(generation)) return false;
            console.error('[Stage 2D] ending load failed:', error);
            showErrorMessage(stats.language === 'ru' ? 'Не удалось загрузить финал. Попробуйте ещё раз.' : 'Failed to load ending. Please try again.');
            return false;
        }
    };

    window.stage2dRouteStrength = routeStrength;
    window.stage2dEndingSelectable = stage0iEndingEligible;
    window.stage2dLegacyEndingEligible = legacyEndingEligible;
    window.stage2dEndingProfiles = profile;
})();
