<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '../api';
import PrivacyLinks from '../components/PrivacyLinks.vue';
import { t } from '../i18n';
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
  if (!window.confirm(t('profile.deleteConfirm'))) {
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
      <h1>{{ $t('profile.title') }}</h1>
      <dl class="bgr-stats-list">
        <dt>{{ $t('profile.name') }}</dt>
        <dd>{{ session.user?.name }}</dd>
        <dt>{{ $t('profile.city') }}</dt>
        <dd>{{ session.player?.city }}</dd>
        <dt>{{ $t('profile.version') }}</dt>
        <dd>{{ isApp ? $t('profile.app') : $t('profile.browser') }}</dd>
      </dl>
      <div class="bgr-actions">
        <RouterLink to="/settings" class="bgr-small-link">{{ $t('profile.settings') }}</RouterLink>
        <button class="bgr-secondary" :disabled="busy" @click="signOut">{{ $t('nav.logout') }}</button>
      </div>
      <PrivacyLinks />
    </section>

    <section class="bgr-card">
      <h2>{{ $t('profile.deleteTitle') }}</h2>
      <p class="bgr-muted">{{ $t('profile.deleteText') }}</p>
      <form class="bgr-form" @submit.prevent="remove">
        <label>
          {{ $t('profile.confirmLabel', { word: $t('profile.confirmWord') }) }}
          <input v-model="confirm" autocomplete="off" />
        </label>
        <p v-if="error" class="bgr-error">{{ error }}</p>
        <button class="bgr-danger" :disabled="busy || confirm.trim().toUpperCase() !== $t('profile.confirmWord')">{{ $t('profile.deleteButton') }}</button>
      </form>
    </section>
  </div>
</template>
