# Decisions (ADR-lite, append-only)

## 0001 — 2026-07-28T12:10:31Z — Adopt Project Steward

**Context**: The project needs durable, cross-agent continuity.
**Decision**: Manage state in `.project-steward/` with AGENTS.md as the
canonical instruction file and CLAUDE.md as a thin Claude Code adapter.
**Consequences**: Sessions are resumable across tools and devices via git.

## 0002 — 2026-07-28 — Stabilization scope: Standard sweep

**Context**: A full project review (3 parallel audits + design verification)
found ~50 real issues: 15 broken behaviors, ~20 likely bugs, plus
security/hygiene items. Fixing everything at once (incl. Wayland, async
rework, secure key storage) would be a large, risky change set.
**Decision**: User chose the "Standard sweep": all broken behaviors +
likely bugs + cheap hardening/hygiene now (PLAN S1–S9); deep refactors
tracked in the Later backlog. Task backend: built-in Markdown.
**Consequences**: Some known risks remain open by choice and are listed
in RISKS.md; backlog items carry the review's finding IDs (B*/C*).

## 0003 — 2026-07-28 — OCR dependencies are on-demand, not install-time

**Context**: The .deb hard-required tesseract + 4 language packs +
gnome-screenshot; AppImage has no dependency mechanism at all, so its OCR
was permanently broken; tesseract also hard-failed unless every listed
language pack was present.
**Decision** (user requirement): ship without OCR packages as hard
dependencies (only xdotool stays — core quick-translate). Detect missing
components when the user actually invokes OCR and show an in-app popup
with OS-specific install commands (apt/dnf/pacman/zypper, brew, winget)
plus Re-check. Tesseract runs with whatever desired languages are
installed instead of all-or-nothing.
**Consequences**: Smaller install; OCR works identically for deb and
AppImage users; first OCR use may require a one-time manual install step.

## 0004 — 2026-07-28 — Stabilization work lands on a branch

**Context**: All prior commits went straight to `main`; this change set
is large (10 commits).
**Decision**: Work on `fix/2026-07-review-stabilization`; merge to `main`
only with user approval at wrap-up. No pushes without approval.
**Consequences**: `main` stays releasable while the sweep is reviewed.

## 0005 — 2026-07-28 — Build and test the .deb in containers (host cannot run Tauri 2)

