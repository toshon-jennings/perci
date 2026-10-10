"""Summarize comparable records; preserve raw footprint and CPU intervals."""
import json
import argparse
from pathlib import Path
import re
import statistics
root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--candidate-version', choices=['0.50.3', '0.50.4'], default='0.50.4')
parser.add_argument('--accessible', action='store_true')
options = parser.parse_args()
version = options.candidate_version
suffix = '-final-v2' if version == '0.50.3' else '-0-50-4-final'
if options.accessible: suffix = '-0-50-4-accessible-final'
labels = ['baseline-final-v2', 'candidate'+suffix, 'baseline-empty-final-v2', 'candidate-empty'+suffix, 'baseline-soak-final-v2', 'candidate-soak'+suffix]
if options.accessible: labels[-1] = 'candidate-soak-0-50-4-final' # Unchanged lifecycle code; color-only final artifact differs.
def footprint(sample):
    match = re.search(r'Summary Footprint:\s*([\d.]+)\s*(KB|MB|GB)', sample['footprint'])
    if not match:
        raise ValueError('Footprint unavailable; do not treat an error as zero')
    return float(match[1]) * {'KB': 1/1024, 'MB': 1, 'GB': 1024}[match[2]]
def cpu(sample):
    return sum(p['cpu']['percentCPUUsage'] for p in sample['processes'])
def spread(values):
    return {'median': statistics.median(values), 'min': min(values), 'max': max(values), 'values': values}
summary = {'method': 'Serial identical synthetic backend fixtures; macOS Summary Footprint MB, summed primed Electron CPU percentages. Shell timing measures fixture hydration reload, not end-to-end cold launch or backend readiness.', 'labels': {}}
for label in labels:
    path = root / label / 'measurement.json'
    if not path.exists():
        summary['labels'][label] = {'status': 'pending'}
        continue
    data = json.loads(path.read_text())
    samples = [r['samples'][0] for r in data['runs'] if r['samples']]
    item = {'artifactSHA256': data['artifactSHA256'], 'version': samples[0]['version'] if samples else None, 'sampledRuns': len(samples), 'complete': len(samples) == data['protocol']['repetitions'] and not data.get('failure')}
    if samples:
        item.update(footprintMB=spread([footprint(s) for s in samples]), cpuPercent=spread([cpu(s) for s in samples]), shellHydrationMs=spread([r['shellUsableMs'] for r in data['runs'] if r['samples']]), guests=[s['guests'] for s in samples])
    if 'soak' in label and data['runs']:
        run = data['runs'][0]
        post_warm = run['samples'][4:] # Idle sample and cycles 1-3 excluded.
        series = [{'elapsedMs': s['elapsedMs'], 'cycle': i, 'footprintMB': footprint(s), 'cpuPercent': cpu(s)} for i, s in enumerate(run['samples'])]
        item['series'] = series
        item['completedCycles'] = run.get('completedCycles', 0)
        if len(post_warm) >= 6:
            times = [s['elapsedMs']/60000 for s in post_warm]
            values = [footprint(s) for s in post_warm]
            tx, vy = statistics.mean(times), statistics.mean(values)
            slope = sum((t-tx)*(v-vy) for t,v in zip(times,values))/sum((t-tx)**2 for t in times)
            item['postWarmup'] = {'samples': len(values), 'firstThreeMedianMB': statistics.median(values[:3]), 'lastThreeMedianMB': statistics.median(values[-3:]), 'slopeMBPerMinute': slope, 'cpuPercent': spread([cpu(s) for s in post_warm])}
        item['complete'] = bool(run.get('processExit')) and run['samples'][-1]['elapsedMs'] >= data['protocol']['idleMs'] + data['protocol']['soakMs'] and not data.get('failure')
    summary['labels'][label] = item
for name, base, candidate in [('restored', labels[0], labels[1]), ('empty', labels[2], labels[3])]:
    a,b = summary['labels'][base],summary['labels'][candidate]
    if a.get('complete') and b.get('complete'):
        summary[name] = {key: {'baselineMedian': a[key]['median'], 'candidateMedian': b[key]['median'], 'reductionPercent': 100*(1-b[key]['median']/a[key]['median']) if a[key]['median'] else None} for key in ['footprintMB', 'cpuPercent', 'shellHydrationMs']}
(root/('comparison-summary-'+version+('-accessible' if options.accessible else '')+'.json')).write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k != 'labels'}, indent=2))
print(json.dumps({k:{a:v.get(a) for a in ['complete','sampledRuns','completedCycles','postWarmup']} for k,v in summary['labels'].items()}, indent=2))
