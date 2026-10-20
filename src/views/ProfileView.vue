<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '../api';
import PrivacyLinks from '../components/PrivacyLinks.vue';
import { isApp } from '../platform';
import { deleteAccount, logout, session } from '../session';

const router = useRouter();
const confirm = ref('');
const busy = ref(false);
const error = ref('');

async function signOut() {
  busy.value = true;
  try {
    await logout();
    router.push('/login');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!window.confirm('Профилът, отборът и всичко в играта ще бъдат изтрити завинаги. Сигурен ли си?')) {
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    await deleteAccount(confirm.value);
    router.push('/login');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="bgr-stack">
    <section class="bgr-card">
      <h1>Профил</h1>
      <dl class="bgr-stats-list">
        <dt>Име</dt>
        <dd>{{ session.user?.name }}</dd>
        <dt>Град</dt>
        <dd>{{ session.player?.city }}</dd>
        <dt>Версия</dt>
        <dd>{{ isApp ? 'Приложение' : 'Браузър' }}</dd>
      </dl>
      <div class="bgr-actions">
        <RouterLink to="/settings" class="bgr-small-link">Настройки и известия</RouterLink>
        <button class="bgr-secondary" :disabled="busy" @click="signOut">Изход</button>
      </div>
      <PrivacyLinks />
    </section>

    <section class="bgr-card">
      <h2>Изтрий профила</h2>
      <p class="bgr-muted">
        Изтриват се профилът, отборът, колите, служителите, парите, договорите, заемите и обявите.
        Съобщенията в чата и форума и резултатите от минали ралита остават с името „Изтрит играч“. Действието не може да се отмени.
      </p>
      <form class="bgr-form" @submit.prevent="remove">
        <label>
          За потвърждение напиши ИЗТРИЙ
          <input v-model="confirm" autocomplete="off" />
        </label>
        <p v-if="error" class="bgr-error">{{ error }}</p>
        <button class="bgr-danger" :disabled="busy || confirm.trim().toUpperCase() !== 'ИЗТРИЙ'">Изтрий профила завинаги</button>
      </form>
    </section>
  </div>
</template>
