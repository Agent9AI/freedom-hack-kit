/** Registers dist/sw.js in production builds. Browsers only allow service workers on HTTPS or localhost. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is progressive: the app still works online without it.
    });
  });
}
