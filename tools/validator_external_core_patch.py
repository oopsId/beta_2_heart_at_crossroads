from pathlib import Path
p=Path('tools/validate_game.py')
s=p.read_text(encoding='utf-8')
anchor='    forbidden = {\n'
insert='''    core_path = ROOT / "assets" / "js" / "core-runtime.js"\n    if "assets/js/core-runtime.js" not in html:\n        error("RUNTIME_INVARIANT", "heart_at_crossroads.html", "external core runtime include is missing")\n    try:\n        core_runtime = core_path.read_text(encoding="utf-8")\n    except Exception as exc:\n        error("RUNTIME_READ", "assets/js/core-runtime.js", str(exc))\n        core_runtime = ""\n    runtime_source = html + "\\n" + core_runtime\n\n'''
if insert not in s:
    s=s.replace(anchor,insert+anchor,1)
s=s.replace('if needle in html:\n            error("RUNTIME_REGRESSION"','if needle in runtime_source:\n            error("RUNTIME_REGRESSION"',1)
s=s.replace('if needle not in html:\n            error("RUNTIME_INVARIANT"','if needle not in runtime_source:\n            error("RUNTIME_INVARIANT"',1)
s=s.replace('if "find(c => c.id === \'ignore\')" in html or \'find(c => c.id === "ignore")\' in html:','if "find(c => c.id === \'ignore\')" in runtime_source or \'find(c => c.id === "ignore")\' in runtime_source:',1)
s=s.replace('if re.search(r"function\\s+checkRequirements\\s*\\(", html):','if re.search(r"function\\s+checkRequirements\\s*\\(", runtime_source):',1)
s=s.replace('for ref in sorted(set(asset_re.findall(html))):','for ref in sorted(set(asset_re.findall(runtime_source))):',1)
p.write_text(s,encoding='utf-8')
