# Release Notes v1.1.0

We are thrilled to introduce LightTranslator **v1.1.0**, a major milestone in our journey! This release features a complete architectural overhaul, migrating the application core to **Tauri**.

## 🚀 Key Highlights

### ⚡ Ultra-Lightweight & High Performance
*   **Tauri Integration**: By leveraging Rust and the system's native webview, we've drastically reduced the application size and memory usage.
*   **Instant Startup**: Experience significantly faster launch times compared to previous Electron-based versions.
*   **Optimized Resource Usage**: The application now runs with a minimal footprint, ensuring it stays "light" on your system resources.

## 🛠️ Internal Improvements
*   Migrated backend architecture from Electron to Tauri/Rust.
*   Enhanced system tray and window management stability.

## 📦 Downloads / 下载
* `lighttranslator_1.1.0_amd64.deb` : Debian/Ubuntu installer (推荐安装版) - *Much smaller!*
* `LightTranslator_1.1.0_x64.AppImage` : Portable Linux version (无需安装，直接运行).

## Installation / 安装
```bash
# AppImage
chmod +x LightTranslator_1.1.0_x64.AppImage
./LightTranslator_1.1.0_x64.AppImage

# Deb
sudo dpkg -i lighttranslator_1.1.0_amd64.deb
sudo apt-get install -f
```
