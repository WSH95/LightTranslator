# Verification

How to check the project is healthy. Agents run these before claiming
"validated" in HANDOFF.md.

| Check | Command | Expected |
| --- | --- | --- |
| Build | `npm run build` | exits 0 |
| Tests | `TODO` | all pass |
| Lint | `npm run typecheck` | clean |
| Rust | `cargo check` (in `src-tauri/`) | clean |
| Lockfile | `npm ci` | resolves without lock/manifest mismatch |

Last verified: (never) — update this line after each full run.
