# Keep Move popups above other windows

Approved by the user in-session on 2026-10-02. Keep unpublished app version 1.6.3.
The popup already requests always-on-top in both backends. GNOME Wayland must
apply the above layer through the bundled helper; normal mode still closes on
blur and Move retains it. No public IPC, settings or translation API changes.

## Global constraints

- Preserve rounded transparency, automatic sizing, initial pointer placement and
  monitor-aware clamping. Explicit close and new-invocation reset stay intact.
- Guard native effects by the current opening ID. A native failure must not
  change Move state or publish a successful transition.
- Refresh stale user-local helpers without downgrading newer copies or
  re-enabling an extension that the user disabled.
- Main integration and local commits are authorized. Publication follows a
  successful test of the revised installed package; no remote writes before it.

## Review focus

- GNOME helper attachment to an existing popup must not steal focus or move it.
- Extension disable/re-enable must disconnect its own handlers.
- A stale opening request must never touch a newer native window.
- Older per-user files can override the new packaged helper after login.
- Unit/renderer checks cannot establish physical Wayland stacking or acceptance.

### Task 1: Enforce popup stacking

- [x] Add failing regressions using the shipped GNOME helper for mapping,
  existing windows, unrelated windows and lifecycle cleanup.
- [x] Add native-effect failure/stale-request regressions to the Move lifecycle
  and Electron IPC handler.
- [x] Apply make_above at map and helper attachment, preserving placement only
  for new maps. Ship helper version 3 with an accurate description.
- [x] Reassert native always-on-top before confirming valid Move enable in both
  backends, keeping previous state on failure. Update the Move tooltips.
- [x] Run focused tests, Node suite and Rust checks/tests; record results.

### Task 2: Upgrade the helper and prepare the release

- [x] Add failing installer regressions for system-current/user-stale,
  system-stale/fresh-user, current/newer-user and disabled-extension cases.
- [x] Mirror stale user-copy refresh in both installers; write metadata after
  the code so an incomplete copy remains eligible for retry.
- [x] Run typecheck, build, Node/Rust checks, syntax and WebKit/Chromium checks.
- [x] Review the entire branch, commit code with Project Steward records, and
  merge locally into main.
- [x] Build the Tauri jammy and Electron debs; inspect contents/metadata and
  record fresh hashes/provenance/release notes. Refresh the installed user
  helper and arrange installed testing after a new Wayland login.
- [x] After revised installed acceptance, push main/tag and publish v1.6.3.

## Completion

The user accepted the revised installed package on October 3, 2026. GNOME
reports helper v3 ACTIVE. Pushed main and annotated v1.6.3 at a903335, then
published both accepted Debian files as the Latest GitHub release. Downloaded
assets match the recorded size and SHA-256; notes match the prepared file.
Source behavior at the tag matches reviewed b15ade1. No rebuild occurred.
