#!/usr/bin/env python3
import json, glob
for path in sorted(glob.glob('assets/data/chapter*.json')):
    data=json.load(open(path,encoding='utf-8'))
    for scene in data.get('scenes',[]):
        timed=[c for c in scene.get('choices',[]) if c.get('timer')]
        if timed:
            print(f"{path} scene={scene['id']}")
            print('  scene keys:', sorted(scene.keys()))
            print('  all choices:')
            for c in scene.get('choices',[]):
                print('   ', {k:c.get(k) for k in ('id','timer','nextScene','nextChapter','leadsToEnding','effects','text') if k in c})
