#!/usr/bin/env python3
import glob, json
found=[]
for path in glob.glob('assets/data/chapter*.json'):
    data=json.load(open(path,encoding='utf-8'))
    chapter=data['chapter']
    for scene in data['scenes']:
        for choice in scene.get('choices',[]):
            assert 'timer' not in choice, f'{path} scene {scene["id"]}: legacy choice.timer remains'
        timeout=scene.get('timeout')
        if timeout is None:
            continue
        assert isinstance(timeout,dict), f'{path} scene {scene["id"]}: timeout must be object'
        assert isinstance(timeout.get('seconds'),(int,float)) and timeout['seconds']>0
        has_choice=isinstance(timeout.get('choiceId'),str)
        has_outcome=isinstance(timeout.get('outcome'),dict)
        assert has_choice ^ has_outcome, f'{path} scene {scene["id"]}: timeout must define exactly one mode'
        if has_choice:
            ids={c.get('id') for c in scene.get('choices',[])}
            assert timeout['choiceId'] in ids, f'{path} scene {scene["id"]}: timeout choice missing'
            mode=timeout['choiceId']
        else:
            outcome=timeout['outcome']
            assert isinstance(outcome.get('id'),str) and outcome['id']
            has_route=(isinstance(outcome.get('nextScene'),int) or isinstance(outcome.get('nextChapter'),int) or outcome.get('nextChapter') is True or isinstance(outcome.get('leadsToEnding'),str))
            assert has_route, f'{path} scene {scene["id"]}: timeout outcome has no route'
            mode=outcome['id']
        found.append((chapter,scene['id'],mode))
expected=[(1,7,'ignore'),(1,21,'ignore'),(2,1,'no_reply'),(3,1,'ignore'),(3,10,'ignore'),(6,6,'ignore')]
assert sorted(found)==expected, (found, expected)
html=open('heart_at_crossroads.html',encoding='utf-8').read()
for required in ('function getTimeoutConfig(scene)', 'async function applyTimeoutOutcome(scene, timeoutConfig'):
    assert required in html, required
for forbidden in ("find(c => c.id === 'ignore')", '.some(c => c.timer)', 'timeoutMs = 10000'):
    assert forbidden not in html, forbidden
print('Stage 0E validator PASS', found)
