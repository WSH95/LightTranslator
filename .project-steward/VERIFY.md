# Verification

How to check the project is healthy. Agents run these before claiming
"validated" in HANDOFF.md.

Last verified on merged `main` at `b6bee54` on 2026-09-20T14:51:16Z:
`npm run typecheck`, `npm run build`, the five-file Node test command, both
Electron syntax checks, `cargo check --all-targets` and `cargo test` all exited
0. Rust ran 5 tests with no failures. The dconf read-only warning in the Rust
test sandbox did not fail the guarded schema test.

The release-preparation rerun also passed the HANDOFF.md PyYAML parse,
typecheck, the five-file Node test command, both Electron syntax checks,
`cargo check --all-targets`, Rust 5/5 and byte-for-byte comparison of both
renamed upload assets with their source packages. `npm run electron:build:deb`
included a fresh production build.

The user installed and tested the final 1.6.2 Tauri package in the original
Wayland problem environment and reported no problems. This is the packaged
physical-input acceptance for the reported issue. Tauri X11 and Electron did
not receive a manual installation pass in this round.

| Check | Command | Expected |
| --- | --- | --- |
| Build | `npm run build` | exits 0 |
| Tests | `TODO` | all pass |
| Lint | `npm run typecheck` | clean (also proves backend surface parity) |
| Unit | `node --test utils/shortcutUtils.test.ts electron/gnomeShortcut.test.js src/lib/accents.test.ts utils/quickWindowSizing.test.ts store/settingsPersistence.test.ts` | all pass (pass files, not directories: `node --test <dir>` executes non-test files too) |
| Rust unit | `cargo test` (in `src-tauri/`) | all pass. `interface_schema_reads_are_guarded` is the canary for `get_system_appearance`: reading a key a schema does not declare **aborts the process**, so a regression takes the whole runner down rather than failing a assertion |
| Rust | `cargo check` (in `src-tauri/`) | clean |
| Electron | `npm run electron:build:deb` | produces `dist-electron/*.deb` |
| Tauri release .deb | `npm run app:docker:build` | produces `src-tauri/target/release/bundle/deb/*.deb` in a jammy container. **Never ship a natively-built one** — on a 24.04 host it requires GLIBC_2.39 and cannot start on Ubuntu 22.04 (DECISIONS 0017). Needs `docker`, or rootless `podman` + `podman-docker`, which runs the script unchanged |
| Release artifact glibc floor | `objdump -T usr/bin/lighttranslator \| grep -oP 'GLIBC_\K[0-9.]+' \| sort -V \| tail -1` | `2.34` or lower (Ubuntu 22.04 ships 2.35) |
| Lockfile | `npm ci` | resolves without lock/manifest mismatch |

**Backend parity — `get_system_appearance`.** Reads `org.gnome.desktop.interface`
and returns the raw `color-scheme`, `accent-color` and `gtk-theme` strings; the
name-to-hex mapping is frontend policy in `src/lib/accents.ts`. Tauri:
`src-tauri/src/lib.rs`, guarded by `gnome_shortcut::schema_installed()` **and**
`SettingsSchema::has_key` — `accent-color` does not exist before GNOME 47 and an
unguarded read aborts. Electron: `electron/main.js` via `execFile('gsettings')`,
exposed in `electron/preload.cjs`. `npm run typecheck` proves the Electron side
implements it, because `PlatformBackend` is derived from the Tauri object.

**Automatic quick-pop-up sizing source verification (1.6.2, 2026-09-20).**
Automated/source checks are green:

- `npm run typecheck`; `npm run build`; `node --check electron/main.js` and
  `node --check electron/preload.cjs` all exit 0.
- The five-file Node command above exits 0. Direct focused runs expose 7/7
  sizing/coordinator cases and 7/7 settings migration/persistence cases. The
  coordinator coverage includes coalescing, sequential IPC, latest-pending
  sizing, unchanged-size suppression and disposal during queued/in-flight work.
- The settings suite uses actual Zustand v5 persistence over counted storage.
  An unversioned `{ quickWindowWidth: 455 }` hydrates to the new field and
  writes one version-1 canonical snapshot; other stored settings survive. The
  same-state cleanup adds no subscriber notification, and a new store instance
  over the canonical blob performs zero writes.
