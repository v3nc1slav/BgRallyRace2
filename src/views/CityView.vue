<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getCity } from '../game';
import { session } from '../session';

const privileges = ref<string[]>([]);

const buildings = [
  { name: 'Бар', text: 'Наемане на служители и чат', to: '/city/bar' },
  { name: 'Магазин за авто части', text: 'Коли, части и гуми', to: '/shop' },
  { name: 'Официална писта', text: 'Тренировки през седмицата', to: '/city/track' },
  { name: 'Спонсорски офиси', text: 'Преговори и договори', to: '/sponsors' },
  { name: 'Кметство', text: 'Разрешения, собствена писта, подкуп', to: '/city/hall' },
  { name: 'Работа', text: 'Заплата срещу енергия всеки ден', to: '/city/jobs' },
  { name: 'Полиция', text: 'Глоби и подкупи', to: '/city/police' },
  { name: 'МОЛ', text: 'Фитнес и дрехи', to: '/city/mall' },
  { name: 'Пазар', text: 'Търговия между играчите', to: '/city/market' },
  { name: 'Банка', text: 'Заеми', to: '/city/bank' },
  { name: 'Черна писта', text: 'Нелегални надпревари и тренировки', to: '/city/black' },
];

onMounted(async () => {
  const data = await getCity().catch(() => null);
  privileges.value = data?.city.privileges ?? [];
});
</script>

<template>
  <section class="bgr-card">
    <h1>{{ session.player?.city }}</h1>
    <div class="bgr-panel bgr-privileges">
      <h3>Привилегии за отборите от града</h3>
      <ul v-if="privileges.length">
        <li v-for="privilege in privileges" :key="privilege">{{ privilege }}</li>
      </ul>
      <p v-else class="bgr-muted">Градът няма привилегии.</p>
    </div>
    <div class="bgr-buildings">
      <template v-for="building in buildings" :key="building.name">
        <RouterLink v-if="building.to" :to="building.to" class="bgr-building">
          <b>{{ building.name }}</b>
          <small>{{ building.text }}</small>
        </RouterLink>
        <div v-else class="bgr-building bgr-locked">
          <b>{{ building.name }}</b>
          <small>{{ building.text }} · скоро</small>
        </div>
      </template>
    </div>
  </section>
</template>
