# Automatic pop-up sizing and interaction fix

This is the implementation plan approved in conversation on 2026-09-20. The user selected GPT-5.6-sol with max reasoning for implementation.

## Goal and constraints

Preserve the frameless appearance and click-away dismissal. Remove manual dragging and resizing. Fit short translations to their rendered width; at the configured maximum width, wrap and grow vertically. Default maximum width is 480 logical pixels, adjustable from 300 to 600 pixels. The limit includes the whole frameless window, including padding. Reserve the minimum width required by all toolbar controls. Retain the existing 80–500 pixel automatic height range and scroll longer content.

All new UI copy, code, comments, documentation, logs, and tests must be in English. Tauri and Electron must deliver the same observable behavior. Main-window drag and resize functionality remains intact. Preserve the current hotkey, placement, translation, clipboard, provider, and appearance behavior. Do not edit AGENTS.md or CLAUDE.md. Do not push or publish. The configured commit policy is ask; prepare coherent changes but leave them uncommitted pending review.

## Task 1: Implement and test integrated automatic pop-up sizing

### Requirements

1. Replace the Settings > Pop-up > Window remembered Width row with Maximum width, using the existing slider style, a pixel value, and Reset. Add `quickWindowMaxWidth: number`; the default is 480 and the range is 300–600 logical pixels. Use whole-pixel values. Merge-time migration must handle legacy stored objects without version numbers: the new valid field wins, otherwise preserve a valid legacy `quickWindowWidth` as the new maximum, otherwise use 480. Sanitize out-of-range or invalid input and remove the retired field from persisted data. Settings synchronization must update sizing without triggering another translation.
2. Measure actual rendered text in the active font and text-size setting, including padding. Use intrinsic unwrapped width (respecting explicit line breaks), capped at the configured maximum and floored by measured toolbar requirements. Remove the old native 300px minimum that prevents a short translation from narrowing. Do not estimate by character count and do not derive the desired width from the current viewport width.
3. At the chosen width, measure wrapped content and the header/footer. Respect line breaks, CJK, emoji and unbroken URLs. Retain the existing 80–500px height range, vertical scrolling after 500px, and no horizontal overflow. A short translation after a long one must shrink in both dimensions.
4. Use one layout-and-resize coordinator for loading, empty state, errors, successful translation, font/text-size changes, settings changes, and the language menu. Measure outside the viewport-constrained layout, coalesce changes, avoid feedback loops and overlapping stale IPC requests, and send only changed dimensions. Opening the language menu reserves its required space; closing it restores content sizing. Clean up observers, queued callbacks, and asynchronous work on unmount.
5. Disable user resizing at the native window level in both backends while retaining programmatic size changes. Remove the pop-up header drag region, resize handles, popup-only platform methods, native commands, suppression flags, and obsolete watchdogs. Preserve main-window drag/resize and any shared methods still used there. Confirm programmatic shrink/grow still works for a non-resizable GTK window; investigate rather than re-enabling native edge gestures if GTK needs different size-request handling.
6. Keep one backend owner for focus-loss dismissal. Clicking, selecting/copying text, scrolling, and using the language menu must leave the popup visible. External focus changes, Escape, Close and Open in main window retain their intended behavior. Add opt-in or debug focus/show/hide diagnostics with explicit hide reasons and no translation content. Do not add arbitrary ignore-blur delays.
7. Update Project Steward plan, decisions, progress and verification records in English. Distinguish source/automated evidence from actual native acceptance. Do not claim the click-to-disappear bug fixed until native validation passes.

### Repository context

- React lives at the repository root. Main files: components/QuickTranslateWindow.tsx, components/SettingsView.tsx, components/ui.tsx, store/useAppStore.ts, types.ts, constants.ts, index.css, src/lib/platform.ts.
- Backends: src-tauri/src/lib.rs and src-tauri/tauri.conf.json; electron/main.js and electron/preload.cjs.
- Existing quick-window size requests take `{ width, height }` through `platform.resizeQuickWindow`. Reuse this contract unless concrete evidence requires a change.
- Current quick window is 360x200, native minWidth 300 and maxWidth 600; both backends currently permit user resizing. Tauri's underlying tao 0.34.5 handles edge presses before the renderer, which bypasses the existing drag-suppression flag. Removing only DOM handles does not remove that path.
- The current height fitter reads the viewport width, runs on several uncancelled timers, and separately expands the language menu to 362px. Width is currently persisted after manual gestures.
- Electron's will-move/moved suppression events are documented only for macOS/Windows. They cannot protect Linux moves. The Electron launcher intentionally uses X11/XWayland.
- Earlier VERIFY.md evidence for 1.6.1 used GDK_BACKEND=x11, not native Wayland, and did not establish real-mouse move/resize behavior. Installed package is light-translator 1.6.1 on Ubuntu/GNOME 46 Wayland. The agent shell inherited GDK_BACKEND=x11, so explicit Wayland selection matters for verification.
- Existing user settings use a merge hook because legacy blobs lack a numeric persisted version. Extend that mechanism rather than relying only on Zustand migrate.

### Tests and acceptance

- Add focused behavioral tests for sizing decisions, settings normalization/migration and asynchronous resize ordering. Capture a meaningful failing test before implementing the new behavior; do not create tests that merely search source strings.
- Exercise short/intermediate/long translations, long-to-short transitions, CJK, newlines, emoji, long URLs, minimum/maximum settings, invalid saved values, Reset, restart and cross-window settings synchronization.
- Run `npm run typecheck`, `npm run build`, `node --test utils/shortcutUtils.test.ts electron/gnomeShortcut.test.js src/lib/accents.test.ts` plus new tests, `node --check electron/main.js`, `node --check electron/preload.cjs`, and Cargo checks/tests. Cargo is available through /home/wsh/.cargo/bin even when absent from PATH.
- Native acceptance remains separate: actual Tauri Wayland, Tauri XWayland/X11 and Electron; interior/edge clicks, selection, scrolling, menu, repeated opening, dismissal, scaling and screen-edge placement. Browser-only evidence is insufficient. Parent coordinates native validation and packaging alongside your implementation work.
- Release Tauri packaging must use the Ubuntu 22.04 container workflow (`npm run app:docker:build`), never a native Ubuntu 24.04 build. Do not publish or install system packages yourself.

### Handoff

Write the full implementation report to the path in your dispatch. Include files changed, focused red/green evidence, exact commands/results, self-review findings, and any uncertain native behavior. Report source completion separately from native acceptance. Do not spawn subagents; the controller provides the independent review.