- Browser restart QA seeded the same unversioned legacy width: hydration saved
  `{ version: 1, maximum: 455, hasLegacy: false }`; restarting the renderer
  without reseeding retained 455 and started zero translation requests.
- `cargo check --all-targets` exits 0; `cargo test` passes 5/5. The shared
  target directory was reused only for development validation.
- Browser Settings QA: Maximum width starts at 480, accepts 300, Reset restores
  480 and disables itself. Cross-window max-width changes resize the fixture
  without starting another translation request.
- Final-review accessibility check: the later
  `input[type="range"]:focus { outline: none; }` suppression was removed, so the
  shared `:focus-visible` outline now applies to Maximum width. Typecheck,
  the production build and browser Tab/arrow-key verification pass.
- Browser menu/font QA: short English content measured 203x111; opening the
  language menu grew it to 236x250 around a measured 220x196 menu, fully inside
  the window, and closing restored 203x111. Medium/large/small text changed
  348x111 → 411x116 → 306x108. Translation request counts did not change.

Independent task review and whole-branch review passed after two fixes:
canonical persistence immediately after unversioned hydration, and restoring
visible keyboard focus on range controls. No blocking source findings remain.
A duplicate `focus-lost` hide log after an explicit hide is deferred as Minor:
the original reason remains recorded and hiding twice is idempotent.

Browser keyboard QA verified Tab focuses Maximum width with a visible 2px
accent outline and 2px offset; Right changes 480 to 481; Tab/Enter on Reset
restores 480 and disables Reset. The legacy-restart fixture also rendered long
content at its restored 455px cap (455x500), without retranslation on restart.

Toolkit/native-adapter evidence, still short of packaged acceptance:

- With `resizable=false`, a standalone GTK3 probe produced the exact requested
  480x160, 240x80, 600x500 and 260x100 sizes on both `GdkWaylandDisplay` and
  `GdkX11Display` when `set_size_request` precedes `resize`. The same sequence
  passed on Wayland with a real WebKit2.WebView child.
- A real GTK/WebKit integration fixture exercising the current renderer passed
  on Wayland, X11 and Wayland with `GDK_SCALE=2` (the same logical dimensions).
  Its nine cases include short 279x110, medium 348x110, long 480x500; 300 and 600
  caps applied without extra translation requests; short-after-long returned
  to 279x110; explicit newlines remained and measured 279x158; CJK reached
  600x500; a long URL wrapped at 600x278 with no horizontal overflow. The
  native window remained non-resizable.
- Screen-edge toolkit probes on Mutter/X11 started non-resizable 240x100
  windows at 1680,980 in work area 0,32,1920,1048, then requested 600x500.
  GTK and Electron both ended at 1320,580 with the requested size, fully
  inside the work area and still non-resizable. The compositor already handles
  post-growth clamping, so no client-side repositioning path was added.

The final jammy rebuild after both review fixes produced
`src-tauri/target/release/bundle/deb/LightTranslator_1.6.2_amd64.deb`,
6,041,218 bytes, SHA-256 `8097cd8d1537b3dea779cae16f76252aa141dbc7170fae46098f8257508fcc31`.
Package metadata is `light-translator` 1.6.2 amd64. The extracted binary requires
GLIBC_2.34; the desktop entry, icons and GNOME placement extension are included.
The identical artifact is in the original checkout's release bundle directory.
It has not been installed, tagged or published.

`npm run electron:build:deb` produced
`dist-electron/LightTranslator_1.6.2_amd64.deb`, 92,682,104 bytes, SHA-256
`9fc30a64487b4b0f6d28e2891a1f5dcd9bbcfeb4d3871628c9b430e37a7ccd19`.
Package metadata is `lighttranslator` 1.6.2 amd64, with conflicts against the
Tauri package. The archive contains `app.asar`, the desktop entry, icons and the
GNOME placement extension. The build completed after the packager downloaded
its Electron runtime in the authorized network environment.

