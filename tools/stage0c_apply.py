#!/usr/bin/env python3
from pathlib import Path
import re
import sys

path = Path('heart_at_crossroads.html')
raw = path.read_bytes().decode('utf-8')
text = raw.replace('\r\n', '\n')
original = text

def sub(pattern, replacement, count=1, flags=re.S):
    global text
    text, n = re.subn(pattern, replacement, text, count=count, flags=flags)
    if n != count:
        raise SystemExit(f'Expected {count} replacement(s), got {n}: {pattern[:80]}')

# Global state: keep the existing stats API for story code, but split persistence into run/profile.
sub(
    r"        // Stage 0B: browser is the only supported runtime\.\n.*?        const tempPassword = \"999000\";",
    '''        // Stage 0C: one browser runtime, with isolated run/profile persistence.
        const STORAGE_NAMESPACE = 'heart_at_crossroads_beta2:v1:';
        const RUN_STORAGE_KEY = 'run';
        const PROFILE_STORAGE_KEY = 'profile';
        const ACCESS_STORAGE_KEY = 'tempAccessGranted';
        const STATE_VERSION = 1;

        const DEFAULT_PROFILE_STATE = Object.freeze({
            language: "ru",
            isAuthorized: false,
            memories: [],
            completionCount: 0
        });

        let profileState = {
            ...DEFAULT_PROFILE_STATE,
            memories: []
        };

        function createFreshRunStats(hasReturnedViaMenu = false) {
            return {
                crown: 0,
                heart: 0,
                leaf: 0,
                diamonds: 10,
                relationships: { mark: 0, lera: 0, vika: 0, sergey: 0, anna: 0, dima: 0, lesha: 0 },
                appearance: "style1",
                hasReturnedViaMenu,
                language: profileState.language,
                isAuthorized: profileState.isAuthorized,
                memories: [...profileState.memories],
                completionCount: profileState.completionCount
            };
        }

        let currentChapter = 1;
        let currentScene = 0;
        let choices = [];
        let stats = createFreshRunStats(false);
        let isTyping = false;
        let scriptData = null;
        let currentBackground = null;
        const correctPassword = "umbertoeco";
        const tempPassword = "999000";'''
)

