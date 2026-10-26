<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ask } from '../dialog';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import { money } from '../format';
import { getJobs, quitJob, takeJob, type JobsInfo } from '../game';
import { useAction } from '../useAction';

const jobs = ref<JobsInfo | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    jobs.value = (await getJobs()).jobs;
  }),
);

async function act(task: () => Promise<{ jobs: JobsInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    jobs.value = result.jobs;
    message.value = result.message;
  }
}

async function quit() {
  if (await ask(t('jobs.quitConfirm'))) {
    act(quitJob);
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <h1>{{ $t('jobs.title') }}</h1>
    <p class="bgr-muted">{{ $t('jobs.intro') }}</p>
    <Feedback :message="message" :error="error" />

    <template v-if="jobs">
      <div v-if="jobs.current" class="bgr-panel">
        <p>
          {{ $t('jobs.current') }} <b>{{ jobs.current.name.toLowerCase() }}</b> ({{ jobs.current.building }}):
          {{ $t('jobs.currentPay', { pay: money(jobs.current.pay), energy: jobs.current.energy }) }}
        </p>
        <button class="bgr-small bgr-secondary" :disabled="busy" @click="quit">{{ $t('jobs.quit') }}</button>
      </div>
      <p v-if="!jobs.can_take" class="bgr-muted">{{ jobs.locked_reason }}</p>

      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>{{ $t('jobs.job') }}</th><th>{{ $t('jobs.pay') }}</th><th>{{ $t('jobs.energy') }}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="job in jobs.jobs" :key="job.id" :class="{ 'bgr-locked': job.locked, 'bgr-me': jobs.current?.id === job.id }">
              <td>{{ job.name }}<small class="bgr-muted">{{ job.building }}</small></td>
              <td>{{ $t('jobs.perDay', { pay: money(job.pay) }) }}</td>
              <td>{{ job.energy }}</td>
              <td class="bgr-right">
                <small v-if="job.locked" class="bgr-muted">{{ $t('common.fromLevel', { level: job.min_level }) }}</small>
                <small v-else-if="jobs.current?.id === job.id" class="bgr-ok">{{ $t('jobs.yours') }}</small>
                <button v-else-if="jobs.can_take" class="bgr-small" :disabled="busy" @click="act(() => takeJob(job.id))">{{ $t('jobs.take') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