The build has pre-existing notices about old Browserslist data, the `.app`
bundle identifier suffix, and an unavailable `__TAURI_BUNDLE_TYPE` marker.
These did not prevent the Debian bundle; automatic updater behavior is not
covered by this task.

**Not yet established**: manual packaged Tauri X11 and Electron acceptance of
the complete interaction matrix. The accepted Tauri Wayland package covers the
original click-to-disappear report.

**Release artifact 1.6.1** — `LightTranslator_1.6.1_amd64.deb`, 6048522 bytes,
sha256 `7a582783e313ed1355b2dd72e219817552e468bbe65ed2fbbaf8accd3ab6b62e`.
Jammy container; GLIBC floor **2.34**.

Historical 1.6.1 checks used **Tauri with `GDK_BACKEND=x11`**. They did not
establish native Wayland input behavior; the user's subsequent report means
these observations must not be treated as general closure of the bug:

- Pressing the header, pressing the right edge, and clicking the body all leave
  the pop-up **visible** — as observed in that X11 check only.
- A real focus change (`xdotool windowactivate` on another window) still
  dismisses it, so the suppression does not leak. Note a synthetic *click* on
  another window does not transfer focus here and is not a valid test of this.
- **Escape** closes the pop-up.

**Cannot be verified by automation, and was not**: whether the grabs actually
move and resize the window. Synthetic pointers cannot start a compositor grab.
Two further traps found while testing — the pop-up hides on any focus change
(so a screenshot kills it), and WebKitGTK throttles its hidden webview so HMR
does not reach it reliably. Restart the app rather than trusting HMR there.

**Release artifact 1.6.0** — `LightTranslator_1.6.0_amd64.deb`, 6033208 bytes,
sha256 `3593bcdf21c197d0f323aaeed082b0bd08113c3ccc55b1df611dc09fade1c440`.
Built in the jammy container; GLIBC floor **2.34**, so it starts on Ubuntu
22.04.

Verified natively for 1.6.0 (Electron under `--no-sandbox`, Tauri under
`GDK_BACKEND=x11`):

- **Edge resize works end to end**, proven on the Electron backend because its
  manual `setBounds` path can be driven by a synthetic pointer: east +110 gave
  exactly +110 width; west -50 gave +50 width and -50 x; the SE corner gave
  -60/+40. Tauri's path hands off to the compositor, which a synthetic pointer
  cannot start — the handler firing was confirmed instead by making the handle
  recolour on press.
- **Both engines eat the outermost pixels.** No handler at 2px or 5px inset, a
  handler at 7px. Hence 8px edges. See RISKS.md.
- Pop-up scrolling, the pane hover/focus highlight, the Theme group and glass
  were verified in the browser, where they render identically and measure
  without a focus fight.
- **The size-persistence gate** was proven in the browser: a bare `resize`
  event is not recorded, one preceded by a handle pointerdown is, the flag
  resets afterwards, and Settings > Pop-up > Window's Reset clears it and
  disables itself.

**Not covered**: dragging the pop-up's own edges and Tauri edge resize, both of
which need a human (see RISKS.md), and the 1.6.0 package itself.

**Release artifact 1.5.0** — `LightTranslator_1.5.0_amd64.deb`, 6030312 bytes,
sha256 `85a195b2c9e514d39d2de452323258fb3dee1d199ed477811c1b2908ac045215`.
Built in the jammy container (`npm run app:docker:build`), never natively.
GLIBC floor reads **2.34**, so it starts on Ubuntu 22.04; a native 24.04 build
would have required 2.39 and silently shipped a package that cannot start under
an asset name promising 22.04 (DECISIONS 0017).

Note for whoever builds next: `src-tauri/Cargo.lock` and `src-tauri/gen/` were
left owned by the container's subuid (100999) by an earlier build, so the
version bump could not write the lockfile. Reclaim them without sudo with
`podman unshare chown -R 0:0 <path>` — inside the rootless user namespace the
host user maps to 0.

Last verified: 2026-09-20T11:00Z — Ubuntu/Yaru UI refresh (DECISIONS 0018-0020).
`npm run typecheck`, `npm run build`, `node --check` on both Electron entries,
22 JS/TS unit tests, `cargo check --all-targets`, `cargo test` (5/5) and
`cargo build` (the binary links) all green.

