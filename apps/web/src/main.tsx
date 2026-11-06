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
  // updateViaCache 'none': the browser's own update check on each visit bypasses the HTTP cache, so a new
  // build or security policy (new VERSION in sw.js) is installed straight away (DEF-15, DEF-16).
  window.addEventListener('load', () =>
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((err: unknown) => {
      // Without a worker the app still works online, but offline mode and push do not: say why.
      console.warn('Service worker registration failed; offline mode and push are unavailable.', err);
    }),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
