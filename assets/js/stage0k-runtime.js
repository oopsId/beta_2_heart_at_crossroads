// Stage 0Q bootstrap: preserve staged runtime layers and load HUD CSS hotfix.
if (document.readyState === 'loading') {
    document.write('<link rel="stylesheet" href="assets/hud-hotfix.css">');
    document.write('<script src="assets/js/stage0k-runtime-base.js"><\/script>');
    document.write('<script src="assets/js/stage0n-gallery.js"><\/script>');
    document.write('<script src="assets/js/stage0o-runtime.js"><\/script>');
} else {
    const hudStyle = document.createElement('link');
    hudStyle.rel = 'stylesheet';
    hudStyle.href = 'assets/hud-hotfix.css';
    document.head.appendChild(hudStyle);

    const base = document.createElement('script');
    base.src = 'assets/js/stage0k-runtime-base.js';
    base.onload = () => {
        const gallery = document.createElement('script');
        gallery.src = 'assets/js/stage0n-gallery.js';
        gallery.onload = () => {
            const hotfix = document.createElement('script');
            hotfix.src = 'assets/js/stage0o-runtime.js';
            document.head.appendChild(hotfix);
        };
        document.head.appendChild(gallery);
    };
    document.head.appendChild(base);
}
