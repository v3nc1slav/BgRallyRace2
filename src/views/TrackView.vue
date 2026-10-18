<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { money } from '../format';
import { getTrack, trainOfficial, type TrackInfo } from '../game';
import { useAction } from '../useAction';

const track = ref<TrackInfo | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    track.value = (await getTrack()).track;
  }),
);

async function train(stageId: number) {
  const result = await run(() => trainOfficial(stageId));
  if (result) {
    track.value = result.track;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>Официална писта</h1>
    <p class="bgr-muted">
      Тук се карат ралитата на града. От понеделник до петък екипажът може да тренира на етапите тайно, но полицията следи.
      Записване за ралитата има в <RouterLink to="/rallies">календара</RouterLink>.
    </p>
    <Feedback :message="message" :error="error" />

    <template v-if="track">
      <dl class="bgr-stats-list">
        <dt>Риск от глоба</dt>
        <dd>{{ track.risk }}% (глоба {{ money(track.fine) }}) · <RouterLink to="/city/police">подкупи</RouterLink></dd>
        <dt>Шанс за +1 умение</dt>
        <dd>{{ track.skill_chance }}% за пилота и за навигатора</dd>
        <dt>Цена</dt>
        <dd>{{ track.energy }} енергия + гориво</dd>
      </dl>
      <p v-if="!track.weekday" class="bgr-error">Днес е почивен ден. Тренировки има само от понеделник до петък.</p>
      <p v-else-if="track.trained_today" class="bgr-muted">Екипажът вече тренира днес.</p>

      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>Етап</th><th>Настилка</th><th>Характер</th><th>Трудност</th><th>Гориво</th><th></th></tr></thead>
          <tbody>
            <tr v-for="stage in track.stages" :key="stage.id">
              <td>{{ stage.name }}<small class="bgr-muted">{{ stage.length_km }} км</small></td>
              <td>{{ stage.surface_label }}</td>
              <td>{{ stage.profile_label }}</td>
              <td>{{ stage.difficulty }}/10</td>
              <td>{{ money(stage.fuel) }}</td>
              <td class="bgr-right">
                <button class="bgr-small" :disabled="busy || !track.weekday || track.trained_today" @click="train(stage.id)">Тренирай</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
