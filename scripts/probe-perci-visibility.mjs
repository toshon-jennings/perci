// Native visibility acceptance without Playwright's renderer focus emulation.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { strict as assert } from 'node:assert';
const require = createRequire(import.meta.url);
const { WebSocket } = require(resolve('release-build/performance-clean-0.50.3/node_modules/ws'));
if (!process.argv.includes('--allow-test-exit')) throw new Error('Disposable app closure must be authorized');
const bundle = resolve((process.argv.includes('--app') ? process.argv[process.argv.indexOf('--app') + 1] : null) || 'release-build/performance-0.50.4-verified/mac-arm64/Perci.app');
const evidence = resolve('docs/performance-evidence/native-visibility-0.50.4');
const profile = join(evidence, `profile-${Date.now()}`);
mkdirSync(profile, { recursive: true });
writeFileSync(join(profile, 'perci-data.json'), JSON.stringify({ perci_open_windows: '[]', theme: 'dark', weather_sync_enabled: 'false' }));
const child = spawn(join(bundle, 'Contents/MacOS/Perci'), ['--inspect=0', '--use-mock-keychain'], { env: { ...process.env, NODE_ENV: 'production', PERCI_TEST_USER_DATA_DIR: profile } });
let logs = ''; let socket; let nextId = 1; const pending = new Map();
child.stdout.on('data', data => { logs = (logs + data).slice(-16000); });
child.stderr.on('data', data => { logs = (logs + data).slice(-16000); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async test => { for (let i = 0; i < 150; i++) { const result = await test(); if (result) return result; await delay(200); } throw new Error('Native probe timed out'); };
const evaluate = expression => new Promise((resolve, reject) => {
    const id = nextId++; const timer = setTimeout(() => { pending.delete(id); reject(new Error('Inspector command timed out')); }, 30000);
    pending.set(id, response => { clearTimeout(timer); if (response.error || response.result.exceptionDetails) reject(new Error(JSON.stringify(response.error || response.result.exceptionDetails))); else resolve(response.result.result?.value); });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
});
const renderer = expression => evaluate(`__visibilityWindow.webContents.executeJavaScript(${JSON.stringify(expression)})`);
const result = { appBundle: bundle, profile, collectedAt: new Date().toISOString(), caveat: 'Native app lifecycle; synthetic Docker/job reads, no live backend readiness claim.' };
try {
    const endpoint = await until(() => logs.match(/Debugger listening on (ws:\/\/[^\s]+)/)?.[1]);
    socket = new WebSocket(endpoint); await new Promise(resolve => socket.once('open', resolve));
    socket.on('message', data => { const response = JSON.parse(String(data)); const callback = pending.get(response.id); if (callback) { pending.delete(response.id); callback(response); } });
    await delay(4000); // Electron swaps the inspector context during bootstrap.
    await until(() => evaluate(`!!process.mainModule?.require('electron').BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/dist/index.html'))`));
    await evaluate(`(() => {
        const { BrowserWindow, ipcMain, session } = process.mainModule.require('electron');
        globalThis.__visibilityWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/dist/index.html'));
        globalThis.__visibilityReads = { docker: 0, dashboard: 0 };
        session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
        const mock = (name, handler) => { ipcMain.removeHandler(name); ipcMain.handle(name, handler); };
        mock('docker:status', () => ({ state: 'running' }));
        mock('docker:list', () => { __visibilityReads.docker++; return { ok: true, containers: [] }; });
        mock('agent-jobs:list', (_event, input) => { if (input?.source === 'dashboard') __visibilityReads.dashboard++; return []; });
        const original = ipcMain._invokeHandlers.get('app-data:get');
        mock('app-data:get', async event => ({ ...await original(event), perci_open_windows: JSON.stringify([{ id: 'docker', modeId: 'docker', title: 'Docker', state: 'normal', z: 20, bounds: { x: 50, y: 50, width: 920, height: 620 } }]) }));
        __visibilityWindow.webContents.reload();
    })()`);
    await until(() => renderer(`!!document.querySelector('[data-window-id="docker"]')`));
    await renderer(`Array.from(document.querySelectorAll('[data-window-id="docker"] button')).find(b => b.textContent === 'Open Docker').click()`);
    await until(() => evaluate('__visibilityReads.docker > 0'));
    await until(() => evaluate(`process.mainModule.require('electron').BrowserWindow.getAllWindows().length === 1`));
    await evaluate('__visibilityWindow.show()');
    result.beforeHide = await evaluate('({ visible: __visibilityWindow.isVisible(), throttled: __visibilityWindow.webContents.getBackgroundThrottling() })');
    await delay(500);
    await evaluate('__visibilityWindow.hide()');
    await until(() => renderer(`document.visibilityState === 'hidden'`));
    result.hidden = await evaluate('({...__visibilityReads})');
    await delay(11000); result.afterHidden = await evaluate('({...__visibilityReads})');
    assert.deepEqual(result.afterHidden, result.hidden);
    await evaluate('__visibilityWindow.show()');
    await until(() => renderer(`document.visibilityState === 'visible'`));
    await delay(600); result.shown = await evaluate('({...__visibilityReads})');
    assert.equal(result.shown.docker, result.hidden.docker + 1);
    assert.equal(result.shown.dashboard, result.hidden.dashboard + 1);
    result.passed = true;
} catch (error) { result.passed = false; result.error = error.stack; process.exitCode = 1; }
finally {
    writeFileSync(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    if (socket?.readyState === 1) { try { await evaluate(`setTimeout(() => process.mainModule.require('electron').app.quit(), 100); 'closing disposable fixture'`); } finally { socket.close(); } }
    await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
}
