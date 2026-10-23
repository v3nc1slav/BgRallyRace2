<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { money } from '../format';
import { getTrack, trainOfficial, trainOwn, type TrackInfo } from '../game';
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

async function trainOnOwn() {
  const result = await run(() => trainOwn());
  if (result) {
    track.value = result.track;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1>{{ $t('track.title') }}</h1>
    <p class="bgr-muted">
      {{ $t('track.intro') }}
      {{ $t('track.calendar') }} <RouterLink to="/rallies">{{ $t('track.calendarLink') }}</RouterLink>.
    </p>
    <Feedback :message="message" :error="error" />

    <template v-if="track">
      <dl class="bgr-stats-list">
        <dt>{{ $t('track.risk') }}</dt>
        <dd>{{ $t('track.riskValue', { risk: track.risk, fine: money(track.fine) }) }} <RouterLink to="/city/police">{{ $t('common.bribes') }}</RouterLink></dd>
        <dt>{{ $t('track.skill') }}</dt>
        <dd>{{ $t('track.skillValue', { chance: track.skill_chance }) }}</dd>
        <dt>{{ $t('track.price') }}</dt>
        <dd>{{ $t('track.priceValue', { energy: track.energy }) }}</dd>
      </dl>
      <div v-if="track.own.status" class="bgr-panel">
        <h3>{{ $t('track.own') }}</h3>
        <template v-if="track.own.status === 'open'">
          <p class="bgr-muted">
            {{ $t('track.ownInfo', { km: track.own.km, energy: track.energy, fuel: money(track.own.fuel) }) }}
          </p>
          <p v-if="track.trained_today" class="bgr-muted">{{ $t('common.trainedToday') }}</p>
          <button v-else :disabled="busy" @click="trainOnOwn">{{ $t('track.trainOwn') }}</button>
        </template>
        <p v-else-if="track.own.status === 'building'" class="bgr-muted">{{ $t('track.ownBuilding') }} <RouterLink to="/city/hall">{{ $t('track.hall') }}</RouterLink>.</p>
        <p v-else class="bgr-muted">{{ $t('track.ownClosed') }} <RouterLink to="/city/hall">{{ $t('track.hallShort') }}</RouterLink>.</p>
      </div>

      <p v-if="!track.weekday" class="bgr-error">{{ $t('track.weekend') }}</p>
      <p v-else-if="track.trained_today" class="bgr-muted">{{ $t('common.trainedToday') }}</p>

      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>{{ $t('track.stage') }}</th><th>{{ $t('track.surface') }}</th><th>{{ $t('track.profile') }}</th><th>{{ $t('track.difficulty') }}</th><th>{{ $t('track.fuel') }}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="stage in track.stages" :key="stage.id">
              <td>{{ stage.name }}<small class="bgr-muted">{{ $t('common.km', { km: stage.length_km }) }}</small></td>
              <td>{{ stage.surface_label }}</td>
              <td>{{ stage.profile_label }}</td>
              <td>{{ stage.difficulty }}/10</td>
              <td>{{ money(stage.fuel) }}</td>
              <td class="bgr-right">
                <button class="bgr-small" :disabled="busy || !track.weekday || track.trained_today" @click="train(stage.id)">{{ $t('track.train') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
