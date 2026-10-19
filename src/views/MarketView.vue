<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money, when } from '../format';
import {
  buyListing,
  cancelListing,
  getMarket,
  listOnMarket,
  sellToDealer,
  type MarketAsset,
  type MarketInfo,
  type MarketListing,
  type MarketQuery,
} from '../game';
import { useAction } from '../useAction';

const market = ref<MarketInfo | null>(null);
const tab = ref<'buy' | 'mine' | 'sell'>('buy');
const query = reactive<MarketQuery>({ scope: 'all', filter: '' });
const prices = reactive<Record<string, number>>({});
const { busy, message, error, run } = useAction();

const key = (asset: MarketAsset) => `${asset.kind}-${asset.id}`;

function apply(data: MarketInfo) {
  market.value = data;
  for (const asset of data.sellable) {
    prices[key(asset)] ??= Math.min(asset.max, Math.max(asset.min, Math.round(asset.base / 2)));
  }
}

async function load() {
  const result = await run(() => getMarket({ ...query }));
  if (result) {
    apply(result.market);
  }
}

async function act(task: () => Promise<{ market: MarketInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    apply(result.market);
    message.value = result.message;
  }
}

function buy(listing: MarketListing) {
  if (window.confirm(`Да купиш ли „${listing.name}“ за ${money(listing.price + listing.delivery)}?`)) {
    act(() => buyListing({ ...query }, listing.id));
  }
}

function list(asset: MarketAsset) {
  act(() => listOnMarket({ ...query }, asset.kind, asset.id, prices[key(asset)]));
}

function dealer(asset: MarketAsset) {
  if (window.confirm(`Изкупвачът дава ${money(asset.dealer)} за „${asset.name}“. Продаваш ли?`)) {
    act(() => sellToDealer({ ...query }, asset.kind, asset.id));
  }
}

watch(query, load);
onMounted(load);
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>Пазар</h1>
    <p class="bgr-muted">
      Търговия между играчите с употребявани части, гуми и коли.
      <template v-if="market">Обявата важи {{ market.rules.days }} дни, а пазарът взима {{ market.rules.fee }}% от продавача.</template>
      Покупка от друг град добавя доставка.
    </p>
    <Feedback :message="message" :error="error" />
    <p v-if="market?.rules.blocked" class="bgr-error">
      Имаш просрочена вноска и купуването е спряно. <RouterLink to="/city/bank">Към банката</RouterLink>
    </p>

    <div class="bgr-tabs">
      <button :class="{ active: tab === 'buy' }" @click="tab = 'buy'">Купи</button>
      <button :class="{ active: tab === 'mine' }" @click="tab = 'mine'">Моите обяви ({{ market?.mine.length ?? 0 }})</button>
      <button :class="{ active: tab === 'sell' }" @click="tab = 'sell'">Продай</button>
    </div>

    <template v-if="market">
      <template v-if="tab === 'buy'">
        <div class="bgr-filters">
          <select v-model="query.scope">
            <option value="all">Цялата страна</option>
            <option value="city">Само моят град</option>
          </select>
          <select v-model="query.filter">
            <option value="">Всичко</option>
            <option value="part">Части</option>
            <option value="tyre">Гуми</option>
            <option value="car">Коли</option>
          </select>
        </div>
        <p v-if="!market.rules.mechanic" class="bgr-muted">Без майстор не виждаш кои части са с некачествен ремонт.</p>
        <p v-if="!market.listings.length" class="bgr-muted">Няма обяви.</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>Предмет</th><th>Състояние</th><th>Продавач</th><th>Цена</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="listing in market.listings" :key="listing.id">
                <td>{{ listing.name }}<small class="bgr-muted">{{ listing.details.label }}</small></td>
                <td>
                  <HealthBar :value="listing.details.health" />
                  <small v-if="listing.details.max_health < 100" class="bgr-muted">макс. {{ listing.details.max_health }}%</small>
                  <small v-if="listing.details.defect" class="bgr-error">некачествен ремонт</small>
                </td>
                <td>{{ listing.seller }}<small class="bgr-muted">{{ listing.city }}</small></td>
                <td>
                  {{ money(listing.price) }}
                  <small v-if="listing.delivery" class="bgr-muted">+ {{ money(listing.delivery) }} доставка</small>
                  <small class="bgr-muted">нова: {{ money(listing.base_price) }}</small>
                </td>
                <td class="bgr-right">
                  <button class="bgr-small" :disabled="busy || market.rules.blocked" @click="buy(listing)">Купи</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="tab === 'mine'">
        <p v-if="!market.mine.length" class="bgr-muted">Нямаш активни обяви.</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>Предмет</th><th>Цена</th><th>Изтича</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="listing in market.mine" :key="listing.id">
                <td>{{ listing.name }}<small class="bgr-muted">{{ listing.details.label }}</small></td>
                <td>{{ money(listing.price) }}</td>
                <td>{{ when(listing.expires_at) }}</td>
                <td class="bgr-right">
                  <button class="bgr-small bgr-secondary" :disabled="busy" @click="act(() => cancelListing({ ...query }, listing.id))">Свали</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <p v-if="!market.rules.can_sell" class="bgr-error">Продаването е от ниво {{ market.rules.sell_level }}.</p>
        <p class="bgr-muted">
          Докато обявата е активна, предметът не е в гаража. Изкупвачът плаща веднага, но малко.
          Колата за състезания не може да се продаде.
        </p>
        <p v-if="!market.sellable.length" class="bgr-muted">Нямаш какво да продадеш: складът е празен и нямаш втора кола.</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>Предмет</th><th>Състояние</th><th>Цена</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="asset in market.sellable" :key="key(asset)">
                <td>{{ asset.name }}<small class="bgr-muted">{{ asset.details.label }}</small></td>
                <td>
                  <HealthBar :value="asset.details.health" />
                  <small v-if="asset.details.defect" class="bgr-error">некачествен ремонт</small>
                </td>
                <td>
                  <input v-model.number="prices[key(asset)]" class="bgr-price" type="number" :min="asset.min" :max="asset.max" />
                  <small class="bgr-muted">{{ money(asset.min) }} – {{ money(asset.max) }}</small>
                </td>
                <td class="bgr-right">
                  <div class="bgr-actions">
                    <button class="bgr-small" :disabled="busy || !market.rules.can_sell" @click="list(asset)">
                      Обяви ({{ market.rules.energy }} енергия)
                    </button>
                    <button class="bgr-small bgr-secondary" :disabled="busy || !market.rules.can_sell" @click="dealer(asset)">
                      Изкупвач: {{ money(asset.dealer) }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>
