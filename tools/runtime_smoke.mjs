import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('dialog', dialog => dialog.dismiss().catch(() => {}));

const assert = (condition, message, details = '') => {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};

const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof beginRuntimeSession === 'function' &&
  typeof loadSession === 'function' &&
  typeof transitionTo === 'function' &&
  typeof applyTimeoutOutcome === 'function' &&
  typeof resolveSceneTransition === 'function' &&
  typeof stage0iEnsureFinals === 'function' &&
  typeof stage0iEndingEligible === 'function' &&
  typeof stage0jRenderSceneVisuals === 'function' &&
  typeof stage0jShowComposeOverlay === 'function' &&
  typeof stage0kDevForceFirstPlaythrough === 'function' &&
  typeof stage0kApplyReplayOverride === 'function'
);
await page.waitForTimeout(100);

const results = {};

// 1. Versioned browser save survives an artificial reload boundary and Continue restores exact state.
let result = await page.evaluate(async () => {
  localStorage.removeItem('heart_at_crossroads_beta2:v1:run');
  localStorage.removeItem('heart_at_crossroads_beta2:v1:profile');

  let generation = beginRuntimeSession('0h-save');
  resetGameState(false);
  currentChapter = 3;
  currentScene = 4;
  choices = ['smoke-choice'];
  stats.heart = 7;
  stats.crown = 2;
  stats.relationships.dima = 4;
  stats.language = 'en';
  stats.completionCount = 2;
  stats.memories = ['smoke-memory'];
  await saveSession();

  invalidateRuntimeSession('0h-reload-boundary');
  resetGameState(false);
  currentChapter = 1;
  currentScene = 0;

  generation = beginRuntimeSession('0h-continue');
  const loaded = await loadSession(generation);
  const snapshot = {
    loaded,
    chapter: currentChapter,
    scene: currentScene,
    choices: [...choices],
    heart: stats.heart,
    crown: stats.crown,
    dima: stats.relationships.dima,
    language: stats.language,
    completionCount: stats.completionCount,
    memories: [...stats.memories]
  };
  invalidateRuntimeSession('0h-save-cleanup');
  return snapshot;
});
assert(result.loaded === true, 'Continue did not load saved run', JSON.stringify(result));
assert(result.chapter === 3 && result.scene === 4, 'Continue restored wrong location', JSON.stringify(result));
assert(result.heart === 7 && result.crown === 2 && result.dima === 4, 'Continue restored wrong run stats', JSON.stringify(result));
assert(result.language === 'en' && result.completionCount === 2 && result.memories.includes('smoke-memory'), 'Profile did not survive reload boundary', JSON.stringify(result));
results.saveContinue = true;

// 2. Intentional Menu destroys run and cancels stale runtime before it can mutate reset state.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0h-menu');
  resetGameState(false);
  currentChapter = 6;
  currentScene = 6;
  stats.heart = 9;
  await saveSession();
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';

  let staleMutation = 0;
  runtimeSetTimeout(() => {
    staleMutation += 1;
    currentChapter = 9;
    currentScene = 99;
  }, 250, generation);

  document.getElementById('menu-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(resolve => window.setTimeout(resolve, 600));

  return {
    staleMutation,
    chapter: currentChapter,
    scene: currentScene,
    active: runtimeActive,
    run: localStorage.getItem('heart_at_crossroads_beta2:v1:run'),
    startDisplay: document.getElementById('start-screen').style.display,
    gameDisplay: document.getElementById('game-container').style.display,
    tasks: runtimeTimeouts.size + runtimeIntervals.size
  };
});
assert(result.staleMutation === 0 && result.chapter === 1 && result.scene === 0, 'Menu allowed stale runtime mutation', JSON.stringify(result));
assert(result.run === null && result.active === false && result.tasks === 0, 'Menu did not destroy run/runtime tasks', JSON.stringify(result));
assert(result.startDisplay === 'flex' && result.gameDisplay === 'none', 'Menu did not remain on start screen', JSON.stringify(result));
results.menuCancellation = true;

