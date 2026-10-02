---
updated_at: 2026-10-02T08:25:37Z
updated_by: codex
session_status: active
branch: codex/fix-source-punctuation
last_commit: "ebaffc0 docs(steward): record 1.6.2 publication"
---
# Handoff

## Now

The approved source-punctuation fix is complete on
`codex/fix-source-punctuation` in `/home/wsh/Documents/LightTranslator`.
It extends the translated output's language-tag approach to the main source
textarea. Explicit source languages take precedence. Auto Detect uses kana,
then Hangul, then Han as a display hint; ambiguous Han defaults to Simplified
Chinese. This changes glyph selection without changing source text, selected
translation language, settings or provider requests. Decision 0025 records
the accepted fallback.

The branch starts from `ebaffc0`; code and project records belong in one local
`fix(ui)` commit. No push, merge, version bump, package build or publication is
part of this request. The previously accepted and published release remains
v1.6.2; its package paths, checksums and acceptance history remain in VERIFY.md.

## Verification

- `npm run typecheck`, `npm run build`, the five-file Node suite and the strict
  UI static audit pass. Independent source review found no blocking issues.
- WebKitGTK 2.52.6 and Electron 39.8.10 / Chromium 142 each pass 14 language
  cases. Before/after screenshots show the centered source period corrected
  to match the translation at all three text sizes.
- Programmatic insertion, synthetic paste, Clear, caret/focus preservation and
  textarea identity pass. Native engine composition tests pass through
  Chromium's input pipeline and WebKit's input-method context.
- The synthetic provider receives one translation request using the original
  text and Auto Detect; display-only updates do not start another request.
- See VERIFY.md for commands, fixture details and evidence limits. Installed
  package testing and physical OS IME candidate-window operation were not
  exercised in this change.

## Next steps

1. Review the local `codex/fix-source-punctuation` branch for integration.
2. Build/install or publish packages only when requested. For any future Tauri
   release package, use the jammy container rather than the Ubuntu 24.04 host.

## Local fixtures and warnings

- The unused managed worktree `source-punctuation` was read-only in the
  sandbox and was archived empty. The fix uses the original checkout.
- The ignored `.project-steward/tmp/source-punctuation/` directory contains
  the isolated renderer fixture, both native runners, before/after JSON and
  screenshots. The fixture makes no external translation requests.
- Electron probes use a temporary profile at
  `/tmp/lighttranslator-source-qa-electron` and software rendering because
  the host GPU process crashed. WebKit uses an ephemeral context.
- The app's settings, shortcuts and system clipboard were not changed.
- The task-owned Vite server on port 5178 is stopped after validation.
- The build still prints the pre-existing Browserslist data-age warning.
- The previous handoff still marked the September session active, but the
  checkout was clean and its release history accounted for the latest commit.
- AGENTS.md and CLAUDE.md were not edited. Code and records are English.
