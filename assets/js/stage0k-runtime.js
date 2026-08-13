// Stage 0N bootstrap: keep the previous Stage 0K/0M byte-for-byte, then apply gallery restoration.
if (document.readyState === 'loading') {
    document.write('<script src="assets/js/stage0k-runtime-base.js"><\/script>');
    document.write('<script src="assets/js/stage0n-gallery.js"><\/script>');
} else {
    const base = document.createElement('script');
    base.src = 'assets/js/stage0k-runtime-base.js';
    base.onload = () => {
        const gallery = document.createElement('script');
        gallery.src = 'assets/js/stage0n-gallery.js';
        document.head.appendChild(gallery);
    };
    document.head.appendChild(base);
}
