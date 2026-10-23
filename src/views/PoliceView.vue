<script setup lang="ts">
import { onMounted, ref } from 'vue';
import BribeCard from '../components/BribeCard.vue';
import Feedback from '../components/Feedback.vue';
import { when } from '../format';
import { bribe, getPolice, reportSabotage, type PoliceInfo } from '../game';
import { useAction } from '../useAction';

const police = ref<PoliceInfo | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    police.value = (await getPolice()).police;
  }),
);

async function act(task: () => Promise<{ police: PoliceInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    police.value = result.police;
    message.value = result.message;
  }
}

const give = () => act(() => bribe('police'));
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1>{{ $t('police.title') }}</h1>
    <p class="bgr-muted">{{ $t('police.intro') }}</p>
    <Feedback :message="message" :error="error" />

    <template v-if="police">
      <dl class="bgr-stats-list">
        <dt>{{ $t('police.riskOfficial') }}</dt>
        <dd>{{ police.risks.official }}%</dd>
        <dt>{{ $t('police.riskBlack') }}</dt>
        <dd>{{ police.risks.black }}%</dd>
      </dl>

      <BribeCard :title="$t('police.bribe')" :info="police.police" :energy="police.energy" :busy="busy" @bribe="give" @notice="(text) => (message = text)" />

      <p class="bgr-muted">
        <RouterLink to="/city/hall">{{ $t('police.mayor') }}</RouterLink>
      </p>

      <div class="bgr-panel">
        <h2>{{ $t('police.report') }}</h2>
        <p class="bgr-muted">{{ $t('police.reportHint', { days: police.report_days, energy: police.report_energy }) }}</p>
        <p v-if="!police.reports.length" class="bgr-muted">{{ $t('police.noReports') }}</p>
        <div v-for="item in police.reports" :key="item.id" class="bgr-row">
          <span>{{ item.name }} <small class="bgr-muted">{{ when(item.start_at) }}</small></span>
          <button class="bgr-small" :disabled="busy" @click="act(() => reportSabotage(item.id))">{{ $t('police.send') }}</button>
        </div>
      </div>
    </template>
  </section>
</template>
