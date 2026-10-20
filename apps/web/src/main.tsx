import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// FR-34: capture the install prompt early and register the service worker in production builds only.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as { __installPrompt?: Event }).__installPrompt = e;
});
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
