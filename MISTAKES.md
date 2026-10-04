## 2026-10-04 — Push protection rejected synthetic fixtures

**What happened | Root cause | Consequence | The rule that prevents repeat**
GitHub rejected the unpushed security commit | Two literal fake-token fixtures matched secret scanners | Perci push remained blocked until fixtures were constructed in tests | Construct scanner-shaped synthetic fixtures from clearly fake segments and keep coverage unchanged.

# Mistakes

Newest entries go first. Format: **What happened | Root cause | Consequence | The rule that prevents repeat**.

**2026-10-04: A guarded edit script failed before writing because it assumed a TypeScript function had no return annotation | I matched an incomplete signature | No source change occurred and I corrected the signature | Read the exact declaration before constructing guarded edits.**

**2026-10-03: I passed Jest's `--runInBand` flag to Vitest | I used a familiar test runner flag without checking this repository's configured runner | The first verification command failed without running tests | Run the repository's documented `npm test` command or check the runner's help before adding flags.**

**2026-08-24: I called the cyan/gold legacy Tauri asset the Dotenvx logo and discussed a background around it, then answered the correction without changing the tile | I inspected the first asset named `dotenvx-logo` instead of tracing the current app icon and DMG identity before making a visual judgment, and I treated the user's correction as informational rather than part of the active fix | The dashboard kept showing the wrong mark and the user had to explicitly ask for implementation | For product identity work, trace the icon used by the current shipped app and its packaging before recommending art; when a user corrects a concrete implementation defect inside an active change request, fix and verify it unless they explicitly ask for discussion only.**
