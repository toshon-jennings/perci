# Perci Performance Implementation Plan

Date: October 9, 2026
Status: Source and packaged native acceptance implemented; final serial measurements and audit review in progress (October 10).
Route: Sol Advisor `solo` for planning; approved `audit` route for implementation. Primary Sol / High confirmed; root implements and verifies, then a fresh Sol reviewer audits.

## Outcome

Perci should start as a usable workspace shell, remember the user's window layout, and load optional tools when the user selects them. Opening a tool may start its service according to its setting; restoring its window must not accidentally start the service. Hidden Perci-owned views should stop unnecessary polling and animation without losing work or interrupting running jobs.

Implement in small, separately verified phases in `/Users/toshonjennings/opal`. Retain Electron and the existing window/dock model. Do not replace the application framework or build a new service manager.

## Evidence and boundaries

| Observation | Evidence | Consequence |
| --- | --- | --- |
| Restored windows mount all their contents | `src/context/ModeContext.jsx` hydrates `perci_open_windows`; `src/components/windows/DesktopHost.jsx` calls `renderContent` for every window | Remembering a layout currently initializes every restored tool |
| Minimized windows retain their contents | `src/components/windows/WindowFrame.jsx` sets `display:none` and retains children | Minimizing is state preservation, not memory reclamation |
| Several mounted tools start services | Mount/offline effects in `EidosMode.jsx`, `KeysafeMode.jsx`, `DotenvxMode.jsx`, and `GithubOverviewMode.jsx` | Deferring the view and controlling service starts are separate requirements |
| Mode code is imported upfront | Imports and `renderWindowContent` in `src/App.jsx` | Feature code needs real dynamic-import boundaries |
| A static import bypasses an obvious boundary | Dashboard and Office import agent definitions/status sets from `AgentsPanel.jsx` | Move shared data to one small module before making Agents lazy |
| Hidden views have work to pause | Dashboard job polling: 10s; Office: 5s; Eidos overview refresh; Docker polling; OfficeScene continuous Canvas | Visibility must be available to those effects |
| Production chunk layout has known hazards | `vite.config.js` documents prior React/vendor and markdown/syntax dependency cycles under `file://` | Keep the existing compatibility rules and verify actual packaged lazy loading |

The October 4 report measured approximately 594 MiB of summed RSS across 14 Perci processes. The October 9 inspection in this chat found roughly 1 GB of Perci physical-footprint accounting and about 2.5 GB for OrbStack separately; one renderer inspection was incomplete. These are different snapshots and different metrics, not a before/after comparison. The reported 10 GB has not been reproduced. OrbStack is shared infrastructure; its entire usage cannot be attributed to Perci or Eidos.

The architecture graph is an orientation aid and is older than some product changes. Current named source files govern this plan.

## Selected architecture

Keep three distinct lifecycles:

1. **Window record:** ID, title, bounds, z-order, minimized/maximized state. Persist with the existing window keys.
2. **View:** deferred, loading, mounted, or failed. Track activation in session memory; do not persist it as a window geometry field.
3. **Service:** offline, starting, running, or failed. Starting and observing services remain in the existing authenticated native paths. View hiding/unmounting never implies stopping a service.

Add a small `src/lib/performancePolicy.js` for defaults and normalization, and a small `src/context/WindowActivityContext.jsx` for view activity. Reuse `persistentStore.js`, the window manager, existing local-service definitions, guest policies, and launch IPC. Do not duplicate their catalogs or create a second persistence system.

### Persisted settings

Register one versioned non-secret key, `perci_performance:v1`, in `src/lib/persistentStore.js`. Its initial shape is:

```json
{
  "version": 1,
  "restoreViews": "deferred",
  "pauseHiddenViews": true,
  "services": {
    "eidos": "on-open",
    "keysafe": "on-open",
    "dotenvx-gui": "on-open",
    "github-overview": "on-open"
  }
}
```

`restoreViews` accepts `deferred` or `immediate`. A service policy accepts `on-open`, `manual`, or `on-startup`. Default existing automatic integrations to `on-open`: this preserves automatic recovery after deliberately opening the tool, including the recent Eidos/KeySafe fixes. Other integrations retain their existing manual launch behavior and are not silently enrolled in auto-start.

Missing settings use these defaults. Validate types, bound serialized input, accept only known keys/IDs/enums, and discard unsupported values. Hydrate before constructing the window manager, using the existing startup hydration. Persist changes without rewriting window records or guest storage. A new policy takes effect for future starts; changing a setting must not stop a running service or unload a used view.

