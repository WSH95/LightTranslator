# Progress log

Newest first. One short entry per semantic checkpoint — not per edit.

### 2026-10-02T08:35:35Z — codex
Opened the native Tauri dev app on Wayland with the frontend fix from `ca1ee46`.
The user replied "ok, tested" and requested closing it. Stopped the task-owned
app and Vite server; verified both processes exited and port 5173 was released.
No code changes or package builds were needed for this manual dev test.

### 2026-10-02T08:25:37Z — codex
Fixed the main source textarea's missing language tag. Explicit source choices
win; Auto Detect uses kana, then Hangul, then Han as a local rendering hint,
with Han defaulting to Simplified Chinese. The selected translation language
and provider requests are unchanged. Reproduced the centered source period in
WebKit before the fix and visually verified matching baseline punctuation
afterward in WebKitGTK and Electron at all three text sizes. Both engines
passed 14 language cases, editing/caret checks and input-method composition;
the mock provider received one request using "detected language", with no
additional request after a display-only update. Typecheck, build, the existing
five-file Node suite, UI static audit and independent source review passed.
See VERIFY.md for the fixture commands and evidence limits. The managed
worktree was read-only under the sandbox and was archived empty; work uses
`codex/fix-source-punctuation` in the original checkout. No release was built
or published.

### 2026-09-20T14:55:05Z — codex
Pushed `main` through `a2f033c`, created and pushed annotated tag v1.6.2, and
published v1.6.2 as the latest GitHub release with notes covering v1.4.0 through
v1.6.2. Uploaded the Tauri package for Ubuntu 22.04+ and the Electron package
for Ubuntu 18.04–20.04. Downloaded both public assets and verified byte-for-byte
identity and SHA-256 values against the local packages. Release:
https://github.com/WSH95/LightTranslator/releases/tag/v1.6.2

### 2026-09-20T14:48:14Z — codex
The user installed the final 1.6.2 Tauri package in the original Wayland
problem environment and reported no problems, closing acceptance of the
reported pop-up issue. Reproduced the HANDOFF.md frontmatter failure: the
unquoted `fix:` in `last_commit` starts a YAML mapping. Quoted the value and
verified it with PyYAML. Built and inspected the Electron 1.6.2 Debian package.
Fresh typecheck, Node tests, Electron syntax, Cargo check, Rust 5/5 and upload
asset comparisons pass. Publication will carry both packages and release notes
since v1.4.0.

### 2026-09-20T14:35:23Z — codex
Committed the reviewed automatic pop-up sizing change as `58dedc7` and
fast-forwarded local `main` from `8db274b`. Fresh checks passed before the
commit and on merged `main`: typecheck, production build, five Node test files,
both Electron entry syntax checks, Cargo all-target check and Rust 5/5. Nothing
was pushed, installed, tagged or published. Packaged physical-input acceptance
remains PLAN A7.

### 2026-09-20T14:20:28Z — codex
Source implementation by GPT-5.6-sol max is complete on
`codex/auto-popup-sizing`. Independent task and whole-branch review now have no
blocking source findings. Fixed canonical persistence after unversioned
hydration and the shared range keyboard-focus suppression; real storage/restart
and browser Tab/arrow/Reset checks pass. Final jammy package is 6,041,218 bytes,
GLIBC_2.34, SHA-256 `8097cd8d1537b3dea779cae16f76252aa141dbc7170fae46098f8257508fcc31`;
the original checkout contains an identical artifact. Changes remain
uncommitted in the isolated worktree, awaiting the user's integration choice.
Packaged physical-input acceptance remains PLAN A7; do not claim the original
Wayland click-dismissal report fixed. No install, tag, push or publication.

### 2026-09-20T14:16:09Z — codex
Final review found that the range slider's later `:focus { outline: none; }`
rule overrode the shared visible keyboard-focus treatment on Maximum width.
Removed that conflicting rule, leaving the slider's pointer, track, thumb and
active styling intact. Typecheck and production build pass. Browser Tab/arrow
verification and the final package rebuild remain with the coordinator. The
review's minor duplicate hide-reason logs are deferred; hide remains
idempotent and explicit reasons are preserved.

### 2026-09-20T14:03:35Z — codex
Independent review found that Zustand v5 merges unversioned legacy settings in
memory but does not write them back, so `quickWindowWidth` could survive every
read-only restart. Added a guarded post-hydration canonical write that uses the
same state reference, causing no extra subscriber notification or cross-window
broadcast. A real Zustand storage test captured the 0-write failure, then
proved one legacy rewrite, preserved settings, version 1/new-field storage, and
zero writes on a fresh canonical restart. Focused 7/7, typecheck, build, the
five-file Node suite, Electron syntax and diff checks pass. The jammy package
must be rebuilt after this review fix.

