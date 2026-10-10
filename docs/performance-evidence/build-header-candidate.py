"""Wait for the existing baseline fixture, then export/build the current candidate."""
from pathlib import Path
import hashlib
import json
import os
import signal
import subprocess
import time
root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/performance-evidence'
measurement = evidence / 'baseline-soak-final-v2/measurement.json'
while True:
    data = json.loads(measurement.read_text())
    run = data['runs'][0]
    state = subprocess.run(['ps', '-p', '52659', '-o', 'stat='], capture_output=True, text=True).stdout.strip()
    if run.get('processExit') and (not state or state.startswith('Z')):
        assert not data.get('failure')
        assert run['samples'][-1]['elapsedMs'] >= data['protocol']['idleMs'] + data['protocol']['soakMs']
        break
    time.sleep(5)
coordinator = subprocess.run(['ps', '-p', '47449', '-o', 'command='], capture_output=True, text=True).stdout
if 'docs/performance-evidence/run-final-comparison.py' in coordinator:
    os.kill(47449, signal.SIGINT)
    os.kill(47449, signal.SIGCONT)
print('Completed baseline retained; obsolete paused test coordinator retired.', flush=True)
export = root / 'release-build/performance-clean-0.50.4'
export.mkdir(exist_ok=False)
archive = subprocess.check_output(['git', 'archive', 'HEAD'], cwd=root)
subprocess.run(['tar', '-xf', '-', '-C', str(export)], input=archive, check=True)
manifest = json.loads((evidence / 'candidate-source.json').read_text())
files = manifest['overlaidFiles'] + ['src/components/ModeSwitcher.jsx']
for name in files:
    target = export / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((root / name).read_bytes())
manifest.update(export=str(export), baseCommit=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(), overlaidFiles=files)
manifest['overlaidSHA256'] = {name: hashlib.sha256((export/name).read_bytes()).hexdigest() for name in files}
manifest['ownedSHA256'] = manifest['overlaidSHA256'].copy()
(evidence / 'candidate-source-0.50.4.json').write_text(json.dumps(manifest, indent=2)+'\n')
steps = [
    ('candidate-install-0.50.4.txt', ['npm', 'ci']),
    ('candidate-keysafe-0.50.4.txt', ['npm', 'run', 'build:keysafe']),
    ('candidate-build-0.50.4.txt', ['npm', 'run', 'build']),
    ('candidate-package-0.50.4.txt', ['npx', 'electron-builder', '--mac', 'dmg', '--arm64', '--publish', 'never', '--config.directories.output='+str(root/'release-build/performance-0.50.4-verified')]),
]
for logname, command in steps:
    print('START '+logname, flush=True)
    with (evidence/logname).open('w') as log:
        subprocess.run(command, cwd=export, stdout=log, stderr=subprocess.STDOUT, check=True, env={**os.environ, 'CSC_IDENTITY_AUTO_DISCOVERY': 'false'})
    print('END '+logname, flush=True)
print('Candidate packaged; DMG Finder repair and verification remain.', flush=True)
