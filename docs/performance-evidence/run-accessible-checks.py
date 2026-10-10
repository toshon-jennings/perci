from pathlib import Path
import os, subprocess
root=Path(__file__).resolve().parents[2]
evidence=root/'docs/performance-evidence'
env={**os.environ,'PLAYWRIGHT_MODULE':'/Users/toshonjennings/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js'}
app='release-build/performance-0.50.4-accessible-final/mac-arm64/Perci.app'
export='release-build/performance-clean-0.50.4-accessible-final'
for label,options in [
 ('header-0-50-4-accessible-final',['--runs','1','--idle-seconds','0','--acceptance','--header-only']),
 ('candidate-0-50-4-accessible-final',['--runs','3','--idle-seconds','60']),
 ('candidate-empty-0-50-4-accessible-final',['--runs','3','--idle-seconds','60','--empty']),
 ('trace-baseline-empty',['--runs','1','--idle-seconds','0','--empty','--trace','--startup-trace']),
 ('trace-accessible-final-empty',['--runs','1','--idle-seconds','0','--empty','--trace','--startup-trace']),
]:
    command=['node','scripts/measure-perci-performance.mjs','--app','release-build/performance-baseline/Perci.app' if label.startswith('trace-baseline') else app,'--source-export',export,'--label',label,*options,'--allow-test-exit']
    print('START '+label,flush=True)
    with (evidence/(label+'.txt')).open('w') as log: completed=subprocess.run(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
    print('END '+label+' exit='+str(completed.returncode),flush=True)
    if completed.returncode: raise SystemExit(completed.returncode)
