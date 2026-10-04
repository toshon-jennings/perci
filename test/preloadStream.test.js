import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadBridge(invoke) {
  const ipcRenderer = new EventEmitter();
  ipcRenderer.invoke = invoke;
  let bridge;
  vm.runInNewContext(readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8'), {
    require: () => ({ ipcRenderer, contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } } }),
    crypto: { randomUUID: () => 'generated-fixture-id' },
  });
  return { bridge, ipcRenderer };
}

describe('preload stream completion', () => {
  it('keeps the listener when invoke resolves before queued stream events', async () => {
    const { bridge, ipcRenderer } = loadBridge(async () => ({ requestId: 'fixture', result: 'done' }));
    const chunks = [];
    let resolved = false;
    const request = bridge.models.stream({ requestId: 'fixture' }, event => chunks.push(event.chunk))
      .then(() => { resolved = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    ipcRenderer.emit('models:stream-event', {}, { requestId: 'other', type: 'complete' });
    ipcRenderer.emit('models:stream-event', {}, { requestId: 'fixture', type: 'chunk', chunk: 'hello' });
    ipcRenderer.emit('models:stream-event', {}, { requestId: 'fixture', type: 'complete' });
    await request;
    expect(chunks).toEqual(['hello']);
    expect(ipcRenderer.listenerCount('models:stream-event')).toBe(0);
  });

  it('removes its listener on provider failure without waiting for completion', async () => {
    const { bridge, ipcRenderer } = loadBridge(async () => { throw new Error('fixture failure'); });
    await expect(bridge.models.stream({ requestId: 'fixture' })).rejects.toThrow('fixture failure');
    expect(ipcRenderer.listenerCount('models:stream-event')).toBe(0);
  });
});
