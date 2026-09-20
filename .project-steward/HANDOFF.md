---
updated_at: 2026-09-20T01:03:00Z
updated_by: claude
session_status: active
branch: main
last_commit: 1ed2403 chore(release): 1.3.0 — provider refactor is UNCOMMITTED on top of it
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

**Uncommitted on `main`: the generative-AI providers were collapsed into one
OpenAI-format interface.** 16 files changed, net -212 lines. `gemini` +
`openai` + `openrouter` became a single "OpenAI Compatible" provider reachable
at any base URL with five presets (OpenAI, Gemini, OpenRouter, DeepSeek,
Ollama) and keyless local servers supported; DeepL/Google/Microsoft untouched.
`ProviderCategory` is gone and the two Settings tabs merged into one
**Translation** tab. `services/geminiService.ts` was renamed to
`services/translationService.ts` (660 -> 424 lines). Decisions: DECISIONS
0014-0016. Plan of record:
`~/.claude/plans/pasted-content-id-b643-the-generative-curious-quokka.md`.

Two things a successor should not re-derive:

- **No backend code changed.** Both backends are provider-agnostic (one
  `proxy_request` primitive), so the AGENTS.md parity rule did not apply. This
  is now stated in AGENTS.md itself, along with the fact that the React app
  lives at the **repo root**, not under `src/`.
- **The stale-provider guard is in zustand `merge`, not `migrate`.** zustand v5
  only calls `migrate` when the stored blob carries a *numeric* version, and
  pre-upgrade blobs have none — so `migrate` never fires for the users who need
  it. Do not "fix" this back to `migrate`. See DECISIONS 0015.

v1.3.0 itself is still released and pushed; that work is unchanged.

## In flight

The whole provider change is staged in the working tree and **not committed**.
`git status` should show 16 modified files plus the
`services/geminiService.ts -> services/translationService.ts` rename. A commit
message was proposed to the user and not yet run; nothing is pushed.

## Validation completed

See VERIFY.md for the full list and the artifact checksum. In short: typecheck,
production build, Electron syntax, 15 JS/TS unit tests, `cargo check
--all-targets`, `cargo test` (4/4), a release `.deb`, and hands-on checks of
both session types on a real GNOME 46 machine, ending with the user's own
confirmation after installing.

## Next steps

1. Commit the provider work (Conventional Commits, include
   `.project-steward/`). The user was given a `refactor(providers):` message and
   has not yet said to run it. Do not push without explicit approval.
2. Optional coverage gaps, listed in VERIFY.md's "Not covered": DeepL and
   Microsoft were refactored onto the shared `httpJson` helper but never
   exercised against live keys, and neither packaged app was rebuilt (the
   installed v1.3.0 was running on the host, so a Tauri dev instance would have
   forwarded into it).
3. Pre-existing nit, untouched on purpose: `Cpu`, `Image` and `Save` are dead
   imports in `components/SettingsModal.tsx`.
4. Earlier backlog still open: tag/publish v1.3.0 if a release is wanted, and
   verify the Electron Wayland path as an installed package on 20.04.

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
