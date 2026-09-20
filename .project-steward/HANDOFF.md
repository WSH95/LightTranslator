---
updated_at: 2026-09-20T00:30:00Z
updated_by: claude
session_status: closed
branch: main
last_commit: (version bump 1.3.0, merged from fix/wayland-quick-translate)
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

v1.3.0 is on `main` and pushed: Quick Translate works in Wayland sessions, the
OCR dialog stays inside the window, and the main window has rounded corners.

The user reported all three problems on Ubuntu 24.04 / GNOME 46 / Wayland,
installed the resulting package, logged out and back in, and confirmed it works
(the placement extension reports `State: ACTIVE`). Plan of record:
`~/.claude/plans/pasted-content-id-d703-i-have-noble-eclipse.md`.

How the hotkey now works, per session type:

- **X11**: unchanged — the app grabs the key itself and places the popup at the
  pointer. Any GNOME entry left by a Wayland session is removed at startup
  (with retries, because gnome-shell ungrabs asynchronously).
- **Wayland on GNOME**: GNOME owns the key through a custom keybinding at our
  own dconf path running `<exe> --quick-translate`; the single-instance plugin
  hands it to the running app, which reads the PRIMARY selection (mutter bridges
  it to X11 regardless of focus) and never touches the clipboard. The bundled
  shell extension moves the popup to the pointer.
- **Wayland elsewhere**: Settings shows the command to bind by hand.

## In flight

Nothing. Working tree clean, `main` pushed.

An earlier record this file had not carried: v1.2.2 **was** released — PR #4 was
squash-merged as `c17bec0` with the tag and GitHub release published on
2026-08-26. v1.3.0 has **no tag or GitHub release yet**; only the branch merge
was requested.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. If a release is wanted: build the Electron `.deb` too
   (`npm run electron:build:deb`), tag `v1.3.0` on `main`, and publish a GitHub
   release with both packages — the pattern used for 1.2.0 and 1.2.2.
2. The Electron backend's Wayland path was verified in dev, never as an
   installed package. Worth one pass on an Ubuntu 20.04 Wayland session before
   claiming it there.
3. Backlog items untouched by this work are still listed under "Later" in
   PLAN.md (single-instance is now done; Wayland selection capture is done).

## Blockers

None.

## Warnings

- The GNOME shortcut entry and the per-user extension state survive
  uninstalling the app; the README carries the cleanup commands.
- Dev builds write their own dconf entry (`…/custom-keybindings/lighttranslator-dev/`)
  so they cannot repoint the installed app's shortcut. Quit the installed app
  before `cargo tauri dev`, or the single-instance plugin forwards to it.
- Electron's second instance costs ~1.4s to forward `--quick-translate` (full
  Chromium start) against Tauri's 0.18s. Only matters on Wayland, which is rare
  on the distributions the Electron build targets.
- On GNOME the shortcut does not fire on the lock screen, in the Activities
  overview, or over a system-modal dialog (`GSD_ACTION_MODE_LAUNCHER`).
- The WebKitGTK build dependencies are now installed on this host, so Tauri
  builds natively here (supersedes DECISIONS 0005). Release packaging for
  Ubuntu 22.04 compatibility still belongs in the jammy Docker builder.
