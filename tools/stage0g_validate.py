#!/usr/bin/env python3
from pathlib import Path

html = (Path(__file__).resolve().parents[1] / 'heart_at_crossroads.html').read_bytes().decode('utf-8')

required = [
    'Stage 0G: runtime lifecycle generation/cancellation.',
    'function beginRuntimeSession(',
    'function invalidateRuntimeSession(',
    'function cancelRuntimeTasks()',
    'function runtimeSetTimeout(',
    'function runtimeSetInterval(',
    'function isRunCurrent(',
    "invalidateRuntimeSession('menu');",
    "const generation = beginRuntimeSession('new-game');",
    "const generation = beginRuntimeSession('continue');",
    'async function startGame(generation = runtimeGeneration)',
    'async function loadChapter(chapterId, generation = runtimeGeneration)',
    'async function transitionTo(target, options = {})',
    'async function applyChoice(choice, options = {})',
    'async function showScene(sceneId, generation = runtimeGeneration)',
    'function showSceneWithTimer(scene, generation = runtimeGeneration)',
    'function typeText(text, element, callback, generation = runtimeGeneration)',
    'function fadeOut(callback, generation = runtimeGeneration)',
    'async function loadFinals(endingId, generation = runtimeGeneration)',
    'function showEnding(ending, generation = runtimeGeneration)',
    'function showEpilogue(epilogueText, generation = runtimeGeneration)',
    "'.phone-overlay, #timer-countdown, .choice-btn, .choice-feedback, .memory-notification, #loading-overlay, #loading-status, .epilogue-overlay'",
]
for needle in required:
    assert needle in html, f'missing Stage 0G invariant: {needle}'

# Menu must invalidate before the first await.
menu_start = html.index('async function handleMenu(e)')
menu_end = html.index('function handleShowStats', menu_start)
menu = html[menu_start:menu_end]
assert menu.index("invalidateRuntimeSession('menu');") < menu.index('await saveProfile()'), 'Menu invalidation must precede first await'

# Old untracked gameplay timer patterns must be gone.
for forbidden in [
    'element.typeTimer = setTimeout(',
    'countdownInterval = setInterval(',
    'timer = setTimeout(async () =>',
    "setTimeout(() => overlay?.classList.remove('flash-svg')",
    'setTimeout(() => feedback.remove(), 3000)',
    'setTimeout(async () => {\r\n                epilogueDiv.remove()',
    'let interval = setInterval(() => {',
]:
    assert forbidden not in html, f'untracked gameplay timer remains: {forbidden}'

# Transition/choice finally blocks cannot unlock a newer generation.
assert 'if (isRuntimeGenerationCurrent(generation)) transitionInFlight = false;' in html
assert 'if (isRuntimeGenerationCurrent(generation)) choiceCommitInFlight = false;' in html

# Async rendering must check generation after awaits.
for fn in ['setupBackground', 'setupCharacters', 'loadChapter', 'startGame', 'loadFinals']:
    start = html.index(f'function {fn}') if f'function {fn}' in html else html.index(f'async function {fn}')
    block = html[start:start + 9000]
    assert 'isRunCurrent(generation)' in block, f'{fn} lacks generation guard'

print('Stage 0G validator PASS')
print('Lifecycle manager, Menu-before-await invalidation, tracked gameplay timers, async generation guards: OK')
