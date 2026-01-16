# LightTranslator

LightTranslator is a high-performance, lightweight, cross-platform translation tool built with **Tauri**, **React**, and **Vite**. It supports multiple advanced translation engines (LLMs and traditional), OCR capabilities, and prioritizes user privacy and security with a minimal resource footprint.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Framework](https://img.shields.io/badge/framework-Tauri%202-24C8DB.svg)

## Key Features

*   **Multi-Engine Support**:
    *   **Google Gemini** (Default): High-quality, context-aware translation.
    *   **OpenAI**: Support for GPT-3.5 and GPT-4 models.
    *   **OpenRouter**: Access to multiple AI models through a single API.
    *   **DeepL**: Professional-grade translation.
    *   **Microsoft Translator** & **Google Translate**: Robust traditional options.
*   **Ultra Lightweight**: Powered by Tauri 2 (Rust) for minimal memory usage and instant startup.
*   **Quick Translate**: Global hotkey (Ctrl+Shift+X) for instant translation of selected text.
*   **Silent Autostart**: Supports starting silently in the background (`--hidden` flag).
*   **System Tray**: Minimize to tray for quick access.
*   **Dynamic Model Verification**: Real-time verification of the LLM model in use.
*   **OCR & Screenshot Translation**: Built-in screenshot tool with Tesseract OCR integration.
*   **Proxy Support**: HTTP, HTTPS, and SOCKS5 proxy configuration.
*   **Security First**:
    *   **No Hardcoded Secrets**: Secure storage for API keys.
    *   **Secret Scanning**: Automated pre-build checks.
*   **Cross-Platform**: Optimized for Windows, macOS, and Linux.

## Installation

### Prerequisites
*   Node.js (v18 or higher)
*   Rust & Cargo (for building Tauri backend)
*   System dependencies for Tauri (Webview2 on Windows, WebKitGTK on Linux)

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

## Configuration

### Setting Up API Keys
1.  Launch the application.
2.  Click the **Settings** (gear icon) in the title bar.
3.  Select your preferred **Provider**.
4.  Enter your **API Key**.

### Quick Translate Shortcut
The default shortcut is `Ctrl+Shift+X`. You can customize this in Settings.

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
