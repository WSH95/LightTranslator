# LightTranslator

LightTranslator is a high-performance, lightweight, cross-platform translation tool built with **Tauri**, **React**, and **Vite**. It supports multiple advanced translation engines (LLMs and traditional), OCR capabilities, and prioritizes user privacy and security with a minimal resource footprint.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## Key Features

*   **Multi-Engine Support**:
    *   **Google Gemini** (Default): High-quality, context-aware translation.
    *   **OpenAI**: Support for GPT-3.5 and GPT-4 models.
    *   **DeepL**: Professional-grade translation.
    *   **Microsoft Translator** & **Google Translate**: Robust traditional options.
*   **Ultra Lightweight**: Powered by Tauri (Rust) for minimal memory usage and instant startup.
*   **Silent Autostart**: Supports starting silently in the background (`--hidden` flag).
*   **Dynamic Model Verification**: Real-time verification of the LLM model in use.
*   **OCR & Screenshot Translation**: Built-in screenshot tool with Tesseract OCR integration.
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
    npm run tauri:dev
    ```

### Building for Production

To create a distributable application:

```bash
# Build for current platform
npm run tauri:build

# Build for Linux specifically
npm run tauri:build:linux
```

The build artifacts (AppImage, Deb) will be generated in `src-tauri/target/release/bundle/`.

## Configuration

### Setting Up API Keys
1.  Launch the application.
2.  Click the **Settings** (gear icon) in the title bar.
3.  Select your preferred **Provider**.
4.  Enter your **API Key**.

## Project Structure

*   **src-tauri/**: Rust backend and system integration.
*   **src/**: React frontend application.
    *   **components/**: Reusable UI components.
    *   **services/**: API integration layers.
    *   **store/**: State management (Zustand).

## License
MIT License - see the [LICENSE](LICENSE) file for details.
