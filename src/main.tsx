import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.process = (window.process || { env: {} }) as any;
(window.process as any).env = { 
  ...(window.process as any).env,
  NODE_ENV: import.meta.env.MODE 
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UploadProvider } from './contexts/UploadContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root');
if (!container) throw new Error("Root container not found");

const root = createRoot(container);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <ErrorProvider>
        <UploadProvider>
          <App />
        </UploadProvider>
      </ErrorProvider>
    </ErrorBoundary>
  </StrictMode>,
);
