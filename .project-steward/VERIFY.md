# Verification

How to check the project is healthy. Agents run these before claiming
"validated" in HANDOFF.md.

| Check | Command | Expected |
| --- | --- | --- |
| Build | `npm run build` | exits 0 |
| Tests | `TODO` | all pass |
| Lint | `npm run typecheck` | clean (also proves backend surface parity) |
| Unit | `node --test utils/shortcutUtils.test.ts electron/gnomeShortcut.test.js src/lib/accents.test.ts` | all pass (pass files, not directories: `node --test <dir>` executes non-test files too) |
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
