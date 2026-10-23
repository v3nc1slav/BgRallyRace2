<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n';
import { money } from '../format';
import { getFinance, type FinanceInfo } from '../game';
import { useAction } from '../useAction';
import Feedback from './Feedback.vue';
import LineChart, { type ChartSeries } from './LineChart.vue';

const finance = ref<FinanceInfo | null>(null);
const season = ref(0);
const table = ref(false);
const { error, run } = useAction();

async function load(value?: number) {
  const result = await run(() => getFinance(value));
  if (result) {
    finance.value = result.finance;
    season.value = result.finance.season;
  }
}

onMounted(() => load());

const net = computed(() => (finance.value ? finance.value.totals.income - finance.value.totals.expense : 0));
const labels = computed(() => finance.value?.rallies.map((_, i) => String(i + 1)) ?? []);
const titles = computed(() => finance.value?.rallies.map((r, i) => `${i + 1}. ${r.name}${r.current ? ` (${t('finance.current')})` : ''}`) ?? []);
const series = computed<ChartSeries[]>(() => [
  { key: 'income', name: t('finance.income'), color: 'var(--series-income)', values: finance.value?.rallies.map((r) => r.income) ?? [] },
  { key: 'expense', name: t('finance.expense'), color: 'var(--series-expense)', values: finance.value?.rallies.map((r) => r.expense) ?? [] },
]);
const empty = computed(() => !!finance.value && !finance.value.income.length && !finance.value.expense.length);
const share = (amount: number, total: number) => (total ? Math.round((amount / total) * 100) : 0);
const short = (value: number) => (value >= 1000 ? t('finance.thousands', { value: Math.round(value / 100) / 10 }) : money(Math.round(value)));
</script>

<template>
  <div class="bgr-finance">
    <Feedback :error="error" />
    <template v-if="finance">
      <div class="bgr-filters">
        <select v-model.number="season" @change="load(season)">
          <option v-for="item in finance.seasons" :key="item" :value="item">{{ $t('finance.season', { season: item }) }}{{ item === finance.seasons[0] ? $t('finance.currentSeason') : '' }}</option>
        </select>
      </div>

      <div class="bgr-tiles">
        <div class="bgr-tile"><span>{{ $t('finance.income') }}</span><b>{{ money(finance.totals.income) }}</b></div>
        <div class="bgr-tile"><span>{{ $t('finance.expense') }}</span><b>{{ money(finance.totals.expense) }}</b></div>
        <div class="bgr-tile">
          <span>{{ $t('finance.net') }}</span><b :class="net >= 0 ? 'bgr-ok' : 'bgr-error'">{{ net >= 0 ? '+' : '' }}{{ money(net) }}</b>
        </div>
        <div class="bgr-tile">
          <span>{{ $t('finance.closing') }}</span><b>{{ money(finance.totals.closing) }}</b><small>{{ $t('finance.opening', { amount: money(finance.totals.opening) }) }}</small>
        </div>
      </div>

      <p v-if="empty" class="bgr-muted">{{ $t('finance.empty') }}</p>
      <template v-else>
        <h2>{{ $t('finance.byRally') }}</h2>
        <p class="bgr-muted">{{ $t('finance.hint') }}</p>
        <LineChart v-if="!table && finance.rallies.length" :labels="labels" :titles="titles" :series="series" :format="short" :detail="money" />
        <div v-else-if="finance.rallies.length" class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>{{ $t('finance.rally') }}</th><th>{{ $t('finance.income') }}</th><th>{{ $t('finance.expense') }}</th><th>{{ $t('finance.net') }}</th><th>{{ $t('finance.after') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(rally, i) in finance.rallies" :key="rally.id">
                <td>{{ i + 1 }}. {{ rally.name }}<small v-if="rally.current" class="bgr-muted">{{ $t('finance.current') }}</small></td>
                <td>{{ money(rally.income) }}</td>
                <td>{{ money(rally.expense) }}</td>
                <td>{{ money(rally.income - rally.expense) }}</td>
                <td>{{ money(rally.balance) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="bgr-small bgr-secondary" @click="table = !table">{{ table ? $t('finance.showChart') : $t('finance.showTable') }}</button>

        <div class="bgr-finance-lists">
          <div>
            <h2>{{ $t('finance.income') }}</h2>
            <p v-if="!finance.income.length" class="bgr-muted">{{ $t('finance.noIncome') }}</p>
            <div v-for="item in finance.income" :key="item.key" class="bgr-row">
              <span>{{ item.label }} <small class="bgr-muted">{{ share(item.amount, finance.totals.income) }}%</small></span>
              <b>{{ money(item.amount) }}</b>
            </div>
          </div>
          <div>
            <h2>{{ $t('finance.expense') }}</h2>
            <p v-if="!finance.expense.length" class="bgr-muted">{{ $t('finance.noExpense') }}</p>
            <div v-for="item in finance.expense" :key="item.key" class="bgr-row">
              <span>{{ item.label }} <small class="bgr-muted">{{ share(item.amount, finance.totals.expense) }}%</small></span>
              <b>{{ money(item.amount) }}</b>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
