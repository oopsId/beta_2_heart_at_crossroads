import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8000/';
const prefix = 'heart_at_crossroads_beta2:v1:';
const browser = await chromium.launch({ headless: true });
const assert = (cond, msg, details='') => { if (!cond) throw new Error(`${msg}${details ? `: ${details}` : ''}`); };

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}heart_at_crossroads.html`, { waitUntil: 'domcontentloaded' });

  await page.evaluate((prefix) => {
    localStorage.clear();
    // Sentinels simulate storage belonging to the original Pages app on the same origin.
    localStorage.setItem('gameSession', 'ORIGINAL_GAME_SESSION');
    localStorage.setItem('last_session', 'ORIGINAL_LAST_SESSION');
    localStorage.setItem('tempAccessGranted', 'ORIGINAL_ACCESS');
    localStorage.setItem(`${prefix}tempAccessGranted`, 'true');
  }, prefix);

  // New Game creates only beta_2 namespaced run/profile state.
  await page.click('#start-game');
  await page.waitForFunction(() => typeof scriptData !== 'undefined' && scriptData && currentChapter === 1 && currentScene === 0, null, { timeout: 30000 });
  await page.evaluate(async () => {
    currentScene = 3;
    stats.heart = 7;
    stats.relationships.dima = 4;
    stats.language = 'en';
    stats.memories = ['audit_memory'];
    stats.completionCount = 2;
    await saveSession();
  });

  let storage = await page.evaluate((prefix) => ({
    run: localStorage.getItem(`${prefix}run`),
    profile: localStorage.getItem(`${prefix}profile`),
    legacyGame: localStorage.getItem('gameSession'),
    legacyLast: localStorage.getItem('last_session'),
    legacyAccess: localStorage.getItem('tempAccessGranted'),
  }), prefix);
  assert(storage.run && storage.profile, 'new game writes run and profile');
  assert(storage.legacyGame === 'ORIGINAL_GAME_SESSION' && storage.legacyLast === 'ORIGINAL_LAST_SESSION' && storage.legacyAccess === 'ORIGINAL_ACCESS', 'legacy/original keys stay untouched');

  // Reload + Continue restores the last saved position and profile.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('#continue-game');
  await page.waitForFunction(() => currentChapter === 1 && currentScene === 3 && stats.heart === 7 && stats.relationships.dima === 4, null, { timeout: 30000 });
  let restored = await page.evaluate(() => ({ currentChapter, currentScene, heart: stats.heart, dima: stats.relationships.dima, language: stats.language, memories: stats.memories, completionCount: stats.completionCount }));
  assert(restored.language === 'en', 'profile language survives reload', JSON.stringify(restored));
  assert(restored.memories.includes('audit_memory') && restored.completionCount === 2, 'profile metaprogression survives reload', JSON.stringify(restored));

  // Intentional Menu destroys only the run, preserving profile.
  await page.click('#menu-btn');
  await page.waitForFunction((prefix) => localStorage.getItem(`${prefix}run`) === null, prefix);
  const afterMenu = await page.evaluate((prefix) => ({
    run: localStorage.getItem(`${prefix}run`),
    profile: JSON.parse(localStorage.getItem(`${prefix}profile`)),
    chapter: currentChapter,
    scene: currentScene,
    language: stats.language,
    memories: stats.memories,
    completionCount: stats.completionCount,
    legacyGame: localStorage.getItem('gameSession'),
  }), prefix);
  assert(afterMenu.run === null && afterMenu.chapter === 1 && afterMenu.scene === 0, 'Menu destroys active run and resets in-memory position', JSON.stringify(afterMenu));
  assert(afterMenu.profile.language === 'en' && afterMenu.profile.memories.includes('audit_memory') && afterMenu.profile.completionCount === 2, 'Menu preserves profile', JSON.stringify(afterMenu.profile));
  assert(afterMenu.legacyGame === 'ORIGINAL_GAME_SESSION', 'Menu does not touch original app storage');

  // Continue with no active run must not start a game or recreate a run.
  await page.click('#continue-game');
  await page.waitForTimeout(300);
  const noRun = await page.evaluate((prefix) => ({ run: localStorage.getItem(`${prefix}run`), gameVisible: getComputedStyle(document.getElementById('game-container')).display !== 'none' }), prefix);
  assert(noRun.run === null, 'Continue without run does not fabricate a save');
  assert(!noRun.gameVisible, 'Continue without run stays on start screen');

  // Starting again creates a fresh run while keeping profile progression.
  await page.click('#start-game');
  await page.waitForFunction(() => currentChapter === 1 && currentScene === 0 && stats.heart === 0, null, { timeout: 30000 });
  const fresh = await page.evaluate((prefix) => ({
    hasRun: localStorage.getItem(`${prefix}run`) !== null,
    language: stats.language,
    memories: stats.memories,
    completionCount: stats.completionCount,
    heart: stats.heart,
    dima: stats.relationships.dima,
  }), prefix);
  assert(fresh.hasRun && fresh.heart === 0 && fresh.dima === 0, 'New Game creates a fresh run');
  assert(fresh.language === 'en' && fresh.memories.includes('audit_memory') && fresh.completionCount === 2, 'New Game preserves profile progression', JSON.stringify(fresh));

  console.log(JSON.stringify({ status: 'PASS', restored, afterMenu, fresh }, null, 2));
} finally {
  await browser.close();
}
