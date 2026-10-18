<script setup lang="ts">
import { money, when } from '../format';
import type { BribeInfo } from '../game';

defineProps<{ title: string; info: BribeInfo; energy: number; busy: boolean; locked?: string }>();
const emit = defineEmits<{ bribe: [] }>();
</script>

<template>
  <div class="bgr-panel">
    <h3>{{ title }}</h3>
    <p v-if="info.active_until" class="bgr-ok">Действа до {{ when(info.active_until) }}.</p>
    <p v-else-if="info.refused" class="bgr-error">Отказа подкуп тази седмица. Следващ опит – от понеделник.</p>
    <p v-else-if="locked" class="bgr-muted">{{ locked }}</p>
    <template v-else>
      <p class="bgr-muted">Шанс да го приеме: {{ info.chance }}%. Ако откаже, губиш енергията, но не и парите.</p>
      <button :disabled="busy" @click="emit('bribe')">Подкупи ({{ money(info.price) }}, {{ energy }} енергия)</button>
    </template>
  </div>
</template>
