---
updated_at: 2026-10-02T11:38:26Z
updated_by: codex
session_status: active
branch: main
last_commit: "0e38fd3 docs(steward): record verified popup fixes on main"
---
# Handoff

## Now

Release 1.6.3 preparation is active on main. The user requested the version
bump and Debian packages now, then a repository push and GitHub release update
after their installed-app test. All five version files are updated consistently.
Tauri is building in the cached Ubuntu 22.04 container; Electron packaging and
artifact inspection follow. GitHub's latest public release is still v1.6.2.
No remote write or installed-package replacement has occurred.

## In flight

Version changes are in package.json, package-lock.json, Tauri config and both
Cargo files. PLAN/PROGRESS record the release workflow. Build logs are under
/tmp/lighttranslator-1.6.3-*.log. Source behavior is the reviewed 0e38fd3 tree,
including punctuation, Move and final-line fixes already accepted in the dev
app. Local automatic commits remain authorized. Publication waits for the
user's installed-app acceptance, which has not yet been received.

## Next steps

1. Finish Tauri/jammy and Electron builds; inspect version, architecture,
   compatibility floor, packaged resources and hashes. Prepare release notes.
2. Commit preparation records and provide the Tauri 1.6.3 package for the user
   to install and test. Keep both release assets tied to the verified source.
3. Wait for the installed-app test result. After acceptance, push main and tag
   v1.6.3, publish the GitHub release with both packages, and verify uploads.
4. Keep M4-M6 follow-ups explicit: physical multi-monitor/helper acceptance,
   native Electron non-resizable sizing, and pending-text integration tests.

## Blockers

No build blocker so far. Publication is conditional on the user's installed-app
acceptance. M4 needs physical monitors/new login; M5's cause remains unresolved.

## Key files

- `components/QuickTranslateWindow.tsx`, `utils/quickWindowDomSizing.ts`:
  confirmed Move UI and cloned scroll-container measurement.
- `src-tauri/src/quick_move.rs`, `src-tauri/src/lib.rs`, `electron/quickMove.js`,
  `electron/main.js`, `electron/preload.cjs`, `src/lib/platform.ts`: equivalent
  native mode, opening identity, revisions, readiness and dismissal behavior.
- `gnome-extension/lighttranslator@lighttranslator.app/extension.js`: resize
  clamping follows the window monitor; initial placement follows the pointer.
- `components/TranslatorView.tsx`: selected/auto display language for source
  punctuation, independent of translation requests.
- `tests/quick-move/README.md`: reproducible real-renderer checks. Both engines
  pass 67 cases, including actual final-line bounds, all text sizes, width caps,
  loading/results, repeated invocations, long-to-short and existing Move cases.
- `VERIFY.md`: full checks and evidence limits. Typecheck/build, seven Node test
  files, syntax and UI audit pass; merged main also passes all 9 Rust tests.
- `plans/2026-10-02-quick-clipping.md`, `plans/2026-10-02-quick-move.md`:
  approved plans. Decisions 0026-0028 record behavior, sizing and authorization.

## Tried and rejected

Measuring padded content alone missed the scrollbar's 6px width; the screenshot
case had 64px content in a 40px viewport. CSS scrollbar-gutter did not reliably
reserve the custom WebKit scrollbar. Clone the actual scroll container and
force overflow-y: scroll only on those hidden measurements.

Mapping the Chromium fixture without focus did not make its non-resizable
window resize. Instrumentation proved requests reached IPC while bounds stayed
480×220. Use actual viewport assertions; the old 24 Move-only checks did not
establish native sizing. Tauri's Wayland fixture needs Tao's GTK titlebar/box
structure to reproduce the clipped-line timing.

## Warnings

Keep Move native-authoritative and ephemeral. Reject older opening IDs and
revisions; retranslation retains mode, new/empty invocations and explicit close
reset it. Clone scrollbar reservation must not alter live automatic scrolling.

Native Electron sizing, physical helper/multi-monitor behavior and installed
packages are not accepted by renderer tests. GNOME loads changed helper code
after a new login. Existing Browserslist age and sandbox dconf warnings do not
fail the recorded checks. Cargo needs `/home/wsh/.cargo/bin` on PATH.

Task-owned apps/servers are stopped; no Tauri/Xephyr process or port
5173/5178/9232 remained. Logs/reports are under `/tmp/quick-clipping-*.log` and
`/tmp/lighttranslator-quick-clipping`; earlier Move/native X11 evidence is under
`/tmp/lighttranslator-quick-move`. Fixtures use isolated storage and controlled
responses without credentials. AGENTS.md and CLAUDE.md were not edited. Leave
other `.superpowers/sdd/` plans and the unrelated/prunable auto-popup-sizing
worktree alone.