// 3. Both explicit timeout modes use the same applyChoice/transition pipeline.
result = await page.evaluate(async () => {
  const originalShowScene = showScene;
  try {
    showScene = async (_sceneId, generation) => isRunCurrent(generation);

    let generation = beginRuntimeSession('0h-timeout-hidden');
    resetGameState(false);
    currentChapter = 2;
    currentScene = 1;
    choices = [];
    stats.heart = 0;
    stats.crown = 0;
    const chapter2 = await (await fetch('assets/data/chapter2.json')).json();
    scriptData = chapter2;
    const scene1 = chapter2.scenes.find(scene => scene.id === 1);
    const hiddenConfig = getTimeoutConfig(scene1);
    const hiddenOk = await applyTimeoutOutcome(scene1, hiddenConfig, { generation });
    const hidden = {
      ok: hiddenOk,
      scene: currentScene,
      choices: [...choices],
      heart: stats.heart,
      crown: stats.crown
    };
    invalidateRuntimeSession('0h-timeout-hidden-done');

    generation = beginRuntimeSession('0h-timeout-choice');
    resetGameState(false);
    currentChapter = 1;
    currentScene = 7;
    choices = [];
    const chapter1 = await (await fetch('assets/data/chapter1.json')).json();
    scriptData = chapter1;
    const scene7 = chapter1.scenes.find(scene => scene.id === 7);
    const choiceConfig = getTimeoutConfig(scene7);
    const choiceOk = await applyTimeoutOutcome(scene7, choiceConfig, { generation });
    const choiceMode = { ok: choiceOk, scene: currentScene, choices: [...choices], choiceId: choiceConfig.choiceId };
    invalidateRuntimeSession('0h-timeout-choice-done');

    return { hidden, choiceMode };
  } finally {
    showScene = originalShowScene;
  }
});
assert(result.hidden.ok && result.hidden.scene === 5 && result.hidden.choices.includes('no_reply'), 'Hidden timeout outcome is broken', JSON.stringify(result));
assert(result.hidden.heart === 0 && result.hidden.crown === 0, 'Hidden no_reply changed personality stats', JSON.stringify(result));
assert(result.choiceMode.ok && result.choiceMode.choiceId === 'ignore' && result.choiceMode.choices.includes('ignore'), 'timeout.choiceId mode is broken', JSON.stringify(result));
results.timedChoices = true;

// 4. Explicit null ends a branch; it never bleeds into numeric sibling scene.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0h-branch-null');
  resetGameState(false);
  currentChapter = 1;
  scriptData = await (await fetch('assets/data/chapter1.json')).json();
  const scene22 = scriptData.scenes.find(scene => scene.id === 22);
  const scene23 = scriptData.scenes.find(scene => scene.id === 23);
  const r22 = resolveSceneTransition(scene22);
  const r23 = resolveSceneTransition(scene23);
  invalidateRuntimeSession('0h-branch-null-done');
  return { r22, r23 };
});
assert(result.r22.type === 'chapter' && result.r22.chapterId === 2, 'scene22 branch bleed regression', JSON.stringify(result));
assert(result.r23.type === 'chapter' && result.r23.chapterId === 2, 'scene23 branch bleed regression', JSON.stringify(result));
results.branchTerminal = true;

// 5. Failed chapter load rolls transition state back and never renders the failed chapter.
result = await page.evaluate(async () => {
  const originalLoadChapter = loadChapter;
  const originalShowScene = showScene;
  let showCalls = 0;
  try {
    const generation = beginRuntimeSession('0h-load-failure');
    resetGameState(false);
    currentChapter = 3;
    currentScene = 2;
    loadChapter = async () => false;
    showScene = async () => { showCalls += 1; return true; };
    const ok = await transitionTo({ type: 'chapter', chapterId: 4 }, { generation });
    const snapshot = { ok, chapter: currentChapter, scene: currentScene, showCalls };
    invalidateRuntimeSession('0h-load-failure-done');
    return snapshot;
  } finally {
    loadChapter = originalLoadChapter;
    showScene = originalShowScene;
  }
});
assert(result.ok === false && result.chapter === 3 && result.scene === 2 && result.showCalls === 0, 'Failed chapter load did not fail closed', JSON.stringify(result));
results.loadFailure = true;

// 6. Chapter 10 terminal scene owns its ending; eligibility is rechecked without transient pending state.
result = await page.evaluate(async () => {
  const originalShowEnding = showEnding;
  let captured = null;
  try {
    const generation = beginRuntimeSession('0i-ending');
    resetGameState(false);
    currentChapter = 10;
    currentScene = 7;
    stats.heart = 15;
    stats.leaf = 10;
    stats.relationships.mark = 4;
    scriptData = await (await fetch('assets/data/chapter10.json')).json();
    const terminal = scriptData.scenes.find(scene => scene.id === 7);
    const route = resolveSceneTransition(terminal);
    showEnding = (ending, gen) => {
      if (!isRunCurrent(gen)) return false;
      captured = ending.id;
      return true;
    };
    const loaded = await loadFinals(route.endingId, generation);
    const snapshot = {
      route,
      loaded,
      captured,
      hasPendingGlobal: Object.prototype.hasOwnProperty.call(window, 'pendingEndingId')
    };
    invalidateRuntimeSession('0i-ending-done');
    return snapshot;
  } finally {
    showEnding = originalShowEnding;
  }
});
assert(result.route.type === 'ending' && result.route.endingId === 'silence_with_mark', 'Terminal ending ownership regression', JSON.stringify(result));
assert(result.loaded === true && result.captured === 'silence_with_mark' && result.hasPendingGlobal === false, 'Eligible ending load depends on transient context', JSON.stringify(result));
results.endings = true;

