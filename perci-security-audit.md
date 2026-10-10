# Perci security audit

**Historical snapshot:** These findings describe the source reviewed on September 29, 2026. Later remediation is not reflected here; this report is not a statement of current vulnerability or remediation status.

Date: 2026-09-29. Daybreak Blue second pass completed. Scope: the four requested paths on `main`, plus the Electron storage and IPC code that determines their impact. This is a source audit, not a live penetration test. I did not read stored credentials or send requests to providers. KeySafe implementation evidence comes from the companion checkout at `/Users/toshonjennings/keysafe`, which Perci launches; its source is outside the Perci repository.

## Key-storage threat model (priority zero)

Assets: Perci provider API keys, KeySafe credential records and screenshots, and local project files sent to models. Trust boundaries: disk and OS account; main process and renderer; Perci renderer and webview guests; browser pages and loopback services; local files and remote LLM providers.

- Stolen, powered-off laptop: Perci encrypts only listed sensitive app-data fields with Electron `safeStorage` when an OS encryption backend is available. On macOS the key is held by Keychain; it is not a hardcoded application password. Full-disk encryption and a locked account remain necessary. KeySafe's IndexedDB records and connector keys have no application-level encryption. A browser-only Perci session also keeps provider keys in plaintext `localStorage`. Linux `safeStorage` can select `basic_text`, which does not provide meaningful at-rest secrecy. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
- Malicious local page: requesting `127.0.0.1:4100` does not by itself reveal IndexedDB records because storage belongs to the browser origin/profile and cross-origin reads are restricted. KeySafe's Vite server has no caller authentication; an untrusted page can attempt blind requests, while readable cross-origin responses and DNS rebinding depend on browser and Vite protections. Vite 8 normally checks allowed hosts and CORS; those checks are not credential authorization. A process that replaces the trusted service at the same origin, or a script that executes within that origin, can reach that origin's stored data when opened in the same profile. [Vite server options](https://vite.dev/config/server-options).
- Compromised Perci renderer: `window.electron.getAppData()` returns all decrypted app-data values, and `ChatContext` holds provider keys in React state. The bridge also exposes file and service methods. Disk encryption cannot protect secrets after this boundary is crossed. The pxpipe guest does not currently inherit that bridge.

Target design: make main the credential broker. Store provider keys in the OS credential store or fail closed if its protection is unavailable; keep ciphertext/credential handles and a migration path for existing records. Let the renderer query provider/key status and ask main to perform a narrow model request; do not return raw keys, full app-data snapshots, or arbitrary provider endpoints to it. Validate IPC sender identity and request shape in main. Encrypt KeySafe records before IndexedDB using a key unlocked by the user or an explicitly chosen OS-backed key, and keep that key outside the KeySafe origin. A user password protects against some same-account disk access only while locked; an OS-backed key favors convenience but offers less protection from an unlocked compromised account. Rotate any key discovered in plaintext backups, logs, or browser profiles after migration.

## Findings

### F1 — High — KeySafe credential records are plaintext at rest

Location: `/Users/toshonjennings/keysafe/src/db.ts:3-30` (`KeyItem`, `KeySafeDatabase`); `/Users/toshonjennings/keysafe/src/App.tsx:452-468` (`handleSave`), `:581-601` (`handleExport`), `:674-688` (connector settings); `src/components/KeysafeMode.jsx:223-233` (persistent partition).

Evidence: `KeyItem.key`, `notes`, `ocrText`, and screenshot blobs go directly to Dexie/IndexedDB. Connector API keys go directly to `localStorage`. `handleExport` serializes all records, including keys and screenshot data, as plaintext JSON. The Perci webview uses `persist:perci-localhost`, so those records remain in that Electron profile across launches. No encryption or unlock key appears in these storage paths. The UI's “stored securely” wording at `KeysafeMode.jsx:145-146` should not be read as encryption.

Impact: someone who obtains the profile or an exported backup can read the vault. Script running as the KeySafe origin can read all records and connector keys; an unlocked local account is particularly exposed. Merely fetching the loopback homepage from another process does not return these records.

Fix sketch: in KeySafe, keep only `{id, iv, ciphertext, version}` in IndexedDB and encrypt a complete record before `db.keyItems.put(record)`. Derive an AES-GCM key from a user unlock secret with a memory-hard KDF, or have a trusted native broker unwrap a per-vault key. Never persist the raw vault key in localStorage. Migrate old rows in a recoverable transaction and offer an encrypted export with an explicit plaintext-export warning. Move connector keys into the same vault or native broker. Give KeySafe its own persistent partition after an explicit migration of the existing `persist:perci-localhost` records; do not silently switch profiles and make records appear lost.

Code sketch (shape only): `await encryptedItems.put({ id, version: 1, iv, ciphertext: await encrypt(vaultKey, JSON.stringify(item)) });` — decrypt only after a successful unlock; reject reads while locked.

### F2 — Medium — KeySafe's loopback server has no caller authentication, but it is not a key API

Location: `/Users/toshonjennings/keysafe/vite.config.ts:5-10` (`server`); `src/components/KeysafeMode.jsx:15-26` (`checkAlive`), `:85-96` (`handleLaunch`), `:223-233` (webview).

Evidence: the service is a Vite development server bound to `127.0.0.1:4100`; there is no HTTP auth middleware or per-launch token. The `no-cors` probe only tests that something responds and, in Electron, the component initially assumes running until the webview load reports failure. Key records are stored in the client profile, not behind an HTTP route.

Impact: local programs and some browser requests can reach the server's unauthenticated assets. This alone is not a verified route to read or change stored keys. If an attacker controls the page served at the same origin when Perci opens it (for example, by replacing a stopped service), that page can access the KeySafe origin's persistent storage. DNS rebinding is a conditional concern, not a confirmed bypass of Vite's current host checks.

Fix sketch: replace the dev server as the vault's production surface, or require a per-launch unpredictable token for every sensitive HTTP route and reject unexpected `Host`, `Origin`, and Fetch Metadata values. Do not put the token in a query string or assume CORS is authentication. In Perci, verify a KeySafe-specific authenticated health response before displaying the guest. Do not treat an opaque `fetch` success as service identity. Bind only loopback and keep the webview on a dedicated origin/partition.

Code sketch (future sensitive routes): `if (req.headers.host !== '127.0.0.1:4100' || req.headers.authorization !== expectedBearer) return deny();` — also validate origin/fetch metadata, compare the token safely, and authenticate Perci's health check over the trusted channel.

### F3 — High — Provider keys are decrypted into the renderer; web fallback is plaintext

Location: `electron/main.cjs:1452-1567` (`encryptAppDataValue`, `readAppData`, `writeAppData`), `:1623-1629` (`app-data:get/set`); `electron/preload.cjs:15-16`; `src/lib/persistentStore.js:165-185`, `:245-254`; `src/context/ChatContext.jsx:43-47`, `:305-345`, `:569-580`; `src/components/SettingsModal.jsx:1165-1185`.

Evidence: main encrypts the listed provider keys with `safeStorage.encryptString` and migrates previously plaintext app-data on read. If encryption is unavailable, it warns and writes the value unchanged. `app-data:get` decrypts and returns the entire object to any caller with the bridge. `persistentStore` caches it in renderer memory; `ChatContext` holds all provider keys and sends them directly through browser-side LLM clients. In non-Electron mode, `writeStringStorage` writes them to `localStorage`. Settings uses a password input and a “Key set” dot, which masks casual display but does not restrict script access. `updateApiKey` calls `removeStorageKey` and then `saveElectronPersistence` asynchronously, so rapid edits deserve a persistence-order check during remediation.

Impact: a compromised Perci renderer can obtain every provider key and use its broad IPC bridge. A stolen web-browser profile exposes web-mode keys. On a machine without usable OS encryption, the app-data file can contain plaintext keys. This is the highest-priority architectural fix.

Fix sketch: change `getAppData()` to return nonsecret preferences plus boolean key status. Add narrow methods such as `credentials.set(provider, value)`, `credentials.status()`, and `models.stream({provider, modelId, messages})`; main validates provider, endpoint, size, and sender before attaching the key to a request. Require a real `safeStorage` backend before persisting secrets, especially on Linux; present an explicit recovery path when unavailable. Migrate and verify old plaintext `localStorage`/app-data entries, then remove old copies without clearing unrelated data.

Code sketch: `ipcMain.handle('credentials:status', requireMainRenderer(() => keyStore.listStatuses()))`; `ipcMain.handle('models:request', requireMainRenderer((request) => sendToAllowlistedProvider(request, keyStore)))`. Never return `keyStore.get(provider)` to the renderer.

### F4 — Medium — Log redaction and password fields reduce exposure but are incomplete controls

Location: `src/main.jsx:10`, `src/lib/redactConsole.js:1-62`, `electron/main.cjs:99-124`, `electron/redact-console.cjs:1-95`; `src/components/SettingsModal.jsx:1172-1185`.

Evidence: renderer and main console wrappers redact known key field names and a short list of token formats; `appendRendererLog` redacts console messages before writing `renderer.log`. This is useful. It does not recognize every provider format or arbitrary secrets in file content/error messages. The Settings `type="password"` masks pixels only; the full value remains in the DOM control and React state. No sampled live logs were inspected, so this is a coverage limitation rather than a confirmed leaked key.

Impact: a key with an unrecognized format included in a logged string may reach console output or `renderer.log`. A compromised renderer can read masked input values.

Fix sketch: stop logging raw request bodies, headers, file contents, full URLs, and provider error payloads at their call sites. Emit structured event names and status codes; redact by field allowlist before serialization, then retain the current pattern scrubber as a backup. Add tests with synthetic keys for every supported provider and inspect a generated log without using real credentials.

Code sketch: `logEvent('model_request_failed', { provider, status: response.status, requestId });` — do not include `headers`, `body`, `url`, or arbitrary `error.message` in the logged object.

### F5 — Medium — pxpipe guest has no direct bridge, but guest creation and navigation need enforcement

Location: `src/components/PxpipeMode.jsx:76-94` (webview); `electron/main.cjs:938-951` (`createWindow`), `:1264-1349` (global guest navigation/window handling); `electron/preload.cjs:1-23` (parent bridge).

Evidence: the pxpipe webview has `src=http://127.0.0.1:47821`, a dedicated `persist:perci-pxpipe` partition, and `allowpopups=true`. It has no `preload`, `nodeintegration`, or `webpreferences` attribute. The parent BrowserWindow explicitly sets `nodeIntegration:false`, `contextIsolation:true`, and `webSecurity:true`; Electron's current defaults sandbox renderers and constrain guests from weakening secure parent preferences. Thus the pxpipe page does not get `window.electron` merely because the parent has it. The main process has no `will-attach-webview` validation/stripping, and its `will-navigate` handler logs most guest navigation without blocking it. The global popup handler can route localhost URLs into an app tab and HTTP(S) URLs to the system browser. Guest-session permissions are covered separately in F10. [Electron webview API](https://www.electronjs.org/docs/latest/api/webview-tag), [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).

Impact: a compromised pxpipe page cannot directly invoke Perci IPC through the current webview. It can navigate the guest, initiate permitted popups, and use its own partition's web capabilities. If a future renderer edit adds a preload or weakens preferences, the missing main-process guard can make that change dangerous without review. A compromised parent renderer already has broader access through its own bridge.

Fix sketch: set `webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"` on this webview and remove `allowpopups` unless a documented flow needs it. In `mainWindow.webContents.on('will-attach-webview', ...)`, reject unapproved `src` origins, delete `webPreferences.preload`, and force `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, `webSecurity=true`. Track approved guest webContents and block off-origin `will-navigate` for pxpipe. Apply the guard to all guests by a reviewed origin registry so other integrations keep their intended flows. Validate IPC `event.sender` in privileged handlers; never expose the parent preload to a guest.

Code sketch: `if (!approvedGuestOrigin(params.src)) event.preventDefault(); delete webPreferences.preload; Object.assign(webPreferences, { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true });` — perform this in main before attachment.

### F6 — High — ContextPicker allows secrets in files to be sent to multiple providers

Location: `src/components/EnsembleMode.jsx:33-47` (`isTextFile`), `:256-285` (`loadFolderList`, `readContextFiles`), `:401-416` (`run`); `src/lib/ensemble.js:113-130` (`buildContextBlock`), `:212-267` (`runEnsemble`); `electron/main.cjs:4733-4750` (`getFiles`), `:5518-5542` (file IPC).

Evidence: `.env` and `env` are explicitly accepted, and `.json`, `.ini`, `.yaml`, and other text formats commonly carry tokens. The Electron file list excludes build directories but no secret-bearing filenames. The picker reads selected file contents into renderer state, then `buildContextBlock` sends them to every panel model, judge, and synthesis model; later rounds repeat them. Selection is manual and the UI shows file names and token estimate, but there is no secret scan or destination review. A user selecting a file is the necessary precondition.

Impact: one accidental attachment can send credentials, private configuration, or customer data to several external LLM providers and leave copies in provider logs. The multi-model fan-out multiplies exposure.

Fix sketch: exclude `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_*`, `*credentials*`, `*secret*`, cloud credential directories, and common token/config files at both listing and pre-send validation. Allow an explicit override only after showing exact files and destination providers. Immediately before every send, scan the current bytes for private-key blocks, known provider token formats, assignment names such as `API_KEY`/`PASSWORD`/`TOKEN`, and high-entropy candidate values; block and show only type/location, never the value. Re-read selected files at send time to prevent a clean file being replaced after selection. Bound file and total context size.

Code sketch: `const files = await rereadSelectedFiles(); const hits = files.flatMap(scanSecrets); if (hits.length) return showBlockedFiles(hits.map(({ path, kind }) => ({ path, kind })));` — build context only from the reviewed, size-bounded bytes.

### F7 — Medium — Attached file instructions can steer the Ensemble answer

Location: `src/lib/ensemble.js:113-130` (`buildContextBlock`, `withContext`), `:212-267` (`runEnsemble`); `src/components/EnsembleMode.jsx:401-416` (`run`).

Evidence: raw file content is prepended to the user text with a file label and an instruction to “Ground your answer in them.” There is no instruction telling models to treat file text as untrusted data. The same block reaches panel, judge, and synthesis stages. This path does not grant models a tool to read additional files or execute commands; its direct effect is on generated text and any voluntary user action based on it.

Impact: a malicious repository file can persuade models to ignore the user's task, fabricate a conclusion, or request disclosure of other data. Repeating the file across stages can reinforce the instruction.

Fix sketch: send a high-priority system/developer instruction that attached files are untrusted evidence and that imperatives inside them are data, not instructions. Place file bodies in structured quoted attachments with stable path metadata; do not interpolate them into an editable user prompt template. Keep the user task separate. Add a synthetic malicious-file regression test that verifies the model refuses embedded instructions, while recognizing this reduces rather than eliminates prompt-injection risk.

Code sketch: `messages = [{ role: 'system', content: TRUST_BOUNDARY_RULE }, { role: 'user', content: userPrompt }, { role: 'user', content: formatQuotedFileEvidence(files) }];` — keep `TRUST_BOUNDARY_RULE` outside user-editable templates and treat model output as untrusted text.

### F8 — Medium — KeySafe AI search can disclose notes and OCR text to a cloud provider

Location: `/Users/toshonjennings/keysafe/src/App.tsx:787-909` (`queryAIModel`), `:912-940` (`triggerAISearch`).

Evidence: when the user runs AI search with a cloud provider selected, `triggerAISearch` builds a prompt containing every item's title, service, notes, tags, and up to 400 characters of OCR text, then sends it to that provider. The explicit `key` field is omitted, but notes and OCR may contain credential material. The Gemini branch puts its connector key in the request URL at `:837`. This is opt-in; it is not caused by simply visiting the KeySafe loopback page.

Impact: credential-adjacent text can leave the vault during AI search. Request URLs containing a Gemini key are more likely to be captured by URL diagnostics or intermediary logs.

Fix sketch: default vault search to local indexing; before any cloud search, show which record fields and destination will be sent, exclude notes and OCR by default, and run the same pre-send secret scan proposed for Ensemble. Use a provider-supported authentication header where available and avoid placing keys in URLs.

Code sketch: `const payload = items.map(({ id, title, service, tags }) => ({ id, title, service, tags })); if (scanSecrets(JSON.stringify(payload)).length) return blockCloudSearch();` — send extra fields only after explicit per-run approval.

### F9 — High — Workspace authorization can be self-granted and symlinks escape lexical path checks

Location: `electron/preload.cjs:4-13` (filesystem bridge); `electron/main.cjs:37-70` (`isPathAllowed`), `:1411-1438` (`select-directory`), `:4733-4750` (`getFiles`), `:4804-4808` (`register-workspace`), `:5518-5542` (`list-files`, `read-file`); `src/components/EnsembleMode.jsx:256-304` (ContextPicker reads).

Evidence: `isPathAllowed` compares `path.resolve()` strings but does not compare filesystem `realpath()` values or reject symlinks. `read-file` then follows the filesystem target. A text-named symlink inside a selected project can therefore point outside the granted tree and appear in ContextPicker. More broadly, the preload exposes `registerWorkspace(path)`, and its main-process handler adds any renderer-supplied path to `allowedPaths` without a native picker grant, sender validation, existence check, or scope check. A compromised renderer can register a broad path and then invoke read/write/delete/rename or run a local executable in that directory.

Impact: a malicious repository can cause a user-selected context entry to read and send a file outside that repository. A compromised renderer can bypass the intended workspace grant completely, expanding compromise from provider keys to arbitrary user-readable files and privileged filesystem/process operations exposed by the bridge.

Fix sketch: make native selection the only operation that creates a workspace grant, return an opaque grant ID, and remove public `registerWorkspace(path)`. Bind grants to the trusted main frame. For every file operation, resolve the granted root and target with `fs.realpath`, reject symlinks or require the real target to remain beneath the real root, and use `lstat`/no-follow semantics where supported. Apply the same check after opening the file to reduce check/use races. Keep separate capabilities for read, write, delete, and process execution.

Code sketch: `const realRoot = await fs.realpath(grant.root); const realTarget = await fs.realpath(candidate); if (!isWithin(realRoot, realTarget)) throw new Error('Access denied');` — the grant itself must originate in main from the directory dialog, never from a renderer-provided path.

### F10 — Medium — Custom webview sessions have no deny-by-default permission handler

Location: `electron/main.cjs:958-979` (`setPermissionCheckHandler`, `setPermissionRequestHandler`); `src/components/PxpipeMode.jsx:76-84`; `src/components/KeysafeMode.jsx:223-233`.

Evidence: the permission handlers are installed on `win.webContents.session`, the main renderer's session. pxpipe and KeySafe explicitly use different persistent partitions (`persist:perci-pxpipe` and `persist:perci-localhost`), and no handler is installed on those sessions. Electron documents that permission requests are automatically approved when a session has no custom handler. This finding concerns browser permissions, not the Perci IPC bridge: neither guest currently receives the parent preload. [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).

Impact: a compromised embedded page can request browser capabilities that should be unnecessary for these dashboards, including clipboard, notification, media, or other Chromium permissions, subject to platform-level gates. Clipboard access is especially relevant in a credential workspace where copied secrets may be present.

Fix sketch: obtain each partition with `session.fromPartition(...)` during app startup and install both a permission-check and permission-request handler that deny everything by default, then allow only a documented capability for an exact origin and webContents identity. Do this before any guest loads. Keep the main renderer's microphone exception scoped to its current trusted frame.

Code sketch: `const guestSession = session.fromPartition('persist:perci-pxpipe'); guestSession.setPermissionCheckHandler(() => false); guestSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));` — add narrow exceptions only if a verified feature requires them.

## Prioritized fix list

0. Redesign API-key storage and use around the three threat actors above: OS-backed or user-unlocked storage, no raw keys or full app-data in renderer, narrow main-process provider calls, fail closed on insecure backends, migration and rotation plan. This also gives KeySafe a deliberate vault key design. (F1, F3)
1. Restore a real filesystem capability boundary: remove renderer self-registration, bind grants to native selection and trusted senders, and enforce realpath/no-symlink containment for every operation. (F9)
2. Stop accidental outbound secret disclosure from Ensemble: deny sensitive paths, scan bytes immediately before send, show all destination providers and require a deliberate override for flagged files. (F6)
3. Ship KeySafe from a trusted, authenticated local surface, preserve/migrate its existing profile, and encrypt existing records and exports. Validate the service identity before embedding it; make cloud AI search field disclosure explicit. (F1, F2, F8)
4. Constrain all webview creation and pxpipe guest navigation in Electron main; remove unnecessary popups, install permission handlers on every partition, and validate privileged IPC senders. (F5, F10)
5. Separate untrusted file text from instructions in every Ensemble stage and test with malicious fixture content. (F7)
6. Replace raw diagnostic payloads with structured, nonsecret events and test redaction coverage. (F4)

## Verification boundaries

These conclusions come from source on `main` and the companion KeySafe checkout. I did not inspect live IndexedDB, macOS Keychain state, current Vite response headers, browser DNS-rebinding behavior, or actual provider logs. Before closing remediation, verify packaged Electron settings (`sandbox`, preload, guest navigation and per-partition permissions), both Electron and browser storage paths, a KeySafe migration using a disposable profile, realpath containment with benign symlink fixtures, and a synthetic secret reaching the Ensemble pre-send gate without making an external model request.
