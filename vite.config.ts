import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Inline the dev key only in dev mode: a production define would bake the
  // build machine's GEMINI_API_KEY into the shipped bundle as a string literal.
  const devKey = mode === 'development' ? env.GEMINI_API_KEY ?? '' : '';
  return {
    base: './', // Tauri serves the bundle from the filesystem — keep paths relative
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(devKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(devKey),
      'process.env.APP_VERSION': JSON.stringify(packageJson.version)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
