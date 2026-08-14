// Desktop wheel master-volume control. Loaded after foundation so every runtime Audio shares one level.
(() => {
    const VOLUME_STEP = 0.05;
    const baseCreateRuntimeAudio = createRuntimeAudio;
    let masterVolume = 1;

    function clampVolume(value) {
        return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
    }

    function applyVolume(audio) {
        if (!audio) return;
        audio.volume = masterVolume;
    }

    function setMasterVolume(value) {
        masterVolume = clampVolume(value);
        for (const audio of runtimeAudios) applyVolume(audio);
        applyVolume(window.currentMusic);
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
        setMasterVolume(masterVolume + (event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP));
    }, { passive: false });

    window.heartAudioVolume = Object.freeze({
        get: () => masterVolume,
        set: setMasterVolume
    });
})();
