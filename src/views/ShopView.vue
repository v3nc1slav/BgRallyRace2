<script setup lang="ts">
import { onMounted, ref } from 'vue';
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

const short: Record<keyof Stats, string> = { power: 'к.с.', handling: 'упр.', braking: 'спир.', reliability: 'надежд.' };

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
  const warning = tradeIn.value ? `\n${tradeIn.value.name} ще бъде продадена за ${money(tradeIn.value.value)}.` : '';
  if (!window.confirm(`Да купиш ли ${car.name} за ${money(car.price)}?${warning}`)) {
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
  const list = (Object.keys(short) as (keyof Stats)[]).filter((key) => stats[key]).map((key) => `+${stats[key]} ${short[key]}`);
  if (fuel) {
    list.push(`${fuel > 0 ? '+' : ''}${fuel}% гориво`);
  }
  return list.length ? list.join(', ') : '—';
}

function affordable(price: number) {
  return (session.player?.money ?? 0) >= price;
}
</script>

<template>
  <section class="bgr-card">
    <h1>Магазин за авто части</h1>
    <div class="bgr-tabs">
      <button :class="{ active: tab === 'cars' }" @click="tab = 'cars'">Коли</button>
      <button :class="{ active: tab === 'parts' }" @click="tab = 'parts'">Части</button>
      <button :class="{ active: tab === 'tyres' }" @click="tab = 'tyres'">Гуми</button>
    </div>
    <p class="bgr-muted">
      Цени в магазина на {{ session.player?.city }}: {{ pricePct }}%.<template v-if="privileges.length"> Привилегии на града: {{ privileges.join(', ') }}.</template>
      Асортиментът е различен в различните градове – каквото липсва тук, потърси на <RouterLink to="/city/market">пазара</RouterLink>.
    </p>
    <p v-if="session.player?.perks.discount" class="bgr-ok">
      Имаш {{ session.player.perks.discount }}% отстъпка от рекламата. Прилага се при следващата покупка.
    </p>
    <Feedback :message="message" :error="error" />

    <div v-if="tab === 'cars'" class="bgr-scroll">
      <p v-if="tradeIn" class="bgr-muted">
        В гаража няма свободно място: при покупка {{ tradeIn.name }} се продава за {{ money(tradeIn.value) }}.
      </p>
      <table class="bgr-table">
        <thead>
          <tr><th>Кола</th><th>Мощност</th><th>Упр.</th><th>Спир.</th><th>Надежд.</th><th>Разход</th><th>Цена</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="car in cars" :key="car.id" :class="{ 'bgr-locked': car.locked }">
            <td>{{ car.name }}<small class="bgr-muted">{{ car.class_label }}</small></td>
            <td>{{ car.stats.power }} к.с.</td>
            <td>{{ car.stats.handling }}</td>
            <td>{{ car.stats.braking }}</td>
            <td>{{ car.stats.reliability }}</td>
            <td>{{ car.fuel_consumption }} л</td>
            <td>{{ money(car.price) }}<small v-if="car.price < car.base_price" class="bgr-muted"><s>{{ money(car.base_price) }}</s></small></td>
            <td class="bgr-right">
              <small v-if="car.owned" class="bgr-ok">в гаража</small>
              <small v-else-if="car.locked" class="bgr-muted">от ниво {{ car.min_level }}</small>
              <button v-else class="bgr-small" :disabled="busy || !carAffordable(car.price)" @click="purchaseCar(car)">Купи</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'parts'" class="bgr-scroll">
      <table class="bgr-table">
        <thead>
          <tr><th>Част</th><th>Бонуси</th><th>Износване</th><th>Цена</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="part in parts" :key="part.id" :class="{ 'bgr-locked': part.locked }">
            <td>{{ part.name }}<small class="bgr-muted">{{ part.type_label }} · {{ part.class_label }}</small></td>
            <td>{{ bonuses(part.bonuses, part.fuel_pct) }}</td>
            <td>{{ part.wear }}% / 100 км</td>
            <td>{{ money(part.price) }}<small v-if="part.price < part.base_price" class="bgr-muted"><s>{{ money(part.base_price) }}</s></small></td>
            <td class="bgr-right">
              <small v-if="part.locked" class="bgr-muted">от ниво {{ part.min_level }}</small>
              <button v-else class="bgr-small" :disabled="busy || !affordable(part.price)" @click="buy('part', part.id)">Купи</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="bgr-scroll">
      <table class="bgr-table">
        <thead>
          <tr><th>Гуми</th><th>Сух асфалт</th><th>Мокър асфалт</th><th>Чакъл</th><th>Сняг</th><th>Износване</th><th>Комплект</th><th>1 бр.</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="tyre in tyres" :key="tyre.id" :class="{ 'bgr-locked': tyre.locked }">
            <td>{{ tyre.name }}<small class="bgr-muted">{{ tyre.compound_label }} смес</small></td>
            <td>{{ percent(tyre.grip.asphalt_dry) }}</td>
            <td>{{ percent(tyre.grip.asphalt_wet) }}</td>
            <td>{{ percent(tyre.grip.gravel) }}</td>
            <td>{{ percent(tyre.grip.snow) }}</td>
            <td>{{ tyre.wear }}% / 100 км</td>
            <td>{{ money(tyre.price) }}<small v-if="tyre.price < tyre.base_price" class="bgr-muted"><s>{{ money(tyre.base_price) }}</s></small></td>
            <td>{{ money(tyre.single_price) }}</td>
            <td class="bgr-right">
              <small v-if="tyre.locked" class="bgr-muted">от ниво {{ tyre.min_level }}</small>
              <template v-else>
                <button class="bgr-small" :disabled="busy || !affordable(tyre.price)" @click="buy('tyre', tyre.id)">Комплект</button>
                <button class="bgr-small bgr-secondary" :disabled="busy || !affordable(tyre.single_price)" @click="buy('spare_tyre', tyre.id)">1 резервна</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