### 2026-09-20T13:53:00Z — codex
Rebuilt the frozen 1.6.2 source in the jammy container and inspected the Debian
package: `light-translator` 1.6.2 amd64, 6,040,856 bytes, GLIBC floor 2.34,
SHA-256 `f3307b0a4d547ae889d4521b86af21b6eb5689ea3b4523cb63c689bad4eb49cb`.
Copied the artifact to the original checkout's ignored release directory.
Native WebKit layout passed Wayland, X11 and 200% scaling; isolated GTK and
Electron windows stayed within the screen work area after growth. Independent
source review is running. Packaged focus/input acceptance remains open and
no installation, commit, push, tag or publication was performed.

### 2026-09-20T13:35:29Z — codex
Implemented the approved automatic quick-pop-up sizing source on
`codex/auto-popup-sizing`. Replaced remembered manual width with a migrated
480px maximum, added two-pass live-DOM measurement and one serialized resize
coordinator, removed every popup move/resize gesture and blur-suppression path,
made both native pop-ups non-resizable, and added the GTK size-request step that
allows a fixed window to shrink. Version is 1.6.2 for local acceptance.
Typecheck, build, Electron syntax, focused Node tests, Cargo check and all five
Rust tests pass. Toolkit probes pass on GTK Wayland/X11 and with a real WebKit2
child; the native GTK/WebKit fixture passes nine sizing/content cases. The
jammy 1.6.2 package built successfully; its inspection and packaged
Tauri/Electron interaction acceptance remain separate.

### 2026-09-20T12:10:00Z — claude
[auto-checkpoint] Cut 1.5.0 (05a0656) and built the release .deb in the jammy container. GLIBC floor 2.34 so it starts on Ubuntu 22.04; packaged icons byte-identical to the rebuilt artwork. Had to reclaim a container-owned Cargo.lock via `podman unshare chown` first. Awaiting the user's acceptance test; not tagged, not published.

### 2026-09-20T14:40:00Z — claude
Fixed the quick pop-up dismissing itself on click/drag/resize and shipped 1.6.1
(b41297d, 090bdfc). One cause for all three symptoms: a compositor grab clears
the window's focus on Wayland and two independent handlers hid the window on
blur. Consolidated hide-on-blur into the backend, added a suppression flag
around grabs in both backends, cut the pop-up to a single East grip, made
Escape close it, and dropped the never-usable quickWindowHeight. Rejected a
hand-rolled resize after measuring that WebKitGTK delivers no pointermove for
mouse and no motion past the window edge. Verified natively that the vanishing
is gone and that dismissal and Escape still work; whether the grabs actually
move/resize needs a real mouse.

### 2026-09-20T13:10:00Z — claude
Answered the 1.5.0 test feedback and shipped 1.6.0 (041dc36..ab9cc78). Checked
each report against the pre-refresh tree first: the pop-up's missing scrollbar
and the panes' missing hover/focus were regressions the refresh caused; edge
resize never existed, so it went in as a feature. Added eight resize handles
(native on Tauri, manual bounds drag on Electron), unpinned and persisted the
pop-up size, and added a frosted-glass Appearance > Theme. Measured both
engines' own edge hit tests rather than guessing a grab width. Release .deb
built, GLIBC floor 2.34.

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

## 2026-10-02 — Popup Move mode in progress

Started the approved Move-toggle plan on `codex/movable-quick-popup`, based on
`8c73a2f` after the completed punctuation dev test. Both native backends now
have matching ephemeral lifecycle state, opening IDs, revisioned notifications
and stale-request protection. Focused lifecycle tests failed before behavior
was implemented, then passed (4 Rust and 4 Electron). Typecheck passes.

The popup has a native-confirmed Move toggle and an isolated blank drag area.
The GNOME resize tests reproduced a cross-monitor jump; all 3 now pass after
clamping to the popup monitor. Extension metadata advances to version 2 so the
existing installer can deliver the updated helper. Renderer interaction checks
and physical input acceptance remain in progress. No push or release.

## 2026-10-02 — Popup Move implemented and verified

Move is implemented across the shared UI, Rust and Electron. The user answered
"Drag and dismissal work" after testing the native Wayland dev app. The final
renderer suite passes 24 checks in each engine, including the added 300px
header regression. Both real native backends pass six movement/dismissal checks
under an isolated Xephyr/GNOME X11 desktop; the popup moved from (300,150) to
(400,250). The startup overview and a hidden GTK client-leader window initially
intercepted test input; the runner now closes the overview and selects visible
windows. The initial Electron fixture timeout came from its CDP resize bridge;
using real preload IPC resolves it. The non-resizable fixture passed 24
interaction checks on host XWayland; later clipping checks found those tests
did not establish that native bounds followed every sizing request.

