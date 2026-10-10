"""Hash review-scope repository files and exact measured/package artifacts."""
from pathlib import Path
import json, hashlib, subprocess, sys
root=Path(__file__).resolve().parents[2]
files=set(subprocess.check_output(['git','ls-files','-c','-o','--exclude-standard','-z'],cwd=root).decode().split('\0'))-{''}
files.add('HANDOFF.md')
records={}
for name in sorted(files):
 p=root/name
 if p.is_symlink():records[name]={'link':str(p.readlink())}
 elif p.is_file():records[name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 else:records[name]={'exists':p.exists()}
artifacts={}
for name in ['release-build/performance-0.50.4-accessible-final/mac-arm64/Perci.app/Contents/Resources/app.asar','release-build/performance-0.50.4-accessible-final/Perci-0.50.4-arm64.dmg','release-build/performance-0.50.4-final/mac-arm64/Perci.app/Contents/Resources/app.asar','release-build/performance-baseline/Perci.app/Contents/Resources/app.asar']:
 p=root/name;artifacts[name]=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else {'exists':p.exists()}
data={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'status':subprocess.check_output(['git','status','--porcelain=v1'],cwd=root,text=True),'files':records,'artifacts':artifacts,'scope':'Tracked and nonignored untracked files plus HANDOFF.md; four exact app/installer artifacts. Ignored build/dependency trees outside those artifacts are not recursively hashed.'}
output=root/'release-build'/('review-state-'+sys.argv[1]+'.json');output.write_text(json.dumps(data,sort_keys=True,indent=2)+'\n')
print(json.dumps({'path':str(output),'files':len(records),'digest':hashlib.sha256(output.read_bytes()).hexdigest()}))
