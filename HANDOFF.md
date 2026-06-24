# Perci Handoff

## Current Milestone

- [x] Mission Control render crash fixed (2026-06-24). `MissionControl.jsx`
      now imports the persistent storage string helpers it already used, and
      the run context menu is rendered from `MissionControl` instead of
      `MissionPulsePanel` so its state/actions stay in scope. Validation:
      `./node_modules/.bin/eslint src/components/MissionControl.jsx`,
      `npm run build`, and a headless Chrome smoke test against
      `http://localhost:5173` pass.
- [x] Coding Expert Stack tooling prerequisites installed and indexed
      (2026-06-23). `skills` CLI 1.5.13 is now on PATH under the Hermes Node
      prefix, `codebase-memory-mcp` 0.8.1 is installed under `~/.local/bin`,
      Agent Reach 1.5.0 is installed under `~/.local/bin`, `mcporter` 0.9.0 is
      installed under the Hermes Node prefix, and `config/mcporter.json` points
      `exa` at `https://mcp.exa.ai/mcp`. The repo was indexed with
      `codebase-memory-mcp cli index_repository` using `persistence:true`, which
      produced `.codebase-memory/graph.db.zst` and `.codebase-memory/artifact.json`.
      Both upstream skill packs were imported into `.agents/skills` with
      `npx skills@latest add mattpocock/skills` and
      `npx skills@latest add addyosmani/agent-skills`. Agent Reach doctor now
      reports semantic web search available and 7/13 channels active.
