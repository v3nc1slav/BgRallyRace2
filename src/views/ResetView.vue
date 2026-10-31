<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import Feedback from '../components/Feedback.vue';
import { loadSession, resetPassword } from '../session';
import { useAction } from '../useAction';

const route = useRoute();
const password = ref('');
const done = ref(false);
const { busy, message, error, run } = useAction();

async function submit() {
  const result = await run(() => resetPassword(String(route.query.login ?? ''), String(route.query.key ?? ''), password.value));
  if (result) {
    done.value = true;
    message.value = result.message;
    await loadSession();
  }
}
</script>

<template>
  <form class="bgr-card bgr-form" @submit.prevent="submit">
    <h1>{{ $t('auth.resetTitle') }}</h1>
    <label v-if="!done">
      {{ $t('auth.newPassword') }}
      <input v-model="password" type="password" autocomplete="new-password" minlength="8" required />
    </label>
    <Feedback :message="message" :error="error" />
    <button v-if="!done" :disabled="busy">{{ $t('auth.resetSave') }}</button>
    <p class="bgr-muted"><RouterLink to="/login">{{ $t('auth.backToLogin') }}</RouterLink></p>
  </form>
</template>
