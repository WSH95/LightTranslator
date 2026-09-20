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
- [x] R8 User acceptance done — Electron build installed and run natively on 20.04; merged and released as v1.2.0

## Dual backend for older distributions (2026-07-28)

- [x] D1 Shared platform contract: `PlatformBackend` derived from the Tauri backend; Electron backend typed against it (typecheck enforces surface parity)
- [x] D2 OCR text reflow moved into shared `utils/textUtils.cleanTextLineBreaks`; both backends return raw tesseract layout
- [x] D3 `electron/` restored from 339f55c and rewritten to mirror `lib.rs`; webSecurity on, CSP applied, preload listeners return unsubscribers
- [x] D4 Net-new Electron behaviors: resize-main-window, OCR install guidance with distro detection, ocr-deps-missing + tray pre-check, settings-changed hub, quick-window-ready handshake, OCR language subset, Wayland warning, transactional shortcut, scheme check + 60s timeout
- [x] D5 electron-builder packaging: Depends xdotool only, OCR under Recommends, Conflicts with the Tauri package, icons shared from `src-tauri/icons`
- [x] D6 Verified natively on this Ubuntu 20.04 host: app launches, global hotkey works, popup renders a live translation
- [x] D7 Ported back to Tauri: clipboard save/restore around Ctrl+C (C12), hide main window during capture
- [x] D8 VERIFY.md backend-parity checklist (18 points)
- [x] D9 "Backend changes land in both backends" rule added to AGENTS.md (approved; DECISIONS 0009)
- [x] D10 Electron build installed and running natively on the user's 20.04 host (verified: installed app.asar is byte-identical to the released artifact)

## Release v1.2.0 published (2026-07-28)

- [x] P1 AGENTS.md parity rule added (DECISIONS 0009); artifact naming aligned so both builds emit `LightTranslator_<version>_amd64.deb`
- [x] P2 Both artifacts rebuilt from HEAD — the Tauri one was stale (predated the clipboard/capture fixes in 94b9866)
- [x] P3 Branch pushed; PR #2 opened against `main` (merge commit or rebase requested, not squash)
- [x] P4 Draft release v1.2.0 created targeting `main`, with both .debs named by Ubuntu range and compatibility instructions; upload verified by checksum round-trip
- [x] P5 PR #2 merged (squash → `cbe1df9`; tree verified identical to the built commit) and release **v1.2.0 published** — tag on `main`, both .debs live

## Electron Google Translate 429 self-heal (2026-08-26)

Google's free GTX endpoint flags Electron's pooled keep-alive/H2 connection
after a few requests; Chromium keeps reusing it, so every later call is HTTP
429 until restart. Plan of record: approved fix
`when-using-the-electron-immutable-rossum.md`. Decision: DECISIONS 0010.

- [x] G1 `fix(electron)`: decode `proxy-request` bodies as UTF-8 across chunk boundaries
- [x] G2 `fix(translate)`: show the real cause when Google Translate fails (VERIFY row 16)
- [x] G3 `fix(electron)`: heal session state and retry once on GET/HEAD 429 or transport failure; POST transport heals without retry; log failures without the URL (`q=` is user text)
- [x] G4 Verification (2026-08-26): `npm run typecheck` and `npm run build` green. Dev Electron + local mock: first GTX GET is HTTP 429 on socket 1 → `[proxy-request]` log (host only, no `q=`) → heal → retry on socket 2 returns 200 → renderer shows 你好. UTF-8: 3200-char CJK body split on 2-byte writes decoded intact. GET 500 and POST 429: one hit, no extra heal. Transport: `net::ERR_UNSAFE_PORT` heals+retries; TCP forwarder to `127.0.0.1:17888` then SIGSTOP logs `net::ERR_TIMED_OUT` + heal. Post-CONT follow-up got a real Google 429 on the *fresh* connection (IP/proxy-exit throttle — DECISIONS 0010 residual; unmasked 429 in the log). Tauri code untouched.
- [x] G5 Version bumped to 1.2.1 in package.json, tauri.conf.json, Cargo.toml + both lockfiles

