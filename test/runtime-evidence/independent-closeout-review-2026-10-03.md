# Independent Perci / KeySafe closeout review — 2026-10-03

Implementation and release owner: chat `01a10338-152d-72c2-a8bb-c98cc65180d2`. Independent reviewer: chat `01a10466-c515-73c1-b7a3-f3a4db08915b`. Findings below were sent to the implementation chat with explicit user authorization. This review does not mark release closure.

## Confirmed: valid KeySafe attachment is blocked by a nonexistent event parameter

The current `electron/main.cjs` passes `params.id` to `validateAttachment`. `electron/guest-policy.cjs` requires this to equal `perci-keysafe`. An isolated native Electron 42.0.1 probe created a hidden BrowserWindow with an actual `<webview id="perci-keysafe" partition="persist:contract-test">`. The `will-attach-webview` event returned no DOM id:

```json
{"electron":"42.0.1","keys":["instanceId","partition","src","httpreferrer","useragent","nodeintegration","nodeintegrationinsubframes","plugins","disablewebsecurity","allowpopups","preload","blinkfeatures","disableblinkfeatures","webpreferences"],"domId":null,"partition":"persist:contract-test"}
```

The probe used an isolated scratch profile, synthetic data URL, no network listener, and exited normally. It did not open the installed Perci profile. Unit tests supplying an artificial `id` do not verify the framework contract. Acceptance: replace DOM id reliance with main-owned guest authorization/binding; prove the actual KeySafe webview attaches and generic localhost guests cannot obtain authenticated KeySafe content.

## Source-confirmed: export policy blocks the backup, while cleanup assumes success

`configureProtectedGuestSessions` cancels downloads whenever the originating guest has a protected policy. KeySafe's `handleExport` creates an encrypted Blob, clicks an anchor, immediately reports success, and offers irreversible plaintext cleanup. No completed download acknowledgment is checked. Thus the source path can offer cleanup after the host cancels the backup. Runtime confirmation remains necessary. Acceptance: complete an encrypted backup to a user-selected destination and acknowledge the completed write before offering cleanup; cancellation/failure must preserve legacy rows and never report backup success.

## Confirmed: pre-aborted broker requests still execute

A direct import of the actual renderer LLMFactory with a synthetic Electron bridge returned `{ "alreadyAborted": true, "streams": 1, "aborts": 1, "result": "request-executed" }`. `_stream` sends abort before the request exists and proceeds with stream. Acceptance: reject with AbortError before invoking the bridge when already aborted; verify cancellation during request registration too.

## Provider parity: real factory with intercepted synthetic fetch

A synthetic protocol matrix exercised 10 broker providers through the actual LLMFactory, both ordinary and tools requests. No external fetch was performed and only synthetic credentials were used. The following failed:

- OpenRouter tools reads bare `window.location.origin` in main-process Node and throws `window is not defined`.
- OpenAI, OpenRouter, and DeepInfra ordinary SSE text is ignored for valid `choices[0].delta.content`; `extractThinking` fallback does not read the delta.
- Gemini ordinary SSE forwards the candidate content object to the string tag parser, resulting in `remaining.indexOf is not a function`; candidate parts text must be extracted.

The other 14 fixture paths emitted `synthetic-ok`. All fetch-reaching paths carried an AbortSignal. This is a basic synthetic text-stream check, not exhaustive tool-call, vision, split-chunk, provider error, or packaged parity proof.

Source concern: persisted pxpipe enabled state is renderer-owned, but main-process provider clients use an unhydrated persistentStore module cache. Broker must use trusted main-process app-data settings for proxy routing; parity verification remains open.

## Expanded reproducible protocol matrix

Run `node test/runtime-evidence/probe-provider-parity.mjs`. The initial result was **34/51** passing. The 51 cases include 10 providers with ordinary text, tools text, tool calls, split-stream text, split-stream tool calls, plus renderer pre-abort. Additional split-stream text losses occur for Groq, Ollama, LM Studio, Jan, and Mistral. All protocol fixtures intercept global fetch, so no external provider request or real credential is used. The implementation owner was given the script and findings.
