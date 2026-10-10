import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { hostname, totalmem } from 'node:os';
import { strict as assert } from 'node:assert';

const require = createRequire(import.meta.url);
let terminalServer; let terminalPort = 0; let terminalConnections = 0;
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const label = option('--label', 'candidate');
if (!/^[a-z0-9-]{1,60}$/.test(label)) throw new Error('Invalid evidence label');
if (!args.includes('--allow-test-exit')) throw new Error('Confirm disposable test instance closure before using --allow-test-exit');
const appBundle = resolve(option('--app', 'dist_electron/mac-arm64/Perci.app'));
const repetitions = Number(option('--runs', '3'));
const idleMs = Number(option('--idle-seconds', '60')) * 1000;
const soakMs = Number(option('--soak-seconds', '0')) * 1000;
if (![repetitions, idleMs, soakMs].every(Number.isFinite) || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10 || idleMs < 0 || soakMs < 0 || soakMs > 1800000) throw new Error('Invalid measurement bounds');
if (args.includes('--acceptance') && soakMs) throw new Error('Run acceptance separately: it changes policy settings and would invalidate soak comparisons');
const sourceExport = resolve(option('--source-export', 'release-build/performance-clean-0.50.4'));
const evidence = resolve('docs/performance-evidence', label);
mkdirSync(evidence, { recursive: true });
const modes = ['chat', 'code', 'notes', 'office', 'eidos', 'keysafe', 'dotenvx-gui', 'github-overview', 'localhost', 'docker', 'opencode-rig'];
const titles = { chat: 'Chat', code: 'Code', notes: 'Workspace Notes', office: 'Perci HQ', eidos: 'Eidos', keysafe: 'KeySafe', 'dotenvx-gui': 'Dotenvx GUI', 'github-overview': 'GitHub Overview', localhost: 'Localhost', docker: 'Docker', 'opencode-rig': 'OpenCode Rig' };
const fixture = modes.map((id, i) => ({ id, modeId: id, title: titles[id], state: i % 3 === 0 ? 'minimized' : 'normal', z: 20 + i, bounds: { x: 30 + i * 8, y: 20 + i * 5, width: 920, height: 620 } }));
const output = {
    label, collectedAt: new Date().toISOString(), appBundle, sourceExport,
    source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
    artifactSHA256: createHash('sha256').update(readFileSync(join(appBundle, 'Contents/Resources/app.asar'))).digest('hex'),
    hardware: { hostname: hostname(), memoryBytes: totalmem() },
    protocol: { repetitions, idleMs, soakMs, cycles: args.includes('--cycles'), empty: args.includes('--empty'), syntheticBackends: true, playwrightFocusEmulation: true },
    fixture, caveats: ['External starts and network are blocked in the disposable process.', 'These measurements isolate view initialization, not real backend startup. Office font lookup/data/font bytes are supplied locally as synthetic fixtures.', 'Summed process accounting is approximate; footprint errors are retained.'], runs: [],
};
if (args.includes('--acceptance')) {
    const { WebSocketServer } = require(resolve('release-build/performance-clean-0.50.3/node_modules/ws'));
    terminalServer = new WebSocketServer({ host: 'localhost', port: 0 });
    await new Promise(resolve => terminalServer.once('listening', resolve));
    terminalServer._server.unref(); terminalPort = terminalServer.address().port;
    terminalServer.on('connection', socket => {
        terminalConnections += 1; socket.send('Synthetic terminal ready\r\n');
        let step = 0;
        const timer = setInterval(() => {
            if (socket.readyState === 1) socket.send(`Synthetic terminal step ${++step}\r\n`);
            if (step === 8) clearInterval(timer);
        }, 1000);
        socket.on('close', () => clearInterval(timer));
    });
}
const save = () => writeFileSync(join(evidence, 'measurement.json'), JSON.stringify(output, null, 2) + '\n');
save();

