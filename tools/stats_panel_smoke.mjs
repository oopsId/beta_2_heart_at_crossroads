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
await page.waitForFunction(() => typeof window.heartShowStatsPanel === 'function' && window.heartDevMode === true);

const before = await page.evaluate(() => {
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

  const menu = document.getElementById('menu');
  const button = document.getElementById('stats');
  menu.style.display = 'flex';
  // Simulate story-runtime's legacy authorization gate. Dev CSS must override it.
  button.style.display = 'none';

  return {
    devClass: document.documentElement.classList.contains('heart-dev-mode'),
    display: getComputedStyle(button).display,
    authorized: stats.isAuthorized
  };
});

if (!before.devClass || before.authorized || before.display === 'none') {
  throw new Error(`stats button is not visible for unauthorized beta developer: ${JSON.stringify(before)}`);
}

await page.locator('#stats').click();
await page.locator('#stats-panel-overlay').waitFor({ state: 'visible' });

const panel = await page.evaluate(() => {
  const overlay = document.getElementById('stats-panel-overlay');
  const rows = [...overlay.querySelectorAll('.stats-panel-row')].map(row => row.textContent.replace(/\s+/g, ' ').trim());
  return {
    title: overlay.querySelector('#stats-panel-title')?.textContent,
    rows,
    modal: overlay.querySelector('.stats-panel')?.getAttribute('aria-modal'),
    closeLabel: overlay.querySelector('.stats-panel-close')?.getAttribute('aria-label')
  };
});

for (const expected of ['Короны3', 'Сердце7', 'Лист2', 'Бриллианты64', 'Марк5', 'Лера-1', 'Вика4', 'Сергей6', 'Анна8', 'Дима9', 'Лёша1']) {
  if (!panel.rows.some(row => row.replace(/\s+/g, '') === expected)) {
    throw new Error(`stats panel missing ${expected}: ${JSON.stringify(panel)}`);
  }
}
if (panel.title !== 'Статы' || panel.modal !== 'true' || panel.closeLabel !== 'Закрыть') {
  throw new Error(`stats panel metadata drifted: ${JSON.stringify(panel)}`);
}
if (browserDialogs !== 0) {
  throw new Error(`stats click opened ${browserDialogs} browser dialog(s)`);
}

await page.keyboard.press('Escape');
if (await page.locator('#stats-panel-overlay').count()) {
  throw new Error('Escape did not close stats panel');
}

console.log(JSON.stringify({ status: 'PASS', before, panel, browserDialogs }, null, 2));
await browser.close();
