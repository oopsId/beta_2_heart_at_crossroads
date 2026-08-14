import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
const devKey = 'heart_at_crossroads_beta2:dev:force_first_playthrough';

// Direct game URL remains normal player mode even if an old developer flag exists.
const normal = await browser.newPage();
await normal.goto(base, { waitUntil: 'domcontentloaded' });
await normal.evaluate(key => localStorage.setItem(key, '1'), devKey);
await normal.reload({ waitUntil: 'domcontentloaded' });
const normalState = await normal.evaluate(async () => {
  const chapter = await (await fetch('assets/data/chapter2.json')).json();
  const scene = chapter.scenes.find(item => item.id === 1);
  heartApplyReplayOverride(chapter);
  return {
    mode: window.heartDevMode,
    control: !!document.getElementById('stage0k-dev-replay-control'),
    forced: heartDevForceFirstPlaythrough(),
    replayTextPresent: Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text')
  };
});
if (normalState.mode || normalState.control || normalState.forced || !normalState.replayTextPresent) {
  throw new Error(`normal player affected by stored developer flag: ${JSON.stringify(normalState)}`);
}
await normal.close();

// The beta entry point is explicitly developer mode and exposes the persistent checkbox.
const betaEntry = new URL('index.html', base);
const special = await browser.newPage();
await special.goto(betaEntry.href, { waitUntil: 'domcontentloaded' });
await special.waitForURL(url => url.pathname.endsWith('/heart_at_crossroads.html') && url.searchParams.get('dev') === '1');
const specialState = await special.evaluate(async () => {
  const enabled = heartSetDevForceFirstPlaythrough(true);
  const chapter = await (await fetch('assets/data/chapter2.json')).json();
  const scene = chapter.scenes.find(item => item.id === 1);
  heartApplyReplayOverride(chapter);
  return {
    mode: window.heartDevMode,
    control: !!document.getElementById('stage0k-dev-replay-control'),
    label: document.getElementById('stage0k-dev-replay-control')?.textContent?.trim(),
    enabled,
    forced: heartDevForceFirstPlaythrough(),
    replayTextPresent: Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text')
  };
});
if (!specialState.mode || !specialState.control || !specialState.enabled || !specialState.forced || specialState.replayTextPresent) {
  throw new Error(`developer first-playthrough override did not activate: ${JSON.stringify(specialState)}`);
}
if (!specialState.label?.includes('всегда первое прохождение')) {
  throw new Error(`developer checkbox label drifted: ${JSON.stringify(specialState)}`);
}

// Finishing a run with the checkbox enabled must not turn the profile into replay mode
// and must not grant the normal +100 completion reward.
const beforeCompletion = await special.evaluate(async () => {
  localStorage.removeItem(storageKey(PROFILE_STORAGE_KEY));
  localStorage.removeItem(storageKey(RUN_STORAGE_KEY));
  profileState = normalizeProfile(DEFAULT_PROFILE_STATE);
  resetGameState(false);
  stats.completionCount = 0;
  stats.memories = [];
  stage2dWriteDiamondBank(70);
  stats.diamonds = 70;
  updateDiamondsDisplay();
  const generation = beginRuntimeSession('mode-smoke-dev-completion');
  await saveSession();
  const nativeSetTimeout = window.setTimeout;
  window.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 5000 ? 0 : delay, ...args);
  try {
    showEpilogue('DEV completion smoke', generation);
  } finally {
    window.setTimeout = nativeSetTimeout;
  }
  return {
    generation,
    completionCount: stats.completionCount,
    bank: stage2dReadDiamondBank(),
    forced: heartDevForceFirstPlaythrough()
  };
});
await special.waitForTimeout(150);
const afterCompletion = await special.evaluate(async () => {
  const rawProfile = localStorage.getItem(storageKey(PROFILE_STORAGE_KEY));
  const profile = rawProfile ? JSON.parse(rawProfile) : null;
  const rawRun = localStorage.getItem(storageKey(RUN_STORAGE_KEY));
  const chapter = await (await fetch('assets/data/chapter2.json')).json();
  const scene = chapter.scenes.find(item => item.id === 1);
  heartApplyReplayOverride(chapter);
  return {
    completionCount: stats.completionCount,
    profileCompletionCount: profile?.completionCount ?? 0,
    profileExists: Boolean(profile),
    runExists: Boolean(rawRun),
    bank: stage2dReadDiamondBank(),
    forced: heartDevForceFirstPlaythrough(),
    replayTextPresent: Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text'),
    startVisible: getComputedStyle(document.getElementById('start-screen')).display !== 'none'
  };
});
if (beforeCompletion.completionCount !== 0 || afterCompletion.completionCount !== 0 || afterCompletion.profileCompletionCount !== 0) {
  throw new Error(`developer completion advanced replay state: ${JSON.stringify({ beforeCompletion, afterCompletion })}`);
}
if (afterCompletion.bank !== 70) {
  throw new Error(`developer completion granted completion reward: ${JSON.stringify({ beforeCompletion, afterCompletion })}`);
}
if (afterCompletion.runExists || !afterCompletion.startVisible) {
  throw new Error(`developer completion did not return to a clean start: ${JSON.stringify(afterCompletion)}`);
}
if (!afterCompletion.forced || afterCompletion.replayTextPresent) {
  throw new Error(`developer completion stopped forcing first-playthrough text: ${JSON.stringify(afterCompletion)}`);
}

console.log(JSON.stringify({ status: 'PASS', normalState, specialState, beforeCompletion, afterCompletion }, null, 2));
await browser.close();
