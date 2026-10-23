<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import CitySelect from '../components/CitySelect.vue';
import LangSwitch from '../components/LangSwitch.vue';
import { errorMessage } from '../api';
import { createPlayer, logout, session } from '../session';

const router = useRouter();
const cityId = ref(0);
const error = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await createPlayer(cityId.value);
    router.push('/');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function onLogout() {
  await logout().catch(() => {});
  router.push('/login');
}
</script>

<template>
  <form class="bgr-card bgr-form" @submit.prevent="submit">
    <LangSwitch />
    <h1>{{ $t('auth.welcome', { name: session.user?.name ?? '' }) }}</h1>
    <p class="bgr-muted">{{ $t('auth.pickCity') }}</p>
    <label>
      {{ $t('auth.city') }}
      <CitySelect v-model="cityId" />
    </label>
    <p v-if="error" class="bgr-error">{{ error }}</p>
    <button :disabled="busy">{{ $t('auth.start') }}</button>
    <button type="button" class="bgr-link" @click="onLogout">{{ $t('nav.logout') }}</button>
  </form>
</template>
