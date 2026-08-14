import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';

const assert = (condition, message, details = '') => {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof beginRuntimeSession === 'function' &&
  typeof createRuntimeAudio === 'function' &&
  typeof window.heartAudioVolume?.get === 'function'
);

const result = await page.evaluate(() => {
  beginRuntimeSession('volume-smoke');

  const first = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
  const second = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
  const initial = { master: window.heartAudioVolume.get(), first: first.volume, second: second.volume };

  const down = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
  window.dispatchEvent(down);
  const afterDown = {
    master: window.heartAudioVolume.get(),
    first: first.volume,
    second: second.volume,
    prevented: down.defaultPrevented
  };

  const third = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
  const newAudioVolume = third.volume;

  const up = new WheelEvent('wheel', { deltaY: -120, cancelable: true });
  window.dispatchEvent(up);
  const afterUp = { master: window.heartAudioVolume.get(), first: first.volume, third: third.volume };

  for (let i = 0; i < 30; i += 1) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, cancelable: true }));
  }
  const min = window.heartAudioVolume.get();

  for (let i = 0; i < 30; i += 1) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, cancelable: true }));
  }
  const max = window.heartAudioVolume.get();

  invalidateRuntimeSession('volume-smoke-done');
  return { initial, afterDown, newAudioVolume, afterUp, min, max };
});

assert(result.initial.master === 1 && result.initial.first === 1 && result.initial.second === 1,
  'Initial master volume is not 100%', JSON.stringify(result));
assert(result.afterDown.prevented === true, 'Active-game wheel was not captured', JSON.stringify(result));
assert(Math.abs(result.afterDown.master - 0.95) < 0.001 && Math.abs(result.afterDown.first - 0.95) < 0.001 && Math.abs(result.afterDown.second - 0.95) < 0.001,
  'Wheel down did not lower all active audio by 5%', JSON.stringify(result));
assert(Math.abs(result.newAudioVolume - 0.95) < 0.001,
  'New runtime audio did not inherit master volume', JSON.stringify(result));
assert(result.afterUp.master === 1 && result.afterUp.first === 1 && result.afterUp.third === 1,
  'Wheel up did not restore all audio to 100%', JSON.stringify(result));
assert(result.min === 0 && result.max === 1, 'Master volume did not clamp to 0..1', JSON.stringify(result));

console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
await browser.close();
