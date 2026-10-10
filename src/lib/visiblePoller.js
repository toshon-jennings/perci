// Polling observes a view; it never owns the operation being observed.
export function createVisiblePoller({ run, intervalMs, onError = () => {} }) {
    let visible = false;
    let disposed = false;
    let generation = 0;
    let timer = null;
    let inFlight = false;
    let refreshPending = false;

    const clear = () => { clearTimeout(timer); timer = null; };
    const poll = async () => {
        if (!visible || disposed) return;
        if (inFlight) { refreshPending = true; return; }
        inFlight = true;
        refreshPending = false;
        const current = generation;
        try {
            await run(() => !disposed && visible && generation === current);
        } catch (error) {
            if (!disposed && visible && generation === current) onError(error);
        } finally {
            inFlight = false;
            if (!disposed && visible) {
                timer = setTimeout(poll, refreshPending ? 0 : intervalMs);
            }
        }
    };
    return {
        setVisible(next) {
            if (disposed || visible === next) return;
            visible = next;
            generation += 1;
            clear();
            if (visible) void poll();
        },
        dispose() { disposed = true; generation += 1; clear(); },
    };
}
