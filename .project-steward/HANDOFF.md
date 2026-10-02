---
updated_at: 2026-10-02T11:56:16Z
updated_by: codex
session_status: closed
branch: main
last_commit: "c1cd94b chore(release): bump version to 1.6.3"
---
# Handoff

## Now

Version 1.6.3 and both Debian packages are ready on local main for the user's
installed-app test. The Tauri build retains GLIBC_2.34, and both archives pass
metadata/resource/hash inspection. Source version commit is c1cd94b. The user
explicitly requested push and GitHub release after their installed-app testing;
that result is still pending. No install or remote write was performed by the
agent. GitHub's public release remains v1.6.2. Automatic local commits remain
allowed; conditional publication authority comes from the user's request.

## In flight

Only closing preparation records remain to commit. No feature code is dirty.
Release tasks B1-B2 are complete; B3 acceptance and B4 publication are pending.
The earlier punctuation, Move and clipping fixes are on main and accepted in
the native Wayland dev app. Do not substitute that dev acceptance for the new
installed-package acceptance. Both build jobs have finished; no app is open.

## Next steps

1. Obtain the user's installed Tauri 1.6.3 test result. Check source Chinese
   periods with Auto Detect, popup final-line visibility for short/long results,
   and Move/drag/click-away/dismissal. If a problem is reported, fix it and
   rebuild/retest before publishing. Keep the candidate version 1.6.3 until its
   first public release.
2. After acceptance, verify the original and staged files against
   `releases/1.6.3-artifacts.json`. If staged copies are missing, recopy the
   originals; do not rebuild silently after the accepted test.
3. Check origin/main and existing v1.6.3 tag/release state before pushing. Push
   main without force and an annotated v1.6.3 tag matching the tested code;
   source behavior must still match c1cd94b, apart from stewardship records.
4. Publish v1.6.3 in WSH95/LightTranslator with both staged assets and
   `releases/1.6.3.md` as the notes body. Verify public asset hashes and Latest
   status. Record the user's acceptance and publication in PLAN/VERIFY/PROGRESS.
5. Keep M4-M6 separate: physical monitor/helper acceptance, native Electron
   non-resizable sizing, and delayed-text handler integration coverage.

## Blockers

Publication awaits the user's installed-app result by explicit instruction.
No technical build blocker remains. The user has authorized publication after
acceptance; do not ask again once a successful installed-app test is reported.

## Key files

- `src-tauri/target/release/bundle/deb/LightTranslator_1.6.3_amd64.deb`:
  Tauri package for Ubuntu 22.04+/Debian 12+, 6,078,864 bytes, SHA-256
  e85a5ac0b8442e24b17d1117bcf2a591c7b4a125c1263a3ee13548b08789d42d.
- `dist-electron/LightTranslator_1.6.3_amd64.deb`: Electron package for
  Ubuntu 18.04–20.04, 92,683,800 bytes, SHA-256
  6123325e75ff92660a63287443cda1f185bc8e17855174fb99c36718d4e5ee03.
- `.project-steward/tmp/release-1.6.3/`: ignored, persistent release-named
  copies ending ubuntu22.04-or-newer.deb and ubuntu20.04-or-older.deb.
- `releases/1.6.3-artifacts.json`: source commit, original/staged paths,
  hashes, metadata and provenance. Acceptance is null; published is false.
- `releases/1.6.3.md`: prepared release notes and both checksums.
- `VERIFY.md`: fresh typecheck/build/Node checks and archive inspection.
  Logs are `/tmp/lighttranslator-1.6.3-*.log`; extraction is in
  `/tmp/lighttranslator-1.6.3-inspect/`.

## Tried and rejected

Do not use a native Ubuntu 24.04 Tauri release build: its GLIBC floor would
break Ubuntu 22.04 compatibility. The requested package used the existing
Ubuntu 22.04.5 Docker builder; Rust release compilation took 5m08s.
Electron packages the same production bundle directly with electron-builder,
avoiding a concurrent rebuild of dist while Tauri embeds it. Installed
Electron 39.8.10, electron-builder 26.15.3 and TypeScript 5.8.3 match the lockfile.

For clipping, measuring the body alone and scrollbar-gutter were insufficient;
hidden scroll-container clones reserve the real scrollbar. Current Chromium
geometry QA uses a resizable fixture because native fixed bounds remain M5.

## Warnings

Do not push or publish before installed acceptance. Do not force-push or rewrite
published tags. Never change accepted package bytes without another test.
No GitHub draft/tag was created during preparation. The existing never_push
configuration remains; the user's explicit conditional request is the exception.

Both packages include the reviewed GNOME helper version 2; a new login may be
needed to load it. Physical multi-monitor/helper checks remain unaccepted.
Native Electron automatic sizing and direct pending-text integration checks
remain M5-M6; renderer tests do not establish those acceptance claims.

Existing Browserslist, Tauri bundle-marker and Electron desktopName notices
were non-failing. Cargo needs /home/wsh/.cargo/bin on PATH for host checks.
AGENTS.md/CLAUDE.md and unrelated worktrees were not changed. Preserve the staged
release files while awaiting the user's test; no need to keep build containers
or launch development apps.
