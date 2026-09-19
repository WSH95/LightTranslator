# Progress log

Newest first. One short entry per semantic checkpoint — not per edit.

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
