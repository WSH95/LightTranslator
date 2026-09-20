---
updated_at: 2026-09-20T11:00:00Z
updated_by: claude
session_status: active
branch: main
last_commit: 7dec432 docs(steward): refresh decisions + the Orange contrast question
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

**The Ubuntu 24.04 / Yaru UI refresh is code-complete.** All eight steps of the
plan landed as six feature commits plus two steward commits, all on `main`,
**unpushed**. Design source: `design_handoff_ubuntu_refresh/` (options 2a + 3a
+ 3b). Rationale: DECISIONS 0018-0020. Task list: PLAN.md "Ubuntu / Yaru UI
refresh".

Green: typecheck, build, `node --check` on both Electron entries, 22 JS/TS unit
tests, `cargo check --all-targets`, `cargo test` (5/5), `cargo build`. The CSS
bundle dropped from 38.5KB to 20.8KB with the macOS skin.

Six things a successor should not re-derive:

- **`org.gnome.desktop.interface accent-color` does not exist on this host.**
  The key landed in GNOME 47; Ubuntu 24.04 ships 46. The accent is `gtk-theme`,
  and `/usr/share/themes` carries `Yaru` plus nine `Yaru-<name>` variants that
  map 1:1 onto the ten swatches. `src/lib/accents.ts` owns the mapping and is
  unit tested. DECISIONS 0019.
- **Reading a gsettings key a schema does not declare aborts the process**, it
  does not return an error. Both `schema_installed()` and `has_key()` guards are
  load-bearing. `interface_schema_reads_are_guarded` in `gnome_shortcut.rs` is
  the canary: a regression takes the test runner down rather than failing.
- **`TranslatorView` stays mounted while Settings is shown** (hidden, not
  unmounted). It owns `platform.onOcrResult`, so unmounting loses tray OCR
  results, and remounting re-fires auto-translate against the surviving store
  text.
- **Tailwind drops unknown classes silently**, so the skin removal was gated on
  a grep, not the compiler. A second gate asserts every `--token` reached
  `dist/assets/*.css`; both are in VERIFY.md and the plan file. `@layer
  components` classes are purged until a component consumes them — that is
  expected, not a bug.
- **Baked-alpha colour tokens are terminal.** `bg-ctrl/50` compiles and renders
  at full alpha, because Tailwind drops the modifier on a colour that already
  carries one. Only `bg` and `accent` are channel triplets. The config says so.
- **The pop-up cannot have an outer drop shadow.** `#root` fills the window, so
  anything drawn outside it never composites. The inset ring is what
  `quickWindowBorderOpacity` maps to. DECISIONS 0020.

## In flight

Nothing uncommitted in tracked files.

`design_handoff_ubuntu_refresh/` is still **untracked** — ~250KB of design
reference including a 69KB canvas runtime. Left for the user to decide: the
decisions and the icon masters reference it, but it is generated vendor HTML.

Eight commits on `main`, none pushed:
`cf59398` theme tokens · `4370a2a` main window · `e48e199` backend appearance ·
`5025af9` settings view · `e1c3d63` steward checkpoint · `ada8631` OCR + pop-up
+ skin removal · `60a73b6` icons · `7dec432` decisions.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. **Run it natively — nothing has been checked in a packaged app.**
   `npm run app:dev`, then `npm run electron:dev`. Look at: the 12px window
   radius and its squaring when maximised; **both drag regions** (Tauri reads
   `data-tauri-drag-region` off the event target itself, so the header title and
   the spacers carry it — dragging by the title is the thing to try); the live
   gsettings read with the Appearance tab's "Follow system accent" on (this host
   reports `color-scheme='default'`, `gtk-theme='Yaru'` → Orange); the pop-up at
   its opacity; and the new tray/launcher artwork.
   **Quit the installed app first**, or the single-instance plugin forwards to
   it (see Warnings).
2. Behaviour regression pass — none of this changed, but none of it has been
   exercised end to end: auto-translate debounce, Ctrl+Enter, paste-image OCR,
   clipboard translate, tray OCR result **while Settings is open**, shortcut
   registration and Re-register, proxy apply, launch-at-startup, settings sync
   between the two windows, and the pop-up's new "open in main window" button.
3. Decide the Yaru Orange contrast question in QUESTIONS.md before release.
4. Decide whether `design_handoff_ubuntu_refresh/` belongs in the repo.
5. Version bump + release only after 1 and 2. Remember: release `.deb`s go
   through `npm run app:docker:build`, never a native build.

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
