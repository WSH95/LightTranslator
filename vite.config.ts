import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig(() => {
  return {
    base: './', // Tauri serves the bundle from the filesystem — keep paths relative
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0',
      watch: {
        // A `cargo` build drops tens of thousands of files under
        // src-tauri/target; watching them exhausts the inotify limit and
        // takes the dev server down with ENOSPC.
        ignored: ['**/src-tauri/**', '**/dist-electron/**'],
      },
    },
    plugins: [react()],
    define: {
      'process.env.APP_VERSION': JSON.stringify(packageJson.version)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
