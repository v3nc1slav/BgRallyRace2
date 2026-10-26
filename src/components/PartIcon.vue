<script setup lang="ts">
defineProps<{ type: string; x: number; y: number }>();
</script>

<template>
  <g :transform="`translate(${x} ${y})`">
    <template v-if="type === 'engine'">
      <rect x="2" y="9" width="26" height="15" rx="2" fill="#6b7280" stroke="#2b2f37" stroke-width="1.5" />
      <rect v-for="index in 3" :key="index" :x="index * 8 - 3" y="3" width="5" height="7" fill="#9aa1ad" stroke="#2b2f37" stroke-width="1" />
      <rect x="8" y="13" width="14" height="4" fill="#e63946" />
    </template>
    <template v-else-if="type === 'turbo'">
      <circle cx="13" cy="15" r="10" fill="#f4a261" stroke="#2b2f37" stroke-width="1.5" />
      <circle cx="13" cy="15" r="5" fill="none" stroke="#2b2f37" stroke-width="2" />
      <rect x="20" y="4" width="8" height="7" fill="#9aa1ad" stroke="#2b2f37" stroke-width="1" />
    </template>
    <template v-else-if="type === 'gearbox'">
      <circle cx="15" cy="14" r="10" fill="#457b9d" stroke="#d7dbe0" stroke-width="4" stroke-dasharray="3 2.2" />
      <circle cx="15" cy="14" r="4" fill="#d7dbe0" />
    </template>
    <template v-else-if="type === 'suspension'">
      <rect x="13" y="1" width="4" height="24" fill="#9aa1ad" />
      <polyline points="8,5 22,8 8,11 22,14 8,17 22,20" fill="none" stroke="#2a9d8f" stroke-width="3" stroke-linejoin="round" />
    </template>
    <template v-else-if="type === 'brakes'">
      <circle cx="15" cy="14" r="11" fill="#9aa1ad" stroke="#2b2f37" stroke-width="1.5" />
      <circle cx="15" cy="14" r="4" fill="#5b6270" />
      <path d="M6 7 A12 12 0 0 1 17 2 L17 8 A7 7 0 0 0 10 11 Z" fill="#d62828" />
    </template>
    <template v-else>
      <rect x="1" y="7" width="28" height="4" fill="#8d99ae" />
      <rect x="1" y="17" width="28" height="4" fill="#8d99ae" />
      <rect v-for="index in 4" :key="index" :x="index * 7 - 5" y="7" width="3" height="14" fill="#8d99ae" />
    </template>
  </g>
</template>
