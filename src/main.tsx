import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.process = { env: {} } as any;

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
