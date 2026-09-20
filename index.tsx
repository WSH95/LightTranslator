import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initTheme } from './src/lib/theme';

// Before createRoot: the token block and window mode must be on <html>
// for the first painted frame, and zustand hydrates localStorage
// synchronously, so the stored preference is already readable here.
initTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);