// 7. Final agency is permanently covered by tools/stage2d_smoke.mjs.

// 8. Chapter 2 / scene 1 uses the compose overlay: Anna header, empty input caret, three notifications, no duplicated narration.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0j-phone-compose');
  resetGameState(false);
  currentChapter = 2;
  currentScene = 1;
  scriptData = await (await fetch('assets/data/chapter2.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 1);
  const originalTypeText = typeText;
  const originalPlaySound = playSound;
  const originalPlayMusic = playMusic;
  try {
    typeText = (_text, _element, callback) => { callback?.(); return true; };
    playSound = () => null;
    playMusic = () => null;
    showSceneWithTimer(scene, generation);
    await new Promise(resolve => window.setTimeout(resolve, 250));
    const overlay = document.getElementById('phone-compose-overlay');
    const notifications = overlay ? [...overlay.querySelectorAll('.stage0j-notification')] : [];
    const hrefs = overlay ? [...overlay.querySelectorAll('img')].map(image => image.getAttribute('src') || '') : [];
    const snapshot = {
      phoneMode: scene.phoneMode,
      exists: Boolean(overlay),
      text: overlay?.textContent || '',
      notifications: notifications.length,
      senders: notifications.map(node => node.dataset.senderId),
      hasAnnaAvatar: hrefs.some(href => href.includes('anna_messenger_ava.png')),
      hasCaret: Boolean(overlay?.querySelector('.stage0j-compose-caret')),
      phoneBackground: overlay ? getComputedStyle(overlay.querySelector('.stage0j-phone-screen')).backgroundImage : '',
      dialogue: scene.text.ru
    };
    invalidateRuntimeSession('0j-phone-compose-done');
    return snapshot;
  } finally {
    typeText = originalTypeText;
    playSound = originalPlaySound;
    playMusic = originalPlayMusic;
  }
});
assert(result.phoneMode === 'compose' && result.exists, 'Compose phone overlay did not render', JSON.stringify(result));
assert(result.hasAnnaAvatar && result.hasCaret && result.notifications === 3, 'Compose overlay lost Anna avatar/caret/notifications', JSON.stringify(result));
assert(result.senders.join(',') === 'lyosha,mark,sergey', 'Compose notification senders drifted from final choices', JSON.stringify(result));
assert(result.phoneBackground.includes('bg_phone_ui.png') && !result.phoneBackground.includes('linear-gradient'), 'Compose phone lost green messenger background', JSON.stringify(result));
assert(!result.text.includes('Пальцы замерли') && !result.text.includes('My fingers hovered'), 'Phone overlay duplicates narration text', JSON.stringify(result));
assert(!result.dialogue.includes('Катя в WhatsApp'), 'Scene narration still contains stale Katya branch that is not selectable', JSON.stringify(result));
results.phoneOverlay = true;

