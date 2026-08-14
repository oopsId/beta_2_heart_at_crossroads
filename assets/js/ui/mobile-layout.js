// Portrait-mobile layout sync: preserve authored character centres and pin the compose phone to dialogue.
(() => {
    const portraitMobile = window.matchMedia('(max-width: 800px) and (orientation: portrait)');
    let syncFrame = 0;

    function syncCharacterOffsets() {
        const left = document.getElementById('character-left');
        const right = document.getElementById('character-right');
        if (!left || !right) return;

        const authoredLeft = left.style.left || '-15%';
        const authoredRight = right.style.right || '-15%';
        if (left.style.getPropertyValue('--heart-mobile-left-authored') !== authoredLeft) {
            left.style.setProperty('--heart-mobile-left-authored', authoredLeft);
        }
        if (right.style.getPropertyValue('--heart-mobile-right-authored') !== authoredRight) {
            right.style.setProperty('--heart-mobile-right-authored', authoredRight);
        }
    }

    function syncPhoneDialogueAnchor() {
        const body = document.body;
        if (!body) return false;
        if (!portraitMobile.matches || !body.classList.contains('stage0j-compose-scene')) {
            body.style.removeProperty('--phone-dialogue-top');
            return false;
        }

        const dialogue = document.querySelector('#game-container .dialogue-box');
        if (!dialogue || getComputedStyle(dialogue).display === 'none') return false;
        const rect = dialogue.getBoundingClientRect();
        if (!Number.isFinite(rect.top)) return false;
        body.style.setProperty('--phone-dialogue-top', `${Math.max(0, rect.top).toFixed(2)}px`);
        return true;
    }

    function syncNow() {
        syncCharacterOffsets();
        syncPhoneDialogueAnchor();
    }

    function scheduleSync() {
        if (syncFrame) cancelAnimationFrame(syncFrame);
        syncFrame = requestAnimationFrame(() => {
            syncFrame = 0;
            syncNow();
        });
    }

    function install() {
        const left = document.getElementById('character-left');
        const right = document.getElementById('character-right');
        const dialogue = document.querySelector('#game-container .dialogue-box');

        const characterObserver = new MutationObserver(scheduleSync);
        if (left) characterObserver.observe(left, { attributes: true, attributeFilter: ['style'] });
        if (right) characterObserver.observe(right, { attributes: true, attributeFilter: ['style'] });

        const bodyObserver = new MutationObserver(scheduleSync);
        if (document.body) bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        if (dialogue && typeof ResizeObserver === 'function') {
            const dialogueObserver = new ResizeObserver(scheduleSync);
            dialogueObserver.observe(dialogue);
        }

        window.addEventListener('resize', scheduleSync, { passive: true });
        if (typeof portraitMobile.addEventListener === 'function') portraitMobile.addEventListener('change', scheduleSync);
        else if (typeof portraitMobile.addListener === 'function') portraitMobile.addListener(scheduleSync);

        syncNow();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();

    window.heartSyncMobileLayout = () => {
        syncNow();
        return true;
    };
})();
