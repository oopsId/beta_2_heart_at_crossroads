#!/usr/bin/env python3
import json,re
from pathlib import Path
from collections import defaultdict,Counter
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'assets'/'data'; HTML=ROOT/'heart_at_crossroads.html'
html=HTML.read_text(encoding='utf-8'); findings=[]
def add(sev,code,title,evidence,impact,loc=''):
    findings.append({'severity':sev,'code':code,'title':title,'evidence':evidence,'impact':impact,'location':loc})
chapters={n:json.loads((DATA/f'chapter{n}.json').read_text(encoding='utf-8')) for n in range(1,11)}
finals=json.loads((DATA/'finals.json').read_text(encoding='utf-8'))

# Definite sibling-branch bleed caused by runtime implicit sceneId+1 fallback.
for ch,data in chapters.items():
    scenes=data['scenes']; byid={s['id']:s for s in scenes}; last=len(scenes)-1
    for source in scenes:
        choices=source.get('choices') or []
        targets={c.get('nextScene') for c in choices if c.get('nextScene') is not None}
        if len(targets)<2: continue
        for target in sorted(targets):
            s=byid.get(target)
            if not s: continue
            terminalish=(s.get('nextScene') is None and not (s.get('choices') or []) and not s.get('leadsToEnding'))
            if terminalish and target!=last:
                implicit=target+1
                if implicit in targets:
                    add('P0','BRANCH_BLEED',f'Chapter {ch}: branch result {target} falls into sibling branch {implicit}',
                        f'source scene {source["id"]} choices target {sorted(targets)}; target {target} has nextScene=null, so showScene fallback advances to {implicit}.',
                        'Mutually exclusive choice outcomes can be shown sequentially, corrupting narrative causality.',f'assets/data/chapter{ch}.json')
                else:
                    add('P1','IMPLICIT_BRANCH_FALLTHROUGH',f'Chapter {ch}: choice target {target} implicitly advances to {implicit}',
                        f'source scene {source["id"]}; target scene has nextScene=null and is not final scene.',
                        'If null was intended to end/rejoin the branch, runtime instead advances by numeric scene ID.',f'assets/data/chapter{ch}.json')

# Timed choices: runtime hardcodes id=ignore on timeout.
for ch,data in chapters.items():
    for s in data['scenes']:
        choices=s.get('choices') or []; timed=[c for c in choices if c.get('timer')]
        if timed:
            ignores=[c for c in choices if c.get('id')=='ignore']
            if not ignores:
                add('P0','TIMED_TIMEOUT_NO_ROUTE',f'Chapter {ch} scene {s["id"]}: timeout has no route',
                    'showSceneWithTimer searches only for a choice with id="ignore"; this scene has none.',
                    'When countdown expires, the time limit is not resolved into a game transition.',f'assets/data/chapter{ch}.json')
            elif any((c.get('effects') or c.get('cost') or c.get('memoryTag')) for c in ignores):
                add('P1','TIMED_DEFAULT_BYPASSES_CHOICE_PIPELINE',f'Chapter {ch} scene {s["id"]}: timeout default has state effects',
                    str(ignores[0]),'Timer timeout transitions directly and does not run normal saveChoice/effects/cost logic.',f'assets/data/chapter{ch}.json')

# Memory tags placed inside effects are treated as arithmetic state fields, not memories.
nested=[]; top=[]
for ch,data in chapters.items():
    for s in data['scenes']:
        for c in s.get('choices') or []:
            if 'memoryTag' in (c.get('effects') or {}): nested.append((ch,s['id'],c.get('id'),c['effects']['memoryTag']))
            if c.get('memoryTag') is not None: top.append((ch,s['id'],c.get('id'),c['memoryTag']))
if nested:
    add('P1','MEMORY_TAG_SCHEMA_MISMATCH','Memory tags are nested under effects but runtime expects choice.memoryTag',
        f'{len(nested)} nested tags; examples: {nested[:6]}; top-level tags found: {len(top)}.',
        'These tags are not appended to stats.memories; saveChoice instead creates/concatenates a bogus stats.memoryTag field.','assets/data/*.json')

# Relationship schema spelling drift.
canonical={'mark','lera','vika','sergey','anna','dima','lesha'}; used=Counter()
for ch,data in chapters.items():
    for s in data['scenes']:
        for c in s.get('choices') or []:
            for k in (c.get('effects') or {}):
                if k.startswith('relationships.'):
                    used[k.split('.',1)[1]]+=1
            cond=c.get('condition') or ''
            m=re.match(r'relationships\.([A-Za-z0-9_]+)',cond)
            if m: used[m.group(1)]+=1
unknown=sorted(k for k in used if k not in canonical)
if unknown:
    add('P1','RELATIONSHIP_KEY_DRIFT','Relationship effects use keys absent from initial relationship schema',
        f'canonical={sorted(canonical)}; extra={unknown}; counts={dict(used)}.',
        'Runtime silently creates parallel relationship counters; UI/conditions reading canonical keys can stay at zero.','assets/data/*.json')