// 8a. All timed phone scenes use real-avatar compose overlays; legacy messenger renderer is forbidden here.
result = await page.evaluate(async () => {
  const chapters = await Promise.all([1, 2, 3, 6].map(async chapter => await (await fetch(`assets/data/chapter${chapter}.json`)).json()));
  const legacyTimed = [];
  for (const chapter of chapters) {
    for (const scene of chapter.scenes) {
      if (scene.timeout && scene.phoneMode === 'messenger') legacyTimed.push(`${chapter.chapter}/${scene.id}`);
    }
  }

  const generation = beginRuntimeSession('0l-phone-avatars');
  resetGameState(false);
  currentChapter = 6;
  scriptData = chapters.find(chapter => chapter.chapter === 6);
  const scene = scriptData.scenes.find(candidate => candidate.id === 6);
  const overlay = stage0jShowComposeOverlay(scene, generation);
  await new Promise(resolve => window.setTimeout(resolve, 80));
  const notifications = overlay ? [...overlay.querySelectorAll('.stage0j-notification')] : [];
  const imageSources = overlay ? [...overlay.querySelectorAll('.stage0j-notification-avatar')].map(image => image.getAttribute('src') || '') : [];
  const fallbacks = overlay ? overlay.querySelectorAll('.stage0j-notification-initial').length : -1;
  const dimaDecoded = await stage0jDecodeImage('assets/characters/dima/dima_messenger_ava.png');
  const snapshot = {
    legacyTimed,
    phoneMode: scene.phoneMode,
    senders: notifications.map(node => node.dataset.senderId),
    imageSources,
    fallbacks,
    dimaDecoded
  };
  overlay?.remove();
  invalidateRuntimeSession('0l-phone-avatars-done');
  return snapshot;
});
assert(result.legacyTimed.length === 0, 'Timed scene still uses legacy messenger overlay', JSON.stringify(result));
assert(result.phoneMode === 'compose' && result.senders.join(',') === 'mark,dima', 'Chapter 6 scene 6 did not migrate to Mark+Dima compose notifications', JSON.stringify(result));
assert(result.imageSources.some(src => src.includes('mark_messenger_ava.png')) && result.imageSources.some(src => src.includes('dima_messenger_ava.png')), 'Chapter 6 scene 6 is missing real Mark/Dima avatars', JSON.stringify(result));
assert(result.fallbacks === 0 && result.dimaDecoded === true, 'Compose notification fell back to an initial or Dima avatar failed to decode', JSON.stringify(result));
results.phoneAvatars = true;

// 8b. Compose phone stays on-screen on desktop and never overlaps dialogue in short landscape.
await page.setViewportSize({ width: 1920, height: 1080 });
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0j-phone-desktop-layout');
  resetGameState(false);
  currentChapter = 2;
  scriptData = await (await fetch('assets/data/chapter2.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 1);
  document.getElementById('game-container').style.display = 'block';
  const overlay = stage0jShowComposeOverlay(scene, generation);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const rect = overlay.getBoundingClientRect();
  const snapshot = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  overlay.remove();
  invalidateRuntimeSession('0j-phone-desktop-layout-done');
  return snapshot;
});
assert(result.left >= 0 && result.top >= 0 && result.right <= result.width && result.bottom <= result.height, 'Compose phone is clipped off desktop viewport', JSON.stringify(result));
assert(Math.abs(((result.left + result.right) / 2) - (result.width / 2)) <= 2, 'Compose phone is not horizontally centered on desktop', JSON.stringify(result));

await page.setViewportSize({ width: 667, height: 375 });
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0j-phone-landscape-layout');
  resetGameState(false);
  currentChapter = 2;
  scriptData = await (await fetch('assets/data/chapter2.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 1);
  const game = document.getElementById('game-container');
  const dialogue = document.querySelector('.dialogue-box');
  game.style.display = 'block';
  dialogue.style.display = 'flex';
  document.body.classList.add('stage0j-compose-scene');
  const overlay = stage0jShowComposeOverlay(scene, generation);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const phoneRect = overlay.getBoundingClientRect();
  const dialogueRect = dialogue.getBoundingClientRect();
  const overlaps = !(phoneRect.right <= dialogueRect.left || phoneRect.left >= dialogueRect.right || phoneRect.bottom <= dialogueRect.top || phoneRect.top >= dialogueRect.bottom);
  const snapshot = {
    phone: { left: phoneRect.left, top: phoneRect.top, right: phoneRect.right, bottom: phoneRect.bottom },
    dialogue: { left: dialogueRect.left, top: dialogueRect.top, right: dialogueRect.right, bottom: dialogueRect.bottom },
    width: innerWidth,
    height: innerHeight,
    overlaps
  };
  overlay.remove();
  document.body.classList.remove('stage0j-compose-scene');
  invalidateRuntimeSession('0j-phone-landscape-layout-done');
  return snapshot;
});
assert(result.phone.left >= 0 && result.phone.top >= 0 && result.phone.right <= result.width && result.phone.bottom <= result.height, 'Compose phone is clipped in short landscape', JSON.stringify(result));
assert(Math.abs(((result.phone.left + result.phone.right) / 2) - (result.width / 2)) <= 2, 'Compose phone is not centered in short landscape', JSON.stringify(result));
assert(result.dialogue.left <= 1 && result.dialogue.right >= result.width - 1, 'Compose scene displaced/cropped the normal dialogue box', JSON.stringify(result));
assert(result.overlaps === false, 'Compose phone overlaps dialogue in short landscape', JSON.stringify(result));
results.phoneLayout = true;
await page.setViewportSize({ width: 1280, height: 720 });

// 8c. Dev/release separation is permanently covered by tools/mode_smoke.mjs.

