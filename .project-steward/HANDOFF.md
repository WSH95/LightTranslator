---
updated_at: 2026-07-28T13:42:00Z
updated_by: claude-code (release 1.2.0 built + smoke-tested)
session_status: active
branch: fix/2026-07-review-stabilization
last_commit: 58db330
---

# Handoff

Written for a zero-context successor (another agent, another tool,
another device). Keep every section current at wrap-up.

## Now

Release 1.2.0 is built, installed from the .deb in a clean container, and
functionally verified. 14 commits on `fix/2026-07-review-stabilization`.
Smoke testing found and fixed a real crash (see R6/DECISIONS 0006): the
quick-translate hotkey killed the app because window operations ran on
the global-shortcut thread instead of the main thread.

Artifact: `src-tauri/target/release/bundle/deb/LightTranslator_1.2.0_amd64.deb`
(gitignored; installs on Ubuntu 22.04/24.04 and Debian 12+).

Verified on the installed deb: clean `--no-install-recommends` install
with no OCR packages, app launches, typing translates
("Good morning, my friend." -> 早上好，我的朋友。), hotkey -> popup ->
translation ("The weather is beautiful today." -> 今天天气真好。),
5/5 hotkey presses stable after the fix.

## In flight

- Awaiting the USER's interactive acceptance test (PLAN R8) before merge.

## Next steps

1. User runs the app on their desktop (the app cannot run natively on
   this 20.04 host; it runs from the deb inside a container sharing X11):
   `bash <session-scratchpad>/run-lighttranslator-deb.sh` (also accepts
   `stop` and `logs`; runs the container detached — `docker run -it` fails
   with "the input device is not a TTY" when launched from the agent shell).
   Image `lighttranslator-test:1.2.0`; settings persist in docker volume
   `lt-testdata`. The app is RUNNING on the user's desktop right now. If the scratchpad is gone, recreate: install the deb in
   an ubuntu:22.04 container (plus ca-certificates), `docker commit`, then
   `xhost +SI:localuser:root` and run with `-e DISPLAY -v /tmp/.X11-unix`.
2. On user OK: `git checkout main && git merge fix/2026-07-review-stabilization`
   (fast-forward), optional tag `v1.2.0`. No pushes without approval.
3. Then the "Later" backlog (Wayland, single-instance, secure key storage).

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

- **This machine (Ubuntu 20.04) cannot compile Tauri 2** (no
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
