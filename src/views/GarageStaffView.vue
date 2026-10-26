<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ask } from '../dialog';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money } from '../format';
import { fireStaff, getGarage, type CrewMember } from '../game';
import { useAction } from '../useAction';

const crew = ref<CrewMember[] | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    crew.value = (await getGarage()).garage.crew;
  }),
);

async function fire(member: CrewMember) {
  if (!await ask(t('garage.fireConfirm', { name: member.name, role: member.role_label.toLowerCase() }))) {
    return;
  }
  const result = await run(() => fireStaff(member.id));
  if (result) {
    crew.value = result.garage.crew;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/garage">&larr; {{ $t('garage.back') }}</RouterLink></p>
    <h1>{{ $t('garage.staff') }}</h1>
    <p class="bgr-muted"><RouterLink to="/city/bar">{{ $t('garage.hire') }}</RouterLink></p>
    <Feedback :message="message" :error="error" />

    <template v-if="crew">
      <p v-if="!crew.length" class="bgr-error">{{ $t('garage.noStaff') }}</p>
      <div v-else class="bgr-scroll">
        <table class="bgr-table">
          <thead>
            <tr><th>{{ $t('garage.role') }}</th><th>{{ $t('garage.name') }}</th><th>{{ $t('garage.skill') }}</th><th>{{ $t('garage.morale') }}</th><th>{{ $t('garage.physical') }}</th><th>{{ $t('garage.reputation') }}</th><th>{{ $t('garage.salary') }}</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="member in crew" :key="member.id">
              <th>{{ member.role_label }}</th>
              <td>
                {{ member.name }}
                <small v-if="member.energy !== null" class="bgr-muted">{{ $t('garage.energyToday', { energy: member.energy }) }}</small>
                <small v-if="member.unpaid" class="bgr-error">{{ $t('garage.unpaid') }}</small>
              </td>
              <td><HealthBar :value="member.skill" /></td>
              <td><HealthBar v-if="member.morale !== null" :value="member.morale" /></td>
              <td>{{ member.physical ?? '' }}</td>
              <td>{{ member.reputation ?? '' }}</td>
              <td>{{ $t('garage.perWeek', { amount: money(member.salary) }) }}</td>
              <td class="bgr-right"><button class="bgr-small bgr-secondary" :disabled="busy" @click="fire(member)">{{ $t('garage.fire') }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
