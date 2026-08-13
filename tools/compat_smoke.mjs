import { chromium, firefox, webkit } from 'playwright';

const browserName = process.env.BROWSER || 'firefox';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);
const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.gsap === 'object' && typeof window.stage2dRouteStrength === 'function');
const result = await page.evaluate(async () => {
  const resources = performance.getEntriesByType('resource').map(entry => entry.name);
  const localGsap = resources.some(name => name.includes('/assets/vendor/gsap-3.11.5.min.js'));

  let generation = beginRuntimeSession('compat-final');
  resetGameState(false);
  currentChapter = 10;
  currentScene = 5;
  scriptData = await (await fetch('assets/data/chapter10.json')).json();
  const finalScene = scriptData.scenes.find(item => item.id === 5);
  const box = document.querySelector('.dialogue-box');
  clearDialogueHandlers(box);
  box.querySelectorAll('.choice-btn').forEach(node => node.remove());
  stats.crown = stats.heart = stats.leaf = 0;
  stats.relationships.dima = stats.relationships.mark = stats.relationships.sergey = stats.relationships.vika = 0;
  await handleChoices(finalScene, box, null, generation);
  const choices = [...box.querySelectorAll('.choice-btn')].map(button => ({ disabled: button.disabled, text: button.textContent }));
  invalidateRuntimeSession('compat-final-done');

  generation = beginRuntimeSession('compat-phone');
  resetGameState(false);
  currentChapter = 2;
  scriptData = await (await fetch('assets/data/chapter2.json')).json();
  const phoneScene = scriptData.scenes.find(item => item.id === 1);
  const game = document.getElementById('game-container');
  const dialogue = document.querySelector('.dialogue-box');
  game.style.display = 'block';
  dialogue.style.display = 'flex';
  document.body.classList.add('stage0j-compose-scene');
  const overlay = stage0jShowComposeOverlay(phoneScene, generation);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const phoneRect = overlay.getBoundingClientRect();
  const dialogueRect = dialogue.getBoundingClientRect();
  const phone = {
    notifications: overlay.querySelectorAll('.stage0j-notification').length,
    centered: Math.abs((phoneRect.left + phoneRect.right) / 2 - innerWidth / 2) <= 2,
    overlapsDialogue: !(phoneRect.bottom <= dialogueRect.top || phoneRect.top >= dialogueRect.bottom)
  };
  overlay.remove();
  document.body.classList.remove('stage0j-compose-scene');
  invalidateRuntimeSession('compat-phone-done');

  resetGameState(false);
  stats.completionCount = 1;
  stats.memories = [];
  stats.diamonds = 70;
  const galleryOpened = showPremiumGallery();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const gallery = {
    opened: galleryOpened === true,
    cards: document.querySelectorAll('#gallery-container .n-card').length,
    selected: document.querySelectorAll('#gallery-container .n-card[data-selected="1"]').length,
    hasStage: Boolean(document.querySelector('#gallery-container .n-stage'))
  };
  document.querySelector('#gallery-container .n-close')?.click();

  return { localGsap, choices, phone, gallery };
});
if (!result.localGsap) throw new Error(`${browserName}: GSAP was not loaded from local vendor asset`);
if (result.choices.length !== 6 || result.choices.some(choice => choice.disabled || choice.text.includes('🔒'))) throw new Error(`${browserName}: final agency contract failed: ${JSON.stringify(result.choices)}`);
if (result.phone.notifications !== 3 || !result.phone.centered || result.phone.overlapsDialogue) throw new Error(`${browserName}: phone compatibility failed: ${JSON.stringify(result.phone)}`);
if (!result.gallery.opened || result.gallery.cards !== 4 || result.gallery.selected !== 1 || !result.gallery.hasStage) throw new Error(`${browserName}: gallery compatibility failed: ${JSON.stringify(result.gallery)}`);
if (errors.length) throw new Error(`${browserName}: page errors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ status: 'PASS', browser: browserName, ...result }, null, 2));
await browser.close();
