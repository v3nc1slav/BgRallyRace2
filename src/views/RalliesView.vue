<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { money, when } from '../format';
import { getRallies, type RallySummary } from '../game';
import { useAction } from '../useAction';
import { statusLabel } from './rallyStatus';

const season = ref(0);
const rallies = ref<RallySummary[]>([]);
const { error, run } = useAction();

onMounted(() =>
  run(async () => {
    const data = await getRallies();
    season.value = data.season;
    rallies.value = data.rallies;
  }),
);
</script>

<template>
  <section class="bgr-card">
    <h1>{{ $t('rallies.title') }}<span v-if="season" class="bgr-muted"> · {{ $t('rallies.season', { season }) }}</span></h1>
    <Feedback :error="error" />
    <p v-if="!rallies.length && !error" class="bgr-muted">{{ $t('rallies.none') }}</p>
    <ul class="bgr-list">
      <li v-for="rally in rallies" :key="rally.id">
        <RouterLink :to="`/rallies/${rally.id}`" class="bgr-rally">
          <div>
            <b>{{ rally.name }}</b>
            <small class="bgr-muted">{{ when(rally.start_at) }} · {{ rally.city }}</small>
          </div>
          <div class="bgr-muted">
            <small>{{ $t('rallies.line', { stages: rally.stages.length, km: rally.total_km, cost: money(rally.costs.total) }) }}</small>
          </div>
          <div class="bgr-badges">
            <span v-if="rally.home" class="bgr-tag">{{ $t('rallies.home') }}</span>
            <span v-if="rally.registered" class="bgr-tag bgr-tag-ok">{{ $t('rallies.registered') }}</span>
            <span class="bgr-status" :class="rally.status">{{ statusLabel(rally.status) }}</span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
