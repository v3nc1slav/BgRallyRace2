<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { errorMessage } from './api';
import logo from './assets/BGRallyHD.png';
import AdModal from './components/AdModal.vue';
import ComebackDialog from './components/ComebackDialog.vue';
import ErrorScreen from './components/ErrorScreen.vue';
import TabBar from './components/TabBar.vue';
import { money } from './format';
import { listenPushTaps } from './push';
import { logout, session } from './session';
import { labelTables } from './tableLabels';

const router = useRouter();
const root = ref<HTMLElement>();
let stopLabels: (() => void) | null = null;

async function onLogout() {
  try {
    await logout();
    router.push('/login');
  } catch (error) {
    session.error = errorMessage(error);
  }
}

onMounted(() => {
  if (root.value) {
    stopLabels = labelTables(root.value);
  }
  listenPushTaps((path) => router.push(path));
});
onBeforeUnmount(() => stopLabels?.());
</script>

<template>
  <div v-if="session.fatal" class="bgr">
    <ErrorScreen :message="session.fatal" />
  </div>
  <div v-else ref="root" class="bgr" :class="session.player ? 'bgr-with-tabs' : 'bgr-guest'">
    <header v-if="session.player" class="bgr-top">
      <RouterLink to="/" class="bgr-logo"><img :src="logo" alt="BG Rally Race" /></RouterLink>
      <nav class="bgr-nav">
        <RouterLink to="/">Мениджър</RouterLink>
        <RouterLink to="/garage">Гараж</RouterLink>
        <RouterLink to="/city">Град</RouterLink>
        <RouterLink to="/shop">Магазин</RouterLink>
        <RouterLink to="/rallies">Ралита</RouterLink>
        <RouterLink to="/sponsors">Спонсори</RouterLink>
        <RouterLink to="/standings">Класиране</RouterLink>
        <RouterLink to="/forum">Форум</RouterLink>
        <RouterLink to="/profile">Профил</RouterLink>
      </nav>
      <div class="bgr-stats">
        <span>Ниво <b>{{ session.player.level }}</b></span>
        <b>{{ money(session.player.money) }}</b>
        <span>Енергия <b>{{ session.player.energy }}/{{ session.player.energy_max }}</b></span>
        <button class="bgr-link bgr-logout" @click="onLogout">Изход</button>
      </div>
    </header>
    <div v-else class="bgr-brand"><img :src="logo" alt="BG Rally Race" /></div>
    <p v-if="session.error" class="bgr-banner">{{ session.error }}</p>
    <main class="bgr-main">
      <RouterView />
    </main>
    <TabBar v-if="session.player" @logout="onLogout" />
    <AdModal />
    <ComebackDialog />
  </div>
</template>
