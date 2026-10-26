<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { answer, dialog } from '../dialog';

const button = ref<HTMLButtonElement>();

function onKey(event: KeyboardEvent) {
  if (dialog.current && event.key === 'Escape') {
    answer(false);
  }
}

watch(
  () => dialog.current,
  async (current) => {
    if (current) {
      await nextTick();
      button.value?.focus();
    }
  },
);

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div v-if="dialog.current" class="bgr-dialog-backdrop" @click.self="answer(false)">
    <div class="bgr-dialog" role="dialog" aria-modal="true" :aria-label="dialog.current.title || dialog.current.text">
      <h2 v-if="dialog.current.title">{{ dialog.current.title }}</h2>
      <p>{{ dialog.current.text }}</p>
      <div class="bgr-actions">
        <button ref="button" @click="answer(true)">{{ dialog.current.ok }}</button>
        <button v-if="dialog.current.cancel" class="bgr-secondary" @click="answer(false)">{{ dialog.current.cancel }}</button>
      </div>
    </div>
  </div>
</template>