`on-startup` is an explicit opt-in, independent of whether a window is restored. Start those supported services once after hydration; do not mount their UI as a prerequisite. Switching to `on-startup` while the app is already running applies on the next launch. Restoring an `immediate` view is not an explicit user open and does not grant an `on-open` service start.

### View transitions

| Trigger | Required behavior |
| --- | --- |
| Launch with saved windows, deferred setting | Restore frames, dock entries, geometry, and states; show a small “Open [tool]” placeholder in visible frames; create no tool component/webview/iframe |
| Dock selection, keyboard cycle, focus shield, launcher, or placeholder action | Mark that window activated, mount its view once, and allow its configured on-open service behavior |
| Focus another visible window | Preserve the first view and its state; do not equate unfocused with hidden |
| Minimize or native app becomes hidden | Preserve mounted content; pause eligible Perci-owned view work |
| Restore/show a mounted view | Resume work and perform one fresh status read; do not remount or issue a duplicate service start |
| Close a deferred record | Remove the window record without mounting the view |
| Close a used record | Keep the existing close behavior; this task adds no automatic closing or service termination |
| Chunk-load failure | Show a per-window error with a recovery action; other windows stay usable |

All actual activation routes must use one window-manager transition, including refocusing an existing window through `openWindow`. Closing and reopening must not reuse a stale activation token. Unknown/removed mode IDs must not create arbitrary loaders. Keep current YouTube restoration exclusion and existing ephemeral Artifact/Research behavior.

Window activity exposes `{ windowId, isVisible, isFocused }`. `isVisible` means a non-minimized window and a visible application document; it does not attempt expensive pixel occlusion detection. Dashboard receives application visibility, not “no window is focused.” Use activity to pause display work, never job execution.

### Service concurrency and lifetime

Keep the existing native start handlers and strengthen them with one in-flight promise per supported service. Concurrent startup/open/Retry requests join that promise; resolve/reject it once, and clear it in `finally` so deliberate retries can work. Eidos is one shared operation, including OrbStack readiness, compose, API readiness, and dashboard startup. KeySafe retains its health identity check, token/nonce handling, and existing process reference.

Pass launch intent explicitly to the view or a small shared renderer helper: `restored`, `user-open`, `startup`, or `manual`. Only `user-open` grants `on-open`; only configured startup work grants `on-startup`; an explicit Start button works under every policy. A restored mounted view may probe an existing service without launching an offline one. Known app IDs resolve to existing launch functions/catalog data, never settings-supplied commands, ports, URLs, or credentials.

Do not cancel an accepted native start when a view is minimized or closed: another view can be waiting for it. Ignore late UI results using a component generation/mounted token, and let a reopened view probe the service. Prevent repeated automatic retries on unrelated rerenders; retry after an explicit action. Surface timeout/identity errors accurately.

## Phases and acceptance gates

### Phase 0 — Establish a reproducible baseline

**Scope:** Add `scripts/measure-perci-performance.mjs`, with durable output under `docs/performance-evidence/`. Adapt the native disposable-profile technique from `test/runtime-evidence/probe-autostart.mjs` and `probe-packaged.mjs`; do not operate the user's production profile.

