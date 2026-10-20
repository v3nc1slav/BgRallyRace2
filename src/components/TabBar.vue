<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const emit = defineEmits<{ logout: [] }>();
const route = useRoute();
const open = ref(false);

const more = [
  { to: '/shop', label: 'Магазин' },
  { to: '/sponsors', label: 'Спонсори' },
  { to: '/standings', label: 'Класиране' },
  { to: '/forum', label: 'Форум' },
  { to: '/profile', label: 'Профил' },
  { to: '/settings', label: 'Настройки' },
];

const tabs = [
  { to: '/', label: 'Мениджър', match: (path: string) => path === '/', icon: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
  { to: '/garage', label: 'Гараж', match: (path: string) => path.startsWith('/garage'), icon: 'M3 20V9l9-5 9 5v11h-3v-7H6v7zM8 16h8M8 19h8' },
  { to: '/city', label: 'Град', match: (path: string) => path.startsWith('/city'), icon: 'M3 20h18M5 20V9h5v11M10 20V4h9v16M13 8h3M13 12h3M13 16h3M7 13h1M7 16h1' },
  { to: '/rallies', label: 'Ралита', match: (path: string) => path.startsWith('/rallies'), icon: 'M5 21V4M5 4h11l-2 4 2 4H5' },
];

const moreActive = computed(() => more.some((item) => route.path.startsWith(item.to)));

watch(() => route.fullPath, () => (open.value = false));
</script>

<template>
  <div v-if="open" class="bgr-sheet-backdrop" @click="open = false"></div>
  <div v-if="open" class="bgr-sheet">
    <RouterLink v-for="item in more" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
    <button class="bgr-link" @click="emit('logout')">Изход</button>
  </div>
  <nav class="bgr-tabbar">
    <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" :class="{ active: tab.match(route.path) }">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="tab.icon" /></svg>
      <span>{{ tab.label }}</span>
    </RouterLink>
    <button :class="{ active: moreActive || open }" @click="open = !open">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
      <span>Още</span>
    </button>
  </nav>
</template>
