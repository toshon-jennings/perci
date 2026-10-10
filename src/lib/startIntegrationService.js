import { launchArgsFor } from './localServices';

export function startIntegrationService(id) {
    const bridge = window.electron;
    if (id === 'eidos') return bridge?.eidosStart?.();
    if (id === 'keysafe') return bridge?.keysafeStart?.();
    if (id === 'dotenvx-gui' || id === 'github-overview') {
        const launch = launchArgsFor(id);
        if (launch) return bridge?.localhostStartNow?.(launch);
    }
    return undefined;
}
