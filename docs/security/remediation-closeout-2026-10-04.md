# Perci / KeySafe remediation closeout — 2026-10-04

Perci candidate: **0.50.1**. Embedded KeySafe: **0.0.1**, source commit `fd026f2896641c1f26e5fe1623ec9766ff3ef8d1`. The original audit remains unchanged. This report records verification separately from release publication.

## Implemented and verified

- Perci: 238 tests across 44 files. KeySafe: 19 tests. Both production builds pass. Focused Perci lint passes; KeySafe lint retains one pre-existing hook warning. Repository-wide Perci lint has pre-existing failures.
- Actual provider factory and broker: 51/51 synthetic protocol cases across ten providers, including split chunks, tool calls, and pre-abort. No real provider credentials or external provider requests were used.
- Packaged arm64 Electron 42.0.1: native directory selection creates a read/list capability; ungranted files, escaping symlinks, and writes through read-only grants fail. Renderer self-registration was removed; SQLite access requires exact native file selection.
- Packaged credentials: legacy provider/Jules/GDash fields are migrated, stripped from renderer app-data, and absent as plaintext on disk. Eight concurrent app-data updates survive. The packaged broker supplies its credential in main and preserves message roles. **These credential tests use Electron's mock Keychain.**
- Stream completion now has an explicit IPC marker. The preload keeps its listener until all queued chunks are processed, even when the invoke result arrives first. Regression tests exercise that ordering and error cleanup.
- Packaged Ensemble UI: a file changed after selection to contain a synthetic secret is detected at send time. Declining produces zero provider requests. Panel, judge, and synthesis each retain a system trust boundary and a separate user message containing hostile file evidence. This reduces prompt-injection risk; it does not guarantee model obedience.
- Packaged authenticated KeySafe: valid guest loads without the Perci preload. Generic attachment is denied. A generic guest sharing the existing partition cannot fetch authenticated KeySafe content. Existing partition data is preserved.
- Packaged KeySafe migration encrypts synthetic records and settings while preserving legacy copies; missing encrypted rows with migration journal entries are repaired on unlock. A completed encrypted backup contains no fixture plaintext. Tampered backup selection preserves legacy rows; selection of the matching saved backup permits confirmed cleanup.
- KeySafe cleanup holds a database transaction across verification and deletion. A regression test proves a legacy write queued from a second database connection survives. Connector copies are removed only if their current values still match the verified snapshot.
- KeySafe and pxpipe guests have no privileged preload; media, popup, off-origin navigation, and unapproved downloads are denied in the native fixture. An allowlisted encrypted KeySafe backup completes.
- Local KeySafe search produces no outbound request after startup. Cloud search requires disclosure and sends only IDs, titles, services, tags, and the query; fixture keys, notes, OCR text, and connector secrets are excluded. Cloud requests are intercepted in the probe. Startup still requests the existing Google Fonts stylesheet; the search assertion measures requests triggered by search.
- Synthetic secrets are absent from the packaged renderer log.
- KeySafe's generated production runtime is checksummed and vendored for CI, removing the private sibling-checkout requirement. DMG background repair is followed by blockmap and checksum regeneration.

Evidence: `test/runtime-evidence/probe-provider-parity.mjs`, `probe-packaged.mjs`, `packaged-result.json`, and screenshots in `output/playwright/`. Profiles are disposable, and the installed app/profile were not replaced.

## Remaining release gate

Real macOS Keychain access is unverified: three earlier disposable test processes are blocked by a native Keychain prompt. Computer use refuses access to SecurityAgent. Permission to stop those exact synthetic test instances is pending under the user's no-stop rule; their profiles and reports will be preserved. Do not stop the installed app or approve a security dialog programmatically.

The arm64 candidate was built from clean export `a82ae97`, excluding NotesMode. Accepted source `dd8c48a` differs only in synthetic redaction fixtures and the mistake log; all product sources are identical. The candidate passes 24 native checks. DMG and ZIP checksums/sizes match their regenerated manifest; their app.asar hashes match the tested directory app; ad-hoc signatures verify. Finder renders the artwork with positioned icons, and stored geometry is 540 by 380 with hidden toolbar/status bar and 100-pixel icons. Existing Finder windows can reuse their own larger geometry. The candidate artifacts are in `release-build/0.50.1/dist_electron/`, with hashes in `test/runtime-evidence/release-candidate.json`. No release tag or public artifact upload has occurred. Real Keychain acceptance and remote release-artifact verification remain necessary before calling F1–F10 release-closed. Ad-hoc signing is the existing distribution baseline; Developer ID notarization is not claimed.

## Remote and CI status

KeySafe `fd026f2` and Perci `dd8c48a` were pushed normally and their remote main SHAs verified. GitHub initially blocked two literal synthetic redaction fixtures; constructing them inside the tests retained coverage and resolved push protection without bypassing it. A manual CI build of accepted Perci source is running at https://github.com/toshon-jennings/perci/actions/runs/37179583018 for arm64, x64, and Windows. No tag was created and the public release remains v0.49.0.

Visual inspection: the touched KeySafe controls fit and are readable. Ensemble controls are readable in both themes. At the test viewport, the existing wide main toolbar causes horizontal scrolling when automation clicks the far-right theme control; screenshots reset the viewport to its normal left edge. This pre-existing layout issue is outside the security changes. Finder artwork and icon placement render correctly in the current Dark appearance; current-artifact Light Finder appearance was not retoggled.
