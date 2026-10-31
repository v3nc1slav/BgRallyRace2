<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import Feedback from '../components/Feedback.vue';
import { confirmEmail, loadSession } from '../session';
import { useAction } from '../useAction';

const route = useRoute();
const { message, error, run } = useAction();

onMounted(async () => {
  const result = await run(() => confirmEmail(Number(route.query.id), Number(route.query.exp), String(route.query.sig ?? '')));
  if (result) {
    message.value = result.message;
    await loadSession();
  }
});
</script>

<template>
  <section class="bgr-card">
    <h1>{{ $t('auth.confirmTitle') }}</h1>
    <Feedback :message="message" :error="error" />
    <p class="bgr-muted"><RouterLink to="/">{{ $t('auth.toGame') }}</RouterLink></p>
  </section>
</template>
