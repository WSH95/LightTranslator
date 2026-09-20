# LightTranslator

LightTranslator is a high-performance, lightweight translation tool built with **Tauri**, **React**, and **Vite**. It supports multiple advanced translation engines (LLMs and traditional), OCR capabilities, and prioritizes user privacy with a minimal resource footprint.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20(X11%20%7C%20Wayland)-lightgrey.svg)
![Framework](https://img.shields.io/badge/framework-Tauri%202-24C8DB.svg)

## Key Features

*   **Multi-Engine Support**:
    *   **OpenAI Compatible**: one interface for any endpoint that serves
        `/chat/completions` — OpenAI, Google Gemini (via its OpenAI-compatible
        endpoint), OpenRouter, DeepSeek, or a local Ollama / llama.cpp / LM Studio
        server. One-click presets fill in the base URL and a sample model, and
        local servers that need no API key are supported.
    *   **DeepL**: Professional-grade translation.
    *   **Microsoft Translator**: Azure Cognitive Services.
    *   **Google Translate** (Default): no API key required.
*   **Ultra Lightweight**: Powered by Tauri 2 (Rust) for minimal memory usage and instant startup.
*   **Quick Translate**: Global hotkey (Ctrl+Shift+X) for instant translation of selected text, with its own language pair independent of the main panel.
*   **Silent Autostart**: Supports starting silently in the background (`--hidden` flag).
*   **System Tray**: Minimize to tray for quick access.
*   **OCR & Screenshot Translation**: Screenshot + Tesseract OCR integration. OCR components are **optional and installed on demand** — when you first use OCR, the app detects what is missing and shows the exact install command for your system.
*   **Proxy Support**: HTTP, HTTPS, and SOCKS5 proxy configuration (with authentication).
*   **Security Practices**:
    *   **No Hardcoded Secrets**: API keys are entered in Settings and stored locally in the app's WebView storage (localStorage, unencrypted — OS-keyring storage is on the roadmap). Nothing is sent anywhere except to the provider you selected.
    *   **Secret Scanning**: A pre-build check fails the build if key-shaped strings appear in the source.
    *   **Strict CSP** and a minimal Tauri permission set.

> **Platform support**: Linux (`.deb` and AppImage bundles). Two interchangeable builds share the same UI and features — **Tauri** for Ubuntu 22.04+/Debian 12+ and **Electron** for Ubuntu 18.04–20.04; see [Which build for which system](#which-build-for-which-system). Quick Translate works in both X11 and Wayland sessions (see [Quick Translate Shortcut](#quick-translate-shortcut) for how Wayland differs). Screenshot OCR still uses `gnome-screenshot`. Windows/macOS bundles are not currently configured or tested.

> **Google Translate availability**: the no-key option uses Google web
> endpoints with an automatic same-provider fallback, not the supported Google
> Cloud Translation API. It requires no account, but either endpoint may be
> throttled or changed without notice.

## Installation

### Prerequisites
*   Node.js (v18 or higher)
*   Rust & Cargo (for building the Tauri backend)
*   Tauri CLI: `cargo install tauri-cli --version "^2"` (the `app:*` npm scripts call `cargo tauri`)
*   System dependencies for Tauri on Linux: WebKitGTK 4.1 (`libwebkit2gtk-4.1-dev` on Ubuntu 22.04+/Debian 12+) and GTK3 dev packages. **On Ubuntu 20.04 or older these do not exist** — build the [Electron package](#building-the-electron-package-ubuntu-1804-2004) instead, which needs no system WebKit at all.
*   Runtime (Linux): `xdotool` for selected-text capture in X11 sessions (a `.deb` dependency of both builds); the Electron build additionally depends on `libglib2.0-bin` for the `gsettings` command it uses to register the GNOME shortcut. Tesseract OCR and `gnome-screenshot` are optional — the app guides you through installing them when you first use OCR.

### Getting Started

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/WSH95/LightTranslator.git
    cd LightTranslator
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run in Development Mode**
    ```bash
    npm run app:dev
    ```

### Building for Production

To create a distributable application:

```bash
# Build for current platform
npm run app:build

# Build for Linux specifically
npm run app:build:linux
```

The build artifacts (AppImage, Deb) will be generated in `src-tauri/target/release/bundle/`.

### Which build for which system

The React interface and every feature are shared between both builds — only the backend differs, so the app looks and behaves the same either way.

**Just want to install it?** Grab a `.deb` from the [latest release](https://github.com/WSH95/LightTranslator/releases/latest) — check your version first with `lsb_release -rs`:

| Your Ubuntu | Download |
| --- | --- |
| 22.04, 24.04 or newer (also Debian 12+) | `LightTranslator-<version>-amd64-ubuntu22.04-or-newer.deb` |
| 20.04, 18.04 or older | `LightTranslator-<version>-amd64-ubuntu20.04-or-older.deb` |

```bash
sudo apt install ./LightTranslator-<version>-amd64-<your-choice>.deb
```

The two packages deliberately conflict — remove one before installing the other. Installing the 22.04+ package on 20.04 fails with an unmet `libwebkit2gtk-4.1-0` dependency; that is the wrong file, not a broken package.

To build from source instead:

| Your system | Build | Why |
| --- | --- | --- |
| Ubuntu 22.04+, Debian 12+ | **Tauri** (`npm run app:build`) | ~5 MB package, ~60 MB RAM |
| Ubuntu 18.04–20.04 | **Electron** (`npm run electron:build:deb`) | Tauri 2 needs webkit2gtk-4.1/libsoup3, which these releases cannot provide; Electron bundles its own Chromium and officially supports 18.04+ |
| Old host, want the Tauri package | Docker (`npm run app:docker:build`) | Builds the Tauri artifact for newer machines without needing a newer machine |

Note: the two builds store settings separately, so API keys entered in one do not appear in the other, and only one should run at a time (both register `Ctrl+Shift+X`).

### Building the Electron package (Ubuntu 18.04–20.04)

```bash
npm install
npm run electron:build:deb     # -> dist-electron/LightTranslator_<version>_amd64.deb
sudo apt install ./dist-electron/LightTranslator_*.deb
```

Use `apt install`, not `dpkg -i`, so the `xdotool` dependency is resolved for you.

Development: `npm run electron:dev` (Vite HMR + Electron). If Electron's binary download is blocked or slow, point it at a mirror, e.g.:

```bash
export ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/binary/electron-builder-binaries/
```

### Building the Tauri package on an old distribution (Docker)

Tauri 2 requires **webkit2gtk-4.1** and **libsoup3**, absent from Ubuntu 20.04 and older with no candidate in any repository or backport — and a `.deb` compiled on 22.04 additionally needs `GLIBC_2.32`–`2.34` against 20.04's 2.31. So a Tauri build cannot be produced or run there natively; this container produces the artifact for newer machines, and can also run it locally on your X display if you want to test it.

```bash
npm run app:docker:build    # build the .deb in a jammy container (~8 min first time)
npm run app:docker          # optional: run that build on your desktop
npm run app:docker:update   # after changing code: rebuild + relaunch (~2 min)
npm run app:docker:stop
npm run app:docker:dev      # live dev loop: Vite HMR + incremental Rust builds
```

Notes:
*   Running the container app requires an **X11** session (`echo $XDG_SESSION_TYPE` → `x11`).
*   Settings persist in the `lighttranslator-data` Docker volume, so updates never lose them.
*   Updating never rebuilds the container image — the `.deb` is mounted and installed at start (see `docker/README.md`).
*   `WITH_OCR=0 npm run app:docker` builds a slimmer image without Tesseract; the app then shows its on-demand OCR install guidance.

### Development checks

```bash
npm run typecheck   # TypeScript, no emit
npm run build       # secret scan + tsc + vite build
cargo check         # in src-tauri/ — Rust backend
```

There is no automated test suite yet.

## Configuration

### Setting Up API Keys
Google Translate is the default and needs no key at all. To use an LLM instead:

1.  Launch the application.
2.  Click the **Settings** (gear icon) in the title bar.
3.  On the **Translation** tab, pick **OpenAI Compatible**.
4.  Click a preset (OpenAI, Gemini, OpenRouter, DeepSeek, Ollama) to fill the
    **Base URL** and a sample **Model Name**, then enter your **API Key**.
    Leave the key empty for a local server that does not require one.

Translating a pasted image needs a vision-capable model (for example
`gpt-4o-mini`, `gemini-3-flash-preview`, or `qwen2.5vl`).

### Quick Translate Shortcut
The default shortcut is `Ctrl+Shift+X`; you can change it in Settings. Select
text anywhere, press it, and the popup opens with the translation.

How the key is registered depends on the session, which Settings shows under the
shortcut:

*   **X11**: the app grabs the key itself, and the popup opens at the mouse
    pointer. Selected text is captured with `xdotool`.
*   **Wayland on GNOME**: applications may not grab keys, so the app registers a
    GNOME custom shortcut (visible under *Settings → Keyboard → View and
    Customize Shortcuts → Custom Shortcuts*) that runs
    `lighttranslator --quick-translate`. Selected text comes from the PRIMARY
    selection, so nothing touches your clipboard. The shortcut does not fire on
    the lock screen or while the Activities overview is open.
*   **Wayland on other desktops**: Settings shows the command to bind in your own
    keyboard settings.

To place the popup at the mouse pointer under Wayland — which applications
themselves are not allowed to do — the package ships a small GNOME Shell
extension, `LightTranslator Quick Translate`. It is installed with the app and
enabled on first run; **GNOME only picks up new extensions when the shell
starts, so it becomes active after your next log in**. Without it the popup
still opens, wherever GNOME decides to put it. Turning it off in the Extensions
app is respected — the app will not switch it back on.

To remove what the app registered on your system:

```bash
# the GNOME shortcut entry
gsettings reset-recursively "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/lighttranslator/"
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "[]"
# the placement extension (if a per-user copy was written)
gnome-extensions disable lighttranslator@lighttranslator.app
rm -rf ~/.local/share/gnome-shell/extensions/lighttranslator@lighttranslator.app
```

### OCR Components (installed on demand)
OCR is not required at install time. The first time you use the screenshot/OCR feature, the app checks for Tesseract (and the language data for Chinese/English/Japanese/Korean) and `gnome-screenshot`; if anything is missing it shows a popup with the exact install command for your distribution (apt/dnf/pacman/zypper). Install, click **Re-check**, and continue. If only some language packs are installed, OCR simply runs with the available ones.

## Project Structure

```
LightTranslator/
├── src-tauri/          # Tauri backend (Rust)
│   ├── src/            # Rust source code
│   └── tauri.conf.json # Tauri configuration
├── src/lib/            # Platform abstraction layer
├── components/         # React UI components
├── services/           # API integration layers
├── store/              # State management (Zustand)
├── hooks/              # Custom React hooks
└── utils/              # Utility functions
```

## Branches

| Branch | Description |
|--------|-------------|
| `main` | Tauri-only version (recommended) |
| `lighttranslator-tauri-electron` | Legacy version with Electron support |

## License

MIT License - see the [LICENSE](LICENSE) file for details.
