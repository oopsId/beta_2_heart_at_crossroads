// Stage 0P: restore original gallery copy and keep unlock UI single-layered.
(() => {
  const isRu = () => stats.language === 'ru';

  function polishGallery() {
    const gallery = document.getElementById('gallery-container');
    if (!gallery?.classList.contains('stage0n')) return;

    const seriesData = cardSeries?.romance;
    const cards = seriesData?.cards || [];
    const unlockedCount = cards.filter(card => Array.isArray(stats.memories) && stats.memories.includes(card.id)).length;

    const subtitle = gallery.querySelector('.n-sub');
    const subtitleText = isRu() ? seriesData?.style : seriesData?.styleEn;
    if (subtitle && subtitleText && subtitle.textContent !== subtitleText) subtitle.textContent = subtitleText;

    const series = gallery.querySelector('.n-series');
    const title = isRu() ? seriesData?.title : seriesData?.titleEn;
    const seriesText = `${isRu() ? 'Серия: ' : 'Series: '}${title || ''} ${unlockedCount}/${cards.length}`;
    if (series && series.textContent !== seriesText) series.textContent = seriesText;

    gallery.querySelectorAll('.n-card').forEach(card => {
      const button = card.querySelector('.n-unlock');
      const duplicateStatus = card.querySelector('.n-status');
      if (button && duplicateStatus) duplicateStatus.remove();
    });
  }

  function polishDetails() {
    document.querySelectorAll('.n-detail').forEach(detail => {
      detail.classList.toggle('ru', isRu());
      detail.classList.toggle('en', !isRu());
    });
  }

  let queued = false;
  const schedulePolish = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      polishGallery();
      polishDetails();
    });
  };

  const observer = new MutationObserver(schedulePolish);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const basePremiumGallery = window.showPremiumGallery;
  if (typeof basePremiumGallery === 'function') {
    window.showPremiumGallery = function stage0pShowPremiumGallery(...args) {
      const result = basePremiumGallery(...args);
      schedulePolish();
      return result;
    };
  }

  const baseSimpleGallery = window.showSimpleGallery;
  if (typeof baseSimpleGallery === 'function') {
    window.showSimpleGallery = function stage0pShowSimpleGallery(...args) {
      const result = baseSimpleGallery(...args);
      schedulePolish();
      return result;
    };
  }

  window.stage0pPolishGallery = () => {
    polishGallery();
    polishDetails();
  };
})();
