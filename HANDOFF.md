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

## Notes

- OpenClaw bridge turns currently use `--agent main`.
- The root `main.cjs` is legacy dead code; use `electron/main.cjs` for main-process work.
- Tavily runtime code was removed from active search paths; local desktop search is exposed by `electron/preload.cjs` as `window.electron.webSearch`.
