#!/usr/bin/env python3
import json, re, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'heart_at_crossroads.html'
DATA = ROOT / 'assets' / 'data'

findings=[]
def add(sev, code, title, evidence, impact, location=''):
    findings.append(dict(severity=sev, code=code, title=title, evidence=evidence, impact=impact, location=location))

html = HTML.read_text(encoding='utf-8')
chapters={}
for n in range(1,11):
    p=DATA/f'chapter{n}.json'
    try:
        chapters[n]=json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        add('P0','DATA_JSON',f'chapter{n}.json cannot be parsed',str(e),'Chapter cannot run.',str(p.relative_to(ROOT)))
finals=json.loads((DATA/'finals.json').read_text(encoding='utf-8'))
ending_ids={e['id'] for e in finals.get('endings',[])}

# Core storage contract
save_keys=re.findall(r"saveToStorage\(\s*['\"]([^'\"]+)",html)
load_keys=re.findall(r"getFromStorage\(\s*['\"]([^'\"]+)",html)
if 'gameSession' in save_keys and 'last_session' in load_keys:
    add('P0','SAVE_KEY_MISMATCH','Save and load use different storage keys',
        "saveSession writes 'gameSession'; loadSession/startup read 'last_session'.",
        'Continue cannot restore the state that saveSession writes.','heart_at_crossroads.html')
if re.search(r"const\s+sessionData\s*=\s*JSON\.stringify",html) and re.search(r"const\s+session\s*=\s*await\s+getFromStorage\('last_session'\)",html) and 'JSON.parse(session)' not in html:
    add('P0','SAVE_PARSE_MISMATCH','Serialized session is consumed as an object',
        'saveSession JSON.stringify()s state; loadSession dereferences session.currentChapter/currentScene without JSON.parse().',
        'Even if the key mismatch is fixed alone, restored fields become undefined/corrupt.','heart_at_crossroads.html')

# Intentional menu reset - record, do not flag
menu_reset_intent = bool(re.search(r"function\s+handleMenu[\s\S]{0,500}?resetGameState\(\)[\s\S]{0,200}?saveSession\(\)",html))

# beta2 isolation
hardcoded=len(re.findall(r"/heart_at_crossroads/",html))
if hardcoded:
    add('P0','BASE_PATH_COUPLING','Runtime is hard-coupled to the original repository path',
        f'Found {hardcoded} literal /heart_at_crossroads/ path occurrences in the runtime HTML.',
        'beta_2 can load original JSON/assets or fail under its own GitHub Pages base path; tests can silently exercise the wrong build.','heart_at_crossroads.html')

# External runtime dependencies
for url in re.findall(r'<script[^>]+src=["\']([^"\']+)',html):
    if url.startswith('http'):
        add('P2','EXTERNAL_SCRIPT','External script is required at runtime',url,'Offline/CDN failure can degrade or break features.','heart_at_crossroads.html')

# duplicate gesture handlers on mutating controls
if "['click', 'touchstart']" in html or "['touchstart', 'click']" in html:
    add('P1','DUAL_INPUT_EVENTS','State-changing UI binds touchstart and click separately',
        'addEventListeners() is repeatedly called with both click and touchstart; choice buttons also bind both.',
        'Some WebViews/devices can dispatch both events and double-apply transitions, costs or effects.','heart_at_crossroads.html')

# Async save not returned/awaited
m=re.search(r"function\s+saveSession\(\)\s*\{([\s\S]*?)\n\s*\}",html)
if m and 'return saveToStorage' not in m.group(1):
    add('P0','SAVE_NOT_AWAITABLE','saveSession does not return its persistence promise',
        'saveSession starts saveToStorage(...).then(...) but returns undefined.',
        'Callers cannot serialize persistence; multiple state writes can race in Telegram CloudStorage.','heart_at_crossroads.html')

# loadChapter start ignores false
if re.search(r"await\s+loadChapter\(currentChapter\);[\s\S]{0,700}?showScene\(currentScene\)",html):
    add('P0','START_LOAD_FAILURE_CONTINUES','startGame continues after a failed chapter load',
        'loadChapter returns false on fetch/JSON failure, but startGame ignores the return value and calls showScene.',
        'A missing/corrupt chapter can cascade into null/stale scriptData runtime failure.','heart_at_crossroads.html')

# Game graph/data validation
asset_refs=[]
condition_re=re.compile(r'^([A-Za-z0-9_.]+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+)$')
valid_stat_roots={'crown','heart','leaf','diamonds','completionCount','appearance','isAuthorized','memories','language','hasReturnedViaMenu'}

