# Verification

How to check the project is healthy. Agents run these before claiming
"validated" in HANDOFF.md.

| Check | Command | Expected |
| --- | --- | --- |
| Build | `npm run build` | exits 0 |
| Tests | `TODO` | all pass |
| Lint | `npm run typecheck` | clean (also proves backend surface parity) |
| Rust | `cargo check` (in `src-tauri/`) | clean |
| Electron | `npm run electron:build:deb` | produces `dist-electron/*.deb` |
| Lockfile | `npm ci` | resolves without lock/manifest mismatch |

Last verified: 2026-07-28T16:10Z — build ok, typecheck ok, `npm ci` ok,
`cargo check` ok (in the `lt-rust-check` container — host Ubuntu 20.04 cannot
compile Tauri 2; see HANDOFF Warnings), Electron `.deb` built and run natively
on 20.04, doctor 25/25 ok. No automated test suite yet.

## Backend parity checklist

The app ships two backends — Tauri (`src-tauri/src/lib.rs`, Ubuntu 22.04+) and
Electron (`electron/main.js`, Ubuntu 18.04-20.04). The React UI is shared, so
the interface cannot drift; **behavior can**. Run this list against BOTH builds
before a release, and after any backend change.

Surface parity is already machine-checked: `PlatformBackend` in
`src/lib/platform.ts` is derived from the Tauri backend, so a missing or
mistyped Electron method fails `npm run typecheck`.

| # | Behavior | Expected in both builds |
| --- | --- | --- |
| 1 | Launch | No translation fires on startup; nothing reads the clipboard until the hotkey |
| 2 | Hotkey with text selected | Popup appears at the cursor, clamped to that monitor, showing the translation |
| 3 | Hotkey with nothing selected | Previous clipboard content is restored, not silently translated as if fresh |
| 4 | Hotkey within ~1s of launch | Text still arrives (pending-text handshake) |
| 5 | Repeated hotkey presses (5×) | App stays alive; one popup, one translation each |
| 6 | Quick-window language | Uses `quickSourceLang`/`quickTargetLang`, independent of the main panel |
| 7 | Settings sync | Changing a language in the popup shows in main Settings, and vice versa |
| 8 | Shortcut change | Invalid accelerator → error, old shortcut still works; valid → takes effect |
| 9 | Restart | Custom shortcut and proxy settings are restored |
| 10 | Tray | Exactly one icon; Show / Settings / OCR Screenshot / Quit all work; Quit exits cleanly |
| 11 | OCR with tesseract absent | Guidance popup with the correct distro command; Re-check proceeds after install |
| 12 | OCR with some language packs | Runs with the installed subset instead of failing |
| 13 | OCR result | Paragraphs preserved (shared `cleanTextLineBreaks`), not flattened to one line |
| 14 | Screen capture | Main window hides during area selection, reappears after |
| 15 | Proxy with auth | Requests succeed through an authenticated proxy |
| 16 | Provider errors | Real cause shown (not a generic/CORS message) |
| 17 | Editing settings | Typing an API key does not fire translations |
| 18 | Package metadata | `Depends: xdotool` only; OCR packages under `Recommends` |
