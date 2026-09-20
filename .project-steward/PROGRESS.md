# Progress log

Newest first. One short entry per semantic checkpoint — not per edit.

### 2026-09-20T12:10:00Z — claude
[auto-checkpoint] Cut 1.5.0 (05a0656) and built the release .deb in the jammy container. GLIBC floor 2.34 so it starts on Ubuntu 22.04; packaged icons byte-identical to the rebuilt artwork. Had to reclaim a container-owned Cargo.lock via `podman unshare chown` first. Awaiting the user's acceptance test; not tagged, not published.

### 2026-09-20T11:45:00Z — claude
Native verification of the refresh on both backends. Tauri under GDK_BACKEND=x11
(a native Wayland surface is not capturable and GNOME's screenshot D-Bus is
locked down), Electron with --no-sandbox (this host's chrome-sandbox is not
setuid). Confirmed: 760x520 -> 760x600 on Settings, maximize squares the 12px
corners, `get_system_appearance` repaints the UI in Yaru Orange in BOTH
backends, the pop-up opens at the pinned 360 width through the real command
path and translates, and open-in-main-window transfers the text. Diagnosed a
WebKitGTK-only antialiasing artifact (text outside a card reads heavier) as a
transparent-window subpixel-AA fallback, not a CSS bug; recorded in RISKS.md
with the evidence. Design handoff folder is now tracked.

### 2026-09-20T11:00:00Z — claude
Ubuntu/Yaru UI refresh code-complete (cf59398..7dec432): theme tokens and four
appearance settings, two-pane main window, `get_system_appearance` in both
backends, Settings as a full-window view with the Appearance tab, OCR dialog and
quick pop-up restyled, macOS skin removed, app icons rebuilt from SVG masters.
All automated checks green; the CSS bundle halved. Three bugs found and fixed on
the way: a stale-closure commit in the language popover, a pop-up resize loop
from a width that was still content-derived, and a dev server that died with
ENOSPC watching `src-tauri/target`. Nothing has been run in a packaged app yet.

### 2026-09-20T10:30:00Z — claude
[auto-checkpoint] Ubuntu/Yaru refresh steps 1-4 of 8 landed (cf59398, 4370a2a, e48e199, 5025af9): theme tokens + appearance state, two-pane main window, get_system_appearance in both backends, Settings as a full-window view with the new Appearance tab. OCR dialog, pop-up, macOS-skin removal and icons still to do.

### 2026-09-20T00:30:00Z — claude
Wayland Quick Translate shipped: user installed the package, logged back in, the
placement extension reports ACTIVE and the whole flow works on their machine.
Two UI fixes followed from their review (centred language labels, correct CJK
full stop). Version bumped to 1.3.0 and merged to main at their request.

### 2026-09-19T23:35:00Z — claude
[auto-checkpoint] Rust backend compiles and its unit tests pass; Tauri app verified on Wayland (GNOME entry, 0.18s trigger, PRIMARY read, translation request); release .deb build running; dev shortcut entry cleaned up.

### 2026-09-19T23:20:00Z — claude
Quick Translate now works under Wayland. Both backends: GNOME custom shortcut
(X11 keeps its own grab and removes the entry), `--quick-translate` delivered
through single instance, PRIMARY selection instead of synthetic Ctrl+C,
hide-before-show so the popup takes focus, plus a bundled GNOME Shell extension
that places it at the pointer and installs itself. Proven end to end in the
Electron build on this GNOME 46 Wayland session: text selected in a
Wayland-native app came back translated in the popup. Tauri compile still
blocked on the WebKitGTK dev packages.

### 2026-09-19T22:46:36Z — claude
Diagnosed all three user-reported issues (Wayland hotkey dead, OCR dialog
overflowing, square corners) and landed the two UI fixes: the OCR dialog now
stays inside the window and uses the real palette, and the main window has 12px
corners that square off when maximized. Verified on screen in the Electron build
at 480x680, at the 400x500 minimum and maximized. Wayland hotkey work is next.

