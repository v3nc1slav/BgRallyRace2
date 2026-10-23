<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { date, money } from '../format';
import { getSponsors, negotiate, type Sponsors } from '../game';
import { useAction } from '../useAction';

const data = ref<Sponsors | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    data.value = (await getSponsors()).sponsors;
  }),
);

async function start(id: number) {
  const result = await run(() => negotiate(id));
  if (result) {
    data.value = result.sponsors;
    message.value = result.message;
  }
}
</script>

<template>
  <div v-if="data" class="bgr-stack">
    <section class="bgr-card">
      <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
      <h1>{{ $t('sponsors.title') }}</h1>
      <p class="bgr-muted">
        {{ $t('sponsors.intro') }}
        {{ $t('sponsors.misses', { count: data.misses_limit }) }}
      </p>
      <Feedback :message="message" :error="error" />
      <div class="bgr-tiles">
        <div v-for="slot in data.slots" :key="slot.slot" class="bgr-tile" :class="{ 'bgr-locked': !slot.unlocked }">
          <span>{{ slot.label }}</span>
          <template v-if="slot.contract">
            <b>{{ slot.contract.sponsor }}</b>
            <template v-if="slot.contract.status === 'negotiating'">
              <small>{{ $t('sponsors.negotiating') }}</small>
              <HealthBar :value="slot.contract.progress" />
            </template>
            <template v-else>
              <small>{{ $t('sponsors.contract', { payment: money(slot.contract.payment), bonus: money(slot.contract.bonus), place: slot.contract.goal_place }) }}</small>
              <small v-if="slot.contract.ends_at">{{ $t('sponsors.until', { date: date(slot.contract.ends_at) }) }}</small>
              <small v-if="slot.contract.misses" class="bgr-error">{{ $t('sponsors.missed', { count: slot.contract.misses }) }}</small>
            </template>
          </template>
          <b v-else-if="slot.unlocked">{{ $t('sponsors.free') }}</b>
          <small v-else>{{ $t('common.fromLevel', { level: slot.unlock_level }) }}</small>
        </div>
      </div>
    </section>

    <section class="bgr-card">
      <h2>{{ $t('sponsors.offers') }}</h2>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead>
            <tr><th>{{ $t('sponsors.sponsor') }}</th><th>{{ $t('sponsors.slot') }}</th><th>{{ $t('sponsors.perRally') }}</th><th>{{ $t('sponsors.goal') }}</th><th>{{ $t('sponsors.term') }}</th><th>{{ $t('sponsors.step') }}</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="offer in data.offers" :key="offer.id" :class="{ 'bgr-locked': offer.locked }">
              <td>
                {{ offer.name }}
                <small class="bgr-muted">{{ offer.city }} <span v-if="offer.local" class="bgr-tag">{{ $t('sponsors.local') }}</span></small>
              </td>
              <td>{{ offer.slot_label }}</td>
              <td>{{ money(offer.payment) }}<small class="bgr-muted">{{ $t('sponsors.bonus', { bonus: money(offer.bonus) }) }}</small></td>
              <td>{{ $t('common.top', { place: offer.goal_place }) }}</td>
              <td>{{ $t('sponsors.weeks', { weeks: offer.weeks }) }}</td>
              <td>+{{ offer.progress_step }}%<small class="bgr-muted">{{ $t('sponsors.risk', { risk: offer.risk }) }}</small></td>
              <td class="bgr-right">
                <small v-if="offer.locked" class="bgr-muted">{{ $t('common.fromLevel', { level: offer.min_level }) }}</small>
                <button v-else-if="offer.available" class="bgr-small" :disabled="busy" @click="start(offer.id)">
                  {{ $t('sponsors.negotiate', { energy: data.energy_cost }) }}
                </button>
                <small v-else class="bgr-muted">{{ $t('sponsors.taken') }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <section v-else class="bgr-card"><Feedback :error="error" /></section>
</template>
