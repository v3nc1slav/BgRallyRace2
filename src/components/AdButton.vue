<script setup lang="ts">
import { ref } from 'vue';
import { watchAd } from '../ads';
import { errorMessage } from '../api';

const props = defineProps<{ reward: string; text: string }>();
const emit = defineEmits<{ done: [message: string] }>();
const busy = ref(false);
const error = ref('');

async function watch() {
  busy.value = true;
  error.value = '';
  try {
    emit('done', (await watchAd(props.reward)).message);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="bgr-actions">
    <button class="bgr-small bgr-secondary" :disabled="busy" @click="watch">{{ text }}</button>
    <small v-if="error" class="bgr-error">{{ error }}</small>
  </div>
</template>