# Storage contract + versioned serializer/deserializer.
sub(
    r"        // Browser-only persistence \(Stage 0B\).*?\n        // Утилита для событий",
    '''        // Browser-only persistence. Keys are namespaced because all oopsid.github.io projects share one origin.
        function storageKey(key) {
            return `${STORAGE_NAMESPACE}${key}`;
        }

        function saveToStorage(key, value) {
            return new Promise((resolve, reject) => {
                try {
                    localStorage.setItem(storageKey(key), String(value));
                    resolve();
                } catch (error) {
                    console.error(`Ошибка сохранения в localStorage: ${key}`, error);
                    reject(error);
                }
            });
        }

        function getFromStorage(key) {
            return new Promise((resolve, reject) => {
                try {
                    resolve(localStorage.getItem(storageKey(key)));
                } catch (error) {
                    console.error(`Ошибка чтения localStorage: ${key}`, error);
                    reject(error);
                }
            });
        }

        function removeFromStorage(key) {
            return new Promise((resolve, reject) => {
                try {
                    localStorage.removeItem(storageKey(key));
                    resolve();
                } catch (error) {
                    console.error(`Ошибка удаления из localStorage: ${key}`, error);
                    reject(error);
                }
            });
        }

        function normalizeProfile(candidate) {
            const value = candidate && typeof candidate === 'object' ? candidate : {};
            return {
                language: value.language === 'en' ? 'en' : 'ru',
                isAuthorized: value.isAuthorized === true,
                memories: Array.isArray(value.memories) ? [...new Set(value.memories.filter(v => typeof v === 'string'))] : [],
                completionCount: Number.isInteger(value.completionCount) && value.completionCount >= 0 ? value.completionCount : 0
            };
        }

        function syncProfileFromStats() {
            profileState = normalizeProfile({
                language: stats.language,
                isAuthorized: stats.isAuthorized,
                memories: stats.memories,
                completionCount: stats.completionCount
            });
        }

        function applyProfileToStats() {
            stats.language = profileState.language;
            stats.isAuthorized = profileState.isAuthorized;
            stats.memories = [...profileState.memories];
            stats.completionCount = profileState.completionCount;
        }

        async function saveProfile() {
            syncProfileFromStats();
            await saveToStorage(PROFILE_STORAGE_KEY, JSON.stringify({
                version: STATE_VERSION,
                ...profileState
            }));
        }

        async function loadProfile() {
            const rawProfile = await getFromStorage(PROFILE_STORAGE_KEY);
            if (!rawProfile) {
                profileState = normalizeProfile(DEFAULT_PROFILE_STATE);
                applyProfileToStats();
                return false;
            }
            try {
                const parsed = JSON.parse(rawProfile);
                profileState = normalizeProfile(parsed);
                applyProfileToStats();
                return true;
            } catch (error) {
                console.warn('Повреждён профиль beta_2, использованы значения по умолчанию:', error);
                profileState = normalizeProfile(DEFAULT_PROFILE_STATE);
                applyProfileToStats();
                return false;
            }
        }

        function serializeRunState() {
            return {
                version: STATE_VERSION,
                currentScene,
                currentChapter,
                choices: [...choices],
                stats: {
                    crown: stats.crown,
                    heart: stats.heart,
                    leaf: stats.leaf,
                    diamonds: stats.diamonds,
                    relationships: { ...stats.relationships },
                    appearance: stats.appearance,
                    hasReturnedViaMenu: stats.hasReturnedViaMenu === true
                }
            };
        }

        function validateRunState(session) {
            if (!session || typeof session !== 'object') throw new Error('run state is not an object');
            if (session.version !== STATE_VERSION) throw new Error(`unsupported run version: ${session.version}`);
            if (!Number.isInteger(session.currentChapter) || session.currentChapter < 1 || session.currentChapter > 10) throw new Error('invalid currentChapter');
            if (!Number.isInteger(session.currentScene) || session.currentScene < 0) throw new Error('invalid currentScene');
            if (!Array.isArray(session.choices)) throw new Error('invalid choices');
            if (!session.stats || typeof session.stats !== 'object') throw new Error('invalid stats');
            return session;
        }

        async function saveSession() {
            try {
                await saveProfile();
                await saveToStorage(RUN_STORAGE_KEY, JSON.stringify(serializeRunState()));
                console.log('Прохождение beta_2 сохранено');
                return true;
            } catch (error) {
                console.error('Ошибка сохранения прохождения:', error);
                showDebugMessage('Ошибка сохранения сессии');
                return false;
            }
        }

        async function deleteRun() {
            await removeFromStorage(RUN_STORAGE_KEY);
        }

        // Утилита для событий'''
)

# Continue only starts after a valid saved run has been restored.
sub(
    r"            function handleContinueGame\(e\) \{.*?            \}",
    '''            function handleContinueGame(e) {
                e.preventDefault();
                console.log('handleContinueGame вызван');
                checkTempPassword(async () => {
                    const loaded = await loadSession();
                    if (loaded) startGame();
                });
            }'''
)

# Intentional destructive Menu: preserve profile, delete run, reset in-memory run, return to start.
sub(
    r"            function handleMenu\(e\) \{.*?            \}",
    '''            async function handleMenu(e) {
                e.preventDefault();
                console.log('handleMenu вызван: текущее прохождение уничтожается');
                stats.hasReturnedViaMenu = true;
                try {
                    await saveProfile();
                    await deleteRun();
                } catch (error) {
                    console.error('Не удалось удалить текущее прохождение:', error);
                }
                resetGameState(true);
                showStartScreen();
            }'''
)

# Language belongs to profile and must not create a fake run from the start screen.
sub(
    r"            function handleLanguageSwitch\(e\) \{.*?            \}",
    '''            function handleLanguageSwitch(e) {
                e.preventDefault();
                console.log('handleLanguageSwitch вызван');
                stats.language = stats.language === "ru" ? "en" : "ru";
                languageIcon.textContent = stats.language === "ru" ? "🇷🇺" : "🇬🇧";
                updateLanguage(stats.language);
                saveProfile();
            }'''
)

# Startup loads only profile; Continue explicitly loads a run.
sub(
    r"            // Инициализация\n            getFromStorage\('last_session'\).*?                    showStartScreen\(\);\n                \}\);",
    '''            // Инициализация: профиль переживает reload, run загружается только кнопкой «Продолжить».
            loadProfile()
                .then(() => {
                    updateLanguage(stats.language);
                    languageIcon.textContent = stats.language === "ru" ? "🇷🇺" : "🇬🇧";
                    showStartScreen();
                })
                .catch(error => {
                    console.error('Ошибка загрузки профиля:', error);
                    showStartScreen();
                });'''
)

