// Replay text developer override.
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
