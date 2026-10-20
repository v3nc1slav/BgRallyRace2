<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from '../api';
import { session } from '../session';
import { loginWith } from '../social';

const router = useRouter();
const busy = ref(false);
const error = ref('');

async function login(provider: 'google' | 'facebook') {
  busy.value = true;
  error.value = '';
  try {
    await loginWith(provider);
    router.push('/');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="session.providers.google || session.providers.facebook" class="bgr-social">
    <p class="bgr-muted">или</p>
    <button v-if="session.providers.google" type="button" class="bgr-social-google" :disabled="busy" @click="login('google')">Вход с Google</button>
    <button v-if="session.providers.facebook" type="button" class="bgr-social-facebook" :disabled="busy" @click="login('facebook')">Вход с Facebook</button>
    <p v-if="error" class="bgr-error">{{ error }}</p>
  </div>
</template>
