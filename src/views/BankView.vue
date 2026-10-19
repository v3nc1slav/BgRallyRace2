<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { date, money } from '../format';
import { getBank, payOverdue, repayLoan, takeLoan, type BankInfo } from '../game';
import { useAction } from '../useAction';

const bank = ref<BankInfo | null>(null);
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
  if (bank.value?.loan && window.confirm(`Да изплатиш ли целия заем сега с ${money(bank.value.loan.payoff)}?`)) {
    act(repayLoan);
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>Банка</h1>
    <Feedback :message="message" :error="error" />

    <template v-if="bank">
      <div v-if="bank.loan" class="bgr-panel">
        <h2>Твоят заем</h2>
        <p v-if="bank.loan.overdue" class="bgr-error">
          Просрочие: {{ money(bank.loan.overdue) }}. Докато не го платиш, не можеш да купуваш от магазина и пазара.
          След {{ bank.seize_after }} пропуснати вноски поред банката налага запор.
        </p>
        <dl class="bgr-stats-list">
          <dt>Взет</dt>
          <dd>{{ money(bank.loan.principal) }} на {{ date(bank.loan.created_at) }}</dd>
          <dt>Лихва</dt>
          <dd>{{ money(bank.loan.interest) }}</dd>
          <dt>Остава</dt>
          <dd>{{ money(bank.loan.remaining) }}</dd>
          <dt>Следваща вноска</dt>
          <dd>{{ money(bank.loan.next) }} в понеделник</dd>
          <dt>Седмици</dt>
          <dd>{{ bank.loan.weeks_passed }} от {{ bank.loan.weeks }}</dd>
        </dl>
        <div class="bgr-actions">
          <button v-if="bank.loan.overdue" class="bgr-small" :disabled="busy" @click="act(payOverdue)">Плати просрочието ({{ money(bank.loan.overdue) }})</button>
          <button class="bgr-small bgr-secondary" :disabled="busy" @click="repay">Изплати предсрочно ({{ money(bank.loan.payoff) }})</button>
        </div>
        <p class="bgr-muted">При предсрочно изплащане лихвата за оставащите седмици не се плаща.</p>
      </div>

      <div v-else class="bgr-panel">
        <h2>Нов заем</h2>
        <form class="bgr-form" @submit.prevent="act(() => takeLoan(amount, weeks))">
          <label>
            Сума (от {{ money(bank.min) }} до {{ money(bank.max) }})
            <input v-model.number="amount" type="number" :min="bank.min" :max="bank.max" step="100" />
          </label>
          <div class="bgr-tabs">
            <button v-for="term in bank.terms" :key="term.weeks" type="button" :class="{ active: weeks === term.weeks }" @click="weeks = term.weeks">
              {{ term.weeks }} седмици · {{ term.rate }}%
            </button>
          </div>
          <p v-if="preview" class="bgr-muted">
            Връщаш {{ money(preview.total) }} (лихва {{ money(preview.interest) }}) на {{ weeks }} вноски по {{ money(preview.installment) }} всеки понеделник.
          </p>
          <button :disabled="busy || amount < bank.min || amount > bank.max">Вземи заема ({{ bank.energy }} енергия)</button>
        </form>
      </div>

      <h2>Условия</h2>
      <ul class="bgr-muted">
        <li>Максималният заем расте с нивото на мениджъра. Може да имаш само един заем.</li>
        <li>Вноските се плащат всеки понеделник заедно със заплатите.</li>
        <li>Неплатена вноска носи наказателна лихва {{ bank.penalty }}% от вноската и спира покупките от магазина и пазара.</li>
        <li>
          След {{ bank.seize_after }} пропуснати вноски поред банката взима предмети от склада, а после неактивните коли
          за {{ bank.seize_pct }}% от новата им цена. Ако не стигнат, балансът става отрицателен.
        </li>
      </ul>
    </template>
  </section>
</template>
