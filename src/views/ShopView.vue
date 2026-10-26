<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ask } from '../dialog';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import { money, percent } from '../format';
import { buyCar, buyItem, getShop, type Shop, type ShopCar, type ShopPart, type ShopTyre, type Stats } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const tab = ref<'cars' | 'parts' | 'tyres'>('parts');
const cars = ref<ShopCar[]>([]);
const tradeIn = ref<Shop['trade_in']>(null);
const parts = ref<ShopPart[]>([]);
const tyres = ref<ShopTyre[]>([]);
const privileges = ref<string[]>([]);
const pricePct = ref(100);
const { busy, message, error, run } = useAction();

const short = computed<Record<keyof Stats, string>>(() => ({ power: t('stats.short.power'), handling: t('stats.short.handling'), braking: t('stats.short.braking'), reliability: t('stats.short.reliability') }));

function apply(shop: Shop) {
  cars.value = shop.cars;
  tradeIn.value = shop.trade_in;
  parts.value = shop.parts;
  tyres.value = shop.tyres;
  privileges.value = shop.privileges;
  pricePct.value = shop.price_pct;
}

onMounted(() =>
  run(async () => {
    apply(await getShop());
  }),
);

async function purchaseCar(car: ShopCar) {
  const warning = tradeIn.value ? `\n${t('shop.tradeInWarning', { name: tradeIn.value.name, value: money(tradeIn.value.value) })}` : '';
  if (!await ask(`${t('shop.buyCarConfirm', { name: car.name, price: money(car.price) })}${warning}`)) {
    return;
  }
  const result = await run(() => buyCar(car.id));
  if (result) {
    apply(result);
    message.value = result.message;
  }
}

function carAffordable(price: number) {
  return (session.player?.money ?? 0) + (tradeIn.value?.value ?? 0) >= price;
}

async function buy(kind: 'part' | 'tyre' | 'spare_tyre', id: number) {
  const result = await run(() => buyItem(kind, id));
  if (result) {
    message.value = result.message;
  }
}

function bonuses(stats: Stats, fuel = 0) {
  const list = (Object.keys(short.value) as (keyof Stats)[]).filter((key) => stats[key]).map((key) => `+${stats[key]} ${short.value[key]}`);
  if (fuel) {
    list.push(t('stats.fuel', { sign: fuel > 0 ? '+' : '', pct: fuel }));
  }
  return list.length ? list.join(', ') : '—';
}

function affordable(price: number) {
  return (session.player?.money ?? 0) >= price;
}
</script>

