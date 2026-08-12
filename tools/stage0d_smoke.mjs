import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const assert = (cond, msg, details = '') => {
  if (!cond) throw new Error(`${msg}${details ? `: ${details}` : ''}`);
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8000/heart_at_crossroads.html', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const assertPage = (cond, msg, details = '') => {
      if (!cond) throw new Error(`${msg}${details ? `: ${details}` : ''}`);
    };

    const loadData = async (chapter) => {
      const response = await fetch(`assets/data/chapter${chapter}.json`);
      scriptData = await response.json();
      currentChapter = chapter;
      window.pendingEndingId = null;
      return scriptData;
    };

    // All branch-result scenes previously confirmed to bleed into sibling outcomes.
    const branchCases = [
      [1, 22], [1, 23],
      [2, 10], [2, 11],
      [3, 11],
      [4, 10],
      [5, 11],
      [7, 13], [7, 14],
      [8, 11]
    ];
    const branchResults = [];
    for (const [chapter, sceneId] of branchCases) {
      await loadData(chapter);
      const scene = scriptData.scenes.find(s => s.id === sceneId);
      assertPage(scene && scene.nextScene === null, 'audit branch case is no longer explicit null', `${chapter}:${sceneId}`);
      const target = resolveSceneTransition(scene);
      assertPage(target.type === 'chapter', 'terminal branch must go to next chapter', JSON.stringify({ chapter, sceneId, target }));
      assertPage(target.chapterId === chapter + 1, 'terminal branch chapter mismatch', JSON.stringify({ chapter, sceneId, target }));
      assertPage(target.sceneId !== sceneId + 1, 'branch bleed survived', JSON.stringify({ chapter, sceneId, target }));
      branchResults.push({ chapter, sceneId, target });
    }

    // Explicit null and omitted nextScene now have deliberately different semantics.
    currentChapter = 3;
    window.pendingEndingId = null;
    scriptData = { scenes: [{ id: 5, nextScene: null }, { id: 6 }] };
    const explicitNull = resolveSceneTransition(scriptData.scenes[0]);
    assertPage(explicitNull.type === 'chapter' && explicitNull.chapterId === 4, 'explicit null must terminate branch', JSON.stringify(explicitNull));

    scriptData = { scenes: [{ id: 5 }, { id: 6 }] };
    const omittedLegacy = resolveSceneTransition(scriptData.scenes[0]);
    assertPage(omittedLegacy.type === 'scene' && omittedLegacy.sceneId === 6, 'omitted nextScene legacy fallback broken', JSON.stringify(omittedLegacy));

    scriptData = { scenes: [{ id: 5, nextScene: 9 }, { id: 9 }] };
    const explicitNext = resolveSceneTransition(scriptData.scenes[0]);
    assertPage(explicitNext.type === 'scene' && explicitNext.sceneId === 9, 'explicit scene route broken', JSON.stringify(explicitNext));

    // Chapter 10: final choice may route through a result scene; pending ending must win at terminal null.
    const chapter10 = await loadData(10);
    const finalChoice = chapter10.scenes.flatMap(s => s.choices || []).find(c => c.leadsToEnding && Number.isInteger(c.nextScene));
    assertPage(finalChoice, 'no chapter10 staged ending choice found');
    const finalChoiceTarget = resolveChoiceTransition(finalChoice);
    assertPage(finalChoiceTarget.type === 'scene', 'staged ending choice must first enter its result scene', JSON.stringify(finalChoiceTarget));
    window.pendingEndingId = resolveEndingId(finalChoice.leadsToEnding);
    const finalResultScene = chapter10.scenes.find(s => s.id === finalChoice.nextScene);
    const finalResultTarget = resolveSceneTransition(finalResultScene);
    assertPage(finalResultTarget.type === 'ending', 'terminal final-result scene must resolve pending ending', JSON.stringify(finalResultTarget));
    assertPage(finalResultTarget.endingId === resolveEndingId(finalChoice.leadsToEnding), 'pending ending id mismatch', JSON.stringify(finalResultTarget));

    // applyChoice is the single mutation path and persists once even under simultaneous duplicate calls.
    localStorage.clear();
    profileState = { language: 'ru', isAuthorized: false, memories: [], completionCount: 0 };
    stats = createFreshRunStats(false);
    stats.diamonds = 10;
    choices = [];
    currentChapter = 1;
    currentScene = 0;
    scriptData = { scenes: [{ id: 0 }] };
    window.pendingEndingId = null;

    const mutationChoice = {
      id: 'stage0d_effect_once',
      cost: 4,
      effects: { heart: 2, 'relationships.dima': 3 }
    };
    const applied = await applyChoice(mutationChoice);
    assertPage(applied === true, 'applyChoice should commit valid choice');
    assertPage(stats.heart === 2 && stats.relationships.dima === 3 && stats.diamonds === 6, 'choice effects/cost mismatch', JSON.stringify(stats));
    assertPage(choices.filter(id => id === mutationChoice.id).length === 1, 'choice recorded more than once');

    const runKey = 'heart_at_crossroads_beta2:v1:run';
    const persisted = JSON.parse(localStorage.getItem(runKey));
    assertPage(persisted.stats.heart === 2 && persisted.stats.relationships.dima === 3 && persisted.stats.diamonds === 6, 'choice state not persisted', JSON.stringify(persisted));

    const duplicateChoice = { id: 'stage0d_duplicate_guard', effects: { heart: 5 } };
    const beforeHeart = stats.heart;
    const duplicateResults = await Promise.all([applyChoice(duplicateChoice), applyChoice(duplicateChoice)]);
    assertPage(stats.heart === beforeHeart + 5, 'duplicate simultaneous choice applied effects twice', JSON.stringify({ beforeHeart, after: stats.heart, duplicateResults }));
    assertPage(choices.filter(id => id === duplicateChoice.id).length === 1, 'duplicate simultaneous choice recorded twice', JSON.stringify(choices));

    // Transition primitive: scene, chapter success, and chapter failure rollback.
    const originalShowScene = showScene;
    const originalLoadChapter = loadChapter;
    try {
      showScene = async (id) => { window.__stage0dShown = id; return true; };
      loadChapter = async (id) => { window.__stage0dLoaded = id; scriptData = { scenes: [{ id: 0 }] }; return true; };

      currentChapter = 2;
      currentScene = 4;
      const sceneTransition = await transitionTo({ type: 'scene', sceneId: 8, reason: 'smoke' });
      assertPage(sceneTransition && currentChapter === 2 && currentScene === 8 && window.__stage0dShown === 8, 'scene transition primitive failed');

      const chapterTransition = await transitionTo({ type: 'chapter', chapterId: 3, reason: 'smoke' });
      assertPage(chapterTransition && currentChapter === 3 && currentScene === 0 && window.__stage0dLoaded === 3 && window.__stage0dShown === 0, 'chapter transition primitive failed');

      currentChapter = 4;
      currentScene = 7;
      loadChapter = async () => false;
      const failedChapter = await transitionTo({ type: 'chapter', chapterId: 5, reason: 'smoke-fail' });
      assertPage(failedChapter === false && currentChapter === 4 && currentScene === 7, 'failed chapter transition did not roll back');
    } finally {
      showScene = originalShowScene;
      loadChapter = originalLoadChapter;
    }

    return {
      status: 'PASS',
      branchCases: branchResults.length,
      explicitNull,
      omittedLegacy,
      finalRoute: { choice: finalChoice.id, scene: finalChoice.nextScene, ending: finalResultTarget.endingId },
      mutation: { heart: stats.heart, dima: stats.relationships.dima, choices: choices.length }
    };
  });

  assert(result.status === 'PASS', 'browser result not PASS', JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
