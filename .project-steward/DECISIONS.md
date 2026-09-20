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

## 0014 — 2026-09-20 — One OpenAI-format interface replaces the three LLM providers

**Context**: `services/geminiService.ts` and the `PROVIDERS` table date from the
initial commit (d9f13e5, 2025-12-31), with OpenRouter bolted on a week later
(0755ea6). That template assumed every LLM vendor needed its own wire format and
its own settings block. It no longer does: OpenRouter has always been
OpenAI-shaped, and Gemini now serves an OpenAI-compatible endpoint
(`https://generativelanguage.googleapis.com/v1beta/openai/` — Bearer auth,
`/chat/completions`, `/models`, `image_url` data-URIs, all confirmed against
Google's docs). The result was three near-identical implementations,
`translateWithOpenAI` and `translateWithOpenRouter` differing only by a
hardcoded URL and two headers, plus a two-value `ProviderCategory` whose only
job was splitting one UI list in two.

**Decision**: collapse `gemini` + `openai` + `openrouter` into a single
`openai` provider, "OpenAI Compatible", reachable at any base URL. Keep DeepL,
Google and Microsoft untouched — they speak their own protocols and cannot be
folded in. Delete `ProviderCategory`; Settings shows one flat list of four under
a single **Translation** tab. The user chose **one config slot** (base URL / key
/ model) with one-click presets over named profiles, and chose **not** to
migrate old keys.

Consequences of the single slot, each deliberate:
- Image translation moves from Gemini-native `inlineData` to OpenAI
  `image_url`, and now follows the same config. It needs a vision-capable
  model; a text-only endpoint gets a message naming the model and what to
  change, and a non-LLM provider is refused before any request goes out.
- No `response_format: {type:'json_object'}` on the image request. Gemini's
  compat layer accepts it, but llama.cpp, LM Studio, older vLLM and several
  proxies reject unknown top-level fields outright. JSON is requested in the
  prompt and parsed tolerantly instead (fence-stripping plus a string-aware
  balanced-brace scan). This also fixes a live bug: the old
  `JSON.parse(resultText)` was unguarded, so a fenced reply surfaced a raw
  `SyntaxError` to the user.
- An empty API key is now valid, so local servers (Ollama, llama.cpp, LM
  Studio) work without inventing a key.
- All six providers previously duplicated themselves into `platform.request`
  and `fetch` branches with divergent error extraction. One `httpJson` helper
  now serves every provider on both transports, with one `extractApiError`, so
  a provider error reads as a message instead of a raw JSON body. The file went
  from 660 to 424 lines.
- `services/geminiService.ts` renamed to `services/translationService.ts`; the
  old name had been wrong since OpenRouter landed.
- Dead weight removed with the template: `requiresKey` (declared on all six
  entries, read nowhere), `enabled` (true on all six, so its "Desktop App Only"
  branch was unreachable), and the Gemini-only `process.env.API_KEY` dev
  inlining with its two `vite.config.ts` defines.

**Notably, this changed no backend code.** Neither `src-tauri/src/lib.rs` nor
`electron/main.js` knows a provider exists — both expose one provider-agnostic
HTTP primitive (`proxy_request`), and URLs, headers and bodies are all built in
the renderer. The AGENTS.md dual-backend parity rule therefore did not apply;
see 0015.

## 0015 — 2026-09-20 — The stale-provider guard runs in `merge`, not `migrate`

**Context**: Choosing not to migrate old keys left a hazard. `partialize`
governs what zustand *writes*, not what it *reads*, so an upgrading user's
`provider: 'gemini'` rehydrates into a store whose type no longer admits it.
`PROVIDERS.find()` then returns undefined, Settings renders with nothing
selected, and the quick-translate popup — which has no Settings UI to recover
from — prints "Powered by Unknown" and fails every translation.

The plan of record called for zustand's `version` + `migrate`, on the stated
assumption that a stored blob with no version is treated as version 0. **That
assumption is wrong for zustand v5.** `middleware.js` guards the call with
`typeof deserializedStorageValue.version === "number" && ... !== options.version`,
and every blob written before this release has no `version` field at all — so
`migrate` would never fire for exactly the users who need it. Caught by seeding
a real v0 blob in the browser and observing `provider` survive as `'gemini'`
while the version stamp and key-dropping (both the work of `partialize`) made
it look like the migration had run.

**Decision**: do the coercion in `merge`, which zustand calls on every
rehydrate regardless of version. It drops the four removed fields and resets
`provider` to `DEFAULT_SETTINGS.provider` (`'google'`, which needs no key, so
the app translates immediately after the upgrade) whenever the persisted id is
not in `PROVIDER_IDS`. It is pure and idempotent, so the repeated cross-window
`persist.rehydrate()` calls are harmless. `version: 1` is kept so a future
v1 → v2 migration can use `migrate` properly, with a comment explaining why it
is not what fixes this. Belt and braces: the dispatch in `translateText` now
falls through to the key-free Google endpoint for any unrecognized id rather
than throwing.

Verified against a seeded v0 blob: provider coerced to `google`, dead keys
dropped, and everything else (`customSystemInstruction`, DeepL/Microsoft keys,
shortcut) untouched. A blob already on `openai` keeps its base URL, key and
model exactly as they were.

## 0016 — 2026-09-20 — AGENTS.md: repo layout and the limit of the parity rule

**Context**: Guardrails require a diff, explicit approval and a DECISIONS record
for AGENTS.md edits; 0009 is the precedent. Two problems surfaced during 0014.
First, two independent codebase searches this session both started in `src/` and
came back empty — the React app lives at the repo root, and `src/` holds only
`src/lib/platform.ts`. Second, an agent reading "backend changes land in BOTH"
while editing providers would go hunting for a Rust counterpart that does not
exist; DECISIONS 0007 already says "UI, providers and settings work stays
single-cost", but that line is buried in a decision record rather than in the
file agents read first.

**Decision**: with the user's approval, added a **Repo layout** bullet to
Conventions, extended the **Dual backend** bullet to state that both backends
are provider-agnostic and that provider/UI/settings work is frontend-only, and
refreshed the one-line stack summary now that the LLM side is a single
OpenAI-compatible interface. The `Commands` table was left alone: `| Test |
TODO |` is still honest.

**Consequences**: the next session is told where the code is by the file it
reads first, and knows when the parity rule does and does not bite.

## 0017 — 2026-09-20 — Release .debs must be built in the jammy container; podman replaces Docker

**Context**: Preparing the 1.4.0 release on an Ubuntu 24.04 host (glibc 2.39)
with no container runtime installed. The handoff said Tauri "builds natively
here", which is true for development but was nearly taken as licence to build
the release artifact natively too.

Measured on a natively-built package before publishing anything:

```
$ objdump -T usr/bin/lighttranslator | grep 'GLIBC_2.3[5-9]'
(GLIBC_2.39) pidfd_getpid
(GLIBC_2.39) pidfd_spawnp
```

Rust's `std::process` picks up pidfd support from the *build host's* glibc, so a
24.04 build hard-requires GLIBC_2.39. Ubuntu 22.04 ships 2.35, so that package
cannot start there — and it would have shipped under the existing
`ubuntu22.04-or-newer` asset name. glibc is the only blocker: everything else
the binary needs (`OPENSSL_3.0.0`, `GCC_3.x`, and every `NEEDED` library —
webkit2gtk-4.1, gtk-3, libsoup-3.0, libssl/libcrypto.so.3) is present on 22.04.

**Decision**: release `.deb` artifacts are always built with
`npm run app:docker:build` in the jammy container, never natively, regardless of
what the host can compile. Native builds stay a development convenience.

**Docker itself is no longer required**: `podman` + `podman-docker` provide a
rootless `docker` shim with no daemon and no group membership, and
`scripts/docker-build-deb.sh` runs through it unchanged (verified end to end for
1.4.0, ~5.5 min cold). `sudo apt install -y podman podman-docker` is the whole
setup. This is the recommended path on hosts without Docker.

**Verified for 1.4.0**: the container build floors at GLIBC_2.34 with nothing
above 2.35, and `apt-get install --simulate` on the 24.04 host resolved every
dependency and upgraded the installed 1.3.0 cleanly — so one jammy artifact
genuinely serves 22.04 through 24.04+, as the asset name claims. glibc is
backward compatible, so building low and running high is always the safe
direction.

## 0018 — 2026-09-20 — Ubuntu/Yaru refresh: resolved theme in JS, tokens in CSS

**Context**: The refresh needs light + dark themes and a user-chosen accent
across three windows (main, settings-as-view, quick pop-up) that all render
from one bundle. The brief specifies `data-theme` on `<html>` plus an
`--accent` variable but not how `'system'` is resolved.
**Decision**: `data-theme` is always a RESOLVED `light`/`dark`; `'system'` is
collapsed in JS (`src/lib/theme.ts`), never in CSS. Theme state lives in a
module singleton called from `index.tsx` before `createRoot`, not in a hook or
provider — `App.tsx` early-returns for the pop-up, so anything inside the React
tree would need installing twice, and the theme must be on `<html>` for the
first painted frame. Only `--bg` and `--accent` are channel triplets (they are
the only tokens used at a non-1 alpha); the rest bake their alpha in and are
terminal.
**Consequences**: The dark token block is declared once, and a desktop-level
signal can override `prefers-color-scheme` with no CSS churn. Cross-window
propagation is free: `updateSettings` → `emitSettingsChanged` →
`persist.rehydrate()` → `useAppStore.subscribe(apply)`, with no new IPC.
`bg-ctrl/50` compiles and silently renders at full alpha — Tailwind drops the
modifier on a colour that already has one. That is documented in the config; if
a second alpha is needed, add a token.

## 0019 — 2026-09-20 — `accent-color` does not exist before GNOME 47; `gtk-theme` is the fallback

**Context**: The brief says "Follow system accent" should read
`org.gnome.desktop.interface accent-color`. That key landed in GNOME 47.
Ubuntu 24.04 — the primary target — ships GNOME 46 and returns
`No such key "accent-color"`.
**Decision**: `get_system_appearance` returns `color-scheme`, `accent-color`
and `gtk-theme` as raw strings from both backends; the frontend maps them
(`src/lib/accents.ts`). `accent-color` wins where it exists; otherwise the Yaru
GTK theme name does, and `/usr/share/themes` carries exactly `Yaru` plus nine
`Yaru-<name>` variants that map one-to-one onto the ten swatches (plain `Yaru`
is Orange). Theme precedence: `prefers-color-scheme` is the live authority and
is invalidated first on every change; gsettings is re-read on startup and on
each change and wins on disagreement, because it is the actual desktop setting.
**Consequences**: A cached one-shot read must never win, or a live GNOME
dark/light switch would be ignored until restart — worse than no read at all.
Reading a key a schema does not declare **aborts the process** rather than
erroring, so both the `schema_installed()` and `has_key()` guards are
load-bearing; `interface_schema_reads_are_guarded` in `gnome_shortcut.rs` is
the canary, and a regression takes the test runner down rather than failing an
assertion. GNOME 47's nine names do not line up with Yaru's ten, so
teal/yellow/pink/slate map to their nearest sibling.

## 0020 — 2026-09-20 — Deviations from the design brief, and why

**Context**: The brief is marked "pixel-perfect, values final", but parts of it
are unreachable as written or unsafe.
**Decision**, each shipped deliberately:
1. **`--accent-fg`**. The brief says suggested-action buttons are accent bg with
   white text. White on the lightened dark accents measures 2.15–2.54:1, so
   dark mode uses `#242424` (6.1–7.2:1). The mock's own dark radio check is
   `#1a1a1a`, which corroborates it.
2. **No pop-up drop shadow**. `#root` fills the window, so the brief's outer
   `0 14px 36px` composites outside a transparent window and never renders.
   Shipping the inset ring, which is what `quickWindowBorderOpacity` maps to,
   theme-scaled so it lands on the mock's `.2` light / `.6` dark. The default
   moves 0.05 → 0.1 to suit; persisted values are untouched.
3. **View switcher centred on the window**, not 33px left as the mock draws it.
   That offset is an artifact of the mock's `flex:1` slot; the brief says
   "centered" and libadwaita centres on the window.
4. **Menu-open pop-up height 362, not 300**. The mock drew seven languages;
   there are nine, and 300 cut off Spanish and Russian.
5. **`TranslatorView` stays mounted** behind Settings (hidden, not unmounted).
   It owns `platform.onOcrResult`, so unmounting loses tray OCR results, and
   remounting re-fires auto-translate against the surviving store text.
6. **The language pill portals its popover** to `<body>`. Every container it
   would otherwise sit in clips it — the panes and boxed lists are
   `overflow:hidden` and the settings column scrolls.
7. **OCR pickers become modes**. Capability unchanged, affordance changed, per
   the approved design. The preview area is the capture trigger; selecting a
   segment must not start `gnome-screenshot`, since screenshot is the default
   mode and the dialog would fire one on open.
8. **No webfont**. The CSP is `font-src 'self'` and `style-src 'self'
   'unsafe-inline'`, so the mock's Google Fonts link is blocked twice over.
   Ubuntu and Ubuntu Mono are installed on the target.
9. **Symbolic tray not wired**. GNOME cannot recolour a pixel icon, and both
   tray APIs take pixels; a real symbolic tray needs a themed icon name
   installed into hicolor. `lighttranslator-symbolic.svg` ships as an asset.
   `tray-24x24.png` and `tray-icon.png` remain unreferenced orphans.
**Consequences**: Small/large translation text sizes (14/19 main, 13/18 quick),
the dark OCR stripes and the dark popover are extrapolated — the brief pins only
the medium sizes and drew no dark variants of those screens. See QUESTIONS.md
for the Yaru Orange contrast issue.

## 0021 — 2026-09-20 — Edge resize is per-backend; glass is a separate axis

**Context**: The 1.5.0 test asked for draggable window edges and a
frosted-glass theme. Frameless windows get no resize border of their own:
`decorations: false` strips GTK's CSD margin, and both engines run their own
edge hit test that consumes the press before the DOM sees it.
**Decision**: The app draws eight handles and hands off per backend. Tauri
calls `startResizeDragging` (compositor-side; correct on Wayland and X11, and
`core:window:allow-start-resize-dragging` was already granted). Electron has no
equivalent, so it drags bounds by hand from a main-process snapshot using
screen-space deltas. Glass is `surfaceStyle: 'solid' | 'glass'`, orthogonal to
`appearanceTheme`, so light-glass and dark-glass both exist; the field is named
`surfaceStyle` rather than `theme` because `appearanceTheme` already means
light/dark, while the Settings group is titled "Theme" as the user asked.
**Consequences**: Electron's manual path moves the window origin, which Wayland
forbids, so north/west edges only work under X11 — the sessions that backend
targets. The grab band is 8px because measurement showed Chromium consumes
roughly the outer 6px (no handler at 2px or 5px inset, handler fires at 7px)
and tao has a comparable 5px band. A persisted pop-up size disables auto-fit,
so Settings > Pop-up > Window carries a Reset. Glass also makes every surface
non-opaque, which incidentally removes the WebKitGTK antialiasing
inconsistency recorded in RISKS.md — at the cost of uniformly heavier text.

## 0022 — 2026-09-20 — The backend owns the pop-up's hide-on-blur

**Context**: The quick pop-up vanished on click and would neither move nor
resize. On GNOME Wayland both `startDragging` and `startResizeDragging` hand
the window to the compositor; mutter clears the client's keyboard focus for the
grab, which arrives as a plain `Focused(false)`. Nothing in tao or Tauri
separates that from a genuine click-away, and **two** independent handlers hid
the window — one in Rust, one in the renderer.
**Decision**: The backend is the sole owner of hide-on-blur; the renderer's
listener is deleted. `start_quick_drag` sets a suppression flag and starts the
move in one command so the blur cannot arrive unguarded; resizes `await`
`set_quick_drag_active` first, because `start_resize_dragging` is only on
`Window`, which sits behind Tauri's `unstable` feature. The flag clears on the
next focus-in and after 1s regardless. Electron brackets the same state with
`will-move`/`moved`. Escape now closes the pop-up.
**Consequences**: Suppression is only honourable with one hider, which is why
consolidation came first. A hand-rolled resize was tried and rejected on
evidence: WebKitGTK dispatches `pointerdown` but not `pointermove` for mouse
input, and delivers no motion once the pointer passes the window edge, so the
drag stalls the moment the pointer outruns the edge. The 1s watchdog bounds the
damage if a grab never starts. The pop-up shows only an East grip, which also
removes the dead perimeter ring that made ordinary clicks land on a handle, and
the NE-grip/close-button overlap. Height always follows the content, so
`quickWindowHeight` is gone.

**Testing note worth keeping**: the pop-up cannot be verified by automation —
it hides on any focus change, WebKitGTK throttles its hidden webview so HMR does
not reach it reliably, and synthetic pointers cannot start a compositor grab.
The 1.6.0 round proved the resize on Electron and inferred Tauri was fine; that
test could not have failed, so it proved nothing. Verify pop-up behaviour on
Tauri, with a real mouse.

## 0023 — 2026-09-20 — The quick pop-up sizes itself and has no move/resize gesture

**Context**: The 1.6.1 fix made compositor move/resize grabs a special case in
focus-loss dismissal, but the user wants the pop-up to fit its translation
automatically and does not need to position or resize it by hand. A native
`resizable: false` GTK window introduced a separate constraint: ordinary
`gtk_window_resize` could grow it, but could not shrink below its initial
360x200 default size.

**Decision**: `quickWindowMaxWidth` is a 300–600 whole-pixel setting with a
480px default. It is a cap, not a fixed width. The renderer clones the current
header, body and footer into an offscreen unconstrained host, measures actual
max-content width in the active font, floors that result by the toolbar (and an
open menu), caps it by the setting, then measures the wrapped height at the
chosen width. One coordinator coalesces every content, settings, font and menu
invalidation, serializes resize IPC and suppresses unchanged dimensions.

Both native pop-ups are non-resizable; Electron is also non-movable. The popup
header drag region, edge handle, popup-only platform methods/commands,
suppression flags and watchdog are removed. Main-window drag and edge resizing
remain. On Linux, Tauri performs `GtkWindow::set_size_request(width, height)`
then `GtkWindow::resize(width, height)` on the GTK main thread. Other Tauri
targets retain `set_size`, and Electron retains programmatic `setSize`.
Focus-loss dismissal remains backend-owned and unconditional. Debug builds, or
release builds launched with `LIGHTTRANSLATOR_QUICK_DEBUG=1`, log focus,
show and hide actions with explicit reasons and no translated text.

**Consequences**: Short results can be narrower than 300px; long results wrap
at the configured cap and scroll vertically after 500px. Newlines, CJK, emoji
and unbroken URLs use browser layout rather than character estimates. Opening
the portalled language menu reserves its measured width and height; closing it
restores content sizing. Legacy unversioned blobs take a valid new field first,
then a valid `quickWindowWidth`, then 480, and new snapshots omit the retired
field. Because Zustand v5 does not write after an unversioned `merge`, successful
hydration compares the raw stored state with the canonical partialized state
and performs one same-state persistence write only when they differ. That write
does not notify subscribers or broadcast across windows; a canonical restart
does not write again. The project version is 1.6.2 so local acceptance installs
cannot be confused with 1.6.1.

**Evidence boundary**: GTK probes passed exact grow/shrink requests on Wayland,
X11 and Wayland with a real WebKit2 child. A native GTK/WebKit integration
fixture passed content sizing cases. Near-edge X11 probes also showed Mutter
repositioning both a GTK window and an Electron BrowserWindow after growth so
they remained inside the work area; no duplicate client clamp was added. Those
results establish toolkit and renderer behavior; they do not substitute for
packaged Tauri/Electron focus and interaction acceptance, which remains open in
PLAN A7.

**Review follow-up**: restore the existing shared keyboard-focus outline by
removing the range-specific suppression. Keep duplicate hide-reason logging
as a deferred diagnostics-only issue: an explicit cause remains in the log and
the repeated hide is idempotent. No new blur delay or dismissal-state machinery
is justified by that Minor finding. Source integration is ready; packaged
physical-input acceptance remains open.
