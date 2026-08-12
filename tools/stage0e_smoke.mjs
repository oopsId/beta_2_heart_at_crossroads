import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const assert = (cond, msg, details = '') => {
  if (!cond) throw new Error(`${msg}${details ? `: ${details}` : ''}`);
};

await page.goto('http://127.0.0.1:8000/heart_at_crossroads.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof getTimeoutConfig === 'function' && typeof applyTimeoutOutcome === 'function');

const inventory = await page.evaluate(async () => {
  const found = [];
  for (let ch = 1; ch <= 10; ch++) {
    const data = await (await fetch(`assets/data/chapter${ch}.json`)).json();
    for (const scene of data.scenes) {
      if (scene.timeout) {
        found.push({
          chapter: ch,
          scene: scene.id,
          timeout: scene.timeout,
          choiceIds: (scene.choices || []).map(c => c.id),
          hasLegacyChoiceTimer: (scene.choices || []).some(c => Object.prototype.hasOwnProperty.call(c, 'timer'))
        });
      }
    }
  }
  return found;
});

assert(inventory.length === 6, 'Expected exactly six timed scenes', JSON.stringify(inventory));
assert(inventory.every(x => !x.hasLegacyChoiceTimer), 'Legacy choice.timer remains', JSON.stringify(inventory));

const expected = new Map([
  ['1:7', 'ignore'],
  ['1:21', 'ignore'],
  ['2:1', 'no_reply'],
  ['3:1', 'ignore'],
  ['3:10', 'ignore'],
  ['6:6', 'ignore']
]);
for (const item of inventory) {
  const key = `${item.chapter}:${item.scene}`;
  assert(expected.has(key), 'Unexpected timed scene', key);
  if (item.timeout.choiceId) {
    assert(item.timeout.choiceId === expected.get(key), 'Wrong timeout choice', key);
    assert(item.choiceIds.includes(item.timeout.choiceId), 'Timeout choice missing from choices', key);
  } else {
    assert(item.timeout.outcome?.id === expected.get(key), 'Wrong timeout outcome', key);
    assert(item.timeout.outcome?.nextScene === 5, 'Chapter 2 no-reply must converge to scene 5', JSON.stringify(item));
  }
}

async function prepareTimedScene(chapter, sceneId, seconds) {
  return await page.evaluate(async ({ chapter, sceneId, seconds }) => {
    await loadChapter(chapter);
    currentChapter = chapter;
    currentScene = sceneId;
    choices = [];
    stats = createFreshRunStats(false);
    const scene = scriptData.scenes.find(s => s.id === sceneId);
    scene.timeout.seconds = seconds;
    currentBackground = scene.background || 'none';
    typeText = (_text, _element, done) => done();
    setupBackground = async bg => bg;
    setupCharacters = async () => {};
    playSound = () => {};
    playMusic = () => {};
    window.currentMusic = null;
    document.querySelectorAll('.choice-btn').forEach(btn => btn.remove());
    document.getElementById('timer-countdown')?.remove();
    showSceneWithTimer(scene);
    return { chapter: currentChapter, scene: currentScene };
  }, { chapter, sceneId, seconds });
}

await prepareTimedScene(1, 7, 0.05);
await page.waitForTimeout(180);
let state = await page.evaluate(() => ({ chapter: currentChapter, scene: currentScene, choices: [...choices], timer: !!document.getElementById('timer-countdown') }));
assert(state.chapter === 1 && state.scene === 10, 'Timeout choice did not route chapter 1 scene 7 to scene 10', JSON.stringify(state));
assert(state.choices.filter(x => x === 'ignore').length === 1, 'Timeout ignore must be committed exactly once', JSON.stringify(state));
assert(!state.timer, 'Countdown survived timeout choice', JSON.stringify(state));

await prepareTimedScene(2, 1, 0.05);
await page.waitForTimeout(180);
state = await page.evaluate(() => ({
  chapter: currentChapter,
  scene: currentScene,
  choices: [...choices],
  crown: stats.crown,
  heart: stats.heart,
  mark: stats.relationships.mark ?? 0,
  sergey: stats.relationships.sergey ?? 0,
  lyosha: stats.relationships.lyosha ?? 0
}));
assert(state.chapter === 2 && state.scene === 5, 'No-reply timeout did not converge to chapter 2 scene 5', JSON.stringify(state));
assert(state.choices.filter(x => x === 'no_reply').length === 1, 'No-reply timeout must be recorded exactly once', JSON.stringify(state));
assert(state.crown === 0 && state.heart === 0 && state.mark === 0 && state.sergey === 0 && state.lyosha === 0, 'No-reply timeout mutated romance/personality stats', JSON.stringify(state));

await prepareTimedScene(2, 1, 0.25);
await page.locator('.choice-btn').first().click();
await page.waitForTimeout(400);
state = await page.evaluate(() => ({ chapter: currentChapter, scene: currentScene, choices: [...choices] }));
assert(state.chapter === 2 && state.scene === 2, 'Manual timed choice did not win before timeout', JSON.stringify(state));
assert(state.choices.filter(x => x === 'lyosha_yes').length === 1, 'Manual timed choice not committed exactly once', JSON.stringify(state));
assert(!state.choices.includes('no_reply'), 'Timeout fired after manual timed choice', JSON.stringify(state));

console.log(JSON.stringify({ status: 'PASS', timedScenes: inventory.length, timeoutChoice: 'ignore->10', hiddenOutcome: 'no_reply->5', manualCancelsTimeout: true }, null, 2));
await browser.close();
