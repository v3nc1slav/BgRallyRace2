<script setup lang="ts">
import { ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import LangSwitch from '../components/LangSwitch.vue';
import { forgotPassword } from '../session';
import { useAction } from '../useAction';

const login = ref('');
const { busy, message, error, run } = useAction();

async function submit() {
  const result = await run(() => forgotPassword(login.value));
  if (result) {
    message.value = result.message;
  }
}
</script>

<template>
  <form class="bgr-card bgr-form" @submit.prevent="submit">
    <LangSwitch />
    <h1>{{ $t('auth.forgotTitle') }}</h1>
    <p class="bgr-muted">{{ $t('auth.forgotHint') }}</p>
    <label>
      {{ $t('auth.loginField') }}
      <input v-model="login" autocomplete="username" required />
    </label>
    <Feedback :message="message" :error="error" />
    <button :disabled="busy">{{ $t('auth.forgotSend') }}</button>
    <p class="bgr-muted"><RouterLink to="/login">{{ $t('auth.backToLogin') }}</RouterLink></p>
  </form>
</template>