<template>
  <section class="bgr-card">
    <h1>{{ $t('shop.title') }}</h1>
    <div class="bgr-tabs">
      <button :class="{ active: tab === 'cars' }" @click="tab = 'cars'">{{ $t('shop.cars') }}</button>
      <button :class="{ active: tab === 'parts' }" @click="tab = 'parts'">{{ $t('shop.parts') }}</button>
      <button :class="{ active: tab === 'tyres' }" @click="tab = 'tyres'">{{ $t('shop.tyres') }}</button>
    </div>
    <p class="bgr-muted">
      {{ $t('shop.prices', { city: session.player?.city ?? '', pct: pricePct }) }}<template v-if="privileges.length"> {{ $t('shop.privileges', { list: privileges.join(', ') }) }}</template>
      {{ $t('shop.assortment') }} <RouterLink to="/city/market">{{ $t('shop.market') }}</RouterLink>.
    </p>
    <p v-if="session.player?.perks.discount" class="bgr-ok">
      {{ $t('shop.discount', { pct: session.player.perks.discount }) }}
    </p>
    <Feedback :message="message" :error="error" />

    <div v-if="tab === 'cars'" class="bgr-scroll">
      <p v-if="tradeIn" class="bgr-muted">
        {{ $t('shop.noSpace', { name: tradeIn.name, value: money(tradeIn.value) }) }}
      </p>
      <table class="bgr-table">
        <thead>
          <tr><th>{{ $t('shop.car') }}</th><th>{{ $t('shop.power') }}</th><th>{{ $t('shop.handlingShort') }}</th><th>{{ $t('shop.brakingShort') }}</th><th>{{ $t('shop.reliabilityShort') }}</th><th>{{ $t('shop.consumption') }}</th><th>{{ $t('shop.price') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="car in cars" :key="car.id" :class="{ 'bgr-locked': car.locked }">
            <td>{{ car.name }}<small class="bgr-muted">{{ car.class_label }}</small></td>
            <td>{{ car.stats.power }} {{ $t('stats.hp') }}</td>
            <td>{{ car.stats.handling }}</td>
            <td>{{ car.stats.braking }}</td>
            <td>{{ car.stats.reliability }}</td>
            <td>{{ $t('shop.litres', { value: car.fuel_consumption }) }}</td>
            <td>{{ money(car.price) }}<small v-if="car.price < car.base_price" class="bgr-muted"><s>{{ money(car.base_price) }}</s></small></td>
            <td class="bgr-right">
              <small v-if="car.owned" class="bgr-ok">{{ $t('shop.owned') }}</small>
              <small v-else-if="car.locked" class="bgr-muted">{{ $t('shop.fromLevel', { level: car.min_level }) }}</small>
              <button v-else class="bgr-small" :disabled="busy || !carAffordable(car.price)" @click="purchaseCar(car)">{{ $t('shop.buy') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'parts'" class="bgr-scroll">
      <table class="bgr-table">
        <thead>
          <tr><th>{{ $t('shop.part') }}</th><th>{{ $t('shop.bonuses') }}</th><th>{{ $t('shop.wear') }}</th><th>{{ $t('shop.price') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="part in parts" :key="part.id" :class="{ 'bgr-locked': part.locked }">
            <td>{{ part.name }}<small class="bgr-muted">{{ part.type_label }} · {{ part.class_label }}</small></td>
            <td>{{ bonuses(part.bonuses, part.fuel_pct) }}</td>
            <td>{{ $t('shop.wearValue', { pct: part.wear }) }}</td>
            <td>{{ money(part.price) }}<small v-if="part.price < part.base_price" class="bgr-muted"><s>{{ money(part.base_price) }}</s></small></td>
            <td class="bgr-right">
              <small v-if="part.locked" class="bgr-muted">{{ $t('shop.fromLevel', { level: part.min_level }) }}</small>
              <button v-else class="bgr-small" :disabled="busy || !affordable(part.price)" @click="buy('part', part.id)">{{ $t('shop.buy') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="bgr-scroll">
      <table class="bgr-table">
        <thead>
          <tr><th>{{ $t('shop.tyre') }}</th><th>{{ $t('shop.dry') }}</th><th>{{ $t('shop.wet') }}</th><th>{{ $t('shop.gravel') }}</th><th>{{ $t('shop.snow') }}</th><th>{{ $t('shop.wear') }}</th><th>{{ $t('shop.set') }}</th><th>{{ $t('shop.single') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="tyre in tyres" :key="tyre.id" :class="{ 'bgr-locked': tyre.locked }">
            <td>{{ tyre.name }}<small class="bgr-muted">{{ $t('shop.compound', { name: tyre.compound_label }) }}</small></td>
            <td>{{ percent(tyre.grip.asphalt_dry) }}</td>
            <td>{{ percent(tyre.grip.asphalt_wet) }}</td>
            <td>{{ percent(tyre.grip.gravel) }}</td>
            <td>{{ percent(tyre.grip.snow) }}</td>
            <td>{{ $t('shop.wearValue', { pct: tyre.wear }) }}</td>
            <td>{{ money(tyre.price) }}<small v-if="tyre.price < tyre.base_price" class="bgr-muted"><s>{{ money(tyre.base_price) }}</s></small></td>
            <td>{{ money(tyre.single_price) }}</td>
            <td class="bgr-right">
              <small v-if="tyre.locked" class="bgr-muted">{{ $t('shop.fromLevel', { level: tyre.min_level }) }}</small>
              <template v-else>
                <button class="bgr-small" :disabled="busy || !affordable(tyre.price)" @click="buy('tyre', tyre.id)">{{ $t('shop.buySet') }}</button>
                <button class="bgr-small bgr-secondary" :disabled="busy || !affordable(tyre.single_price)" @click="buy('spare_tyre', tyre.id)">{{ $t('shop.buySpare') }}</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
