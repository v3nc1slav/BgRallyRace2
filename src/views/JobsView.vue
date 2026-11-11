<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ask } from '../dialog';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import { money } from '../format';
import { getJobs, quitJob, takeJob, type JobsInfo } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const PINS = ['#e63946', '#2a6fdb', '#2e7d32', '#f4c430', '#8e24aa'];

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

const note = (index: number) => ({ '--pin': PINS[index % PINS.length], '--tilt': `${[-1.6, 1.1, -0.6, 1.7, -1.2][index % 5]}deg` });
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <Feedback :message="message" :error="error" />

    <div class="bgr-board">
      <header class="bgr-board-title">
        <h1>{{ $t('jobs.boardTitle', { city: session.player?.city ?? '' }) }}</h1>
        <p>{{ $t('jobs.boardHours') }}</p>
      </header>

      <div v-if="jobs" class="bgr-board-columns">
        <section class="bgr-board-section">
          <h2 class="bgr-board-label">{{ $t('jobs.notices') }}</h2>
          <article class="bgr-note" :style="note(1)">
            <p>{{ $t('jobs.intro') }}</p>
            <span class="bgr-note-lines" aria-hidden="true"></span>
          </article>
          <article v-if="jobs.current" class="bgr-note bgr-note-yours" :style="note(2)">
            <p>
              {{ $t('jobs.current') }} <b>{{ jobs.current.name.toLowerCase() }}</b> ({{ jobs.current.building }}):
              {{ $t('jobs.currentPay', { pay: money(jobs.current.pay), energy: jobs.current.energy }) }}
            </p>
            <button class="bgr-small bgr-secondary" :disabled="busy" @click="quit">{{ $t('jobs.quit') }}</button>
          </article>
          <article v-if="!jobs.can_take" class="bgr-note bgr-note-warning" :style="note(3)">
            <p>{{ jobs.locked_reason }}</p>
          </article>
        </section>

        <section class="bgr-board-section">
          <h2 class="bgr-board-label">{{ $t('jobs.offers') }}</h2>
          <div class="bgr-board-grid">
            <article
              v-for="(job, index) in jobs.jobs"
              :key="job.id"
              class="bgr-note bgr-note-job"
              :class="{ 'bgr-note-locked': job.locked, 'bgr-note-yours': jobs.current?.id === job.id }"
              :data-job="job.id"
              :style="note(index)"
            >
              <small class="bgr-note-org">{{ job.building }}</small>
              <h3>{{ job.name }}</h3>
              <dl>
                <dt>{{ $t('jobs.pay') }}</dt>
                <dd>{{ $t('jobs.perDay', { pay: money(job.pay) }) }}</dd>
                <dt>{{ $t('jobs.energy') }}</dt>
                <dd>{{ job.energy }}</dd>
              </dl>
              <span class="bgr-note-lines" aria-hidden="true"></span>
              <p v-if="job.locked" class="bgr-stamp">{{ $t('common.fromLevel', { level: job.min_level }) }}</p>
              <p v-else-if="jobs.current?.id === job.id" class="bgr-stamp bgr-stamp-ok">{{ $t('jobs.yours') }}</p>
              <button v-else-if="jobs.can_take" class="bgr-small" :disabled="busy" @click="act(() => takeJob(job.id))">{{ $t('jobs.take') }}</button>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
