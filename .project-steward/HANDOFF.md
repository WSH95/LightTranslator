---
updated_at: 2026-09-20T11:00:00Z
updated_by: claude
session_status: active
branch: main
last_commit: 090bdfc chore(release): 1.6.1
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

**v1.6.1 is cut and its `.deb` is built, awaiting the user's test.** It fixes
the quick pop-up regressions 1.6.0 introduced: the pop-up dismissed itself when
clicked, dragged or resized. Rationale: DECISIONS 0022.

Artifact: `src-tauri/target/release/bundle/deb/LightTranslator_1.6.1_amd64.deb`,
sha256 `7a582783e313ed1355b2dd72e219817552e468bbe65ed2fbbaf8accd3ab6b62e`,
GLIBC floor 2.34. Not tagged, not published.

What a successor should not re-derive:

- **A compositor grab looks exactly like a click-away.** On GNOME Wayland
  `startDragging`/`startResizeDragging` make mutter clear the client's keyboard
  focus; tao reports a plain `Focused(false)`. Any hide-on-blur has to be
  suppressed around a grab.
- **The backend is the sole owner of the pop-up's hide-on-blur.** Do not add a
  renderer-side hider back — two independent hiders are what made the
  suppression unhonourable in the first place.
- **WebKitGTK dispatches `pointerdown` but not `pointermove` for mouse**, and
  delivers no motion once the pointer leaves the window. Hand-rolled drag or
  resize is unreliable there; hand grabs to the compositor. Electron is fine
  (Chromium has pointer capture).
- **`start_resize_dragging` is behind Tauri's `unstable` feature** (it lives on
  `Window`, and `WebviewWindow` only re-exposes `start_dragging`). That is why
  resizes go through a flag command plus the JS window API.
- **The pop-up cannot be verified by automation**: it hides on any focus change,
  WebKitGTK throttles its hidden webview so HMR does not reach it, and
  synthetic pointers cannot start a grab. Restart the app; verify by hand.

## In flight

Tree clean. Nineteen commits on `main`, **none pushed**, ending at `090bdfc`.
1.6.1 is built but not tagged and not published.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. **The user is testing 1.6.1.** The specific question automation could not
   answer: does the pop-up now actually **move** when dragged by its header and
   **widen** when dragged by its right edge? The "no longer vanishes" half is
   verified; the "actually moves/resizes" half is not.
2. If it still will not move, the next suspect is the grab serial: tao calls
   `begin_move_drag`/`begin_resize_drag` with `GDK_CURRENT_TIME` across a
   five-hop async dispatch, and mutter silently drops a grab with a stale
   serial. That would need the request to carry the originating event's
   timestamp.
3. Still open from earlier rounds: the WebKitGTK antialiasing item in RISKS.md,
   the Yaru Orange contrast question in QUESTIONS.md, and the Electron `.deb`.
4. Then tag and publish.

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
- The WebKitGTK build dependencies are installed on this host, so Tauri builds
  natively here for development (supersedes DECISIONS 0005). **Never ship a
  natively-built `.deb`**: on 24.04 it requires GLIBC_2.39 and cannot start on
  Ubuntu 22.04. Release packaging goes through `npm run app:docker:build`,
  which now runs on rootless podman via the `podman-docker` shim. DECISIONS 0017.
