import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
const devKey = 'heart_at_crossroads_beta2:dev:force_first_playthrough';

const special = await browser.newPage();
await special.goto(base, { waitUntil: 'domcontentloaded' });
const specialState = await special.evaluate(async () => {
  const enabled = heartSetDevForceFirstPlaythrough(true);
  const control = document.getElementById('stage0k-dev-replay-control');
  const chapter = await (await fetch('assets/data/chapter2.json')).json();
  const scene = chapter.scenes.find(item => item.id === 1);
  heartApplyReplayOverride(chapter);
  return {
    mode: window.heartDevMode,
    control: !!control,
    controlParent: control?.parentElement?.id,
    controlVisible: control ? control.getClientRects().length > 0 : false,
    label: control?.textContent?.trim(),
    enabled,
    forced: heartDevForceFirstPlaythrough(),
    replayTextPresent: Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text')
  };
});
if (!specialState.mode || !specialState.control || specialState.controlParent !== 'start-screen' || !specialState.controlVisible || !specialState.enabled || !specialState.forced || specialState.replayTextPresent) {
  throw new Error(`default beta developer menu mode did not activate: ${JSON.stringify(specialState)}`);
}
if (!specialState.label?.includes('всегда первое прохождение')) {
  throw new Error(`developer checkbox label drifted: ${JSON.stringify(specialState)}`);
}

const activeSnapshot = await special.evaluate(() => {
  const generation = beginRuntimeSession('mode-smoke-snapshot');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  const attemptedChange = heartSetDevForceFirstPlaythrough(false);
  const control = document.getElementById('stage0k-dev-replay-control');
  return {
    generation,
    forced: heartDevForceFirstPlaythrough(),
    attemptedChange,
    controlVisible: control ? control.getClientRects().length > 0 : false
  };
});
if (!activeSnapshot.forced || activeSnapshot.attemptedChange !== false || activeSnapshot.controlVisible) {
  throw new Error(`DEV run mode was not frozen or menu-only: ${JSON.stringify(activeSnapshot)}`);
}
await special.evaluate(() => {
  invalidateRuntimeSession('mode-smoke-snapshot-done');
  showStartScreen();
});

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

// Finishing a run captured with DEV enabled must not advance the real profile or reward.
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
  document.getElementById('start-screen').style.display = 'none';
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
  const control = document.getElementById('stage0k-dev-replay-control');
  return {
    completionCount: stats.completionCount,
    profileCompletionCount: profile?.completionCount ?? 0,
    runExists: Boolean(rawRun),
    bank: stage2dReadDiamondBank(),
    forced: heartDevForceFirstPlaythrough(),
    replayTextPresent: Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text'),
    startVisible: getComputedStyle(document.getElementById('start-screen')).display !== 'none',
    controlVisible: control ? control.getClientRects().length > 0 : false
  };
});
if (beforeCompletion.completionCount !== 0 || afterCompletion.completionCount !== 0 || afterCompletion.profileCompletionCount !== 0) {
  throw new Error(`developer completion advanced replay state: ${JSON.stringify({ beforeCompletion, afterCompletion })}`);
}
if (afterCompletion.bank !== 70) {
  throw new Error(`developer completion granted completion reward: ${JSON.stringify({ beforeCompletion, afterCompletion })}`);
}
if (afterCompletion.runExists || !afterCompletion.startVisible || !afterCompletion.controlVisible) {
  throw new Error(`developer completion did not return to a clean menu: ${JSON.stringify(afterCompletion)}`);
}
if (!afterCompletion.forced || afterCompletion.replayTextPresent) {
  throw new Error(`developer menu selection was lost after completion: ${JSON.stringify(afterCompletion)}`);
}

// Unchecked menu -> next runtime is non-DEV, and it is also frozen for that runtime.
const normalRun = await special.evaluate(() => {
  const disabled = heartSetDevForceFirstPlaythrough(false);
  const generation = beginRuntimeSession('mode-smoke-normal-run');
  document.getElementById('start-screen').style.display = 'none';
  const attemptedChange = heartSetDevForceFirstPlaythrough(true);
  const control = document.getElementById('stage0k-dev-replay-control');
  return {
    disabled,
    generation,
    forced: heartDevForceFirstPlaythrough(),
    attemptedChange,
    controlVisible: control ? control.getClientRects().length > 0 : false
  };
});
if (!normalRun.disabled || normalRun.forced || normalRun.attemptedChange !== false || normalRun.controlVisible) {
  throw new Error(`unchecked menu did not produce a frozen normal runtime: ${JSON.stringify(normalRun)}`);
}

console.log(JSON.stringify({ status: 'PASS', specialState, activeSnapshot, playerState, beforeCompletion, afterCompletion, normalRun }, null, 2));
await browser.close();
