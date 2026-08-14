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

  heartSetDevForceFirstPlaythrough(false);
  beginRuntimeSession('stats-smoke-normal');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('menu').style.display = 'flex';
  const button = document.getElementById('stats');
  const devControl = document.getElementById('stage0k-dev-replay-control');
  button.style.display = 'none';
  window.heartSyncStatsVisibility();

  const directOpen = window.heartShowStatsPanel();
  return {
    authorized: stats.isAuthorized,
    forced: window.heartDevForceFirstPlaythrough(),
    devClass: document.documentElement.classList.contains('heart-dev-first-playthrough'),
    display: getComputedStyle(button).display,
    directOpen,
    panelExists: Boolean(document.getElementById('stats-panel-overlay')),
    devControlVisible: devControl ? devControl.getClientRects().length > 0 : false
  };
});

if (initial.authorized || initial.forced || initial.devClass || initial.display !== 'none' || initial.directOpen !== false || initial.panelExists || initial.devControlVisible) {
  throw new Error(`unauthorized stats gate is open without a DEV run: ${JSON.stringify(initial)}`);
}

// Enable DEV on the menu, then start a runtime. The control itself must disappear with the menu.
const devEnabled = await page.evaluate(() => {
  invalidateRuntimeSession('stats-smoke-enable-dev');
  showStartScreen();
  const selected = heartSetDevForceFirstPlaythrough(true);
  const generation = beginRuntimeSession('stats-smoke-dev');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  const button = document.getElementById('stats');
  const devControl = document.getElementById('stage0k-dev-replay-control');
  button.style.display = 'none';
  window.heartSyncStatsVisibility();
  return {
    selected,
    generation,
    authorized: stats.isAuthorized,
    forced: window.heartDevForceFirstPlaythrough(),
    devClass: document.documentElement.classList.contains('heart-dev-first-playthrough'),
    display: getComputedStyle(button).display,
    devControlVisible: devControl ? devControl.getClientRects().length > 0 : false,
    attemptedRuntimeChange: heartSetDevForceFirstPlaythrough(false)
  };
});
if (!devEnabled.selected || devEnabled.authorized || !devEnabled.forced || !devEnabled.devClass || devEnabled.display === 'none' || devEnabled.devControlVisible || devEnabled.attemptedRuntimeChange !== false) {
  throw new Error(`menu-captured DEV mode did not expose stats correctly: ${JSON.stringify(devEnabled)}`);
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

// Reproduce the reported lifecycle: leave gameplay for the start screen while the panel is open.
const menuReturn = await page.evaluate(async () => {
  invalidateRuntimeSession('stats-smoke-menu-return');
  showStartScreen();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const startScreen = document.getElementById('start-screen');
  return {
    panelExists: Boolean(document.getElementById('stats-panel-overlay')),
    startVisible: startScreen.getClientRects().length > 0
  };
});
if (menuReturn.panelExists || !menuReturn.startVisible) {
  throw new Error(`stats panel survived return to the start screen: ${JSON.stringify(menuReturn)}`);
}

// Disable DEV on the menu and start another runtime; stats must close again.
const devDisabled = await page.evaluate(() => {
  invalidateRuntimeSession('stats-smoke-disable-dev');
  showStartScreen();
  const selected = heartSetDevForceFirstPlaythrough(false);
  beginRuntimeSession('stats-smoke-normal-again');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  const button = document.getElementById('stats');
  const devControl = document.getElementById('stage0k-dev-replay-control');
  button.style.display = 'none';
  window.heartSyncStatsVisibility();
  return {
    selected,
    forced: window.heartDevForceFirstPlaythrough(),
    devClass: document.documentElement.classList.contains('heart-dev-first-playthrough'),
    display: getComputedStyle(button).display,
    devControlVisible: devControl ? devControl.getClientRects().length > 0 : false
  };
});
if (!devDisabled.selected || devDisabled.forced || devDisabled.devClass || devDisabled.display !== 'none' || devDisabled.devControlVisible) {
  throw new Error(`stats remained visible after a non-DEV menu launch: ${JSON.stringify(devDisabled)}`);
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
await page.keyboard.press('Escape');

if (browserDialogs !== 0) {
  throw new Error(`stats flow opened ${browserDialogs} browser dialog(s)`);
}

console.log(JSON.stringify({ status: 'PASS', initial, devEnabled, panel, menuReturn, devDisabled, authorized, browserDialogs }, null, 2));
await browser.close();
