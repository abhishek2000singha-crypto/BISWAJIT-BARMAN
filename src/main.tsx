import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.process = window.process || { env: {} };
(window.process as any).env = { 
  ...(window.process as any).env,
  NODE_ENV: import.meta.env.MODE 
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UploadProvider } from './contexts/UploadContext';

const container = document.getElementById('root');
if (!container) throw new Error("Root container not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <UploadProvider>
      <App />
    </UploadProvider>
  </StrictMode>,
);