## Google free-endpoint failover / Release 1.2.2 (2026-08-26)

Live follow-up disproved the IP-only / poisoned-socket diagnosis: GTX GET and
POST remained HTTP 429 across proxy routes while the Chrome Dictionary endpoint
returned HTTP 200 through the same route. This milestone supersedes the 1.2.1
recovery policy with provider-level failover.

- [x] F1 Use POST bodies and structured Chrome Dictionary responses, with one GTX fallback
- [x] F2 Make provider requests non-cacheable in both backends and clear legacy Electron HTTP cache
- [x] F3 Remove Electron's HTTP-429 socket retry and eliminate duplicate frontend translation triggers
- [x] F4 Correct Google availability/error copy and Project Steward diagnosis records
- [x] F5 Verify primary/fallback/both-fail/UTF-8/request-count behavior with mock and live traffic
- [x] F6 Bump all five version locations to 1.2.2
- [x] F7 Build and inspect both local 1.2.2 `.deb` artifacts; do not publish

## Wayland Quick Translate + UI fixes (2026-09-19)

User report on Ubuntu 24.04 / GNOME 46 / Wayland: the hotkey popup works in an
Xorg session but does nothing under Wayland; the OCR dialog overflows the window
unless it is maximized; rounded window corners wanted. Plan of record:
`~/.claude/plans/pasted-content-id-d703-i-have-noble-eclipse.md` (approved
in-session, including the user's choices: X11 keeps the app's own key grab,
Wayland uses a GNOME custom shortcut, popup placement comes from a bundled GNOME
Shell extension that installs itself).

- [x] W1 `fix(ocr)`: OCR dialog stays inside the window (`max-h-full` + scrolling
      body, pinned header/footer) and is restyled onto the `macos` palette — it
      was the only file using Tailwind color names that never existed in
      `tailwind.config.js`, so its card had no background at all
- [x] W2 `feat(ui)`: rounded main-window corners via `--window-radius`, squared
      while maximized through a new `platform.onMaximizedChange` in both backends
- [x] W3 `feat(quick-translate)`: Wayland hotkey — GNOME custom shortcut written
      to our own dconf path, `--quick-translate` delivered through single
      instance, PRIMARY selection capture, hide-before-show so the popup is
      focused; X11 path untouched and its GNOME entry removed automatically
- [x] W4 GNOME Shell extension `lighttranslator@lighttranslator.app`: places the
      popup at the pointer and activates it; shipped by the package and enabled
      once on first run
- [x] W5 Settings: shortcut mechanism status + re-register + extension state;
      README and steward records
- [x] W6 Verification. Both backends on this GNOME 46 host: GNOME entry
      written, extension auto-installed, PRIMARY selection read from a
      Wayland-native app, popup shown with the translation; X11 path
      (forced) grabs the key itself and opens the popup at the pointer.
      The user installed the package, logged back in — extension reports
      ACTIVE — and confirmed the whole thing works
- [x] W7 `fix(ui)`: title-bar language labels centre inside their dropdowns
      (`text-align-last`), and translated output carries `lang` so CJK
      punctuation uses the target language's glyph variant
- [x] W8 Release 1.3.0: version bumped in all five locations, merged to
      `main` and pushed at the user's request

## Ubuntu / Yaru UI refresh (2026-09-20)

Design source: `design_handoff_ubuntu_refresh/` (README + `Ubuntu Redesign.dc.html`),
options 2a + 3a + 3b, approved by the user. Decisions 0018-0020.

- [x] U1 `feat(theme)`: light/dark token block in `index.css`, component classes in
      `@layer components`, `src/lib/theme.ts` as a module singleton, `ACCENTS`
      table, four persisted appearance fields (cf59398)
