<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import CityMap from '../components/CityMap.vue';
import { getCity } from '../game';
import { session } from '../session';

const MODE_KEY = 'bgr-city-mode';

const perks = ref('');
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
];

onMounted(async () => {
  const data = await getCity().catch(() => null);
  perks.value = data?.city.perks ?? '';
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
      <CityMap :name="session.player?.city ?? ''" :perks="perks" :places="buildings" @failed="mode = 'list'" />
      <p class="bgr-muted">Посочи или докосни сграда, за да влезеш. Табелата с името на града показва привилегиите му.</p>
    </template>

    <template v-else>
      <p v-if="perks" class="bgr-muted">{{ perks }}</p>
      <div class="bgr-buildings">
        <RouterLink v-for="building in buildings" :key="building.key" :to="building.to" class="bgr-building">
          <b>{{ building.name }}</b>
          <small>{{ building.text }}</small>
        </RouterLink>
      </div>
    </template>
  </section>
</template>
