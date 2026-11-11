<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { watchAd } from '../ads';
import { ask, tell } from '../dialog';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import PoliceScene from '../components/PoliceScene.vue';
import { money, when } from '../format';
import { bribe, getPolice, reportSabotage, type PoliceInfo } from '../game';
import { session } from '../session';
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

async function report() {
  const info = police.value;
  if (!info || busy.value) {
    return;
  }
  const title = t('police.report');
  const rally = info.reports[0];
  if (!rally) {
    await tell(t('police.noReports'), { title });
    return;
  }
  if (await ask(t('police.reportConfirm', { rally: rally.name, energy: info.report_energy }), { title, cancel: t('dialog.answerNo') })) {
    await act(() => reportSabotage(rally.id));
  }
}

async function offer() {
  const info = police.value;
  if (!info || busy.value) {
    return;
  }
  const deal = info.police;
  const title = t('police.bribe');
  if (deal.active_until) {
    await tell(t('bribe.active', { time: when(deal.active_until) }), { title });
    return;
  }
  if (deal.refused && !session.player?.perks.retry) {
    if (await ask(t('bribe.refused'), { title, ok: t('common.adRetry'), cancel: t('common.close') })) {
      const result = await run(() => watchAd('retry'));
      if (result) {
        message.value = result.message;
        await offer();
      }
    }
    return;
  }
  const lines = [deal.refused ? t('bribe.second') : '', t('bribe.chance', { chance: deal.chance }), `${t('bribe.give', { price: money(deal.price), energy: info.energy })}?`];
  if (await ask(lines.filter(Boolean).join('\n'), { title, cancel: t('dialog.answerNo') })) {
    await act(() => bribe('police'));
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <Feedback :message="message" :error="error" />
    <div class="bgr-scene-stage" style="--ratio: 1.7857">
      <PoliceScene :name="session.user?.name ?? ''" :risks="police?.risks ?? null" @report="report" @bribe="offer" />
    </div>
    <template v-if="police">
      <p class="bgr-muted">{{ $t('police.reportHint', { days: police.report_days, energy: police.report_energy }) }}</p>
      <p class="bgr-muted">
        <RouterLink to="/city/hall">{{ $t('police.mayor') }}</RouterLink>
      </p>
    </template>
  </section>
</template>
