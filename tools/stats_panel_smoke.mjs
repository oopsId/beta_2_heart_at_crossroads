import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let browserDialogs = 0;
page.on('dialog', async dialog => {
  browserDialogs += 1;
  await dialog.dismiss().catch(() => {});
});

const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof window.heartShowStatsPanel === 'function'
  && typeof window.heartSyncStatsVisibility === 'function'
  && typeof window.heartSetDevForceFirstPlaythrough === 'function'
  && window.heartDevMode === true
);

const initial = await page.evaluate(() => {
  stats.isAuthorized = false;
  stats.crown = 3;
  stats.heart = 7;
  stats.leaf = 2;
  stats.diamonds = 64;
  stats.relationships.mark = 5;
  stats.relationships.lera = -1;
  stats.relationships.vika = 4;
  stats.relationships.sergey = 6;
  stats.relationships.anna = 8;
  stats.relationships.dima = 9;
  stats.relationships.lyosha = 1;

  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('menu').style.display = 'flex';
  const button = document.getElementById('stats');

  // Reproduce foundation.js gate for a temporary-password/non-authorized session.
  button.style.display = 'none';
  window.heartSetDevForceFirstPlaythrough(false);
  window.heartSyncStatsVisibility();

  const directOpen = window.heartShowStatsPanel();
  return {
    authorized: stats.isAuthorized,
    forced: window.heartDevForceFirstPlaythrough(),
    devClass: document.documentElement.classList.contains('heart-dev-first-playthrough'),
    display: getComputedStyle(button).display,
    directOpen,
    panelExists: Boolean(document.getElementById('stats-panel-overlay'))
  };
});

if (initial.authorized || initial.forced || initial.devClass || initial.display !== 'none' || initial.directOpen !== false || initial.panelExists) {
  throw new Error(`unauthorized stats gate is open without DEV checkbox: ${JSON.stringify(initial)}`);
}

// DEV checkbox alone must expose the tool while keeping the temporary-password session unauthorized.
await page.locator('#stage0k-dev-replay-control input[type="checkbox"]').click();
const devEnabled = await page.evaluate(() => ({
  authorized: stats.isAuthorized,
  forced: window.heartDevForceFirstPlaythrough(),
  devClass: document.documentElement.classList.contains('heart-dev-first-playthrough'),
  display: getComputedStyle(document.getElementById('stats')).display
}));
if (devEnabled.authorized || !devEnabled.forced || !devEnabled.devClass || devEnabled.display === 'none') {
  throw new Error(`DEV checkbox did not expose stats: ${JSON.stringify(devEnabled)}`);
}

await page.locator('#stats').click();
await page.locator('#stats-panel-overlay').waitFor({ state: 'attached' });

const panel = await page.evaluate(() => {
  const overlay = document.getElementById('stats-panel-overlay');
  const card = overlay.querySelector('.stats-panel');
  const rect = card.getBoundingClientRect();
  const rows = [...overlay.querySelectorAll('.stats-panel-row')].map(row => row.textContent.replace(/\s+/g, ' ').trim());
  return {
    title: overlay.querySelector('#stats-panel-title')?.textContent,
    rows,
    modal: card.getAttribute('aria-modal'),
    closeLabel: overlay.querySelector('.stats-panel-close')?.getAttribute('aria-label'),
    width: rect.width,
    height: rect.height,
    top: rect.top,
    rightGap: innerWidth - rect.right,
    overlayBackground: getComputedStyle(overlay).backgroundColor,
    overlayPointerEvents: getComputedStyle(overlay).pointerEvents,
    panelPointerEvents: getComputedStyle(card).pointerEvents
  };
});

for (const expected of ['Короны3', 'Сердце7', 'Лист2', 'Бриллианты64', 'Марк5', 'Лера-1', 'Вика4', 'Сергей6', 'Анна8', 'Дима9', 'Лёша1']) {
  if (!panel.rows.some(row => row.replace(/\s+/g, '') === expected)) {
    throw new Error(`stats panel missing ${expected}: ${JSON.stringify(panel)}`);
  }
}
if (panel.title !== 'Статы' || panel.modal !== 'false' || panel.closeLabel !== 'Закрыть') {
  throw new Error(`stats panel metadata drifted: ${JSON.stringify(panel)}`);
}
if (panel.width > 280 || panel.height > 320 || panel.top < 65 || panel.rightGap > 20) {
  throw new Error(`stats panel stopped being compact corner UI: ${JSON.stringify(panel)}`);
}
if (panel.overlayBackground !== 'rgba(0, 0, 0, 0)' || panel.overlayPointerEvents !== 'none' || panel.panelPointerEvents !== 'auto') {
  throw new Error(`stats panel blocks/dims the game instead of floating over it: ${JSON.stringify(panel)}`);
}
if (browserDialogs !== 0) {
  throw new Error(`stats click opened ${browserDialogs} browser dialog(s)`);
}

await page.keyboard.press('Escape');
if (await page.locator('#stats-panel-overlay').count()) {
  throw new Error('Escape did not close stats panel');
}

// Turning DEV off must immediately restore the old password gate.
await page.locator('#stage0k-dev-replay-control input[type="checkbox"]').click();
const devDisabled = await page.evaluate(() => ({
  forced: window.heartDevForceFirstPlaythrough(),
  devClass: document.documentElement.classList.contains('heart-dev-first-playthrough'),
  display: getComputedStyle(document.getElementById('stats')).display
}));
if (devDisabled.forced || devDisabled.devClass || devDisabled.display !== 'none') {
  throw new Error(`stats remained visible after DEV checkbox was disabled: ${JSON.stringify(devDisabled)}`);
}

// Main-password authorization keeps the original access semantics even with DEV off.
const authorized = await page.evaluate(() => {
  stats.isAuthorized = true;
  const button = document.getElementById('stats');
  button.style.display = 'block';
  window.heartSyncStatsVisibility();
  return {
    authorized: stats.isAuthorized,
    forced: window.heartDevForceFirstPlaythrough(),
    display: getComputedStyle(button).display,
    opened: window.heartShowStatsPanel(),
    panelExists: Boolean(document.getElementById('stats-panel-overlay'))
  };
});
if (!authorized.authorized || authorized.forced || authorized.display === 'none' || !authorized.opened || !authorized.panelExists) {
  throw new Error(`main-password authorization no longer exposes stats: ${JSON.stringify(authorized)}`);
}
window;
await page.keyboard.press('Escape');

if (browserDialogs !== 0) {
  throw new Error(`stats flow opened ${browserDialogs} browser dialog(s)`);
}

console.log(JSON.stringify({ status: 'PASS', initial, devEnabled, panel, devDisabled, authorized, browserDialogs }, null, 2));
await browser.close();
