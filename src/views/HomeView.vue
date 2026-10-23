<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AdOffers from '../components/AdOffers.vue';
import HealthBar from '../components/HealthBar.vue';
import { money, when } from '../format';
import { getInbox, getRallies, type InboxItem, type RallySummary } from '../game';
import { session } from '../session';
import { statusLabel } from './rallyStatus';

const next = ref<RallySummary | null>(null);
const inbox = ref<InboxItem[]>([]);

const levelProgress = computed(() => {
  const player = session.player;
  if (!player || player.xp_next === null) {
    return 100;
  }
  return Math.min(100, Math.max(0, ((player.xp - player.xp_level) / (player.xp_next - player.xp_level)) * 100));
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
        <dt>{{ $t('home.city') }}</dt>
        <dd>{{ session.player.city }}</dd>
        <dt>{{ $t('home.job') }}</dt>
        <dd>
          <template v-if="session.player.job">{{ $t('home.jobLine', { name: session.player.job.name, pay: money(session.player.job.pay), energy: session.player.job.energy }) }}</template>
          <RouterLink v-else to="/city/jobs">{{ $t('home.findJob') }}</RouterLink>
        </dd>
        <dt>{{ $t('home.level', { level: session.player.level }) }}</dt>
        <dd>
          <HealthBar :value="levelProgress" />
          <small class="bgr-muted">
            {{ session.player.xp }}{{ session.player.xp_next !== null ? ` / ${session.player.xp_next}` : '' }} {{ $t('home.xp') }}
          </small>
          <small class="bgr-muted">{{ $t('home.xpToday', { used: session.player.xp_today, cap: session.player.xp_cap }) }}</small>
        </dd>
        <dt>{{ $t('home.money') }}</dt>
        <dd>{{ money(session.player.money) }}</dd>
        <template v-if="session.player.loan">
          <dt>{{ $t('home.loan') }}</dt>
          <dd>
            <RouterLink to="/city/bank">{{ $t('home.loanLeft', { amount: money(session.player.loan.remaining) }) }}</RouterLink>
            <small v-if="session.player.loan.overdue" class="bgr-error">{{ $t('home.overdue', { amount: money(session.player.loan.overdue) }) }}</small>
            <small v-else class="bgr-muted">{{ $t('home.installment', { amount: money(session.player.loan.next) }) }}</small>
          </dd>
        </template>
        <dt>{{ $t('home.energy') }}</dt>
        <dd>
          <HealthBar :value="(session.player.energy / session.player.energy_max) * 100" />
          <small class="bgr-muted">{{ session.player.energy }} / {{ session.player.energy_max }}</small>
          <small v-if="session.player.fatigue.pct < 100" class="bgr-error">
            {{ $t('home.tired', { pct: session.player.fatigue.pct, threshold: session.player.fatigue.threshold }) }}
          </small>
          <small v-else-if="session.player.fatigue.days > 0" class="bgr-muted">
            {{ $t('home.tiredDays', { days: session.player.fatigue.days, limit: session.player.fatigue.limit }) }}
          </small>
        </dd>
      </dl>
    </section>

    <AdOffers />

    <section v-if="next" class="bgr-card">
      <h2>{{ $t('home.nextRally') }}</h2>
      <RouterLink :to="`/rallies/${next.id}`" class="bgr-rally">
        <div>
          <b>{{ next.name }}</b>
          <small class="bgr-muted">{{ when(next.start_at) }} · {{ next.city }}</small>
        </div>
        <div class="bgr-badges">
          <span v-if="next.registered" class="bgr-tag bgr-tag-ok">{{ $t('home.registered') }}</span>
          <span class="bgr-status" :class="next.status">{{ statusLabel(next.status) }}</span>
        </div>
      </RouterLink>
    </section>

    <section class="bgr-card">
      <h2>{{ $t('home.news') }}</h2>
      <p v-if="!inbox.length" class="bgr-muted">{{ $t('home.noNews') }}</p>
      <ul v-else class="bgr-chronicle">
        <li v-for="(item, index) in inbox" :key="index">
          <small class="bgr-muted">{{ when(item.at) }}</small>
          {{ item.text }}
        </li>
      </ul>
    </section>
  </div>
</template>
