#!/usr/bin/env node

/**
 * Pre-build script to check for potential API keys or secrets in source code.
 * This helps prevent accidental exposure of credentials in builds.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Patterns that might indicate hardcoded API keys
const secretPatterns = [
  /AIzaSy[a-zA-Z0-9_-]{33}/g,           // Google API Key
  /sk-[a-zA-Z0-9]{48,}/g,               // OpenAI API Key
  /sk-proj-[a-zA-Z0-9_-]+/g,            // OpenAI Project API Key
  /[a-f0-9]{32}-fx/g,                   // DeepL Free API Key
  /[a-f0-9]{36}/g,                       // Generic UUID/API Key pattern (high false positive)
];

// Files and directories to skip
const skipDirs = ['node_modules', 'dist', 'dist-electron', '.git', 'assets'];
const skipFiles = ['.env', '.env.local', '.env.example', 'check-secrets.js', 'package-lock.json'];
const allowedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.html'];

const warnings = [];

function checkFile(filePath) {
  const ext = extname(filePath);
  if (!allowedExtensions.includes(ext)) return;

  const fileName = filePath.split('/').pop();
  if (skipFiles.includes(fileName)) return;

  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip comments and imports
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
      if (line.includes('import ') || line.includes('require(')) return;

      // Check for potential API key patterns
      for (const pattern of secretPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          // Skip if it's clearly a placeholder or example
          const isPlaceholder = matches.some(m =>
            m.includes('xxx') ||
            m.includes('XXX') ||
            m.includes('your') ||
            m.includes('YOUR') ||
            m.includes('example') ||
            m.includes('EXAMPLE') ||
            /^0+$/.test(m) ||
            m === 'AIzaSy...' ||
            m === 'sk-...'
          );

          if (!isPlaceholder) {
            warnings.push({
              file: filePath.replace(rootDir, ''),
              line: index + 1,
              match: matches[0].substring(0, 20) + '...',
              pattern: pattern.toString()
            });
          }
        }
      }
    });
  } catch (error) {
    // Ignore read errors
  }
}

function walkDir(dir) {
  try {
    const files = readdirSync(dir);

    for (const file of files) {
      if (skipDirs.includes(file)) continue;

      const filePath = join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        checkFile(filePath);
      }
    }
  } catch (error) {
    // Ignore directory access errors
  }
}

console.log('🔍 Checking for potential secrets in source code...\n');

walkDir(rootDir);

if (warnings.length > 0) {
  console.log('⚠️  Potential secrets detected:\n');
  warnings.forEach(w => {
    console.log(`  📄 ${w.file}:${w.line}`);
    console.log(`     Pattern: ${w.match}`);
    console.log('');
  });
  console.log('Please review these files and ensure no real API keys are committed.');
  console.log('Use environment variables or the app settings UI for API key configuration.\n');
  // Exit with warning but don't fail the build
  process.exit(0);
} else {
  console.log('✅ No obvious secrets detected in source code.\n');
  process.exit(0);
}
