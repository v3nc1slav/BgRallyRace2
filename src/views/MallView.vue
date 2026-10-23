<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money } from '../format';
import { buyClothes, getMall, trainFitness, wearClothes, type MallInfo } from '../game';
import { useAction } from '../useAction';

const mall = ref<MallInfo | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    mall.value = (await getMall()).mall;
  }),
);

async function act(task: () => Promise<{ mall: MallInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    mall.value = result.mall;
    message.value = result.message;
  }
}

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
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1>{{ $t('mall.title') }}</h1>
    <h2>{{ $t('mall.gym') }}</h2>
    <p class="bgr-muted">
      {{ $t('mall.gymIntro') }}
      <template v-if="mall">{{ $t('mall.session', { energy: mall.energy, price: money(mall.price), gain: mall.gain }) }}</template>
    </p>
    <Feedback :message="message" :error="error" />

    <template v-if="mall">
      <p v-if="!mall.crew.length" class="bgr-error">{{ $t('mall.noCrew') }}</p>
      <div v-for="member in mall.crew" :key="member.id" class="bgr-row">
        <span><small class="bgr-muted">{{ member.role_label }}</small> {{ member.name }}</span>
        <span class="bgr-actions">
          <HealthBar :value="member.physical ?? 0" />
          <button
            class="bgr-small"
            :disabled="busy || member.fitness_today || (member.physical ?? 0) >= 100"
            @click="train(member.id)"
          >
            {{ member.fitness_today ? $t('mall.trainedToday') : $t('mall.train') }}
          </button>
        </span>
      </div>
    </template>

    <h2 class="bgr-spaced">{{ $t('mall.clothes') }}</h2>
    <template v-if="mall">
      <p class="bgr-muted">
        {{ $t('mall.clothesIntro') }} <b>+{{ mall.clothes.bonus }}%</b>.
      </p>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>{{ $t('mall.item') }}</th><th>{{ $t('mall.bonus') }}</th><th>{{ $t('mall.price') }}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="item in mall.clothes.items" :key="item.id" :class="{ 'bgr-locked': item.locked, 'bgr-me': item.equipped }">
              <td>{{ item.name }}<small class="bgr-muted">{{ item.slot_label }}</small></td>
              <td>+{{ item.bonus }}%</td>
              <td>{{ money(item.price) }}</td>
              <td class="bgr-right">
                <small v-if="item.equipped" class="bgr-ok">{{ $t('mall.worn') }}</small>
                <button v-else-if="item.item_id" class="bgr-small bgr-secondary" :disabled="busy" @click="act(() => wearClothes(item.item_id!))">{{ $t('mall.wear') }}</button>
                <small v-else-if="item.locked" class="bgr-muted">{{ $t('common.fromLevel', { level: item.min_level }) }}</small>
                <button v-else class="bgr-small" :disabled="busy" @click="act(() => buyClothes(item.id))">{{ $t('mall.buy') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
