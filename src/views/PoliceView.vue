<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import BribeCard from '../components/BribeCard.vue';
import Feedback from '../components/Feedback.vue';
import { bribe, getPolice, type PoliceInfo } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const route = useRoute();
const police = ref<PoliceInfo | null>(null);
const { busy, message, error, run } = useAction();
const hall = computed(() => route.path === '/city/hall');

onMounted(() =>
  run(async () => {
    police.value = (await getPolice()).police;
  }),
);

async function give(institution: 'police' | 'mayor') {
  const result = await run(() => bribe(institution));
  if (result) {
    police.value = result.police;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>{{ hall ? 'Кметство' : 'Полиция' }}</h1>
    <p class="bgr-muted">
      {{ hall
        ? 'Кметът може да затвори очите на полицията за цяла седмица. Преговорите с кмета за разрешения и привилегии идват скоро.'
        : 'Полицията следи тренировките на официалната писта през седмицата и черната писта.' }}
    </p>
    <Feedback :message="message" :error="error" />

    <template v-if="police">
      <dl class="bgr-stats-list">
        <dt>Риск на официалната писта</dt>
        <dd>{{ police.risks.official }}%</dd>
        <dt>Риск на черната писта</dt>
        <dd>{{ police.risks.black }}%</dd>
      </dl>

      <BribeCard
        v-if="!hall"
        title="Подкуп на полицията – до края на деня"
        :info="police.police"
        :energy="police.energy"
        :busy="busy"
        @bribe="give('police')"
      />
      <BribeCard
        v-else
        :title="`Подкуп на кмета – за ${police.mayor.days} дни`"
        :info="police.mayor"
        :energy="police.energy"
        :busy="busy"
        :locked="(session.player?.level ?? 0) < police.mayor.level ? `Кметът приема подкупи от ниво ${police.mayor.level}.` : undefined"
        @bribe="give('mayor')"
      />

      <p class="bgr-muted">
        <RouterLink v-if="!hall" to="/city/hall">Подкуп на кмета (по-скъп, но пази цяла седмица)</RouterLink>
        <RouterLink v-else to="/city/police">Подкуп на полицията (само за деня)</RouterLink>
      </p>
    </template>
  </section>
</template>