Electron's real app kept its initial 360×200 bounds under nested GNOME/X11,
despite a ready frontend. Its Move tests passed; the sizing difference is
unresolved and is recorded in PLAN M5 and RISKS. Physical multi-monitor/helper
upgrade checks remain in M4. An independent review found no blocking code
findings; direct pending-text delivery integration coverage is deferred in M6.

Final typecheck/build, seven-file Node suite, Electron syntax and strict UI
audit pass; Rust all-target check and 9 tests pass. Project records include the
state/IPC parity contract and evidence limits. The Wayland dev app, isolated
test apps/desktops and both Vite servers are stopped. No package, release,
push or merge was performed. Changes are prepared on `codex/movable-quick-popup`;
config.toml's ask commit policy keeps the commit awaiting approval.

## 2026-10-02 — Popup clipping fix started

The user supplied a screenshot from installed Tauri 1.6.2 and clarified that
scrolling reveals the half-hidden final line. Reproduced its 27-character
Chinese result in a fixture matching Tao's Wayland GTK structure: requested
438×110, but the scroll area had 40px for 64px of wrapped content. The existing
measurement omitted the scroll container and its 6px scrollbar, allowing a
resize to keep a scrollbar-induced extra line. The checked-in regression failed
before the product changes with those exact dimensions.

Now measuring cloned scroll containers with overflow-y: scroll in both passes,
while leaving the real container's automatic scrollbar unchanged. Mapping the
Chromium fixture without focus alone did not resolve retained native bounds:
bridge instrumentation proved delivered requests while the non-resizable
window stayed 480×220. A resizable renderer fixture applies the sizes, with
native Electron acceptance kept separate in PLAN M5. Existing staged Move work
is preserved.

The user explicitly requested automatic commits and merging into local main.
Updated the durable git commit policy to auto; integration will follow successful
checks and review. No push was requested.

## 2026-10-02 — Popup clipping verified; integration in progress

The screenshot regression failed before the fix and now passes. WebKitGTK and
Chromium each pass 67 actual geometry/Move checks, covering all three text
sizes, width limits, loading/results, long-to-short transitions and final-line
bounds after scrolling. Both screenshots retain the accepted appearance.
Typecheck, production build, seven-file Node suite, Electron/fixture syntax and
strict UI audit pass. The combined branch passes all 9 Rust tests.

The user tested the updated native Wayland dev app and replied "Fully visible"
for the short screenshot result after a long result. The app and Vite servers
were closed afterward; task-owned processes and ports 5173/5178/9232 are absent.
The installed app was not replaced. Native Electron sizing remains unresolved
and its renderer fixture's resizable flag is explicitly documented. Final
whole-branch review and the authorized local-main integration are next.

## 2026-10-02 — Popup fixes committed and merged into local main

Committed Move, scrollbar-aware sizing, regressions and Project Steward records
as `d59aed1 feat(quick-translate): add Move mode and prevent clipped text`.
A fresh-context review of `ebaffc0..d59aed1` found no Critical/Important issues
and approved integration. Main fast-forwarded to the reviewed commit, bringing
in the earlier source-punctuation fix as well. The merged tree is identical;
the seven-file Node suite and all 9 Rust tests pass on main.

Review boundaries remain explicit: Chromium geometry uses a resizable fixture,
so native Electron automatic sizing remains M5; accepting that limitation
could leave native sizing wrong. Physical multi-monitor/helper/package checks
remain M4, so cross-monitor placement still needs acceptance. Direct pending-
text integration tests remain the nonblocking M6 follow-up; rare handler races
are not established by lifecycle-unit coverage alone.

The user authorized automatic local commits and main integration; no remote
pull or push was needed for the known fast-forward. No version bump, package
installation or release occurred. Test apps/servers are closed. The final
handoff records main and the remaining follow-ups; task-specific scratch and
the merged feature branch can be removed without affecting other worktrees.

## 2026-10-02 — Release 1.6.3 preparation started

The user requested a version bump and Debian build, then a repository push and
GitHub release update after their installed-app test. Main is clean at 0e38fd3
before this work. GitHub's current release is v1.6.2 with Tauri and Electron
Debian assets. Bumped package.json, package-lock.json, Tauri config and both
Cargo files to 1.6.3 without changing dependencies or application behavior.

Build the Tauri package in the existing Ubuntu 22.04 builder to retain its
compatibility floor; build the matching Electron package for the second public
asset. Prepare the release locally and record checksums. Commit policy remains
auto. The explicit publication authorization is conditional on the user's
installed-app acceptance; no push, tag publication or release write yet.

