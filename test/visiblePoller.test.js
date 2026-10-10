import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVisiblePoller } from '../src/lib/visiblePoller';

afterEach(() => vi.useRealTimers());

describe('visibility polling', () => {
    it('does no hidden work, refreshes once on resume, and stops after disposal', async () => {
        vi.useFakeTimers();
        const run = vi.fn(async () => {});
        const poller = createVisiblePoller({ run, intervalMs: 5000 });
        await vi.advanceTimersByTimeAsync(20000);
        expect(run).not.toHaveBeenCalled();
        poller.setVisible(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(run).toHaveBeenCalledTimes(1);
        poller.setVisible(false);
        await vi.advanceTimersByTimeAsync(20000);
        expect(run).toHaveBeenCalledTimes(1);
        poller.setVisible(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(run).toHaveBeenCalledTimes(2);
        poller.dispose();
        await vi.advanceTimersByTimeAsync(20000);
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('rejects late results and queues rapid resume behind the existing request', async () => {
        vi.useFakeTimers();
        let release;
        let current;
        const run = vi.fn(isCurrent => {
            current = isCurrent;
            return new Promise(resolve => { release = resolve; });
        });
        const poller = createVisiblePoller({ run, intervalMs: 5000 });
        poller.setVisible(true);
        expect(current()).toBe(true);
        poller.setVisible(false);
        poller.setVisible(true);
        expect(current()).toBe(false);
        expect(run).toHaveBeenCalledTimes(1);
        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(run).toHaveBeenCalledTimes(2);
        poller.dispose();
        expect(current()).toBe(false);
        release();
        await vi.advanceTimersByTimeAsync(10000);
        expect(run).toHaveBeenCalledTimes(2);
    });
});
