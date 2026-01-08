# Release Notes v1.0.4

We are excited to announce the release of LightTranslator **v1.0.4**! This update brings significant improvements to the user interface, expanded API options, and settings management.

## 🚀 New Features

### 🤖 Expanded AI Model Support
*   **DeepSeek Integration**: Added a convenient "Load DeepSeek" preset button within the Custom API settings. This requires using the OpenAI compatibility provider, allowing you to easily configure DeepSeek-V3 or DeepSeek-R1 models with a single click.
*   **OpenRouter Integration**: Finalized native support for **OpenRouter**, giving you access to a vast array of LLMs including Claude 3.5, Llama 3, and more.

### 🎨 UI & Design Refinements
*   **Frosted Glass Effect**: The Quick Translate (Pop-up) window now features a refined frosted glass aesthetic for a modern, native macOS-like feel.
*   **Visual Polish**: Cleaner borders and improved visual hierarchy across the application.

### ⚙️ Enhanced Settings Control
*   **Dedicated Pop-up Tab**: Settings for the Quick Translate window have been moved to a new, dedicated **"Pop-up"** tab in the settings menu for easier access.
*   **Customizable Appearance**:
    *   **Opacity Control**: You can now adjust the transparency of the Pop-up window background.
    *   **Border Depth**: Fine-tune the visibility and depth of the window borders to match your preference.

## 🛠️ Internal Improvements
*   Refactored the settings architecture for better maintainability.
*   Optimized window management logic.

## 📦 Downloads / 下载
* `LightTranslator-1.0.4.AppImage` : Portable Linux version (无需安装，直接运行).
* `lighttranslator_1.0.4_amd64.deb` : Debian/Ubuntu installer (推荐安装版).

## Installation / 安装
```bash
# AppImage
chmod +x LightTranslator-1.0.4.AppImage
./LightTranslator-1.0.4.AppImage

# Deb
sudo dpkg -i lighttranslator_1.0.4_amd64.deb
sudo apt-get install -f
```
