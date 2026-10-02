# Popup Move verification

Start Vite with `npm run dev -- --host 127.0.0.1 --port 5178 --strictPort`.
Then run `./node_modules/.bin/electron tests/quick-move/electron.cjs` and
`python3 tests/quick-move/webkit.py`. The Python runner needs the host's GTK3
and WebKit2 4.1 introspection bindings. Reports and screenshots go to
`/tmp/lighttranslator-quick-move` (override with `QUICK_MOVE_QA_OUTPUT`).

The real React component, platform adapter and sizing code run in native
renderers, with ephemeral storage and controlled native IPC/HTTP responses.
No credentials, external providers or system clipboard are used. The fixture
checks pending/failed/stale toggle responses, readiness in StrictMode, size
changes, controls and request counts. It does not establish physical compositor
dragging; verify that in the native dev app on Wayland and X11.

The sizing cases assert actual viewport dimensions, scroll overflow and final
glyph bounds for the screenshot's repeated Chinese text, all text sizes and
300/480/600px caps, loading/result transitions and long-to-short shrink. Quick
typography is enabled in the fixture. WebKit reproduces Tao's Wayland GTK
titlebar/box structure; set `QUICK_MOVE_QA_HIDDEN=1` for an invisible mapped view.
Electron maps an invisible, mouse-transparent window and verifies its preload
bridge. It uses a resizable test window because the non-resizable native window
retained initial bounds in this GNOME/X11 environment. Renderer geometry and
native Electron popup resizing acceptance are separate; PLAN M5 tracks the latter.

Pure regressions run with `node electron/quickMove.test.js`,
`node electron/quickPlacement.test.js` and `cargo test quick_move` inside
`src-tauri`. The placement fixture executes the shipped extension methods with
window/monitor objects; it does not start or modify the user's GNOME extension.