**Context**: The dev machine is Ubuntu 20.04; Tauri 2 needs
webkit2gtk-4.1 (22.04+/Debian 12+), so the app cannot be compiled or run
natively here. Release 1.2.0 still had to be built, functionally tested,
and installed from the .deb by the user on this machine.
**Decision**: Build in an Ubuntu 22.04 (jammy) container so the artifact
targets glibc 2.35; smoke-test it in a *fresh* container that installs
the .deb the way an end user would (`--no-install-recommends`), driving
the UI under Xvfb + openbox with xdotool. For the user's own testing,
ship a committed image (`lighttranslator-test:1.2.0`) run with the host's
X socket so the containerized app appears on the real desktop and shares
the real keyboard/clipboard.
**Consequences**: Full end-to-end verification is possible on a host that
cannot run the app. Container caveats (no a11y bus, tray depends on the
host's StatusNotifier support) are environmental, not app defects.

## 0006 — 2026-07-28 — Window operations must run on the main thread

**Context**: Smoke-testing 1.2.0 revealed the quick-translate hotkey
killing the app (exit 1, no panic, sometimes first press sometimes
second). GTK/X11 is main-thread-only, but the window was positioned,
shown and focused directly from the global-shortcut callback thread —
long-standing code, made more fragile by the HiDPI clamp's extra
`outer_size`/`monitor_from_point` calls.
**Decision**: All window work hops to the main thread via
`run_on_main_thread` (cursor position is sampled before the hop); the
tray OCR handler uses the same helper.
**Consequences**: Hotkey is stable (5/5 presses verified). Any future
window manipulation from a background thread must follow this pattern.

## 0007 — 2026-07-28 — Dual backend: Tauri for 22.04+, Electron for 18.04-20.04

**Context**: Ubuntu 20.04 and older cannot run Tauri 2 at all —
webkit2gtk-4.1/libsoup3 have no candidate in any focal repo, and a jammy
build additionally needs GLIBC_2.32-2.34 against focal's 2.31. The only
ways to run there ship their own userspace (Docker/Flatpak/Snap), and
the user did not want containers as the daily path. Electron bundles
Chromium and officially supports Ubuntu 18.04+, which is why the app's
pre-4291514 builds ran natively there.
**Decision**: ship both backends from one codebase. The entire React UI
is shared, so the interface is identical by construction; only the ~13
backend commands exist twice. Electron restored from 339f55c but
rewritten to mirror src-tauri/src/lib.rs rather than dropped in, because
the legacy code predated the whole 2026-07 review.
**Anti-drift measures**: (1) `PlatformBackend` in src/lib/platform.ts is
derived from the Tauri backend, so the compiler rejects an incomplete
Electron backend; (2) non-OS logic lives in shared React/TS — OCR text
reflow moved to utils/textUtils.cleanTextLineBreaks and both backends
now return raw tesseract output; (3) VERIFY.md carries an 18-point
behavior checklist both builds must pass; (4) backend changes land in
both backends in the same commit.
**Consequences**: 20.04 gets a native install (~92 MB, ~200 MB RAM)
while modern systems keep the light Tauri build (~5 MB, ~60 MB). The two
packages Conflict in dpkg and store settings separately. Two backends
means double implementation for backend-level work; UI, providers and
settings work stays single-cost.

## 0008 — 2026-07-28 — Behaviors adopted from the legacy Electron code

**Context**: The 2024 Electron implementation was better than the Rust
port in two places, found while porting.
**Decision**: adopt both in BOTH backends — save/clear/restore the
clipboard around the synthesized Ctrl+C (so "nothing selected" no longer
translates stale content, review item C12), and hide the main window
during area capture. Rejected by contrast: the pkexec auto-installer for
OCR, which DECISIONS 0003 deliberately replaced with copy-pastable
guidance.
**Consequences**: C12 is closed; the Tauri backend gained two fixes it
would otherwise still be missing.

## 0009 — 2026-07-28 — AGENTS.md updated for the dual backend (guardrailed edit)

**Context**: AGENTS.md still described a Tauri-only project and carried no
rule preventing the two backends from drifting apart. Guardrails require
a diff, explicit approval, and a DECISIONS record for edits to this file.
**Decision**: with the user's approval, updated the stack description and
added a Conventions rule — backend changes land in both
`src-tauri/src/lib.rs` and `electron/main.js` in the same commit and are
checked against VERIFY.md's parity list — plus Electron/Tauri build rows
in the managed commands block.
**Consequences**: future sessions are told about the dual backend by the
file they read first, instead of discovering it from the tree.

## 0010 — 2026-08-26 — Electron Google 429: heal pooled connection and unmask errors

**Context**: On the Electron backend (Ubuntu 20.04), Google Translate worked
for the first few requests after launch, then consistently returned
"Google Translate failed: Google Network Error" until restart. Live
evidence while the bug was occurring:

- curl through the user's proxy (`127.0.0.1:17888`, required to reach
  Google) got HTTP 429 with Google's "Sorry…" block page, including with
  a Chrome UA header.
- A freshly launched second app instance worked while the old one kept
  failing, concurrently, same proxy → poisoned state is per-process
  (per-connection), not per-IP.
- Failure appeared within ~2s → Google is answering 429, not timing out.
- Restart fixed it immediately (fresh connection). Tauri is immune: it
  builds a new `reqwest::Client` per request (`src-tauri/src/lib.rs`).

Root cause: Electron routes every `proxy-request` through `net.request` on
the shared Chromium default session, which pools one keep-alive/H2
connection to Google. Once that connection is flagged, Google answers
429 on it forever while the TCP socket stays healthy, so Chromium keeps
reusing it. The renderer then discarded `statusCode`/`error` and threw
the fixed string "Google Network Error".

**Decision**:
1. Unmask the real cause in `translateWithGoogleFree` (429 named as a
   rate limit; other non-2xx include status + body snippet; transport
   failures show the backend error).
