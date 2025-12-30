# LightTranslator

A modern, lightweight translation tool built with Electron and React. LightTranslator supports selection translation, screenshot OCR, and integrates with multiple powerful translation engines including Google Gemini, OpenAI, DeepL, and Microsoft Translator.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## 🌟 Key Features

*   **Multi-Engine Support**: Seamlessly switch between Google Gemini, OpenAI (supports compatible APIs like DeepSeek), DeepL, and Microsoft Translator.
*   **Dynamic Model Status**: The status bar provides real-time feedback on the active LLM model, including identity verification to ensure you are using the correct model version.
*   **Smart Translation Tools**:
    *   **Selection Translation (划词翻译)**: Translate text select anywhere on your screen.
    *   **Screenshot OCR**: Built-in OCR capabilities to extract and translate text from images or protected documents.
*   **Modern Aesthetics**: specialized UI designed with macOS/iOS aesthetics, featuring glassmorphism, smooth animations, and a clean interface.
*   **Privacy Focused**: API keys are stored locally.

## 🚀 Installation & Setup

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (comes with Node.js)

### Platform-Specific Dependencies

**Ubuntu / Debian Linux:**
For OCR and screenshot functionality to work correctly on Linux, you need to install the following dependencies:

```bash
sudo apt-get update
sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-chi-tra tesseract-ocr-jpn tesseract-ocr-kor xdotool gnome-screenshot
```
*Note: The `tesseract-ocr-*` packages provide language support for Chinese, Japanese, and Korean.*

### Setup Steps

1.  Clone the repository:
    ```bash
    git clone https://github.com/user/lighttranslator.git
    cd lighttranslator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev:electron
    ```

## ⚙️ Configuration

LightTranslator manages API keys securely. You can configure them via environment variables for development or directly in the application settings.

### 1. Environment Variables (Development)
Duplicate the example configuration file:
```bash
cp .env.example .env.local
```
Edit `.env.local` and add your API keys:
```env
# Google Gemini
VITE_GEMINI_API_KEY=your_gemini_key

# OpenAI / DeepSeek
VITE_OPENAI_API_KEY=your_openai_key

# DeepL
VITE_DEEPL_API_KEY=your_deepl_key

# Microsoft Translator
VITE_MICROSOFT_SUBSCRIPTION_KEY=your_ms_key
VITE_MICROSOFT_REGION=global
```

### 2. In-App Settings (Recommended)
You can also enter your API keys directly in the application's "Settings" menu.
> **Note:** Keys configured in the UI are stored comfortably in `localStorage` and will take precedence over environment variables.

## 🛠 Development & Building

This project uses **Electron Builder** for packaging.

### Running in Development Mode
```bash
npm run dev:electron
```
This command concurrently runs the Vite dev server and the Electron main process.

### Packaging the Application
To build the application for production, run one of the following commands:

*   **Build for current OS**:
    ```bash
    npm run dist
    ```
*   **Build for Linux (AppImage, Deb)**:
    ```bash
    npm run dist:linux
    ```
*   **Build for Windows**:
    ```bash
    npm run dist:win
    ```
*   **Build for macOS**:
    ```bash
    npm run dist:mac
    ```

### Security Check
The build process includes a pre-build security check (`scripts/check-secrets.js`) to ensure no testing secrets or critical environment variables are accidentally bundled into the release.

## 📄 License
MIT License - Copyright © 2024 LightTranslator
