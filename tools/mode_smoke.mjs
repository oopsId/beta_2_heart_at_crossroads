import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const base = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
await page.goto(base, { waitUntil: 'domcontentloaded' });
const state = await page.evaluate(() => ({ mode: window.heartDevMode, control: !!document.getElementById('stage0k-dev-replay-control') }));
if (state.mode || state.control) throw new Error(`unexpected developer UI: ${JSON.stringify(state)}`);
console.log(JSON.stringify({ status: 'PASS', state }));
await browser.close();
