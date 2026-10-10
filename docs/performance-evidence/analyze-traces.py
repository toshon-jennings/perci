"""Inspect overlapping native reload events and observed per-process CPU costs."""
from pathlib import Path
from urllib.parse import urlparse
import json, statistics
root=Path(__file__).resolve().parent
out={'caveat':'One instrumented hydration reload per artifact after bootstrap. Caches may be warm; overlapping event durations do not establish cold parse time or explain a 3-run timing difference causally.','traces':{},'timedCPU':{}}
for label in ['trace-baseline-empty','trace-accessible-final-empty']:
 d=json.loads((root/label/'measurement.json').read_text());r=d['runs'][0];raw=json.loads((root/label/'startup-trace-0.json').read_text());scripts={}
 for event in raw['traceEvents']:
  if event.get('ph')!='X' or event.get('name')!='EvaluateScript': continue
  url=event.get('args',{}).get('data',{}).get('url','unattributed');name=Path(urlparse(url).path).name or url
  group=scripts.setdefault(name,{'count':0,'summedDurationMs':0});group['count']+=1;group['summedDurationMs']+=event.get('dur',0)/1000
 selected={}
 parses=[]
 for event in raw['traceEvents']:
  if event.get('ph')!='X':continue
  if event['name'] in ['v8.evaluateModule','UpdateLayoutTree','Paint','Layerize']:
   group=selected.setdefault(event['name'],{'count':0,'summedDurationMs':0});group['count']+=1;group['summedDurationMs']+=event.get('dur',0)/1000
  if event['name']=='v8.parseOnBackground':parses.append({'script':Path(urlparse(event.get('args',{}).get('data',{}).get('url','')).path).name,'durationMs':event.get('dur',0)/1000})
 out['traces'][label]={'additionalEvents':selected,'moduleParseEvents':sorted(parses,key=lambda x:x['durationMs'],reverse=True),'artifactSHA256':d['artifactSHA256'],'shellHydrationMs':r['shellUsableMs'],'timings':r['startupTrace']['timings'],'largestEvaluateScript':sorted([{'script':n,**v} for n,v in scripts.items()],key=lambda x:x['summedDurationMs'],reverse=True)[:8]}
for label in ['baseline-final-v2','baseline-empty-final-v2','candidate-0-50-4-accessible-final','candidate-empty-0-50-4-accessible-final']:
 d=json.loads((root/label/'measurement.json').read_text());groups={}
 for r in d['runs']:
  sample={}
  for p in r['samples'][0]['processes']: sample[p['type']]=sample.get(p['type'],0)+p['cpu']['percentCPUUsage']
  for n,v in sample.items():groups.setdefault(n,[]).append(v)
 out['timedCPU'][label]={n:{'median':statistics.median(v),'values':v} for n,v in groups.items()}
(root/'reload-trace-analysis.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
