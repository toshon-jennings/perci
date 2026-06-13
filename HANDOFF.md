# Perci Handoff

## Current Milestone

- [x] Lighthouse upper cards now align as one row: the accidental
      `.lh-section + .lh-section` sibling margin was pushing Quick Port Check
      down, and the temporary JS height-sync loop was removed. The info button
      now resolves the parent process name/command and explains what the Parent
      PID means, including the PID 1 launchd case shown in the original app.
- [x] Hermes surface gained a **Terminal** tab (between Console and Sessions)
      that is itself a multitab terminal: `src/components/TerminalTabs.jsx`
      manages up to 6 PTY sessions over the existing local terminal bridge
      (`terminalBridge.js`, ports 3001/3002 — same server the global terminal
      uses). Each tab is a unique `hermes-shell-*` sessionId; inactive tabs
      stay mounted so shells survive tab switches, the strip shows per-session
      connection dots, and Reset/Reconnect act on the active tab.
      `Terminal.jsx` is now `forwardRef` with `embedded` (hides its own
      chrome), `onStatusChange`, and an imperative `{ reset, reconnect,
      focus }` handle — the global `App.jsx` usage is unchanged. The whole
      TerminalTabs pane stays mounted in `HermesMode.jsx` after first visit.
- [x] Fixed garbled terminal output (doubled echo, stacked `❯ ❯ ❯` prompts):
      `terminal-server.cjs` broadcasts PTY output to *every* client on a
      session, and under React StrictMode the panel's aborted first socket
      could fire a zombie `setTimeout(connect)` retry after remount, attaching
      **two** sockets to the same session → every output chunk written twice.
      `Terminal.jsx` now drops/detaches any previous socket before opening a
      new one, guards all ws handlers with `wsRef.current !== ws`, clears the
      retry timer on cleanup, nulls `termInstanceRef` on dispose, and connects
      *after* the initial fit so the PTY spawns at the real size instead of
      80x24 (the misdrawn welcome box). Applies to both the Hermes terminal
      tabs and the global terminal (same component).
- [ ] Suspect band-aid: the 24ms `isDuplicateSingleKeyInput` filter in
      `Terminal.jsx` (and the server's device-attribute stripping) likely
      papered over this same double-socket bug. At fast macOS key-repeat
      settings (KeyRepeat=1 ≈ 15ms) it can swallow legitimate held-key
      repeats. Once the fix is verified in-app, consider deleting the filter.
- [x] Hermes surface polish pass ("amber dispatch console" identity, scoped
      `hermes-*` CSS at the end of `src/index.css`): amber atmosphere header
      gradient with a glowing badge while a run is active, gateway status
      pill in the header (replacing the bare dot and the duplicate vitals
      chip), overshoot-spring amber tab underline, amber-railed run cards
      with done/failed status icons and hover glow, radial-glow console empty
      state, amber Run/Start-dashboard buttons and input focus ring, and
      amber-accented Insights pills / Sessions card hovers. All new motion is
      `prefers-reduced-motion` gated. `npm run build` passes.

- [x] Hermes now has a first-class window surface (id `'hermes'`, `HM` dock chip),
      lighter than OpenClaw's but complete: a status header (version/model/provider/
      gateway from `hermes status`, amber pulse while running) and four tabs —
      **Console** (one-shot runs via
      `hermes -z` with cancel, plus a live activity rail tailing `hermes logs -f`
      so tool calls are visible as they happen), **Sessions** (parsed
      `hermes sessions list/stats`), **Insights** (`hermes insights` for 7/30/90
      days), and **Web UI** (embedded `hermes dashboard` webview on :9119 with a
      start-and-poll flow). Bridge lives in `electron/main.cjs` (`hermes:*` IPC,
      arg-array spawns, no shell; redacted key fragments never cross IPC) and
      `electron/preload.cjs`; surface is `src/components/HermesMode.jsx`. The
      top-bar Hermes button (circled Nous Research mark, `hermes-branded` CSS)
      opens this window; the Agents panel's Hermes entry runs real `hermes -z`
      jobs through `agent-jobs:queue` and has an "Open window" shortcut. The
      Mercury desktop-app integration was removed entirely (button, Settings
      path field, `hermesAppPath` context state, `hermes_app_path` persistence
      key, `hermes:open-app` IPC, `src/assets/hermes.png`). **Needs an Electron
      restart to pick up the new preload/main IPC** — renderer HMR alone shows
      the desktop-only fallback.
