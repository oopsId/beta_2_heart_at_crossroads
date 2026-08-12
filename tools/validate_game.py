#!/usr/bin/env python3
"""Permanent structural/runtime validator for beta_2 Heart at the Crossroads.

P0/errors fail CI. Known data-cleanup debt is reported as warnings so Stage 0H
can protect the stabilized engine without pretending Stage 0I is already done.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "assets" / "data"
HTML_PATH = ROOT / "heart_at_crossroads.html"

CANONICAL_RELATIONSHIPS = {"mark", "lera", "vika", "sergey", "anna", "dima", "lyosha"}
PERSONALITY_STATS = {"crown", "heart", "leaf"}
AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a"}
VISUAL_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
CONDITION_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_.]*)\s*(>=|<=|==|!=|>|<)\s*(-?\d+)$")

issues: list[dict] = []
chapters: dict[int, dict] = {}
finals: dict = {}


def add(severity: str, code: str, location: str, message: str) -> None:
    issues.append({"severity": severity, "code": code, "location": location, "message": message})


def error(code: str, location: str, message: str) -> None:
    add("error", code, location, message)


def warn(code: str, location: str, message: str) -> None:
    add("warning", code, location, message)


def load_json(path: Path, label: str):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        error("JSON_PARSE", label, f"cannot parse JSON: {exc}")
        return None


def has_lang_pair(value) -> bool:
    return isinstance(value, dict) and isinstance(value.get("ru"), str) and isinstance(value.get("en"), str)


def check_lang_pair(value, location: str, field: str, required: bool = True) -> None:
    if value is None and not required:
        return
    if not has_lang_pair(value):
        error("LOCALIZATION", location, f"{field} must contain string ru/en values")


def audio_path(name: str) -> Path:
    p = Path(name)
    filename = name if p.suffix.lower() in AUDIO_EXTS else f"{name}.mp3"
    return ROOT / "assets" / "sounds" / filename


def check_audio(name, location: str, field: str) -> None:
    if not isinstance(name, str) or not name:
        return
    path = audio_path(name)
    if not path.exists():
        warn("MISSING_AUDIO", location, f"{field} references missing {path.relative_to(ROOT)}")


def resolve_character_path(name: str) -> Path:
    rendered = name.replace("${stats.appearance}", "style1")
    folder = rendered.split("_")[0]
    return ROOT / "assets" / "characters" / folder / f"{rendered}.png"


def check_visuals(obj: dict, location: str) -> None:
    bg = obj.get("background")
    if isinstance(bg, str) and bg and bg != "none":
        path = ROOT / "assets" / "backgrounds" / f"{bg}.png"
        if not path.exists():
            error("MISSING_VISUAL", location, f"missing background {path.relative_to(ROOT)}")

    for key in ("characterLeft", "characterRight"):
        char = obj.get(key)
        if isinstance(char, str) and char:
            path = resolve_character_path(char)
            if not path.exists():
                error("MISSING_VISUAL", location, f"missing {key} {path.relative_to(ROOT)}")

    check_audio(obj.get("sound"), location, "sound")
    check_audio(obj.get("music"), location, "music")


def check_effects(effects, location: str) -> None:
    if effects is None:
        return
    if not isinstance(effects, dict):
        error("EFFECTS_SCHEMA", location, "effects must be an object")
        return

    for key, value in effects.items():
        if key == "memoryTag":
            warn("NESTED_MEMORY_TAG", location, "memoryTag is nested inside effects; runtime expects it beside effects")
            continue
        if key in PERSONALITY_STATS or key == "diamonds":
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                error("EFFECT_VALUE", location, f"effect {key} must be numeric")
            continue
        if key == "relationships":
            if not isinstance(value, dict):
                error("RELATIONSHIP_EFFECT", location, "relationships effect must be an object")
                continue
            for rel, delta in value.items():
                if rel not in CANONICAL_RELATIONSHIPS:
                    warn("RELATIONSHIP_DRIFT", location, f"unknown relationship id relationships.{rel}")
                if not isinstance(delta, (int, float)) or isinstance(delta, bool):
                    error("RELATIONSHIP_EFFECT", location, f"relationships.{rel} delta must be numeric")
            continue
        if key.startswith("relationships."):
            rel = key.split(".", 1)[1]
            if rel not in CANONICAL_RELATIONSHIPS:
                warn("RELATIONSHIP_DRIFT", location, f"unknown relationship id {key}")
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                error("RELATIONSHIP_EFFECT", location, f"{key} delta must be numeric")
            continue
        warn("UNKNOWN_EFFECT", location, f"unknown effect key {key}")


def route_fields(obj: dict) -> list[str]:
    found = []
    if "nextScene" in obj:
        found.append("nextScene")
    if "nextChapter" in obj:
        found.append("nextChapter")
    if obj.get("leadsToEnding") is not None:
        found.append("leadsToEnding")
    return found


def validate_route(obj: dict, chapter_id: int, scene_ids: set[int], ending_ids: set[str], location: str, *, allow_none: bool) -> None:
    fields = route_fields(obj)
    # nextScene:null is itself an explicit terminal route.
    if len(fields) > 1:
        error("AMBIGUOUS_ROUTE", location, f"multiple route fields present: {', '.join(fields)}")

    if "nextScene" in obj:
        value = obj.get("nextScene")
        if value is not None and type(value) is not int:
            error("NEXT_SCENE_SCHEMA", location, "nextScene must be integer or null")
        elif type(value) is int and value not in scene_ids:
            error("BROKEN_SCENE_REF", location, f"nextScene {value} does not exist in chapter {chapter_id}")

    if "nextChapter" in obj:
        value = obj.get("nextChapter")
        if value is not True and type(value) is not int:
            error("NEXT_CHAPTER_SCHEMA", location, "nextChapter must be true or integer")
        else:
            target = chapter_id + 1 if value is True else value
            if not (1 <= target <= 10):
                error("BROKEN_CHAPTER_REF", location, f"nextChapter resolves to invalid chapter {target}")

    if obj.get("leadsToEnding") is not None:
        ending = obj.get("leadsToEnding")
        if not isinstance(ending, str) or ending not in ending_ids:
            error("BROKEN_ENDING_REF", location, f"unknown ending {ending!r}")

    if not fields and not allow_none:
        error("MISSING_ROUTE", location, "choice/outcome has no explicit route")


def validate_timeout(scene: dict, chapter_id: int, scene_ids: set[int], ending_ids: set[str], location: str) -> None:
    if "timeout" not in scene:
        return
    timeout = scene.get("timeout")
    if not isinstance(timeout, dict):
        error("TIMEOUT_SCHEMA", location, "timeout must be an object")
        return
    seconds = timeout.get("seconds")
    if not isinstance(seconds, (int, float)) or isinstance(seconds, bool) or seconds <= 0:
        error("TIMEOUT_SCHEMA", location, "timeout.seconds must be positive")

    modes = int(isinstance(timeout.get("choiceId"), str) and bool(timeout.get("choiceId"))) + int(isinstance(timeout.get("outcome"), dict))
    if modes != 1:
        error("TIMEOUT_SCHEMA", location, "timeout must define exactly one of choiceId or outcome")
        return

    if isinstance(timeout.get("choiceId"), str):
        choice_ids = {choice.get("id") for choice in scene.get("choices", []) if isinstance(choice, dict)}
        if timeout["choiceId"] not in choice_ids:
            error("TIMEOUT_TARGET", location, f"timeout.choiceId {timeout['choiceId']!r} is not a scene choice")
    else:
        outcome = timeout["outcome"]
        if not isinstance(outcome.get("id"), str) or not outcome.get("id"):
            error("TIMEOUT_SCHEMA", location, "timeout.outcome.id must be a non-empty string")
        check_effects(outcome.get("effects"), f"{location}.timeout.outcome")
        validate_route(outcome, chapter_id, scene_ids, ending_ids, f"{location}.timeout.outcome", allow_none=False)


def route_target(obj: dict, chapter_id: int, scene_ids: set[int], ending_ids: set[str]):
    value = obj.get("nextScene") if "nextScene" in obj else "__missing__"
    if type(value) is int:
        return (chapter_id, value)
    if "nextChapter" in obj:
        nxt = obj.get("nextChapter")
        target = chapter_id + 1 if nxt is True else nxt
        return (target, 0) if type(target) is int and 1 <= target <= 10 else None
    ending = obj.get("leadsToEnding")
    if isinstance(ending, str) and ending in ending_ids:
        return ("ending", ending)
    if value is None:
        return (chapter_id + 1, 0) if chapter_id < 10 else None
    return None


def validate_final_data() -> set[str]:
    global finals
    finals = load_json(DATA / "finals.json", "finals.json") or {}
    endings = finals.get("endings")
    if not isinstance(endings, list) or not endings:
        error("FINALS_SCHEMA", "finals.json", "endings must be a non-empty array")
        return set()

    ids: list[str] = []
    for index, ending in enumerate(endings):
        loc = f"finals[{index}]"
        if not isinstance(ending, dict):
            error("FINALS_SCHEMA", loc, "ending must be an object")
            continue
        eid = ending.get("id")
        if not isinstance(eid, str) or not eid:
            error("ENDING_ID", loc, "ending id must be a non-empty string")
            continue
        ids.append(eid)
        check_lang_pair(ending.get("title"), loc, "title")
        check_lang_pair(ending.get("epilogue"), loc, "epilogue")
        scenes = ending.get("scenes")
        if not isinstance(scenes, list) or not scenes:
            error("ENDING_SCENES", loc, "ending must contain at least one scene")
        else:
            for sidx, scene in enumerate(scenes):
                sloc = f"{loc}.scenes[{sidx}]"
                if not isinstance(scene, dict):
                    error("ENDING_SCENE_SCHEMA", sloc, "scene must be an object")
                    continue
                check_lang_pair(scene.get("text"), sloc, "text")
                check_lang_pair(scene.get("speaker"), sloc, "speaker", required=False)
                if scene.get("second_playthrough_text") is not None:
                    check_lang_pair(scene.get("second_playthrough_text"), sloc, "second_playthrough_text")
                check_visuals(scene, sloc)

        legacy = ending.get("legacyRequirements")
        if isinstance(legacy, dict):
            for key, value in legacy.items():
                if isinstance(value, str):
                    warn("LEGACY_REQUIREMENT_EXPRESSION", loc, f"historical requirement {key}: {value!r} is metadata only")

    duplicates = sorted({eid for eid in ids if ids.count(eid) > 1})
    for eid in duplicates:
        error("DUPLICATE_ENDING", "finals.json", f"duplicate ending id {eid}")

    if not any(isinstance(e, dict) and "requirements" in e for e in endings):
        warn("ENDING_ELIGIBILITY_DISABLED", "finals.json", "no executable ending requirements are present; Stage 0F legacyRequirements are metadata only")
    return set(ids)


def validate_chapters(ending_ids: set[str]) -> None:
    for chapter_id in range(1, 11):
        path = DATA / f"chapter{chapter_id}.json"
        data = load_json(path, f"chapter{chapter_id}.json")
        if not isinstance(data, dict):
            continue
        chapters[chapter_id] = data
        scenes = data.get("scenes")
        if not isinstance(scenes, list) or not scenes:
            error("CHAPTER_SCHEMA", f"chapter{chapter_id}", "scenes must be a non-empty array")
            continue

        ids = [s.get("id") for s in scenes if isinstance(s, dict)]
        scene_ids = {value for value in ids if type(value) is int}
        if 0 not in scene_ids:
            error("CHAPTER_ENTRY", f"chapter{chapter_id}", "scene 0 is missing")
        if len(scene_ids) != len([value for value in ids if type(value) is int]):
            error("DUPLICATE_SCENE", f"chapter{chapter_id}", "duplicate integer scene ids")

        last_id = scenes[-1].get("id") if isinstance(scenes[-1], dict) else None
        for index, scene in enumerate(scenes):
            loc = f"chapter{chapter_id}.scene[{scene.get('id') if isinstance(scene, dict) else index}]"
            if not isinstance(scene, dict):
                error("SCENE_SCHEMA", loc, "scene must be an object")
                continue
            if type(scene.get("id")) is not int:
                error("SCENE_ID", loc, "scene id must be integer")
            check_lang_pair(scene.get("text"), loc, "text")
            check_lang_pair(scene.get("speaker"), loc, "speaker", required=False)
            if scene.get("second_playthrough_text") is not None:
                check_lang_pair(scene.get("second_playthrough_text"), loc, "second_playthrough_text")
            check_visuals(scene, loc)
            check_effects(scene.get("effects"), loc)

            choices = scene.get("choices")
            if choices is not None and not isinstance(choices, list):
                error("CHOICES_SCHEMA", loc, "choices must be an array")
                choices = []
            choices = choices or []
            choice_ids: list[str] = []
            for cidx, choice in enumerate(choices):
                cloc = f"{loc}.choice[{cidx}]"
                if not isinstance(choice, dict):
                    error("CHOICE_SCHEMA", cloc, "choice must be an object")
                    continue
                cid = choice.get("id")
                if not isinstance(cid, str) or not cid:
                    error("CHOICE_ID", cloc, "choice id must be a non-empty string")
                else:
                    choice_ids.append(cid)
                check_lang_pair(choice.get("text"), cloc, "text")
                check_effects(choice.get("effects"), cloc)
                if choice.get("memoryTag") is not None and not isinstance(choice.get("memoryTag"), str):
                    error("MEMORY_TAG", cloc, "memoryTag must be a string")
                condition = choice.get("condition")
                if condition is not None and (not isinstance(condition, str) or not CONDITION_RE.match(condition.strip())):
                    warn("CONDITION_SYNTAX", cloc, f"condition is outside current simple runtime grammar: {condition!r}")
                cost = choice.get("cost")
                if cost is not None and (not isinstance(cost, (int, float)) or isinstance(cost, bool) or cost < 0):
                    error("CHOICE_COST", cloc, "cost must be a non-negative number")
                validate_route(choice, chapter_id, scene_ids, ending_ids, cloc, allow_none=False)

            duplicates = sorted({cid for cid in choice_ids if choice_ids.count(cid) > 1})
            for cid in duplicates:
                error("DUPLICATE_CHOICE", loc, f"duplicate choice id {cid}")

            validate_timeout(scene, chapter_id, scene_ids, ending_ids, loc)
            validate_route(scene, chapter_id, scene_ids, ending_ids, loc, allow_none=True)

            if not choices:
                fields = route_fields(scene)
                if not fields:
                    if scene.get("id") == last_id:
                        if chapter_id == 10:
                            error("DEAD_END", loc, "last scene of chapter 10 has no ending route")
                    elif type(scene.get("id")) is int and scene.get("id") + 1 in scene_ids:
                        warn("LEGACY_IMPLICIT_NEXT", loc, f"runtime still relies on omitted nextScene -> {scene.get('id') + 1}")
                    else:
                        error("DEAD_END", loc, "scene has no choices and no resolvable route")


def validate_graph(ending_ids: set[str]) -> None:
    if not chapters or 1 not in chapters:
        return
    edges: dict[tuple, set[tuple]] = defaultdict(set)
    all_nodes: set[tuple] = set()

    for chapter_id, data in chapters.items():
        scenes = data.get("scenes", [])
        scene_ids = {s.get("id") for s in scenes if isinstance(s, dict) and type(s.get("id")) is int}
        last_id = scenes[-1].get("id") if scenes and isinstance(scenes[-1], dict) else None
        for scene in scenes:
            if not isinstance(scene, dict) or type(scene.get("id")) is not int:
                continue
            node = (chapter_id, scene["id"])
            all_nodes.add(node)
            choices = scene.get("choices") if isinstance(scene.get("choices"), list) else []
            if choices:
                for choice in choices:
                    if isinstance(choice, dict):
                        target = route_target(choice, chapter_id, scene_ids, ending_ids)
                        if target:
                            edges[node].add(target)
                timeout = scene.get("timeout")
                if isinstance(timeout, dict) and isinstance(timeout.get("outcome"), dict):
                    target = route_target(timeout["outcome"], chapter_id, scene_ids, ending_ids)
                    if target:
                        edges[node].add(target)
            else:
                target = route_target(scene, chapter_id, scene_ids, ending_ids)
                if target:
                    edges[node].add(target)
                elif scene["id"] == last_id and chapter_id < 10:
                    edges[node].add((chapter_id + 1, 0))
                elif "nextScene" not in scene and scene["id"] + 1 in scene_ids:
                    edges[node].add((chapter_id, scene["id"] + 1))

    start = (1, 0)
    seen = {start}
    q = deque([start])
    while q:
        node = q.popleft()
        for target in edges.get(node, ()):
            if target[0] == "ending":
                seen.add(target)
                continue
            if target in all_nodes and target not in seen:
                seen.add(target)
                q.append(target)

    unreachable = sorted(all_nodes - seen)
    for node in unreachable:
        warn("UNREACHABLE_SCENE", f"chapter{node[0]}.scene[{node[1]}]", "scene is not reachable from chapter 1 / scene 0 under structural graph traversal")

    reached_endings = {node[1] for node in seen if isinstance(node, tuple) and len(node) == 2 and node[0] == "ending"}
    for ending_id in sorted(ending_ids - reached_endings):
        error("UNREACHABLE_ENDING", f"ending:{ending_id}", "ending has no structural path from the start")


def validate_runtime_html() -> None:
    try:
        html = HTML_PATH.read_text(encoding="utf-8")
    except Exception as exc:
        error("HTML_READ", "heart_at_crossroads.html", str(exc))
        return

    forbidden = {
        "/heart_at_crossroads/": "beta_2 must not request the original repo namespace",
        "telegram-web-app.js": "Telegram runtime must remain removed",
        "Telegram.WebApp": "Telegram runtime must remain removed",
        "CloudStorage": "Telegram storage must remain removed",
        "window.pendingEndingId": "ending ownership must remain data-driven",
        "gameSession": "legacy save key must remain removed",
        "last_session": "legacy save key must remain removed",
    }
    for needle, message in forbidden.items():
        if needle in html:
            error("RUNTIME_REGRESSION", "heart_at_crossroads.html", f"{message}: found {needle!r}")

    required = [
        "heart_at_crossroads_beta2:v1:",
        "function beginRuntimeSession(",
        "function invalidateRuntimeSession(",
        "function cancelRuntimeTasks()",
        "async function transitionTo(",
        "async function applyChoice(",
        "function getTimeoutConfig(",
        "async function applyTimeoutOutcome(",
        "async function loadFinals(",
        "function isRunCurrent(",
    ]
    for needle in required:
        if needle not in html:
            error("RUNTIME_INVARIANT", "heart_at_crossroads.html", f"missing required stabilized runtime marker {needle!r}")

    if "find(c => c.id === 'ignore')" in html or 'find(c => c.id === "ignore")' in html:
        error("TIMEOUT_MAGIC", "heart_at_crossroads.html", "hard-coded ignore timeout fallback returned")
    if re.search(r"function\s+checkRequirements\s*\(", html):
        error("ENDING_REGRESSION", "heart_at_crossroads.html", "obsolete post-selection ending rejection gate returned")

    # Literal assets in runtime code: visual misses are hard failures; audio debt stays warnings.
    asset_re = re.compile(r"assets/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg|mp3|wav|ogg|m4a)", re.I)
    for ref in sorted(set(asset_re.findall(html))):
        path = ROOT / ref
        if path.exists():
            continue
        ext = path.suffix.lower()
        if ext in AUDIO_EXTS:
            warn("MISSING_AUDIO", "heart_at_crossroads.html", f"literal runtime audio missing: {ref}")
        elif ext in VISUAL_EXTS:
            error("MISSING_VISUAL", "heart_at_crossroads.html", f"literal runtime visual missing: {ref}")


def validate_stage0f_mapping(ending_ids: set[str]) -> None:
    data = chapters.get(10)
    if not data:
        return
    scenes = {s.get("id"): s for s in data.get("scenes", []) if isinstance(s, dict)}
    expected = {
        6: "freedom_with_dima",
        7: "silence_with_mark",
        8: "summit_with_sergey",
        9: "friendship_above_all",
        10: "lonely_path",
        11: "new_start",
    }
    for scene_id, ending_id in expected.items():
        scene = scenes.get(scene_id)
        if not scene:
            error("ENDING_MAPPING", f"chapter10.scene[{scene_id}]", "terminal ending scene missing")
        elif scene.get("leadsToEnding") != ending_id:
            error("ENDING_MAPPING", f"chapter10.scene[{scene_id}]", f"expected leadsToEnding={ending_id!r}")
        elif ending_id not in ending_ids:
            error("ENDING_MAPPING", f"chapter10.scene[{scene_id}]", f"mapped ending {ending_id!r} not in finals.json")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", help="optional JSON report path")
    args = parser.parse_args()

    ending_ids = validate_final_data()
    validate_chapters(ending_ids)
    validate_graph(ending_ids)
    validate_runtime_html()
    validate_stage0f_mapping(ending_ids)

    errors = [item for item in issues if item["severity"] == "error"]
    warnings = [item for item in issues if item["severity"] == "warning"]

    report = {
        "status": "FAIL" if errors else "PASS",
        "summary": {
            "chaptersLoaded": len(chapters),
            "endings": len(ending_ids),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        "issues": issues,
    }
    if args.report:
        out = Path(args.report)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    for item in issues:
        prefix = "ERROR" if item["severity"] == "error" else "WARN "
        print(f"{prefix} [{item['code']}] {item['location']}: {item['message']}")
    print(f"Stage 0H structural validator: {report['status']}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
