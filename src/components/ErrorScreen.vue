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
      <h1>Излязохме от пътя</h1>
      <p class="bgr-crash-message">{{ message }}</p>
      <p class="bgr-muted">Опитай отново след малко. Ако проблемът продължава, екипът вече работи по него.</p>
      <button @click="retry">Опитай отново</button>
    </div>
  </section>
</template>
