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

Last verified: 2026-07-28T12:37Z — build ok, typecheck ok, `npm ci` ok, `cargo check` ok (in `lt-rust-check` Docker container — host Ubuntu 20.04 cannot compile Tauri 2; see HANDOFF Warnings), doctor 25/25 ok. No test suite yet.
