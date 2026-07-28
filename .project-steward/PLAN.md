# Plan

Milestones and tasks. If an external task backend is adopted, this file
holds milestones + a pointer only (never a duplicate task list).

## Stabilization: land the 2026-07 code-review fixes (broken features, races, leaks, hardening, docs)

Source: full findings + per-fix designs in the 2026-07-28 review (see
DECISIONS 0002; plan of record approved by the user in-session).

- [x] S1 `fix(tauri)`: backend correctness in `src-tauri/src/lib.rs` — transactional `update_shortcut` (validate→register→unregister, single lock), `quick_window_ready` pending-trigger (no clipboard read/translate at launch), HiDPI `PhysicalPosition` + monitor clamp, `proxy_request` (60s/15s timeouts, proxy auth, http/https scheme check, body-decode errors, dead branch), reqwest `socks` feature, tray Quit → `app.exit(0)`, mutex `map_err`, `setup_tray` without `.expect`, Wayland one-time warning
- [x] S2 `fix(frontend)`: `src/lib/platform.ts` — `makeDisposableListener` (StrictMode-safe unlisten) for all 5 `on*`; `onQuickTranslate` `onRegistered` hook; `emitSettingsChanged`/`onSettingsChanged` via `emitTo`
- [x] S3 `fix(settings)`: cross-window sync + startup restore — debounced settings broadcast from store actions, rehydrate-on-event in both windows, main-window-only post-hydration push of persisted shortcut + proxy to Rust, gate auto-launch sync out of quick window
- [x] S4 `fix(quick-translate)`: listener-before-ready ordering, wire `quickSourceLang` (currently hardcoded `'auto'`), pass `systemPromptEnabled`, request-sequence race guard, side effects out of `setLangDropdownOpen` updater
- [x] S5 `fix(translate)`: `performTranslationRef` + narrowed effect deps (no spurious API calls on settings edits), OcrModal passes all provider keys + `systemPromptEnabled`, DeepL `ZH-HANT`/`ZH-HANS` + form body, Google/paste error messages preserve the real cause
- [x] S6 `fix(security)`: single tray icon (drop config `trayIcon` block), minimal capabilities, remove unused shell/http/process plugins, drop `devtools` feature from release, Cargo version → 1.1.2, tightened CSP + `devCsp`
- [x] S7 `chore`: regenerate stale package-lock.json (Electron remnants; `npm ci` currently broken), delete dead files (`ControlPanel.tsx`, `metadata.json`, orphan assets, `@google/genai`), Electron leftovers in configs, dev-only `GEMINI_API_KEY` inlining, truthful `.env.example`, blocking `check-secrets.js`, frontend nits (B12/B14/B19/B20, model fallback mismatch, UI polish)
- [ ] S8 `feat(ocr)`: on-demand OCR dependencies — no tesseract/gnome-screenshot in deb Depends (xdotool stays), `get_ocr_install_guidance` with distro detection (apt/dnf/pacman/zypper, brew, winget), dynamic tesseract `-l` from installed langs, check-on-use with in-app guidance popup (copyable command + Re-check), tray path via `ocr-deps-missing` event
- [ ] S9 `docs`: add MIT LICENSE, README truth pass (tauri-cli prerequisite, honest platform claims, key-storage description, typecheck, on-demand OCR)
- [ ] S10 Wrap: full verification (`typecheck`, `build`, `cargo check`, `npm ci`), HANDOFF rewrite with manual smoke checklist, offer merge of `fix/2026-07-review-stabilization` into `main`

## Later (backlog from the 2026-07 review — deliberately deferred)

- [ ] Wayland selection capture (xdotool/gnome-screenshot are X11-only; C7)
- [ ] Single-instance plugin (autostart + manual launch = duplicate processes; C4)
- [ ] Clipboard save/restore around simulated Ctrl+C; detect nothing-selected instead of translating stale clipboard (C12)
- [ ] Temp-file TOCTOU/leak in screenshot/OCR path — create PNG via tempfile Builder suffix, cleanup on all paths (C13)
- [ ] Move blocking `Command::output()`/sleeps off async runtime + hotkey thread (`tokio::process`/`spawn_blocking`) (C18)
- [ ] Quick-window focus/blur race — replace 50/100ms sleeps with a readiness handshake (C14)
- [ ] Gemini API key via `x-goog-api-key` header instead of URL query
- [ ] Quick window: copy-result button + Esc-to-close (regressed in cef32ff)
- [ ] Secure API-key storage (OS keyring / stronghold) instead of plaintext localStorage
- [ ] Cross-platform screenshot capture (macOS `screencapture`, Windows) to back the README's platform claims
- [ ] Test-suite bootstrap (vitest + cargo test) — then replace `Test: TODO` in AGENTS.md commands block
- [ ] `proxy_request` SSRF surface: revisit once CSP has soaked (scheme check landed in S1; full allowlist conflicts with custom `openaiBaseUrl`/local LLMs)
