import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
const { singleFlight } = createRequire(import.meta.url)('../electron/single-flight.cjs');

describe('native start concurrency', () => {
    it('joins concurrent requests and permits a later start after settlement', async () => {
        let release;
        const operation = vi.fn(() => new Promise(resolve => { release = resolve; }));
        const start = singleFlight(operation);
        const first = start();
        expect(start()).toBe(first);
        await Promise.resolve();
        expect(operation).toHaveBeenCalledTimes(1);
        release({ ok: true });
        await first;
        const next = start();
        expect(next).not.toBe(first);
        await Promise.resolve();
        release({ ok: true });
        await next;
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it('allows an explicit retry after failure, including synchronous failure', async () => {
        const operation = vi.fn().mockImplementationOnce(() => { throw new Error('fixture unavailable'); }).mockResolvedValueOnce({ ok: true });
        const start = singleFlight(operation);
        await expect(start()).rejects.toThrow('fixture unavailable');
        await expect(start()).resolves.toEqual({ ok: true });
    });
});
