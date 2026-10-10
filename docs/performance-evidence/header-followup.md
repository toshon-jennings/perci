# Header follow-up — 0.50.4

The user requested icons with tooltips throughout the top header, because appended app titles overflow it. Root owns this contained follow-up within the existing audit route.

Direction: a compact desktop toolbar using the existing tool glyphs and brand marks. Mode buttons have fixed 32-point targets and 17-point glyphs, native hover tooltips, accessible names, pressed state, and theme-aware selected/focus contrast. Existing branding/status colors remain; no extra per-tool palette is introduced. The mode group can scroll at narrower widths while utility actions stay available.

Changed source: `src/components/ModeSwitcher.jsx`, the header portion of `src/App.jsx`, and package/lock versions from 0.50.3 to 0.50.4. Visible header labels, including updater labels, move to tooltips/accessibility; updater announcements remain screen-reader status text. The Perci brand mark remains with a Desktop/Web Fallback tooltip.

The 0.50.3 performance-core artifact/evidence are preserved and do not verify this new header. Current 0.50.4 packaging, visual inspection, and tests remain pending. The baseline 0.50.2 soak is running undisturbed. Its Python coordinator (PID 47449) is paused; its Node child (PID 52659) continues the full authorized measurement and closes only its disposable app normally. After that child ends, retire the paused coordinator, build the new candidate, and run current-candidate startup/empty/soak comparisons separately. Do not resume it into the obsolete candidate soak.

The source follow-up is complete. A build coordinator (`build-header-candidate.py`, exec session 37734) waits for the baseline child to exit, retires only its obsolete paused supervisor, and then creates a clean 0.50.4 export/package. Native checks are prepared for 1000/1200/1440-point widths, both themes, keyboard focus, Chat resize/draft retention, safe packaged module initialization, and a long-title/focus-shield fixture. These are pending execution and are not yet verification claims.

This task is not replacing the installed app. A full fresh reviewer must inspect the combined performance and header changes after parent verification.

Native initial 0.50.4 header checks passed at 1000/1200/1440 points in both themes, with no visible header labels, named title/aria tooltips, keyboard focus, no document overflow or clipped utilities, Chat draft retention across pointer resize/minimize, long deferred title wrapping, focus-shield activation, and 50 packaged module initializations. Actual screenshots were viewed. The observed adjacent guide-icon ambiguity prompted a theme-secondary color for the general guide, retaining the Chat Guide accent. A final artifact is being packaged in `release-build/performance-0.50.4-final`; initial 0.50.4 artifacts/evidence remain separate. The source and asset manifests will be verified again against that final artifact.
