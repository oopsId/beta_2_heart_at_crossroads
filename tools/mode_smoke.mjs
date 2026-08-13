import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const base = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
const normal = await browser.newPage();
await normal.goto(base, { waitUntil: 'domcontentloaded' });
await normal.evaluate(() => localStorage.setItem('heart_at_crossroads_beta2:dev:force_first_playthrough', '1'));
await normal.reload({ waitUntil: 'domcontentloaded' });
const normalState = await normal.evaluate(async () => {
  const chapter = await (await fetch('assets/data/chapter2.json')).json();
  const scene = chapter.scenes.find(item => item.id === 1);
  stage0kApplyReplayOverride(chapter);
  return {
    mode: window.heartDevMode,
    control: !!document.getElementById('stage0k-dev-replay-control'),
    forced: stage0kDevForceFirstPlaythrough(),
    replayTextPresent: Object.prototype.hasOwnProperty.call(scene, 'second_playthrough_text')
  };
});
if (normalState.mode || normalState.control || normalState.forced || !normalState.replayTextPresent) throw new Error(`normal player affected by stored developer flag: ${JSON.stringify(normalState)}`);
const specialUrl = new URL(base);
specialUrl.searchParams.set('dev', '1');
const special = await browser.newPage();
await special.goto(specialUrl.href, { waitUntil: 'domcontentloaded' });
const specialState = await special.evaluate(() => ({ mode: window.heartDevMode, control: !!document.getElementById('stage0k-dev-replay-control') }));
if (!specialState.mode || !specialState.control) throw new Error(`developer mode did not expose control: ${JSON.stringify(specialState)}`);
console.log(JSON.stringify({ status: 'PASS', normalState, specialState }, null, 2));
await browser.close();
