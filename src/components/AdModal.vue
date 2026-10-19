<script setup lang="ts">
import { closeTestAd, testAd } from '../ads';

function close() {
  if (testAd.left && !window.confirm('Ако затвориш рекламата сега, няма да получиш наградата. Затваряш ли?')) {
    return;
  }
  closeTestAd();
}
</script>

<template>
  <div v-if="testAd.open" class="bgr-ad-overlay">
    <div class="bgr-ad">
      <small class="bgr-muted">Тестова реклама</small>
      <div class="bgr-ad-screen">
        <b>BG Rally</b>
        <span>Награда: {{ testAd.label }}</span>
      </div>
      <p>{{ testAd.left ? `Остават ${testAd.left} сек.` : 'Готово! Наградата е твоя.' }}</p>
      <button :class="{ 'bgr-secondary': testAd.left > 0 }" @click="close">{{ testAd.left ? 'Затвори' : 'Вземи наградата' }}</button>
    </div>
  </div>
</template>
