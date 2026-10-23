<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '../i18n';
import ChatBox from '../components/ChatBox.vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money, stamp } from '../format';
import { getBar, hire, type BarRole, type Rumor } from '../game';
import { useAction } from '../useAction';

const roles = ref<BarRole[]>([]);
const city = ref('');
const rumors = ref<Rumor[]>([]);
const rumorsNamed = ref(false);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    const data = await getBar();
    roles.value = data.bar.roles;
    city.value = data.bar.city;
    rumors.value = data.bar.rumors;
    rumorsNamed.value = data.bar.rumors_named;
  }),
);

async function hireCandidate(role: BarRole, id: number, name: string) {
  if (role.current && !window.confirm(t('bar.replaceConfirm', { name, current: role.current.name }))) {
    return;
  }
  const result = await run(() => hire(id));
  if (result) {
    roles.value = result.bar.roles;
    message.value = result.message;
  }
}
</script>

<template>
  <div class="bgr-stack">
    <section class="bgr-card">
      <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
      <h1>{{ $t('bar.title') }}<span v-if="city" class="bgr-muted"> · {{ city }}</span></h1>
      <p class="bgr-muted">{{ $t('bar.intro') }}</p>
      <Feedback :message="message" :error="error" />
    </section>

    <section class="bgr-card">
      <h2>{{ $t('bar.rumors') }}</h2>
      <p v-if="!rumorsNamed" class="bgr-muted">{{ $t('bar.informant') }}</p>
      <p v-if="!rumors.length" class="bgr-muted">{{ $t('bar.quiet') }}</p>
      <ul v-else class="bgr-chronicle">
        <li v-for="(rumor, index) in rumors" :key="index">
          <small class="bgr-muted">{{ stamp(rumor.at) }}</small>
          {{ rumor.text }}
        </li>
      </ul>
    </section>

    <ChatBox />

    <section v-for="role in roles" :key="role.role" class="bgr-card" :class="{ 'bgr-locked': !role.unlocked }">
      <h2>{{ role.label }}</h2>
      <p v-if="!role.unlocked" class="bgr-muted">{{ $t('bar.unlock', { level: role.unlock_level }) }}</p>
      <p v-if="role.current" class="bgr-muted">
        {{ $t('bar.current', { name: role.current.name, skill: role.current.skill, pay: money(role.current.salary) }) }}
      </p>
      <p v-if="!role.candidates.length" class="bgr-muted">{{ $t('bar.none') }}</p>
      <div v-else class="bgr-scroll">
        <table class="bgr-table">
          <tbody>
            <tr v-for="candidate in role.candidates" :key="candidate.id">
              <td>{{ candidate.name }}</td>
              <td><HealthBar :value="candidate.skill" /></td>
              <td>{{ $t('common.perWeek', { pay: money(candidate.salary) }) }}</td>
              <td class="bgr-right">
                <button class="bgr-small" :disabled="busy || !role.unlocked" @click="hireCandidate(role, candidate.id, candidate.name)">{{ $t('bar.hire') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
