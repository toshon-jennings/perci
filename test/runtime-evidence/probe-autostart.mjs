import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const profile = resolve('release-build/autostart-profile');
mkdirSync(profile, { recursive: true });
writeFileSync(resolve(profile, 'perci-data.json'), JSON.stringify({ perci_open_windows: '[]' }));
const app = await _electron.launch({
    executablePath: resolve('release-build/0.50.2/dist_electron/mac-arm64/Perci.app/Contents/MacOS/Perci'),
    args: ['--use-mock-keychain'],
    env: { ...process.env, NODE_ENV: 'production', PERCI_TEST_USER_DATA_DIR: profile },
});
try {
    let page;
    for (let n = 0; n < 100; n++) {
        page = app.windows().find(p => p.url().includes('/dist/index.html'));
        if (page) break;
        await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(page);
    await page.waitForFunction(() => !!window.electron?.keysafeStart);
    await app.evaluate(({ ipcMain }) => {
        globalThis.__autoStarts = { keysafe: 0, eidos: 0 };
        const original = ipcMain._invokeHandlers.get('keysafe:start');
        ipcMain.removeHandler('keysafe:start');
        ipcMain.handle('keysafe:start', (...args) => {
            globalThis.__autoStarts.keysafe++;
            return original(...args);
        });
        ipcMain.removeHandler('eidos:status');
        ipcMain.handle('eidos:status', () => ({ state: 'no-docker', runtime: 'orbstack-stopped', error: 'Synthetic stopped runtime' }));
        ipcMain.removeHandler('eidos:start');
        ipcMain.handle('eidos:start', () => {
            globalThis.__autoStarts.eidos++;
            return { ok: true, state: 'running' };
        });
    });
    await page.getByRole('button', { name: 'KeySafe Secure local API keys & recovery codes', exact: true }).evaluate(button => button.click());
    await page.waitForFunction(() => document.querySelector('webview[useragent="Perci-KeySafe-Guest/1"]'));
    const identity = await page.evaluate(() => window.electron.keysafeStatus());
    assert.equal(identity.ok, true);
    assert.equal(identity.productId, 'keysafe');
    await page.getByRole('button', { name: 'Eidos Persistent memory for AI agents', exact: true }).evaluate(button => button.click());
    await page.waitForFunction(() => document.querySelector('webview[src="http://localhost:3000"]'));
    const starts = await app.evaluate(() => globalThis.__autoStarts);
    assert.equal(starts.keysafe, 1);
    assert.equal(starts.eidos, 1);
    const result = { version: '0.50.2', starts, keysafe: 'real authenticated production server', eidos: 'simulated stopped OrbStack status; real renderer called start instead of rejecting status', installedAppReplaced: false };
    writeFileSync('test/runtime-evidence/autostart-result.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    await page.screenshot({ path: 'output/playwright/autostart-candidate.png' });
} catch (error) {
    console.log(JSON.stringify(await app.evaluate(() => globalThis.__autoStarts)));
    for (const page of app.windows()) {
        if (page.url().includes('/dist/index.html')) {
            console.log((await page.locator('.keysafe-status-container').innerText().catch(() => 'no KeySafe status')).slice(0,700));
        }
    }
    throw error;
} finally {
    await app.evaluate(({ app }) => app.exit(0));
}
