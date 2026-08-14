import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
const devKey = 'heart_at_crossroads_beta2:dev:force_first_playthrough';

// beta_2 is a developer build: the checkbox must be visible even on the direct game URL.
const special = await browser.newPage();
await special.goto(base, { waitUntil: 'domcontentloaded' });
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
  throw new Error(`default beta developer mode did not activate: ${JSON.stringify(specialState)}`);
}
if (!specialState.label?.includes('всегда первое прохождение')) {
  throw new Error(`developer checkbox label drifted: ${JSON.stringify(specialState)}`);
}

// A clean player preview still exists, but only when it is explicitly requested.
const playerUrl = new URL(base);
playerUrl.searchParams.set('player', '1');
const player = await browser.newPage();
await player.goto(playerUrl.href, { waitUntil: 'domcontentloaded' });
await player.evaluate(key => localStorage.setItem(key, '1'), devKey);
await player.reload({ waitUntil: 'domcontentloaded' });
const playerState = await player.evaluate(async () => {
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
if (playerState.mode || playerState.control || playerState.forced || !playerState.replayTextPresent) {
  throw new Error(`explicit player mode affected by developer flag: ${JSON.stringify(playerState)}`);
}
await player.close();

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

console.log(JSON.stringify({ status: 'PASS', specialState, playerState, beforeCompletion, afterCompletion }, null, 2));
await browser.close();
