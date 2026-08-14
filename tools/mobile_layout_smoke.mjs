import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';

const assert = (condition, message, details = '') => {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof window.heartSyncMobileLayout === 'function' &&
  typeof window.stage0jRenderSceneVisuals === 'function' &&
  typeof window.stage0jShowComposeOverlay === 'function' &&
  typeof createChoiceButton === 'function'
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
  const dialogue = document.querySelector('.dialogue-box');
  dialogue.style.display = 'flex';
  dialogue.style.height = '';
  dialogue.querySelectorAll('.choice-btn').forEach(button => button.remove());
  document.getElementById('dialogue-text').textContent = scene.text.ru;
  for (const choice of scene.choices || []) dialogue.appendChild(createChoiceButton(choice));

  const rendered = await window.stage0jRenderSceneVisuals(scene, 'ru', stats, generation);
  window.heartSyncMobileLayout();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const left = document.getElementById('character-left');
  const right = document.getElementById('character-right');
  const leftRect = left.getBoundingClientRect();
  const rightRect = right.getBoundingClientRect();
  const dialogueRect = dialogue.getBoundingClientRect();
  const leftStyle = getComputedStyle(left);
  const rightStyle = getComputedStyle(right);

  return {
    rendered,
    viewportWidth: innerWidth,
    dialogueTop: dialogueRect.top,
    dialogueHeight: dialogueRect.height,
    choiceCount: dialogue.querySelectorAll('.choice-btn').length,
    leftWidth: parseFloat(leftStyle.width),
    rightWidth: parseFloat(rightStyle.width),
    leftBottom: parseFloat(leftStyle.bottom),
    rightBottom: parseFloat(rightStyle.bottom),
    leftCenter: (leftRect.left + leftRect.right) / 2,
    rightCenter: (rightRect.left + rightRect.right) / 2,
    liftVariable: parseFloat(getComputedStyle(document.body).getPropertyValue('--heart-mobile-character-lift')),
    compose: document.body.classList.contains('stage0j-compose-scene')
  };
});

assert(characters.rendered === true && characters.compose === false, 'Normal mobile scene did not render', JSON.stringify(characters));
assert(characters.choiceCount === 3, 'Normal mobile regression is not exercising its real choices', JSON.stringify(characters));
assert(characters.leftWidth >= characters.viewportWidth * 1.35 && characters.leftWidth <= characters.viewportWidth * 1.37 &&
       characters.rightWidth >= characters.viewportWidth * 1.35 && characters.rightWidth <= characters.viewportWidth * 1.37,
  'Normal portrait characters are not at the refined ~136vw scale', JSON.stringify(characters));
assert(Math.abs(characters.leftCenter - characters.viewportWidth * 0.20) <= 3,
  'Left character no longer keeps the desktop horizontal centre', JSON.stringify(characters));
assert(Math.abs(characters.rightCenter - characters.viewportWidth * 0.80) <= 3,
  'Right character no longer keeps the desktop horizontal centre', JSON.stringify(characters));
assert(characters.leftBottom >= 23 && characters.leftBottom <= 111 &&
       characters.rightBottom >= 23 && characters.rightBottom <= 111 &&
       Math.abs(characters.leftBottom - characters.liftVariable) <= 1,
  'Normal portrait characters are not lifted from the real dialogue/choice height', JSON.stringify(characters));

await page.screenshot({ path: 'artifacts/mobile-character-layout.png' });

