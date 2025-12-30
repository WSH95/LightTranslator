import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';

/**
 * Cross-platform OCR dependency checker and installer
 */

const platform = os.platform();

// Required Tesseract language packs
export const REQUIRED_LANGS = ['eng', 'chi_sim', 'chi_tra', 'jpn', 'kor'];

/**
 * Check if Tesseract is installed and accessible
 * @returns {Promise<{installed: boolean, version: string|null, languages: string[], missingLangs: string[]}>}
 */
export async function checkTesseract() {
  return new Promise((resolve) => {
    exec('tesseract --version', (error, stdout) => {
      if (error) {
        resolve({ installed: false, version: null, languages: [], missingLangs: REQUIRED_LANGS });
        return;
      }

      // Parse version from output
      const versionMatch = stdout.match(/tesseract\s+([\d.]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      // Check installed languages
      exec('tesseract --list-langs', (langError, langStdout) => {
        if (langError) {
          resolve({ installed: true, version, languages: [], missingLangs: REQUIRED_LANGS });
          return;
        }

        // Parse language list (skip header line)
        const lines = langStdout.trim().split('\n');
        const languages = lines.slice(1).map(l => l.trim()).filter(l => l);

        // Check for missing required languages
        const missingLangs = REQUIRED_LANGS.filter(lang => !languages.includes(lang));

        resolve({ installed: true, version, languages, missingLangs });
      });
    });
  });
}

/**
 * Check if gnome-screenshot is available (Linux only)
 * @returns {Promise<boolean>}
 */
export async function checkScreenshotTool() {
  if (platform !== 'linux') return true;

  return new Promise((resolve) => {
    exec('which gnome-screenshot', (error) => {
      resolve(!error);
    });
  });
}

/**
 * Get the installation command for the current platform
 * @returns {{command: string, elevated: boolean, description: string}|null}
 */
export function getInstallCommand() {
  switch (platform) {
    case 'linux':
      return getLinuxInstallCommand();
    case 'darwin':
      return {
        command: 'brew install tesseract tesseract-lang',
        elevated: false,
        description: 'Installing via Homebrew...'
      };
    case 'win32':
      return {
        command: null,
        elevated: true,
        description: 'Windows requires manual installation or Chocolatey'
      };
    default:
      return null;
  }
}

/**
 * Get Linux-specific install command based on distro
 * @returns {{command: string, elevated: boolean, description: string}}
 */
function getLinuxInstallCommand() {
  const pkgManagers = [
    {
      check: '/usr/bin/apt-get',
      command: 'apt-get install -y tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-chi-tra tesseract-ocr-jpn tesseract-ocr-kor gnome-screenshot xdotool',
      description: 'Installing via apt-get (Debian/Ubuntu)...'
    },
    {
      check: '/usr/bin/dnf',
      command: 'dnf install -y tesseract tesseract-langpack-chi_sim tesseract-langpack-chi_tra tesseract-langpack-jpn tesseract-langpack-kor gnome-screenshot xdotool',
      description: 'Installing via dnf (Fedora)...'
    },
    {
      check: '/usr/bin/pacman',
      command: 'pacman -S --noconfirm tesseract tesseract-data-chi_sim tesseract-data-chi_tra tesseract-data-jpn tesseract-data-kor gnome-screenshot xdotool',
      description: 'Installing via pacman (Arch)...'
    },
    {
      check: '/usr/bin/zypper',
      command: 'zypper install -y tesseract-ocr tesseract-ocr-traineddata-chinese_simplified tesseract-ocr-traineddata-chinese_traditional tesseract-ocr-traineddata-japanese tesseract-ocr-traineddata-korean gnome-screenshot xdotool',
      description: 'Installing via zypper (openSUSE)...'
    }
  ];

  for (const pm of pkgManagers) {
    if (fs.existsSync(pm.check)) {
      return {
        command: pm.command,
        elevated: true,
        description: pm.description
      };
    }
  }

  return {
    command: 'apt-get install -y tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-chi-tra tesseract-ocr-jpn tesseract-ocr-kor gnome-screenshot xdotool',
    elevated: true,
    description: 'Installing via apt-get (default)...'
  };
}

/**
 * Check if Homebrew is installed (macOS)
 * @returns {Promise<boolean>}
 */
export async function checkHomebrew() {
  if (platform !== 'darwin') return true;

  return new Promise((resolve) => {
    exec('which brew', (error) => {
      resolve(!error);
    });
  });
}

/**
 * Check if Chocolatey is installed (Windows)
 * @returns {Promise<boolean>}
 */
export async function checkChocolatey() {
  if (platform !== 'win32') return true;

  return new Promise((resolve) => {
    exec('choco --version', (error) => {
      resolve(!error);
    });
  });
}

/**
 * Install dependencies using the appropriate package manager
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function installDependencies(onProgress) {
  const installInfo = getInstallCommand();

  if (!installInfo || !installInfo.command) {
    if (platform === 'win32') {
      return await installWindowsDependencies(onProgress);
    }
    return { success: false, message: 'No suitable package manager found' };
  }

  return new Promise((resolve) => {
    onProgress && onProgress(installInfo.description);

    let fullCommand = installInfo.command;

    // Add pkexec for elevated commands on Unix
    if (installInfo.elevated && platform !== 'win32') {
      fullCommand = `pkexec ${installInfo.command}`;
    }

    const child = exec(fullCommand, { timeout: 300000 }); // 5 minute timeout

    let output = '';

    child.stdout?.on('data', (data) => {
      output += data;
      onProgress && onProgress(data.toString());
    });

    child.stderr?.on('data', (data) => {
      output += data;
      onProgress && onProgress(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, message: 'Dependencies installed successfully' });
      } else {
        resolve({ success: false, message: `Installation failed with code ${code}: ${output}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, message: `Installation error: ${err.message}` });
    });
  });
}

/**
 * Windows-specific installation using Chocolatey or manual download
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function installWindowsDependencies(onProgress) {
  const hasChoco = await checkChocolatey();

  if (hasChoco) {
    onProgress && onProgress('Installing via Chocolatey...');

    return new Promise((resolve) => {
      const child = exec('choco install tesseract -y', { timeout: 300000 });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'Tesseract installed via Chocolatey' });
        } else {
          resolve({
            success: false,
            message: 'Chocolatey installation failed. Please install Tesseract manually from: https://github.com/UB-Mannheim/tesseract/wiki'
          });
        }
      });
    });
  }

  return {
    success: false,
    message: 'Please install Tesseract manually:\n1. Download from: https://github.com/UB-Mannheim/tesseract/wiki\n2. Run the installer and select language packs\n3. Add Tesseract to your PATH'
  };
}

/**
 * Run full dependency check
 * @returns {Promise<{ocrAvailable: boolean, details: object}>}
 */
export async function checkAllDependencies() {
  const tesseract = await checkTesseract();
  const screenshot = await checkScreenshotTool();

  const ocrAvailable = tesseract.installed && tesseract.missingLangs.length === 0;

  return {
    ocrAvailable,
    details: {
      platform,
      tesseract,
      screenshotTool: screenshot,
      missingComponents: [
        ...(!tesseract.installed ? ['Tesseract OCR'] : []),
        ...(tesseract.missingLangs.map(lang => `Language pack: ${lang}`)),
        ...(!screenshot && platform === 'linux' ? ['gnome-screenshot'] : [])
      ]
    }
  };
}

/**
 * Get human-readable missing components message
 * @param {object} details - Details from checkAllDependencies
 * @returns {string}
 */
export function getMissingComponentsMessage(details) {
  if (details.missingComponents.length === 0) {
    return 'All OCR components are installed';
  }

  const components = details.missingComponents;

  if (!details.tesseract.installed) {
    return 'Tesseract OCR is not installed. OCR features will be disabled.';
  }

  if (details.tesseract.missingLangs.length > 0) {
    const langs = details.tesseract.missingLangs.join(', ');
    return `Missing language packs: ${langs}. Some languages may not be recognized.`;
  }

  return `Missing components: ${components.join(', ')}`;
}
