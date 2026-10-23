<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import FinancePanel from '../components/FinancePanel.vue';
import { date, money } from '../format';
import { getBank, payOverdue, repayLoan, takeLoan, type BankInfo } from '../game';
import { useAction } from '../useAction';

const bank = ref<BankInfo | null>(null);
const tab = ref<'loans' | 'finance'>('loans');
const amount = ref(0);
const weeks = ref(4);
const { busy, message, error, run } = useAction();

const preview = computed(() => {
  const term = bank.value?.terms.find((t) => t.weeks === weeks.value);
  if (!term || !amount.value) {
    return null;
  }
  const interest = Math.round((amount.value * term.rate) / 100);
  const total = amount.value + interest;
  return { interest, total, installment: Math.ceil(total / weeks.value) };
});

function apply(data: BankInfo) {
  bank.value = data;
  if (!amount.value) {
    amount.value = Math.min(data.max, Math.max(data.min, Math.round(data.max / 2 / 100) * 100));
  }
}

onMounted(() =>
  run(async () => {
    apply((await getBank()).bank);
  }),
);

async function act(task: () => Promise<{ bank: BankInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    apply(result.bank);
    message.value = result.message;
  }
}

function repay() {
  if (bank.value?.loan && window.confirm(t('bank.repayConfirm', { amount: money(bank.value.loan.payoff) }))) {
    act(repayLoan);
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1>{{ $t('bank.title') }}</h1>
    <div class="bgr-tabs">
      <button :class="{ active: tab === 'loans' }" @click="tab = 'loans'">{{ $t('bank.loans') }}</button>
      <button :class="{ active: tab === 'finance' }" @click="tab = 'finance'">{{ $t('bank.finance') }}</button>
    </div>

    <FinancePanel v-if="tab === 'finance'" />

    <Feedback v-if="tab === 'loans'" :message="message" :error="error" />

    <template v-if="bank && tab === 'loans'">
      <div v-if="bank.loan" class="bgr-panel">
        <h2>{{ $t('bank.yourLoan') }}</h2>
        <p v-if="bank.loan.overdue" class="bgr-error">
          {{ $t('bank.overdue', { amount: money(bank.loan.overdue) }) }}
          {{ $t('bank.seizeWarning', { count: bank.seize_after }) }}
        </p>
        <dl class="bgr-stats-list">
          <dt>{{ $t('bank.taken') }}</dt>
          <dd>{{ $t('bank.takenValue', { amount: money(bank.loan.principal), date: date(bank.loan.created_at) }) }}</dd>
          <dt>{{ $t('bank.interest') }}</dt>
          <dd>{{ money(bank.loan.interest) }}</dd>
          <dt>{{ $t('bank.remaining') }}</dt>
          <dd>{{ money(bank.loan.remaining) }}</dd>
          <dt>{{ $t('bank.next') }}</dt>
          <dd>{{ $t('bank.nextValue', { amount: money(bank.loan.next) }) }}</dd>
          <dt>{{ $t('bank.weeks') }}</dt>
          <dd>{{ $t('bank.weeksValue', { passed: bank.loan.weeks_passed, total: bank.loan.weeks }) }}</dd>
        </dl>
        <div class="bgr-actions">
          <button v-if="bank.loan.overdue" class="bgr-small" :disabled="busy" @click="act(payOverdue)">{{ $t('bank.payOverdue', { amount: money(bank.loan.overdue) }) }}</button>
          <button class="bgr-small bgr-secondary" :disabled="busy" @click="repay">{{ $t('bank.repay', { amount: money(bank.loan.payoff) }) }}</button>
        </div>
        <p class="bgr-muted">{{ $t('bank.repayHint') }}</p>
      </div>

      <div v-else class="bgr-panel">
        <h2>{{ $t('bank.newLoan') }}</h2>
        <form class="bgr-form" @submit.prevent="act(() => takeLoan(amount, weeks))">
          <label>
            {{ $t('bank.amount', { min: money(bank.min), max: money(bank.max) }) }}
            <input v-model.number="amount" type="number" :min="bank.min" :max="bank.max" step="100" />
          </label>
          <div class="bgr-tabs">
            <button v-for="term in bank.terms" :key="term.weeks" type="button" :class="{ active: weeks === term.weeks }" @click="weeks = term.weeks">
              {{ $t('bank.term', { weeks: term.weeks, rate: term.rate }) }}
            </button>
          </div>
          <p v-if="preview" class="bgr-muted">
            {{ $t('bank.preview', { total: money(preview.total), interest: money(preview.interest), weeks, installment: money(preview.installment) }) }}
          </p>
          <button :disabled="busy || amount < bank.min || amount > bank.max">{{ $t('bank.take', { energy: bank.energy }) }}</button>
        </form>
      </div>

      <h2>{{ $t('bank.terms') }}</h2>
      <ul class="bgr-muted">
        <li>{{ $t('bank.rule1') }}</li>
        <li>{{ $t('bank.rule2') }}</li>
        <li>{{ $t('bank.rule3', { pct: bank.penalty }) }}</li>
        <li>{{ $t('bank.rule4', { count: bank.seize_after, pct: bank.seize_pct }) }}</li>
      </ul>
    </template>
  </section>
</template>