- [x] U2 `feat(ui)`: main window as two side-by-side panes — header bar, language
      pills in the panes, floating swap button, status caption; window geometry
      760x520 / quick pinned to 360 in both backends (4370a2a)
- [x] U3 `feat(platform)`: `get_system_appearance` in both backends + the
      `gtk-theme` fallback and its unit tests (e48e199)
- [x] U4 `feat(settings)`: Settings as a full-window view with the new Appearance
      tab; TranslatorView stays mounted behind it (5025af9)
- [x] U5 `feat(ui)`: OCR dialog modes + quick pop-up chrome, `open_in_main_window`
      in both backends, macOS skin removed behind two grep gates (ada8631)
- [x] U6 `feat(icons)`: SVG masters under `src-tauri/icons/source/`, full set
      regenerated via `cargo-tauri icon` (60a73b6)
- [x] U7 Native verification of both backends (see VERIFY.md): geometry,
      maximize-squaring, the live gsettings accent read, the quick pop-up
      through the real command path, and open-in-main-window. Two findings
      recorded in RISKS.md
- [ ] U8 Remaining human checks: drag the window by its title (synthetic input
      cannot start a compositor move), the tray icon in the GNOME panel, and
      the behaviour regression pass in a packaged build

## Release 1.5.0 (2026-09-20)

- [x] R1 Version bumped to 1.5.0 in package.json, package-lock.json,
      tauri.conf.json, Cargo.toml and Cargo.lock (05a0656)
- [x] R2 Tauri `.deb` built in the jammy container via `npm run app:docker:build`
      → `LightTranslator_1.5.0_amd64.deb`, 6030312 bytes,
      sha256 `85a195b2c9e514d39d2de452323258fb3dee1d199ed477811c1b2908ac045215`
- [x] R3 Artifact verified: GLIBC floor **2.34** (Ubuntu 22.04 ships 2.35, so it
      starts there); Depends/Recommends unchanged; the desktop entry and the
      GNOME placement extension are present; all three packaged hicolor icons
      are byte-identical to the rebuilt artwork
- [ ] R4 User acceptance test of the installed package
- [ ] R5 Electron `.deb` (`npm run electron:build:deb`) — not built this session
- [ ] R6 Tag and publish, with release notes covering the refresh

## Post-1.5.0 fixes + resize + glass (2026-09-20)

From the user's test of 1.5.0. Decisions 0021.

- [x] V1 `feat(ui)`: pop-up scroll container restored, geometry unpinned
      (300-600 wide, 600 max height), size persisted with a Reset in
      Settings > Pop-up > Window (041dc36)
- [x] V2 `feat(ui)`: `.pane` hover/focus-within highlight restored (041dc36)
- [x] V3 `feat(ui)`: eight edge/corner resize handles; `platform.startResize`
      native on Tauri, manual bounds drag on Electron (041dc36)
- [x] V4 `feat(ui)`: frosted-glass Appearance > Theme with a transparency
      slider; pop-up regains backdrop-filter (041dc36)
- [x] V5 `fix(ui)`: grab band widened to 8px after measuring both engines'
      own hit tests (932e1c1)
- [x] V6 Release 1.6.0 + jammy `.deb`, GLIBC floor 2.34 (ab9cc78)
- [ ] V7 User acceptance test of 1.6.0
- [ ] V8 Human-only checks: drag the pop-up's edges (it blur-closes, so
      automation cannot hold focus on it), and Tauri edge resize (a synthetic
      pointer cannot start a compositor-side grab)

## Quick pop-up: dismiss/drag/resize fix (2026-09-20)

From the user's test of 1.6.0. Decisions 0022.

