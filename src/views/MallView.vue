<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import MallScene, { type MallShop } from '../components/MallScene.vue';
import { money } from '../format';
import { buyClothes, getMall, trainFitness, wearClothes, type MallInfo } from '../game';
import { useAction } from '../useAction';

const SLOTS: Record<Exclude<MallShop, 'fitness'>, string[]> = {
  clothes: ['suit'],
  shoes: ['shoes'],
  accessories: ['watch', 'accessory'],
};

const mall = ref<MallInfo | null>(null);
const open = ref<MallShop | null>(null);
const closer = ref<HTMLButtonElement>();
const { busy, message, error, run } = useAction();

const items = computed(() => {
  const shop = open.value;
  return shop && shop !== 'fitness' ? (mall.value?.clothes.items ?? []).filter((item) => SLOTS[shop].includes(item.slot)) : [];
});

onMounted(() =>
  run(async () => {
    mall.value = (await getMall()).mall;
  }),
);

async function show(shop: MallShop) {
  message.value = '';
  error.value = '';
  open.value = shop;
  await nextTick();
  closer.value?.focus();
}

async function act(task: () => Promise<{ mall: MallInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    mall.value = result.mall;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <div class="bgr-scene-stage" style="--ratio: 1.4286">
      <MallScene :inert="!!open" @open="show" />
      <div v-if="open" class="bgr-scene-list">
        <button ref="closer" class="bgr-scene-close" :aria-label="$t('mall.close')" @click="open = null">&times;</button>
        <h2>{{ $t(`mall.shops.${open}`) }}</h2>

        <template v-if="open === 'fitness'">
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
                <button class="bgr-small" :disabled="busy || member.fitness_today || (member.physical ?? 0) >= 100" @click="act(() => trainFitness(member.id))">
                  {{ member.fitness_today ? $t('mall.trainedToday') : $t('mall.train') }}
                </button>
              </span>
            </div>
          </template>
        </template>

        <template v-else>
          <p v-if="mall" class="bgr-muted">{{ $t('mall.clothesIntro') }} <b>+{{ mall.clothes.bonus }}%</b>.</p>
          <Feedback :message="message" :error="error" />
          <div class="bgr-scroll">
            <table class="bgr-table">
              <thead><tr><th>{{ $t('mall.item') }}</th><th>{{ $t('mall.bonus') }}</th><th>{{ $t('mall.price') }}</th><th></th></tr></thead>
              <tbody>
                <tr v-for="item in items" :key="item.id" :class="{ 'bgr-locked': item.locked, 'bgr-me': item.equipped }">
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
      </div>
    </div>

    <Feedback v-if="!open" :message="message" :error="error" />
    <p v-if="mall" class="bgr-muted bgr-mall-info">{{ $t('mall.clothesIntro') }} <b>+{{ mall.clothes.bonus }}%</b>.</p>
  </section>
</template>