### 2026-08-26T06:57:19Z — cli
PR #4 opened from commit 8daafd0 with a concise humanized description; branch pushed. Release publication and local main fast-forward are gated on the user's manual merge.

### 2026-08-26T04:41:42Z — cli
[auto-checkpoint] Final v1.2.2 packages rebuilt after closing stale-debounce/image-paste races; Electron and Docker/Tauri builds pass, manifests are 1.2.2 amd64, and final artifact hashes were refreshed in HANDOFF.md.

### 2026-08-26T04:34:22Z — cli
[auto-checkpoint] Completed v1.2.2 Google free-endpoint failover: deterministic probes, 10-translation isolated Electron soak, clean install/typecheck/build, and inspected Electron/Tauri Debian packages pass; handoff refreshed, no commit or publication.

### 2026-08-26T04:06:17Z — cli
Implemented v1.2.2 Google provider fix: Chrome-dictionary POST primary plus one GTX POST fallback, no-store backends/cache cleanup, HTTP-429 de-heal, truthful errors, and duplicate-trigger suppression. Typecheck, Electron syntax, and five pure endpoint probes pass.

### 2026-08-26T04:00:39Z — cli
Starting v1.2.2 Google free-endpoint failover: corrected diagnosis after live GTX 429 and clients5 200 on the same proxy route; no-key failover and local package builds approved.

### 2026-08-26T02:30:00Z — grok
Version bumped to 1.2.1 (package.json, tauri.conf.json, Cargo.toml, both lockfiles). Pushing `fix/electron-google-429-heal` and opening a PR (user-approved).

### 2026-08-26T02:25:25Z — grok
G4 on `fix/electron-google-429-heal`: typecheck+build green; Electron mock 429-heal (socket 1 → 429 → heal → socket 2 → 200 → UI 你好); UTF-8 CJK 2-byte splits; GET 500 / POST 429 no extra heal; SIGSTOP forwarder → TIMED_OUT + heal. Post-CONT Google 429 on a fresh connection (IP-level residual, unmasked in logs).

### 2026-08-26T02:15:00Z — grok
Implemented Electron Google 429 self-heal on `fix/electron-google-429-heal`: UTF-8 chunk decode, unmasked Google errors, session heal+single GET retry. Steward: DECISIONS 0010, VERIFY rows 16/19, PLAN G1–G3. Verification (G4) next.

### 2026-08-26T02:10:47Z — cli
Starting implementation of approved Electron Google 429 heal plan on branch fix/electron-google-429-heal

### 2026-08-26T02:05:06Z — cli
Diagnosed Electron 'Google Network Error': Google 429-flags the pooled connection (per-connection, not per-IP; fresh instance works while old fails). Plan approved: unmask errors, failure logging, session heal+retry, UTF-8 chunk fix. Delegating implementation to Grok Build.

### 2026-07-28T12:10:31Z — project-steward init
Project initialized as a Project Steward managed project.


## 2026-07-28 — Full review + Stabilization sweep (session 1)

- Reviewed the whole project (3 parallel audits + design verification):
  ~50 real findings across frontend, Rust backend, config, docs.
- Landed the Stabilization milestone S1–S9 in 10 commits on
  `fix/2026-07-review-stabilization` (d0d4895..7ad0c66): backend
  correctness (transactional shortcut update, no clipboard translation at
  launch, HiDPI positioning, proxy auth/timeouts), StrictMode-safe
  listener lifecycle, cross-window settings sync + startup restore,
  quickSourceLang actually wired, no more settings-edit quota burn, OCR
  key passing, DeepL zh-TW, security hardening (single tray, minimal
  capabilities, strict CSP, no release devtools), lockfile regenerated
  (npm ci was broken), dead code removed, on-demand OCR dependencies with
  per-OS install guidance (user requirement), LICENSE + truthful README.
- Verified: build / typecheck / npm ci / cargo check (Docker) / doctor
  all green. Manual smoke checklist is in HANDOFF.md — the app was NOT
  run interactively this session.