const phone = await page.evaluate(async () => {
  invalidateRuntimeSession('mobile-layout-characters-done');
  const generation = beginRuntimeSession('mobile-layout-phone');
  resetGameState(false);
  currentChapter = 1;
  scriptData = await (await fetch('assets/data/chapter1.json')).json();
  const scene = scriptData.scenes.find(candidate => candidate.id === 21);

  const dialogue = document.querySelector('.dialogue-box');
  dialogue.style.display = 'flex';
  dialogue.style.height = '';
  dialogue.querySelectorAll('.choice-btn').forEach(button => button.remove());
  document.getElementById('dialogue-text').textContent = scene.text.ru;
  const rendered = await window.stage0jRenderSceneVisuals(scene, 'ru', stats, generation);
  const overlay = window.stage0jShowComposeOverlay(scene, generation);
  window.heartSyncMobileLayout();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const character = document.getElementById('character-left');
  const firstPhone = overlay.getBoundingClientRect();
  const firstDialogue = dialogue.getBoundingClientRect();
  const firstCharacterStyle = getComputedStyle(character);
  const firstGap = firstDialogue.top - firstPhone.bottom;
  const first = {
    phoneTop: firstPhone.top,
    phoneBottom: firstPhone.bottom,
    dialogueTop: firstDialogue.top,
    dialogueHeight: firstDialogue.height,
    gap: firstGap,
    choiceCount: dialogue.querySelectorAll('.choice-btn').length,
    characterWidth: parseFloat(firstCharacterStyle.width),
    characterBottom: parseFloat(firstCharacterStyle.bottom),
    characterZ: parseInt(firstCharacterStyle.zIndex, 10),
    phoneZ: parseInt(getComputedStyle(overlay).zIndex, 10),
    backgroundImage: firstCharacterStyle.backgroundImage,
    liftVariable: parseFloat(getComputedStyle(document.body).getPropertyValue('--heart-mobile-character-lift'))
  };

  for (const choice of scene.choices || []) dialogue.appendChild(createChoiceButton(choice));
  await new Promise(resolve => setTimeout(resolve, 80));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const secondPhone = overlay.getBoundingClientRect();
  const secondDialogue = dialogue.getBoundingClientRect();
  const secondCharacterStyle = getComputedStyle(character);
  const secondGap = secondDialogue.top - secondPhone.bottom;
  const configuredGap = parseFloat(getComputedStyle(document.body).getPropertyValue('--phone-overlay-gap')) || 0;
  const second = {
    phoneTop: secondPhone.top,
    phoneBottom: secondPhone.bottom,
    dialogueTop: secondDialogue.top,
    dialogueHeight: secondDialogue.height,
    gap: secondGap,
    choiceCount: dialogue.querySelectorAll('.choice-btn').length,
    characterWidth: parseFloat(secondCharacterStyle.width),
    characterBottom: parseFloat(secondCharacterStyle.bottom),
    liftVariable: parseFloat(getComputedStyle(document.body).getPropertyValue('--heart-mobile-character-lift'))
  };

  return {
    rendered,
    sceneId: scene?.id,
    viewportWidth: innerWidth,
    configuredGap,
    first,
    second
  };
});

assert(phone.rendered === true && phone.sceneId === 21, 'Real compose mobile scene did not render', JSON.stringify(phone));
assert(phone.first.backgroundImage && phone.first.backgroundImage !== 'none',
  'Compose regression scene is not exercising a visible character sprite', JSON.stringify(phone));
assert(phone.first.choiceCount === 0 && phone.second.choiceCount === 3 && phone.second.dialogueHeight > phone.first.dialogueHeight,
  'Compose regression did not grow through the real three-choice stack', JSON.stringify(phone));
assert(phone.first.phoneTop >= 0 && phone.second.phoneTop >= 0, 'Phone anchor moved above the viewport', JSON.stringify(phone));
assert(Math.abs(phone.first.gap - phone.configuredGap) <= 2.5,
  'Phone bottom is not anchored to the dialogue top', JSON.stringify(phone));
assert(Math.abs(phone.second.gap - phone.configuredGap) <= 2.5,
  'Phone did not remain anchored after real choices grew the dialogue', JSON.stringify(phone));
assert(phone.second.phoneTop < phone.first.phoneTop,
  'Phone did not move with the raised real choice stack', JSON.stringify(phone));
assert(phone.first.characterWidth >= phone.viewportWidth * 1.29 && phone.first.characterWidth <= phone.viewportWidth * 1.31 &&
       phone.second.characterWidth >= phone.viewportWidth * 1.29 && phone.second.characterWidth <= phone.viewportWidth * 1.31,
  'Compose character is still using the old 70vw mobile scale', JSON.stringify(phone));
assert(phone.first.characterBottom >= 55 && phone.first.characterBottom <= 191 &&
       Math.abs(phone.first.characterBottom - phone.first.liftVariable) <= 1,
  'Compose character did not receive the stronger dialogue-height lift', JSON.stringify(phone));
assert(phone.second.characterBottom > phone.first.characterBottom && phone.second.characterBottom <= 191 &&
       Math.abs(phone.second.characterBottom - phone.second.liftVariable) <= 1,
  'Compose character did not rise with the real choice stack', JSON.stringify(phone));
assert(phone.first.characterZ < phone.first.phoneZ,
  'Compose character must remain behind the smartphone overlay', JSON.stringify(phone));
assert(phone.first.characterBottom > characters.leftBottom,
  'Compose scene should lift the character more strongly than a normal scene', JSON.stringify({ characters, phone }));

await page.screenshot({ path: 'artifacts/mobile-phone-layout.png' });
console.log(JSON.stringify({ status: 'PASS', characters, phone }, null, 2));
await browser.close();