- [x] OpenClaw bridge steps 1 and 2 committed in `de24ea7`.
- [x] OpenClaw bridge step 3 committed in `3a20762`.
- [x] Mission Control now has gateway health summary and live OpenClaw event streaming.
- [x] Agents panel can run OpenClaw through the gateway agent bridge.
- [x] Cowork exposes `delegate_to_openclaw` for long-running or multi-step gateway delegation.
- [x] Perci web search now uses the desktop `web-search` bridge/native provider search path instead of Tavily.
- [x] Search is now intent-aware. `IntelligentSearchTool.planSearch()` classifies each
      message (intent / reason / searchQueries / freshness / expectedSourceTypes) using the
      selected model when available, deterministic local-fact detection for clock/calendar
      questions, and keyword heuristics as the offline fallback — replacing the brittle
      `shouldAutoUseWebSearch` phrase matcher (removed from `ChatMode.jsx`).
- [x] First non-window Odysseus-inspired motion pass landed for Perci/Mission:
      whirlpool thinking/search indicators, Mission timeline rails, active synapse pulses,
      and domino list reveal utilities.
- [x] Window + dock system landed (`65c32f6`). Chat is the always-mounted base; Cowork,
      Code, Agents, Mission, Build, and OpenClaw open as floating windows tracked by a
      bottom dock with whirlpool-minimize and domino chip-in.
- [x] Mission Control and both Guide modals now use scoped focus-card hover:
      hovered cards lift/glow while sibling cards in the same group recede for easier scanning.
- [x] Guide modals no longer reset Advanced back to Guide during background re-renders;
      `onClose` is kept in a ref so tab reset only happens when a modal opens.
- [x] Window system hardening: open windows persist across reloads, a main-process
      guard stops stray same-origin reloads, dragging an edge outward now resizes
      reliably (drag shield), and each window has its own error boundary.
- [x] Modal stacking issues fixed: global modals (Transit Map, Settings, guides,
      changelog, and YouTube overlay modals/PiPs) are now rendered using React Portals
      (`createPortal`) to mount under `document.body`, escaping the z-index 30 capping
      of the window host container.
- [x] Dock overlap fixed: when window chips exist, the main desktop reserves a 64px
      bottom lane for the dock, and window default/clamp bounds keep floating and
      maximized windows out of that lane.
- [x] YouTube PiP is now a first-class Perci window (id `'youtube'`, `YT` dock chip)
      instead of a native Electron `BrowserWindow`. It gets minimize/restore/maximize/
      close + dock wiring for free, like Cowork/OpenClaw. The native window, its
      `youtube-player:*` IPC handlers, and the preload bridge were deleted. In desktop
      mode the window content is a `<webview>` loading the YouTube `/watch` page
      (`/embed` is blocked in an Electron `<iframe>` with `ERR_BLOCKED_BY_RESPONSE`
      and errors 153 as a top-level webview doc); the web build keeps the `/embed`
      iframe. `key={youtubeUrl}` forces the webview to re-navigate when the video
      changes; the window is `noWhirlpool` (webview fade). Verified in-app:
      open → dock chip → play → minimize → restore → switch video.

## Window + dock system

- Window manager lives in `src/context/ModeContext.jsx`: `windows[]` with
  `state` (normal/minimized/maximized), z-ordering, per-mode geometry memory
  (persisted to `perci_window_bounds`), and actions (open/close/focus/minimize/
  toggleMaximize/move/resize). `setCurrentMode` and `setShowOpenClawDashboard` are
  **bridged** to the window system, so every existing call site (ModeSwitcher,
  SecondaryModeNav, ChatMode buttons, AgentsPanel, SettingsModal, MissionControl)
  keeps working unchanged.
- Components in `src/components/windows/`:
  - `WindowFrame` — drag, 8-way resize, macOS traffic-light controls, double-click
    maximize. Minimized windows stay **mounted but hidden**, so a mode's state
    (e.g. the Cowork conversation) survives — this also resolves the deferred
    "preserve Cowork across navigation" follow-up for the minimize case.
  - `DesktopHost` — paints open windows over the Chat base; `renderContent(modeId)`
    supplies the mode UI (so Mission Control still gets its live props).
  - `Dock` — domino-staggered chip-in (framer-motion spring, per-index delay),
    focus dot, click-to-minimize, right-click context menu.
  - `WindowContextMenu` — pop-from-anchor menu (Focus/Minimize/Maximize/Close),
    opens above the cursor; measures with `offsetHeight` so the scale-0.6 pop
    animation doesn't mis-place it.
