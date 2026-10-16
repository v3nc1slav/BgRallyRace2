<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getCity } from '../game';
import { session } from '../session';

const privileges = ref<string[]>([]);

const buildings = [
  { name: 'Бар', text: 'Наемане на служители', to: '/city/bar' },
  { name: 'Магазин за авто части', text: 'Коли, части и гуми', to: '/shop' },
  { name: 'Официална писта', text: 'Ралита, тренировка и записване', to: '/rallies' },
  { name: 'Спонсорски офиси', text: 'Преговори и договори', to: '/sponsors' },
  { name: 'Кметство', text: 'Преговори с кмета и привилегии' },
  { name: 'Полиция', text: 'Сигнали, глоби и подкупи' },
  { name: 'МОЛ', text: 'Дрехи и фитнес' },
  { name: 'Пазар', text: 'Търговия между играчите' },
  { name: 'Банка', text: 'Заеми' },
  { name: 'Черна писта', text: 'Нелегални надпревари' },
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
