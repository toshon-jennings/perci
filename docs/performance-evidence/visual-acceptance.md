# Native visual acceptance

Historical 0.50.3 observations: inspected packaged app screenshots in `verified-acceptance-complete/`, using the real ThemeContext Light/Dark controls. The initial native viewport was 1280×900 at scale 2; after native splash geometry settled it was 1200×800 at scale 2. These are app screenshots, not browser mocks.

- Settings Performance section: both themes show readable labels, checked/unchecked state, all four service choices, and explanatory text. Rows fit horizontally; section scrolling and Done remain accessible. No duplicated controls or new overflow observed.
- Deferred frame: saved chrome/stack and dock are retained, Open action is centered and readable. The focused dock entry has a visible outline. Screenshot uses reduced motion; native focus/activation was separately asserted.
- Failed import: error stays inside the Office frame, Retry is visible/readable, and other window chrome/dock remain available. The original light error used low-contrast red text; current artifact uses theme text tokens and a short friendly message. Stack output is development-only. Both current themes were viewed after that correction.
- Existing defects visible in the older 0.50.3 artifact at these widths: the legacy top mode navigation extends past the viewport, and many dock labels truncate with ellipses. The header clipping is now addressed by the verified 0.50.4 header follow-up. Dock labels retain their existing truncation.

The mounted current DMG Finder window was raised and viewed at its saved 540×380 point size. Artwork, app icon, Applications target, and labels were readable in dark OS appearance. A required OS Light/Dark comparison is pending the explicit appearance-change approval request; no OS preference was changed by this task.

Screenshots contain only disposable synthetic state. Physical keyboard accelerator, long-title/resize matrix, and live authenticated integration UI are not claimed by these observations.

## Pre-color 0.50.4 lifecycle observations

Final `header-0-50-4-final` native screenshots were viewed at 1200×800 in actual Light/Dark, plus the initial 1000-point Dark and long-title fixture. The top header contains only glyphs/marks, with utility actions within bounds; at 1000 points the mode group scrolls and shows a horizontal scrollbar. Keyboard focus around Map is visible, and the selected Chat outline is distinct. The observed identical adjacent guide icons were corrected by rendering the general guide in theme secondary text while Chat Guide retains the accent; both final themes show the distinction. Window title bars retain their names. Existing dock labels still truncate; they are outside the requested top-header change. Long deferred titles wrap inside the 420-point frame; its title bar truncates while controls remain available. Pointer resize/minimize and focus-shield behavior pass native assertions. All 50 lazy module initializations pass; that does not imply all unlisted modes were mounted against live services.

Final `acceptance-0-50-4-final` contains 17 passing checks against ASAR `aedb9a2347e92dbe7f5851fc5c0cddaccb9de0a2b70f9102e52005d8d6f5e852`. The current Light Settings and Dark confined-error screenshots were viewed: Performance rows/checkboxes/service selectors are readable, scrolling and Done available, and Retry uses readable theme text. Earlier current core inspections cover the same unchanged controls in the other themes; both are also captured in this final native run.

The final DMG was auto-opened and its exact Finder window selected through the Window menu. Actual native screenshot is 1080×760 at scale 2 (540×380 points): the Perci icon, Applications target, background, and black labels on the neutral shelf are present and readable in dark OS appearance, with no white padding. Opening the volume inside an existing large Finder window initially produced padding; that is not the installer window and is excluded. Mounted ASAR matches the final app. Required OS Light/Dark toggle remains pending specific approval; no OS appearance was changed. Drag/install was not performed.

## Current accessible-final header

ASAR `dad87e95afc50685cb9b684aec3055b55ef4d57771a7e5aa1939371e1f335fac`; label `header-0-50-4-accessible-final`. Both actual app-theme 1200×800 native screenshots were viewed after all six 1000/1200/1440-point layouts passed. Header contains only marks/glyphs, neutral Guide versus accent Chat Guide, theme-primary Skills glyph with colored badge, and semantic green Localhost. The light icons are visibly darker/clearer. No header utility clipping, visible titles, or document overflow observed. Map focus and selected Chat remain distinct. Existing dock title truncation remains outside this change.

Actual computed SVG foreground/composited background ratios across six layouts have a minimum of 3.5176:1. Filled Terminal/Incognito toggles are 7.8916:1 Dark and 5.0178:1 Light. These are solid primary glyph color ratios; decorative duotone tints/image logos and anti-aliased edges are not a full WCAG conformance audit. Every header button has title/aria-label. Pointer-resize/minimize retains the Chat draft, long deferred title fits its frame, focus shield activates the deferred view, and all 50 compiled lazy modules initialize. Terminal and Incognito toggles were exercised only in the disposable mock-Keychain profile, with service/network boundaries mocked/blocked and no terminal commands.

The previous `header-0-50-4-accessible` failed a Skills glyph 2.50:1 Light contrast assertion before final timings. Its evidence is retained and excluded. Current header-only palette delta is in `accessible-color-only.patch`; dimensions/performance/lifecycle code are unchanged from the pre-color 17-check, native-hide/show, and long-cycle artifact. Those checks retain their original hash boundary.

## Current installer limit

Current accessible-final DMG repair succeeds (706-byte Finder alias); mounted ASAR dad87e... matches. PNG is 540×380 and label rows have luminance0.618; its bytes match the previously-viewed pre-color artwork. Current Finder capture failed with ScreenCaptureKit stream error and later screenshot unavailable. No current visual acceptance is claimed. OS Light/Dark toggle remains pending explicit approval; no OS preference or installed app changed, no drag/install performed.
