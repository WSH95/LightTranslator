# Fix the popup's clipped last line

Implement the approved plan alongside the staged Move changes. The screenshot's
27-character Chinese result wraps into a half-hidden second line when a
scrollbar takes width that the independent body measurement did not reserve.
The Wayland/GTK reproduction failed at 438×110; a scrollbar-reserved measurement
prototype passed all three text sizes and long-to-short transitions.

## Global constraints

Preserve the rounded/translucent appearance, automatic scrollbar visibility,
width settings, 500px height cap, language menus and Move behavior. No public
API, native command, provider or persisted application-setting changes.
The user authorized automatic local commits and merging into main after checks.

### Task 1: Regression and scrollbar-aware measurement

Add a failing real-renderer regression for the screenshot text, checking actual
last-line bounds and short-content overflow. Make the fixture match Tauri's
Wayland GTK structure and quick-window typography. Pass the real scroll
container to measureQuickWindowLayout. Measure its cloned padded contents in
both passes, forcing overflow-y: scroll only on the hidden clones so browser
scrollbar width is included. Keep body observation and the existing coordinator.
Validate all text sizes, width limits, loading/result transitions, repeated
invocations, long-result bottom visibility and long-to-short shrink.
Expected: the first regression fails before the product change, then all
WebKit/Chromium sizing and existing Move checks pass without extra requests.

### Task 2: Verify, review and integrate

Run npm run typecheck, npm run build, the seven-file Node suite and strict UI
audit. Inspect screenshots; request a fresh code review of the final changes.
Open the native Tauri dev app on Wayland for the user's clipping confirmation.
Update Project Steward with results and evidence limits, then commit related
code/records and merge the verified branch into local main automatically.
Expected: automated checks pass, native result is accurately recorded, main
contains both Move and clipping fixes, and the working tree is clean.

## Review focus

Clone gutter behavior, fractional dimensions, viewport-independent measuring,
loading and font transitions, menu geometry, capped scrolling, and preservation
of the previously reviewed native Move lifecycle.
