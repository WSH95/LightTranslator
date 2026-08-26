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
| Electron `closeAllConnections()` aborts every in-flight default-session request, so a concurrent LLM POST can fail once when Google 429-heal fires | low | low | Heal only after an actual GET 429 / transport failure + 10s cooldown; app concurrency is low (500ms-debounced typing, single hotkey requests). Documented in DECISIONS 0010 |
| Google flags the whole proxy/VPN exit IP, not just the pooled connection — heal+retry still 429s | medium | medium | Unmasked 429 message tells the user to wait / switch node / change engine; logs distinguish this from the pooled-connection case (429 on the *retry*). Alternate-endpoint fallback is backlog |
