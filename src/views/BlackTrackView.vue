<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import Feedback from '../components/Feedback.vue';
import { duration, money, when } from '../format';
import { acceptChallenge, cancelChallenge, getBlack, postChallenge, raceBot, trainBlack, type BlackInfo } from '../game';
import { useAction } from '../useAction';

const black = ref<BlackInfo | null>(null);
const stageId = ref(0);
const bet = ref(100);
const { busy, message, error, run } = useAction();

watch(black, (data) => {
  if (data && !stageId.value) {
    stageId.value = data.stages[0]?.id ?? 0;
    bet.value = data.limits.min;
  }
});

onMounted(() =>
  run(async () => {
    black.value = (await getBlack()).black;
  }),
);

async function act(task: () => Promise<{ black: BlackInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    black.value = result.black;
    message.value = result.message;
  }
}
</script>

<template>
  <div v-if="black" class="bgr-stack">
    <section class="bgr-card">
      <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
      <h1>{{ $t('black.title') }}</h1>
      <p class="bgr-muted">
        {{ $t('black.intro') }}
        {{ $t('black.cost', { energy: black.energy }) }}
      </p>
      <dl class="bgr-stats-list">
        <dt>{{ $t('black.risk') }}</dt>
        <dd>{{ $t('black.riskValue', { risk: black.risk, fine: money(black.fine) }) }} <RouterLink to="/city/police">{{ $t('common.bribes') }}</RouterLink></dd>
        <dt>{{ $t('black.bet') }}</dt>
        <dd>{{ $t('black.betRange', { min: money(black.limits.min), max: money(black.limits.max) }) }}</dd>
      </dl>
      <Feedback :message="message" :error="error" />
    </section>

    <section class="bgr-card">
      <h2>{{ $t('black.challenges') }}</h2>
      <p v-if="!black.challenges.length" class="bgr-muted">{{ $t('black.none') }}</p>
      <div v-else class="bgr-scroll">
        <table class="bgr-table">
          <tbody>
            <tr v-for="challenge in black.challenges" :key="challenge.id" :class="{ 'bgr-me': challenge.mine }">
              <td>{{ challenge.team }}<small class="bgr-muted">{{ challenge.stage }}</small></td>
              <td>{{ money(challenge.bet) }}</td>
              <td class="bgr-right">
                <button v-if="challenge.mine" class="bgr-small bgr-secondary" :disabled="busy" @click="act(() => cancelChallenge(challenge.id))">{{ $t('black.cancel') }}</button>
                <button v-else class="bgr-small" :disabled="busy" @click="act(() => acceptChallenge(challenge.id))">{{ $t('black.accept') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bgr-card">
      <h2>{{ $t('black.new') }}</h2>
      <div class="bgr-form-row">
        <label>
          {{ $t('black.stage') }}
          <select v-model.number="stageId">
            <option v-for="stage in black.stages" :key="stage.id" :value="stage.id">{{ $t('black.stageOption', { name: stage.name, km: stage.length_km, surface: stage.surface_label.toLowerCase() }) }}</option>
          </select>
        </label>
        <label>
          {{ $t('black.betInput') }}
          <input v-model.number="bet" type="number" :min="black.limits.min" :max="black.limits.max" step="50" />
        </label>
      </div>
      <div class="bgr-actions">
        <button :disabled="busy" @click="act(() => postChallenge(stageId, bet))">{{ $t('black.post') }}</button>
        <button class="bgr-secondary" :disabled="busy" @click="act(() => raceBot(stageId, bet))">{{ $t('black.bot') }}</button>
      </div>
    </section>

    <section class="bgr-card">
      <h2>{{ $t('black.training') }}</h2>
      <p class="bgr-muted">{{ $t('black.trainingInfo', { energy: black.energy, chance: black.skill_chance }) }}</p>
      <p v-if="black.trained_today" class="bgr-muted">{{ $t('common.trainedToday') }}</p>
      <button v-else class="bgr-small" :disabled="busy" @click="act(() => trainBlack(stageId))">{{ $t('black.train') }}</button>
    </section>

    <section v-if="black.history.length" class="bgr-card">
      <h2>{{ $t('black.history') }}</h2>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>{{ $t('black.rival') }}</th><th>{{ $t('black.stage') }}</th><th>{{ $t('black.time') }}</th><th>{{ $t('black.bet') }}</th><th>{{ $t('black.result') }}</th></tr></thead>
          <tbody>
            <tr v-for="row in black.history" :key="row.id">
              <td>{{ row.rival }}<small class="bgr-muted">{{ when(row.at) }}</small></td>
              <td>{{ row.stage }}</td>
              <td>{{ duration(row.my_ms) }}<small class="bgr-muted">{{ duration(row.rival_ms) }}</small></td>
              <td>{{ money(row.bet) }}</td>
              <td>
                <span :class="row.won ? 'bgr-ok' : 'bgr-error'">{{ row.won ? $t('black.win') : $t('black.loss') }}</span>
                <small v-if="row.caught" class="bgr-error">{{ $t('black.caught') }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <section v-else class="bgr-card"><Feedback :error="error" /></section>
</template>
