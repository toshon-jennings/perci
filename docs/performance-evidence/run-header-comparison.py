"""Compare final 0.50.4 against already-completed baseline-v2, with serial native runs."""
import json, os, subprocess
from pathlib import Path
from datetime import datetime, timezone
root=Path(__file__).resolve().parents[2]
evidence=root/'docs/performance-evidence'
env={**os.environ,'PLAYWRIGHT_MODULE':'/Users/toshonjennings/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js'}
app='release-build/performance-0.50.4-final/mac-arm64/Perci.app'
phases=[
 ('candidate-0-50-4-final',['--runs','3','--idle-seconds','60']),
 ('candidate-empty-0-50-4-final',['--runs','3','--idle-seconds','60','--empty']),
 ('candidate-soak-0-50-4-final',['--runs','1','--idle-seconds','300','--soak-seconds','1200','--cycles']),
]
status={'startedAt':datetime.now(timezone.utc).isoformat(),'baselineLabels':['baseline-final-v2','baseline-empty-final-v2','baseline-soak-final-v2'],'phases':[]}
def save(): (evidence/'comparison-0.50.4-status.json').write_text(json.dumps(status,indent=2)+'\n')
for label, options in phases:
 command=['node','scripts/measure-perci-performance.mjs','--app',app,'--label',label,*options,'--allow-test-exit']
 phase={'label':label,'startedAt':datetime.now(timezone.utc).isoformat(),'command':command};status['phases'].append(phase);save()
 print('START '+label,flush=True)
 with (evidence/(label+'.txt')).open('w') as log: completed=subprocess.run(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 phase.update(exitCode=completed.returncode,finishedAt=datetime.now(timezone.utc).isoformat());save()
 print('END '+label+' exit='+str(completed.returncode),flush=True)
 if completed.returncode:raise SystemExit(completed.returncode)
status['finishedAt']=datetime.now(timezone.utc).isoformat();save()
