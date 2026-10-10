import { readStringStorage, serializeJson, writeStringStorage } from './persistentStore';

export const PERFORMANCE_KEY = 'perci_performance:v1';
export const AUTOMATIC_SERVICES = {
    eidos: 'Eidos',
    keysafe: 'KeySafe',
    'dotenvx-gui': 'Dotenvx',
    'github-overview': 'GitHub Overview',
};

export function normalizePerformancePolicy(input) {
    const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
        version: 1,
        restoreViews: value.restoreViews === 'immediate' ? 'immediate' : 'deferred',
        pauseHiddenViews: value.pauseHiddenViews !== false,
        services: Object.fromEntries(Object.keys(AUTOMATIC_SERVICES).map(id => [
            id,
            ['manual', 'on-startup', 'on-open'].includes(value.services?.[id]) ? value.services[id] : 'on-open',
        ])),
    };
}

export function readPerformancePolicy() {
    try {
        const raw = readStringStorage(PERFORMANCE_KEY, '');
        return normalizePerformancePolicy(raw.length <= 4096 ? JSON.parse(raw) : null);
    } catch {
        return normalizePerformancePolicy(null);
    }
}

export function savePerformancePolicy(value) {
    const next = normalizePerformancePolicy(value);
    writeStringStorage(PERFORMANCE_KEY, serializeJson(next));
    return next;
}

export function shouldAutoStartService(policy, id, intent) {
    const mode = policy.services[id];
    return (intent === 'user-open' && mode === 'on-open') || (intent === 'startup' && mode === 'on-startup');
}
