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
