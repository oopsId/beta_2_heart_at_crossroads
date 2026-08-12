import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const assert = (condition, message, details = '') => {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};
const url = 'http://127.0.0.1:8000/heart_at_crossroads.html';

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof beginRuntimeSession === 'function' &&
  typeof invalidateRuntimeSession === 'function' &&
  typeof typeText === 'function' &&
  typeof showSceneWithTimer === 'function'
);
await page.waitForTimeout(100);

// 1. Typewriter callback scheduled by an abandoned run must not fire after Menu.
let result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('smoke-typewriter');
  currentChapter = 4;
  currentScene = 9;
  stats = createFreshRunStats(false);
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('dialogue-box').style.display = 'block';
  document.getElementById('menu').style.display = 'flex';

  let callbackFired = 0;
  typeText('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(8), document.getElementById('dialogue-text'), () => {
    callbackFired += 1;
    currentChapter = 8;
    currentScene = 88;
  }, generation);

  await new Promise(resolve => window.setTimeout(resolve, 80));
  document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(resolve => window.setTimeout(resolve, 1300));

  return {
    callbackFired,
    chapter: currentChapter,
    scene: currentScene,
    startDisplay: document.getElementById('start-screen').style.display,
    gameDisplay: document.getElementById('game-container').style.display,
    active: runtimeActive,
    timeouts: runtimeTimeouts.size,
    intervals: runtimeIntervals.size,
    choices: document.querySelectorAll('.choice-btn').length,
    overlays: document.querySelectorAll('.phone-overlay').length,
    runSave: localStorage.getItem('heart_at_crossroads_beta2:v1:run')
  };
});
assert(result.callbackFired === 0, 'Stale typewriter callback fired after Menu', JSON.stringify(result));
assert(result.chapter === 1 && result.scene === 0, 'Menu reset was later mutated by old typewriter', JSON.stringify(result));
assert(result.startDisplay === 'flex' && result.gameDisplay === 'none', 'Menu UI did not remain on start screen', JSON.stringify(result));
assert(result.active === false && result.timeouts === 0 && result.intervals === 0, 'Runtime tasks survived Menu', JSON.stringify(result));
assert(result.runSave === null, 'Menu did not delete run save', JSON.stringify(result));

// 2. Explicit timed choice must not auto-commit after Menu.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('smoke-timed-choice');
  stats = createFreshRunStats(false);
  currentChapter = 1;
  currentScene = 7;
  choices = [];
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('dialogue-box').style.display = 'block';
  document.getElementById('menu').style.display = 'flex';

  const originalSetupBackground = setupBackground;
  const originalSetupCharacters = setupCharacters;
  const originalTypeText = typeText;
  const originalPlaySound = playSound;
  const originalPlayMusic = playMusic;
  const originalMessenger = showMessengerOverlay;
  try {
    setupBackground = async (background) => background;
    setupCharacters = async () => true;
    typeText = (_text, _element, callback) => { callback(); return true; };
    playSound = () => null;
    playMusic = () => null;
    showMessengerOverlay = () => {
      const overlay = document.createElement('div');
      overlay.className = 'phone-overlay';
      document.getElementById('game-container').appendChild(overlay);
      return overlay;
    };

    scriptData = await (await fetch('assets/data/chapter1.json')).json();
    const scene = structuredClone(scriptData.scenes.find(item => item.id === 7));
    scene.timeout.seconds = 0.35;
    currentBackground = scene.background;
    showSceneWithTimer(scene, generation);
    await new Promise(resolve => window.setTimeout(resolve, 70));

    document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(resolve => window.setTimeout(resolve, 650));

    return {
      choices: [...choices],
      chapter: currentChapter,
      scene: currentScene,
      countdown: Boolean(document.getElementById('timer-countdown')),
      choiceButtons: document.querySelectorAll('.choice-btn').length,
      overlays: document.querySelectorAll('.phone-overlay').length,
      timeouts: runtimeTimeouts.size,
      intervals: runtimeIntervals.size,
      audios: runtimeAudios.size
    };
  } finally {
    setupBackground = originalSetupBackground;
    setupCharacters = originalSetupCharacters;
    typeText = originalTypeText;
    playSound = originalPlaySound;
    playMusic = originalPlayMusic;
    showMessengerOverlay = originalMessenger;
  }
});
assert(result.choices.length === 0, 'Timed choice committed after Menu', JSON.stringify(result));
assert(result.chapter === 1 && result.scene === 0, 'Timed-choice callback mutated reset run', JSON.stringify(result));
assert(!result.countdown && result.choiceButtons === 0 && result.overlays === 0, 'Timed-choice DOM survived Menu', JSON.stringify(result));
assert(result.timeouts === 0 && result.intervals === 0 && result.audios === 0, 'Timed-choice tasks/audio survived Menu', JSON.stringify(result));

// 3. Fade callback must not execute after Menu.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('smoke-fade');
  currentChapter = 3;
  currentScene = 2;
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  let fadeCallback = 0;
  fadeOut(() => {
    fadeCallback += 1;
    currentChapter = 9;
    currentScene = 99;
  }, generation);
  await new Promise(resolve => window.setTimeout(resolve, 60));
  document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(resolve => window.setTimeout(resolve, 1200));
  return { fadeCallback, chapter: currentChapter, scene: currentScene };
});
assert(result.fadeCallback === 0 && result.chapter === 1 && result.scene === 0, 'Stale fade callback fired after Menu', JSON.stringify(result));