for (let run = 0; run < repetitions; run += 1) {
    const profile = join(evidence, `profile-${run}-${Date.now()}`);
    mkdirSync(profile, { recursive: true });
    writeFileSync(join(profile, 'perci-data.json'), JSON.stringify({ perci_open_windows: '[]', theme: 'dark', weather_sync_enabled: 'false' }));
    const started = Date.now();
    const app = await _electron.launch({ executablePath: join(appBundle, 'Contents/MacOS/Perci'), args: ['--use-mock-keychain'], env: { ...process.env, NODE_ENV: 'production', PERCI_TEST_USER_DATA_DIR: profile }, timeout: 30000 });
    try {
        let page; const diagnostics = [];
        for (let n = 0; n < 150; n++) {
            page = app.windows().find(p => p.url().includes('/dist/index.html'));
            if (page) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!page) throw new Error('Packaged renderer unavailable');
        page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text().slice(0, 1200)); });
        page.on('requestfailed', request => diagnostics.push(`Request failed: ${request.url()} ${request.failure()?.errorText}`));
        await page.waitForSelector('.perci-desktop-host', { state: 'detached' });
        await page.waitForFunction(() => !!window.electron?.setAppData);
        await app.evaluate(({ app, ipcMain, session, BrowserWindow }, fixtureInput) => {
            const { fixtureRoot, terminalPort } = fixtureInput;
            globalThis.__performanceCalls = {}; globalThis.__performanceSources = {};
            globalThis.__failOffice = false; globalThis.__fixtureFileText = '# Synthetic fixture\nDisposable acceptance note.';
            const mock = (name, result) => {
                ipcMain.removeHandler(name);
                ipcMain.handle(name, (_event, request) => {
                    if (request?.source) globalThis.__performanceSources[request.source] = (globalThis.__performanceSources[request.source] || 0) + 1;
                    globalThis.__performanceCalls[name] = (globalThis.__performanceCalls[name] || 0) + 1;
                    return result;
                });
            };
            for (const name of ['eidos:start', 'keysafe:start', 'localhost:start-now', 'opencode:start']) mock(name, { ok: false, error: 'Synthetic offline service; launch blocked by fixture' });
            mock('eidos:status', { state: 'stopped' });
            mock('eidos:progress', { step: 0 });
            mock('keysafe:status', { ok: false, reason: 'unreachable' });
            mock('localhost:check-health', { ok: false });
            mock('dotenvx:check-install', { installed: true });
            mock('docker:status', { state: 'running' });
            mock('docker:list', { ok: true, containers: [], images: [], volumes: [] });
            mock('opencode:probe', { state: 'offline' });
            mock('opencode:check-install', { installed: true });
            mock('agent-jobs:list', []);
            mock('models:list', { ollama: [{ id: 'synthetic-local', name: 'Synthetic local model' }] });
            mock('credentials:status', { providers: {} });
            mock('select-directory', { path: fixtureRoot, grantId: 'synthetic', capabilities: ['list', 'read', 'write'] });
            ipcMain.removeHandler('models:stream');
            ipcMain.handle('models:stream', async (event, request) => {
                globalThis.__performanceCalls['models:stream'] = (globalThis.__performanceCalls['models:stream'] || 0) + 1;
                for (const chunk of ['Synthetic ', 'stream ', 'continued ', 'while hidden.']) {
                    await new Promise(resolve => setTimeout(resolve, 900));
                    event.sender.send('models:stream-event', { requestId: request.requestId, type: 'chunk', chunk });
                }
                event.sender.send('models:stream-event', { requestId: request.requestId, type: 'complete' });
                return { requestId: request.requestId, result: { content: 'Synthetic stream continued while hidden.' } };
            });
            mock('get-default-notes-path', { path: fixtureRoot, grantId: 'synthetic', capabilities: ['list', 'read', 'write'] });
            mock('list-files', ['Index.md']);
            ipcMain.removeHandler('read-file'); ipcMain.handle('read-file', () => globalThis.__fixtureFileText);
            ipcMain.removeHandler('write-file'); ipcMain.handle('write-file', (_event, request) => { globalThis.__fixtureFileText = request.content; return { ok: true }; });
            mock('openclaw:test-connection', { ok: false });
            mock('opencode:build-info', null);
            mock('opencode:install-info', null);
            mock('terminal:get-connection-info', { token: 'synthetic-fixture' });
            const block = s => s.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, done) => {
                if (globalThis.__failOffice && /OfficePanel-[^/]+\.js$/.test(details.url)) { globalThis.__failOffice = false; globalThis.__fixtureFileText = '# Synthetic fixture\nDisposable acceptance note.'; return done({ cancel: true }); }
                // Monaco fixture assets are fulfilled locally by Playwright, never fetched.
                done({ cancel: /^(https?|wss?):/.test(details.url) && !/\/monaco-editor(?:@[^/]+)?\/min\//.test(details.url) && !details.url.startsWith('https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data/') && !(terminalPort && details.url.startsWith(`ws://localhost:${terminalPort}/`)) });
            });
            block(session.defaultSession);
            app.on('session-created', block);
            for (const win of BrowserWindow.getAllWindows()) { if (win.webContents.getURL().includes('/dist/')) { win.setSize(1280, 900); win.show(); } }
        }, { fixtureRoot: join(profile, 'notes'), terminalPort });
        await page.context().route('https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data/**', route => {
            const path = new URL(route.request().url()).pathname;
            const headers = { 'Access-Control-Allow-Origin': '*' };
            if (path.includes('/codepoint-index/')) return route.fulfill({ json: [1, { en: { latin: 'o'.repeat(43) } }], headers });
            if (path.includes('/font-meta/')) return route.fulfill({ json: [1, { id: 'fixture', ranges: '0-10ffff', typeforms: { 'sans-serif': { normal: [400] } } }], headers });
            return route.fulfill({ path: resolve('release-build/performance-clean-0.50.3/node_modules/katex/dist/fonts/KaTeX_SansSerif-Regular.woff'), headers });
        });
        if (args.includes('--acceptance')) await page.context().route(/\/monaco-editor(?:@[^/]+)?\/min\//, route => {
            const suffix = new URL(route.request().url()).pathname.split('/min/')[1];
            if (!suffix || suffix.includes('..')) return route.abort();
            const asset = resolve('release-build/performance-clean-0.50.3/node_modules/monaco-editor/min', suffix);
            try { return route.fulfill({ path: asset, headers: { 'Access-Control-Allow-Origin': '*' } }); } catch { return route.abort(); }
        });
        await page.evaluate(windows => window.electron.setAppData({ perci_open_windows: JSON.stringify(windows), selected_provider: 'ollama', selected_model: 'synthetic-local' }), args.includes('--empty') ? [] : fixture);
        // Initial empty-shell persistence can race direct fixture writes. Override
        // the read boundary while reloading so hydration receives the exact fixture.
        await app.evaluate(({ ipcMain }, windows) => {
            const original = ipcMain._invokeHandlers.get('app-data:get');
            globalThis.__fixtureWindows = windows;
            ipcMain.removeHandler('app-data:get');
            ipcMain.handle('app-data:get', async event => ({ ...await original(event), ...globalThis.__fixtureData, perci_open_windows: JSON.stringify(globalThis.__fixtureWindows), ...(globalThis.__fixturePolicy ? { 'perci_performance:v1': JSON.stringify(globalThis.__fixturePolicy) } : {}) }));
        }, args.includes('--empty') ? [] : fixture);
        if (args.includes('--trace')) await page.coverage.startJSCoverage();
        let startupTrace;
        if (args.includes('--startup-trace')) {
            startupTrace = await page.context().newCDPSession(page);
            await startupTrace.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.compile,blink.user_timing', transferMode: 'ReturnAsStream', streamFormat: 'json' });
        }
        const reloadStart = Date.now();
        await page.reload();
        await page.waitForSelector('.dash-root, .dashboard-root, .dash-tiles');
        if (!args.includes('--empty')) await page.waitForFunction(count => document.querySelectorAll('.perci-window').length === count, fixture.length);
        const record = { run, profile, processLaunchMs: Date.now() - started, shellUsableMs: Date.now() - reloadStart, samples: [], diagnostics, viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio })) };
        if (args.includes('--trace')) {
            record.initialJsCoverage = (await page.coverage.stopJSCoverage()).map(({ url, source, functions }) => ({ url: url.split('/').pop(), sourceLength: source?.length ?? null, executedFunctionCount: functions.filter(fn => fn.ranges.some(range => range.count > 0)).length, topLevelRuns: functions.find(fn => fn.functionName === '')?.ranges[0]?.count ?? null }));
        }
        if (startupTrace) {
            const complete = new Promise(resolve => startupTrace.once('Tracing.tracingComplete', resolve));
            await startupTrace.send('Tracing.end');
            const { stream, dataLossOccurred } = await complete;
            assert.ok(stream); assert.equal(dataLossOccurred, false);
            let trace = '';
            for (;;) {
                const chunk = await startupTrace.send('IO.read', { handle: stream, size: 1048576 });
                trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
                if (chunk.eof) break;
                assert.ok(trace.length < 50000000, 'Synthetic trace exceeded bound');
            }
            await startupTrace.send('IO.close', { handle: stream });
            writeFileSync(join(evidence, `startup-trace-${run}.json`), trace);
            const traceData = JSON.parse(trace);
            const timings = {};
            for (const event of traceData.traceEvents || []) {
                if (event.ph !== 'X' || !/compile|parse|EvaluateScript/i.test(event.name)) continue;
                const item = timings[event.name] ||= { count: 0, summedDurationMs: 0 };
                item.count++; item.summedDurationMs += (event.dur || 0) / 1000;
            }
            record.startupTrace = { dataLossOccurred, timings, caveat: 'Instrumented fixture hydration reload after bootstrap; code caches may be warm. Event durations can overlap and are not an end-to-end startup or an uncached parse-time claim.' };
            await startupTrace.detach();
        }
        await app.evaluate(({ app }) => app.getAppMetrics()); // Prime CPU interval before idle.
        output.runs.push(record);
        save();
        app.process().once('exit', (code, signal) => { record.processExit = { code, signal, at: new Date().toISOString() }; save(); });
        await page.waitForTimeout(idleMs);
        const sample = async () => {
            const metrics = await app.evaluate(({ app, webContents }) => ({ version: app.getVersion(), electron: process.versions.electron, processes: app.getAppMetrics(), guests: webContents.getAllWebContents().filter(w => w.getType() === 'webview').length, calls: { ...globalThis.__performanceCalls }, sources: { ...globalThis.__performanceSources } }));
            let footprint = '';
            try { footprint = execFileSync('/usr/bin/footprint', ['--noCategories', ...metrics.processes.flatMap(p => ['-p', String(p.pid)])], { encoding: 'utf8', timeout: 30000 }); }
            catch (error) { footprint = String(error.stdout || '') + String(error.stderr || 'footprint failed'); }
            record.samples.push({ elapsedMs: Date.now() - reloadStart, ...metrics, footprint, requestedJsResourceEntries: await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.js($|\?)/.test(r.name)).map(r => r.name.split('/').pop())) });
            save();
            console.log(JSON.stringify({ label, run, sample: record.samples.length, guests: metrics.guests, elapsedMs: Date.now() - reloadStart }));
        };
        await sample();
        const activate = async id => {
            const activationStart = Date.now();
            const chip = page.locator(`.perci-dock-item[title="Open ${titles[id]}"]`);
            if (await chip.count()) await chip.click();
            else {
                const placeholder = page.locator(`[data-window-id="${id}"]`).getByRole('button', { name: `Open ${titles[id]}`, exact: true });
                if (await placeholder.count()) await placeholder.click({ force: true });
            }
            const frame = page.locator(`[data-window-id="${id}"]`);
            await frame.getByText('Loading…', { exact: true }).waitFor({ state: 'hidden', timeout: 20000 });
            record.firstActivationMs ??= {};
            record.firstActivationMs[id] ??= Date.now() - activationStart;
            await page.waitForTimeout(700);
            // The blocked guest request is a cancellation (-3), which the host
            // deliberately ignores. Deliver the normal offline event shape.
            if (id === 'github-overview' && await frame.locator('webview').count()) await frame.locator('webview').evaluate(view => { const event = new Event('did-fail-load'); Object.assign(event, { errorCode: -102, errorDescription: 'Synthetic offline guest', isMainFrame: true }); view.dispatchEvent(event); }).catch(() => {});

        };
        const setTheme = async (theme, keepSettings = false) => {
            if (!await page.getByRole('button', { name: 'Done', exact: true }).count()) await page.getByRole('button', { name: 'Settings', exact: true }).first().evaluate(button => button.click());
            await page.getByRole('button').filter({ hasText: `Always use the ${theme} theme` }).click();
            if (!keepSettings) await page.getByRole('button', { name: 'Done', exact: true }).click();
        };
        const minimize = async id => {
            await page.locator(`[data-window-id="${id}"]`).getByRole('button', { name: `Minimize ${titles[id]}`, exact: true }).click({ force: true });
            await page.waitForTimeout(450);
        };
        if (args.includes('--first-open')) {
            record.firstViewCommitMs = {};
            for (const id of modes) {
                const start = Date.now();
                await page.locator(`.perci-dock-item[title="Open ${titles[id]}"]`).click();
                await page.waitForFunction(({ id, title }) => {
                    const body = document.querySelector(`[data-window-id="${id}"] .perci-window-body`);
                    const child = body?.firstElementChild;
                    return child && child.textContent.trim() !== `Open ${title}` &&
                        !(child.getAttribute('role') === 'status' && /^Loading .+…$/.test(child.textContent.trim()));
                }, { id, title: titles[id] });
                const frame = page.locator(`[data-window-id="${id}"]`);
                assert.equal(await frame.getByText(/failed to render/).count(), 0, id);
                record.firstViewCommitMs[id] = Date.now() - start;
                await minimize(id); save();
            }
            record.firstViewCommitCaveat = 'First committed view DOM after user activation, not backend readiness, editor readiness, or cold parse. Earlier firstActivationMs records wait only for a generic loading label and must not be used as first-ready latency.';
        }
        if (args.includes('--acceptance')) {
            record.acceptance = [];
            const check = async (name, test) => {
                if (args.includes('--header-only') && !name.startsWith('icon header')) return;
                if (args.includes('--terminal-only') && !name.startsWith('synthetic terminal')) return;
                if (args.includes('--visibility-only') && !name.startsWith('Minimized Docker')) return;
                try { await test(); record.acceptance.push({ name, passed: true }); }
                catch (error) { record.acceptance.push({ name, passed: false, error: String(error.message) }); }
                save();
            };
            if (args.includes('--header-only')) await check('icon header fits native widths with named tooltips and keyboard focus in both themes', async () => {
                await page.waitForTimeout(6000); // Let the native splash finish changing bounds.
                await page.locator('.app-header').getByRole('button', { name: 'Chat', exact: true }).click();
                await page.waitForTimeout(900); // Chat adds its New Chat and guide actions.
                record.headerLayouts = [];
                for (const width of [1000, 1200, 1440]) {
                    await app.evaluate(({ BrowserWindow }, width) => {
                        const main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/dist/'));
                        main.setContentSize(width, 800); main.show();
                    }, width);
                    for (const theme of ['light', 'dark']) {
                        await setTheme(theme);
                        const header = page.locator('.app-header');
                        const layout = await header.evaluate(header => {
                            const bounds = header.getBoundingClientRect();
                            const buttons = [...header.querySelectorAll('button')];
                            const modeGroup = buttons.find(b => b.title === 'Dashboard').parentElement;
                            return {
                                width: innerWidth, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                                visibleText: header.innerText.trim(), documentOverflow: document.documentElement.scrollWidth > innerWidth,
                                groupWidth: modeGroup.clientWidth, groupScrollWidth: modeGroup.scrollWidth,
                                modeGuideColor: getComputedStyle(buttons.find(b => b.title === 'Open mode guide')).color,
                                chatGuideColor: getComputedStyle(buttons.find(b => b.title === 'Open Chat Guide')).color,
                                names: buttons.map(b => ({ title: b.title, label: b.getAttribute('aria-label') })),
                                clippedUtilities: buttons.filter(b => b.parentElement !== modeGroup).filter(b => {
                                    const r = b.getBoundingClientRect(); return r.left < bounds.left || r.right > bounds.right;
                                }).map(b => b.title),
                            };
                        });
                        layout.iconContrast = await header.evaluate(header => {
                            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            const rgba = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
                            const composite = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]));
                            const background = element => {
                                const chain = []; for (let node = element; node; node = node.parentElement) chain.unshift(node);
                                return chain.reduce((color, node) => composite(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
                            };
                            const lum = color => color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
                            const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
                            return [...header.querySelectorAll('button')].filter(b => b.querySelector('svg')).map(button => {
                                const svg = button.querySelector('svg');
                                let bg = background(button);
                                const indicator = button.querySelector('span.absolute.inset-0');
                                if (indicator) bg = composite(rgba(getComputedStyle(indicator).backgroundColor), bg);
                                return { name: button.title, color: getComputedStyle(svg).color, background: bg, ratio: ratio(composite(rgba(getComputedStyle(svg).color), bg), bg) };
                            });
                        });
                        assert.ok(layout.iconContrast.every(icon => icon.ratio >= 3), JSON.stringify(layout.iconContrast.filter(icon => icon.ratio < 3)));
                        record.headerLayouts.push(layout);
                        assert.equal(layout.visibleText, ''); assert.equal(layout.documentOverflow, false);
                        assert.deepEqual(layout.clippedUtilities, []);
                        assert.notEqual(layout.modeGuideColor, layout.chatGuideColor);
                        assert.ok(layout.names.every(b => b.title && b.label));
                        const dashboard = header.getByRole('button', { name: 'Dashboard', exact: true });
                        await dashboard.focus(); await page.keyboard.press('Tab');
                        const focus = await page.evaluate(() => ({ name: document.activeElement.title, outline: getComputedStyle(document.activeElement).outlineStyle, width: getComputedStyle(document.activeElement).outlineWidth }));
                        assert.equal(focus.name, 'Map'); assert.notEqual(focus.outline, 'none'); assert.notEqual(focus.width, '0px');
                        await page.screenshot({ path: join(evidence, `header-${theme}-${width}-${run}.png`) });
                    }
                }
                await page.locator('.app-header').getByRole('button', { name: 'Chat', exact: true }).click();
                await page.waitForTimeout(900);
                assert.equal(await page.locator('[data-window-id="chat"]').getByRole('button', { name: 'Open Chat', exact: true }).count(), 0);
                const header = page.locator('.app-header');
                assert.equal(await header.getByRole('button', { name: 'New Chat', exact: true }).count(), 1);
                assert.equal(await header.getByRole('button', { name: 'Open Chat Guide', exact: true }).count(), 1);
                assert.equal((await header.innerText()).trim(), '');
                await page.screenshot({ path: join(evidence, `header-chat-${run}.png`) });
                const chat = page.locator('[data-window-id="chat"]');
                const draft = chat.locator('textarea').first();
                await draft.fill('Synthetic draft retained across native resize');
                const handle = chat.locator('.perci-resizer.se');
                const handleBox = await handle.boundingBox();
                const before = await chat.boundingBox();
                await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
                await page.mouse.down(); await page.mouse.move(handleBox.x + 60, handleBox.y + 35); await page.mouse.up();
                const after = await chat.boundingBox();
                assert.ok(after.width > before.width); assert.ok(after.height > before.height);
                await minimize('chat'); await activate('chat');
                assert.equal(await draft.inputValue(), 'Synthetic draft retained across native resize');
                record.filledToggleContrast = [];
                for (const theme of ['dark', 'light']) {
                    await setTheme(theme);
                    for (const name of ['Toggle Terminal', 'Enable Incognito Mode']) {
                        const toggle = header.getByRole('button', { name, exact: true });
                        await toggle.click(); await page.waitForTimeout(300);
                        const pressed = name === 'Enable Incognito Mode' ? header.getByRole('button', { name: 'Disable Incognito Mode', exact: true }) : toggle;
                        const colors = await pressed.evaluate(button => ({ foreground: getComputedStyle(button.querySelector('svg')).color, background: getComputedStyle(button).backgroundColor }));
                        const channels = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
                        const lum = value => channels(value).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
                        const a = lum(colors.foreground), b = lum(colors.background), ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
                        record.filledToggleContrast.push({ theme, name, ...colors, ratio }); assert.ok(ratio >= 3);
                        await pressed.click();
                    }
                }
                const lazyNames = [...readFileSync(resolve('src/App.jsx'), 'utf8').matchAll(/retryableLazy\(\(\) => import\('\.\/components\/(?:windows\/)?([^']+)'\)/g)].map(match => match[1]);
                const assets = readdirSync(join(sourceExport, 'dist/assets'));
                const imports = lazyNames.map(name => {
                    const matches = assets.filter(file => file.startsWith(`${name}-`) && file.endsWith('.js'));
                    assert.equal(matches.length, 1, `Missing or ambiguous lazy chunk ${name}`);
                    return matches[0];
                });
                record.packagedModuleImports = await page.evaluate(async files => {
                    const results = [];
                    for (const file of files) {
                        try { await import(new URL(`./assets/${file}`, location.href).href); results.push({ file, passed: true }); }
                        catch (error) { results.push({ file, passed: false, error: error.message }); }
                    }
                    return results;
                }, imports);
                assert.ok(record.packagedModuleImports.every(result => result.passed), 'Packaged lazy module initialization failed');
                const longTitle = 'Synthetic tool with a deliberately long descriptive title for the deferred layout inspection';
                await app.evaluate((_electron, title) => {
                    globalThis.__fixtureWindows = [
                        { id: 'fixture-long', modeId: 'fixture-long', title, state: 'normal', z: 20, bounds: { x: 20, y: 20, width: 420, height: 380 } },
                        { id: 'code', modeId: 'code', title: 'Code', state: 'normal', z: 30, bounds: { x: 500, y: 50, width: 600, height: 450 } },
                    ];
                }, longTitle);
                await page.reload(); await page.waitForSelector('[data-window-id="fixture-long"]');
                await page.waitForTimeout(500);
                const longFrame = page.locator('[data-window-id="fixture-long"]');
                const layout = await longFrame.evaluate(frame => ({ frameWidth: frame.clientWidth, contentWidth: frame.querySelector('.perci-window-body').scrollWidth }));
                assert.ok(layout.contentWidth <= layout.frameWidth, 'Long deferred title overflows its frame');
                await page.screenshot({ path: join(evidence, `long-deferred-title-${run}.png`) });
                const shield = longFrame.locator('.perci-window-focus-shield');
                await shield.click();
                assert.equal(await longFrame.getByRole('button', { name: `Open ${longTitle}`, exact: true }).count(), 0);
                assert.equal(await page.locator('[data-window-id="code"]').getByRole('button', { name: 'Open Code', exact: true }).count(), 1);


            });
            if (args.includes('--header-only')) { if (record.acceptance.some(check => !check.passed)) process.exitCode = 1; continue; }
            await check('restored layout defers every tool and launch', async () => {
                assert.equal(await page.locator('.perci-window').count(), fixture.length);
                const counts = await app.evaluate(() => globalThis.__performanceCalls);
                for (const name of ['eidos:start', 'keysafe:start', 'localhost:start-now', 'opencode:start']) assert.equal(counts[name] || 0, 0);
                assert.equal(await page.locator('.perci-window button').filter({ hasText: /^Open / }).count(), fixture.length);
            });
            await check('deferred state and keyboard focus render in both themes', async () => {
                await page.emulateMedia({ reducedMotion: 'reduce' });
                for (const theme of ['dark', 'light']) {
                    await setTheme(theme);
                    await page.locator('[data-window-id="opencode-rig"]').getByRole('button', { name: 'Open OpenCode Rig', exact: true }).focus();
                    await page.screenshot({ path: join(evidence, `deferred-${theme}-${run}.png`) });
                }
            });
            await check('native window-cycle action activates a deferred tool', async () => {
                await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/dist/')).webContents.send('menu-action', 'cycle-next-window'));
                await page.waitForTimeout(900);
                assert.ok(await page.locator('.perci-window button').filter({ hasText: /^Open / }).count() < fixture.length);
            });
            await check('failed Office chunk stays confined and Retry loads it', async () => {
                await app.evaluate(() => { globalThis.__failOffice = true; });
                await activate('office');
                const frame = page.locator('[data-window-id="office"]');
                await frame.getByText(/failed to render/).waitFor();
                for (const theme of ['dark', 'light']) {
                    await setTheme(theme);
                    await page.screenshot({ path: join(evidence, `error-${theme}-${run}.png`) });
                }
                await frame.getByRole('button', { name: 'Retry', exact: true }).click();
                await frame.locator('canvas').waitFor({ timeout: 20000 });
                assert.equal(await frame.getByText(/failed to render/).count(), 0);
                await minimize('office');
            });
            if (args.includes('--failure-only')) { if (record.acceptance.some(check => !check.passed)) process.exitCode = 1; continue; }
            await page.evaluate(() => {
                window.__draws = 0;
                for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
                    for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
                        const original = proto[method];
                        if (original) proto[method] = function (...args) { window.__draws += 1; return original.apply(this, args); };
                    }
                }
            });
            await check('Office draws and polling stop hidden and resume without remount', async () => {
                await activate('office');
                await page.locator('[data-window-id="office"] canvas').waitFor();
                await page.evaluate(() => { window.__officeCanvas = document.querySelector('[data-window-id="office"] canvas'); window.__draws = 0; });
                await page.waitForTimeout(1500);
                assert.ok(await page.evaluate(() => window.__draws) > 0, 'visible draw calls');
                await minimize('office');
                await page.waitForTimeout(600);
                const before = await page.evaluate(() => window.__draws);
                const calls = await app.evaluate(() => ({ ...globalThis.__performanceSources }));
                await page.waitForTimeout(11000);
                assert.equal(await page.evaluate(() => window.__draws), before);
                const after = await app.evaluate(() => globalThis.__performanceSources);
                assert.equal(after.office_panel || 0, calls.office_panel || 0);
                await activate('office'); await page.waitForTimeout(1200);
                assert.ok(await page.evaluate(() => window.__draws) > before);
                assert.ok(await page.evaluate(() => window.__officeCanvas === document.querySelector('[data-window-id="office"] canvas')));
                await minimize('office');
            });
            await check('Chat draft survives minimize and restore', async () => {
                await activate('chat');
                const input = page.locator('[data-window-id="chat"] textarea[placeholder="How can I help you today?"]');
                await input.fill('Synthetic unsent draft');
                await minimize('chat'); await activate('chat');
                assert.equal(await input.inputValue(), 'Synthetic unsent draft');
            });
            await check('Code prompt survives minimize and restore', async () => {
                await activate('code');
                const input = page.locator('[data-window-id="code"] textarea').last();
                await input.fill('Synthetic pending code change');
                await minimize('code'); await activate('code');
                assert.equal(await input.inputValue(), 'Synthetic pending code change');
            });
            await check('active model response continues while Chat is minimized', async () => {
                await activate('chat');
                const frame = page.locator('[data-window-id="chat"]');
                const input = frame.locator('textarea[placeholder="How can I help you today?"]');
                await input.fill('Synthetic response continuity test'); await input.press('Enter');
                await page.waitForTimeout(1100); await minimize('chat');
                await page.waitForTimeout(4500); await activate('chat');
                await frame.getByText('Synthetic stream continued while hidden.', { exact: true }).waitFor({ timeout: 10000 });
            });
            await check('Notes editor buffer survives minimize and restore', async () => {
                await activate('notes');
                const frame = page.locator('[data-window-id="notes"]');
                await frame.getByText('Index', { exact: true }).first().click();
                const edit = frame.getByRole('button', { name: 'Edit', exact: true });
                if (await edit.count()) await edit.click();
                const input = frame.locator('.monaco-editor textarea').first();
                await input.waitFor({ timeout: 30000 });
                await page.evaluate(() => { window.__notesEditor = window.monaco.editor.getEditors().find(editor => document.querySelector('[data-window-id="notes"]').contains(editor.getDomNode())); window.__notesEditor.setValue('Synthetic unsaved note buffer'); });
                await minimize('notes'); await activate('notes');
                assert.ok(await page.evaluate(() => window.__notesEditor.getValue().includes('Synthetic unsaved note buffer')));
                assert.ok(await page.evaluate(() => document.querySelector('[data-window-id="notes"]').contains(window.__notesEditor.getDomNode())));
            });
            await check('Code file buffer survives minimize and restore', async () => {
                await activate('code');
                await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/dist/')).webContents.send('menu-action', 'choose-folder'));
                const frame = page.locator('[data-window-id="code"]');
                const input = frame.locator('.monaco-editor textarea').first();
                await input.waitFor({ timeout: 30000 });
                await page.evaluate(() => { window.__codeEditor = window.monaco.editor.getEditors().find(editor => document.querySelector('[data-window-id="code"]').contains(editor.getDomNode())); window.__codeEditor.setValue('Synthetic unsaved code buffer'); });
                await minimize('code'); await activate('code');
                assert.equal(await page.evaluate(() => window.__codeEditor.getValue()), 'Synthetic unsaved code buffer');
                assert.ok(await page.evaluate(() => document.querySelector('[data-window-id="code"]').contains(window.__codeEditor.getDomNode())));
            });
            await check('every fixture mode opens through packaged lazy imports', async () => {
                for (const id of modes) {
                    await activate(id);
                    const frame = page.locator(`[data-window-id="${id}"]`);
                    await frame.getByText('Loading…', { exact: true }).waitFor({ state: 'hidden', timeout: 20000 });
                    assert.equal(await frame.getByText(/failed to render/).count(), 0, id);
                    await minimize(id);
                }
            });
            await check('Minimized Docker pauses polling and refreshes once', async () => {
                await activate('docker'); await page.waitForTimeout(400);
                const reads = () => app.evaluate(() => ({ docker: globalThis.__performanceCalls['docker:list'] || 0, dashboard: globalThis.__performanceSources.dashboard || 0 }));
                await minimize('docker'); await page.waitForTimeout(500);
                const minimized = await reads(); await page.waitForTimeout(6100);
                assert.equal((await reads()).docker, minimized.docker);
                await activate('docker'); const restored = await reads(); assert.equal(restored.docker, minimized.docker + 1);
                record.visibilityCounts = { minimized, restored }; // Native app hide/show uses the separate inspector-only probe.
            });
            await check('Settings persists manual startup in native storage', async () => {
                await page.getByRole('button', { name: 'Settings', exact: true }).first().evaluate(button => button.click());
                await page.getByLabel('Eidos service startup').selectOption('manual');
                await page.getByLabel('Pause hidden tool updates').uncheck();
                await page.waitForTimeout(300);
                const stored = await page.evaluate(() => window.electron.getAppData());
                const policy = JSON.parse(stored['perci_performance:v1']);
                assert.equal(policy.services.eidos, 'manual'); assert.equal(policy.pauseHiddenViews, false);
                for (const theme of ['dark', 'light']) {
                    await setTheme(theme, true);
                    await page.getByLabel('Eidos service startup').scrollIntoViewIfNeeded();
                    await page.screenshot({ path: join(evidence, `settings-${theme}-${run}.png`) });
                }
            });
            record.activatedCalls = await app.evaluate(() => ({ ...globalThis.__performanceCalls }));
            if (await page.getByRole('button', { name: 'Done', exact: true }).count()) await page.getByRole('button', { name: 'Done', exact: true }).click();
            record.intentChecks = [];
            const reloadPolicy = async (restoreViews, serviceMode, windows = fixture) => {
                const policy = { version: 1, restoreViews, pauseHiddenViews: true, services: Object.fromEntries(['eidos', 'keysafe', 'dotenvx-gui', 'github-overview'].map(id => [id, serviceMode])) };
                await app.evaluate((_electron, input) => {
                    globalThis.__fixturePolicy = input.policy; globalThis.__fixtureWindows = input.windows;
                    globalThis.__performanceCalls = {}; globalThis.__performanceSources = {};
                }, { policy, windows });
                await page.reload(); await page.waitForSelector('.dash-root, .dashboard-root, .dash-tiles');
                await page.waitForTimeout(2500);
            };
            const starts = async () => {
                const all = await app.evaluate(() => ({ ...globalThis.__performanceCalls }));
                return Object.fromEntries(['eidos:start', 'keysafe:start', 'localhost:start-now'].map(name => [name, all[name] || 0]));
            };
            await check('immediate restoration mounts views without on-open service starts', async () => {
                await reloadPolicy('immediate', 'on-open');
                assert.equal(await page.locator('.perci-window button').filter({ hasText: /^Open / }).count(), 0);
                const counts = await starts(); record.intentChecks.push({ policy: 'immediate/on-open', counts });
                assert.deepEqual(Object.values(counts), [0, 0, 0]);
            });
            await check('manual policy probes until explicit Start; failures allow retry', async () => {
                await reloadPolicy('deferred', 'manual');
                for (const id of ['eidos', 'keysafe', 'dotenvx-gui', 'github-overview']) await activate(id);
                assert.deepEqual(Object.values(await starts()), [0, 0, 0]);
                for (const [id, name] of [['eidos', 'Start Eidos'], ['keysafe', 'Launch KeySafe Server'], ['dotenvx-gui', 'Start Dotenvx'], ['github-overview', 'Start GitHub Overview']]) {
                    await activate(id);
                    await page.locator(`[data-window-id="${id}"]`).getByRole('button', { name, exact: true }).click();
                    await page.waitForTimeout(900);
                }
                const counts = await starts(); record.intentChecks.push({ policy: 'manual/explicit-start', counts });
                assert.deepEqual(Object.values(counts), [1, 1, 2]);
                await activate('eidos');
                await page.locator('[data-window-id="eidos"]').getByRole('button', { name: /Retry|Start Eidos/ }).click();
                await page.waitForTimeout(500); assert.equal((await starts())['eidos:start'], 2);
            });
            await check('startup opt-in starts four services once without mounting views', async () => {
                await reloadPolicy('deferred', 'on-startup', []);
                const counts = await starts(); record.intentChecks.push({ policy: 'startup/no-windows', counts });
                assert.deepEqual(Object.values(counts), [1, 1, 2]);
                assert.equal(await page.locator('.perci-window').count(), 0);
                await page.waitForTimeout(2000); assert.deepEqual(await starts(), counts);
                assert.ok((await page.locator('body').innerText()).includes('Could not start Eidos'));
            });
            await check('synthetic terminal output continues hidden in the same xterm buffer', async () => {
                await app.evaluate((_electron, input) => {
                    globalThis.__fixtureData = {
                        perci_terminal_port: String(input.port),
                        gitshells_projects: JSON.stringify([{ id: 'synthetic-project', name: 'Synthetic project', path: input.path, terminals: [{ id: 'synthetic-terminal', label: 'Fixture terminal' }] }]),
                        perci_active_project_id: 'synthetic-project', perci_active_terminal_id: 'synthetic-terminal',
                    };
                }, { port: terminalPort, path: join(profile, 'notes') });
                titles.projects = 'Git Shells';
                await reloadPolicy('deferred', 'manual', [{ id: 'projects', modeId: 'projects', title: titles.projects, state: 'normal', z: 30, bounds: { x: 50, y: 50, width: 1040, height: 670 } }]);
                await activate('projects');
                await page.locator('[data-window-id="projects"]').getByText('1 > Fixture terminal', { exact: true }).first().click();
                await page.waitForTimeout(2500);
                const readTerminal = () => page.evaluate(() => {
                    let element = document.querySelector('[data-window-id="projects"] .xterm');
                    while (element && !Object.keys(element).some(key => key.startsWith('__reactFiber'))) element = element.parentElement;
                    let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
                    while (fiber) {
                        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
                            const term = hook.memoizedState?.current;
                            if (term?.buffer?.active) {
                                const buffer = term.buffer.active;
                                return Array.from({ length: buffer.length }, (_, i) => buffer.getLine(i)?.translateToString(true) || '').join('\n');
                            }
                        }
                        fiber = fiber.return;
                    }
                    return '';
                });
                assert.ok((await readTerminal()).includes('Synthetic terminal ready'));
                const connected = terminalConnections;
                await minimize('projects'); await page.waitForTimeout(5000); await activate('projects');
                assert.ok((await readTerminal()).includes('Synthetic terminal step 6'));
                assert.equal(terminalConnections, connected, 'terminal remounted/reconnected');
            });
            record.finalCalls = await app.evaluate(() => ({ ...globalThis.__performanceCalls }));
            record.acceptanceGaps = ['Blocked backend starts cannot prove real-service readiness or memory savings.'];
            save();
        }
        if (soakMs) {
            // Each pass restores and minimizes the same mounted instances. The
            // first three cycles warm lazy modules and caches before growth analysis.
            const end = Date.now() + soakMs;
            let cycle = 0;
            while (Date.now() < end) {
                if (args.includes('--cycles')) {
                    for (const id of modes) { await activate(id); await minimize(id); }
                    record.completedCycles = ++cycle;
                }
                await page.waitForTimeout(Math.max(0, Math.min(30000, end - Date.now())));
                await sample();
            }
        }
        await page.screenshot({ path: join(evidence, `restored-${run}.png`) });
        if (record.acceptance?.some(check => !check.passed)) process.exitCode = 1;
    } catch (error) {
        output.failure = { at: new Date().toISOString(), message: error.message };
        save();
        throw error;
    } finally {
        await app.close(); // Only the user-authorized disposable instance.
    }
}

if (terminalServer) { for (const client of terminalServer.clients) client.close(); terminalServer.close(); }
