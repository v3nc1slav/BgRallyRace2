import './style.css';
import { createApp } from 'vue';
import App from './App.vue';
import { isApp } from './platform';
import { router } from './router';

const container = document.getElementById('app');
if (!isApp && container?.dataset.sw && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(container.dataset.sw, { scope: container.dataset.scope || '/' }).catch(() => undefined);
}

createApp(App).use(router).mount('#app');
