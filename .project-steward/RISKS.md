# Risks

Known risks and mitigations. Review at wrap-up when something changed.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| API keys + proxy credentials persist in plaintext localStorage (webview) | high | high | Backlog: OS keyring/stronghold; README no longer overclaims "secure storage" (S9) |
| `proxy_request` remains a broad fetch primitive for the webview (any http/https URL) | medium | high | S1 scheme check + S6 strict CSP shrink the attack path; full allowlist deferred (breaks custom `openaiBaseUrl`/local LLMs) |
| Selection capture silently dead on Wayland sessions | high | medium | S1 adds detection + one-time user warning; real support is backlog |
| Simulated Ctrl+C destroys user clipboard; stale clipboard translated when nothing selected | medium | medium | Backlog C12 (save/restore design) |
| /tmp PNG TOCTOU + leak in screenshot/OCR path | low | medium | Backlog C13 (tempfile Builder suffix, cleanup on all paths) |
| No single-instance guard while autostart is enabled | medium | low | Backlog C4 (tauri-plugin-single-instance) |
| Residual ms-scale cross-window settings write race after S3 sync | low | low | Accepted; event-driven rehydrate self-heals on next change |
| Electron `closeAllConnections()` aborts every in-flight default-session request, so a concurrent POST can fail once when GET transport healing fires | low | low | HTTP statuses no longer heal; transport-only healing keeps the 10s cooldown. Documented in DECISIONS 0011 |
| Both no-key Google web endpoints are unofficial and may throttle or change together | medium | medium | Structured Chrome endpoint is primary, GTX is one fallback; if both fail the UI names both results and recommends another configured engine. Official Cloud API remains an opt-in future feature |
| Electron HTTP cache from v1.2.1 and older may contain provider GET URLs with translated text or credentials | high until upgrade | high | v1.2.2 clears the disposable HTTP cache at startup; both backends mark provider traffic no-store and Google text moved to POST bodies |
| Development/build dependency tree has 11 npm advisories (1 low, 10 high), including Electron's installer dependency and Vite-era tooling | low for trusted local builds | medium | `npm audit --omit=dev` is clean. Keep dev server localhost-only, build trusted inputs, and triage safe tool upgrades separately; Electron 44 is a major compatibility decision, not part of the focused v1.2.2 patch |
