import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const assert = (cond, msg, details = '') => {
  if (!cond) throw new Error(`${msg}${details ? `: ${details}` : ''}`);
};

await page.goto('http://127.0.0.1:8000/heart_at_crossroads.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof resolveSceneTransition === 'function' && typeof applyChoice === 'function' && typeof loadFinals === 'function');

const expected = {
  6: 'freedom_with_dima',
  7: 'silence_with_mark',
  8: 'summit_with_sergey',
  9: 'friendship_above_all',
  10: 'lonely_path',
  11: 'new_start'
};

// Every terminal branch owns its ending. A poisoned legacy global must be irrelevant.
let state = await page.evaluate(async (expected) => {
  await loadChapter(10);
  currentChapter = 10;
  window.pendingEndingId = '__poisoned_legacy_value__';
  const resolved = {};
  for (const [sceneIdText, endingId] of Object.entries(expected)) {
    const sceneId = Number(sceneIdText);
    const scene = scriptData.scenes.find(s => s.id === sceneId);
    const target = resolveSceneTransition(scene);
    resolved[sceneId] = { target, endingOwner: scene.leadsToEnding, expected: endingId };
  }
  delete window.pendingEndingId;
  return resolved;
}, expected);

for (const [sceneId, endingId] of Object.entries(expected)) {
  const item = state[sceneId];
  assert(item.endingOwner === endingId, 'Terminal scene does not own expected ending', JSON.stringify(item));
  assert(item.target.type === 'ending' && item.target.endingId === endingId, 'Terminal transition is not deterministic', JSON.stringify(item));
}

// Final choice commits only the intermediate scene. No transient ending global is created.
state = await page.evaluate(async () => {
  await loadChapter(10);
  currentChapter = 10;
  currentScene = 5;
  choices = [];
  stats = createFreshRunStats(false);
  delete window.pendingEndingId;

  const originalShowScene = showScene;
  showScene = async () => true;
  try {
    const finalScene = scriptData.scenes.find(s => s.id === 5);
    const markChoice = finalScene.choices.find(c => c.id === 'mark');
    const ok = await applyChoice(markChoice);
    return {
      ok,
      chapter: currentChapter,
      scene: currentScene,
      choices: [...choices],
      pendingPropertyExists: Object.prototype.hasOwnProperty.call(window, 'pendingEndingId')
    };
  } finally {
    showScene = originalShowScene;
  }
});
assert(state.ok === true, 'Final choice did not commit', JSON.stringify(state));
assert(state.chapter === 10 && state.scene === 7, 'Mark choice did not route to intermediate scene 7', JSON.stringify(state));
assert(state.choices.filter(id => id === 'mark').length === 1, 'Mark choice was not recorded exactly once', JSON.stringify(state));
assert(state.pendingPropertyExists === false, 'Final choice recreated pendingEndingId', JSON.stringify(state));

// Legacy requirements must never reject the player's selected ending.
state = await page.evaluate(async () => {
  stats = createFreshRunStats(false); // deliberately zeroed stats
  let shown = null;
  let startCalls = 0;
  let errors = 0;
  const originalShowEnding = showEnding;
  const originalShowStartScreen = showStartScreen;
  const originalShowErrorMessage = showErrorMessage;
  showEnding = ending => { shown = ending.id; };
  showStartScreen = () => { startCalls += 1; };
  showErrorMessage = () => { errors += 1; };
  try {
    const ok = await loadFinals('lonely_path');
    return { ok, shown, startCalls, errors };
  } finally {
    showEnding = originalShowEnding;
    showStartScreen = originalShowStartScreen;
    showErrorMessage = originalShowErrorMessage;
  }
});
assert(state.ok === true && state.shown === 'lonely_path', 'Legacy lonely requirement still blocks selected ending', JSON.stringify(state));
assert(state.startCalls === 0 && state.errors === 0, 'Valid ending triggered fallback UI', JSON.stringify(state));

// Unknown ending fails closed and must not destructively dump the run to the start screen.
state = await page.evaluate(async () => {
  let shown = null;
  let startCalls = 0;
  let errors = 0;
  const originalShowEnding = showEnding;
  const originalShowStartScreen = showStartScreen;
  const originalShowErrorMessage = showErrorMessage;
  showEnding = ending => { shown = ending.id; };
  showStartScreen = () => { startCalls += 1; };
  showErrorMessage = () => { errors += 1; };
  try {
    const ok = await loadFinals('__missing_ending__');
    return { ok, shown, startCalls, errors };
  } finally {
    showEnding = originalShowEnding;
    showStartScreen = originalShowStartScreen;
    showErrorMessage = originalShowErrorMessage;
  }
});
assert(state.ok === false && state.shown === null, 'Missing ending did not fail closed', JSON.stringify(state));
assert(state.startCalls === 0 && state.errors === 1, 'Missing ending fallback is destructive or silent', JSON.stringify(state));

// Fresh JS world: a terminal scene still resolves correctly after reload without any pending context.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof resolveSceneTransition === 'function' && typeof loadChapter === 'function');
state = await page.evaluate(async () => {
  await loadChapter(10);
  currentChapter = 10;
  currentScene = 7;
  delete window.pendingEndingId;
  const scene = scriptData.scenes.find(s => s.id === currentScene);
  return {
    hasPending: Object.prototype.hasOwnProperty.call(window, 'pendingEndingId'),
    target: resolveSceneTransition(scene)
  };
});
assert(state.hasPending === false, 'Fresh page unexpectedly depends on pending ending context', JSON.stringify(state));
assert(state.target.type === 'ending' && state.target.endingId === 'silence_with_mark', 'Reloaded terminal scene lost ending ownership', JSON.stringify(state));

console.log(JSON.stringify({
  status: 'PASS',
  terminalEndings: 6,
  playerChoiceAuthoritative: true,
  pendingEndingRemoved: true,
  lonelyPathReachableWithZeroStats: true,
  missingEndingFailsClosed: true,
  reloadKeepsTerminalOwnership: true
}, null, 2));

await browser.close();
