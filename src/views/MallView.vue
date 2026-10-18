<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money } from '../format';
import { getMall, trainFitness, type MallInfo } from '../game';
import { useAction } from '../useAction';

const mall = ref<MallInfo | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    mall.value = (await getMall()).mall;
  }),
);

async function train(staffId: number) {
  const result = await run(() => trainFitness(staffId));
  if (result) {
    mall.value = result.mall;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>МОЛ</h1>
    <h2>Фитнес</h2>
    <p class="bgr-muted">
      Физическите умения намаляват умората в дългите ралита, затова на последните етапи екипажът греши по-малко.
      <template v-if="mall">Една тренировка: {{ mall.energy }} енергия и {{ money(mall.price) }} за +{{ mall.gain }}, веднъж на ден за всеки.</template>
    </p>
    <Feedback :message="message" :error="error" />

    <template v-if="mall">
      <p v-if="!mall.crew.length" class="bgr-error">Нямаш пилот и навигатор.</p>
      <div v-for="member in mall.crew" :key="member.id" class="bgr-row">
        <span><small class="bgr-muted">{{ member.role_label }}</small> {{ member.name }}</span>
        <span class="bgr-actions">
          <HealthBar :value="member.physical ?? 0" />
          <button
            class="bgr-small"
            :disabled="busy || member.fitness_today || (member.physical ?? 0) >= 100"
            @click="train(member.id)"
          >
            {{ member.fitness_today ? 'Тренира днес' : 'Тренирай' }}
          </button>
        </span>
      </div>
    </template>

    <h2 class="bgr-spaced">Дрехи</h2>
    <p class="bgr-muted">Магазинът за дрехи отваря в следващия етап.</p>
  </section>
</template>
