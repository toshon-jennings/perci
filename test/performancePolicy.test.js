import { describe, expect, it } from 'vitest';
import { ensureHydrated, resetPersistenceCache } from '../src/lib/persistentStore';
import { PERFORMANCE_KEY, normalizePerformancePolicy, readPerformancePolicy, savePerformancePolicy, shouldAutoStartService } from '../src/lib/performancePolicy';

describe('performance policy', () => {
    it('normalizes malformed and oversized persisted input without accepting launch data', async () => {
        localStorage.setItem(PERFORMANCE_KEY, 'x'.repeat(5000));
        await ensureHydrated();
        expect(readPerformancePolicy().restoreViews).toBe('deferred');
        const policy = normalizePerformancePolicy({ restoreViews: 'bad', services: { eidos: 'manual', command: 'untrusted', keysafe: { mode: 'on-startup' } } });
        expect(policy.services).toEqual({ eidos: 'manual', keysafe: 'on-open', 'dotenvx-gui': 'on-open', 'github-overview': 'on-open' });
    });

    it('separates restore, open, and startup intent', () => {
        const policy = normalizePerformancePolicy({ services: { eidos: 'on-startup', keysafe: 'on-open', 'dotenvx-gui': 'manual' } });
        expect(shouldAutoStartService(policy, 'keysafe', 'restored')).toBe(false);
        expect(shouldAutoStartService(policy, 'keysafe', 'user-open')).toBe(true);
        expect(shouldAutoStartService(policy, 'eidos', 'user-open')).toBe(false);
        expect(shouldAutoStartService(policy, 'eidos', 'startup')).toBe(true);
        expect(shouldAutoStartService(policy, 'dotenvx-gui', 'startup')).toBe(false);
        expect(shouldAutoStartService(policy, 'unknown', 'user-open')).toBe(false);
    });

    it('survives hydration in the browser fallback', async () => {
        const saved = savePerformancePolicy({ restoreViews: 'immediate', pauseHiddenViews: false, services: { keysafe: 'manual' } });
        resetPersistenceCache();
        await ensureHydrated();
        expect(readPerformancePolicy()).toEqual(saved);
    });
});
