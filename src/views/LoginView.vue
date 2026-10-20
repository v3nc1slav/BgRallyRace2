<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '../api';
import PrivacyLinks from '../components/PrivacyLinks.vue';
import SocialButtons from '../components/SocialButtons.vue';
import { login } from '../session';

const router = useRouter();
const form = ref({ login: '', password: '', remember: true });
const error = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await login(form.value.login, form.value.password, form.value.remember);
    router.push('/');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="bgr-card bgr-form" @submit.prevent="submit">
    <h1>Вход</h1>
    <label>
      Потребителско име или имейл
      <input v-model="form.login" autocomplete="username" required />
    </label>
    <label>
      Парола
      <input v-model="form.password" type="password" autocomplete="current-password" required />
    </label>
    <label class="bgr-check">
      <input v-model="form.remember" type="checkbox" />
      Запомни ме
    </label>
    <p v-if="error" class="bgr-error">{{ error }}</p>
    <button :disabled="busy">Влез</button>
    <SocialButtons />
    <p class="bgr-muted">Нямаш профил? <RouterLink to="/register">Регистрирай се</RouterLink></p>
    <PrivacyLinks />
  </form>
</template>
