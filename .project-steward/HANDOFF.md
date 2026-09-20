---
updated_at: 2026-09-20T10:30:00Z
updated_by: claude
session_status: active
branch: main
last_commit: 5025af9 feat(settings): Settings as a full-window view + Appearance
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

**Mid-flight: the Ubuntu 24.04 / Yaru UI refresh**, from
`design_handoff_ubuntu_refresh/` (options 2a + 3a + 3b, approved).
Plan: `~/.claude/plans/pasted-content-id-ab1d-read-design-hand-linear-nova.md`.

Steps 1-4 of 8 are committed and green (typecheck, build, 22 JS/TS tests,
`cargo check`, 5 Rust tests). Steps 5-8 remain: OCR dialog, quick-translate
pop-up, macOS-skin removal, app icons.

Four things a successor should not re-derive:

- **`org.gnome.desktop.interface accent-color` does not exist on this host.**
  The key landed in GNOME 47; Ubuntu 24.04 ships 46. The accent is `gtk-theme`,
  and `/usr/share/themes` carries `Yaru` plus nine `Yaru-<name>` variants that
  map 1:1 onto the ten swatches. `get_system_appearance` returns both keys raw;
  `src/lib/accents.ts` owns the mapping and is unit tested.
- **Reading a gsettings key a schema does not declare aborts the process**, it
  does not return an error. Both `schema_installed()` and `has_key()` guards are
  load-bearing. `interface_schema_reads_are_guarded` in `gnome_shortcut.rs` is
  the canary: a regression takes the test runner down rather than failing.
- **`TranslatorView` must stay mounted while Settings is shown** (it is hidden,
  not unmounted). It owns `platform.onOcrResult`, so unmounting loses tray OCR
  results, and remounting re-fires auto-translate against the surviving store
  text.
- **The old macOS skin is still in the tree on purpose.** `colors.macos`,
  `.toggle-*` and `.traffic-*` stay until step 7, because OcrModal and
  QuickTranslateWindow still use them. Tailwind drops unknown classes silently,
  so step 7 is gated on a grep, not on the compiler.

## In flight

Nothing uncommitted. Four commits on `main`, unpushed:
`cf59398` theme tokens, `4370a2a` main window, `e48e199` backends,
`5025af9` settings. `design_handoff_ubuntu_refresh/` is still untracked —
decide whether it belongs in the repo before wrapping.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. Step 5: `components/OcrModal.tsx` — 480px dialog, segmented mode control.
   The preview area is the capture trigger; selecting a segment must NOT start
   `gnome-screenshot`, since screenshot is the default mode. Keep `max-h-full`
   and the scrolling body: the host window is now 520px, not 680.
2. Step 6: `components/QuickTranslateWindow.tsx` — delete `desiredWidth`
   (width is pinned at 360, so the old `scrollWidth + 48` would grow the window
   every cycle), replace the `HEADER_HEIGHT + LANG_BAR_HEIGHT + PADDING` sum
   with one measured wrapper, and set the menu-open height to 362 — 300 cuts off
   Spanish and Russian.
3. Step 7: remove the macOS skin behind the two grep gates in the plan.
4. Step 8: regenerate `src-tauri/icons/*` from an SVG master via
   `~/.cargo/bin/cargo-tauri icon`, then overwrite 32px (flat) and 64px
   (no inset shadow) from their own SVGs.
5. Not yet run this session: `npm run app:dev` and `npm run electron:dev`.
   The window radius, drag regions, real gsettings read and tray artwork have
   only been checked in a browser.

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
