<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '../api';
import LangSwitch from '../components/LangSwitch.vue';
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
    <LangSwitch />
    <h1>{{ $t('auth.login') }}</h1>
    <label>
      {{ $t('auth.loginField') }}
      <input v-model="form.login" autocomplete="username" required />
    </label>
    <label>
      {{ $t('auth.password') }}
      <input v-model="form.password" type="password" autocomplete="current-password" required />
    </label>
    <label class="bgr-check">
      <input v-model="form.remember" type="checkbox" />
      {{ $t('auth.remember') }}
    </label>
    <p v-if="error" class="bgr-error">{{ error }}</p>
    <button :disabled="busy">{{ $t('auth.enter') }}</button>
    <SocialButtons />
    <p class="bgr-muted">{{ $t('auth.noAccount') }} <RouterLink to="/register">{{ $t('auth.signUp') }}</RouterLink></p>
    <PrivacyLinks />
  </form>
</template>
