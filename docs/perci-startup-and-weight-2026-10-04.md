# Perci startup fixes and reducing its weight

## Startup fixes

KeySafe's mount effect previously checked health and stopped at offline. It now invokes the existing authenticated server launcher once when the window mounts and the service is offline. An occupied or unauthenticated port still fails closed; browser-only mode stays offline when native launch is unavailable.

Eidos already launches on mount, but the renderer returned early on the recoverable `orbstack-stopped` status. It now reaches the main-process startup path that starts OrbStack. Missing Docker/OrbStack still reports an error. An obsolete guest-preload lookup and unused imports were removed.

These changes concern windows opened or restored in Perci, not macOS login items. Neither service starts merely because its icon exists in the catalog.

## Measured and inspected

The installed app restored 11 windows. A process snapshot measured about 594 MiB of resident memory across 14 processes belonging to its main process. This is an approximate sum, not unique physical memory; shared pages can be counted more than once. Docker containers and separate Node services are excluded.

`App.jsx` eagerly imports mode implementations. The production main JavaScript chunk is about 1.94 MB and the vendor chunk about 1.57 MB before compression. `DesktopHost` renders all restored windows; `WindowFrame` preserves minimized components with display:none, including their hooks and embedded guests.

## Recommended sequence

1. Add independent per-app settings for enabled, restore window, and start service. Default optional integrations to launch on demand. Keep Eidos and KeySafe startup enabled if wanted.
2. Restore unopened/minimized integrations as placeholders and mount them only when first selected. Preserve drafts before introducing any unloading of already-used windows. Keep services and views as separate lifecycles.
3. Lazy-import mode implementations and their export/editor/graph libraries. This reduces initial parsing and initialization, rather than eliminating Electron's baseline cost.
4. Pause polling for inactive integrations; avoid running multiple port scans and health checks for overlapping views.
5. Offer "Open externally" for occasional services such as GitHub Overview, IPTV, SimpleX, Open Notebook, Apfel, and extra browser tabs. Retain integrations as optional launchers before considering removal.

Recommended architecture: a small Perci workspace shell plus selectable integrations. Measure process count, startup time, idle CPU, and memory with the same restored-window set before and after each change. No performance savings are claimed until measured.

Electron's official guidance supports deferring unnecessary work and avoiding blocking the main process: https://www.electronjs.org/docs/latest/tutorial/performance .

## Candidate verification

Perci 0.50.2 candidate built from a clean export with only the startup changes and version files overlaid; unrelated NotesMode edits were excluded. All 238 tests passed. Both changed components pass ESLint. The candidate ad-hoc signature verifies. Native runtime test launched KeySafe through the real authenticated production server once and called the Eidos start handler once in response to a simulated stopped-OrbStack status. This proves renderer recovery logic, not a completed live container startup. The Eidos frame is blank in the fixture screenshot because its backend was deliberately simulated; it is not dashboard acceptance evidence. Existing live services/profile were not reset.

Candidate: `release-build/0.50.2/dist_electron/mac-arm64/Perci.app`. Installation/restart approval is pending under the no-quit rule. No public release was created.

## Approved local installation

User confirmed installation/restart. Perci was no longer running; the leftover Perci-owned terminal helper was stopped for the approved restart. Original 0.50.1 bundle preserved at `release-build/rollback-0.50.1/Perci.app`; its app.asar hash matches the original installed bundle. A clean 0.50.2 bundle was installed to `/Applications/Perci.app`; its signature verifies and its app.asar hash matches the tested candidate. No production profile reset or public release occurred.

Live startup is blocked in macOS Keychain access: a process sample of the installed main process shows SecItemCopyMatching, and SecurityAgent is running. User was asked to handle the native prompt; computer use cannot operate SecurityAgent. Full live Eidos/KeySafe acceptance remains pending. Sample retained in `release-build/installed-startup-sample.txt`; installation identity is in `test/runtime-evidence/installed-0.50.2.json`.
