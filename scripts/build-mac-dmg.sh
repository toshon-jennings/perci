#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npm run build:keysafe
npm run build
npx electron-builder --mac --"${PERCI_MAC_ARCH:-arm64}" --publish never

version=$(node -p "require('./package.json').version")
shopt -s nullglob
images=(dist_electron/Perci-"$version"-*.dmg)
if [ "${#images[@]}" -eq 0 ]; then
  echo "No Perci DMG was produced for version $version" >&2
  exit 1
fi
for image in "${images[@]}"; do
  bash scripts/fix-dmg-background.sh "$image"
  node scripts/refresh-mac-artifact-metadata.mjs "$image"
done
