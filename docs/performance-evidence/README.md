# Perci performance and icon-only header — 0.50.4 candidate

Source implementation and parent checks are complete. The resumed fresh pinned Sol / High audit returned **ship** with no required findings; root verified its exact before/after state and accepted the reviewed candidate. The first review's PDF-claim correction is incorporated. This continuation did not install, restart, commit, push, or publicly release the candidate. The original 10 GB observation has not been reproduced. Known target misses and visual verification limits remain below.

## Current artifact and inputs

App: `release-build/performance-0.50.4-accessible-final/mac-arm64/Perci.app`.
Installer: `release-build/performance-0.50.4-accessible-final/Perci-0.50.4-arm64.dmg`.
ASAR SHA256: `dad87e95afc50685cb9b684aec3055b55ef4d57771a7e5aa1939371e1f335fac`.

`candidate-source-0.50.4-accessible-final.json` records HEAD plus the owned main-checkout overlay. At build time, its clean export reused the exact locked dependency tree from the earlier npm-ci export by node_modules symlink (npmRebuild false). `artifact-0.50.4-accessible-final.json` proves 249 shipped CJS/Vite files byte-match that export, current owned source hashes, package identity/main/version, ad-hoc signature, and exclusion of unrelated Notes edits. Electron-builder transforms package.json; identity fields are checked separately. Notarization was skipped. The live unrelated Notes/audit/startup probe hashes match `preserved-files.json`; original startup profile was not used.

On 2026-10-10 resumption, all 29 owned source hashes, final ASAR hash, package identity, signature, and unrelated-file preservation were rechecked successfully (`resume-verification-2026-10-10.json`). The clean exports and baseline app are now absent; they were not removed by this continuation. The 249-file comparisons remain prior evidence bound to the unchanged final ASAR, and cannot currently be repeated against the absent export. Both candidate apps and final DMG match their earlier hashes.

## Behavior and checks

Restored window geometry remains, with view initialization deferred until activation by default. Previously opened views keep their state when minimized. Eligible polling, Office draws, dashboard timers and gateway probes reduce work while hidden. Four service policies support manual/on-open/on-startup; restored frames do not imply an on-open launch. Main-process single-flight joins duplicate accepted starts without changing authenticated KeySafe identity or persisted guest partitions. Optional modes use deferred imports with bounded failed-chunk retry. HTML canvas export loads on Download; the PDF import is called there too, but the shipped shared chunk graph still loads/evaluates PDF at startup, so PDF startup deferral is not achieved. The header contains only marks/icons with title tooltips and accessible names; mode buttons scroll at narrow widths. Colors distinguish Guide/Chat Guide, Localhost and Skills without titles.

- 48 test files / 248 tests pass (`tests-0.50.4-accessible-final.txt`).
- Clean Vite build and arm64 package succeed (`candidate-*-0.50.4-accessible-final.txt`).
- 27 changed source files introduced no lint messages before the final one-glyph correction. Final App/ModeSwitcher lint still introduces none; three existing App unused values remain (`lint-header-accessible-final.json`). Repository-wide baseline lint is not closed.
- Native current `header-0-50-4-accessible-final` passes six 1000/1200/1440-point layouts across actual Light/Dark, tooltips/names, keyboard focus/selection, utility bounds/no visible header text/no document overflow, pointer resize/minimize draft retention, long deferred title/focus-shield, and 50 packaged module initializations. Both 1200 screenshots were viewed. Min computed solid SVG contrast 3.5176:1; filled Terminal/Incognito 7.8916:1 Dark / 5.0178:1 Light. Decorative duotone tints/image logos are outside this color check. Existing dock label truncation remains.
- `first-open-0-50-4-final` records first committed view DOM for all 11 fixtures, 62–688 ms with synthetic services. This excludes real backend readiness and does not measure editor readiness/cold parse. Historical `firstActivationMs` merely waits for a generic loading label and is not usable first-ready evidence.

## Lifecycle evidence boundary

Full `acceptance-0-50-4-final` has 17 passing checks, and `native-visibility-0.50.4` verifies actual native hide/show without Playwright focus emulation: Docker/Dashboard 2/1 remain unchanged for 11 seconds hidden, then 3/2 on show. These, and the long cycle, ran against the pre-color ASAR `aedb9a2347e92dbe7f5851fc5c0cddaccb9de0a2b70f9102e52005d8d6f5e852`. The current source differs only in header colors, explicitly recorded in `accessible-color-only.patch`; dimensions, activation, policies, polling, and lifecycle are unchanged. Current header/import/draft and six short measurements were repeated; repeating 20 minutes of lifecycle work for color constants was not warranted.

