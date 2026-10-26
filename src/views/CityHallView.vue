<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ask } from '../dialog';
import { t } from '../i18n';
import AdButton from '../components/AdButton.vue';
import BribeCard from '../components/BribeCard.vue';
import Feedback from '../components/Feedback.vue';
import { date, money } from '../format';
import { bribe, getHall, moveCity, negotiateMayor, type HallInfo } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const hall = ref<HallInfo | null>(null);
const { busy, message, error, run } = useAction();

async function load() {
  const data = await run(() => getHall());
  if (data) {
    hall.value = data.hall;
  }
}

onMounted(load);

async function negotiate(kind: 'garage' | 'track') {
  const result = await run(() => negotiateMayor(kind));
  if (result) {
    hall.value = result.hall;
    message.value = result.message;
  }
}

const target = ref(0);
const targetCity = computed(() => hall.value?.move.cities.find((city) => city.id === target.value) ?? null);

async function move() {
  if (!targetCity.value || !hall.value) {
    return;
  }
  if (!await ask(t('hall.moveConfirm', { city: targetCity.value.name, cost: money(hall.value.move.cost) }))) {
    return;
  }
  const result = await run(() => moveCity(target.value));
  if (result) {
    hall.value = result.hall;
    message.value = result.message;
    target.value = 0;
  }
}

async function giveBribe() {
  const result = await run(() => bribe('mayor'));
  if (result) {
    message.value = result.message;
    await load();
    message.value = result.message;
  }
}
</script>

<template>
  <div class="bgr-stack">
    <section class="bgr-card">
      <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
      <h1>{{ $t('hall.title') }}</h1>
      <p class="bgr-muted">
        {{ $t('hall.intro') }}
        <template v-if="hall">{{ $t('hall.clothes', { pct: hall.clothes_bonus }) }} <RouterLink to="/city/mall">{{ $t('hall.mall') }}</RouterLink>.</template>
      </p>
      <Feedback :message="message" :error="error" />
    </section>

    <template v-if="hall">
      <section class="bgr-card">
        <h2>{{ $t('hall.permit') }}</h2>
        <p v-if="hall.permit.next_level === null" class="bgr-muted">{{ $t('hall.maxGarage') }}</p>
        <p v-else-if="hall.permit.has" class="bgr-ok">
          {{ hall.permit.by_bribe ? $t('hall.byBribe') : $t('hall.hasPermit') }}
          {{ $t('hall.canUpgrade', { level: hall.permit.next_level }) }} <RouterLink to="/garage">{{ $t('hall.garage') }}</RouterLink>.
        </p>
        <template v-else-if="hall.permit.refused_today && !session.player?.perks.retry">
          <p class="bgr-error">{{ $t('hall.refused') }}</p>
          <AdButton reward="retry" :text="$t('common.adRetry')" @done="(text) => (message = text)" />
        </template>
        <template v-else>
          <p class="bgr-muted">{{ $t('hall.permitNeed', { level: hall.permit.next_level, chance: hall.permit.chance }) }}</p>
          <button :disabled="busy" @click="negotiate('garage')">{{ $t('hall.askPermit', { energy: hall.energy }) }}</button>
        </template>
      </section>

      <section class="bgr-card">
        <h2>{{ $t('hall.track') }}</h2>
        <p v-if="(session.player?.level ?? 0) < hall.track.level" class="bgr-muted">{{ $t('hall.trackLevel', { level: hall.track.level }) }}</p>
        <template v-else-if="hall.track.status === 'open'">
          <p class="bgr-ok">{{ $t('hall.trackOpen') }} <RouterLink to="/city/track">{{ $t('hall.official') }}</RouterLink>.</p>
        </template>
        <p v-else-if="hall.track.status === 'building'" class="bgr-muted">{{ $t('hall.building', { date: hall.track.ready_at ? date(hall.track.ready_at) : '' }) }}</p>
        <p v-else-if="hall.track.banned" class="bgr-error">{{ $t('hall.banned') }}</p>
        <template v-else-if="hall.track.refused_today && !session.player?.perks.retry">
          <p class="bgr-error">{{ $t('hall.refused') }}</p>
          <AdButton reward="retry" :text="$t('common.adRetry')" @done="(text) => (message = text)" />
        </template>
        <template v-else>
          <p class="bgr-muted">
            <template v-if="hall.track.status === 'closed'">{{ $t('hall.closed') }}</template>
            <template v-else>{{ $t('hall.cost', { cost: money(hall.track.cost), weeks: hall.track.weeks }) }}</template>
            {{ $t('hall.chance', { chance: hall.track.chance }) }}
          </p>
          <button :disabled="busy" @click="negotiate('track')">{{ $t('hall.negotiate', { energy: hall.energy }) }}</button>
        </template>
      </section>

      <section class="bgr-card">
        <BribeCard
          :title="$t('hall.bribeTitle', { days: hall.bribe.days })"
          :info="hall.bribe"
          :energy="hall.energy"
          :busy="busy"
          :locked="(session.player?.level ?? 0) < hall.bribe.level ? $t('hall.bribeLevel', { level: hall.bribe.level }) : undefined"
          @bribe="giveBribe"
          @notice="(text) => (message = text)"
        />
        <p class="bgr-muted">{{ $t('hall.bribeHint') }}</p>
      </section>

      <section class="bgr-card">
        <h2>{{ $t('hall.move') }}</h2>
        <p class="bgr-muted">{{ $t('hall.moveRules', { cost: money(hall.move.cost), energy: hall.move.energy, city: session.player?.city ?? '', risk: hall.move.sponsor_risk }) }}</p>
        <p v-if="hall.move.blocked" class="bgr-error">{{ hall.move.blocked }}</p>
        <template v-else>
          <div class="bgr-filters">
            <select v-model.number="target">
              <option :value="0" disabled>{{ $t('hall.pickCity') }}</option>
              <option v-for="city in hall.move.cities" :key="city.id" :value="city.id">{{ city.name }}</option>
            </select>
            <button :disabled="busy || !targetCity" @click="move">{{ $t('hall.moveButton') }}</button>
          </div>
          <p v-if="targetCity" class="bgr-muted">
            {{ $t('hall.cityInfo', { list: targetCity.privileges.length ? targetCity.privileges.join(', ') : $t('hall.none'), pct: targetCity.price_pct }) }}
          </p>
        </template>
      </section>
    </template>
  </div>
</template>