- OpenClaw is window id `'openclaw'` (not a MODE). Its old fullscreen overlay was
  extracted into `renderOpenClawWindow()` in `App.jsx` and rendered as window
  content. Because its content is an Electron `<webview>`, it minimizes with a
  plain fade (`noWhirlpool`) to avoid transform flicker. Its redundant inline
  close button was removed (window chrome owns close).
- Motion uses the signature spring `cubic-bezier(0.34, 1.56, 0.64, 1)`; all
  flourishes are gated behind `prefers-reduced-motion`. Styles live at the end of
  `src/index.css` on Perci's `--bg/--accent/--text` tokens.

### Hardening / fixes

- **Open windows persist across reloads** (`perci_open_windows`): which modes are
  open, their state, and geometry are restored on load (re-clamped to the current
  viewport via `hydrateWindows`). Per-mode geometry is still also remembered
  separately (`perci_window_bounds`) so reopening a *closed* window restores its size.
- **Spurious full reloads fixed**: a stray same-origin top-frame navigation was
  reloading the whole SPA (`will-navigate url=…:5173/` in renderer.log), wiping
  in-memory window state. `electron/main.cjs` now blocks same-origin top-frame
  navigations (logs `blocked-self-navigation`); does not affect Vite HMR
  (`location.reload`), the OpenClaw `<webview>`, or external links. **Needs an
  Electron restart to take effect.**
- **Resize-larger drag fixed**: dragging an edge outward moved the cursor over the
  Chat base / a webview, which swallowed pointer events and silently stopped the
  drag (shrinking worked, growing didn't). `WindowFrame` now renders a full-viewport
  drag shield (`.perci-drag-shield`, z 100000) during any drag so pointer events
  stay in-document.
- **Per-window error boundary**: each window's content is wrapped in
  `WindowErrorBoundary`, so a throw in one mode shows an inline retry instead of
  tearing down the other windows or the Chat base.
- **Global modal portal mounting**: global modals rendered from within windows
  (Transit Map modal in Mission Control, Guide modals, Settings modal, Changelog,
  and YouTube overlays) are portaled to `document.body` with `z-[9999]` or `z-[10000]`.
  This escapes the `z-index: 30` stacking context of `.perci-desktop-host` and
  prevents parent window CSS transforms from breaking full-screen fixed positioning.
- **Dock no longer blocks bottom controls**: `App.jsx` marks the desktop container
  with `.perci-dock-reserved` whenever the dock is visible. `src/index.css`
  reserves the bottom lane for the dock and shrinks `.perci-desktop-host`, while
  `ModeContext.jsx` uses the same 64px reserve for default and clamped window bounds.

### Limitations / follow-ups

- The OpenClaw window has two layers of chrome (window title bar + OpenClaw's own
  toolbar/tabs); could be slimmed if it feels heavy.
- `prefers-reduced-motion` and live `<webview>` resize behavior have not been
  verified in-app yet.
- The exact source of the stray top-frame navigation wasn't pinned (all forms
  `preventDefault`); the main-process guard neutralizes it regardless. If it
  recurs it'll show as `blocked-self-navigation` in renderer.log.

## Search behavior (intent-aware)

- `planSearch` intents: `local_runtime_fact`, `no_search`, `web_search`,
  `historical_on_this_day`, `news`, `shopping`, `weather`, `finance`, `general_lookup`.
