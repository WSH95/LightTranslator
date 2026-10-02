# Temporary Move mode for Quick Translate

Implement the user's approved October 2 plan. Preserve the frameless rounded,
translucent popup and automatic content sizing. Move is a toggle: enable it,
then drag the blank header. It suppresses focus-loss dismissal until toggled
off. Close, focused Escape and Open in main still close the popup. Each new
trigger starts a new opening in normal mode, including empty captures.

## Global constraints

Both native backends own the same state and IPC contract. State contains an
opening ID, revision and enabled flag; stale requests cannot affect a newer
opening and stale replies cannot overwrite newer state. No persisted setting
or translation-provider changes. Native drag regions exclude controls and
text. GNOME resize clamping follows the window's monitor after movement.

### Task 1: Backend lifecycle and platform contract

Write failing lifecycle cases, then implement matching Rust/Electron state,
commands, notifications, readiness snapshots and reset/hide behavior. Add the
typed shared bridge. Pending text must belong to the opening that captured it.
Validation: focused Node/Rust lifecycle tests, typecheck and native checks.
Expected: all pass; stale requests and closed windows cannot become pinned.

### Task 2: Popup interaction and monitor clamping

Verify the new interaction fails on the old UI, then add the existing-style
Move icon toggle, active state, native-confirmed drag area, failure feedback,
listener-before-ready ordering and stale-reply protection. Clamp resized
popups on their window monitor. Verify controls, text, sizing and request counts.
Expected: no drag before confirmation, no new translations on toggles, and no
monitor jump after moving the pointer elsewhere.

### Task 3: Verification and project records

Run the existing Node suite, new regressions, npm run typecheck/build, Electron
syntax checks, cargo check --all-targets and cargo test. Exercise native
renderers; open the dev app for physical Wayland acceptance and record evidence
limits. Request one fresh-context code review and fix blocking findings.
Update Project Steward, backend parity and design context. No release or push.
Expected: checks pass, remaining human/device coverage is identified explicitly.

## Review focus

Focus-loss/native move races; stale toggle commands and reply ordering; close
and empty-trigger reset paths; renderer readiness/StrictMode; pending text
identity; Electron Linux drag behavior; tiny headers; resize monitor selection.
