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
    <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
    <h1>Полиция</h1>
    <p class="bgr-muted">Полицията следи тренировките на официалната писта през седмицата и черната писта.</p>
    <Feedback :message="message" :error="error" />

    <template v-if="police">
      <dl class="bgr-stats-list">
        <dt>Риск на официалната писта</dt>
        <dd>{{ police.risks.official }}%</dd>
        <dt>Риск на черната писта</dt>
        <dd>{{ police.risks.black }}%</dd>
      </dl>

      <BribeCard title="Подкуп на полицията – до края на деня" :info="police.police" :energy="police.energy" :busy="busy" @bribe="give" />

      <p class="bgr-muted">
        <RouterLink to="/city/hall">Подкуп на кмета – по-скъп, но пази цяла седмица и дава разрешение за гаража</RouterLink>
      </p>

      <div class="bgr-panel">
        <h2>Сигнал за саботаж</h2>
        <p class="bgr-muted">
          Ако подозираш саботаж, подай сигнал до {{ police.report_days }} дни след ралито ({{ police.report_energy }} енергия).
          С информатор полицията разкрива саботажите по-често.
        </p>
        <p v-if="!police.reports.length" class="bgr-muted">Няма скорошни ралита, за които да подадеш сигнал.</p>
        <div v-for="item in police.reports" :key="item.id" class="bgr-row">
          <span>{{ item.name }} <small class="bgr-muted">{{ when(item.start_at) }}</small></span>
          <button class="bgr-small" :disabled="busy" @click="act(() => reportSabotage(item.id))">Подай сигнал</button>
        </div>
      </div>
    </template>
  </section>
</template>
