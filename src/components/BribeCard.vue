<script setup lang="ts">
import { money, when } from '../format';
import type { BribeInfo } from '../game';
import { session } from '../session';
import AdButton from './AdButton.vue';

defineProps<{ title: string; info: BribeInfo; energy: number; busy: boolean; locked?: string }>();
const emit = defineEmits<{ bribe: []; notice: [message: string] }>();
</script>

<template>
  <div class="bgr-panel">
    <h3>{{ title }}</h3>
    <p v-if="info.active_until" class="bgr-ok">{{ $t('bribe.active', { time: when(info.active_until) }) }}</p>
    <p v-else-if="locked" class="bgr-muted">{{ locked }}</p>
    <template v-else-if="info.refused && !session.player?.perks.retry">
      <p class="bgr-error">{{ $t('bribe.refused') }}</p>
      <AdButton reward="retry" :text="$t('common.adRetry')" @done="(text) => emit('notice', text)" />
    </template>
    <template v-else>
      <p v-if="info.refused" class="bgr-ok">{{ $t('bribe.second') }}</p>
      <p class="bgr-muted">{{ $t('bribe.chance', { chance: info.chance }) }}</p>
      <button :disabled="busy" @click="emit('bribe')">{{ $t('bribe.give', { price: money(info.price), energy }) }}</button>
    </template>
  </div>
</template>
