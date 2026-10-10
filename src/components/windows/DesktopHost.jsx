import React, { Suspense, useEffect, useRef } from 'react';
import { WindowActivityContext, useAppVisibility } from '../../context/WindowActivityContext';
import { useMode } from '../../context/ModeContext';
import WindowFrame from './WindowFrame';
import WindowErrorBoundary from './WindowErrorBoundary';

// Overlay layer that renders the open windows above the Chat base. The host
// itself is click-through (pointer-events: none); each window re-enables
// pointer events. Windows are painted in z-index order; the top non-minimized
// window is the active one. `renderContent(modeId)` supplies the mode UI so the
// caller can pass any props a mode needs (e.g. Mission Control).
export default function DesktopHost({ renderContent }) {
    const { windows, focusWindow, focusDashboard, viewActivations } = useMode();
    const appVisible = useAppVisibility();
    const sorted = [...windows].sort((a, b) => a.z - b.z);
    const activeId = [...sorted].reverse().find(w => w.state !== 'minimized')?.id;
    const activeIdRef = useRef(activeId);

    useEffect(() => {
        activeIdRef.current = activeId;
    }, [activeId]);

    // Native capture listeners are the desktop-wide fallback for normal DOM
    // clicks and the dashboard background. Inactive window bodies are handled by
    // WindowFrame's focus shield so webview/iframe clicks never need to escape
    // the embedded document.
    useEffect(() => {
        const handleWindowActivation = (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;

            if (e.type === 'mousedown' && e.button !== 0) return;

            // The shield owns inactive-window body activation. Returning here
            // avoids duplicate z-index increments from document + shield handlers.
            if (target.closest('.perci-window-focus-shield')) {
                return;
            }

            // Walk up from event target to find the nearest .perci-window ancestor.
            const winEl = target.closest('.perci-window');
            if (winEl?.dataset.windowId) {
                if (winEl.dataset.windowId !== activeIdRef.current) {
                    activeIdRef.current = winEl.dataset.windowId;
                    focusWindow(winEl.dataset.windowId);
                }
            } else {
                // Click is not on any window — check if it's on the desktop background
                // (not on dock, launcher, or interactive elements like buttons/inputs)
                if (activeIdRef.current && !target.closest('.perci-dock, .perci-sirperci-panel, button, a, input, textarea, select, [role="button"]')) {
                    activeIdRef.current = undefined;
                    focusDashboard();
                }
            }
        };

        window.addEventListener('pointerdown', handleWindowActivation, { capture: true });
        window.addEventListener('mousedown', handleWindowActivation, { capture: true });
        return () => {
            window.removeEventListener('pointerdown', handleWindowActivation, { capture: true });
            window.removeEventListener('mousedown', handleWindowActivation, { capture: true });
        };
    }, [focusWindow, focusDashboard]);

    if (!windows.length) return null;

    return (
        <div className="perci-desktop-host">
            {sorted.map(win => (
                <WindowFrame key={win.id} win={win} active={win.id === activeId} modeId={win.modeId}>
                    <WindowErrorBoundary label={win.title}>
                        {viewActivations[win.id] ? (
                            <WindowActivityContext.Provider value={{ windowId: win.id, isVisible: appVisible && win.state !== 'minimized', isFocused: win.id === activeId, launchIntent: viewActivations[win.id] }}>
                                <Suspense fallback={<div className="p-6 text-[var(--text-secondary)]" role="status">Loading {win.title}…</div>}>
                                    {renderContent(win.modeId)}
                                </Suspense>
                            </WindowActivityContext.Provider>
                        ) : (
                            <div className="flex h-full items-center justify-center p-6">
                                <button type="button" onClick={() => focusWindow(win.id)} className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]">Open {win.title}</button>
                            </div>
                        )}
                    </WindowErrorBoundary>
                </WindowFrame>
            ))}
        </div>
    );
}
