<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
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
      return { state, place: { name: 'Тренировъчна писта – строи се', text: `Строежът е на ${Math.round(progress * 100)}%. Готова на ${track?.ready_at ? date(track.ready_at) : ''}.`, to: '/city/hall' } };
    case 'open':
      return { state, place: { name: 'Твоята тренировъчна писта', text: 'Тренирай всеки ден без полиция', to: '/city/track' } };
    case 'closed':
      return { state, place: { name: 'Тренировъчна писта – затворена', text: 'Нужни са нови преговори с кмета', to: '/city/hall' } };
    default:
      return { state, place: { name: 'Парцел за тренировъчна писта', text: 'Преговори с кмета за собствена писта', to: '/city/hall' } };
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

const buildings = [
  { key: 'garage', name: 'Твоят гараж', label: 'Гараж', text: 'Колата, складът и екипажът', to: '/garage' },
  { key: 'hall', name: 'Кметство', text: 'Разрешения, собствена писта, подкуп, смяна на града', to: '/city/hall' },
  { key: 'bank', name: 'Банка', text: 'Заеми и финанси', to: '/city/bank' },
  { key: 'police', name: 'Полиция', text: 'Глоби, подкупи и сигнали за саботаж', to: '/city/police' },
  { key: 'jobs', name: 'Бюро по труда', label: 'Работа', text: 'Работа срещу заплата всеки ден', to: '/city/jobs' },
  { key: 'mall', name: 'МОЛ', text: 'Фитнес и дрехи', to: '/city/mall' },
  { key: 'shop', name: 'Магазин за авто части', label: 'Авточасти', text: 'Коли, части и гуми', to: '/shop' },
  { key: 'market', name: 'Пазар', text: 'Търговия между играчите', to: '/city/market' },
  { key: 'bar', name: 'Бар', text: 'Служители, слухове и чат', to: '/city/bar' },
  { key: 'sponsors', name: 'Спонсорски офиси', label: 'Спонсори', text: 'Преговори и договори', to: '/sponsors' },
  { key: 'track', name: 'Официална писта', label: 'Писта', text: 'Тренировки през седмицата', to: '/city/track' },
  { key: 'black', name: 'Черна писта', text: 'Нелегални надпревари и тренировки', to: '/city/black' },
  { key: 'own', name: 'Парцел за тренировъчна писта', text: 'Преговори с кмета за собствена писта', to: '/city/hall', mapOnly: true },
];

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
      <button :class="{ active: mode === 'map' }" @click="mode = 'map'">Карта</button>
      <button :class="{ active: mode === 'list' }" @click="mode = 'list'">Списък</button>
    </div>

    <template v-if="mode === 'map'">
      <CityMap :name="session.player?.city ?? ''" :perks="perks" :places="buildings" :own="own" :badges="badges" @failed="mode = 'list'" />
      <p class="bgr-muted">Посочи или докосни сграда, за да влезеш. Табелата с името на града показва привилегиите му.</p>
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
