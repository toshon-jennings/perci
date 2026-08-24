import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, ExternalLink, Play, RefreshCw } from 'lucide-react';
import dotenvxLogo from '../assets/dotenvx-logo.png';
import { launchArgsFor } from '../lib/localServices';

export const DOTENVX_ORIGIN = 'http://127.0.0.1:7843';
const DOTENVX_REPO_URL = 'https://github.com/toshonjennings/dotenvx-gui';

export default function DotenvxMode() {
    const canUseWebview = typeof window !== 'undefined' && Boolean(window.electron);
    const canStart = canUseWebview
        && Boolean(window.electron?.localhostStartNow)
        && Boolean(launchArgsFor('dotenvx-gui'));
    const webviewRef = useRef(null);
    const autoStartedRef = useRef(false);
    const [frameKey, setFrameKey] = useState(0);
    const [status, setStatus] = useState(canUseWebview ? 'checking' : 'desktop-only');
    const [contentReady, setContentReady] = useState(false);
    const [error, setError] = useState(null);

    const checkHealth = useCallback(async () => {
        if (!window.electron?.localhostCheckHealth) return false;
        const result = await window.electron.localhostCheckHealth(DOTENVX_ORIGIN);
        return Boolean(result?.ok);
    }, []);

    const reload = useCallback(() => {
        setContentReady(false);
        setError(null);
        setStatus(canUseWebview ? 'checking' : 'desktop-only');
        setFrameKey(key => key + 1);
    }, [canUseWebview]);

    useEffect(() => {
        if (!canUseWebview) return undefined;
        let active = true;
        setStatus('checking');
        (async () => {
            try {
                const installCheck = await window.electron?.dotenvxCheckInstall?.();
                if (!active) return;
                if (installCheck && installCheck.installed === false) {
                    setStatus('not-installed');
                    return;
                }
            } catch (_) {
                // An unreachable install check shouldn't block a server that's
                // actually running — fall through to the health probe.
            }
            try {
                const online = await checkHealth();
                if (active) setStatus(online ? 'online' : 'offline');
            } catch (healthError) {
                if (!active) return;
                setError(healthError.message || 'Dotenvx is not reachable.');
                setStatus('offline');
            }
        })();
        return () => { active = false; };
    }, [canUseWebview, checkHealth, frameKey]);

    useEffect(() => {
        if (!canUseWebview || status !== 'online') return undefined;
        const webview = webviewRef.current;
        if (!webview) return undefined;

        const onReady = () => {
            setContentReady(true);
            setError(null);
        };
        const onFail = (event) => {
            if (!event.isMainFrame || event.errorCode === -3) return;
            setContentReady(false);
            setError(event.errorDescription || `Failed to load (code ${event.errorCode}).`);
            setStatus('offline');
        };
        const onNewWindow = (event) => {
            event.preventDefault();
            if (/^https?:\/\//.test(event.url)) window.electron?.openExternal?.(event.url);
        };

        webview.addEventListener('dom-ready', onReady);
        webview.addEventListener('did-fail-load', onFail);
        webview.addEventListener('new-window', onNewWindow);
        return () => {
            webview.removeEventListener('dom-ready', onReady);
            webview.removeEventListener('did-fail-load', onFail);
            webview.removeEventListener('new-window', onNewWindow);
        };
    }, [canUseWebview, frameKey, status]);

    const startServer = useCallback(async () => {
        const launch = launchArgsFor('dotenvx-gui');
        if (!launch || !window.electron?.localhostStartNow) return;
        setStatus('starting');
        setError(null);
        try {
            const result = await window.electron.localhostStartNow(launch);
            if (!result?.ok) throw new Error(result?.error || 'Dotenvx did not start.');

            let online = false;
            for (let attempt = 0; attempt < 12; attempt += 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
                online = await checkHealth();
                if (online) break;
            }
            if (!online) throw new Error('Dotenvx started but did not answer on port 7843.');
            reload();
        } catch (startError) {
            setError(startError.message || 'Dotenvx did not start.');
            setStatus('offline');
        }
    }, [checkHealth, reload]);

    useEffect(() => {
        if (status !== 'offline' || autoStartedRef.current || !canStart) return;
        autoStartedRef.current = true;
        startServer();
    }, [canStart, startServer, status]);

    const canInstall = canUseWebview && Boolean(window.electron?.dotenvxInstall);

    const installAndStart = useCallback(async () => {
        if (!window.electron?.dotenvxInstall) return;
        setStatus('installing');
        setError(null);
        try {
            const result = await window.electron.dotenvxInstall();
            if (!result?.ok) throw new Error(result?.error || 'Install failed.');
            autoStartedRef.current = true; // this call replaces the offline->auto-start effect's attempt
            await startServer();
        } catch (installError) {
            setError(installError.message || 'Failed to install Dotenvx.');
            setStatus('not-installed');
        }
    }, [startServer]);

    const openRepo = useCallback(() => {
        if (window.electron?.openExternal) window.electron.openExternal(DOTENVX_REPO_URL);
        else window.open(DOTENVX_REPO_URL, '_blank', 'noopener,noreferrer');
    }, []);

    const openExternal = useCallback(() => {
        if (window.electron?.openExternal) window.electron.openExternal(DOTENVX_ORIGIN);
        else window.open(DOTENVX_ORIGIN, '_blank', 'noopener,noreferrer');
    }, []);

    const statusLabel = status === 'online'
        ? 'Connected'
        : status === 'starting'
            ? 'Starting'
            : status === 'installing'
                ? 'Installing'
                : status === 'checking'
                    ? 'Checking'
                    : status === 'not-installed'
                        ? 'Not installed'
                        : 'Offline';

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--bg-primary)]">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3">
                <button
                    type="button"
                    onClick={reload}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    title="Reload Dotenvx"
                    aria-label="Reload Dotenvx"
                >
                    <RefreshCw size={14} />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-[var(--bg-tertiary)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)]">
                    <span className="truncate">{DOTENVX_ORIGIN}</span>
                    <span className="ml-auto shrink-0 font-sans text-[11px] text-[var(--text-secondary)]">{statusLabel}</span>
                </div>
                <button
                    type="button"
                    onClick={openExternal}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    title="Open Dotenvx in browser"
                    aria-label="Open Dotenvx in browser"
                >
                    <ExternalLink size={14} />
                </button>
            </div>

            {status === 'online' && canUseWebview ? (
                <div className="relative min-h-0 flex-1">
                    <webview
                        ref={webviewRef}
                        key={frameKey}
                        src={DOTENVX_ORIGIN}
                        className="absolute inset-0 h-full w-full border-0"
                        partition="persist:perci-dotenvx"
                        title="Dotenvx"
                    />
                    {!contentReady && (
                        <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--bg-primary)]">
                            <p className="text-sm text-[var(--text-secondary)]">Loading Dotenvx…</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-8">
                    <div className="max-w-md text-center">
                        <img src={dotenvxLogo} alt="" className="mx-auto h-16 w-16" />
                        <h2 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">
                            {status === 'desktop-only'
                                ? 'Open Dotenvx in the Perci desktop app'
                                : status === 'not-installed'
                                    ? "Dotenvx isn't installed"
                                    : status === 'installing'
                                        ? 'Installing Dotenvx…'
                                        : status === 'starting' || status === 'checking'
                                            ? 'Connecting to Dotenvx…'
                                            : 'Dotenvx is not running'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {status === 'desktop-only'
                                ? 'Dotenvx blocks iframe embedding to protect local environment files. Perci uses an isolated Electron webview for this window.'
                                : status === 'not-installed'
                                    ? "Dotenvx GUI is a separate open-source app. Installing clones it from GitHub into ~/dotenvx-gui and runs npm install — you'll need a network connection."
                                    : status === 'installing'
                                        ? 'Cloning the repository and installing dependencies. This can take a minute.'
                                        : 'Perci can launch the loopback-only Dotenvx service from ~/dotenvx-gui and keep its security boundary intact.'}
                        </p>
                        {error && (
                            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]" role="alert">
                                <AlertCircle size={13} /> {error}
                            </p>
                        )}
                        <div className="mt-5 flex justify-center gap-2">
                            {status === 'not-installed' && canInstall && (
                                <button
                                    type="button"
                                    onClick={installAndStart}
                                    className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
                                >
                                    <Download size={14} /> Install Dotenvx
                                </button>
                            )}
                            {status === 'offline' && canStart && (
                                <button
                                    type="button"
                                    onClick={startServer}
                                    className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
                                >
                                    <Play size={14} /> Start Dotenvx
                                </button>
                            )}
                            {status === 'not-installed' ? (
                                <button
                                    type="button"
                                    onClick={openRepo}
                                    className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                                >
                                    <ExternalLink size={14} /> View on GitHub
                                </button>
                            ) : status !== 'installing' && (
                                <button
                                    type="button"
                                    onClick={status === 'desktop-only' ? openExternal : reload}
                                    className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                                >
                                    {status === 'desktop-only' ? <ExternalLink size={14} /> : <RefreshCw size={14} />}
                                    {status === 'desktop-only' ? 'Open in browser' : 'Check again'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
