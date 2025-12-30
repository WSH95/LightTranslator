# LightTranslator

LightTranslator is a lightweight, cross-platform translation tool built with Electron, React, and Vite. It supports multiple advanced translation engines (LLMs and traditional), OCR capabilities, and prioritizes user privacy and security.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## Key Features

*   **Multi-Engine Support**:
    *   **Google Gemini** (Default): High-quality, context-aware translation using the latest Gemini models.
    *   **OpenAI**: Support for GPT-3.5 and GPT-4 models.
    *   **DeepL**: Professional-grade translation.
    *   **Microsoft Translator**: Robust Azure-based translation.
    *   **Google Translate**: Free version (web-based fallback).
*   **Dynamic Model Verification**: The application displays the actual verified identity of the LLM model in use (e.g., `gemini-1.5-flash-002`) in the status bar, ensuring you know exactly which model is powering your translations.
*   **OCR & Screenshot Translation**: Built-in screenshot tool with Tesseract OCR integration for translating text from images or protected UI elements.
*   **Text Processing**: Smart line-break removal for better translation of PDF/copied text.
*   **Security First**:
    *   **No Hardcoded Secrets**: API keys are managed via a secure Settings UI and never stored in the codebase.
    *   **Secret Scanning**: Automated pre-build checks prevents accidental commitment of sensitive keys.
*   **Cross-Platform**: Optimized for Windows, macOS, and Linux (Ubuntu).

## Installation

### Prerequisites
*   Node.js (v18 or higher)
*   npm (v9 or higher)
*   Git

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
    npm run dev:electron
    ```

### Building for Production

To create a distributable application for your customized platform:

```bash
# For current platform
npm run dist

# Specific platforms
npm run dist:linux   # AppImage & Deb
npm run dist:win     # NSIS Installer
npm run dist:mac     # DMG
```

### Ubuntu Setup (Linux)
LightTranslator is fully compatible with Ubuntu. The build system will generate both `.AppImage` (portable) and `.deb` (installable) packages.

**Dependencies:**
The `.deb` package automatically declares dependencies on `tesseract-ocr` and `xdotool` for OCR functionality.

## Configuration

### Setting Up API Keys
1.  Launch the application.
2.  Click the **Settings** (gear icon) in the title bar.
3.  Select your preferred **Provider** (e.g., Gemini).
4.  Enter your **API Key** in the designated field.
    *   Keys are stored locally in the application's secure storage.

### Environment Variables
You can optionally preload configurations using a `.env` file (see `.env.example`) for local development, though using the UI is recommended for production security.

## Development & Security

### Security Audit
This project includes a strict `scripts/check-secrets.js` hook that runs before every build to scan for potential API key leaks.

### Project Structure
*   **electron/**: Main process and system integrations (preload, IPC).
*   **src/**: React application (UI/UX).
    *   **components/**: Reusable UI components (TranslatorView, SettingsModal).
    *   **services/**: API integration layers (Gemini, OpenAI, etc.).
    *   **store/**: State management using Zustand.
*   **dist-electron/**: Compiled Electron output (ignored by git).

## License
MIT License - see the [LICENSE](LICENSE) file for details.
