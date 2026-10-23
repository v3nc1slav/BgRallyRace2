<script setup lang="ts">
import { closeTestAd, testAd } from '../ads';
import { t } from '../i18n';

function close() {
  if (testAd.left && !window.confirm(t('ads.closeConfirm'))) {
    return;
  }
  closeTestAd();
}
</script>

<template>
  <div v-if="testAd.open" class="bgr-ad-overlay">
    <div class="bgr-ad">
      <small class="bgr-muted">{{ $t('ads.test') }}</small>
      <div class="bgr-ad-screen">
        <b>BG Rally</b>
        <span>{{ $t('ads.reward', { label: testAd.label }) }}</span>
      </div>
      <p>{{ testAd.left ? $t('ads.left', { seconds: testAd.left }) : $t('ads.done') }}</p>
      <button :class="{ 'bgr-secondary': testAd.left > 0 }" @click="close">{{ testAd.left ? $t('ads.close') : $t('ads.take') }}</button>
    </div>
  </div>
</template>
