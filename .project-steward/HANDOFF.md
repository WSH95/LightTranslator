---
updated_at: 2026-10-04T02:32:54Z
updated_by: codex
session_status: closed
branch: main
last_commit: "a903335 docs(release): record installed acceptance for 1.6.3 (v1.6.3)"
---
# Handoff

## Now

Version 1.6.3 is published as the Latest public GitHub release:
https://github.com/WSH95/LightTranslator/releases/tag/v1.6.3. The user accepted
the revised installed Tauri package on October 3, 2026; GNOME reports helper
v3 ACTIVE. Main and annotated v1.6.3 were pushed under the user's satisfied
conditional authorization. The tag resolves to a903335; app source matches
reviewed b15ade1 apart from stewardship records. Both downloaded Debian assets
match the accepted original/staged files, sizes and SHA-256. No rebuild occurred.

## In flight

No app source or release work remains. This closing checkpoint records the
publication and verification; only stewardship files changed. T1-T4/B1-B4 and
the approved stacking plan are complete. The feature branch is merged/deleted
and its managed worktree recoverably archived. No build/test app or Vite server
is running. Unrelated worktrees and AGENTS.md/CLAUDE.md were left alone.

## Next steps

1. Use the Latest release URL above for installation; no further publication
   approval or package rebuild is needed for v1.6.3. Keep the tag/assets intact.
2. M4: test moving/resizing across physical monitors with loaded helper v3;
   installed acceptance did not establish multi-monitor coverage.
3. M5: investigate native Electron fixed 360x200 bounds on GNOME/X11/XWayland.
   Its resizable Chromium fixture passes geometry; native installed acceptance
   and non-resizable automatic sizing remain separate.
4. M6: add direct pending-text close-before-ready and reopening integration
   cases. M7: investigate concurrent WebKit fixture resize acknowledgement
   using the first-run stale bounds and unchanged isolated rerun evidence.
5. Preserve the explicit user-approval rule for future pushes/releases. This
   session's authorization covers v1.6.3, not unrelated future publication.

## Blockers

None for this release. M4-M7 are separate backlog tasks.

## Key files

- releases/1.6.3-artifacts.json: accepted source b15ade1, installed acceptance,
  publication/tag metadata, package hashes/sizes, public asset IDs and URLs.
- releases/1.6.3.md: exact published notes.
- tmp/release-1.6.3/: accepted Debian assets and public-verification.json.
- VERIFY.md and plans/2026-10-02-quick-always-on-top.md: completed evidence/plan.
- /tmp/lighttranslator-release-1.6.3-verification/: GitHub metadata, downloaded
  packages and round-trip verification report.
- tmp/quick-always-on-top-execution/: preserved implementation ledger/review.

## Tried and rejected

GTK's above flag alone was advisory on Wayland; helper v3 applies make_above
when matching windows map and when existing windows attach. Existing windows
are not moved or refocused. Both backends reassert above before Move state
confirmation, with stale/failure guards. Installers refresh stale user copies
and preserve newer copies and disabled preferences.

The first concurrent WebKit fixture saw stale native resize bounds; an isolated
rerun passed 67/67 unchanged. M7 records this without claiming a timing fix.

## Warnings

The released tag is a903335; later main commits may store closing records only.
Never rewrite the published tag/history or replace accepted assets silently.
Tauri was built in jammy with GLIBC_2.34; a host Ubuntu 24.04 rebuild would raise
the compatibility floor. The earlier c1cd94b packages are superseded. Native
Electron fixed sizing remains M5. Physical multi-monitor coverage is pending.
Both original/staged packages and public downloads retain these SHA-256:
Tauri c974b82b92690e89a5aca35a21c8f8b407fa888ed51fb518218785322136e9d7;
Electron 13865ee04be75d3b91fc416f2004c462eece23c5412b85300773f169ed627f55.
