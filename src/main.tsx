import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.process = { env: { NODE_ENV: import.meta.env.MODE } } as any;

// Global error handler to catch initialization crashes
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global Error Caught:", message, error);
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="padding: 20px; color: white; background: #111; font-family: sans-serif;">
      <h1 style="color: #f43f5e">App Initialization Error</h1>
      <p>${message}</p>
      <pre style="font-size: 10px; opacity: 0.5;">${error?.stack || ''}</pre>
    </div>`;
  }
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UploadProvider } from './contexts/UploadContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UploadProvider>
      <App />
    </UploadProvider>
  </StrictMode>,
);
