#!/usr/bin/env python3
import json
from reachability import ENDING_PROJECTIONS, explore, load_chapters
EXPECTED_CHOICES={'dima':'freedom_with_dima','mark':'silence_with_mark','sergey':'summit_with_sergey','vika':'friendship_above_all','alone':'lonely_path','premium':'new_start'}
def level(e,s):
 if e=='freedom_with_dima': return 'strong' if s.get('dima',0)>=2 and s.get('heart',0)>=12 else ('mixed' if s.get('dima',0)>=1 or s.get('heart',0)>=10 else 'impulsive')
 if e=='silence_with_mark': return 'strong' if s.get('mark',0)>=3 and (s.get('heart',0)>=10 or s.get('leaf',0)>=8) else ('mixed' if s.get('mark',0)>=1 or s.get('heart',0)>=8 or s.get('leaf',0)>=6 else 'impulsive')
 if e=='summit_with_sergey': return 'strong' if s.get('sergey',0)>=2 and s.get('crown',0)>=4 else ('mixed' if s.get('sergey',0)>=1 or s.get('crown',0)>=3 else 'impulsive')
 if e=='friendship_above_all': return 'strong' if s.get('vika',0)>=1 and s.get('leaf',0)>=10 else ('mixed' if s.get('vika',0)>=0 or s.get('leaf',0)>=7 else 'impulsive')
 if e=='lonely_path':
  c,h,l=s.get('crown',0),s.get('heart',0),s.get('leaf',0);return 'strong' if c>=5 and c+3>=h and c+3>=l else ('mixed' if c>=4 else 'impulsive')
 if e=='new_start': return 'intentional'
 raise ValueError(e)
def main():
 chapters=load_chapters();scene5=next((s for s in chapters[10].get('scenes',[]) if s.get('id')==5),None)
 if not scene5: raise SystemExit('chapter10 scene5 missing')
 choices={c.get('id'):c for c in scene5.get('choices',[]) if isinstance(c,dict)}
 for cid,eid in EXPECTED_CHOICES.items():
  if not choices.get(cid) or choices[cid].get('endingId')!=eid: raise SystemExit(f'bad final mapping: {cid}->{eid}')
 if len({c.get('endingId') for c in choices.values() if c.get('endingId')})!=6: raise SystemExit('final choice mapping must contain six unique endings')
 if 'cost' in choices['premium']: raise SystemExit('new_start must remain free')
 report={}
 for ending,(stats,rels) in ENDING_PROJECTIONS.items():
  _,rows=explore(chapters,stats,rels);cols=list(stats)+list(rels);counts={}
  for row in rows:
   k=level(ending,dict(zip(cols,row)));counts[k]=counts.get(k,0)+1
  total=len(rows)
  if ending!='new_start' and counts.get('strong',0)==0: raise SystemExit(f'{ending}: strong route unreachable')
  report[ending]={'projectedStates':total,'userFacingAvailabilityPercent':100.0,'routeStrength':{k:{'states':v,'percent':round(v/total*100,2)} for k,v in sorted(counts.items())}}
 print(json.dumps({'status':'PASS','endings':report},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
