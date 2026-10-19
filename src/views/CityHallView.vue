<script setup lang="ts">
import { onMounted, ref } from 'vue';
import BribeCard from '../components/BribeCard.vue';
import Feedback from '../components/Feedback.vue';
import { date, money } from '../format';
import { bribe, getHall, negotiateMayor, type HallInfo } from '../game';
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
      <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
      <h1>Кметство</h1>
      <p class="bgr-muted">
        Кметът дава разрешения за гаража и за собствена тренировъчна писта.
        <template v-if="hall">Дрехите ти дават +{{ hall.clothes_bonus }}% в преговорите · <RouterLink to="/city/mall">МОЛ</RouterLink>.</template>
      </p>
      <Feedback :message="message" :error="error" />
    </section>

    <template v-if="hall">
      <section class="bgr-card">
        <h2>Разрешение за гаража</h2>
        <p v-if="hall.permit.next_level === null" class="bgr-muted">Гаражът е на максимално ниво.</p>
        <p v-else-if="hall.permit.has" class="bgr-ok">
          {{ hall.permit.by_bribe ? 'Подкупът на кмета ти дава разрешение.' : 'Имаш разрешение.' }}
          Можеш да подобриш гаража до ниво {{ hall.permit.next_level }} от <RouterLink to="/garage">гаража</RouterLink>.
        </p>
        <p v-else-if="hall.permit.refused_today" class="bgr-error">Кметът отказа днес. Опитай утре.</p>
        <template v-else>
          <p class="bgr-muted">Нужно е за гараж ниво {{ hall.permit.next_level }}. Шанс: {{ hall.permit.chance }}%.</p>
          <button :disabled="busy" @click="negotiate('garage')">Поискай разрешение ({{ hall.energy }} енергия)</button>
        </template>
      </section>

      <section class="bgr-card">
        <h2>Собствена тренировъчна писта</h2>
        <p v-if="(session.player?.level ?? 0) < hall.track.level" class="bgr-muted">Отключва се от ниво {{ hall.track.level }}.</p>
        <template v-else-if="hall.track.status === 'open'">
          <p class="bgr-ok">Пистата е твоя. Тренирай всеки ден без полиция от <RouterLink to="/city/track">официалната писта</RouterLink>.</p>
        </template>
        <p v-else-if="hall.track.status === 'building'" class="bgr-muted">Строи се. Готова на {{ hall.track.ready_at ? date(hall.track.ready_at) : '' }}.</p>
        <p v-else-if="hall.track.banned" class="bgr-error">След разкрития саботаж кметът няма да преговаря за пистата до следващия сезон.</p>
        <p v-else-if="hall.track.refused_today" class="bgr-error">Кметът отказа днес. Опитай утре.</p>
        <template v-else>
          <p class="bgr-muted">
            <template v-if="hall.track.status === 'closed'">Пистата е затворена. При успех кметът я отваря веднага, без нов строеж.</template>
            <template v-else>При одобрение строежът струва {{ money(hall.track.cost) }} и трае {{ hall.track.weeks }} седмици.</template>
            Шанс: {{ hall.track.chance }}%. Пистата остава, ако завършиш сезона в топ 5.
          </p>
          <button :disabled="busy" @click="negotiate('track')">Преговаряй ({{ hall.energy }} енергия)</button>
        </template>
      </section>

      <section class="bgr-card">
        <BribeCard
          :title="`Подкуп на кмета – за ${hall.bribe.days} дни`"
          :info="hall.bribe"
          :energy="hall.energy"
          :busy="busy"
          :locked="(session.player?.level ?? 0) < hall.bribe.level ? `Кметът приема подкупи от ниво ${hall.bribe.level}.` : undefined"
          @bribe="giveBribe"
        />
        <p class="bgr-muted">Подкупът пази от глоби и дава разрешение за гаража без преговори.</p>
      </section>
    </template>
  </div>
</template>