- Remaining: S10 merge decision (user), backlog items under "Later".
- [auto-checkpoint] 2026-07-28 ~13:00Z — 1.2.0 version bump committed (52495e1); jammy deb-build container provisioning; smoke + user desktop test pending before merge.
- [auto-checkpoint] 2026-07-28 ~13:40Z — 1.2.0 deb built + smoke-tested from a clean install; hotkey crash found and fixed (58db330); test image + run script ready for user acceptance test.
- [auto-checkpoint] 2026-07-28 ~13:50Z — run script switched to detached start/stop/logs (no TTY under agent shell); app running on user desktop, awaiting acceptance test before merge.
- [auto-checkpoint] 2026-07-28 ~15:15Z — docker build/run/dev scripts committed (d3b0d99) incl. CJK font fix; starting dual-backend (Tauri + Electron) work for native 20.04 support.
- 2026-07-28 ~16:10Z — Dual backend landed: Electron build restored+modernized for Ubuntu 18.04-20.04, verified running natively on this 20.04 host (hotkey → popup → live translation). Shared platform contract enforces surface parity; VERIFY.md gained an 18-point behavior checklist.
- 2026-07-28 ~16:55Z — AGENTS.md parity rule added; both artifacts rebuilt from HEAD; branch pushed, PR #2 opened; draft release v1.2.0 created with both .debs and compatibility instructions (upload checksum-verified).
- 2026-07-28 ~17:56Z — v1.2.0 SHIPPED: PR #2 merged to main (cbe1df9), release published with both .debs (Ubuntu 22.04+ Tauri and 20.04- Electron). Session closed.
- 2026-09-20 ~01:00Z — Generative-AI providers collapsed to one OpenAI-format
  interface. `gemini` + `openai` + `openrouter` → a single "OpenAI Compatible"
  provider reachable at any base URL, with five one-click presets (OpenAI,
  Gemini, OpenRouter, DeepSeek, Ollama) and support for keyless local servers;
  DeepL/Google/Microsoft untouched. `ProviderCategory` deleted and the two
  Settings tabs merged into one Translation tab with a flat four-item list.
  `geminiService.ts` → `translationService.ts`, 660 → 424 lines, with one
  `httpJson`/`extractApiError` pair replacing every provider's duplicated
  native-vs-fetch branches. Image translation moved to OpenAI `image_url` with
  tolerant JSON parsing (which also fixed an unguarded `JSON.parse` that leaked
  a raw SyntaxError to users) plus a vision-capability error and a non-LLM
  guard. Turned out to need **no backend changes at all** — both backends are
  provider-agnostic, so the parity rule did not apply; that limit and the
  repo-root layout are now recorded in AGENTS.md (guardrailed edit, approved).
  The planned zustand `version`+`migrate` guard was found not to run at all on
  real pre-upgrade blobs (v5 requires a numeric stored version) and was moved to
  `merge` — caught only by seeding a live v0 blob. Verified in the browser and
  over the native transport against a mock server and the real Google endpoint;
  see VERIFY.md rows 28-31. DECISIONS 0014-0016.
- [auto-checkpoint] 2026-09-20 ~01:03Z — Provider collapse complete and verified (typecheck/build/15 tests, live browser + native-transport checks); 16 files uncommitted on main, commit proposed to the user, nothing pushed.
- 2026-09-20 ~01:45Z — v1.4.0 released with both `.deb` packages:
  https://github.com/WSH95/LightTranslator/releases/tag/v1.4.0 — carries the
  provider collapse plus the Wayland work merged as 1.3.0 but never published.
  Caught before publishing: a natively-built Tauri `.deb` on this 24.04 host
  hard-requires GLIBC_2.39 (Rust std picks up pidfd from the build host) and
  cannot start on Ubuntu 22.04, which is exactly what the `ubuntu22.04-or-newer`
  asset promises. Built in the jammy container instead — floors at GLIBC_2.34,
  and `apt-get install --simulate` on the 24.04 host upgraded the installed
  1.3.0 cleanly, so one artifact genuinely covers 22.04 through 24.04+. Docker
  is no longer required: rootless podman + podman-docker runs the existing
  build script unchanged. DECISIONS 0017.