2. On Electron, after a failed request: log host/method/status/error plus
   a ~200-char body snippet (never the full URL — `q=` is user text).
3. Self-heal: `session.defaultSession.closeAllConnections()` then
   `forceReloadProxyConfig()`, with a 10s cooldown. Retry **once** only
   for GET/HEAD when status is 429 or missing (transport/timeout). POST
   transport failure heals without retry (not idempotent). Other non-2xx
   (including POST 429 = provider quota) neither heals nor retries —
   the response arrived, the pool is not the problem.
4. No Tauri change (immune by construction). Recorded as an intentional
   VERIFY.md divergence (row 19).
5. Deferred: spoofed browser UA (speculative; risks making the working
   Tauri fingerprint less consistent) and an alternate-endpoint fallback
   (revisit if logs ever show 429 persisting across fresh connections).

**Consequences**: a flagged connection self-heals on the next GET (Google
Free is the only GET engine). LLM/DeepL/Microsoft POST rate-limits do
not trigger connection kills. `closeAllConnections()` can abort a
concurrent in-flight POST once; mitigated by firing only after an actual
failure plus the 10s cooldown. If Google flags the whole exit IP, the
heal retry will not help, but the UI and logs now say HTTP 429 explicitly.
G4 (2026-08-26) reproduced that residual on the user's proxy after a
SIGSTOP/CONT transport test: the healed retry reached Google and got a
fresh-connection 429 (`Sorry…`), distinct from the pooled-socket case.

## 0011 — 2026-08-26 — Supersede the Google 429 socket/IP diagnosis with endpoint failover

**Context**: Real-world use of v1.2.1 reproduced the failure after a few
translations. The newly unmasked message claimed Google was throttling the
proxy exit IP, but changing the Google proxy route/IP did not fix it. Live
probes through the same configured proxy then showed:

- `translate.googleapis.com` GTX returned HTTP 429 for both GET and POST;
- `translate.google.com` GTX also returned HTTP 429;
- `clients5.google.com` with `client=dict-chrome-ex` returned HTTP 200, for
  both the compact and `dj=1` structured response modes;
- Electron's disk cache contained historical 429 transactions keyed by full
  GET URLs, including long translated text.

This disproves Decision 0010's asserted per-connection root cause and its
IP-specific UI message. Google's classifier is opaque, so the supported claim
is narrower: the throttle is endpoint/client-specific (or at least not solely
socket- or exit-IP-specific). Decision 0010 remains as the historical record
of why v1.2.1 was built, but its causal conclusion and HTTP-429 heal policy are
superseded here.

**Decision**:
1. The no-key Google provider POSTs form-encoded text to the Chrome Dictionary
   endpoint first (`client=dict-chrome-ex`, `dj=1`) and parses
   `sentences[].trans`.
2. Any primary HTTP/transport/malformed-response failure gets exactly one GTX
   POST fallback. If both fail, the UI names both endpoint results without
   claiming an IP or proxy cause. No automatic non-Google provider fallback.
3. HTTP 429 is an application/provider response, not a transport fault:
   Electron no longer closes sockets or retries it. Existing idempotent
   transport-error healing remains; Tauri already returns HTTP statuses
   directly.
4. Source text stays in POST bodies. Both backends mark provider traffic
   `no-store`; Electron also bypasses and clears its disposable HTTP cache.
5. Clipboard/OCR/manual triggers issue one intended translation rather than an
   immediate request plus the auto-translate request.
6. The user chose no-key failover over adding the supported, credentialed
   Google Cloud Translation API.

**Consequences**: The failure observed on the user's route now succeeds without
restart because the working endpoint is primary. GTX remains useful as a
same-provider fallback if the primary changes. Both endpoints are unofficial
and can still fail together; that limitation is described honestly in Settings
and README. Private translation text and credential-bearing provider URLs no
longer enter Electron's HTTP cache.

## 0012 — 2026-09-19 — Quick Translate under Wayland: GNOME shortcut + PRIMARY selection

