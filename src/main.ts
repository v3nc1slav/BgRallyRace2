import './style.css';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import { isApp } from './platform';
import { router } from './router';

const RELOAD_KEY = 'bgr-reload';

window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY));
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  if (Date.now() - last > 60000) {
    event.preventDefault();
    window.location.reload();
  }
});

const container = document.getElementById('app');
if (!isApp && container?.dataset.sw && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(container.dataset.sw, { scope: container.dataset.scope || '/' }).catch(() => undefined);
}

createApp(App).use(i18n).use(router).mount('#app');