# Reset only run-scoped fields; profile always survives.
sub(
    r"        function resetGameState\(\) \{.*?        \}\n\n        function updateLanguage",
    '''        function resetGameState(hasReturnedViaMenu = false) {
            console.log('resetGameState вызван');
            currentChapter = 1;
            currentScene = 0;
            choices = [];
            stats = createFreshRunStats(hasReturnedViaMenu);
            currentBackground = null;
        }

        function updateLanguage'''
)

# New Game creates a new persisted run; loadSession parses and validates the namespaced run.
sub(
    r"        function startNewGame\(\) \{.*?        async function loadSession\(callback\) \{.*?        \}\n\n               function showMessengerOverlay",
    '''        async function startNewGame() {
            console.log('startNewGame вызван');
            resetGameState(false);
            await saveSession();
            startGame();
        }

        async function loadSession() {
            try {
                await loadProfile();
                const rawSession = await getFromStorage(RUN_STORAGE_KEY);
                if (!rawSession) {
                    showErrorMessage(stats.language === "ru" ? 'Нет сохранённого прохождения' : 'No saved playthrough');
                    return false;
                }

                const session = validateRunState(JSON.parse(rawSession));
                const runStats = session.stats;
                currentChapter = session.currentChapter;
                currentScene = session.currentScene;
                choices = [...session.choices];
                stats = createFreshRunStats(runStats.hasReturnedViaMenu === true);
                stats.crown = Number(runStats.crown) || 0;
                stats.heart = Number(runStats.heart) || 0;
                stats.leaf = Number(runStats.leaf) || 0;
                stats.diamonds = Number.isFinite(Number(runStats.diamonds)) ? Number(runStats.diamonds) : 10;
                stats.relationships = {
                    ...stats.relationships,
                    ...(runStats.relationships && typeof runStats.relationships === 'object' ? runStats.relationships : {})
                };
                stats.appearance = typeof runStats.appearance === 'string' ? runStats.appearance : 'style1';
                applyProfileToStats();
                console.log('Прохождение beta_2 восстановлено:', { currentChapter, currentScene });
                return true;
            } catch (error) {
                console.error('Ошибка загрузки прохождения:', error);
                await deleteRun().catch(() => {});
                showErrorMessage(stats.language === "ru" ? 'Сохранение повреждено и удалено' : 'Saved game was corrupted and removed');
                return false;
            }
        }

               function showMessengerOverlay'''
)

# Completed game has no active run; only metaprogression survives.
sub(
    r"        function showEpilogue\(epilogueText\) \{.*?        \}\n\n\n\n     \nfunction checkCondition",
    '''        function showEpilogue(epilogueText) {
            const epilogueDiv = document.createElement('div');
            epilogueDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); color: white; display: flex; justify-content: center; align-items: center; text-align: center; padding: 20px; z-index: 10;';
            epilogueDiv.textContent = epilogueText;
            document.body.appendChild(epilogueDiv);
            setTimeout(async () => {
                epilogueDiv.remove();
                stats.completionCount++;
                await saveProfile();
                await deleteRun();
                resetGameState(false);
                showStartScreen();
            }, 5000);
        }



     
function checkCondition'''
)

# Gallery unlocks are profile progression and must survive reload/new run.
needle = "        stats.memories.push(card.id);\n\n        // Обновляем карточку в галерее"
if needle not in text:
    raise SystemExit('Gallery memory persistence insertion point not found')
text = text.replace(needle, "        stats.memories.push(card.id);\n        saveProfile();\n\n        // Обновляем карточку в галерее", 1)

# Stage invariants.
for forbidden in ["'gameSession'", "'last_session'", 'Telegram.WebApp', 'CloudStorage']:
    if forbidden in text:
        raise SystemExit(f'Forbidden legacy token remains: {forbidden}')
for required in ["STORAGE_NAMESPACE = 'heart_at_crossroads_beta2:v1:'", "RUN_STORAGE_KEY = 'run'", "PROFILE_STORAGE_KEY = 'profile'", 'async function deleteRun()', 'validateRunState(JSON.parse(rawSession))']:
    if required not in text:
        raise SystemExit(f'Required Stage 0C token missing: {required}')

out = text.replace('\n', '\r\n')
if out == raw:
    print('Stage 0C already applied')
    sys.exit(0)
path.write_bytes(out.encode('utf-8'))
print('Stage 0C applied')
