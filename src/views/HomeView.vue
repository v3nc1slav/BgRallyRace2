<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdOffers from '../components/AdOffers.vue';
import HealthBar from '../components/HealthBar.vue';
import { money, when } from '../format';
import { getInbox, getRallies, type InboxItem, type RallySummary } from '../game';
import { session } from '../session';
import { statusLabels } from './rallyStatus';

const next = ref<RallySummary | null>(null);
const inbox = ref<InboxItem[]>([]);

const levelProgress = computed(() => {
  const player = session.player;
  if (!player || player.xp_next === null) {
    return 100;
  }
  return ((player.xp - player.xp_level) / (player.xp_next - player.xp_level)) * 100;
});

onMounted(async () => {
  const [rallies, news] = await Promise.all([getRallies().catch(() => null), getInbox().catch(() => null)]);
  next.value = rallies?.rallies.find((rally) => rally.status !== 'finished') ?? null;
  inbox.value = news?.inbox ?? [];
});
</script>

<template>
  <div v-if="session.player" class="bgr-stack">
    <section class="bgr-card">
      <h1>{{ session.user?.name }}</h1>
      <dl class="bgr-stats-list">
        <dt>Град</dt>
        <dd>{{ session.player.city }}</dd>
        <dt>Работа</dt>
        <dd>
          <template v-if="session.player.job">{{ session.player.job.name }} · {{ money(session.player.job.pay) }}/ден, {{ session.player.job.energy }} енергия</template>
          <RouterLink v-else to="/city/jobs">потърси работа</RouterLink>
        </dd>
        <dt>Ниво {{ session.player.level }}</dt>
        <dd>
          <HealthBar :value="levelProgress" />
          <small class="bgr-muted">
            {{ session.player.xp }}{{ session.player.xp_next !== null ? ` / ${session.player.xp_next}` : '' }} опит
          </small>
        </dd>
        <dt>Пари</dt>
        <dd>{{ money(session.player.money) }}</dd>
        <template v-if="session.player.loan">
          <dt>Заем</dt>
          <dd>
            <RouterLink to="/city/bank">остават {{ money(session.player.loan.remaining) }}</RouterLink>
            <small v-if="session.player.loan.overdue" class="bgr-error">просрочие {{ money(session.player.loan.overdue) }}</small>
            <small v-else class="bgr-muted">вноска {{ money(session.player.loan.next) }} в понеделник</small>
          </dd>
        </template>
        <dt>Енергия</dt>
        <dd>
          <HealthBar :value="(session.player.energy / session.player.energy_max) * 100" />
          <small class="bgr-muted">{{ session.player.energy }} / {{ session.player.energy_max }}</small>
        </dd>
      </dl>
    </section>

    <AdOffers />

    <section v-if="next" class="bgr-card">
      <h2>Следващо рали</h2>
      <RouterLink :to="`/rallies/${next.id}`" class="bgr-rally">
        <div>
          <b>{{ next.name }}</b>
          <small class="bgr-muted">{{ when(next.start_at) }} · {{ next.city }}</small>
        </div>
        <div class="bgr-badges">
          <span v-if="next.registered" class="bgr-tag bgr-tag-ok">записан</span>
          <span class="bgr-status" :class="next.status">{{ statusLabels[next.status] }}</span>
        </div>
      </RouterLink>
    </section>

    <section class="bgr-card">
      <h2>Новини</h2>
      <p v-if="!inbox.length" class="bgr-muted">Все още няма новини.</p>
      <ul v-else class="bgr-chronicle">
        <li v-for="(item, index) in inbox" :key="index">
          <small class="bgr-muted">{{ when(item.at) }}</small>
          {{ item.text }}
        </li>
      </ul>
    </section>
  </div>
</template>
