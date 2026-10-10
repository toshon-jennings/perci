**2026-10-10: Historical firstActivationMs was not true view readiness | Harness waited for exact generic Loading… while Suspense includes the tool title | Existing timing field cannot support first-ready claims | Record a separate first-committed-view check, explicitly distinguish backend/editor readiness, and retain old records without relabeling them.**

**2026-10-10: Final header contrast check found the Skills glyph below 3:1 in Light | Branded CSS hardcoded orange overrode the inherited scoped accent | Acceptance failed before timing; preserved the failed candidate and rebuilt with an explicit theme-primary glyph | Inspect actual computed icon colors and backgrounds, including branded overrides, before accepting icon-only navigation.**

## 2026-10-10 — Task helper execution context

**What happened | Root cause | Consequence | The rule that prevents repeat**

A fixture edit used main-checkout relative paths while the command ran from the clean export, and a graph helper passed `basename` directly to `Array.map` | Implicit cwd and callback arity assumptions | Helper commands failed; no product data or verified artifact was changed by these failures | Use explicit working directories/absolute task paths, and wrap multi-argument library functions when mapping.

## 2026-10-10 — Native visibility fixture hid the window before reveal

**What happened | Root cause | Consequence | The rule that prevents repeat**
A hide/show probe kept reporting a visible document | The main window began hidden behind the splash; hiding it again did not create a native visibility transition, and Playwright also emulates focus | Those attempts were rejected; the inspector-only probe waits for splash completion and shows the window first | Assert native window visibility before testing hide/show, and separate native lifecycle tests from automation visibility overrides.

## 2026-10-09 — React retry alone did not retry a failed Chromium import

**What happened | Root cause | Consequence | The rule that prevents repeat**
The first lazy-window Retry recreated React.lazy but the packaged Office fetch stayed failed | Chromium also cached the failed module URL | Native failure injection caught the broken recovery; a bounded retry of sibling packaged JS assets was added | Verify import recovery in the real file-protocol app, including the browser module cache.

## 2026-10-09 — Native fixture hydration raced initial persistence

**What happened | Root cause | Consequence | The rule that prevents repeat**
The first packaged performance fixture restored no windows | Empty-shell persistence overwrote the fixture between a native write and reload | Its layout results were rejected and a corrected run was saved separately | Override the disposable IPC read boundary and assert the exact restored window count before measuring.

## 2026-10-09 — Initial chunk trace over-counted eager imports

**What happened | Root cause | Consequence | The rule that prevents repeat**
A provisional dependency trace included lazy imports as static edges | A regex crossed dynamic import expressions in minified code | The trace was discarded and replaced with an Acorn AST walk before reporting results | Use parsed ImportDeclaration and export-source nodes for static dependency evidence.

## 2026-10-09 — Guessed source paths during planning

**What happened | Root cause | Consequence | The rule that prevents repeat**
Two orientation reads named files that did not exist, and a zsh config glob failed with no matches | I inferred familiar filenames instead of using the source map and focused file inventory | Those reads returned no evidence; no product or service state changed | Resolve exact filenames with SUMMARY.md and scoped rg --files before reading; avoid unmatched shell globs.

## 2026-10-04 — Push protection rejected synthetic fixtures

- Overlay-copying the update into an existing app bundle failed its signature resource check | Old bundle resources remained after ditto overlay | Installation was withheld until verification; original rollback preserved | Move the old bundle aside and install into a clean path, then verify the signature before launch.

- Startup probe helper edit used the candidate-export cwd instead of the main checkout | Mixed build and source paths in one command | Helper edit failed without changing source; build continued | Use explicit workspace paths for edits and separate them from candidate builds.

**What happened | Root cause | Consequence | The rule that prevents repeat**
GitHub rejected the unpushed security commit | Two literal fake-token fixtures matched secret scanners | Perci push remained blocked until fixtures were constructed in tests | Construct scanner-shaped synthetic fixtures from clearly fake segments and keep coverage unchanged.

# Mistakes

Newest entries go first. Format: **What happened | Root cause | Consequence | The rule that prevents repeat**.

**2026-10-04: A guarded edit script failed before writing because it assumed a TypeScript function had no return annotation | I matched an incomplete signature | No source change occurred and I corrected the signature | Read the exact declaration before constructing guarded edits.**

**2026-10-03: I passed Jest's `--runInBand` flag to Vitest | I used a familiar test runner flag without checking this repository's configured runner | The first verification command failed without running tests | Run the repository's documented `npm test` command or check the runner's help before adding flags.**

**2026-08-24: I called the cyan/gold legacy Tauri asset the Dotenvx logo and discussed a background around it, then answered the correction without changing the tile | I inspected the first asset named `dotenvx-logo` instead of tracing the current app icon and DMG identity before making a visual judgment, and I treated the user's correction as informational rather than part of the active fix | The dashboard kept showing the wrong mark and the user had to explicitly ask for implementation | For product identity work, trace the icon used by the current shipped app and its packaging before recommending art; when a user corrects a concrete implementation defect inside an active change request, fix and verify it unless they explicitly ask for discussion only.**
