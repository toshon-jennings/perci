"""Build the color-only final candidate after the existing measured process exits."""
from pathlib import Path
import hashlib, json, os, subprocess, time, sys
variant=sys.argv[1] if len(sys.argv)>1 else "accessible"
root=Path(__file__).resolve().parents[2]
evidence=root/'docs/performance-evidence'
while True:
    status=json.loads((evidence/'comparison-0.50.4-status.json').read_text())
    if status.get('finishedAt'):
        assert all(p['exitCode']==0 for p in status['phases'])
        break
    time.sleep(5)
export=root/('release-build/performance-clean-0.50.4-'+variant)
export.mkdir(exist_ok=False)
archive=subprocess.check_output(['git','archive','HEAD'],cwd=root)
subprocess.run(['tar','-xf','-','-C',str(export)],input=archive,check=True)
manifest=json.loads((evidence/'candidate-source-0.50.4.json').read_text())
for name in manifest['overlaidFiles']:
    target=export/name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes((root/name).read_bytes())
manifest.update(export=str(export),baseCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip())
manifest['overlaidSHA256']={name:hashlib.sha256((export/name).read_bytes()).hexdigest() for name in manifest['overlaidFiles']}
manifest['ownedSHA256']=manifest['overlaidSHA256'].copy()
manifest['dependencyReuse']='Exact npm-ci locked tree from performance-clean-0.50.4 via symlink; npmRebuild false.'
(evidence/('candidate-source-0.50.4-'+variant+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
(export/'node_modules').symlink_to(root/'release-build/performance-clean-0.50.4/node_modules',target_is_directory=True)
for label, command in [
 ('keysafe',['npm','run','build:keysafe']),
 ('build',['npm','run','build']),
 ('package',['npx','electron-builder','--mac','dmg','--arm64','--publish','never','--config.npmRebuild=false','--config.directories.output='+str(root/('release-build/performance-0.50.4-'+variant))]),
]:
    print('START '+label,flush=True)
    with (evidence/('candidate-'+label+'-0.50.4-'+variant+'.txt')).open('w') as log:
        subprocess.run(command,cwd=export,stdout=log,stderr=subprocess.STDOUT,check=True,env={**os.environ,'CSC_IDENTITY_AUTO_DISCOVERY':'false'})
    print('END '+label,flush=True)
