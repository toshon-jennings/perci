"""Preserve the original image and adapt electron-builder's root PNG for Finder repair."""
from pathlib import Path
import plistlib
import subprocess
import shutil
import os
import sys
root=Path(__file__).resolve().parents[2]
folder=root/(sys.argv[1] if len(sys.argv)>1 else 'release-build/performance-0.50.4-final')
image=folder/'Perci-0.50.4-arm64.dmg'
shutil.copy2(image,folder/'Perci-0.50.4-arm64.unstyled.dmg')
writable=folder/'Perci-style-repair.dmg'
subprocess.run(['hdiutil','convert',str(image),'-format','UDRW','-o',str(writable)],check=True)
mounted=plistlib.loads(subprocess.check_output(['hdiutil','attach','-nobrowse','-plist',str(writable)]))
mount=Path(next(x['mount-point'] for x in mounted['system-entities'] if 'mount-point' in x))
try:
    background=mount/'.background'
    background.mkdir(exist_ok=True)
    if not (background/'background.png').exists():
        shutil.copy2(mount/'.background.png',background/'background.png')
finally:
    subprocess.run(['hdiutil','detach',str(mount)],check=True)
repaired=folder/'Perci-0.50.4-arm64.style-prepared.dmg'
subprocess.run(['hdiutil','convert',str(writable),'-format','UDZO','-o',str(repaired)],check=True)
os.replace(repaired,image) # Original unstyled image is retained above.
subprocess.run(['bash','/Users/toshonjennings/.config/agent-rules/bin/fix-dmg-background.sh',str(image)],check=True)
subprocess.run(['node','scripts/refresh-mac-artifact-metadata.mjs',str(image)],cwd=root,check=True)
