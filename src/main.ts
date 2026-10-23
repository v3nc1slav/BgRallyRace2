import './style.css';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import { isApp } from './platform';
import { router } from './router';

const container = document.getElementById('app');
if (!isApp && container?.dataset.sw && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(container.dataset.sw, { scope: container.dataset.scope || '/' }).catch(() => undefined);
}

createApp(App).use(i18n).use(router).mount('#app');