**Context**: The hotkey popup worked in Xorg and did nothing in Wayland on the
user's Ubuntu 24.04 / GNOME 46 machine. Root cause, confirmed by the app's own
log (the one-time Wayland warning in `warn_if_wayland` never fired) and by
upstream source: `tauri-plugin-global-shortcut` → `global-hotkey 0.7` uses X11
`XGrabKey`, and Xwayland only receives key events while an X11 window has
focus, so the shortcut never reached the app. `xdg-desktop-portal-gnome` 46 has
no `GlobalShortcuts` interface (checked on the machine), so the portal route
does not exist here. Three further steps were also Wayland-dead: synthetic
Ctrl+C (Xwayland runs without `-enable-ei-portal`), `xdotool getmouselocation`
(stale), and `set_position` (ignored for Wayland toplevels).

**Decision**:
1. Session decides the mechanism. X11 keeps the app's own key grab, unchanged
   and fast (user's explicit choice). Wayland on GNOME registers a GNOME custom
   keybinding at our own dconf path running `<exe> --quick-translate`; other
   Wayland desktops show that command in Settings for manual binding.
2. Switching session types reconciles itself: an X11 start removes the entry
   before grabbing the key (with retries, because gnome-shell ungrabs
   asynchronously), a Wayland start recreates it and refreshes the command path.
3. The trigger reaches the running app through single instance
   (`tauri-plugin-single-instance`, Electron's `requestSingleInstanceLock`),
   which also resolves the long-standing duplicate-process issue (C4).
4. Selection capture under Wayland reads the PRIMARY selection instead of
   simulating Ctrl+C. Verified on the machine: text selected in a
   Wayland-native GTK app is readable from an X11 client, because mutter
   bridges the selection (`src/x11/meta-x11-selection.c`) regardless of focus.
   The clipboard is never written on this path.
5. The popup is hidden before being shown again. `present()` on an already
   visible window goes through xdg-activation, and a background app has no
   valid token, so it would never take focus; a fresh map does.
6. `warn_if_wayland` and its dialog are gone, and with them the only use of
   `tauri-plugin-dialog`. Settings now states where the shortcut is registered.
7. Electron is pinned to `--ozone-platform=x11` on Linux (desktop entry,
   autostart entry, GNOME command, dev script). Electron 38+ defaults to
   Wayland-native, where it cannot read PRIMARY in the background, position a
   window, or report the pointer; the platform is chosen before `main.js` runs,
   so this cannot be set from code.

**Alternatives rejected**: the GlobalShortcuts portal (absent on GNOME 46);
running the Tauri app under Xwayland (does not restore the pointer position,
and costs crispness on scaled displays); evdev (needs `input` group);
RemoteDesktop key injection (a consent dialog per session).

## 0013 — 2026-09-19 — A GNOME Shell extension places the popup, and installs itself

**Context**: Wayland deliberately denies applications global pointer
coordinates and window positioning, so "popup at the mouse pointer" — the X11
behaviour the user wants to keep — is impossible from inside the app. Without
help, mutter's placement puts a small window near the top-left (`find_first_fit`
then cascade), not where the user is looking. A shell extension runs inside the
compositor, which knows both the pointer and how to move windows. The user
chose this over an in-app centering fallback.

**Decision**: ship `lighttranslator@lighttranslator.app` (GNOME 45+, ~90 lines)
with the app. It listens for the popup being mapped, moves it to the pointer
clamped to that monitor's work area, and activates it; it is inert in X11
sessions and does nothing else — no keybinding, no schema, no D-Bus, nothing in
the panel — which is what should let it survive GNOME upgrades.

Installation is automatic, as the user asked: the `.deb` puts it in
`/usr/share/gnome-shell/extensions/`, and first run enables it for the user,
writing a per-user copy only if no current one exists (AppImage, dev run,
upgrade). Auto-enabling happens once, recorded by a marker file, so switching
it off afterwards is respected. GNOME only discovers new extensions when the
shell starts, so the first install needs one log out — confirmed on the machine,
and reported in Settings rather than failing silently. Without the extension the
popup still opens, wherever GNOME decides.
