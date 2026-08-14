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

const result = await page.evaluate(async () => {
  beginRuntimeSession('volume-smoke');

  const first = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
  const second = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
  const initial = { master: window.heartAudioVolume.get(), first: first.volume, second: second.volume };

  const downPoint = { x: 333, y: 244 };
  const down = new WheelEvent('wheel', {
    deltaY: 120,
    clientX: downPoint.x,
    clientY: downPoint.y,
    cancelable: true
  });
  window.dispatchEvent(down);

  const hud = document.getElementById('heart-volume-hud');
  const percent = hud?.querySelector('.heart-volume-percent');
  const fill = hud?.querySelector('.heart-volume-fill');
  const track = hud?.querySelector('.heart-volume-track');
  const hudStyle = hud ? getComputedStyle(hud) : null;
  const trackStyle = track ? getComputedStyle(track) : null;
  const downRect = hud?.getBoundingClientRect();

  const afterDown = {
    master: window.heartAudioVolume.get(),
    first: first.volume,
    second: second.volume,
    prevented: down.defaultPrevented,
    hud: {
      exists: Boolean(hud),
      visibleClass: hud?.classList.contains('is-visible') === true,
      ariaHidden: hud?.getAttribute('aria-hidden'),
      percent: percent?.textContent || '',
      fillHeight: fill?.style.height || '',
      orientation: trackStyle ? parseFloat(trackStyle.height) > parseFloat(trackStyle.width) : false,
      position: hudStyle?.position || '',
      centerX: downRect ? downRect.left + downRect.width / 2 : null,
      centerY: downRect ? downRect.top + downRect.height / 2 : null,
      cursorX: downPoint.x,
      cursorY: downPoint.y
    }
  };

  const third = createRuntimeAudio('assets/sounds/sfx_tick.mp3');
  const newAudioVolume = third.volume;

  const upPoint = { x: 777, y: 411 };
  const up = new WheelEvent('wheel', {
    deltaY: -120,
    clientX: upPoint.x,
    clientY: upPoint.y,
    cancelable: true
  });
  window.dispatchEvent(up);
  const upHud = document.getElementById('heart-volume-hud');
  const upRect = upHud?.getBoundingClientRect();
  const afterUp = {
    master: window.heartAudioVolume.get(),
    first: first.volume,
    third: third.volume,
    percent: document.querySelector('#heart-volume-hud .heart-volume-percent')?.textContent || '',
    fillHeight: document.querySelector('#heart-volume-hud .heart-volume-fill')?.style.height || '',
    centerX: upRect ? upRect.left + upRect.width / 2 : null,
    centerY: upRect ? upRect.top + upRect.height / 2 : null,
    cursorX: upPoint.x,
    cursorY: upPoint.y
  };

  for (let i = 0; i < 30; i += 1) {
    window.dispatchEvent(new WheelEvent('wheel', {
      deltaY: 120,
      clientX: upPoint.x,
      clientY: upPoint.y,
      cancelable: true
    }));
  }
  const min = window.heartAudioVolume.get();

  for (let i = 0; i < 30; i += 1) {
    window.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -120,
      clientX: upPoint.x,
      clientY: upPoint.y,
      cancelable: true
    }));
  }
  const max = window.heartAudioVolume.get();
  const maxHud = {
    percent: document.querySelector('#heart-volume-hud .heart-volume-percent')?.textContent || '',
    fillHeight: document.querySelector('#heart-volume-hud .heart-volume-fill')?.style.height || ''
  };

  await new Promise(resolve => setTimeout(resolve, 1150));
  const afterHideDelay = {
    visibleClass: document.getElementById('heart-volume-hud')?.classList.contains('is-visible') === true,
    ariaHidden: document.getElementById('heart-volume-hud')?.getAttribute('aria-hidden')
  };

  invalidateRuntimeSession('volume-smoke-done');
  return { initial, afterDown, newAudioVolume, afterUp, min, max, maxHud, afterHideDelay };
});

assert(result.initial.master === 1 && result.initial.first === 1 && result.initial.second === 1,
  'Initial master volume is not 100%', JSON.stringify(result));
assert(result.afterDown.prevented === true, 'Active-game wheel was not captured', JSON.stringify(result));
assert(Math.abs(result.afterDown.master - 0.95) < 0.001 && Math.abs(result.afterDown.first - 0.95) < 0.001 && Math.abs(result.afterDown.second - 0.95) < 0.001,
  'Wheel down did not lower all active audio by 5%', JSON.stringify(result));
assert(result.afterDown.hud.exists && result.afterDown.hud.visibleClass && result.afterDown.hud.ariaHidden === 'false',
  'Volume HUD did not appear while scrolling', JSON.stringify(result));
assert(result.afterDown.hud.percent === '95%' && result.afterDown.hud.fillHeight === '95%',
  'Volume HUD did not show the current percentage', JSON.stringify(result));
assert(result.afterDown.hud.orientation === true && result.afterDown.hud.position === 'fixed',
  'Volume HUD is not a vertical fixed overlay', JSON.stringify(result));
assert(Math.abs((result.afterDown.hud.centerX - result.afterDown.hud.cursorX) - 2) < 0.75 &&
       Math.abs((result.afterDown.hud.centerY - result.afterDown.hud.cursorY) - 2) < 0.75,
  'Volume HUD did not appear at the wheel cursor within the 2px offset', JSON.stringify(result));
assert(Math.abs(result.newAudioVolume - 0.95) < 0.001,
  'New runtime audio did not inherit master volume', JSON.stringify(result));
assert(result.afterUp.master === 1 && result.afterUp.first === 1 && result.afterUp.third === 1 && result.afterUp.percent === '100%' && result.afterUp.fillHeight === '100%',
  'Wheel up did not restore audio and HUD to 100%', JSON.stringify(result));
assert(Math.abs((result.afterUp.centerX - result.afterUp.cursorX) - 2) < 0.75 &&
       Math.abs((result.afterUp.centerY - result.afterUp.cursorY) - 2) < 0.75,
  'Volume HUD did not follow the new wheel cursor position', JSON.stringify(result));
assert(result.min === 0 && result.max === 1 && result.maxHud.percent === '100%' && result.maxHud.fillHeight === '100%',
  'Master volume did not clamp to 0..1 with matching HUD', JSON.stringify(result));
assert(result.afterHideDelay.visibleClass === false && result.afterHideDelay.ariaHidden === 'true',
  'Volume HUD did not auto-hide after wheel activity stopped', JSON.stringify(result));

console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
await browser.close();
