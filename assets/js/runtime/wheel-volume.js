// Desktop wheel master-volume control. Loaded after foundation so every runtime Audio shares one level.
(() => {
    const VOLUME_STEP = 0.05;
    const HUD_HIDE_DELAY_MS = 1000;
    const HUD_CURSOR_OFFSET_PX = 2;
    const baseCreateRuntimeAudio = createRuntimeAudio;
    let masterVolume = 1;
    let hudHideTimer = 0;

    function clampVolume(value) {
        return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
    }

    function applyVolume(audio) {
        if (!audio) return;
        audio.volume = masterVolume;
    }

    function ensureVolumeHud() {
        let hud = document.getElementById('heart-volume-hud');
        if (hud) return hud;

        hud = document.createElement('div');
        hud.id = 'heart-volume-hud';
        hud.className = 'heart-volume-hud';
        hud.setAttribute('aria-live', 'polite');
        hud.setAttribute('aria-hidden', 'true');

        const percent = document.createElement('div');
        percent.className = 'heart-volume-percent';

        const track = document.createElement('div');
        track.className = 'heart-volume-track';

        const fill = document.createElement('div');
        fill.className = 'heart-volume-fill';
        track.appendChild(fill);
        hud.append(percent, track);
        document.body.appendChild(hud);
        return hud;
    }

    function showVolumeHud(clientX, clientY) {
        const hud = ensureVolumeHud();
        const percent = hud.querySelector('.heart-volume-percent');
        const fill = hud.querySelector('.heart-volume-fill');
        const percentage = Math.round(masterVolume * 100);

        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            hud.style.left = `${Math.round(clientX) + HUD_CURSOR_OFFSET_PX}px`;
            hud.style.top = `${Math.round(clientY) + HUD_CURSOR_OFFSET_PX}px`;
        }
        if (percent) percent.textContent = `${percentage}%`;
        if (fill) fill.style.height = `${percentage}%`;
        hud.classList.add('is-visible');
        hud.setAttribute('aria-hidden', 'false');

        if (hudHideTimer) window.clearTimeout(hudHideTimer);
        hudHideTimer = window.setTimeout(() => {
            hud.classList.remove('is-visible');
            hud.setAttribute('aria-hidden', 'true');
            hudHideTimer = 0;
        }, HUD_HIDE_DELAY_MS);
    }

    function setMasterVolume(value, options = {}) {
        masterVolume = clampVolume(value);
        for (const audio of runtimeAudios) applyVolume(audio);
        applyVolume(window.currentMusic);
        if (options.showHud === true) showVolumeHud(options.clientX, options.clientY);
        return masterVolume;
    }

    createRuntimeAudio = function heartCreateRuntimeAudio(src, options = {}) {
        const audio = baseCreateRuntimeAudio(src, options);
        applyVolume(audio);
        return audio;
    };

    window.addEventListener('wheel', event => {
        if (!runtimeActive || event.deltaY === 0) return;
        event.preventDefault();
        setMasterVolume(masterVolume + (event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP), {
            showHud: true,
            clientX: event.clientX,
            clientY: event.clientY
        });
    }, { passive: false });

    window.heartAudioVolume = Object.freeze({
        get: () => masterVolume,
        set: value => setMasterVolume(value)
    });
})();
