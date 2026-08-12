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
  typeof stage0iEndingEligible === 'function'
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

// 7. Final options are gated before click and a locked route cannot be forced through applyChoice.
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0i-eligibility');
  resetGameState(false);
  currentChapter = 10;
  currentScene = 5;
  scriptData = await (await fetch('assets/data/chapter10.json')).json();
  const scene5 = scriptData.scenes.find(scene => scene.id === 5);
  const box = document.querySelector('.dialogue-box');
  clearDialogueHandlers(box);

  stats.heart = 0;
  stats.leaf = 0;
  stats.crown = 0;
  stats.relationships.dima = 0;
  stats.relationships.mark = 0;
  stats.relationships.sergey = 0;
  stats.relationships.vika = 0;
  await handleChoices(scene5, box, null, generation);
  const lockedDima = box.querySelector('[data-choice-id="dima"]')?.disabled === true;
  const lockedMark = box.querySelector('[data-choice-id="mark"]')?.disabled === true;
  const forced = await applyChoice(scene5.choices.find(choice => choice.id === 'mark'), { generation });

  clearDialogueHandlers(box);
  stats.heart = 15;
  stats.relationships.dima = 2;
  await handleChoices(scene5, box, null, generation);
  const dimaButton = box.querySelector('[data-choice-id="dima"]');
  const unlockedDima = dimaButton?.disabled === false && dimaButton?.dataset.eligible === 'true';
  const premium = scene5.choices.find(choice => choice.id === 'premium');

  const snapshot = {
    lockedDima,
    lockedMark,
    forced,
    unlockedDima,
    premiumHasCost: Object.prototype.hasOwnProperty.call(premium, 'cost'),
    premiumText: premium.text.ru
  };
  invalidateRuntimeSession('0i-eligibility-done');
  return snapshot;
});
assert(result.lockedDima && result.lockedMark && result.forced === false, 'Locked final route can be selected before eligibility', JSON.stringify(result));
assert(result.unlockedDima, 'Reachable Dima gate did not unlock before click', JSON.stringify(result));
assert(result.premiumHasCost === false && !result.premiumText.includes('20 бриллиантов'), 'Impossible 20-diamond final gate remains', JSON.stringify(result));
results.eligibility = true;

// 8. Stage 0E timed messenger scenes still render the phone overlay (chapter 2 / scene 1 regression).
result = await page.evaluate(async () => {
  const generation = beginRuntimeSession('0i-phone');
  resetGameState(false);
  currentChapter = 2;
  currentScene = 1;
  scriptData = await (await fetch('assets/data/chapter2.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 1);
  const originalTypeText = typeText;
  const originalPlaySound = playSound;
  const originalPlayMusic = playMusic;
  try {
    currentBackground = scene.background;
    typeText = (_text, _element, callback) => { callback?.(); return true; };
    playSound = () => null;
    playMusic = () => null;
    showSceneWithTimer(scene, generation);
    await new Promise(resolve => window.setTimeout(resolve, 250));
    const overlay = document.getElementById('messenger-overlay');
    const hrefs = overlay ? [...overlay.querySelectorAll('image')].map(image => image.getAttribute('href') || '') : [];
    const snapshot = {
      phoneMode: scene.phoneMode,
      exists: Boolean(overlay),
      text: overlay?.textContent || '',
      hasAnnaAvatar: hrefs.some(href => href.includes('anna_messenger_ava.png'))
    };
    invalidateRuntimeSession('0i-phone-done');
    return snapshot;
  } finally {
    typeText = originalTypeText;
    playSound = originalPlaySound;
    playMusic = originalPlayMusic;
  }
});
assert(result.phoneMode === 'messenger' && result.exists, 'Timed messenger overlay disappeared after Stage 0E', JSON.stringify(result));
assert((result.text.includes('Анна') || result.text.includes('Anna')) && result.hasAnnaAvatar, 'Chapter 2 messenger overlay lost Anna header/avatar', JSON.stringify(result));
results.phoneOverlay = true;

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

console.log(JSON.stringify({ status: 'PASS', ...results }, null, 2));
await browser.close();
