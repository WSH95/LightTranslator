---
updated_at: 2026-10-02T12:51:55Z
updated_by: codex
session_status: closed
branch: main
last_commit: "b15ade1 fix(quick-translate): keep movable popups above other windows"
---
# Handoff

## Now

The approved popup stacking fix is reviewed, committed and merged into local
main as b15ade1. Both revised 1.6.3 Debian packages are built and inspected,
with source commit b15ade134e363f9ccb7663c7d73abbefa6f91ad4 and helper v3.
The existing user-local helper has been refreshed to v3, but this GNOME 46
Wayland session still runs v1 until a new login. The user accepted the earlier
installed fixes but reported the behind-other-windows problem; revised
installed acceptance is pending. App version stays 1.6.3 because it has not
been published. Local commits/main integration are authorized; push/release
are authorized only after a successful test of these revised installed bytes.

## In flight

No source work remains. This checkpoint contains the closing release and
stewardship records; no build/test app or Vite server is running. Both
build processes finished successfully. T1-T3/B1-B2 are complete; T4/B3-B4
await a new-login installed test and conditional publication. Test branch is
fully merged/deleted; its managed checkout is recoverably archived. Unrelated
worktrees and AGENTS.md/CLAUDE.md were left alone.

## Next steps

1. Give the user the revised Tauri deb below. Since their installed version is
   already 1.6.3, reinstall explicitly: `sudo apt install --reinstall /home/wsh/Documents/LightTranslator/src-tauri/target/release/bundle/deb/LightTranslator_1.6.3_amd64.deb`.
   Log out and back in; `gnome-extensions info lighttranslator@lighttranslator.app`
   must report Active and version 3. Preserve the disabled preference if the
   user intentionally changes it; do not silently re-enable.
2. Obtain the user's result: enable Move, drag, click another app/page and
   confirm the popup remains visibly above it without taking focus. Disable
   Move, click away and confirm dismissal; recheck reset and explicit closing.
   The physical Wayland/helper-v3 result is not established by X11/unit checks.
3. After acceptance, verify hashes for both original and staged debs against
   releases/1.6.3-artifacts.json. Do not rebuild accepted bytes silently.
   Record acceptance and update the pending line in releases/1.6.3.md.
4. Check remote main and existing v1.6.3 tag/release state, then push main
   without force and an annotated v1.6.3 tag matching the tested code. Source
   behavior must match b15ade1 apart from stewardship records. No repeated
   publication approval is needed after acceptance; it is already authorized.
5. Publish v1.6.3 in WSH95/LightTranslator with both staged assets and prepared
   notes, verify public asset hashes and Latest status, and record publication.
6. Keep M4-M7 separate: physical monitors, native Electron fixed-window sizing,
   delayed-text integration and concurrent WebKit fixture resize timing.

## Blockers

Installed-package/new-login helper-v3 acceptance is required by the user's
release instruction. No source or build blocker remains. The current shell
reports helper v1 despite a v3 user-local copy, so testing before a new login
cannot accept the new Wayland stacking logic. No push/tag/release was written.

## Key files

- src-tauri/target/release/bundle/deb/LightTranslator_1.6.3_amd64.deb:
  Tauri, 6,075,118 bytes; SHA-256
  c974b82b92690e89a5aca35a21c8f8b407fa888ed51fb518218785322136e9d7.
- dist-electron/LightTranslator_1.6.3_amd64.deb: Electron, 92,686,108 bytes;
  SHA-256 13865ee04be75d3b91fc416f2004c462eece23c5412b85300773f169ed627f55.
- .project-steward/tmp/release-1.6.3/: matching release-named copies ending
  ubuntu22.04-or-newer.deb and ubuntu20.04-or-older.deb.
- releases/1.6.3-artifacts.json and releases/1.6.3.md: provenance, hashes and
  prepared notes; acceptance is null and published is false.
- plans/2026-10-02-quick-always-on-top.md: approved plan and remaining gate.
- VERIFY.md: full evidence; /tmp/lighttranslator-always-top-* logs/reports and
  /tmp/lighttranslator-1.6.3-above-* package logs/inspection retain details.
- .project-steward/tmp/quick-always-on-top-execution/: preserved task ledger
  and reviewed diff. User helper backup: /tmp/lighttranslator-always-top-helper-backup.

## Tried and rejected

GTK's above flag alone cannot establish Wayland stacking. The helper applies
Meta.Window.make_above on mapping and existing-window attachment, without
moving/focusing existing windows. Both native commands reassert above before
Move confirmation; stale requests do nothing and native failure retains state.
The helper owns/disconnects both window handlers and updates stale user-local
copies even when the system copy is current. Newer copies/disabled preferences
are preserved; metadata is copied after code to keep failures retryable.

Do not use a host Ubuntu 24.04 Tauri release build: its GLIBC floor breaks
Ubuntu 22.04. Use the jammy Docker build; this cached compile took 40.99s.
Electron packaged the same production bundle without rebuilding dist while
Rust consumed it. Versions match the lockfile; no dependency updates occurred.

The first parallel hidden WebKit run saw requested 300×134 but old viewport
269×80; an isolated rerun passed 67/67 unchanged. M7 retains repeatability;
do not claim that a product timing fix was made. Native X11 stacking passes
both backends, but does not establish Wayland compositor acknowledgement.

## Warnings

Automatic/type/build/Node/Rust/syntax/UI checks pass, with 16 Rust tests and
67 checks in each renderer. Native GNOME/X11 dragging, above stack after other
window focus, no focus stealing, dismissal/reset/Escape/Close pass. Physical
Wayland/GObject behavior and revised installed acceptance still need the user.
Native Electron retains its known fixed 360×200 bounds (M5); its renderer
geometry fixture is resizable. No multi-monitor acceptance is claimed.

The original 1.6.3 debs/hashes from c1cd94b are superseded by these b15ade1
builds. Install the new file, not a cached earlier copy. The app itself was not
reinstalled by the agent. After reinstall/new login, check loaded helper v3.
Never force-push or rewrite published history. Keep tested package bytes and
provenance intact; GitHub's last-read public release was v1.6.2. Existing
Browserslist, bundle-marker and desktopName notices are non-failing.
