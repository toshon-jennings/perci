# Opal Handoff

## Current Milestone

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
- [x] Window system hardening: open windows persist across reloads, a main-process
      guard stops stray same-origin reloads, dragging an edge outward now resizes
      reliably (drag shield), and each window has its own error boundary.

## Window + dock system

- Window manager lives in `src/context/ModeContext.jsx`: `windows[]` with
  `state` (normal/minimized/maximized), z-ordering, per-mode geometry memory
  (persisted to `opal_window_bounds`), and actions (open/close/focus/minimize/
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

- **Open windows persist across reloads** (`opal_open_windows`): which modes are
  open, their state, and geometry are restored on load (re-clamped to the current
  viewport via `hydrateWindows`). Per-mode geometry is still also remembered
  separately (`opal_window_bounds`) so reopening a *closed* window restores its size.
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
- [ ] If isolated Cowork/OpenClaw conversations become needed, add a session key generation strategy; `runOpenClawAgent` already accepts `sessionKey`.
- [ ] Generated graphify docs still reflect older code until the architecture graph is regenerated.
- [ ] Review the new Perci/Mission motion in-app and decide whether to make it bolder or calmer before applying it to more surfaces.

## Notes

- OpenClaw bridge turns currently use `--agent main`.
- The root `main.cjs` is legacy dead code; use `electron/main.cjs` for main-process work.
- Tavily runtime code was removed from active search paths; local desktop search is exposed by `electron/preload.cjs` as `window.electron.webSearch`.
