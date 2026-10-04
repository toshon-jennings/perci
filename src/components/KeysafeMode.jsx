import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldAlert, Play, Loader2 } from 'lucide-react';
import keysafeLogo from '../assets/keysafe-logo.jpeg';
import './KeysafeMode.css';

const KEYSAFE_ORIGIN = 'http://127.0.0.1:4100';

export default function KeysafeMode() {
    const [status, setStatus] = useState('checking'); // checking | running | offline | starting
    const [statusDetail, setStatusDetail] = useState('');
    const webviewRef = useRef(null);
    const [frameKey, setFrameKey] = useState(0);

    const checkAlive = useCallback(async () => {
        if (window.electron?.keysafeStatus) {
            const result = await window.electron.keysafeStatus();
            if (!result?.ok && result?.reason === 'unauthorized-listener') {
                setStatusDetail('Port 4100 is occupied by a service this Perci launch cannot authenticate. KeySafe will not attach to it.');
            }
            return result?.ok === true && result?.productId === 'keysafe';
        }
        try {
            await fetch(`${KEYSAFE_ORIGIN}/`, {
                mode: 'no-cors',
                cache: 'no-store',
                signal: AbortSignal.timeout(1500),
            });
            return true;
        } catch {
            return false;
        }
    }, []);

    // Initial check
    useEffect(() => {
        let active = true;
        (async () => {
            const isAlive = await checkAlive();
            if (!active) return;
            if (isAlive) {
                setStatus('running');
            } else {
                setStatus('offline');
            }
        })();
        return () => {
            active = false;
        };
    }, [checkAlive]);

    useEffect(() => {
        const webview = webviewRef.current;
        if (!window.electron || !webview) return;

        const handleFail = (event) => {
            if (event.errorCode !== -3) setStatus('offline');
        };
        webview.addEventListener('did-fail-load', handleFail);
        return () => webview.removeEventListener('did-fail-load', handleFail);
    }, [frameKey, status]);

    const handleLaunch = useCallback(async () => {
        if (!window.electron?.keysafeStart) return;
        setStatus('starting');
        try {
            const result = await window.electron.keysafeStart();
            if (!result?.ok) throw new Error(result?.error || 'KeySafe did not start.');
            setStatusDetail('');
            setStatus('running');
        } catch (err) {
            console.error('[KeySafe] Authenticated server launch failed');
            setStatusDetail(err instanceof Error ? err.message : 'KeySafe failed its authenticated identity check.');
            setStatus('offline');
        }
    }, []);

    const handleReload = useCallback(() => {
        setFrameKey((prev) => prev + 1);
    }, []);

    // ── 1. Checking state ───────────────────────────────────────────
    if (status === 'checking') {
        return (
            <div className="keysafe-status-container">
                <div className="keysafe-status-card">
                    <Loader2 size={32} className="keysafe-spinner animate-spin text-[var(--accent)]" />
                    <p className="keysafe-status-text">Detecting KeySafe service...</p>
                </div>
            </div>
        );
    }

    // ── 2. Starting state ───────────────────────────────────────────
    if (status === 'starting') {
        return (
            <div className="keysafe-status-container">
                <div className="keysafe-status-card">
                    <Loader2 size={32} className="keysafe-spinner animate-spin text-[var(--accent)]" />
                    <p className="keysafe-status-text">Starting authenticated KeySafe server...</p>
                    <p className="keysafe-status-subtext">Verifying product identity and this Perci launch.</p>
                </div>
            </div>
        );
    }

    // ── 3. Offline / Setup state ────────────────────────────────────
    if (status === 'offline') {
        return (
            <div className="keysafe-status-container">
                <div className="keysafe-offline-card">
                    <div className="keysafe-logo-ring">
                        <img src={keysafeLogo} alt="KeySafe Logo" className="keysafe-hero-logo" />
                    </div>

                    <div className="keysafe-header-group">
                        <h2 className="keysafe-offline-title">KeySafe is Offline</h2>
                        <p className="keysafe-offline-desc">
                            {statusDetail || 'KeySafe is a local-first credential manager. Vault records are encrypted before they are written to IndexedDB and unlocked only inside this window.'}
                        </p>
                    </div>

                    <div className="keysafe-badge-group">
                        <span className="keysafe-status-badge offline">
                            <ShieldAlert size={12} />
                            Offline
                        </span>
                    </div>

                    <div className="keysafe-instructions">
                        <p className="keysafe-instruction-title">Start Local Server</p>
                        <p className="keysafe-instruction-body">
                            Perci launches KeySafe&apos;s production build with a private per-launch token, then verifies its product ID, version, and launch nonce.
                        </p>
                        <div className="keysafe-command-box">
                            <code>Authenticated launch required</code>
                        </div>
                    </div>

                    <div className="keysafe-actions-group">
                        <button
                            type="button"
                            onClick={handleLaunch}
                            className="keysafe-btn keysafe-btn-primary"
                        >
                            <Play size={14} fill="currentColor" />
                            Launch KeySafe Server
                        </button>

                        <button
                            type="button"
                            onClick={async () => {
                                setStatus('checking');
                                const isAlive = await checkAlive();
                                setStatus(isAlive ? 'running' : 'offline');
                            }}
                            className="keysafe-btn keysafe-btn-secondary"
                        >
                            <RefreshCw size={14} />
                            Retry Check
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── 4. Running/WebView state ────────────────────────────────────
    return (
        <div className="keysafe-window-root">
            <div className="keysafe-nav-bar">
                <button
                    type="button"
                    onClick={handleReload}
                    className="keysafe-nav-btn"
                    title="Reload KeySafe"
                >
                    <RefreshCw size={14} />
                </button>

                <div className="keysafe-address-bar">
                    <span className="keysafe-live-dot" />
                    <span className="keysafe-url-text">{KEYSAFE_ORIGIN}</span>
                </div>

                <span className="keysafe-status-badge">Authenticated</span>
            </div>

            {window.electron ? (
                React.createElement('webview', {
                    useragent: 'Perci-KeySafe-Guest/1',
                    ref: webviewRef,
                    key: frameKey,
                    src: KEYSAFE_ORIGIN,
                    className: 'keysafe-webview',
                    // KeySafe originally lived in Perci's localhost profile.
                    // Keep that durable profile so existing IndexedDB records remain visible.
                    partition: 'persist:perci-localhost',
                    webpreferences: 'contextIsolation=yes, nodeIntegration=no, sandbox=yes, webSecurity=yes',
                })
            ) : (
                <iframe
                    ref={webviewRef}
                    key={frameKey}
                    src={KEYSAFE_ORIGIN}
                    className="keysafe-webview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    title="KeySafe"
                />
            )}
        </div>
    );
}
