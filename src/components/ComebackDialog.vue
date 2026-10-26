<script setup lang="ts">
import { computed, ref } from 'vue';
import { ask } from '../dialog';
import { money } from '../format';
import { resolveComeback } from '../game';
import { t } from '../i18n';
import { session } from '../session';
import { useAction } from '../useAction';

const info = computed(() => session.player?.comeback ?? null);
const result = ref('');
const { busy, error, run } = useAction();

async function choose(choice: 'fresh' | 'continue') {
  if (choice === 'fresh' && !await ask(t('comeback.confirm'))) {
    return;
  }
  const response = await run(() => resolveComeback(choice));
  if (response) {
    result.value = response.message;
  }
}
</script>

<template>
  <div v-if="info || result" class="bgr-ad-overlay">
    <div class="bgr-ad bgr-comeback">
      <template v-if="result">
        <h2>{{ $t('comeback.done') }}</h2>
        <p>{{ result }}</p>
        <button @click="result = ''">{{ $t('comeback.ok') }}</button>
      </template>
      <template v-else-if="info">
        <h2>{{ $t('comeback.title') }}</h2>
        <p>{{ $t('comeback.away', { days: info.days }, info.days === 1 ? 1 : 2) }}</p>
        <ul v-if="info.notes.length">
          <li v-for="note in info.notes" :key="note">{{ note }}</li>
        </ul>
        <p v-else class="bgr-muted">{{ $t('comeback.nothing') }}</p>
        <template v-if="info.fresh">
          <div class="bgr-panel">
            <p>{{ $t('comeback.fresh', { amount: money(info.fresh) }) }}</p>
            <small class="bgr-muted">{{ $t('comeback.freshRules', { days: info.cooldown, weeks: info.loan_weeks }) }}</small>
          </div>
          <button :disabled="busy" @click="choose('fresh')">{{ $t('comeback.freshButton') }}</button>
          <button class="bgr-secondary" :disabled="busy" @click="choose('continue')">{{ $t('comeback.keepDebt') }}</button>
        </template>
        <button v-else :disabled="busy" @click="choose('continue')">{{ $t('comeback.continue') }}</button>
        <p v-if="error" class="bgr-error">{{ error }}</p>
      </template>
    </div>
  </div>
</template>