// 9. Speaker focus follows the actual displayed character instead of hard-coded Anna/Vika positions.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0i-speaker');
  resetGameState(false);
  currentChapter = 10;
  scriptData = await (await fetch('assets/data/chapter10.json')).json();
  const dimaScene = scriptData.scenes.find(scene => scene.id === 6);
  const ok = await setupCharacters(dimaScene, 'ru', stats, generation);
  const left = document.getElementById('character-left');
  const right = document.getElementById('character-right');
  const snapshot = {
    ok,
    leftSpeaker: left.classList.contains('character-speaker'),
    leftNon: left.classList.contains('character-non-speaker'),
    rightSpeaker: right.classList.contains('character-speaker'),
    speakerName: document.getElementById('speaker-name').textContent
  };
  invalidateRuntimeSession('0i-speaker-done');
  return snapshot;
});
assert(result.ok && result.rightSpeaker && result.leftNon && !result.leftSpeaker && result.speakerName === 'Дима', 'Speaker highlight does not follow Dima sprite', JSON.stringify(result));
results.speakerFocus = true;

// 10. VN typewriter: reveal current || part on one click, wait, then next click starts next part.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0i-typewriter');
  resetGameState(false);
  const box = document.querySelector('.dialogue-box');
  const element = document.getElementById('dialogue-text');
  box.style.pointerEvents = 'auto';
  let callbacks = 0;
  const started = typeText('FIRST||SECOND', element, () => { callbacks += 1; }, generation);

  box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const afterRevealFirst = { text: element.textContent, callbacks, isTyping };

  box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const afterStartSecond = { text: element.textContent, callbacks, isTyping };

  box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const afterRevealSecond = { text: element.textContent, callbacks, isTyping };
  invalidateRuntimeSession('0i-typewriter-done');
  return { started, afterRevealFirst, afterStartSecond, afterRevealSecond };
});
assert(result.started && result.afterRevealFirst.text === 'FIRST' && result.afterRevealFirst.callbacks === 0 && result.afterRevealFirst.isTyping === false, 'First click did not reveal-and-pause current part', JSON.stringify(result));
assert(result.afterStartSecond.text.length > 0 && result.afterStartSecond.text !== 'FIRST' && result.afterStartSecond.callbacks === 0, 'Second click did not start next part', JSON.stringify(result));
assert(result.afterRevealSecond.text === 'SECOND' && result.afterRevealSecond.callbacks === 1 && result.afterRevealSecond.isTyping === false, 'Final part did not reveal and hand control to transition on next click', JSON.stringify(result));
results.typewriter = true;

// 11. Visual swap is atomic: old scene remains visible while replacement images decode, then all visual slots commit together.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0j-atomic-render');
  resetGameState(false);
  const bg = document.getElementById('background');
  const left = document.getElementById('character-left');
  const right = document.getElementById('character-right');
  bg.style.backgroundImage = 'url("old-bg")';
  left.style.backgroundImage = 'url("old-left")';
  right.style.backgroundImage = 'url("old-right")';

  const originalDecode = window.stage0jDecodeImage;
  const resolvers = [];
  window.stage0jDecodeImage = () => new Promise(resolve => resolvers.push(resolve));
  const scene = {
    id: 999,
    background: 'bg_apartment_morning',
    characterLeft: 'anna_thoughtful_style2',
    characterRight: 'lyosha_happy_style1',
    speaker: { ru: 'Анна', en: 'Anna' }
  };

  const renderPromise = window.stage0jRenderSceneVisuals(scene, 'ru', stats, generation);
  await new Promise(resolve => window.setTimeout(resolve, 30));
  const before = { bg: bg.style.backgroundImage, left: left.style.backgroundImage, right: right.style.backgroundImage };
  resolvers.splice(0).forEach(resolve => resolve(true));
  const ok = await renderPromise;
  const after = { bg: bg.style.backgroundImage, left: left.style.backgroundImage, right: right.style.backgroundImage };
  window.stage0jDecodeImage = originalDecode;
  invalidateRuntimeSession('0j-atomic-render-done');
  return { ok, before, after };
});
assert(result.before.bg.includes('old-bg') && result.before.left.includes('old-left') && result.before.right.includes('old-right'), 'Renderer cleared old scene before replacement decoded', JSON.stringify(result));
assert(result.ok && result.after.bg.includes('bg_apartment_morning.png') && result.after.left.includes('anna_thoughtful_style2.png') && result.after.right.includes('lyosha_happy_style1.png'), 'Atomic visual commit did not install complete new scene', JSON.stringify(result));
results.atomicVisualSwap = true;

console.log(JSON.stringify({ status: 'PASS', ...results }, null, 2));
await browser.close();
