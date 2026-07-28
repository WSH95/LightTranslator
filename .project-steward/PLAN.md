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
- [x] S8 `feat(ocr)`: on-demand OCR dependencies — no tesseract/gnome-screenshot in deb Depends (xdotool stays), `get_ocr_install_guidance` with distro detection (apt/dnf/pacman/zypper, brew, winget), dynamic tesseract `-l` from installed langs, check-on-use with in-app guidance popup (copyable command + Re-check), tray path via `ocr-deps-missing` event
- [x] S9 `docs`: add MIT LICENSE, README truth pass (tauri-cli prerequisite, honest platform claims, key-storage description, typecheck, on-demand OCR)
- [x] S10 Wrap: full verification (`typecheck`, `build`, `cargo check`, `npm ci` — all green 2026-07-28), HANDOFF rewritten with manual smoke checklist. Remaining: user decides on merging `fix/2026-07-review-stabilization` into `main`

## Release 1.2.0 (2026-07-28)

- [x] R1 Version bumped to 1.2.0 in package.json, tauri.conf.json, Cargo.toml + both lockfiles
- [x] R2 `.deb` built in an Ubuntu 22.04 (jammy) container → `src-tauri/target/release/bundle/deb/LightTranslator_1.2.0_amd64.deb` (installs on Ubuntu 22.04/24.04, Debian 12+)
- [x] R3 Clean-install smoke in a fresh container: `apt install --no-install-recommends` succeeds, tesseract absent, app launches, main window present
- [x] R4 Deb metadata verified: `Depends: xdotool, libayatana-appindicator3-1, libwebkit2gtk-4.1-0, libgtk-3-0`; OCR packages under `Recommends` (on-demand promise holds)
- [x] R5 Functional verification on the installed deb (Xvfb + openbox): typing translates ("Good morning, my friend." → 早上好，我的朋友。); hotkey → popup → translation ("The weather is beautiful today." → 今天天气真好。)
- [x] R6 **Crash found and fixed**: hotkey killed the app (exit 1, nondeterministic) because window ops ran on the global-shortcut thread; now via `run_on_main_thread` (58db330). 5/5 presses stable after fix
- [x] R7 Test image `lighttranslator-test:1.2.0` + `run-lighttranslator-deb.sh` so the app (installed from the deb) runs on this 20.04 desktop via shared X11
- [ ] R8 **User acceptance test** — interactive desktop session, then merge to `main` (+ optional `v1.2.0` tag)

## Dual backend for older distributions (2026-07-28)

- [x] D1 Shared platform contract: `PlatformBackend` derived from the Tauri backend; Electron backend typed against it (typecheck enforces surface parity)
- [x] D2 OCR text reflow moved into shared `utils/textUtils.cleanTextLineBreaks`; both backends return raw tesseract layout
- [x] D3 `electron/` restored from 339f55c and rewritten to mirror `lib.rs`; webSecurity on, CSP applied, preload listeners return unsubscribers
- [x] D4 Net-new Electron behaviors: resize-main-window, OCR install guidance with distro detection, ocr-deps-missing + tray pre-check, settings-changed hub, quick-window-ready handshake, OCR language subset, Wayland warning, transactional shortcut, scheme check + 60s timeout
- [x] D5 electron-builder packaging: Depends xdotool only, OCR under Recommends, Conflicts with the Tauri package, icons shared from `src-tauri/icons`
- [x] D6 Verified natively on this Ubuntu 20.04 host: app launches, global hotkey works, popup renders a live translation
- [x] D7 Ported back to Tauri: clipboard save/restore around Ctrl+C (C12), hide main window during capture
- [x] D8 VERIFY.md backend-parity checklist (18 points)
- [ ] D9 Add the "backend changes land in both backends" rule to AGENTS.md — **needs user approval** (guardrailed file)
- [ ] D10 Run the full parity checklist against both builds interactively (user acceptance)

## Later (backlog from the 2026-07 review — deliberately deferred)

- [ ] Wayland selection capture (xdotool/gnome-screenshot are X11-only; C7)
- [ ] Single-instance plugin (autostart + manual launch = duplicate processes; C4)
- [ ] Temp-file TOCTOU/leak in screenshot/OCR path — create PNG via tempfile Builder suffix, cleanup on all paths (C13)
- [ ] Move blocking `Command::output()`/sleeps off async runtime + hotkey thread (`tokio::process`/`spawn_blocking`) (C18)
- [ ] Quick-window focus/blur race — replace 50/100ms sleeps with a readiness handshake (C14)
- [ ] Gemini API key via `x-goog-api-key` header instead of URL query
- [ ] Quick window: copy-result button + Esc-to-close (regressed in cef32ff)
- [ ] Secure API-key storage (OS keyring / stronghold) instead of plaintext localStorage
- [ ] Cross-platform screenshot capture (macOS `screencapture`, Windows) to back the README's platform claims
- [ ] Test-suite bootstrap (vitest + cargo test) — then replace `Test: TODO` in AGENTS.md commands block
- [ ] `proxy_request` SSRF surface: revisit once CSP has soaked (scheme check landed in S1; full allowlist conflicts with custom `openaiBaseUrl`/local LLMs)
