import { App } from './app.js';

function boot() {
  new App();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('../sw.js', import.meta.url))
      .catch(() => {
        // Offline support is an enhancement; the app works without it.
      });
  });
}
