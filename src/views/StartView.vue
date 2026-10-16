<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import CitySelect from '../components/CitySelect.vue';
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
    <h1>Добре дошъл, {{ session.user?.name }}</h1>
    <p class="bgr-muted">Избери град, в който да регистрираш своя отбор.</p>
    <label>
      Град
      <CitySelect v-model="cityId" />
    </label>
    <p v-if="error" class="bgr-error">{{ error }}</p>
    <button :disabled="busy">Започни</button>
    <button type="button" class="bgr-link" @click="onLogout">Изход</button>
  </form>
</template>
