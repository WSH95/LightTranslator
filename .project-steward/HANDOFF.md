---
updated_at: 2026-08-26T02:15:00Z
updated_by: grok
session_status: active
branch: fix/electron-google-429-heal
last_commit: 5821ca8
---
# Handoff

Written for a zero-context successor (another agent, another tool,
another device). Keep every section current at wrap-up.

## Now

**v1.2.0 is shipped.** PR #2 merged into `main` (squash → `cbe1df9`; its tree is
byte-identical to the built commit `fa113e7`) and the release is published at
https://github.com/WSH95/LightTranslator/releases/tag/v1.2.0 with both packages:

- `LightTranslator-1.2.0-amd64-ubuntu22.04-or-newer.deb` — Tauri, 5 MB
- `LightTranslator-1.2.0-amd64-ubuntu20.04-or-older.deb` — Electron, 92 MB

The app now ships two interchangeable backends from one codebase: Tauri for
Ubuntu 22.04+/Debian 12+, Electron for 18.04-20.04 where Tauri 2's
webkit2gtk-4.1 does not exist. The React UI is shared, so the interface is
identical; `PlatformBackend` in `src/lib/platform.ts` enforces surface parity at
typecheck time and VERIFY.md carries an 18-point behavior checklist.

This session also delivered: a full code review (~50 findings) with all broken
behaviors and likely bugs fixed, security hardening, on-demand OCR
dependencies, the Docker build/run path for old hosts, and Project Steward
initialization.

## In flight

- Branch `fix/electron-google-429-heal`: Electron Google 429 self-heal.
  G1 (UTF-8 decode) and G2 (unmask errors) committed; G3 (heal+retry +
  steward docs) in this working tree. No Tauri change (intentional).

## Next steps

1. Finish G3 commit, then G4 verification: `npm run typecheck` &&
   `npm run build`; deterministic local 429-heal mock (then revert URL);
   transport-variant via TCP forwarder to the user's proxy on 17888
   (60s timeout path); long CJK UTF-8; VERIFY rows 16 and 19.
2. If mock/logs show 429 persisting across a fresh connection, do not
   ship the silent-heal claim — the unmasked 429 message still helps, and
   the alternate-endpoint fallback is backlog.
3. After G4: wrap, propose merge. Do not push without approval.

## Blockers

- (none)

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
