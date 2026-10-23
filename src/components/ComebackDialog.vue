<script setup lang="ts">
import { computed, ref } from 'vue';
import { money } from '../format';
import { resolveComeback } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const info = computed(() => session.player?.comeback ?? null);
const result = ref('');
const { busy, error, run } = useAction();

async function choose(choice: 'fresh' | 'continue') {
  if (choice === 'fresh' && !window.confirm('Да започнеш ли на чисто? Дълговете ще бъдат изчистени.')) {
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
        <h2>Готово</h2>
        <p>{{ result }}</p>
        <button @click="result = ''">Добре</button>
      </template>
      <template v-else-if="info">
        <h2>Добре дошъл отново!</h2>
        <p>Нямаше те {{ info.days }} {{ info.days === 1 ? 'ден' : 'дни' }}. Докато те нямаше, отборът беше на пауза:</p>
        <ul v-if="info.notes.length">
          <li v-for="note in info.notes" :key="note">{{ note }}</li>
        </ul>
        <p v-else class="bgr-muted">Нищо не беше начислявано.</p>
        <template v-if="info.fresh">
          <div class="bgr-panel">
            <p>
              Сметката ти е на минус или имаш просрочие. Можеш да започнеш на чисто: дълговете се изчистват, а парите стават
              <b>{{ money(info.fresh) }}</b>. Нивото, опитът, колите, частите и служителите остават.
            </p>
            <small class="bgr-muted">Новото начало е възможно веднъж на {{ info.cooldown }} дни. След него {{ info.loan_weeks }} седмици не може да се тегли заем.</small>
          </div>
          <button :disabled="busy" @click="choose('fresh')">Започни на чисто</button>
          <button class="bgr-secondary" :disabled="busy" @click="choose('continue')">Продължи с дълга</button>
        </template>
        <button v-else :disabled="busy" @click="choose('continue')">Продължи</button>
        <p v-if="error" class="bgr-error">{{ error }}</p>
      </template>
    </div>
  </div>
</template>
