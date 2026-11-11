<script setup lang="ts">
import { dismiss, hold, release, toasts } from '../toast';
</script>

<template>
  <div class="bgr-toasts" aria-live="polite">
    <TransitionGroup name="bgr-toast">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="bgr-toast"
        :class="item.kind"
        :role="item.kind === 'error' ? 'alert' : 'status'"
        @mouseenter="hold(item.id)"
        @mouseleave="release(item.id)"
      >
        <span class="bgr-toast-icon" aria-hidden="true">{{ item.kind === 'error' ? '!' : '✓' }}</span>
        <p>{{ item.text }}</p>
        <button class="bgr-toast-close" :aria-label="$t('common.close')" @click="dismiss(item.id)">&times;</button>
      </div>
    </TransitionGroup>
  </div>
</template>
