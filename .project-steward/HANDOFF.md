---
updated_at: 2026-09-20T11:00:00Z
updated_by: claude
session_status: active
branch: main
last_commit: ab9cc78 chore(release): 1.6.0
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

**v1.6.0 is cut and its `.deb` is built, awaiting the user's test.** It answers
the three things that came back from their 1.5.0 test: the quick pop-up's
missing scroll container and unresizable window, the translator panes' missing
hover/focus feedback, and a request for a frosted-glass theme. Rationale:
DECISIONS 0021. Tasks: PLAN.md "Post-1.5.0 fixes + resize + glass".

Artifact: `src-tauri/target/release/bundle/deb/LightTranslator_1.6.0_amd64.deb`,
sha256 `3593bcdf21c197d0f323aaeed082b0bd08113c3ccc55b1df611dc09fade1c440`,
GLIBC floor 2.34. Not tagged, not published.

What a successor should not re-derive, on top of the 1.5.0 list:

- **Two of the three reports were regressions the refresh caused**, checked
  against `7dc5f6b` rather than assumed. Edge resize, by contrast, never
  existed in this app — it is a new feature, not a fix.
- **Frameless windows get no resize border**, and both engines claim the
  outermost pixels for their own hit test (~6px Chromium, ~5px tao). The app
  draws 8px handles behind that. Do not shrink them without re-measuring.
- **Tauri and Electron resize differently on purpose.** Wayland forbids a
  client moving its own window, so only a compositor-side grab can work there;
  Electron has no such API and drags bounds by hand, which is fine because it
  targets X11 sessions.
- **The pop-up cannot be driven by UI automation** — it blur-closes, so any
  focus change hides it. Its resize needs a human.
- **`surfaceStyle` is the glass field**, not `theme`; `appearanceTheme` already
  means light/dark. The Settings group is titled "Theme".

## In flight

Tree clean. Sixteen commits on `main`, **none pushed**, ending at `ab9cc78`.
1.6.0 is built but not tagged and not published.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. **The user is testing the installed 1.6.0 package.** Wait for their report.
2. Two checks only a human can do: drag the **pop-up's** edges (it blur-closes,
   so automation cannot hold focus), and Tauri edge resize on the main window
   (a synthetic pointer cannot start a compositor-side grab; the handler itself
   was confirmed to fire). Also worth a glance: the tray icon in the panel.
3. Decide the WebKitGTK antialiasing item in RISKS.md. Glass mode incidentally
   removes the inconsistency, which may change the answer.
4. Decide the Yaru Orange contrast question in QUESTIONS.md before publishing.
5. Electron `.deb` still not built this session (`npm run electron:build:deb`).
6. Then tag and publish.

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
