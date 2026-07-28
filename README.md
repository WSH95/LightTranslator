# LightTranslator

LightTranslator is a high-performance, lightweight translation tool built with **Tauri**, **React**, and **Vite**. It supports multiple advanced translation engines (LLMs and traditional), OCR capabilities, and prioritizes user privacy with a minimal resource footprint.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20(X11)-lightgrey.svg)
![Framework](https://img.shields.io/badge/framework-Tauri%202-24C8DB.svg)

## Key Features

*   **Multi-Engine Support**:
    *   **Google Gemini** (Default): High-quality, context-aware translation.
    *   **OpenAI**: Support for GPT-3.5 and GPT-4 models.
    *   **OpenRouter**: Access to multiple AI models through a single API.
    *   **DeepL**: Professional-grade translation.
    *   **Microsoft Translator** & **Google Translate**: Robust traditional options.
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

> **Platform support**: Linux with X11 is the primary target (`.deb` and AppImage bundles). Selected-text capture and screenshots use `xdotool` / `gnome-screenshot`, which do not work under Wayland (the app warns and falls back to translating the clipboard). Windows/macOS bundles are not currently configured or tested.

## Installation

### Prerequisites
*   Node.js (v18 or higher)
*   Rust & Cargo (for building the Tauri backend)
*   Tauri CLI: `cargo install tauri-cli --version "^2"` (the `app:*` npm scripts call `cargo tauri`)
*   System dependencies for Tauri on Linux: WebKitGTK 4.1 (`libwebkit2gtk-4.1-dev` on Ubuntu 22.04+/Debian 12+) and GTK3 dev packages
*   Runtime (Linux): `xdotool` for the quick-translate hotkey (declared as a `.deb` dependency). Tesseract OCR and `gnome-screenshot` are optional — the app guides you through installing them when you first use OCR.

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

### Development checks

```bash
npm run typecheck   # TypeScript, no emit
npm run build       # secret scan + tsc + vite build
cargo check         # in src-tauri/ — Rust backend
```

There is no automated test suite yet.

## Configuration

### Setting Up API Keys
1.  Launch the application.
2.  Click the **Settings** (gear icon) in the title bar.
3.  Select your preferred **Provider**.
4.  Enter your **API Key**.

### Quick Translate Shortcut
The default shortcut is `Ctrl+Shift+X`. You can customize this in Settings.

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
