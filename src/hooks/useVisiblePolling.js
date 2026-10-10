import { useEffect, useRef } from 'react';
import { createVisiblePoller } from '../lib/visiblePoller';

export function useVisiblePolling(run, intervalMs, visible) {
    const runRef = useRef(run);
    runRef.current = run;
    const pollerRef = useRef(null);
    useEffect(() => {
        const poller = createVisiblePoller({ run: current => runRef.current(current), intervalMs });
        pollerRef.current = poller;
        return () => { poller.dispose(); pollerRef.current = null; };
    }, [intervalMs]);
    useEffect(() => { pollerRef.current?.setVisible(visible); }, [visible, intervalMs]);
}
