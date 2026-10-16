<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { money, when } from '../format';
import { getRallies, type RallySummary } from '../game';
import { useAction } from '../useAction';
import { statusLabels } from './rallyStatus';

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
    <h1>Ралита<span v-if="season" class="bgr-muted"> · сезон {{ season }}</span></h1>
    <Feedback :error="error" />
    <p v-if="!rallies.length && !error" class="bgr-muted">Няма обявени ралита.</p>
    <ul class="bgr-list">
      <li v-for="rally in rallies" :key="rally.id">
        <RouterLink :to="`/rallies/${rally.id}`" class="bgr-rally">
          <div>
            <b>{{ rally.name }}</b>
            <small class="bgr-muted">{{ when(rally.start_at) }} · {{ rally.city }}</small>
          </div>
          <div class="bgr-muted">
            <small>{{ rally.stages.length }} етапа · {{ rally.total_km }} км · {{ money(rally.costs.total) }}</small>
          </div>
          <div class="bgr-badges">
            <span v-if="rally.home" class="bgr-tag">домакин</span>
            <span v-if="rally.registered" class="bgr-tag bgr-tag-ok">записан</span>
            <span class="bgr-status" :class="rally.status">{{ statusLabels[rally.status] }}</span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
