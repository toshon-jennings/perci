# Opal Handoff

## Current Milestone

- [x] OpenClaw bridge steps 1 and 2 committed in `de24ea7`.
- [x] OpenClaw bridge step 3 committed in `3a20762`.
- [x] Mission Control now has gateway health summary and live OpenClaw event streaming.
- [x] Agents panel can run OpenClaw through the gateway agent bridge.
- [x] Cowork exposes `delegate_to_openclaw` for long-running or multi-step gateway delegation.
- [x] Perci web search now uses the desktop `web-search` bridge/native provider search path instead of Tavily.

## Known State

- [x] Reviewed and prepared the broad dirty tree for commit; changes include product UI/Build work, graph docs, and the Tavily-free search path.
- [x] Preserved Codex's in-flight work in `src/lib/integrationTools.js` and included it in the cleanup commit.
- [ ] If isolated Cowork/OpenClaw conversations become needed, add a session key generation strategy; `runOpenClawAgent` already accepts `sessionKey`.
- [ ] Generated graphify docs still reflect older code until the architecture graph is regenerated.

## Notes

- OpenClaw bridge turns currently use `--agent main`.
- The root `main.cjs` is legacy dead code; use `electron/main.cjs` for main-process work.
- Tavily runtime code was removed from active search paths; local desktop search is exposed by `electron/preload.cjs` as `window.electron.webSearch`.
