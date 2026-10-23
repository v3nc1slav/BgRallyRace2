<script setup lang="ts">
import crash from '../assets/error.jpg';

defineProps<{ message: string }>();

function retry() {
  window.location.reload();
}
</script>

<template>
  <section class="bgr-crash" :style="{ backgroundImage: `url(${crash})` }">
    <div class="bgr-crash-box">
      <h1>{{ $t('crash.title') }}</h1>
      <p class="bgr-crash-message">{{ message }}</p>
      <p class="bgr-muted">{{ $t('crash.hint') }}</p>
      <button @click="retry">{{ $t('crash.retry') }}</button>
    </div>
  </section>
</template>
