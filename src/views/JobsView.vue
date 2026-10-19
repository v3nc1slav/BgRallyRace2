<script setup lang="ts">
import { onMounted, ref } from 'vue';
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

function quit() {
  if (window.confirm('Ако напуснеш, нова работа ще можеш да започнеш чак през следващия сезон. Напускаш ли?')) {
    act(quitJob);
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>Работа</h1>
    <p class="bgr-muted">
      Всяка нощ работата взима енергия от новия ден и изплаща заплатата, дори когато не влизаш в играта.
      Работата се избира за целия сезон.
    </p>
    <Feedback :message="message" :error="error" />

    <template v-if="jobs">
      <div v-if="jobs.current" class="bgr-panel">
        <p>
          Работиш като <b>{{ jobs.current.name.toLowerCase() }}</b> ({{ jobs.current.building }}):
          {{ money(jobs.current.pay) }} и {{ jobs.current.energy }} енергия на ден.
        </p>
        <button class="bgr-small bgr-secondary" :disabled="busy" @click="quit">Напусни</button>
      </div>
      <p v-if="!jobs.can_take" class="bgr-muted">{{ jobs.locked_reason }}</p>

      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead><tr><th>Работа</th><th>Заплата</th><th>Енергия</th><th></th></tr></thead>
          <tbody>
            <tr v-for="job in jobs.jobs" :key="job.id" :class="{ 'bgr-locked': job.locked, 'bgr-me': jobs.current?.id === job.id }">
              <td>{{ job.name }}<small class="bgr-muted">{{ job.building }}</small></td>
              <td>{{ money(job.pay) }}/ден</td>
              <td>{{ job.energy }}</td>
              <td class="bgr-right">
                <small v-if="job.locked" class="bgr-muted">от ниво {{ job.min_level }}</small>
                <small v-else-if="jobs.current?.id === job.id" class="bgr-ok">твоята работа</small>
                <button v-else-if="jobs.can_take" class="bgr-small" :disabled="busy" @click="act(() => takeJob(job.id))">Започни</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
