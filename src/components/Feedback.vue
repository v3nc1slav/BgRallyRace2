<script setup lang="ts">
import { watch } from 'vue';
import { toast } from '../toast';

const props = defineProps<{ message?: string; error?: string }>();

watch(
  () => props.message,
  (text) => text && toast(text, 'ok'),
);
watch(
  () => props.error,
  (text) => text && toast(text, 'error'),
);
</script>

<template>
  <span hidden></span>
</template>