- `local_runtime_fact` (today's date/time/day) is answered directly from the system clock;
  `ChatMode` injects the answer and tells the model to note no web search was necessary.
  This covers the "do another search for today's date" bug — answered locally, not via SEO.
- `historical_on_this_day` routes through the main-process Wikimedia on-this-day path.
- `intelligentMultiSearch(query, max, onProgress, plan)` now runs planned queries, scores
  each source by title/snippet token overlap (`scoreRelevance`), sorts by relevance, and
  retries with an improved query (`improveQuery`, model-assisted) when results are weak.
- Weak/empty results set `weakResults` so `ChatMode` instructs the model to be honest
  ("I searched but found nothing relevant") instead of fabricating generic source summaries.
- Removed now-dead `analyzeSearchCompleteness` and `isNewsQuery` from `IntelligentSearchTool`.

### Limitations / follow-ups

- The planner adds one short model call before searching when a model is configured and the
  cheap pre-screen thinks search may be relevant; greetings can still trigger it. The
  deterministic local-fact path avoids a model call for date/time questions.
- `news`/`weather`/`finance`/`shopping` intents still go through the generic DuckDuckGo path
  with specific queries; no dedicated provider APIs were added (kept minimal).
- Relevance scoring is lexical (token overlap); it does not yet use the model to judge
  source quality, and SEO-spam detection is only implicit via low overlap.

## Known State

- [x] Reviewed and prepared the broad dirty tree for commit; changes include product UI/Build work, graph docs, and the Tavily-free search path.
- [x] Preserved Codex's in-flight work in `src/lib/integrationTools.js` and included it in the cleanup commit.
- [x] Perci HQ window scene now derives dawn/day/dusk/night sky, lighting, and lamp intensity from the local system clock in `src/components/OfficeScene.jsx`.
- [x] Perci HQ office dressing pass added synced side-window scenery, a right-wall door, framed wall art under the neon sign, and larger potted tree/plant decor in `src/components/OfficeScene.jsx`.
- [x] Perci HQ now includes a compact back-wall retro TV rendered entirely in WebGL with an animated live-feed screen; because it is not a DOM iframe, desks and agents depth-sort in front of it correctly.
- [x] Perci HQ clock and shelf cluster moved off the back wall to the left wall so the retro TV can sit in the old clock/shelf space.
- [x] Perci HQ desk name labels now render as WebGL billboards instead of DOM `<Html>` overlays, so Sir Perci depth-sorts in front of them while walking past.
- [x] `npm run build` passes for the current Perci HQ scene work.
- [x] Perci HQ Office artwork pass: sourced and imported 9 Unsplash images (landscape/portrait pairs + extras), framed artwork renders on Office walls with proper aspect-ratio fitting and shadowed frames.
- [x] Replaced DOM-based RetroTvPlayer with canvas-based `LiveTvScreen` starfield animation in `OfficeScene.jsx` with reduce-motion support and proper texture disposal.
- [x] Added two comic covers (`marv-amazing.webp`, `dc-action.png`, copied into `public/artwork/`) displayed in thick wall-mounted glass cases (`ComicCase3D` in `OfficeScene.jsx`). Originally true comic size on the left wall but unreadably small, so they now sit on the back wall centered beneath the PERCI HQ sign (x ±0.55, y 3.0) at `scale={2.8}` while keeping real comic proportions. `npm run build` passes.
- [x] Dashboard OpenClaw tile now shows the real OpenClaw lobster logo (fetched from the
      gateway control UI's `favicon.svg`, vendored at `public/openclaw-logo.svg` so it
      renders even when the gateway is offline) and a live data-driven description from
      the 30s gateway health poll: agent count, active tasks, failures, and runtime
      version (e.g. "2 agents · 1 active task · v2026.x"), falling back to
      "Checking gateway…" / "Gateway offline". `npm run build` passes.
- [x] Perci HQ snack table now uses AI-themed treats/drinks in `OfficeScene.jsx`:
      microchips with thermal paste, data crunch bits, HTTP cookies, SPAM,
      Raspberry Pi, Java, and liquid nitrogen. `npm run build` passes.
- [x] Sir Perci now reads less menacing in Perci HQ: sword and shield are
      crossed on his back in an X, his hands stay empty, and office arm motion
      gestures/waves instead of guarding/chopping. 3D and dashboard-office
      variants now include round hand spheres, and the 3D antennae are longer
      with full bulb tips so they no longer read as chopped side nubs. The
      dashboard Office card uses the same softer mascot variant without
      changing global chat mascot usage. `npm run build` passes.
- [ ] Weather syncing is not implemented yet; there is no existing local weather/location bridge, so it needs a separate consented source or settings-backed location.
- [ ] If isolated Cowork/OpenClaw conversations become needed, add a session key generation strategy; `runOpenClawAgent` already accepts `sessionKey`.
- [ ] Generated graphify docs still reflect older code until the architecture graph is regenerated.
- [ ] Review the new Perci/Mission motion in-app and decide whether to make it bolder or calmer before applying it to more surfaces.

## Notes

- OpenClaw bridge turns currently use `--agent main`.
- The root `main.cjs` is legacy dead code; use `electron/main.cjs` for main-process work.
- Tavily runtime code was removed from active search paths; local desktop search is exposed by `electron/preload.cjs` as `window.electron.webSearch`.
