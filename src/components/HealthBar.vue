<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ value: number }>();
const width = computed(() => `${Math.max(0, Math.min(100, props.value))}%`);
const level = computed(() => (props.value < 30 ? 'low' : props.value < 60 ? 'mid' : 'high'));
</script>

<template>
  <span class="bgr-bar" :class="level">
    <span :style="{ width }"></span>
    <em>{{ Math.round(value) }}%</em>
  </span>
</template>
