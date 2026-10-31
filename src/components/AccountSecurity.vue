<script setup lang="ts">
import { ref } from 'vue';
import { changePassword, resendConfirmation, session } from '../session';
import { useAction } from '../useAction';
import Feedback from './Feedback.vue';

const form = ref({ current: '', password: '' });
const { busy, message, error, run } = useAction();

async function resend() {
  const result = await run(resendConfirmation);
  if (result) {
    message.value = result.message;
  }
}

async function submit() {
  const result = await run(() => changePassword(form.value.current, form.value.password));
  if (result !== undefined) {
    form.value = { current: '', password: '' };
    message.value = result;
  }
}
</script>

<template>
  <section class="bgr-card">
    <h2>{{ $t('auth.account') }}</h2>
    <Feedback :message="message" :error="error" />
    <p v-if="session.user?.email_confirmed" class="bgr-ok">{{ $t('auth.emailConfirmed') }}</p>
    <template v-else>
      <p class="bgr-muted">{{ $t('auth.emailUnconfirmed') }}</p>
      <button class="bgr-secondary" :disabled="busy" @click="resend">{{ $t('auth.resend') }}</button>
    </template>
    <h2>{{ $t('auth.changePassword') }}</h2>
    <p class="bgr-muted">{{ $t('auth.changeHint') }}</p>
    <form class="bgr-form" @submit.prevent="submit">
      <label>
        {{ $t('auth.currentPassword') }}
        <input v-model="form.current" type="password" autocomplete="current-password" required />
      </label>
      <label>
        {{ $t('auth.newPassword') }}
        <input v-model="form.password" type="password" autocomplete="new-password" minlength="8" required />
      </label>
      <button :disabled="busy">{{ $t('auth.resetSave') }}</button>
    </form>
  </section>
</template>