The 17 checks cover 11 restored deferred frames/zero starts; themes/focus; Electron cycle menu action; confined failed import/Retry; same-canvas Office WebGL/jobs pause/resume; Chat/Code drafts, active Chat response, Notes/Code Monaco buffers; fixture openings; minimized Docker one-refresh; native Settings persistence; immediate restore without on-open starts; manual/retry/startup once; same-buffer/connection xterm continuity. Synthetic model output and terminal activity continue hidden. All unlisted modes were initialized as modules, not mounted with live authenticated services.

Fixtures use disposable profiles/mock Keychain; external renderer/guest requests and service starts are blocked/mocked. Monaco and Office font assets are supplied locally; xterm uses an ephemeral synthetic WebSocket without commands. A synthetic host webview failure event is used for GitHub offline state. No real backend readiness, shared Docker lifecycle, credential/storage closure, guest timer pausing, physical OS accelerator, or backend memory saving is claimed. See `visual-acceptance.md` for observations.

## Measurements and target assessment

Raw records and spreads: `comparison-summary-0.50.4-accessible.json`. Three serial launches per fixture, sampled after 60 seconds idle. Summary Footprint is approximate macOS summed process accounting; CPU uses primed Electron intervals. Shell timing is fixture hydration reload after mock setup, not cold launch or backend readiness.

| Fixture | Metric | Baseline 0.50.2 median | Current 0.50.4 median | Change |
| --- | --- | ---: | ---: | ---: |
| Restored, unopened | Footprint | 1008 MB | 626 MB | 37.9% lower |
| Restored, unopened | CPU | 7.2077% | 4.6508% | 35.5% lower |
| Restored, unopened | Reload | 2248 ms | 947 ms | 57.9% lower |
| Empty | Footprint | 876 MB | 626 MB | 28.5% lower |
| Empty | CPU | 5.3587% | 4.6418% | 13.4% lower |
| Empty | Reload | 606 ms | 816 ms | 210 ms / 34.7% slower |

The >=20% restored footprint target passes. No startup guests/automatic-start fan-out in the current sampled fixtures. **The <=10% reload regression target fails for Empty.** Raw empty reloads are baseline 836/587/606 versus candidate 433/816/2707 ms; candidate footprint 1085/626/577 MB (baseline 711/876/940). Large spread is retained, not dropped. The 1085 MB candidate sample is chiefly GPU 513 MB plus renderer group 470 MB; other candidate samples have GPU 174 MB and lower renderer footprint. Splash bounds can change from 1280×900 to 1200×800 during hydration; the slow candidate run already records 1200×800, while other empty records start 1280×900. This is a material timing/viewport-transition caveat. All 60-second measurements occur after the splash interval, but no claim of tightly controlled cold-start timing is made. Fixed geometry before reload and interleaved runs are the next measurement improvement if precise launch comparisons are required.

Five-minute idle plus twenty-minute fixed open/minimize cycles (27 baseline / 28 candidate cycles; warm cycles 1–3 excluded) yield median CPU 13.0898→5.1504%, **60.7% lower**. Eligible hidden-work CPU target passes for this materially nonzero synthetic workload. Candidate first/last-three footprint medians **1059→1107 MB**, fitted +4.1424 MB/min. Renderer group 515→564 MB/+2.7827 MB/min; baseline renderer 620→681 MB/+4.2339 MB/min. GPU first/last medians 456→453 MB with cache fluctuations; baseline 727→758 MB. **The no-sustained-growth target is not established/passed.** A finite run cannot establish leak freedom, and the modest positive renderer slope remains unresolved. Retain the demonstrated startup/view/CPU savings; do not claim automatic RAM reclamation for already-used editable guests. Safe unloading needs a separate draft-checkpoint contract. Process breakdown: `cycle-process-breakdown.json`.

## Actual reload traces

`reload-trace-analysis.json` and two raw CDP traces capture one separate instrumented empty hydration reload each, after bootstrap. Caches may be warm, instrumentation changes timings, and event durations overlap. They are not cold/uncached parse proof or a causal explanation of the three-run regression.

Baseline/current background module parse events 9→6, summed overlapping duration 72.133→52.272 ms; module evaluation 119.613→76.005 ms. Shared vendor remains the largest current background parse event (34.175 ms), followed by entry 6.022 and PDF 5.873 ms. Layout-tree events sum 284.604→377.981 ms; paint ~134 ms both. This identifies substantial remaining layout/shared-dependency costs rather than proving parsing caused the empty regression. Traced shell reloads 1128→1018 ms differ from uninstrumented medians. Eager AST graph is six chunks totaling 2,608,699 bytes; entry 482,234 bytes. AST reachability is distinct from actual trace evidence.

