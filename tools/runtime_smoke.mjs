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
  typeof resolveSceneTransition === 'function'
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

// 6. Chapter 10 terminal scene owns its ending; loadFinals resolves without transient pending state.
result = await page.evaluate(async () => {
  const originalShowEnding = showEnding;
  let captured = null;
  try {
    const generation = beginRuntimeSession('0h-ending');
    resetGameState(false);
    currentChapter = 10;
    currentScene = 7;
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
    invalidateRuntimeSession('0h-ending-done');
    return snapshot;
  } finally {
    showEnding = originalShowEnding;
  }
});
assert(result.route.type === 'ending' && result.route.endingId === 'silence_with_mark', 'Terminal ending ownership regression', JSON.stringify(result));
assert(result.loaded === true && result.captured === 'silence_with_mark' && result.hasPendingGlobal === false, 'Ending load depends on transient context', JSON.stringify(result));
results.endings = true;

console.log(JSON.stringify({ status: 'PASS', ...results }, null, 2));
await browser.close();
