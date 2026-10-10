"""Run the approved comparison serially; no measured app overlaps another."""
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/performance-evidence'
env = {**os.environ, 'PLAYWRIGHT_MODULE': '/Users/toshonjennings/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js'}
baseline = 'release-build/performance-baseline/Perci.app'
candidate = 'release-build/performance-0.50.3-verified/mac-arm64/Perci.app'
phases = [
    ('baseline-final-v2', baseline, ['--runs', '3', '--idle-seconds', '60']),
    ('candidate-final-v2', candidate, ['--runs', '3', '--idle-seconds', '60', '--trace']),
    ('baseline-empty-final-v2', baseline, ['--runs', '3', '--idle-seconds', '60', '--empty']),
    ('candidate-empty-final-v2', candidate, ['--runs', '3', '--idle-seconds', '60', '--empty']),
    ('baseline-soak-final-v2', baseline, ['--runs', '1', '--idle-seconds', '300', '--soak-seconds', '1200', '--cycles']),
    ('candidate-soak-final-v2', candidate, ['--runs', '1', '--idle-seconds', '300', '--soak-seconds', '1200', '--cycles']),
]
# Coverage instrumentation would make timings incomparable. Keep it in the
# separate acceptance evidence, rather than either timed comparison.
phases[1][2].remove('--trace')
status = {'startedAt': datetime.now(timezone.utc).isoformat(), 'phases': []}
def save():
    (evidence / 'final-comparison-status.json').write_text(json.dumps(status, indent=2) + '\n')
for label, bundle, options in phases:
    phase = {'label': label, 'startedAt': datetime.now(timezone.utc).isoformat()}
    status['phases'].append(phase)
    save()
    command = ['node', 'scripts/measure-perci-performance.mjs', '--app', bundle, '--label', label, *options, '--allow-test-exit']
    phase['command'] = command
    print(f'START {label}', flush=True)
    with (evidence / f'{label}.txt').open('w') as log:
        completed = subprocess.run(command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    phase['exitCode'] = completed.returncode
    phase['finishedAt'] = datetime.now(timezone.utc).isoformat()
    save()
    print(f'END {label} exit={completed.returncode}', flush=True)
    if completed.returncode:
        raise SystemExit(completed.returncode)
status['finishedAt'] = datetime.now(timezone.utc).isoformat()
save()