Release-preparation checks pass: all six declarations agree on 1.6.3,
typecheck and the seven-file Node suite pass. The Docker builder reports
Ubuntu 22.04.5 and a previous release cache; it is compiling Rust dependencies.
The fresh production bundle passed and is shared by both packages. Electron
uses electron-builder --linux deb directly to avoid rebuilding dist while
Tauri consumes it. Local draft notes are releases/1.6.3.md. No remote writes.

## 2026-10-02 — 1.6.3 packages ready for installed-app testing

Version preparation is committed as c1cd94b on local main. Both Debian builds
finished successfully. Tauri's release compile took 5m08s in Ubuntu 22.04.5;
the extracted binary retains GLIBC_2.34. Its package is 6,078,864 bytes, SHA-256
e85a5ac0b8442e24b17d1117bcf2a591c7b4a125c1263a3ee13548b08789d42d.
Electron is 92,683,800 bytes, SHA-256
6123325e75ff92660a63287443cda1f185bc8e17855174fb99c36718d4e5ee03.

Both metadata versions are 1.6.3 amd64, and both ship desktop files, icons and
the reviewed GNOME helper v2. Electron ASAR native sources and four production
scripts match the working source/output; the new Move and clipping code is
present. Installed packaging-tool versions match package-lock. Release-named
copies match the originals, with provenance and notes saved under releases/.
The app has not been installed or pushed; publication awaits the user's test
result exactly as requested. Existing M4-M6 limits remain explicit.

## 2026-10-02 — Popup stacking fix started

The user tested installed 1.6.3: the previous fixes work, but a Move popup can
fall behind another app. The approved fix enforces the existing above intent
through the GNOME helper, reasserts it before native Move confirmation, and
updates stale user-local helper copies in both installers. Main is clean at
7411c42; work is isolated on codex/quick-popup-always-on-top. GNOME reports
running helper v1 while both installed metadata files are v2. Revised packages
and a new-login/helper-v3 acceptance test are required before publication.

## 2026-10-02 — Popup stacking and helper upgrade checks passed

GNOME helper v3 applies the above layer at map/attachment, without refocusing
existing popups, and owns/disconnects both window handlers. Both backends
reassert native above before confirming current Move requests; failure keeps
the mode unchanged. Paired installers refresh stale user overrides, preserve
newer copies/disabled preferences and commit the version only after code.
Typecheck, production build, eight-file Node suite, all 16 Rust tests, Rust
checks, JS syntax and strict UI audit pass. WebKit and Chromium pass 67 checks
each; the first hidden parallel WebKit run failed on stale native bounds and
an isolated rerun passed unchanged (M7). Native Tauri/Electron GNOME/X11 tests
confirm dragging, topmost stack after switching focus, no focus stealing and
normal dismissal/reset/explicit closing. Fresh review, local merge and rebuilt
1.6.3 debs are next. Host Wayland/helper-v3 installed acceptance is pending.

## 2026-10-02 — Reviewed stacking fix on main; revised packages await testing

Committed b15ade1 and obtained a fresh review of 7411c42..b15ade1: no Critical,
Important or Minor findings. Main fast-forwarded to the reviewed tree; tree
equality and the eight-file Node suite pass after integration. The reviewer
kept physical Wayland/GObject behavior, compositor acknowledgement, revised
installed acceptance and concurrent WebKit resize repeatability as explicit
acceptance/coverage boundaries. No additional source fix was needed.

Both 1.6.3 rebuilds pass. Tauri's cached jammy release compile took 40.99s; its
archive retains GLIBC_2.34 and is 6,075,118 bytes, SHA-256
c974b82b92690e89a5aca35a21c8f8b407fa888ed51fb518218785322136e9d7.
Electron is 92,686,108 bytes, SHA-256
13865ee04be75d3b91fc416f2004c462eece23c5412b85300773f169ed627f55.
Both ship helper v3 matching reviewed source. Electron ASAR native files and
four production scripts match the source/frontend; desktop/icons and package
versions pass inspection. Staged release files match originals.

Updated the existing user-local helper v2→v3 without changing enable settings;
backup is /tmp/lighttranslator-always-top-helper-backup. GNOME still reports
running v1 until a new login. The app itself was not reinstalled. The managed
worktree is recoverably archived and its fully merged branch deleted; task
ledger/review diff were preserved under .project-steward/tmp/. Test apps and
Vite servers are closed. No push, tag or release write occurred. The user must
reinstall the revised same-version package and test after a fresh login before
the authorized publication.
