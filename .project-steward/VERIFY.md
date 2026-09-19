# Verification

How to check the project is healthy. Agents run these before claiming
"validated" in HANDOFF.md.

| Check | Command | Expected |
| --- | --- | --- |
| Build | `npm run build` | exits 0 |
| Tests | `TODO` | all pass |
| Lint | `npm run typecheck` | clean (also proves backend surface parity) |
| Unit | `node --test utils/shortcutUtils.test.ts electron/gnomeShortcut.test.js` | all pass (pass files, not directories: `node --test <dir>` executes non-test files too) |
| Rust unit | `cargo test` (in `src-tauri/`) | all pass |
| Rust | `cargo check` (in `src-tauri/`) | clean |
| Electron | `npm run electron:build:deb` | produces `dist-electron/*.deb` |
| Lockfile | `npm ci` | resolves without lock/manifest mismatch |

Last verified: 2026-09-19T23:50Z — `npm run typecheck`, `npm run build`,
`node --check electron/main.js`, 15 JS/TS unit tests
(`node --test utils/shortcutUtils.test.ts electron/gnomeShortcut.test.js`),
`cargo check --all-targets` and `cargo test` (4/4) all pass, and a release
`.deb` builds (`LightTranslator_1.2.2_amd64.deb`, sha256
ec576c91b2ec1d93b971918fe8753cd5bbc6169269e88b6502c57883f98ace42) carrying the
GNOME extension under `/usr/share/gnome-shell/extensions/`.

Quick Translate was exercised on a real GNOME 46 machine, both session types:

- Wayland (Electron and Tauri): text selected in a Wayland-native GTK app came
  back translated in the popup; the GNOME custom shortcut entry was written with
  the right name, command and binding; a second instance delivered
  `--quick-translate` in 0.18s (Tauri) and ~1.4s (Electron, full Chromium
  start); a plain second launch focused the running app instead of duplicating
  it; the placement extension installed and enabled itself and was correctly
  reported as pending until the next login.
- X11 (forced via `XDG_SESSION_TYPE=x11`, release build): the app grabbed the
  key itself, wrote no GNOME entry, and a real Ctrl+Shift+X press with text
  selected opened the popup **at the pointer** showing 早上好，我的朋友。
- Independent check of the premise: a selection made in a Wayland-native app is
  readable from an X11 client, i.e. mutter bridges PRIMARY regardless of focus.
- UI at 480x680, at the 400x500 minimum and maximized, in both Chromium and
  WebKitGTK: the OCR dialog stays inside the window with a scrolling body, and
  corners are rounded when windowed, square when maximized.

Not yet done: the user pressing the hotkey in their own Wayland session after
installing the package and logging back in (the extension needs that login), and
a full pass in a real "Ubuntu on Xorg" session. No committed automated test
suite beyond the unit tests named above.

## Backend parity checklist

The app ships two backends — Tauri (`src-tauri/src/lib.rs`, Ubuntu 22.04+) and
Electron (`electron/main.js`, Ubuntu 18.04-20.04). The React UI is shared, so
the interface cannot drift; **behavior can**. Run this list against BOTH builds
before a release, and after any backend change.

Surface parity is already machine-checked: `PlatformBackend` in
`src/lib/platform.ts` is derived from the Tauri backend, so a missing or
mistyped Electron method fails `npm run typecheck`.

| # | Behavior | Expected in both builds |
| --- | --- | --- |
| 1 | Launch | No translation fires on startup; nothing reads the clipboard until the hotkey |
| 2 | Hotkey with text selected | X11: popup at the cursor, clamped to that monitor, showing the translation. Wayland: same translation; the popup is at the pointer once the GNOME placement extension is active, otherwise wherever GNOME puts it |
| 3 | Hotkey with nothing selected | X11: previous clipboard content is restored, not silently translated as if fresh. Wayland: the most recent selection (PRIMARY) is translated, and the clipboard is never written |
| 4 | Hotkey within ~1s of launch | Text still arrives (pending-text handshake) |
| 5 | Repeated hotkey presses (5×) | App stays alive; one popup, one translation each |
| 6 | Quick-window language | Uses `quickSourceLang`/`quickTargetLang`, independent of the main panel |
| 7 | Settings sync | Changing a language in the popup shows in main Settings, and vice versa |
| 8 | Shortcut change | Invalid accelerator → error, old shortcut still works; valid → takes effect. On Wayland the GNOME entry's `binding` follows, and a key GNOME cannot express is refused with the old one intact |
| 9 | Restart | Custom shortcut and proxy settings are restored |
| 10 | Tray | Exactly one icon; Show / Settings / OCR Screenshot / Quit all work; Quit exits cleanly |
| 11 | OCR with tesseract absent | Guidance popup with the correct distro command; Re-check proceeds after install |
| 12 | OCR with some language packs | Runs with the installed subset instead of failing |
| 13 | OCR result | Paragraphs preserved (shared `cleanTextLineBreaks`), not flattened to one line |
| 14 | Screen capture | Main window hides during area selection, reappears after |
| 15 | Proxy with auth | Requests succeed through an authenticated proxy |
| 16 | Provider errors | Real cause shown (not a generic/CORS/IP guess). If both Google endpoints fail, the message names each endpoint's HTTP/transport result and suggests retrying or another engine |
| 17 | Editing settings | Typing an API key does not fire translations |
| 18 | Package metadata | Electron depends on `xdotool`; Tauri also carries generated GTK/WebKit/AppIndicator dependencies. OCR packages are under `Recommends`; both builds emit `LightTranslator_<version>_amd64.deb`, and Electron's package conflict prevents coexistence with Tauri |
| 19 | Google endpoint recovery | No app restart needed. Both builds POST source text to the structured Chrome endpoint first, then try GTX once after any HTTP/transport/malformed-response failure; no text appears in request URLs |
| 20 | Transport recovery | Electron heals/retries only idempotent GET/HEAD transport failures; HTTP statuses are returned to provider logic. POST transport failures heal without retry. Tauri uses a fresh reqwest client and returns every HTTP status directly |
| 21 | Translation request count | Clipboard/tray OCR uses the debounced path when auto-translate is on and one immediate request when off; Ctrl+Enter cancels its pending debounce; pasted-image results do not trigger a second text translation |
| 22 | Session switch | X11 start removes the GNOME entry and grabs the key itself (retried, since gnome-shell ungrabs asynchronously); Wayland start recreates the entry with the current executable path. Settings names the mechanism in use |
| 23 | GNOME entry hygiene | Only our own dconf path (`…/custom-keybindings/lighttranslator/`, `-dev` for dev builds) is added or removed; entries the user created keep their order and values |
| 24 | Single instance | A second launch focuses the running app instead of starting another tray icon; `--quick-translate` triggers the popup; with no instance running it starts hidden and still shows the popup once |
| 25 | Placement extension | Installed by the package and enabled once on first run; Settings reports active / pending log-out. Disabling it by hand is respected across restarts |
| 26 | Window chrome | Corners are rounded while windowed and square while maximized; neither modal paints square corners over them |
| 27 | OCR dialog fit | At 480x680 with tesseract absent the dialog stays inside the window with a scrolling body; also at the 400x500 minimum |