for ch, data in chapters.items():
    scenes=data.get('scenes',[])
    ids=[s.get('id') for s in scenes]
    idset=set(ids)
    if len(ids)!=len(idset): add('P0','DUP_SCENE_ID',f'Chapter {ch} has duplicate scene IDs',str(ids),'Scene lookup by id is ambiguous.',f'assets/data/chapter{ch}.json')
    if idset and idset != set(range(len(scenes))):
        add('P1','SCENE_ID_INDEX_ASSUMPTION',f'Chapter {ch} scene IDs are not exactly 0..N-1',f'ids={sorted(idset)} N={len(scenes)}','Runtime compares sceneId to scenes.length-1 and uses sceneId+1 fallback.',f'assets/data/chapter{ch}.json')
    for s in scenes:
        sid=s.get('id')
        for fld in ('text','speaker'):
            obj=s.get(fld)
            if obj is not None and isinstance(obj,dict) and not {'ru','en'}.issubset(obj):
                add('P1','I18N_MISSING',f'Chapter {ch} scene {sid} missing RU/EN in {fld}',str(obj.keys()),'Runtime indexes by selected language and can render undefined.',f'assets/data/chapter{ch}.json')
        if isinstance(s.get('second_playthrough_text'),dict) and not {'ru','en'}.issubset(s['second_playthrough_text']):
            add('P1','I18N_SECOND_MISSING',f'Chapter {ch} scene {sid} second-playthrough text incomplete',str(s['second_playthrough_text'].keys()),'Second playthrough can render undefined.',f'assets/data/chapter{ch}.json')
        bg=s.get('background')
        if bg and bg!='none': asset_refs.append((f'assets/backgrounds/{bg}.png',ch,sid,'background'))
        for cf in ('characterLeft','characterRight'):
            c=s.get(cf)
            if c:
                if '${stats.appearance}' in c:
                    for style in ('style1','style2','style3'):
                        cc=c.replace('${stats.appearance}',style); asset_refs.append((f"assets/characters/{cc.split('_')[0]}/{cc}.png",ch,sid,cf))
                else: asset_refs.append((f"assets/characters/{c.split('_')[0]}/{c}.png",ch,sid,cf))
        for sf in ('sound','music'):
            a=s.get(sf)
            if a:
                name=a if re.search(r'\.(mp3|wav|ogg|m4a)$',a,re.I) else a+'.mp3'
                asset_refs.append((f'assets/sounds/{name}',ch,sid,sf))
        ns=s.get('nextScene')
        if ns is not None and ns not in idset:
            add('P0','BROKEN_NEXT_SCENE',f'Chapter {ch} scene {sid} points to missing scene {ns}',repr(ns),'Player can hit a dead transition.',f'assets/data/chapter{ch}.json')
        for c in s.get('choices',[]) or []:
            nid=c.get('nextScene')
            if nid is not None and nid not in idset:
                add('P0','BROKEN_CHOICE_NEXT',f'Chapter {ch} scene {sid} choice {c.get("id")} points to missing scene {nid}',repr(nid),'Choice can dead-end the run.',f'assets/data/chapter{ch}.json')
            nch=c.get('nextChapter')
            if nch is not None and nch not in chapters:
                add('P0','BROKEN_NEXT_CHAPTER',f'Chapter {ch} scene {sid} choice points to missing chapter {nch}',repr(nch),'Choice cannot continue.',f'assets/data/chapter{ch}.json')
            end=c.get('leadsToEnding')
            if end:
                mapping={'Свобода с Димой':'freedom_with_dima','Тишина с Марком':'silence_with_mark','Вершина с Сергеем':'summit_with_sergey','Дружба превыше всего':'friendship_above_all','Одинокий путь':'lonely_path','Новый старт':'new_start'}
                norm=mapping.get(end,end)
                if norm not in ending_ids:
                    add('P0','UNKNOWN_ENDING',f'Chapter {ch} scene {sid} choice references unknown ending',end,'Final transition cannot resolve.',f'assets/data/chapter{ch}.json')
            cond=c.get('condition')
            if cond and not condition_re.match(cond):
                add('P1','UNSUPPORTED_CHOICE_CONDITION',f'Chapter {ch} scene {sid} has condition runtime parser cannot understand',cond,'Choice visibility can be wrong.',f'assets/data/chapter{ch}.json')
            eff=c.get('effects') or {}
            for k,v in eff.items():
                if not (k in valid_stat_roots or k=='relationships' or k.startswith('relationships.')):
                    add('P1','UNKNOWN_EFFECT_KEY',f'Chapter {ch} scene {sid} choice {c.get("id")} writes unknown stat key',k,'saveChoice silently creates new state fields; typos become gameplay bugs.',f'assets/data/chapter{ch}.json')
        timed=[c for c in s.get('choices',[]) or [] if c.get('timer')]
        if timed and not any(c.get('id')=='ignore' for c in s.get('choices',[]) or []):
            add('P0','TIMED_NO_DEFAULT',f'Chapter {ch} scene {sid} has timed choices but no id=ignore default','showSceneWithTimer hardcodes default choice id=ignore.','Timeout can stall or fall through incorrectly.',f'assets/data/chapter{ch}.json')

# Asset existence
missing=[]
for rel,ch,sid,kind in asset_refs:
    if not (ROOT/rel).exists(): missing.append((rel,ch,sid,kind))
for rel,ch,sid,kind in missing:
    add('P1','MISSING_ASSET',f'Missing {kind} asset',rel,f'Chapter {ch} scene {sid} renders with a missing resource.',f'assets/data/chapter{ch}.json')

