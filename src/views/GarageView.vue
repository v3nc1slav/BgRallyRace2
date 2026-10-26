<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import GarageScene from '../components/GarageScene.vue';
import { getGarage, mountItem, repairItem, setActiveCar, upgradeGarage, type Garage } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const garage = ref<Garage | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    garage.value = (await getGarage()).garage;
  }),
);

async function act(task: () => Promise<{ garage: Garage; message: string }>) {
  const result = await run(task);
  if (result) {
    garage.value = result.garage;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1 v-if="garage?.car">
      {{ garage.car.name }}
      <span class="bgr-tag">{{ garage.car.class_label }}</span>
      <span class="bgr-tag">{{ $t('garage.health') }} {{ Math.round(garage.car.health) }}%</span>
      <span class="bgr-tag">{{ $t('garage.consumption') }} {{ garage.car.fuel_consumption }} {{ $t('garage.consumptionUnit') }}</span>
    </h1>
    <Feedback :message="message" :error="error" />
    <template v-if="garage">
      <GarageScene
        :garage="garage"
        :level="session.player?.level ?? 0"
        :cash="session.player?.money ?? 0"
        :busy="busy"
        @upgrade="act(upgradeGarage)"
        @activate="(id) => act(() => setActiveCar(id))"
        @repair="(id) => act(() => repairItem(id))"
        @mount="(id) => act(() => mountItem(id))"
      />
      <p v-if="garage.car?.problems.length" class="bgr-error">{{ $t('garage.notReady', { list: garage.car.problems.join(', ') }) }}</p>
      <p class="bgr-muted">{{ $t('garage.worker', { worker: garage.worker }) }}</p>
    </template>
  </section>
</template>
