/**
 * OCR dependency probing for the Electron backend.
 *
 * Mirrors the helpers in src-tauri/src/lib.rs (ocr_dependency_status,
 * installed_tesseract_langs). Deliberately has NO installer: OCR components
 * are installed on demand by the user from copy-pastable commands the app
 * shows (DECISIONS.md 0003), never by an elevated process we spawn.
 */
import { exec } from 'child_process';

/** Languages the OCR feature wants; tesseract runs with the installed subset. */
export const OCR_DESIRED_LANGS = ['chi_sim', 'chi_tra', 'eng', 'jpn', 'kor'];

function run(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout) => resolve({ ok: !error, stdout: stdout || '' }));
  });
}

/** Languages tesseract reports as installed, or [] when it is unavailable. */
export async function installedTesseractLangs() {
  const { ok, stdout } = await run('tesseract --list-langs');
  if (!ok) return [];
  return stdout
    .split('\n')
    .slice(1) // skip the "List of available languages" header
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function checkTesseract() {
  const { ok, stdout } = await run('tesseract --version');
  if (!ok) return { installed: false, version: null, languages: [] };
  return {
    installed: true,
    version: (stdout.split('\n')[0] || '').trim(),
    languages: await installedTesseractLangs(),
  };
}

/** Area-capture tool. Linux-only path, matching the Tauri backend. */
export async function checkScreenshotTool() {
  if (process.platform !== 'linux') return false;
  const { ok } = await run('which gnome-screenshot');
  return ok;
}
