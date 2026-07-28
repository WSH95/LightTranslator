---
updated_at: 2026-07-28T12:37:09Z
updated_by: claude-code (review + stabilization session)
session_status: closed
branch: fix/2026-07-review-stabilization
last_commit: 7ad0c66
---

# Handoff

Written for a zero-context successor (another agent, another tool,
another device). Keep every section current at wrap-up.

## Now

The 2026-07 full code review is done and the entire Stabilization
milestone (PLAN S1–S9) is implemented and committed: 10 commits on
`fix/2026-07-review-stabilization` (branched from `main` @ cef32ff).
All automated checks pass. The branch is NOT merged — that is the user's
call (DECISIONS 0004). Nothing has been pushed.

## In flight

- (none — all planned commits landed; working tree is clean)

## Next steps

1. **User decision**: merge `fix/2026-07-review-stabilization` into
   `main` (fast-forward works) — or review the commits first
   (`git log main..fix/2026-07-review-stabilization`).
2. Run the **manual smoke checklist** below on a real X11 session — the
   app was never launched interactively this session (this machine
   cannot run it, see Warnings).
3. Pick up backlog items from PLAN.md "Later" as wanted (Wayland support
   and single-instance guard give the most user value).

## Manual smoke checklist (needs a machine that can run the app)

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
- Built .deb (`npm run app:build`): `dpkg-deb -I` shows Depends: xdotool
  only, tesseract/gnome-screenshot under Recommends
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
