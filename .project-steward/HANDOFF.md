---
updated_at: 2026-07-28T16:55:00Z
updated_by: claude-code (PR #2 open, v1.2.0 draft release ready)
session_status: active
branch: fix/2026-07-review-stabilization
last_commit: 9663bd8
---

# Handoff

Written for a zero-context successor (another agent, another tool,
another device). Keep every section current at wrap-up.

## Now

Two backends now ship from one codebase (DECISIONS 0007):

- **Tauri** (`src-tauri/`) for Ubuntu 22.04+/Debian 12+ — ~5 MB, ~60 MB RAM.
  Artifact: `src-tauri/target/release/bundle/deb/LightTranslator_1.2.0_amd64.deb`
- **Electron** (`electron/`) for Ubuntu 18.04-20.04, where Tauri 2 cannot run —
  ~92 MB, ~200 MB RAM. Artifact: `dist-electron/lighttranslator_1.2.0_amd64.deb`

The React UI is shared verbatim, so the interface is identical; only the ~13
backend commands exist twice. `PlatformBackend` (src/lib/platform.ts) is derived
from the Tauri backend, so `npm run typecheck` fails if the Electron backend is
missing anything. Behavior parity is checked by the 18-point list in VERIFY.md.

Verified natively on this 20.04 host: the packaged Electron build launches, both
windows appear with the right titles/sizes, the global hotkey works, and the
popup renders a live translation ("Electron 在 Ubuntu 20.04 上原生运行。").

## In flight

- **PR #2** — https://github.com/WSH95/LightTranslator/pull/2 — 25 commits,
  base `main`. Waiting for the user to merge (merge commit or rebase, NOT
  squash, so the release tag lands on a commit in `main`'s history).
- **Draft release v1.2.0** targeting `main`, both .debs attached:
  `LightTranslator-1.2.0-amd64-ubuntu22.04-or-newer.deb` (Tauri, 5 MB) and
  `LightTranslator-1.2.0-amd64-ubuntu20.04-or-older.deb` (Electron, 92 MB).
  Publish after the merge: `gh release edit v1.2.0 --draft=false`.
- The user has the Electron build installed at /opt/LightTranslator and
  running; it is byte-identical to the released artifact.

## Next steps

1. User merges PR #2 into `main`.
2. Publish the draft release: `gh release edit v1.2.0 --draft=false`.
3. Optionally walk the VERIFY.md parity checklist against both builds.
4. Then the "Later" backlog (Wayland, single-instance, secure key storage).

## Blockers

- (none — waiting on user acceptance only)

## Manual checklist for the user acceptance test

- Fresh launch fires NO translation of the clipboard (was: every launch)
- Hotkey with selected text → popup at cursor, correct on HiDPI, uses
  the quick-window language pair (quickSourceLang was previously ignored)
- Hotkey within ~1s of launch still delivers (pending-text path)
- Settings → shortcut: invalid accelerator shows inline error and the old
  shortcut keeps working; valid one takes over; after app restart the
  custom shortcut and proxy settings are restored
- Change quick target language in popup → visible in main Settings;
  change an API key in main → popup uses it (cross-window sync)
- Exactly ONE tray icon; tray Quit exits cleanly
- Devtools console: no "not allowed" permission errors, no CSP
  violations while using titlebar buttons, drag, resize, tray, OCR modal
- OCR with tesseract missing → guidance popup with correct distro
  command; Copy works; install + Re-check proceeds into capture; with
  only some language packs, OCR runs with the installed subset
- (verified automatically already: deb metadata, clean install, launch,
  typed translation, hotkey translation)
- DeepL with target zh-TW returns Traditional Chinese
- Dev run (StrictMode): one translation per hotkey press, not two

## Blockers

- (none)

## Key files

- `.project-steward/PLAN.md` — S1–S9 done, S10 = merge decision; "Later"
  backlog carries the deferred review findings (IDs like C12 refer to the
  review's finding list, summarized in each commit message)
- `src-tauri/src/lib.rs` — all backend logic (single file)
- `src/lib/platform.ts` — frontend↔Tauri bridge incl. the
  `makeDisposableListener` pattern and settings-changed sync channel
- `store/useAppStore.ts` — Zustand store; settings actions broadcast to
  the other window (debounced 250ms)
- `hooks/useOcrDependencies.ts` + `components/OcrModal.tsx` — on-demand
  OCR dependency check + install-guidance popup
- `src-tauri/capabilities/default.json` — minimal permission set; if a
  webview action logs "not allowed", re-add ONLY the named permission

## Tried and rejected

- `deb.recommends` was uncertain — verified: tauri.conf schema accepts it
  (cargo check passes), so OCR packages are Recommends, not Depends.
- reqwest `socks` feature: turned out to be a no-op compat marker in the
  locked reqwest 0.12.28 (SOCKS is built in); the real fix for
  authenticated SOCKS was credentials-in-proxy-URL in `proxy_request`.
- Full provider allowlist for `proxy_request` rejected: it would break
  the custom `openaiBaseUrl` feature (incl. localhost LLM servers).
  Landed scheme check + strict CSP instead (RISKS.md).

## Warnings

- **This machine (Ubuntu 20.04) cannot compile or run the TAURI build** (the Electron build runs natively here) (no
  webkit2gtk-4.1, no Rust toolchain). Rust verification runs in the
  Docker container `lt-rust-check` (stopped after the session):
  `docker start lt-rust-check && docker exec -w /work/src-tauri lt-rust-check cargo check`
  The container mounts the repo at /work and keeps a warm cargo cache;
  after a cargo command that rewrites Cargo.lock, chown it back
  (`docker exec lt-rust-check chown 1000:1000 /work/src-tauri/Cargo.lock`).
- Behavior change shipped on purpose (commit "fix(translate)"):
  editing provider/API-key/model/prompt no longer auto-retranslates the
  current input; language changes still do.
- `npm run build` now FAILS if `scripts/check-secrets.js` finds
  key-shaped strings (it used to only warn). False positives: extend its
  skip lists rather than re-adding `|| true`.
- API keys still live unencrypted in localStorage (RISKS.md, backlog).
- Electron's binary download from GitHub is blocked on this network. Use
  `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/` and
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/`
  (documented in the README).
- Launching the app from a Bash tool call that then returns kills it by SIGHUP;
  run the app and its test in ONE script (see the session scratchpad scripts).
