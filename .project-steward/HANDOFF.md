---
updated_at: 2026-09-20T01:45:00Z
updated_by: claude
session_status: active
branch: main
last_commit: 4af6f79 refactor(providers): … (tagged v1.4.0, released)
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

**v1.4.0 is released**: https://github.com/WSH95/LightTranslator/releases/tag/v1.4.0
Both `.deb` packages attached, checksums verified by download round-trip. This
release carries two things — the provider collapse, and the Wayland work that
was merged as 1.3.0 but never published (so 1.3.0 has a tag on nothing; the
previous public release was 1.2.2).

The generative-AI providers are now one **OpenAI Compatible** entry reachable at
any `/chat/completions` base URL, with five presets and keyless local servers
supported. DeepL/Google/Microsoft unchanged. Decisions: DECISIONS 0014-0017.

Three things a successor should not re-derive:

- **Release `.deb`s must be built in the jammy container, never natively.** A
  native build on this 24.04 host hard-requires GLIBC_2.39 (Rust std picks up
  `pidfd_spawnp`/`pidfd_getpid` from the build host) and will not start on
  Ubuntu 22.04, which ships 2.35 — under an asset name that promises 22.04.
  Docker is no longer needed for this: `podman` + `podman-docker` give a
  rootless `docker` shim and `scripts/docker-build-deb.sh` runs through it
  unchanged (~5.5 min cold). See DECISIONS 0017.
- **No backend code changed in the provider work.** Both backends are
  provider-agnostic (one `proxy_request` primitive), so the AGENTS.md parity
  rule did not apply. AGENTS.md now says so, and also records that the React app
  lives at the **repo root**, not under `src/`.
- **The stale-provider guard is in zustand `merge`, not `migrate`.** zustand v5
  only calls `migrate` when the stored blob carries a *numeric* version, and
  pre-upgrade blobs have none. Do not "fix" it back. See DECISIONS 0015.

## In flight

Nothing. Working tree clean apart from the steward records for this release,
`main` pushed, `v1.4.0` tagged and published.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. Watch for upgrade reports. The release is **breaking for Gemini/OpenRouter
   users**: their keys are not migrated and those installs land on Google
   Translate until they reconfigure via Settings → Translation → OpenAI
   Compatible. The release notes lead with this.
2. Coverage gaps from VERIFY.md's "Not covered": DeepL and Microsoft were
   refactored onto the shared `httpJson` helper but never exercised against live
   keys.
3. The Electron backend's Wayland path is still only verified in dev, never as
   an installed package on a 20.04 Wayland session.
4. Pre-existing nit: `Cpu`, `Image` and `Save` are dead imports in
   `components/SettingsModal.tsx`.

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
