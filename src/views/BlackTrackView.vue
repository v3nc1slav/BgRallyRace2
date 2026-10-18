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
      <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
      <h1>Черна писта</h1>
      <p class="bgr-muted">
        Нелегални надпревари 1 срещу 1 срещу залог. Победителят взима двата залога.
        Всяка надпревара струва {{ black.energy }} енергия, а колата се износва повече.
      </p>
      <dl class="bgr-stats-list">
        <dt>Риск от полицията</dt>
        <dd>{{ black.risk }}% – глоба {{ money(black.fine) }} и конфискуван залог · <RouterLink to="/city/police">подкупи</RouterLink></dd>
        <dt>Залог</dt>
        <dd>от {{ money(black.limits.min) }} до {{ money(black.limits.max) }}</dd>
      </dl>
      <Feedback :message="message" :error="error" />
    </section>

    <section class="bgr-card">
      <h2>Предизвикателства в града</h2>
      <p v-if="!black.challenges.length" class="bgr-muted">Няма отворени предизвикателства.</p>
      <div v-else class="bgr-scroll">
        <table class="bgr-table">
          <tbody>
            <tr v-for="challenge in black.challenges" :key="challenge.id" :class="{ 'bgr-me': challenge.mine }">
              <td>{{ challenge.team }}<small class="bgr-muted">{{ challenge.stage }}</small></td>
              <td>{{ money(challenge.bet) }}</td>
              <td class="bgr-right">
                <button v-if="challenge.mine" class="bgr-small bgr-secondary" :disabled="busy" @click="act(() => cancelChallenge(challenge.id))">Отмени</button>
                <button v-else class="bgr-small" :disabled="busy" @click="act(() => acceptChallenge(challenge.id))">Приеми</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bgr-card">
      <h2>Нова надпревара</h2>
      <div class="bgr-form-row">
        <label>
          Етап
          <select v-model.number="stageId">
            <option v-for="stage in black.stages" :key="stage.id" :value="stage.id">{{ stage.name }} ({{ stage.length_km }} км, {{ stage.surface_label.toLowerCase() }})</option>
          </select>
        </label>
        <label>
          Залог (€)
          <input v-model.number="bet" type="number" :min="black.limits.min" :max="black.limits.max" step="50" />
        </label>
      </div>
      <div class="bgr-actions">
        <button :disabled="busy" @click="act(() => postChallenge(stageId, bet))">Обяви предизвикателство</button>
        <button class="bgr-secondary" :disabled="busy" @click="act(() => raceBot(stageId, bet))">Надпревара с бот</button>
      </div>
    </section>

    <section class="bgr-card">
      <h2>Тренировка</h2>
      <p class="bgr-muted">{{ black.energy }} енергия, по-бързо износване, {{ black.skill_chance }}% шанс за +1 умение. Най-много една тренировка на ден.</p>
      <p v-if="black.trained_today" class="bgr-muted">Екипажът вече тренира днес.</p>
      <button v-else class="bgr-small" :disabled="busy" @click="act(() => trainBlack(stageId))">Тренирай на избрания етап</button>
    </section>

    <section v-if="black.history.length" class="bgr-card">
      <h2>Последни надпревари</h2>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>Съперник</th><th>Етап</th><th>Време</th><th>Залог</th><th>Резултат</th></tr></thead>
          <tbody>
            <tr v-for="row in black.history" :key="row.id">
              <td>{{ row.rival }}<small class="bgr-muted">{{ when(row.at) }}</small></td>
              <td>{{ row.stage }}</td>
              <td>{{ duration(row.my_ms) }}<small class="bgr-muted">{{ duration(row.rival_ms) }}</small></td>
              <td>{{ money(row.bet) }}</td>
              <td>
                <span :class="row.won ? 'bgr-ok' : 'bgr-error'">{{ row.won ? 'победа' : 'загуба' }}</span>
                <small v-if="row.caught" class="bgr-error">хванат от полицията</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <section v-else class="bgr-card"><Feedback :error="error" /></section>
</template>
