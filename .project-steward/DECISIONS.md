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
