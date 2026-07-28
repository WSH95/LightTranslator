# Progress log

Newest first. One short entry per semantic checkpoint — not per edit.

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
