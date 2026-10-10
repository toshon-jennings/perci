import { createContext, useContext, useEffect, useState } from 'react';
import { useMode } from './ModeContext';
import { shouldAutoStartService } from '../lib/performancePolicy';

export const WindowActivityContext = createContext({ isVisible: true, isFocused: true, launchIntent: 'restored' });

export function useAppVisibility() {
    const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
    useEffect(() => {
        const update = () => setVisible(document.visibilityState !== 'hidden');
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);
    return visible;
}

export function useWindowActivity() {
    const activity = useContext(WindowActivityContext);
    const { performancePolicy } = useMode();
    return { ...activity, shouldUpdate: activity.isVisible || !performancePolicy.pauseHiddenViews };
}

export function useServiceAutoStart(id) {
    const { launchIntent } = useContext(WindowActivityContext);
    const { performancePolicy } = useMode();
    return shouldAutoStartService(performancePolicy, id, launchIntent);
}