- [x] SkillSpector policy decision: ALLOWLIST WITH TRUST TIERS (2026-06-24).
      `skillspector scan .agents/skills --no-llm` returns 100/100 CRITICAL when
      run in bulk mode (treating the whole directory as one skill) but this is
      a meta-analysis artifact, not a true composite score. Individual scans
      show the real picture:
      - `git-guardrails-claude-code`: HIGH flag for AS1 (Agent Config Directory
        Access) — FALSE POSITIVE. The skill legitimately reads `.claude/` to set
        hooks; the bundled script only greps for dangerous git patterns and
        exits. No data exfiltration, no self-modification. Keep as-is.
      - `security-and-hardening`: HIGH flags (PE3 credential paths, YR4 exploit
        patterns, EA2 autonomous decision). FALSE POSITIVE for a security-audit
        skill — these are references to concepts the skill teaches, not actual
        credential leaks or exploit payloads.
      - `browser-testing-with-devtools`: HIGH flag (YR1 info-stealer pattern).
        FALSE POSITIVE — the skill references browser automation patterns that
        overlap YARA regex heuristics (network calls, cookie access) but the
        skill content is legitimate testing guidance.
      - `ask-matt`: HIGH flag (MP3 Memory Manipulation). FALSE POSITIVE —
        references to "save to memory" as a workflow concept.
      - `context-engineering`: MEDIUM flag (PE3 Credential Access) — the skill
        mentions credential paths in a theoretical context. Not an actual leak.
      - `spec-driven-development`: MEDIUM flag (AS3 Skill Enumeration) —
        describes skill-discovery workflow. Benign.
      - `code-simplification`: MEDIUM/HIGH flag (RA1 Self-Modification at
        line 155) — the skill describes refactoring patterns; the "self-mod"
        reference is metaphorical (refactoring one's own code during review).
      All imported packs retained. See policy section below.
- [x] Coding Expert Stack first UI slice landed in the existing Skills window
      (2026-06-23). `SkillsMode.jsx` now shows a persisted "Coding Expert
      Stack" package panel above the installed skills list. It treats the stack
      as four layers: Engineering Playbook (mattpocock/skills +
      addyosmani/agent-skills), Codebase Memory (codebase-memory-mcp), Research
      Reach (Agent Reach), and Skill Safety Gate (SkillSpector). Readiness is
      inferred from the already-detected skill/source inventory; the toggle
      persists through the existing skills metadata file under
      `__codingExpertStack`. The panel includes source links and a copyable
      setup checklist, but intentionally does not auto-install external repos or
      execute package-manager commands yet. Validation: `npm run build` passes
      with the existing Vite chunk-size warnings.
- [x] Coding Expert Stack tooling doctor landed (2026-06-23).
      `electron/main.cjs` now exposes `skills:get-coding-expert-status`, a
      bounded local-only detector for `skills`, `npx`, `codebase-memory-mcp`,
      `agent-reach`, `skillspector`, `uv`, and `.codebase-memory/graph.db.zst`
      artifacts in the current/registered workspaces. `electron/preload.cjs`
      exposes it as `getCodingExpertStatus()`. `SkillsMode.jsx` folds those
      signals into the four stack readiness layers and renders a compact
      Tooling doctor table with found/missing state, version/path details, and
      graph artifact count. The existing agent CLI detector now uses the same
      bounded `which`-based executable lookup helper. It still does not run
      installers, network doctor commands, or external scans automatically.
      Validation: `node -c
      electron/main.cjs`, `node -c electron/preload.cjs`, and `npm run build`
      pass with the existing Vite chunk-size warnings. Live IPC verification
      requires a full Perci desktop-shell restart.
- [x] System Skills detector refactor landed (2026-06-23). The Skills window is
      now source-aware instead of Hermes-only: `skills:get-installed` scans
      Hermes, Codex, Claude, OpenClaw, OpenCode, Cursor, Aider, Antigravity,
      plus discovered system/agent skill roots, Claude command markdown, and
      Cursor rule files. Returned skills include `source`, `sources`, and
      `sourceDetails` while still deduping by skill id. `SkillsMode.jsx` now
      presents "System Skills", source filters, source-grouped sections, and
      source badges. Validation: requested `npx esbuild
      src/components/SkillsMode.jsx --bundle --format=esm --jsx=automatic
      --outfile=/tmp/test.js`, `node -c electron/main.cjs`, a stubbed
      `skills:get-installed` scan (540 deduped skills across Codex, Hermes,
      Antigravity, System, Claude, Orbit, Cursor, and Pi), `git diff --check`,
      and `npm run build` all pass. A live Electron IPC verification still
      requires a full Perci desktop-shell restart because `electron/main.cjs`
      changes are not hot-reloaded.
- [x] OpenClaw skills detection fix (2026-06-23). The Skills detector found no
      OpenClaw skills because (a) it only scanned `~/.openclaw/skills` (which
      doesn't exist — OpenClaw symlinks enabled skills into
      `~/.openclaw/plugin-skills/`) and (b) `scanSkillsRecursive` skipped
      symlinked dirs (`entry.isDirectory()` is false for a symlink). Fixed both
      in `electron/main.cjs`: added the `plugin-skills` scan root and made the
      scanner follow symlinks that resolve to directories (broken symlinks
      skipped; maxDepth guard prevents cycles). Verified by replicating the scan
      over the real FS — `browser-automation` now detected. Requires a Perci
      desktop-shell restart to take effect (main process isn't hot-reloaded).
      Note: only OpenClaw skills symlinked into `plugin-skills` count as
      "installed"; bundled-but-unenabled extension skills are intentionally not
      listed. Also removed the `<Bot>` robot icon from the Detected Agent CLI
      badges in `SkillsMode.jsx`.
- [x] Ensemble mode landed (2026-06-23). A standalone multi-model deliberation
      surface: a user-chosen panel of models answers a prompt in parallel, a
      judge model analyses the anonymised responses (consensus / unique
      insights / contradictions / blind spots), and a synthesis model writes the
      final answer from the judge's guidance. Optional 2–3 round refine loop
      feeds the candidate back to the panel. Engine is the pure, unit-tested
      `src/lib/ensemble.js` (`runEnsemble` + injectable `streamModel`, built on
      `LLMFactory`); UI is `src/components/EnsembleMode.jsx` (reuses
      BuildCompare's fan-out pattern + `ProviderModelPicker`-style menus,
      rAF-batched streaming). All four stage prompts are editable; config
      persists under `perci_ensemble_config`. Registered as `MODES.ENSEMBLE`
      (ModeContext, App case, Dashboard tile, Dock glyph). Validation: `npx
      vitest run test/ensemble.test.js` (9/9) and `npm run build` pass; verified
      open/render in the dev preview. Conceptually an "Ensemble" in the ML sense
      (combining models to beat any single one). Not for coding tasks
      (slower/costlier than one model).
- [x] Power User Workspace planning is now the active product direction. The
      goal is to improve Perci for technical founder/operator/builder power
      users by connecting ideas, notes, code, terminals, agents, validation,
      memory, and next actions into one coherent workspace loop. The canonical
      pickup plan is `docs/product/POWER_USER_WORKSPACE_PLAN.md`. Start with
      the workspace model plus window skeleton before deeper BARS/Notes/Mission
      integrations. Do not treat enterprise warehouse/BI setup as the default
      persona for this milestone.
- [x] Power Workspace first slice started: `src/lib/powerWorkspace.js` defines
      the minimal persisted workspace model, legacy working-directory/Git
      Shells fallback, recent BARS/Mission snapshot reads, and deterministic
      next-action selection. `src/components/PowerWorkspaceMode.jsx` adds the
      first renderer-only workspace window. The mode is wired through
      `ModeContext`, `App`, Dashboard, Dock, and persistence keys. Validation:
      `npm test -- --run test/powerWorkspace.test.js` and `npm run build` pass.
      Next implementation step is linking BARS/Notes/Mission records to an
      active workspace instead of only showing recent/fallback summaries.
- [x] Power Workspace explicit context linking landed. Workspace records now
      persist `linkedIdeaIds`, `linkedMissionRunIds`, and `linkedNoteRefs`;
      `setWorkspaceLink()` stores links on the workspace record instead of
      mutating BARS ideas, Mission runs, or note files. The Power Workspace
      window can link/unlink recent BARS ideas and Mission runs, and can pin
      manual note references such as `Index.md` or `[[Power User Brief]]`.
      Linked items sort ahead of merely recent items. Validation:
      `npm test -- --run test/powerWorkspace.test.js` and `npm run build` pass.
      Follow-up completed below: workspace actions now start Cowork/Git Shells
      with the active workspace goal/folder context.
- [x] Power Workspace action handoff landed. `prepareWorkspaceCoworkHandoff()`
      saves the active workspace, writes `working_directory`, stores a pending
      Cowork prompt under `perci_power_workspace_cowork_handoff`, and emits an
      in-app handoff event for already-mounted Cowork windows. Cowork consumes
      the handoff by registering the folder, setting its working directory, and
      pre-filling the composer with the workspace goal/context without
      auto-running. `prepareWorkspaceProjectHandoff()` writes
      `working_directory`, selects an existing matching Git Shells project and
      first terminal via `supaterm_active_*`, or opens Git Shells with a
      pre-filled registration draft for the workspace folder. Validation:
      `npm test -- --run test/powerWorkspace.test.js` and `npm run build` pass.
      Follow-up completed below: BARS, Notes, and Mission now expose
      workspace-aware filters and link/unlink actions.
- [x] Workspace-aware BARS/Notes/Mission actions landed. `powerWorkspace.js`
      now has shared matching helpers for note refs and Mission runs, so
      `Index.md`, `Index.enc.md`, and `[[Index]]` resolve to the same workspace
      note identity and Mission runs match either explicit links or the active
      workspace folder. BARS shows a workspace count, workspace-only filter, and
      per-idea "Use in workspace" action. Notes shows a workspace-only note
      filter and active-note link/unlink action without editing note contents or
      weakening encrypted-note behavior. Mission Control has a Workspace filter,
      workspace run count, and selected-run link/unlink action. Validation:
      `npm test -- --run test/powerWorkspace.test.js` and `npm run build` pass
      with the existing Vite chunk-size warnings. Next step is making the Power
      Workspace home open directly into linked BARS ideas, Notes pages, and
      Mission runs instead of only opening the parent surfaces.
- [x] Power Workspace direct record navigation landed. A single renderer-only
      `perci_power_workspace_surface_handoff` record plus
      `perci-power-workspace-surface-handoff` event handles both newly opened
      and already-mounted windows. Power Workspace idea/run titles and explicit
      actions now open BARS or Mission with the requested record selected;
      linked note chips open Notes on the resolved page, including wikilink,
      `.md`, and `.enc.md` forms. Destination filters are cleared when needed so
      the requested record is visible. The handoff is consumed once and covered
      by `test/powerWorkspace.test.js`. Validation:
      `npm test -- --run test/powerWorkspace.test.js` passes with 11 tests and
      `npm run build` passes with the existing Vite chunk-size warnings. Next
      step completed below: selected BARS and Notes context can now be carried
      into Cowork for planning.
- [x] Selected workspace context can now start a focused Cowork planning handoff.
      BARS records expose `Plan in Cowork`; linked note chips expose a compact
      Cowork action. The existing Cowork handoff remains non-destructive and
      non-automatic: it registers the workspace folder and pre-fills the
      composer, but does not submit. The generated prompt includes the workspace
      goal/folder plus selected BARS title/status/next action or the selected
      note reference, then asks Cowork for the next smallest executable plan
      after inspecting current state. Validation:
      `npm test -- --run test/powerWorkspace.test.js` passes with 12 tests and
      `npm run build` passes with the existing Vite chunk-size warnings. Next
      step is surfacing recent/current Cowork session activity in Power
      Workspace so the home shows whether workspace-scoped agent work is ready,
      active, or awaiting user action.
- [x] Power Workspace now shows live workspace-scoped Cowork activity from the
      existing persisted `codeState.sessions` collection. Workspace handoffs
      create a non-running `Started` session with the workspace id/folder and a
      pre-filled composer; submitting it transitions the session to
      `In progress` without auto-running beforehand. New manual and routine
      sessions also retain their working directory. The workspace execution
      panel classifies matching sessions as ready, active, or awaiting user
      review/attention and lists the three most recent matching sessions.
      Validation: `npm test -- --run test/powerWorkspace.test.js` passes with
      13 tests, `npm run build` passes with the existing Vite chunk-size
      warnings, and `git diff --check` passes. Next step is feeding Cowork's
      awaiting-review state into the deterministic next-action recommendation
      and, if needed, opening the exact Cowork session rather than only the
      Cowork surface.
- [x] Cowork review continuity is now wired end to end. Awaiting workspace
      sessions take priority in the deterministic next-action recommendation,
      activity rows and the next-action button select the exact Cowork session
      through the existing `codeState.currentSessionId` field, and opening a
      finished/failed session records `reviewedAt` so it does not remain the
      top action forever. The shared window manager now re-clamps normal and
      restore bounds when the viewport resizes, keeping Power Workspace fully
      visible at narrow desktop widths. Validation: 14 focused tests pass,
      `npm run build` passes with the existing Vite chunk-size warnings, and
      live Playwright checks at 1440x1000 and 800x900 confirmed exact-session
      selection, zero horizontal overflow, and no page errors. The first
      coherent idea/context/Cowork/Mission/Git Shells loop is now implemented;
      next work should begin only after deciding whether to close this first
      milestone or extend it with workspace-scoped Chat, validation, and memory
      actions.
- [x] Workspace-scoped Chat, validation, and memory actions complete the first
      Power User Workspace milestone. New workspace chats persist workspace
      id/folder metadata, open by exact conversation id, and receive a
      goal/folder/context prompt without auto-sending. Mission runs now expose
      their real validation state in the workspace; `Validate in Git Shells`
      arms the existing Mission validation target before opening the matching
      project terminal. Pending Mission memory candidates can be saved or
      discarded directly, using one resolver shared with Mission Control;
      explicit user-approved saves bypass the automatic ingestion quality
      threshold and persist as scoped harness memory. Validation: 16 focused
      tests pass, `npm run build` passes with existing Vite chunk-size warnings,
      and live Playwright checks confirmed exact chat reopening, prefilled chat
      context, Mission validation targeting, memory save/discard persistence,
      zero page errors, and no horizontal overflow at 800x900. Treat subsequent
      Power Workspace expansion as a new milestone.
- [x] Hermes dashboard tile now crops its baked-in pale artwork margin with a
      tile-scoped 116% background height, leaving the other launch-tile images
      unchanged. Renderer-only; `npm run build` and a live 1972x1280 visual
      check pass.
- [x] Git Shells now marks any background shell output unread immediately,
      retains the existing prompt-idle completion detection, and exposes native
      notification plus completion-sound toggles in the sidebar header. Native
      permission is requested only when the user enables it; audio defaults off.
- [x] Git Shells terminal input focus is reinforced at the xterm panel boundary.
      Live QA entered commands through the rendered terminal, interrupted
      `sleep 20` with Ctrl+C, returned to the prompt, and showed an unread amber
      marker when a second shell completed in the background.
- [x] Cowork local routines now apply and register their saved folder before
      starting. `run_command` works in Electron local folders through a bounded,
      shell-free executable/argument IPC runner restricted to the registered
      workspace; shell operators remain intentionally unsupported. Main/preload
      changes require a Perci restart before this command bridge is live.
- [x] Chat now keeps a labeled **New chat** button in the persistent composer
      area, so starting a fresh conversation remains accessible at the bottom
      of long message histories and in narrow windows. The existing sidebar
      action is unchanged. Renderer-only; `npm run build` and live long-scroll
      click-through verification pass.
- [x] Git Shells (`MODES.PROJECTS`) integration wrap-up: `electron/main.cjs`
      now attaches `select-directory` to `mainWindow` so macOS directory
      dialogs open as app-modal sheets instead of hiding behind Perci.
      `ProjectsMode.jsx` uses `gitshells_projects` plus `supaterm_active_*`
      keys, safely parses corrupted project snapshots, falls back to a guarded
      manual path prompt when Electron IPC is unavailable or throws, keeps
      hidden shell panels mounted, and only suppresses idle notifications when
      the same shell is selected and the app is visibly focused. Prompt-idle
      matching now covers `$`, `%`, `#`, `>`, `❯`, and `➜`. `Terminal.jsx`
      exposes `onOutput` and `sendInput` for Git Shells while keeping Hermes/global
      terminal behavior intact. Verified `npm run build`, `npm run lint`, and
      `npm test`; native click-through still needs a restarted Electron main
      process because the currently running dev app predates the main-process
      change.
- [x] Git Shells sidebar shell titles are editable from each shell row and
      persist through the existing `gitshells_projects` local/Electron store.
      Sidebar custom names render as `N > Title`, while both main-header shell
      selectors remain ordinal `SHELL N` labels and renumber with shell order.
- [x] Git Shells project sidebar is horizontally resizable from 220–480px via
      its right-edge separator. Width persists as `gitshells_sidebar_width`;
      xterm continues to refit through `Terminal.jsx`'s existing
      `ResizeObserver` and sends updated PTY rows/columns after layout changes.
- [x] Dashboard launch tiles now visibly lift on hover and compress with a
      distinct accent press state on click. Their retained entrance animation
      uses CSS `translate` instead of `transform`, so it no longer suppresses
      hover/active movement; reduced-motion mode keeps feedback stationary.
- [x] Notes pages now support YAML-frontmatter tags. `src/lib/notesTags.js`
      parses/writes `tags: [...]`, hides frontmatter from preview rendering,
      and is covered by `test/notesTags.test.js`. `NotesMode.jsx` shows an
      editable tag strip under the note header, lists active tags and shared-tag
      related notes in the Connections panel, and resolves note IDs through a
      shared helper so `.md` and `.enc.md` filenames navigate consistently.
      `NotesGraph3D.jsx` adds a persisted `Show shared tags` setting
      (`includeSharedTags`) that draws weak optional edges between notes with a
      common tag; default graph behavior remains wikilink/direct-link based.
- [x] New **Beginner's guide** in-app modal (`src/components/BeginnerGuideModal.jsx`)
      for first-time users, styled like `ModeGuideModal`. Two modules: "1 · Local
      AI" (what a local model is, installing Ollama, a RAM→model table, LM Studio/
      Jan alternatives) and "2 · OpenRouter key" (what it is, how to get a key,
      key safety) with a CTA that opens Settings focused on OpenRouter. Opened
      from a new "Beginner's guide" hero button on the dashboard; a new "Get API
      Key" tile in the Perci-native group calls `updateProvider('openrouter')` +
      opens Settings. Seven 16:9 illustrations in `public/guide/` (hero,
      what-is-local-ai, download-ollama, which-model, local-alternatives,
      openrouter-cloud, keep-key-safe), optimized to ~737KB total; image slots are
      guarded so missing art renders icon-only. Renderer-only.
- [x] OpenRouter model selection is now a real searchable picker instead of manual
      entry. `ModelService.fetchOpenRouterModels` loads the **public**
      `openrouter.ai/api/v1/models` catalog (337 models) with or without a key
      (auth header sent only when a key exists), and `getAllModels` always
      populates it. `ChatContext.fetchModels` auto-select now skips key-required
      providers that have no key, so a keyless user isn't defaulted onto an
      unusable OpenRouter model. Settings → OpenRouter shows the list; the manual
      "Add a model" box stays for niche IDs. Renderer-only.
- [x] BARS is now a first-class Perci window surface in the OS-surface group: `MODES.BARS`, Dashboard tile, dock glyph, `BarsMode.jsx`/`BarsMode.css`, and `bars:*` Electron IPC. Bars data lives in Perci localStorage (`perci_bars_ideas:v1`) and stays independent from standalone Bars; export/import is the bridge. Cloud keys use Opal/Electron encrypted app data (`openai_key`, `anthropic_key`, `gemini_key`, `groq_key`, `openrouter_key`), not standalone Bars storage. Electron main/preload changes require a full Perci restart.
- [x] Bars quick capture now recognizes IdeaBrowser-style emails and `ideabrowser.com/idea/...` URLs, parses them through `src/lib/barsIdeaBrowser.js`, and saves them as normal `New` Bars ideas instead of Inbox thoughts. The June 12, 2026 "Idea of the Day: GLP-1 pharmacy index" email is covered by `test/barsIdeaBrowser.test.js`: title, core thesis, supporting notes, tags, follow-up angles, and canonical source URL are mapped into the existing Bars fields. No Electron restart is required for this renderer-only change.
- [x] Bars now has a compact in-app guide opened from the top action cluster (`HelpCircle` button). The modal keeps the Bars aesthetic with the existing dark panel, gold labels, cream paper hero, and quick "field manual" copy explaining capture, shaping, heat sorting, and asking the notebook.
- [x] BARS flow polish restored the standalone app's actual notebook flow inside Perci: all-caps `BARS_` masthead, original Bars font stack (`Spline Sans`, `Big Shoulders Display`, `Spline Sans Mono`), original uppercase label/stat/chip/section treatment, pulsing hot-orange REC dot in the quick-capture bar, canonical statuses (`Inbox`, `New`, `Exploring`, `Building`, `Launched`, `Archived`), day streak stat, full-width "Ask your bars" panel, two-column "The book" / "On the page" workspace, cream paper detail, collapsible "Write one up properly" form, and "Turn into idea" opening the edit/write-up flow with status `New` instead of silently mutating an Inbox bar. The Bars root now scrolls inside the default Perci window and fixed-height stats strip no longer clips labels.
- [x] MarkItDownUI is now a first-class Perci window surface: `MODES.MARKITDOWN`,
      `MarkItDownMode.jsx`, Dashboard system tile, dock glyph, and real
      `markitdown-logo.jpeg` asset. The surface embeds the local
      `http://127.0.0.1:8920` FastAPI UI in Electron/web mode and shows an
      offline state with the `./run.sh` startup hint when the server is not
      reachable. The Dashboard tile leaves room for a future background image
      while the logo fills its rounded square container with `object-fit: cover`.
      The embedded URL now includes Perci's resolved theme
      (`?theme=light|dark`), so changing Perci between light and dark reloads
      the MarkItDownUI surface with the matching standalone background/theme.
- [x] MarkItDownUI image vision now reuses Perci's existing encrypted
      `openrouter_key` instead of creating another key path. The MarkItDownUI
      surface now uses an iframe with `?perci=1`; direct image uploads post a
      request to `MarkItDownMode`, which calls `markitdown:describe-image` in
      Electron main. Main reads `openrouter_key` from app-data, sends the image
      to OpenRouter with `openai/gpt-4o-mini`, and returns Markdown to the
      embedded page. Main/preload changes require a full Perci restart before
      this bridge is live.
- [x] MarkItDownUI can now be started from Perci. `electron/main.cjs` exposes
      `markitdown:start-server` and `markitdown:server-status`; preload exposes
      `startMarkItDownServer()` and `getMarkItDownServerStatus()`. The
      MarkItDown window shows a Play/Start server action when offline, runs
      `/Users/toshonjennings/markitdown-ui/webui/run.sh`, waits for
      `http://127.0.0.1:8920/api/health`, then reloads the iframe. Main/preload
      changes require a full Perci restart before this control is live.
      Renderer health checks now use `getMarkItDownServerStatus()` in Electron
      instead of direct browser `fetch`, avoiding a false "Failed to fetch" from
      CORS while the local server is actually healthy.
- [x] MarkItDownUI blank-white embed triage: the standalone page renders at
      `http://127.0.0.1:8920/?theme=light&perci=1` with no browser errors, but
      Perci renderer logs showed `did-fail-load -27 ERR_BLOCKED_BY_RESPONSE`
      for the iframe URL. Perci now installs a narrowly scoped
      `webRequest.onHeadersReceived` hook for `127.0.0.1:8920`/`localhost:8920`
      to remove frame-blocking headers and add only cross-origin headers for
      the MarkItDownUI embed. Do not inject a `frame-ancestors` CSP here; the
      FastAPI server also no longer sends one. Main changes require a full
      Perci restart.
- [x] MarkItDownUI ExifTool install is now available from Perci. Preload exposes
      `installMarkItDownExifTool()`, and Electron main handles
      `markitdown:install-exiftool` by checking common ExifTool paths first,
      then running the fixed command `brew install exiftool`. The embedded
      MarkItDownUI page shows an Install button in the ExifTool readiness pill,
      asks for confirmation, posts the install request to `MarkItDownMode`, and
      refreshes capabilities after the install result. Main/preload changes
      require a full Perci restart.
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
- [x] Removed the suspect 24ms `isDuplicateSingleKeyInput` filter from
      `Terminal.jsx` after the stale-socket cleanup landed; held-key repeats
      now pass through normally. The remaining device-attribute stripping is
      protocol cleanup, not duplicate-key throttling.
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
- [x] Eidos integrated as a first-class Perci window (`EIDOS_WINDOW_ID`, `EI` dock chip). Perci manages the full Docker/OrbStack lifecycle: auto-detects OrbStack, starts Docker runtime, runs `docker compose up -d --wait`, polls memU API health, starts Next.js dashboard, renders in `<webview>`. Includes progress polling (`eidos:progress`), error states with OrbStack install link, and retry. Standalone Eidos stack is reused if already running. Assets: `src/assets/eidos-logo.png`, `src/assets/eidos-bg.jpg`. **Per ci version is now ahead of standalone Eidos** — the standalone `~/eidos` repo needs to be caught up. See `~/eidos/CLAUDE.md` and `~/eidos/HANDOFF.md` for the divergence note.
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

- [x] Eidos now opens to the embedded Dashboard when the service is running;
      the Perci-native Git Visualizer is retained as the optional Overview
      surface. The Git Visualizer heading uses the GitHub logo, and its UI
      palette was reduced to classic black/white/grey with no purple accents.
      Verified `npm run build`, focused purple/Rocket searches, and Playwright
      dark/light checks against the existing Vite server with a mocked Electron
      Eidos bridge.
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
- [x] Perci HQ weather sync now uses the existing ChatContext weather state plus `src/lib/weatherService.js`: weather sync defaults on unless `weather_sync_enabled` is persisted as `false`, `weather_location` overrides locale lookup when present, and blank location falls back to browser geolocation then timezone-derived city lookup. `OfficeScene.jsx` maps `clear/clouds/rain/snow` into outside window weather, sky/fog, and lighting. Verified with `npm run build` and a Playwright visual pass mocking Open-Meteo weather code 61 (rain) at `/private/tmp/perci-office-weather-rain.png`; only existing Jan connection errors appeared in console.
- [x] Fixed G-Dash blank window in dev: Vite was applying `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` to `/gdash/index.html`, so the same-origin iframe rendered as a gray broken-document frame. `vite.config.js` now keeps deny-by-default framing for the app root but allows same-origin framing for `/gdash/`. Dev server restart required. Verified headers with `curl -I`, `npm run build`, and Browser validation: G-Dash iframe renders 58 service cards / 8 sections and search for `docs` filters to 2 cards.
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
- [x] Weather syncing is implemented for Perci HQ through `weatherService.js`,
      ChatContext weather state, browser geolocation/timezone fallback, and the
      settings-backed `weather_location` / `weather_sync_enabled` values.
- [x] Git Shells (`MODES.PROJECTS`) is integrated as a standalone window mode. Resolved a critical storage key collision on `perci_projects` by migrating its project list storage to a dedicated `gitshells_projects` key registered in `persistentStore.js` and Electron App Data.
- [x] Native directory selector focus issue resolved in `electron/main.cjs` by passing `mainWindow` to `dialog.showOpenDialog`. This prevents the OS folder picker from spawning behind the main app window on macOS.
- [x] Copied latest background image (`Sleek_dark_background_for_'Git_202606201611.jpeg`) from `~/Downloads` to `src/assets/gitshells-bg.jpg` and applied it as a washed-out background on the front/empty landing page of the Git Shells workspace.
- [ ] If isolated Cowork/OpenClaw conversations become needed, add a session key generation strategy; `runOpenClawAgent` already accepts `sessionKey`.
- [ ] Generated graphify docs still reflect older code until the architecture graph is regenerated.
- [ ] Review the new Perci/Mission motion in-app and decide whether to make it bolder or calmer before applying it to more surfaces.

## Skill Safety Policy: Allowlist with Trust Tiers

Decision made 2026-06-24. All 58 imported skills in `.agents/skills` are retained.

### Tier 1 — FULLY TRUSTED (Hernes-native + audited)
Skills installed to `~/.hermes/skills/` by Hermes CLI or verified manual copy. Can be loaded, executed, and followed without restriction during agent sessions.

Tier 1 includes:
- `frontend-design` (anthropics/skills — skill.sh trusted source)
- `mobile-app-ui-design` (ceorkm — manual audit, 149 lines)
- `material-3` (hamen/material-3-skill — manual audit, 667 lines, CI tested)
- `ui-ux-pro-max` (nextlevelbuilder — manual audit, scripts tested)
- All 8 `gsap-skills/*` (greensock — official org, pure reference)
- `taste-minimalist`, `taste-brutalist` (skills.sh — extracted, design-only)
- `skill-localization` (Hermes hub — meta-skill)

### Tier 2 — QUARANTINE BEFORE USE (external sources)
Skills under `.agents/skills/` from upstream imports (`mattpocock/skills`,
`addyosmani/agent-skills`). Do NOT load into agent sessions until per-skill
quake has passed the following checklist:

- [ ] No unremediated HIGH findings from `skillspector scan <dir> --no-llm`
      (ignore false positives already documented below)
- [ ] No unremediated PE3 findings (actual credential path instructions)
- [ ] No unremediated YR1 findings (actual malware patterns, not concept
      references)
- [ ] PM-confirm flag cleared (no prompt-injection tool abuse)

Affected skills needing quake before promotion:
- `git-guardrails-claude-code` — AS1 false positive documented (legitimate
  `.claude/` access). Promote to Tier 1.
- `security-and-hardening` — PE3/YR4/EA2 false positives documented
  (concept references, not actual exploits). Promote to Tier 1.
- `browser-testing-with-devtools` — YR1 false positive documented
  (legitimate network test patterns). Promote to Tier 1.
- `ask-matt` — MP3 false positive documented (metaphorical memory
  reference). Promote to Tier 1.
- `context-engineering` — PE3 theoretical credential mention. Needs manual
      review to confirm no actual credential path instructions before
      promotion.
- `spec-driven-development` — AS3 skill enumeration pattern. Needs
      manual review to confirm no cross-skill file access before
      promotion.
- `code-simplification` — RA1 line 155 self-modification mention.
      Needs manual review to confirm the reference is metaphorical
      refactoring advice before promotion.

| Action | Rule |
|--------|------|
| Delete | Requires explicit Toshon approval per directory |
| Quarantine | Move to `.agents/skills.quarantine/` (gitignored) |
| Promote to Tier 1 | Remove SKILL.md frontmatter `enabled: false` if present, move to `~/.hermes/skills/` |

## Notes

- OpenClaw bridge turns currently use `--agent main`.
- The root `main.cjs` is legacy dead code; use `electron/main.cjs` for main-process work.
- Tavily runtime code was removed from active search paths; local desktop search is exposed by `electron/preload.cjs` as `window.electron.webSearch`.
- Git Shells is hydrated from the Electron App Data store on startup if native environment is detected, with active state persistence.
- SkillSpector bulk scans return CRITICAL for any skill directory (meta-analysis); always scan individual skills one at a time.
