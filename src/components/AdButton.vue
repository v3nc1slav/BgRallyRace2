<script setup lang="ts">
import { ref } from 'vue';
import { watchAd } from '../ads';
import { errorMessage } from '../api';
import { toast } from '../toast';

const props = defineProps<{ reward: string; text: string }>();
const emit = defineEmits<{ done: [message: string] }>();
const busy = ref(false);

async function watch() {
  busy.value = true;
  try {
    emit('done', (await watchAd(props.reward)).message);
  } catch (e) {
    toast(errorMessage(e), 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="bgr-actions">
    <button class="bgr-small bgr-secondary" :disabled="busy" @click="watch">{{ text }}</button>
  </div>
</template>
