<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { t } from '../i18n';
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
  if (window.confirm(t('market.buyConfirm', { name: listing.name, price: money(listing.price + listing.delivery) }))) {
    act(() => buyListing({ ...query }, listing.id));
  }
}

function list(asset: MarketAsset) {
  act(() => listOnMarket({ ...query }, asset.kind, asset.id, prices[key(asset)]));
}

function dealer(asset: MarketAsset) {
  if (window.confirm(t('market.dealerConfirm', { price: money(asset.dealer), name: asset.name }))) {
    act(() => sellToDealer({ ...query }, asset.kind, asset.id));
  }
}

watch(query, load);
onMounted(load);
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1>{{ $t('market.title') }}</h1>
    <p class="bgr-muted">
      {{ $t('market.intro') }}
      <template v-if="market">{{ $t('market.rules', { days: market.rules.days, fee: market.rules.fee }) }}</template>
      {{ $t('market.delivery') }}
    </p>
    <Feedback :message="message" :error="error" />
    <p v-if="market?.rules.blocked" class="bgr-error">
      {{ $t('market.blocked') }} <RouterLink to="/city/bank">{{ $t('market.toBank') }}</RouterLink>
    </p>

    <div class="bgr-tabs">
      <button :class="{ active: tab === 'buy' }" @click="tab = 'buy'">{{ $t('market.buy') }}</button>
      <button :class="{ active: tab === 'mine' }" @click="tab = 'mine'">{{ $t('market.mine', { count: market?.mine.length ?? 0 }) }}</button>
      <button :class="{ active: tab === 'sell' }" @click="tab = 'sell'">{{ $t('market.sell') }}</button>
    </div>

    <template v-if="market">
      <template v-if="tab === 'buy'">
        <div class="bgr-filters">
          <select v-model="query.scope">
            <option value="all">{{ $t('market.country') }}</option>
            <option value="city">{{ $t('market.city') }}</option>
          </select>
          <select v-model="query.filter">
            <option value="">{{ $t('market.all') }}</option>
            <option value="part">{{ $t('market.parts') }}</option>
            <option value="tyre">{{ $t('market.tyres') }}</option>
            <option value="car">{{ $t('market.cars') }}</option>
          </select>
        </div>
        <p v-if="!market.rules.mechanic" class="bgr-muted">{{ $t('market.noMechanic') }}</p>
        <p v-if="!market.listings.length" class="bgr-muted">{{ $t('market.none') }}</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>{{ $t('market.item') }}</th><th>{{ $t('market.health') }}</th><th>{{ $t('market.seller') }}</th><th>{{ $t('market.price') }}</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="listing in market.listings" :key="listing.id">
                <td>{{ listing.name }}<small class="bgr-muted">{{ listing.details.label }}</small></td>
                <td>
                  <HealthBar :value="listing.details.health" />
                  <small v-if="listing.details.max_health < 100" class="bgr-muted">{{ $t('common.maxHealth', { pct: listing.details.max_health }) }}</small>
                  <small v-if="listing.details.defect" class="bgr-error">{{ $t('common.poorRepair') }}</small>
                </td>
                <td>{{ listing.seller }}<small class="bgr-muted">{{ listing.city }}</small></td>
                <td>
                  {{ money(listing.price) }}
                  <small v-if="listing.delivery" class="bgr-muted">{{ $t('market.deliveryCost', { price: money(listing.delivery) }) }}</small>
                  <small class="bgr-muted">{{ $t('market.newPrice', { price: money(listing.base_price) }) }}</small>
                </td>
                <td class="bgr-right">
                  <button class="bgr-small" :disabled="busy || market.rules.blocked" @click="buy(listing)">{{ $t('market.buy') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="tab === 'mine'">
        <p v-if="!market.mine.length" class="bgr-muted">{{ $t('market.noMine') }}</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>{{ $t('market.item') }}</th><th>{{ $t('market.price') }}</th><th>{{ $t('market.expires') }}</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="listing in market.mine" :key="listing.id">
                <td>{{ listing.name }}<small class="bgr-muted">{{ listing.details.label }}</small></td>
                <td>{{ money(listing.price) }}</td>
                <td>{{ when(listing.expires_at) }}</td>
                <td class="bgr-right">
                  <button class="bgr-small bgr-secondary" :disabled="busy" @click="act(() => cancelListing({ ...query }, listing.id))">{{ $t('market.cancel') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <p v-if="!market.rules.can_sell" class="bgr-error">{{ $t('market.sellLevel', { level: market.rules.sell_level }) }}</p>
        <p class="bgr-muted">{{ $t('market.sellHint') }}</p>
        <p v-if="!market.sellable.length" class="bgr-muted">{{ $t('market.nothing') }}</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>{{ $t('market.item') }}</th><th>{{ $t('market.health') }}</th><th>{{ $t('market.price') }}</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="asset in market.sellable" :key="key(asset)">
                <td>{{ asset.name }}<small class="bgr-muted">{{ asset.details.label }}</small></td>
                <td>
                  <HealthBar :value="asset.details.health" />
                  <small v-if="asset.details.defect" class="bgr-error">{{ $t('common.poorRepair') }}</small>
                </td>
                <td>
                  <input v-model.number="prices[key(asset)]" class="bgr-price" type="number" :min="asset.min" :max="asset.max" />
                  <small class="bgr-muted">{{ money(asset.min) }} – {{ money(asset.max) }}</small>
                </td>
                <td class="bgr-right">
                  <div class="bgr-actions">
                    <button class="bgr-small" :disabled="busy || !market.rules.can_sell" @click="list(asset)">
                      {{ $t('market.list', { energy: market.rules.energy }) }}
                    </button>
                    <button class="bgr-small bgr-secondary" :disabled="busy || !market.rules.can_sell" @click="dealer(asset)">
                      {{ $t('market.dealer', { price: money(asset.dealer) }) }}
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