Record source SHA and dirty scope, app/Electron version and artifact hash, hardware, viewport, profile fixture, selected policies, existing external-service state, process tree, guest count, private/physical-footprint memory, CPU, and elapsed time to usable shell. Distinguish shell usability from splash completion and first-tool readiness. Use a bounded PID tree and label helper types. Keep RSS only as an auxiliary metric: macOS compression can make it misleading, as documented by [Electron's memory API](https://www.electronjs.org/docs/latest/api/process#processgetprocessmemoryinfo).

Fixtures: empty desktop; the same fixed saved-window set for baseline/candidate (Chat, Code, Notes, Office, Eidos, KeySafe, Dotenvx, GitHub Overview, Localhost, Docker, OpenCode, with some minimized); explicit sequential activation; and a synthetic active stream/terminal job. Store synthetic fixtures separately from measurement output, and do not export actual chats, URLs with credentials, screenshots of secrets, or heap snapshots from a real profile.

Run three comparable packaged launches per startup fixture; report medians and spread after 60 seconds idle. Also sample after 5 minutes idle and a 20-minute fixed open/minimize/restore cycle. Keep external service conditions identical for Perci view comparisons. Simulated launch handlers verify intent/counts but cannot prove backend memory savings. If a single process approaches the reported 10 GB, identify that process and its growth with a synthetic reproduction before claiming this architecture resolves it.

**Gate:** Baseline artifacts exist with metrics, measurement caveats, and a documented reproduction command. Native fixtures must not take over occupied live ports. Mock service starts for core view tests; use already-authorized isolated services/ephemeral ports for real start tests. Obtain explicit confirmation before stopping any test service, installed app, or shared runtime, even at cleanup.

### Phase 1 — Defer restored views and expose activity

**Files:** `src/context/ModeContext.jsx`, `src/components/windows/DesktopHost.jsx`, new `src/context/WindowActivityContext.jsx`, new `src/lib/performancePolicy.js`, `src/lib/persistentStore.js`, and focused native lifecycle tests.

Introduce session activation state separate from persisted geometry. DesktopHost must not call `renderContent` until activation. It provides activity around mounted children, while WindowFrame keeps responsibility for geometry, focus shields, animations, and chrome. Every opening/focusing path activates consistently. Preserve mounted children through minimize/restore.

**Gate:** The saved 11-window fixture restores its layout with zero optional guests and zero tool-start requests in deferred mode. Activating one tool mounts only that tool. Keyboard switching and window focus shields work. Untyped drafts, typed synthetic drafts, unsaved Notes edits, Code buffers, terminal output, and an active synthetic response survive minimize/restore. Policy survives app reload in native and web fallback modes. Test real mounting and IPC calls, not only source string matches.

### Phase 2 — Separate service launch from restoration

**Files:** `src/App.jsx`, `src/components/EidosMode.jsx`, `KeysafeMode.jsx`, `DotenvxMode.jsx`, `GithubOverviewMode.jsx`, `electron/main.cjs`, and existing service/native startup tests. Reuse `src/lib/localServices.js`; only modify it if a needed supported mapping is absent.

Replace unconditional mount/offline start effects with the intent/policy rules above. Add main-process single-flight guards for the four supported automatic launch paths. Add the startup opt-in dispatcher in the shell after hydration. Preserve all Eidos recovery stages and KeySafe authentication checks. Other tools' manual Start buttons stay manual.

**Gate:** Deferred and immediate restoration cause no on-open starts. Deliberately selecting offline Eidos/KeySafe still starts them once. Manual mode probes without launching until Start is pressed. Startup opt-in starts once with no view mounted. Rapid click/Retry/reopen and React effect repetition cannot create parallel native starts. Failures allow explicit retry. Unrelated listeners remain untouched. Existing KeySafe identity, guest, and credential tests still pass.

### Phase 3 — Load feature code when needed

**Files:** `src/App.jsx`, `src/components/windows/DesktopHost.jsx`, `src/components/AgentsPanel.jsx`, `DashboardMode.jsx`, `OfficePanel.jsx`, and new `src/lib/agentDefinitions.js`. Inspect `vite.config.js`; change it only if measured dependency output requires it.

Move the existing agent definitions/status sets into one shared data module and update consumers/re-exports as needed. Keep the shell, Dashboard, window manager, and state-owning providers eager. Declare optional mode components with module-scope `React.lazy` and dynamic imports. Put Suspense inside each window's error boundary so window controls and the desktop remain responsive during loading. Load Settings when requested as well if its static reachability no longer requires it at startup. React caches rejected lazy loads too: an explicit Retry must replace only the failed loader entry before its first successful mount, not merely reset the error boundary or reload the whole app. Successful loader identities remain stable; use a bounded module-scope cache in App rather than recreating components during rendering.

Keep provider identity and tree placement stable: moving Chat/Build providers into lazy windows could reset shared state. Trace any remaining eager editor/export/3D dependencies through the production chunk graph. Use dynamic imports at feature/action boundaries for dependencies that remain reachable only because of an export action. Preserve the documented React/vendor and markdown/syntax compatibility rules. Do not split everything into new vendor buckets or assume more files means less startup work. Remove the verified duplicate `OPEN_NOTEBOOK_WINDOW_ID` switch case when touching that switch; leave unrelated legacy code for a separate task.

**Gate:** In the packaged `file://` app, untouched editor/export/Office feature code is not evaluated before activation where the dependency graph permits separation; record any shared dependency that remains eager. Opening every changed lazy mode works after a fresh launch. Synthetic import failure stays confined to one window. No circular initialization/white-screen errors. Drafts and selected files survive focus/minimize because lazy component identities are stable. Capture initial executed JS and parse/initialization time, not only compressed download size. [React documents stable lazy declarations and cached loading](https://react.dev/reference/react/lazy).

### Phase 4 — Pause hidden work without discarding state

**Files:** `src/components/DashboardMode.jsx`, `OfficePanel.jsx`, `OfficeScene.jsx`, `EidosMode.jsx`, `DockerMode.jsx`, `OpencodeMode.jsx`, and `src/App.jsx`; new `src/hooks/useVisiblePolling.js` only for recurring view polling with matching behavior.

Use one small visibility-aware polling helper where appropriate: one request at a time, cleanup timers on hiding/unmount, discard stale results by generation, and refresh once on resuming. If a request from the previous visibility generation is still running, queue that refresh until it settles rather than overlap it. Retain existing visible intervals. Pause Dashboard clock/jobs while the app document is hidden; pause Office jobs, Eidos overview scans, and Docker list refresh while their view is hidden. Treat start-progress polling separately: the native start continues, while hidden progress observation pauses and reprobes on return. Keep the shell's gateway status monitor at its existing visible cadence and a 120-second hidden cadence, with an immediate refresh on return; it supports global status and must not disappear merely because the OpenClaw view is unfocused.

Pass Office visibility to Canvas and use `frameloop="never"` when hidden, restoring its prior visible mode on return. Gate separately scheduled animation/tick callbacks as well. This keeps the scene and camera state; it reduces CPU/GPU work, not necessarily retained GPU memory. [React Three Fiber supports explicit frame-loop modes](https://r3f.docs.pmnd.rs/api/canvas). Do not claim arbitrary third-party guest timers are paused by this helper or by CSS hiding.

Keep model streams, agent jobs, terminal execution, voice capture, file writes, authentication, and media sessions running according to their existing user intent. Tests must prove they continue while view polling stops. Do not introduce a global timer monkey patch, injected guest scripts, forced GC, memory limits, or a busy process monitor.

**Gate:** Hidden eligible views produce no recurring view-status requests; rapid visibility changes do not duplicate timers or overlap requests. Resume refreshes once. Office draw calls/frame callbacks stop while hidden and resume with the same camera. Synthetic active work continues and output is recoverable. Retest 5-minute idle CPU and the 20-minute cycle with the same workload.

### Phase 5 — Add controls and finish measured acceptance

**Files:** `src/components/SettingsModal.jsx`, `src/lib/performancePolicy.js`, `src/lib/persistentStore.js`, existing styles if needed, documentation, and native acceptance probes.

Add a compact Performance section to existing Settings: “Load restored tools when selected,” “Pause hidden tool updates,” and a four-row service-start list with “When opened,” “Manually,” and “With Perci.” Keep Perci's existing theme tokens and settings typography. Explain that views and services are separate; “Pause” must not be labelled as releasing RAM. Use simple settings rows, no new dashboard, animation, palette, or per-app enable/hide catalog feature. Disabling a feature remains reversible and applies without clearing profile data.

**Gate:** Settings and deferred/error states are visually checked at the actual desktop viewport in both light/dark modes, including keyboard focus, long tool titles, reduced motion, empty/error/loading states, and dock/resize interactions. Write down observed defects and fix them before acceptance.

Run full tests/build and changed-file lint, recording repository-wide baseline lint separately. Repeat packaged measurements from Phase 0 and summarize absolute figures and percentage deltas. Engineering targets (not promised savings): at least 20% lower median Perci footprint for the restored-but-unopened fixture, no startup guest fan-out, no repeated automatic starts, and at least 30% lower idle CPU in the hidden Office/polling fixture when the baseline is materially nonzero. Warm each selected mode through three cycles before assessing repeatable memory growth; distinguish one-time caches from a sustained upward trend over the remaining fixed cycle. Require no sustained growth and no more than 10% shell-usability regression; investigate outliers rather than masking them with averages. Record first-open latency separately, excluding backend startup from view-only comparisons. If targets fail, profile the actual dominant process/dependency and retain only changes with justified benefits.

## Deliberate limit: automatic view unloading

This pass implements sleeping as deferred initialization plus cooperative pausing. It does not automatically destroy already-used editable guests. Embedded services do not expose a trusted dirty-state/checkpoint contract, and Notes explicitly keeps `unsavedContent` in component state. Browser partition persistence does not preserve unsaved DOM text or in-memory jobs. `React.lazy` also retains loaded code; it is not a general memory-unload API.

If measurements still show excessive retained memory after all tools have been used, add a separately scoped second pass: persist and await verified draft checkpoints for Perci-owned editors, then allow an explicit per-surface unload adapter only for surfaces with proven restore behavior. An adapter must reject unloading during active work or failed persistence, restore a checkpoint before accepting input, and be exercised through a crash/reopen native test. Unknown third-party guests remain mounted until their own integration supplies that contract. Do not disguise this remaining limit as completed RAM reclamation.

## Implementation checkpoint — 2026-10-10

Current 0.50.4 source, icon-only header, and uninstalled candidate are verified under `release-build/performance-0.50.4-accessible-final`. ASAR dad87e95afc50685cb9b684aec3055b55ef4d57771a7e5aa1939371e1f335fac. 248 tests pass, zero introduced lint, clean build/package and 249 shipped-file identity/signature pass. Current native header/import/draft/contrast checks pass; prior full 17-check lifecycle, native hide/show and twenty-minute cycle are pre-color artifact evidence for unchanged lifecycle code (recorded color-only delta). See `docs/performance-evidence/README.md` for exact inputs/artifact boundaries and raw evidence.

Measured restored footprint 1008→626 MB, CPU 7.2077→4.6508%, hydration reload 2248→947 ms. Empty footprint 876→626 MB, CPU 5.3587→4.6418%, reload 606→816 ms. The Empty <=10% reload target fails; outliers/viewport transitions and separate actual reload traces are recorded. Cycle CPU 13.0898→5.1504% improves 60.7%, but candidate warm footprint 1059→1107 MB (+4.14 MB/min fitted) does not establish the no-growth target. Retain justified view/CPU benefits; safe editable-view unloading requires a separate checkpoint contract. The 10 GB observation remains unreproduced; these are synthetic fixtures, not real backend/cold-launch proof.

Styled DMG repair/mounted app/artwork geometry/label luminance pass; current Finder capture is unavailable and OS Light/Dark approval remains pending. Drag/install unrequested. No commit/push/install/public release. Fresh Sol audit follows parent verification.

## Verification and release boundary

- [x] Phase 0 baseline and reproducible synthetic fixtures saved.
- [x] Phase 1 restore/activation/draft tests pass against native Electron.
- [x] Phase 2 native intent/failure/retry, single-flight unit checks, and existing identity/guest/credential tests pass; live backend readiness is outside these synthetic checks.
- [x] Phase 3 selected packaged lazy-load paths and chunk failures verified.
- [x] Phase 4 hidden-work and synthetic stream/terminal continuity verified.
- [x] Phase 5 settings inspected in both modes; measured targets evaluated and reported, including reload/growth target failures.
- [x] Unrelated `src/components/NotesMode.jsx` edits, `perci-security-audit.md`, startup probe, and startup profile preserved.
- [x] Plan/implementation status and remaining acceptance limits recorded in HANDOFF.

No product version bump is needed for this plan. When implementation is accepted, choose the next version from the then-current package version; update the lockfile consistently before any feature/fix push. Build and inspect an uninstalled candidate with the existing styled-DMG/Finder repair process, reading DMG.md and its skill before packaging. Native `file://` behavior must be verified before recommending installation.

Do not replace/restart the installed Perci app or stop services as part of this plan. For a later installation, prepare a tested artifact and rollback first, explain unsaved-work interruption, and obtain explicit confirmation at that concrete step. Preserve existing guest partitions, tokens, origin validation, and session permission boundaries. Do not clear cookies/caches, reset profiles, access SecurityAgent, remove Docker volumes, or change ports to manufacture a smaller footprint. Public release and security-finding closure remain separate work.

## References

- Earlier investigation: `docs/perci-startup-and-weight-2026-10-04.md` and the startup/weight checkpoint in `HANDOFF.md`.
- [Electron performance guidance](https://www.electronjs.org/docs/latest/tutorial/performance): profile actual runtime costs and defer unnecessary initialization.
- [React lazy reference](https://react.dev/reference/react/lazy): module-scope lazy declarations, Suspense, caching, and error boundaries.
- [Electron process memory reference](https://www.electronjs.org/docs/latest/api/process#processgetprocessmemoryinfo): macOS RSS/compression limitations.
- [React Three Fiber Canvas](https://r3f.docs.pmnd.rs/api/canvas): frame-loop modes.
