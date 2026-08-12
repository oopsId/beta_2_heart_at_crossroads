#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import sys

HTML = Path('heart_at_crossroads.html')
INDEX = Path('index.html')

BROWSER_STORAGE = '''        // Browser-only persistence (Stage 0B). Telegram CloudStorage was removed intentionally.\n        function saveToStorage(key, value) {\n            return new Promise((resolve, reject) => {\n                try {\n                    localStorage.setItem(key, value);\n                    console.log(`Сохранено в localStorage: ${key}`);\n                    resolve();\n                } catch (error) {\n                    console.error(`Ошибка сохранения в localStorage: ${key}`, error);\n                    reject(error);\n                }\n            });\n        }\n\n        function getFromStorage(key) {\n            return new Promise((resolve, reject) => {\n                try {\n                    const value = localStorage.getItem(key);\n                    console.log(`Получено из localStorage: ${key}`);\n                    resolve(value);\n                } catch (error) {\n                    console.error(`Ошибка чтения localStorage: ${key}`, error);\n                    reject(error);\n                }\n            });\n        }\n\n        function removeFromStorage(key) {\n            return new Promise((resolve, reject) => {\n                try {\n                    localStorage.removeItem(key);\n                    console.log(`Удалено из localStorage: ${key}`);\n                    resolve();\n                } catch (error) {\n                    console.error(`Ошибка удаления из localStorage: ${key}`, error);\n                    reject(error);\n                }\n            });\n        }\n\n'''

INDEX_CONTENT = '''<!DOCTYPE html>\n<html lang="ru">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Сердце на перекрёстке — beta_2</title>\n    <meta http-equiv="refresh" content="0; url=heart_at_crossroads.html">\n</head>\n<body>\n    <p><a href="heart_at_crossroads.html">Открыть игру</a></p>\n    <script>location.replace('heart_at_crossroads.html' + location.search + location.hash);</script>\n</body>\n</html>\n'''


def transform(text: str) -> str:
    # Stage 0A: browser-native relative base. Every former repo-root URL resolves
    # against the current deployment directory (GitHub Pages, localhost, PWA scope).
    if '<base href="./">' not in text:
        viewport = '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        if viewport not in text:
            raise RuntimeError('viewport marker not found; refusing blind base-tag insertion')
        text = text.replace(viewport, viewport + '    <base href="./">\n', 1)

    # Convert the old repository-specific root to paths resolved by <base href="./">.
    text = text.replace('/heart_at_crossroads/', '')

    # Stage 0B: remove Telegram runtime dependency.
    text = re.sub(
        r'\s*<script\s+src=["\']https://telegram\.org/js/telegram-web-app\.js["\']></script>\s*',
        '\n',
        text,
        count=1,
    )

    # Remove Telegram environment detection/init and userId. Keep the game state declaration.
    tg_start = text.find('         // Проверка Telegram')
    if tg_start == -1:
        tg_start = text.find('        // Проверка Telegram')
    if tg_start != -1:
        tg_end = text.find('        let currentChapter = 1;', tg_start)
        if tg_end == -1:
            raise RuntimeError('Telegram block end marker not found')
        text = (
            text[:tg_start]
            + '        // Stage 0B: browser is the only supported runtime.\n'
            + '        // Desktop, mobile browser and a future PWA use the same engine.\n'
            + text[tg_end:]
        )

    # Replace Telegram/local/memory adapter with one explicit browser storage adapter.
    storage_start = text.find('        // Улучшенные функции хранения')
    if storage_start != -1:
        storage_end = text.find('        function saveSession()', storage_start)
        if storage_end == -1:
            raise RuntimeError('saveSession marker not found after storage block')
        text = text[:storage_start] + BROWSER_STORAGE + text[storage_end:]

    # Remove Telegram user authorization. Password gate remains a local beta gate.
    auth_start = text.find('        async function checkAuthorization()')
    if auth_start != -1:
        auth_end = text.find('        async function checkTempPassword', auth_start)
        if auth_end == -1:
            raise RuntimeError('checkTempPassword marker not found after checkAuthorization')
        text = text[:auth_start] + text[auth_end:]

    auth_users_pattern = re.compile(
        r'''\s*if \(inputPassword === correctPassword\) \{\s*'''
        r'''let authorizedUsers = JSON\.parse\(await getFromStorage\('authorized_users'\) \|\| '\[\]'\);\s*'''
        r'''if \(userId && !authorizedUsers\.includes\(userId\)\) \{\s*'''
        r'''authorizedUsers\.push\(userId\);\s*'''
        r'''await saveToStorage\('authorized_users', JSON\.stringify\(authorizedUsers\)\);\s*'''
        r'''\}\s*stats\.isAuthorized = true;\s*\}''',
        re.MULTILINE,
    )
    text, replaced = auth_users_pattern.subn(
        "\n                        if (inputPassword === correctPassword) {\n"
        "                            stats.isAuthorized = true;\n"
        "                        }",
        text,
        count=1,
    )

    # Direct password form grants the same local access token as prompt-based access.
    direct_gate = '                    if (inputPassword === tempPassword || inputPassword === correctPassword) {\n'
    if direct_gate in text and "await saveToStorage('tempAccessGranted', true);\n                        if (inputPassword === correctPassword)" not in text:
        text = text.replace(
            direct_gate,
            direct_gate + "                        await saveToStorage('tempAccessGranted', true);\n",
            1,
        )

    # Startup no longer performs Telegram-user authorization.
    text = text.replace('else checkAuthorization();', 'else showStartScreen();')

    return text


def verify(text: str) -> list[str]:
    problems = []
    required = [
        '<base href="./">',
        'Browser-only persistence (Stage 0B)',
        'localStorage.setItem(key, value)',
        'localStorage.getItem(key)',
    ]
    for needle in required:
        if needle not in text:
            problems.append(f'missing required marker: {needle}')

    forbidden = [
        '/heart_at_crossroads/',
        'telegram.org/js/telegram-web-app.js',
        'window.Telegram',
        'Telegram.WebApp',
        'CloudStorage',
        'const isTelegram',
        'let isTelegram',
        'const userId',
        'authorized_users',
        'checkAuthorization()',
    ]
    for needle in forbidden:
        if needle in text:
            problems.append(f'forbidden Stage 0A/0B runtime marker remains: {needle}')

    # Do not forbid the word Telegram itself: it legitimately appears in story/dialogue text.
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='verify idempotence and invariants without writing')
    args = parser.parse_args()

    original = HTML.read_text(encoding='utf-8')
    migrated = transform(original)
    problems = verify(migrated)

    if args.check and migrated != original:
        problems.append('migration is not fully applied/idempotent')

    if problems:
        for p in problems:
            print(f'ERROR: {p}', file=sys.stderr)
        return 1

    if not args.check:
        if migrated != original:
            HTML.write_text(migrated, encoding='utf-8')
            print('updated heart_at_crossroads.html')
        else:
            print('heart_at_crossroads.html already normalized')
        if not INDEX.exists() or INDEX.read_text(encoding='utf-8') != INDEX_CONTENT:
            INDEX.write_text(INDEX_CONTENT, encoding='utf-8')
            print('updated index.html')

    print('Stage 0A/0B invariants: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
