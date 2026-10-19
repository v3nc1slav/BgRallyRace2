<script setup lang="ts">
import { useRouter } from 'vue-router';
import { errorMessage } from './api';
import AdModal from './components/AdModal.vue';
import { money } from './format';
import { logout, session } from './session';

const router = useRouter();

async function onLogout() {
  try {
    await logout();
    router.push('/login');
  } catch (error) {
    session.error = errorMessage(error);
  }
}
</script>

<template>
  <div class="bgr">
    <header v-if="session.player" class="bgr-top">
      <strong class="bgr-logo">BG Rally</strong>
      <nav class="bgr-nav">
        <RouterLink to="/">Мениджър</RouterLink>
        <RouterLink to="/garage">Гараж</RouterLink>
        <RouterLink to="/city">Град</RouterLink>
        <RouterLink to="/shop">Магазин</RouterLink>
        <RouterLink to="/rallies">Ралита</RouterLink>
        <RouterLink to="/sponsors">Спонсори</RouterLink>
        <RouterLink to="/standings">Класиране</RouterLink>
        <RouterLink to="/forum">Форум</RouterLink>
      </nav>
      <div class="bgr-stats">
        <span>Ниво <b>{{ session.player.level }}</b></span>
        <b>{{ money(session.player.money) }}</b>
        <span>Енергия <b>{{ session.player.energy }}/{{ session.player.energy_max }}</b></span>
        <button class="bgr-link" @click="onLogout">Изход</button>
      </div>
    </header>
    <p v-if="session.error" class="bgr-banner">{{ session.error }}</p>
    <main class="bgr-main">
      <RouterView />
    </main>
    <AdModal />
  </div>
</template>