- [x] W1 Backend becomes the sole owner of hide-on-blur (b41297d)
- [x] W2 Drag/resize suppression flag in both backends; Escape closes (b41297d)
- [x] W3 Pop-up shows an East grip only; handles portalled out of `#root` (b41297d)
- [x] W4 Height always auto-fits; `quickWindowHeight` removed (b41297d)
- [x] W5 Release 1.6.1 + jammy `.deb`, GLIBC floor 2.34 (090bdfc)
- [ ] W6 User acceptance test of 1.6.1 — specifically that the pop-up now
      **moves** and **resizes**, which synthetic input cannot exercise

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
- [ ] Google GTX alternate-endpoint fallback if 429 persists across fresh connections (deferred from 0010; logs will show this if it happens)
- [ ] Spoofed browser UA for Google GTX (deferred from 0010 — speculative, and would make the working Tauri fingerprint less consistent)

## Collapse the LLM providers into one OpenAI-format interface (2026-09-20)

User request: the generative-AI provider template was written long ago and no
longer needs so many groups — keep one interface in the OpenAI API format.
Decisions: DECISIONS 0014 (the merge), 0015 (the stale-provider guard),
0016 (the AGENTS.md edit). Plan of record:
`~/.claude/plans/pasted-content-id-b643-the-generative-curious-quokka.md`.

- [x] C1 `types.ts` / `constants.ts`: `TranslationProviderId` down to
      `openai | deepl | google | microsoft`; `ProviderCategory`, `enabled` and
      `requiresKey` deleted; four `AppSettings` fields removed; `LLM_PRESETS`
      and `PROVIDER_IDS` added
- [x] C2 `services/geminiService.ts` → `services/translationService.ts`:
      Gemini and OpenRouter implementations deleted, one `translateWithLlm`
      kept; shared `httpJson` + `extractApiError` replace the per-provider
      native/fetch duplication; `verifyModelIdentity` collapsed from three
      branches to one; 660 → 424 lines
- [x] C3 Image translation moved to OpenAI `image_url`, with tolerant JSON
      parsing (fence + string-aware balanced-brace scan), a vision-capability
      error that names the model, and an early guard for non-LLM providers
- [x] C4 Options bag trimmed from 13 fields to 9 at all three call sites
      (`TranslatorView`, `QuickTranslateWindow`, `OcrModal`)
- [x] C5 `store/useAppStore.ts`: `merge`-based stale-provider guard (NOT
      `migrate` — see DECISIONS 0015), `version: 1`, four fields dropped from
      `partialize`
- [x] C6 `SettingsModal`: "Generative AI" + "Cloud Translate" tabs merged into
      one **Translation** tab with a flat four-item list; Gemini and OpenRouter
      cards deleted; preset row replaces the hardcoded DeepSeek button
- [x] C7 Truth pass: Gemini dev-key inlining removed from `vite.config.ts` and
      `.env.example`; README provider section and setup steps rewritten
- [x] C8 AGENTS.md guardrailed edit (repo layout + parity-rule limit), approved
      in-session with a diff
- [x] C9 Verification — see VERIFY.md rows 28-31 and the "Last verified" note

## Release 1.4.0 (2026-09-20)

Carries both the unreleased 1.3.0 Wayland work and the provider collapse:
v1.3.0 was merged to `main` but never tagged or published, so the last public
release is v1.2.2.

- [x] V1 Version bumped to 1.4.0 in all five locations (package.json,
      tauri.conf.json, Cargo.toml, package-lock.json x2, Cargo.lock). Note:
      `package-lock.json` has six `"version": "1.3.0"` matches and `Cargo.lock`
      two — only the project's own entries may change; the rest are
      dependencies (es-errors, get-intrinsic, tiny-async-pool, any-promise,
      shlex) that happen to share the number.
- [x] V2 Tag `v1.4.0` on `main` and publish a GitHub release
- [x] V3 Build both `.deb` artifacts and attach them (the 1.2.0 / 1.2.2 pattern).
      Tauri built in the jammy container via podman (DECISIONS 0017) — a native
      24.04 build needs GLIBC_2.39 and would not run on 22.04.
- [x] V4 Release published with both packages, checksums verified by download
      round-trip: https://github.com/WSH95/LightTranslator/releases/tag/v1.4.0