# Finals
for e in finals.get('endings',[]):
    eid=e.get('id')
    req=e.get('requirements') or {}
    for k,v in req.items():
        if isinstance(v,str):
            if not re.match(r'^>\s*-?\d+\s*$',v):
                add('P0','UNSUPPORTED_ENDING_REQUIREMENT',f'Ending {eid} has requirement parser cannot evaluate',f'{k}: {v}','checkRequirements uses parseInt after >; expressions become NaN and ending is unreachable.','assets/data/finals.json')
        elif not isinstance(v,(int,float)):
            add('P0','BAD_ENDING_REQUIREMENT',f'Ending {eid} requirement has unsupported type',repr(v),'Ending gate is unreliable.','assets/data/finals.json')
    for s in e.get('scenes',[]):
        bg=s.get('background')
        if bg and not (ROOT/f'assets/backgrounds/{bg}.png').exists(): add('P1','MISSING_ENDING_ASSET',f'Ending {eid} missing background',bg,'Ending renders incorrectly.','assets/data/finals.json')
        for cf in ('characterLeft','characterRight'):
            c=s.get(cf)
            if c and not (ROOT/f"assets/characters/{c.split('_')[0]}/{c}.png").exists(): add('P1','MISSING_ENDING_ASSET',f'Ending {eid} missing character',c,'Ending renders incorrectly.','assets/data/finals.json')
        for sf in ('sound','music'):
            a=s.get(sf)
            if a:
                name=a if re.search(r'\.(mp3|wav|ogg|m4a)$',a,re.I) else a+'.mp3'
                if not (ROOT/f'assets/sounds/{name}').exists(): add('P1','MISSING_ENDING_ASSET',f'Ending {eid} missing {sf}',name,'Ending audio fails.','assets/data/finals.json')

# Final-choice persistence contract
if 'window.pendingEndingId' in html and 'pendingEndingId' not in re.search(r"JSON\.stringify\(\{([\s\S]*?)\}\)",html).group(1):
    add('P0','ENDING_NOT_PERSISTED','Selected ending is kept only in window.pendingEndingId','saveSession serializes currentScene/currentChapter/stats/choices but not pendingEndingId.','Reloading after chapter 10 choice can lose which ending was selected and route incorrectly.','heart_at_crossroads.html')

# second playthrough/gallery mismatch
if 'stats.playthroughs > 1' in html and 'playthroughs:' not in html:
    add('P1','PLAYTHROUGH_COUNTER_MISMATCH','Gallery checks a nonexistent playthrough counter','unlockCard uses stats.playthroughs > 1; state defines/increments completionCount instead.','Second-playthrough cards can never unlock through that rule.','heart_at_crossroads.html')

# gallery persistence
unlock_match=re.search(r"function\s+unlockCard\([\s\S]*?\n\}",html)
if unlock_match and 'saveSession' not in unlock_match.group(0) and 'saveToStorage' not in unlock_match.group(0):
    add('P1','GALLERY_UNLOCK_NOT_SAVED','unlockCard mutates memories/diamonds without persisting','No saveSession/saveToStorage call in unlockCard.','Unlocked cards/currency changes may vanish on reload.','heart_at_crossroads.html')

# preload ignores chapter ID structurally
pre=re.search(r"async\s+function\s+preloadAssets\(chapterId[\s\S]*?\n\s*}\n\n\s*async\s+function\s+loadChapter",html)
if pre and re.search(r'const\s+images\s*=\s*\[',pre.group(0)) and 'chapterId' not in pre.group(0).split('const images =',1)[1]:
    add('P1','PRELOAD_GLOBAL_LIST','preloadAssets ignores chapterId for resource selection','A fixed global image array is loaded for every chapter.','Large startup cost and manual asset list drift; not a state-machine blocker but a runtime retention risk.','heart_at_crossroads.html')

# summarize
order={'P0':0,'P1':1,'P2':2,'P3':3}
findings.sort(key=lambda x:(order.get(x['severity'],9),x['code'],x['title']))
summary={s:sum(1 for f in findings if f['severity']==s) for s in ('P0','P1','P2','P3')}
report={'repository':'oopsId/beta_2_heart_at_crossroads','menu_reset_intentional':menu_reset_intent,'hardcoded_original_path_occurrences':hardcoded,'chapters_loaded':len(chapters),'endings':sorted(ending_ids),'summary':summary,'findings':findings}
Path('audit-results').mkdir(exist_ok=True)
Path('audit-results/static-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
with open('audit-results/static-audit.md','w',encoding='utf-8') as out:
    out.write('# Static runtime integrity audit\n\n')
    out.write(f"Summary: {summary}\n\n")
    out.write(f"Menu reset intentional invariant detected: {menu_reset_intent}\n\n")
    for f in findings:
        out.write(f"## {f['severity']} {f['code']}: {f['title']}\n\nEvidence: {f['evidence']}\n\nImpact: {f['impact']}\n\nLocation: {f['location']}\n\n")
print(json.dumps(summary))
for f in findings:
    print(f"{f['severity']} {f['code']}: {f['title']}")
