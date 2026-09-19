---
updated_at: 2026-09-19T23:35:00Z
updated_by: claude
session_status: active
branch: fix/wayland-quick-translate
last_commit: 4d08071
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

Working on `fix/wayland-quick-translate` (4 commits on top of `main`), fixing
three things the user reported on Ubuntu 24.04 / GNOME 46 / Wayland:

1. the Quick Translate hotkey did nothing under Wayland,
2. the OCR dialog overflowed a non-maximized window,
3. the main window had square corners.

All three are implemented in both backends. Plan of record:
`~/.claude/plans/pasted-content-id-d703-i-have-noble-eclipse.md` (approved,
including the user's choices: X11 keeps the app's own key grab, Wayland uses a
GNOME custom shortcut, popup placement comes from a bundled GNOME Shell
extension that installs itself, OCR dialog restyled).

Earlier history this file had not recorded: v1.2.2 **was** released — PR #4 was
squash-merged as `c17bec0`, and the tag and GitHub release went out on
2026-08-26 with both .debs. Verified with `git` and `gh` at the start of this
session.

## In flight

- `cargo tauri build --bundles deb` is running (release); the artifact will be
  `src-tauri/target/release/bundle/deb/LightTranslator_1.2.2_amd64.deb`. It is
  needed both for the user to install and for screenshots of the Tauri UI
  (WebKitGTK), because a Wayland-native window cannot be captured with `xwd` —
  run the release binary with `GDK_BACKEND=x11` for that.
- Nothing is pushed. The branch is local only.

## Validation completed

- `npm run typecheck`, `npm run build`, `node --check electron/main.js` pass.
- 15 JS/TS unit tests:
  `node --test utils/shortcutUtils.test.ts electron/gnomeShortcut.test.js`
  (pass files, not directories — `node --test <dir>` executes non-test files).
- `cargo check --all-targets` clean; `cargo test` 4/4 (needs the WebKitGTK dev
  packages, installed by the user this session).
- Electron backend on this GNOME 46 Wayland session, end to end: text selected
  in a Wayland-native GTK app came back translated in the popup; GNOME entry
  written with the right name/command/binding; repeat triggers work; a second
  plain launch focuses the running app instead of duplicating it; extension
  auto-installed and enabled; Settings reports the true state.
- Tauri backend on the same session: registers the GNOME shortcut, reports the
  extension as pending-restart, and a `--quick-translate` second instance
  delivers the trigger in **0.18s** (Electron's costs ~1.4s), after which the
  log shows the PRIMARY read and the translation request.
- Independent evidence for the core assumption: text selected in a
  Wayland-native app is readable from an X11 client, i.e. mutter bridges the
  PRIMARY selection regardless of focus.
- UI at 480x680, at the 400x500 minimum and maximized (Electron/Chromium):
  OCR dialog stays inside the window and scrolls; corners rounded when
  windowed, square when maximized.

## Next steps

1. When the build finishes: run the release binary with `GDK_BACKEND=x11` and
   capture the main window, the OCR dialog and a maximized window to confirm
   WebKitGTK renders the corners and the dialog like Chromium did.
2. Sanity-check the X11 code path without leaving Wayland by starting the app
   with `XDG_SESSION_TYPE=x11` forced: it must remove the GNOME entry and grab
   the key itself, and Settings must say "Registered directly with the X server".
3. Hand the `.deb` to the user to install (`sudo apt install ./<file>.deb`),
   ask them to quit the running 1.2.2 instance first, then log out and back in
   so GNOME loads the placement extension.
4. User-only checks: pressing the real Ctrl+Shift+X, and a full pass in an
   "Ubuntu on Xorg" session (popup still follows the cursor, the GNOME entry is
   removed automatically, changing the shortcut still works).
5. Update VERIFY.md's "Last verified" block, wrap the session, and propose the
   PR (never push without asking).

## Blockers

- None blocking implementation. Two things only the user can do: log out once
  to activate the GNOME extension, and test an Xorg session.

## Warnings

- Dev builds use their own dconf path (`…/custom-keybindings/lighttranslator-dev/`)
  and their own entry name. The one written during this session's testing has
  been removed again; the user's custom-shortcut list is empty.
- The GNOME extension is enabled in the user's `org.gnome.shell
  enabled-extensions` and a per-user copy sits in
  `~/.local/share/gnome-shell/extensions/lighttranslator@lighttranslator.app/`.
  The installed `.deb` also ships a system copy. Both are harmless; the README
  documents how to remove them.
- `cargo tauri dev` needs its own vite; do not leave a stray `npm run dev`
  running, and quit the installed app first or the single-instance plugin will
  forward to it and exit.
- A private sysroot of downloaded -dev packages is in the scratchpad from before
  the real packages were installed; it is no longer used and can be deleted.
