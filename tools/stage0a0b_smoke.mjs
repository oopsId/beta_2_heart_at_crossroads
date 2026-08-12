import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8000/';
const requests = [];
const failures = [];
const checks = [];
const assert = (condition, message, details = '') => {
  checks.push({ ok: Boolean(condition), message, details });
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('request', r => requests.push(r.url()));
  page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));

  await page.goto(`${base}index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/heart_at_crossroads\.html/);
  assert(page.url() === `${base}heart_at_crossroads.html`, 'index.html redirects to the game entrypoint', page.url());

  const baseURI = await page.evaluate(() => document.baseURI);
  assert(baseURI === base, 'document base resolves to deployment root', baseURI);

  const telegramRuntime = await page.evaluate(() => ({
    hasTelegram: typeof window.Telegram !== 'undefined',
    hasIsTelegram: typeof window.isTelegram !== 'undefined',
  }));
  assert(!telegramRuntime.hasTelegram, 'Telegram WebApp runtime is absent', JSON.stringify(telegramRuntime));
  assert(!telegramRuntime.hasIsTelegram, 'legacy isTelegram runtime flag is absent', JSON.stringify(telegramRuntime));

  const storage = await page.evaluate(async () => {
    localStorage.clear();
    await saveToStorage('stage0b_smoke', 'browser-only');
    const read = await getFromStorage('stage0b_smoke');
    const raw = localStorage.getItem('stage0b_smoke');
    await removeFromStorage('stage0b_smoke');
    return { read, raw, removed: localStorage.getItem('stage0b_smoke') === null };
  });
  assert(storage.read === 'browser-only' && storage.raw === 'browser-only' && storage.removed,
    'browser storage adapter round-trips through localStorage', JSON.stringify(storage));

  await page.evaluate(() => localStorage.setItem('tempAccessGranted', 'true'));
  await page.click('#start-game');
  await page.waitForFunction(() => document.getElementById('dialogue-box')?.style.display === 'block', null, { timeout: 30000 });
  const run = await page.evaluate(() => ({ currentChapter, currentScene, scriptChapter: scriptData?.chapter }));
  assert(run.currentChapter === 1 && run.currentScene === 0, 'new game starts chapter 1 scene 0', JSON.stringify(run));

  const crossLoads = requests.filter(url => {
    try { return new URL(url).pathname.includes('/heart_at_crossroads/'); }
    catch { return false; }
  });
  assert(crossLoads.length === 0, 'beta_2 makes zero requests to the original /heart_at_crossroads/ namespace', crossLoads.slice(0, 10).join(', '));

  const ownAssetRequests = requests.filter(url => {
    try { return new URL(url).pathname.startsWith('/assets/'); }
    catch { return false; }
  });
  assert(ownAssetRequests.length > 0, 'runtime loads assets from its own deployment root', `count=${ownAssetRequests.length}`);

  console.log(JSON.stringify({ status: 'PASS', checks, requestCount: requests.length, failedRequestCount: failures.length }, null, 2));
} finally {
  await browser.close();
}
