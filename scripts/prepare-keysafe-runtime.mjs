import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = resolve(root, 'vendor/keysafe-runtime.tar.gz');
const manifestPath = resolve(root, 'vendor/keysafe-runtime.json');
const destination = resolve(root, 'vendor/keysafe-runtime');
function tar(args) {
  const result = spawnSync('tar', args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('KeySafe runtime archive operation failed.');
}
const digest = () => createHash('sha256').update(readFileSync(archive)).digest('hex');
if (process.argv.includes('--refresh')) {
  const source = resolve(root, '../keysafe');
  const files = ['dist', 'server.mjs', 'server-auth.mjs', 'package.json'];
  for (const file of files) if (!existsSync(resolve(source, file))) throw new Error(`Missing KeySafe runtime file: ${file}`);
  mkdirSync(dirname(archive), { recursive: true });
  tar(['-czf', archive, '-C', source, ...files]);
  const version = JSON.parse(readFileSync(resolve(source, 'package.json'), 'utf8')).version;
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' });
  if (commit.status !== 0) throw new Error('KeySafe source commit is unavailable.');
  writeFileSync(manifestPath, JSON.stringify({ product: 'KeySafe', version, sourceCommit: commit.stdout.trim(), sha256: digest() }, null, 2) + '\n');
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.product !== 'KeySafe' || digest() !== manifest.sha256) throw new Error('KeySafe runtime checksum verification failed.');
mkdirSync(destination, { recursive: true });
tar(['-xzf', archive, '-C', destination]);
const version = JSON.parse(readFileSync(resolve(destination, 'package.json'), 'utf8')).version;
if (version !== manifest.version) throw new Error('KeySafe runtime version verification failed.');
console.log(`Verified KeySafe ${version} runtime (${manifest.sha256}).`);