## Installer verification limit

Required global Finder repair succeeded (706-byte alias), metadata/blockmap refreshed, mounted ASAR matches final app. Current `.background/background.png` is 540×380 PNG, label-row luminance 0.618 for both icons, and bytes match the already-viewed pre-color installer artwork. Current exact installer capture failed: initial ScreenCaptureKit stream error and then Finder screenshot unavailable. The pre-color 540×380 installer was actually viewed, but that is not a current-artifact visual check. Required macOS Light/Dark toggle is pending the specific appearance-change approval request; no OS preference changed. Drag/install is unrequested and untested. Do not claim complete installer visual acceptance or public release.

## Audit

Audit route: root implementation/verification then fresh `sol_advisor_sol_reviewer`; no implementer was delegated. First review required only the PDF documentation correction, which invalidated its verdict. Second review hit its usage limit and returned no verdict; its recovered 1,356-file/four-artifact snapshots match exactly (SHA256 `cb30abfe4aa2b1dfd3007feeac75c3d314a56d065d55432491cc76aa96ba04d1`).

After usage resumed, the user confirmed keeping this GPT-6.1 Sol / High primary chat and waiving only the installed skill's GPT-5.6 primary-chair requirement. Fresh reviewer thread `01a126c2-2d10-7fa3-be90-11d286bdb444` was verified as exact `sol_advisor_sol_reviewer` / GPT-5.6 Sol / High. It inspected actual changes and evidence, returned **ship**, and found no required fixes. Root accepted after proving exact before/after equality across 1,358 files, three retained artifact hashes, and the recorded baseline absence: both snapshot SHA256 `9aa94d4f2aa621e2f274901984d89e193d6a2a94bf8ce0ba58ce8866b3edec4d`. Its observed host policy was danger-full-access/disabled: behavioral read-only, not enforced isolation. Ignored dependency/build trees outside the named artifacts were not recursively hashed. Full record: `review-3.json`.

The verdict accepts the reviewed changes with the disclosed limits; it does not establish the missed engineering targets, visual installer acceptance, leak freedom, or public release readiness. No installed app/shared service was stopped. Earlier authorized disposable fixture closure remains historical; this continuation launched none.

## Splash investigation on resumption

`splash-investigation-2026-10-10.json` records the read-only check. Installed Perci is running the pre-color 0.50.4 artifact (`aedb9a…`), not final accessible-header artifact (`dad87e…`). The supplied 6:41 AM screenshot predates the current process. The latest startup log records successful main-document load without a subsequent startup watchdog or renderer crash; the native accessibility tree exposes Dashboard and its icon-only controls. That tree is not rendered proof: its clock remained unchanged, window captures returned white, and the Raise/state/capture attempt failed with ScreenCaptureKit -3812. Current visual splash state remains unverified; no restart, reload, replacement, theme change or service stop was performed.

## Source publication and profile cleanup — 2026-10-10

The user authorized staging, committing and pushing the reviewed changes, including `perci-security-audit.md` if it contains no secrets. Manual inspection and Gitleaks found no credentials in that report; it is explicitly labeled a historical September 29 source audit, not current remediation status. The exact staged-content scan flagged ten entries, each independently verified as the SHA256 of `src/components/KeysafeMode.jsx`, not a credential. No unexplained findings remain. `publication-check-2026-10-10.json` records the classification and scope. The existing version bump from 0.50.2 to 0.50.4 is retained so source identity matches the reviewed candidate; no release tag or automated installer publication is requested.

The user separately approved moving all 62 retired runtime profiles to macOS Trash. All 11,615 files / 348,615,606 bytes moved with verified counts/sizes; the installed app and its user profile were untouched. Compact measurements, screenshots, traces and `test/runtime-evidence/startup-probe.json` remain. `profile-cleanup-2026-10-10.json` lists the removed-from-checkout profile paths; the local recovery pointer is `release-build/profile-cleanup-recovery.json`. Runtime profile payloads are excluded from Git; the startup profile now has an explicit root ignore rule. The unrelated `NotesMode.jsx` edit remains unstaged. A fresh `npm test` run passes all 248 tests across 48 files. These administrative publication/cleanup changes do not alter the reviewed product or candidate artifact.