// 4. Delayed chapter fetch may finish, but cannot assign stale scriptData after Menu.
result = await page.evaluate(async () => {
  const originalFetch = window.fetch;
  const generation = beginRuntimeSession('smoke-delayed-fetch');
  currentChapter = 1;
  currentScene = 4;
  scriptData = { marker: 'old-run' };
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';

  window.fetch = async (input, init) => {
    const text = String(input);
    if (text.includes('chapter2.json')) {
      await new Promise(resolve => window.setTimeout(resolve, 350));
      return new Response(JSON.stringify({ chapter: 2, scenes: [{ id: 0, text: { ru: 'late', en: 'late' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(input, init);
  };

  try {
    const pending = loadChapter(2, generation);
    await new Promise(resolve => window.setTimeout(resolve, 50));
    document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const loaded = await pending;
    await new Promise(resolve => window.setTimeout(resolve, 100));
    return {
      loaded,
      scriptData,
      chapter: currentChapter,
      scene: currentScene,
      active: runtimeActive
    };
  } finally {
    window.fetch = originalFetch;
  }
});
assert(result.loaded === false, 'Stale chapter fetch reported success', JSON.stringify(result));
assert(result.scriptData === null && result.chapter === 1 && result.scene === 0 && result.active === false,
  'Stale chapter fetch mutated reset runtime', JSON.stringify(result));

// 5. Audio and generated DOM are forcibly cleaned by Menu.
result = await page.evaluate(async () => {
  beginRuntimeSession('smoke-audio-dom');
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  const audio = createRuntimeAudio('assets/sounds/sfx_tick.mp3', { loop: true });
  window.currentMusic = audio;
  const overlay = document.createElement('div');
  overlay.className = 'phone-overlay';
  document.getElementById('game-container').appendChild(overlay);
  const choice = document.createElement('button');
  choice.className = 'choice-btn';
  document.getElementById('dialogue-box').appendChild(choice);

  document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(resolve => window.setTimeout(resolve, 200));
  return {
    currentMusicNull: window.currentMusic === null,
    audios: runtimeAudios.size,
    overlays: document.querySelectorAll('.phone-overlay').length,
    choices: document.querySelectorAll('.choice-btn').length
  };
});
assert(result.currentMusicNull && result.audios === 0 && result.overlays === 0 && result.choices === 0,
  'Menu did not clean audio/DOM artifacts', JSON.stringify(result));

// 6. A new generation still works after cancellation.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('smoke-new-generation');
  currentScene = 0;
  runtimeSetTimeout(() => {
    if (isRunCurrent(generation)) currentScene = 2;
  }, 80, generation);
  await new Promise(resolve => window.setTimeout(resolve, 140));
  const beforeInvalidate = currentScene;
  invalidateRuntimeSession('smoke-cleanup');
  return { beforeInvalidate, active: runtimeActive, tasks: runtimeTimeouts.size + runtimeIntervals.size };
});
assert(result.beforeInvalidate === 2 && result.active === false && result.tasks === 0,
  'Fresh generation did not operate normally after cancellation', JSON.stringify(result));

// 7. 15-second soak: even a long delayed stale mutation cannot resurrect the abandoned run.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('smoke-15s-soak');
  currentChapter = 6;
  currentScene = 6;
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';

  let staleMutation = 0;
  runtimeSetTimeout(() => {
    staleMutation += 1;
    currentChapter = 10;
    currentScene = 999;
  }, 12000, generation);

  document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(resolve => window.setTimeout(resolve, 15100));
  return {
    staleMutation,
    chapter: currentChapter,
    scene: currentScene,
    startDisplay: document.getElementById('start-screen').style.display,
    gameDisplay: document.getElementById('game-container').style.display,
    active: runtimeActive,
    timeouts: runtimeTimeouts.size,
    intervals: runtimeIntervals.size,
    audios: runtimeAudios.size,
    artifacts: document.querySelectorAll('.phone-overlay, #timer-countdown, .choice-btn, .choice-feedback, .memory-notification, #loading-overlay, #loading-status, .epilogue-overlay').length
  };
});
assert(result.staleMutation === 0, '15-second stale mutation resurrected abandoned run', JSON.stringify(result));
assert(result.chapter === 1 && result.scene === 0, 'State changed during 15-second Menu soak', JSON.stringify(result));
assert(result.startDisplay === 'flex' && result.gameDisplay === 'none' && result.active === false,
  'UI/runtime did not remain reset during 15-second soak', JSON.stringify(result));
assert(result.timeouts === 0 && result.intervals === 0 && result.audios === 0 && result.artifacts === 0,
  'Runtime resources survived 15-second soak', JSON.stringify(result));

console.log(JSON.stringify({
  status: 'PASS',
  typewriterCancelled: true,
  timedChoiceCancelled: true,
  fadeCancelled: true,
  staleFetchIgnored: true,
  audioAndOverlaysCleaned: true,
  nextGenerationWorks: true,
  menuSoakSeconds: 15,
  staleResurrection: false
}, null, 2));

await browser.close();
