import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';

const assert = (condition, message, details = '') => {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};
const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof window.heartSyncMobileLayout === 'function' &&
  typeof window.stage0jRenderSceneVisuals === 'function' &&
  typeof window.stage0jShowComposeOverlay === 'function'
);

const characters = await page.evaluate(async () => {
  const generation = beginRuntimeSession('mobile-layout-characters');
  resetGameState(false);
  currentChapter = 1;
  scriptData = await (await fetch('assets/data/chapter1.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 3);

  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('background').style.display = 'block';
  document.getElementById('character-left').style.display = 'block';
  document.getElementById('character-right').style.display = 'block';
  document.querySelector('.dialogue-box').style.display = 'flex';
  document.getElementById('dialogue-text').textContent = scene.text.ru;

  const rendered = await window.stage0jRenderSceneVisuals(scene, 'ru', stats, generation);
  window.heartSyncMobileLayout();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const left = document.getElementById('character-left');
  const right = document.getElementById('character-right');
  const leftRect = left.getBoundingClientRect();
  const rightRect = right.getBoundingClientRect();
  const leftStyle = getComputedStyle(left);
  const rightStyle = getComputedStyle(right);

  return {
    rendered,
    viewportWidth: innerWidth,
    leftWidth: parseFloat(leftStyle.width),
    rightWidth: parseFloat(rightStyle.width),
    leftCenter: (leftRect.left + leftRect.right) / 2,
    rightCenter: (rightRect.left + rightRect.right) / 2,
    compose: document.body.classList.contains('stage0j-compose-scene')
  };
});

assert(characters.rendered === true && characters.compose === false, 'Normal mobile scene did not render', JSON.stringify(characters));
assert(characters.leftWidth >= characters.viewportWidth * 1.44 && characters.rightWidth >= characters.viewportWidth * 1.44,
  'Portrait character canvas is still width-limited like the old 70vw layout', JSON.stringify(characters));
assert(Math.abs(characters.leftCenter - characters.viewportWidth * 0.20) <= 3,
  'Left character no longer keeps the desktop horizontal centre', JSON.stringify(characters));
assert(Math.abs(characters.rightCenter - characters.viewportWidth * 0.80) <= 3,
  'Right character no longer keeps the desktop horizontal centre', JSON.stringify(characters));

await page.screenshot({ path: 'artifacts/mobile-character-layout.png' });

const phone = await page.evaluate(async () => {
  invalidateRuntimeSession('mobile-layout-characters-done');
  const generation = beginRuntimeSession('mobile-layout-phone');
  resetGameState(false);
  currentChapter = 2;
  scriptData = await (await fetch('assets/data/chapter2.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 1);

  const dialogue = document.querySelector('.dialogue-box');
  dialogue.style.display = 'flex';
  dialogue.style.height = '220px';
  document.getElementById('dialogue-text').textContent = scene.text.ru;
  const rendered = await window.stage0jRenderSceneVisuals(scene, 'ru', stats, generation);
  const overlay = window.stage0jShowComposeOverlay(scene, generation);
  window.heartSyncMobileLayout();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const firstPhone = overlay.getBoundingClientRect();
  const firstDialogue = dialogue.getBoundingClientRect();
  const firstGap = firstDialogue.top - firstPhone.bottom;

  dialogue.style.height = '320px';
  await new Promise(resolve => setTimeout(resolve, 40));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const secondPhone = overlay.getBoundingClientRect();
  const secondDialogue = dialogue.getBoundingClientRect();
  const secondGap = secondDialogue.top - secondPhone.bottom;
  const configuredGap = parseFloat(getComputedStyle(document.body).getPropertyValue('--phone-overlay-gap')) || 0;

  return {
    rendered,
    configuredGap,
    first: {
      phoneTop: firstPhone.top,
      phoneBottom: firstPhone.bottom,
      dialogueTop: firstDialogue.top,
      gap: firstGap
    },
    second: {
      phoneTop: secondPhone.top,
      phoneBottom: secondPhone.bottom,
      dialogueTop: secondDialogue.top,
      gap: secondGap
    }
  };
});

assert(phone.rendered === true, 'Compose mobile scene did not render', JSON.stringify(phone));
assert(phone.first.phoneTop >= 0 && phone.second.phoneTop >= 0, 'Phone anchor moved above the viewport', JSON.stringify(phone));
assert(Math.abs(phone.first.gap - phone.configuredGap) <= 2.5,
  'Phone bottom is not anchored to the dialogue top', JSON.stringify(phone));
assert(Math.abs(phone.second.gap - phone.configuredGap) <= 2.5,
  'Phone did not follow the dialogue when its height changed', JSON.stringify(phone));
assert(phone.second.phoneTop < phone.first.phoneTop,
  'Phone did not move with the raised dialogue strip', JSON.stringify(phone));

await page.screenshot({ path: 'artifacts/mobile-phone-layout.png' });
console.log(JSON.stringify({ status: 'PASS', characters, phone }, null, 2));
await browser.close();
