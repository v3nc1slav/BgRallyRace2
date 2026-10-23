<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { t } from '../i18n';
import CityMap from '../components/CityMap.vue';
import { date } from '../format';
import { getCity, type CityBadge, type OwnTrack } from '../game';
import { session } from '../session';

const MODE_KEY = 'bgr-city-mode';

const perks = ref('');
const own = ref(ownPlace());
const badges = ref<CityBadge[]>([]);

function ownPlace(track?: OwnTrack) {
  const status = track?.status ?? '';
  const progress = track?.progress ?? 0;
  const state = { status, progress };
  switch (status) {
    case 'building':
      return { state, place: { name: t('city.own.building'), text: t('city.own.buildingText', { pct: Math.round(progress * 100), date: track?.ready_at ? date(track.ready_at) : '' }), to: '/city/hall' } };
    case 'open':
      return { state, place: { name: t('city.own.open'), text: t('city.own.openText'), to: '/city/track' } };
    case 'closed':
      return { state, place: { name: t('city.own.closed'), text: t('city.own.closedText'), to: '/city/hall' } };
    default:
      return { state, place: { name: t('city.own.plot'), text: t('city.own.plotText'), to: '/city/hall' } };
  }
}
const mode = ref<'map' | 'list'>(readMode());

function readMode(): 'map' | 'list' {
  try {
    return localStorage.getItem(MODE_KEY) === 'list' ? 'list' : 'map';
  } catch {
    return 'map';
  }
}

watch(mode, (value) => {
  try {
    localStorage.setItem(MODE_KEY, value);
  } catch {
    return;
  }
});

const PLACES = [
  { key: 'garage', label: true, to: '/garage' },
  { key: 'hall', to: '/city/hall' },
  { key: 'bank', to: '/city/bank' },
  { key: 'police', to: '/city/police' },
  { key: 'jobs', label: true, to: '/city/jobs' },
  { key: 'mall', to: '/city/mall' },
  { key: 'shop', label: true, to: '/shop' },
  { key: 'market', to: '/city/market' },
  { key: 'bar', to: '/city/bar' },
  { key: 'sponsors', label: true, to: '/sponsors' },
  { key: 'track', label: true, to: '/city/track' },
  { key: 'black', to: '/city/black' },
];

const buildings = computed(() => [
  ...PLACES.map((place) => ({
    key: place.key,
    name: t(`city.place.${place.key}`),
    label: place.label ? t(`city.place.${place.key}Label`) : undefined,
    text: t(`city.place.${place.key}Text`),
    to: place.to,
    mapOnly: false,
  })),
  { key: 'own', name: t('city.own.plot'), label: undefined, text: t('city.own.plotText'), to: '/city/hall', mapOnly: true },
]);

onMounted(async () => {
  const data = await getCity().catch(() => null);
  perks.value = data?.city.perks ?? '';
  own.value = ownPlace(data?.city.own_track);
  badges.value = data?.city.badges ?? [];
});
</script>

<template>
  <section class="bgr-card">
    <h1>{{ session.player?.city }}</h1>

    <div class="bgr-tabs">
      <button :class="{ active: mode === 'map' }" @click="mode = 'map'">{{ $t('city.map') }}</button>
      <button :class="{ active: mode === 'list' }" @click="mode = 'list'">{{ $t('city.list') }}</button>
    </div>

    <template v-if="mode === 'map'">
      <CityMap :name="session.player?.city ?? ''" :perks="perks" :places="buildings" :own="own" :badges="badges" @failed="mode = 'list'" />
      <p class="bgr-muted">{{ $t('city.hint') }}</p>
    </template>

    <template v-else>
      <p v-if="perks" class="bgr-muted">{{ perks }}</p>
      <div class="bgr-buildings">
        <RouterLink v-for="building in buildings.filter((b) => !b.mapOnly)" :key="building.key" :to="building.to" class="bgr-building">
          <b>{{ building.name }}</b>
          <small>{{ building.text }}</small>
        </RouterLink>
      </div>
    </template>
  </section>
</template>