# Preload coverage vs visuals referenced by chapters.
pre=re.search(r'async\s+function\s+preloadAssets\(chapterId[\s\S]*?const\s+images\s*=\s*\[([\s\S]*?)\];',html)
preloaded=set(re.findall(r"['\"](/heart_at_crossroads/assets/(?:backgrounds|characters)/[^'\"]+)['\"]",pre.group(1) if pre else ''))
used_visual=set()
for data in chapters.values():
    for s in data['scenes']:
        bg=s.get('background')
        if bg and bg!='none': used_visual.add(f'/heart_at_crossroads/assets/backgrounds/{bg}.png')
        for cf in ('characterLeft','characterRight'):
            c=s.get(cf)
            if c and '${stats.appearance}' not in c: used_visual.add(f"/heart_at_crossroads/assets/characters/{c.split('_')[0]}/{c}.png")
missing_pre=sorted(used_visual-preloaded)
if missing_pre:
    add('P1','PRELOAD_COVERAGE_DRIFT','Story uses visual assets missing from manual preload list',
        f'{len(missing_pre)} used visuals are not preloaded; sample={missing_pre[:20]}.',
        'First appearance can load late/flicker; manual preload inventory is already out of sync with story data.','heart_at_crossroads.html')

# Gallery hardcoded wrong texture path.
if '/assets/images/shoebox_texture.png' in html and (ROOT/'assets/backgrounds/shoebox_texture.png').exists() and not (ROOT/'assets/images/shoebox_texture.png').exists():
    add('P1','GALLERY_TEXTURE_PATH','Gallery detail close restores a nonexistent texture path',
        'Code uses assets/images/shoebox_texture.png; repository contains assets/backgrounds/shoebox_texture.png.',
        'Gallery background breaks after closing card detail.','heart_at_crossroads.html')

# CloudStorage contract misuse: official Telegram API is callback-based; source assumes .then/.catch.
if re.search(r'CloudStorage\.setItem\([^\n]+\)\s*\.then\(',html) or re.search(r'CloudStorage\.getItem\([^\n]+\)\s*\.then\(',html):
    add('P0','TELEGRAM_CLOUDSTORAGE_API_MISUSE','Telegram CloudStorage is treated as Promise-based',
        'saveToStorage/getFromStorage call CloudStorage.setItem/getItem and then chain .then/.catch.',
        'Official WebApp CloudStorage methods are callback-based and return the CloudStorage object; actual Telegram persistence/readback is unreliable or broken.','heart_at_crossroads.html')

# Menu is intentionally destructive, but runtime work is not cancelled on exit.
menu_body=re.search(r'function\s+handleMenu\(e\)\s*\{([\s\S]*?)\n\s*\}',html)
if menu_body:
    body=menu_body.group(1)
    cancellation_terms=('clearTimeout','clearInterval','typeTimer','currentMusic','pendingEndingId','removeEventListener')
    if not any(t in body for t in cancellation_terms):
        add('P0','MENU_RESET_DOES_NOT_CANCEL_RUNTIME','Intentional destructive menu exit does not cancel active scene runtime',
            'handleMenu resets state and hides game, but does not cancel typewriter timers, timed-choice timeouts/intervals, overlays or music.',
            'Callbacks from the abandoned run can fire after reset and mutate the fresh state/start screen, defeating the intended clean-slate behavior.','heart_at_crossroads.html')

# Chapter boundary transition is not saved immediately.
if re.search(r'const\s+goToNextChapter\s*=\s*\(\)\s*=>\s*\{[\s\S]*?currentChapter\+\+[\s\S]*?loadChapter\(currentChapter\)',html):
    m=re.search(r'const\s+goToNextChapter\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};',html)
    if m and 'saveSession' not in m.group(1):
        add('P1','CHAPTER_BOUNDARY_NOT_SAVED','Automatic next-chapter transition is not persisted immediately',
            'goToNextChapter increments currentChapter/currentScene and loads the new chapter without saveSession().',
            'Reload/crash at chapter boundary can resume at the previous terminal scene.','heart_at_crossroads.html')

# Data results.
order={'P0':0,'P1':1,'P2':2}; findings.sort(key=lambda f:(order.get(f['severity'],9),f['code'],f['title']))
summary={s:sum(f['severity']==s for f in findings) for s in ('P0','P1','P2')}
out={'summary':summary,'findings':findings,'nestedMemoryTags':nested,'relationshipKeys':dict(used),'preloadMissingCount':len(missing_pre),'preloadMissing':missing_pre}
Path('audit-results').mkdir(exist_ok=True)
(Path('audit-results')/'graph-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
with (Path('audit-results')/'graph-audit.md').open('w',encoding='utf-8') as fp:
    fp.write(f'# Graph/state-model audit\n\nSummary: {summary}\n\n')
    for f in findings: fp.write(f"## {f['severity']} {f['code']}: {f['title']}\n\nEvidence: {f['evidence']}\n\nImpact: {f['impact']}\n\nLocation: {f['location']}\n\n")
print(summary)
for f in findings: print(f"{f['severity']} {f['code']}: {f['title']}")
