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
