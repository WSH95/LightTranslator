---
updated_at: 2026-08-26T06:57:19Z
updated_by: cli
session_status: active
branch: fix/google-free-endpoint-failover
last_commit: 8daafd0
---
# Handoff

Written for a zero-context successor (another agent, another tool, another
device). Keep every section current at wrap-up.

## Now

The v1.2.2 Google no-key endpoint fix is implemented and verified on
`fix/google-free-endpoint-failover`. Commit `8daafd0` is pushed, and
[PR #4](https://github.com/WSH95/LightTranslator/pull/4) is open against
`main`. No tag or release has been published.

The previous v1.2.1 diagnosis was too strong. Through the same configured proxy,
GTX returned HTTP 429 for GET and POST while `clients5.google.com` with
`client=dict-chrome-ex` returned HTTP 200. Changing the Google proxy route also
did not resolve GTX. Decision 0011 supersedes the old IP/socket claim without
pretending Google's internal classifier is known.

Implemented state:

- Google source text is form-encoded in POST bodies, never request URLs.
- The structured Chrome Dictionary endpoint is primary; GTX is tried exactly
  once after a primary HTTP, transport, malformed, or empty-response failure.
- Dual failure messages name both endpoint results and make no IP/proxy claim.
- Electron no longer treats HTTP 429 as a transport fault, bypasses response
  caching, and clears its legacy HTTP cache at startup. Tauri adds `no-store`.
- Clipboard, tray OCR, Ctrl+Enter, and pasted-image paths avoid duplicate
  translations, including the same-text/pending-debounce edge case.
- Version metadata is synchronized at 1.2.2 and both local Debian packages are
  built.

## In flight

- PR #4 is awaiting the user's manual GitHub merge. After it merges, update
  local `main` before creating the v1.2.2 tag and release from that merged
  commit.
- Local build artifacts (ignored by git):
  - Electron / Ubuntu 18.04–20.04:
    `dist-electron/LightTranslator_1.2.2_amd64.deb`
  - Tauri / Ubuntu 22.04+/Debian 12+:
    `src-tauri/target/release/bundle/deb/LightTranslator_1.2.2_amd64.deb`

## Validation completed

- `npm ci`, `npm run typecheck`, `npm run build`, and
  `node --check electron/main.js` pass.
- Five deterministic Google probes pass: primary structured parsing, 429
  fallback, malformed-response fallback, long UTF-8 POST/no-text-in-URL, and
  truthful dual-failure reporting with exactly two attempts.
- An isolated dev Electron instance completed 10/10 live translations through
  the user's configured proxy at normal cadence without restart or provider
  error. The same route returned GTX 429 during the diagnosis.
- `npm run electron:build:deb` and `npm run app:docker:build` pass. Both package
  manifests report version 1.2.2, architecture amd64, and the intended runtime
  dependency split.
- Final SHA-256:
  - Electron: `67af2815b8041348a196035d61ab0f1740f620645c10358f535752969656a63c`
  - Tauri: `b6b06cb9c2c77859a4d23e7398c1c5a7e09468a8394704679b4171b6971c0c90`

## Next steps

1. Wait for the user to merge PR #4 in GitHub.
2. Fetch, switch to local `main`, and fast-forward it to `origin/main`; verify
   that the merged tree contains version 1.2.2.
3. Create/update the v1.2.2 GitHub release from the merged `main` commit and
   upload both checksum-verified Debian packages. Do not publish from the topic
   branch.
4. Install the package appropriate for the target Ubuntu version and perform a
   longer real-workload Google soak, including clipboard, hotkey, OCR, and
   Ctrl+Enter paths.
5. Separately triage the existing development/build dependency advisories; do
   not mix a major Electron/toolchain migration into this patch.

## Blockers

- PR #4 must be merged manually before local `main`, the v1.2.2 tag, or the
  release can be finalized.

## Warnings

- Both Google endpoints are unofficial and can still throttle or change
  together. The supported Google Cloud API remains a future opt-in design.
- `npm audit --omit=dev` reports zero production-dependency vulnerabilities;
  the full development/build tree reports 11 advisories (1 low, 10 high),
  including Electron's downloader dependency and Vite-era tooling. This is
  recorded in RISKS.md and was not auto-fixed in the focused patch.
- Tauri packaging emits existing warnings about the `.app` bundle identifier
  and missing `__TAURI_BUNDLE_TYPE`; the Debian bundle still completes.
- This Ubuntu 20.04 host cannot run the Tauri build natively; its Rust release
  compilation and Debian bundling were completed in the repository's Ubuntu
  22.04 Docker builder.
