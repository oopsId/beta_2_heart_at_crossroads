import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const assert = (condition, message, details = '') => {
  if (!condition) throw new Error(`${message}${details ? `: ${details}` : ''}`);
};

const url = process.env.GAME_URL || 'http://127.0.0.1:8000/heart_at_crossroads.html';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() =>
  typeof stage0mGalleryRule === 'function' &&
  typeof stage0mSyncGalleryProgress === 'function' &&
  typeof stage0mCanBuyGalleryCard === 'function' &&
  typeof stage0mPurchaseGalleryCard === 'function'
);

const result = await page.evaluate(async () => {
  localStorage.removeItem('heart_at_crossroads_beta2:v1:run');
  localStorage.removeItem('heart_at_crossroads_beta2:v1:profile');
  profileState = normalizeProfile(DEFAULT_PROFILE_STATE);
  resetGameState(false);

  const freshDiamonds = stats.diamonds;
  stats.memories = [];
  stats.completionCount = 0;
  const cards = cardSeries.romance.cards;
  const replayCards = cards.filter(card => stage0mGalleryRule(card).type === 'completion');
  const paidCards = cards.filter(card => stage0mGalleryRule(card).type === 'diamonds');
  const beforeFirst = paidCards.map(card => stage0mCanBuyGalleryCard(card).reason);

  stats.completionCount = 1;
  await stage0mSyncGalleryProgress();
  const replayAfterFirst = replayCards.filter(card => stats.memories.includes(card.id)).map(card => card.id);
  const paidAvailableAfterFirst = paidCards.map(card => stage0mCanBuyGalleryCard(card).ok);
  const purchase = await stage0mPurchaseGalleryCard(paidCards[0]);

  stats.completionCount = 2;
  await stage0mSyncGalleryProgress();
  const replayAfterSecond = replayCards.filter(card => stats.memories.includes(card.id)).map(card => card.id);
  const paidUnlocked = paidCards.filter(card => stats.memories.includes(card.id)).map(card => card.id);
  const storedProfile = JSON.parse(localStorage.getItem('heart_at_crossroads_beta2:v1:profile') || '{}');

  return {
    freshDiamonds,
    totalCards: cards.length,
    replayCards: replayCards.length,
    paidCards: paidCards.length,
    costs: paidCards.map(card => stage0mGalleryRule(card).cost),
    beforeFirst,
    replayAfterFirst,
    paidAvailableAfterFirst,
    purchaseOk: purchase.ok,
    diamondsAfterPurchase: stats.diamonds,
    replayAfterSecond,
    paidUnlocked,
    storedMemories: storedProfile.memories || []
  };
});

assert(result.freshDiamonds === 70, 'Fresh run must start with 70 beta/test diamonds', JSON.stringify(result));
assert(result.totalCards === 4 && result.replayCards === 2 && result.paidCards === 2, 'Gallery must keep original 2 replay + 2 paid split', JSON.stringify(result));
assert(result.costs.every(cost => cost === 50), 'Both paid gallery cards must cost 50 diamonds', JSON.stringify(result));
assert(result.beforeFirst.every(reason => reason === 'first-playthrough-required'), 'Paid cards must stay unavailable before first completion', JSON.stringify(result));
assert(result.replayAfterFirst.length === 0, 'Replay cards unlocked after only one completion', JSON.stringify(result));
assert(result.paidAvailableAfterFirst.every(Boolean), 'Paid cards did not become available after first completion', JSON.stringify(result));
assert(result.purchaseOk && result.diamondsAfterPurchase === 20, '50-diamond purchase did not deduct from the 70-diamond test balance', JSON.stringify(result));
assert(result.replayAfterSecond.length === 2, 'Both replay cards must auto-unlock after second completion', JSON.stringify(result));
assert(result.paidUnlocked.length === 1, 'Second completion must not auto-unlock the remaining paid card', JSON.stringify(result));
assert(result.storedMemories.includes(result.replayAfterSecond[0]) && result.storedMemories.includes(result.replayAfterSecond[1]) && result.storedMemories.includes(result.paidUnlocked[0]), 'Gallery unlocks were not persisted in profile memories', JSON.stringify(result));

console.log(JSON.stringify({ status: 'PASS', galleryEconomy: result }, null, 2));
await browser.close();
