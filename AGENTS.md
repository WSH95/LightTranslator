# LightTranslator

Lightweight cross-platform translation tool built with React + two
interchangeable native backends: quick-translate hotkey, OCR, multi-engine
LLM translation

Primary language/stack: TypeScript (shared React frontend) with a Rust/Tauri
backend for Ubuntu 22.04+ and an Electron backend for Ubuntu 18.04-20.04.

## Source of truth

- Project charter: `.project-steward/PROJECT.md`
- Milestones and tasks: `.project-steward/PLAN.md` (see the Task backend
  block below if an external backend owns tasks)
- Current state and next steps: `.project-steward/HANDOFF.md`
- History: `.project-steward/PROGRESS.md`; decisions: `DECISIONS.md`;
  open questions: `QUESTIONS.md`; risks: `RISKS.md`;
  validation: `VERIFY.md`

## Conventions

- Keep this file concise (< 300 lines). It is instructions, not a log.
- Volatile state belongs under `.project-steward/`, never here.
- **Dual backend**: the React UI is shared, but `src-tauri/src/lib.rs` and
  `electron/main.js` implement the same commands twice. Backend changes land
  in BOTH in the same commit, and are checked against the parity list in
  `.project-steward/VERIFY.md`. `PlatformBackend` in `src/lib/platform.ts`
  is derived from the Tauri backend, so `npm run typecheck` catches a missing
  Electron method but not a behavioral difference.

## Git policy

- Commit at semantic boundaries using Conventional Commits; include
  `.project-steward/` in the same commit.
- Never push, force-push, or rewrite published history without explicit
  user approval.

<!-- PROJECT-STEWARD:BEGIN commands -->
## Commands

| Task | Command |
| --- | --- |
| Build | `npm run build` |
| Build (Tauri deb) | `npm run app:docker:build` |
| Build (Electron deb) | `npm run electron:build:deb` |
| Test | `TODO` |
| Lint | `npm run typecheck` |
<!-- PROJECT-STEWARD:END commands -->

<!-- PROJECT-STEWARD:BEGIN task-backend -->
## Task backend

Fine-grained tasks live in `.project-steward/PLAN.md` (built-in Markdown backend).
<!-- PROJECT-STEWARD:END task-backend -->

<!-- PROJECT-STEWARD:BEGIN agent-session-protocol -->
## Agent session protocol (Project Steward)

Durable project state lives in `.project-steward/` and travels via git.
Native session histories are execution details, never the source of truth.

**Session start** — before other work:
1. Read `.project-steward/HANDOFF.md`; run `project-steward resume` if the
   CLI is installed (it also detects crashed/unclosed sessions from git
   evidence and local runtime markers).
2. Give the user a short recap: last session, git state, active task,
   next step, blockers, open questions, and any abnormal-termination signs.

**During work** — at semantic boundaries (task done, plan changed, decision
made, validation run, risky step ahead), update `PLAN.md` / `PROGRESS.md` /
`DECISIONS.md` / `QUESTIONS.md` / `RISKS.md`, or run
`project-steward checkpoint --note "..."`. Propose a git commit at
meaningful checkpoints (Conventional Commits; include `.project-steward/`).
Never push without explicit approval.

**Session end** — when the user pauses, wraps up, switches tools, or leaves:
rewrite `HANDOFF.md` for a zero-context successor (state, in-flight work
cross-checked against `git status`, numbered next steps, blockers,
dead ends, warnings), append a `PROGRESS.md` entry, set
`session_status: closed`, and propose a commit. The
`project-steward wrap --summary "..."` command finalizes bookkeeping.

**Guardrails** — `AGENTS.md` and `CLAUDE.md` are high-risk files: edit only
inside `PROJECT-STEWARD` managed blocks, always show a diff and get explicit
approval first, and record the change in `DECISIONS.md`. Do not use these
files as progress logs. Keep volatile state in `.project-steward/`.
<!-- PROJECT-STEWARD:END agent-session-protocol -->