Visual verification was done in the dev server against the design mockup served
side by side, at the design's own window sizes. Geometry was measured rather
than eyeballed: pane width 362 (`(736-12)/2`), swap-button centre y93 against
top rows centred y76, header 47, language popover 341px tall anchored 9px below
its pill, OCR dialog clamped to 488 in a 520px window, pop-up 360x111. Checked
in both themes, all ten accents, all three text sizes, all four settings tabs,
and the pop-up. No console errors.

**Native verification, 2026-09-20 (both backends, real windows).** Tauri via
`npm run app:dev` (note: `cargo` is not on PATH for npm scripts — export
`~/.cargo/bin` first). The window is a native Wayland surface, so nothing
X-based can see it and GNOME's screenshot D-Bus is locked down; a second run
under `GDK_BACKEND=x11` makes it capturable with `import -window <id>` and
drivable with `xdotool`. Confirmed:

- Main window opens at **760x520**; opening Settings resizes it to **760x600**
  and Back restores 760x520.
- **Maximize squares the corners.** At 760x520 the diagonal reads
  (0,0)-(2,2) transparent, (3,3) antialiased edge, (4,4) window background —
  a 12px radius. Maximized to 1920x1048, only (0,0) is the 1px ring and
  (1,1) onward is background.
- **`get_system_appearance` works end to end in BOTH backends.** The host
  reports `gtk-theme='Yaru'` and no `accent-color` key; turning on "Follow
  system accent" repaints the UI in exactly `rgb(233,84,32)` = Yaru Orange,
  in Tauri and in Electron.
- Quick pop-up opens through the real command path
  (`lighttranslator --quick-translate`, forwarded by single-instance) at the
  pinned **360** width with a content-measured height, translates, and shows
  the provider/source caption.
- **"Open in main window"** hands the text to the main window and hides the
  pop-up. (Capturing the pop-up first blur-closes it — click before capturing.)
- Drag-region markup is correct: 3 elements carry `data-tauri-drag-region`
  (header, title, spacer) and the 3 that do not all carry `no-drag`. The drag
  itself could NOT be exercised — a synthetic xdotool pointer cannot start a
  compositor-side interactive move. **Needs a human: drag the window by its
  title.**
- Electron needed `--no-sandbox` to start on this host (`chrome-sandbox` is not
  root-owned setuid); see RISKS.md. The committed script is unchanged.

**Still not covered**: the tray icon in the GNOME panel (not capturable), the
behaviour regression pass, and anything in a packaged `.deb`.

Behavior checked live in the dev server against a mock OpenAI-compatible server
and, for the native `platform.request` transport, through a stub bridge that
performs requests out-of-browser the way Electron's main process does:
- Row 28: seeded a real v0 blob (no `version` field) with `provider: 'gemini'`
  → coerced to `google`, four dead fields dropped, `customSystemInstruction`,
  DeepL/Microsoft keys and the shortcut untouched. Re-seeded with
  `provider: 'openai'` + a DeepSeek config → kept verbatim. The first attempt
  used `version`+`migrate` and silently did nothing; that is DECISIONS 0015.
- Row 29: all five presets verified; one translation produced exactly one
  request with the expected URL, headers and body; trailing-slash base URL OK.
- Row 30: fenced reply containing `{tricky}` braces parsed correctly
  (`你好世界 {tricky}`); `text-only-model` produced `"text-only-model" does not
  accept images. Choose a vision-capable model in Settings …`; pasting on DeepL
  made zero network requests.
- Row 31: a 404 surfaced as `LLM Error: 404 — no route /nope/chat/completions`.
- Google Translate (the default, no-key provider) returned
  "Good morning, my friend." → 早上好，我的朋友。 through the native transport
  against the real endpoints, and an unrecognized provider id degraded to it
  instead of throwing.

Not covered: DeepL and Microsoft were refactored onto the shared `httpJson`
helper but not exercised against live keys; and the packaged Tauri/Electron apps
were not rebuilt (the installed v1.3.0 app was running on the host).
