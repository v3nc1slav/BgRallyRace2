<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money } from '../format';
import { getBar, hire, type BarRole } from '../game';
import { useAction } from '../useAction';

const roles = ref<BarRole[]>([]);
const city = ref('');
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    const data = await getBar();
    roles.value = data.bar.roles;
    city.value = data.bar.city;
  }),
);

async function hireCandidate(role: BarRole, id: number, name: string) {
  if (role.current && !window.confirm(`${name} ще замени ${role.current.name}. Продължаваш ли?`)) {
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
      <p><RouterLink to="/city">&larr; Градът</RouterLink></p>
      <h1>Бар<span v-if="city" class="bgr-muted"> · {{ city }}</span></h1>
      <p class="bgr-muted">Всеки понеделник идват нови кандидати. Който наемеш, вече не е на разположение за другите отбори.</p>
      <Feedback :message="message" :error="error" />
    </section>

    <section v-for="role in roles" :key="role.role" class="bgr-card" :class="{ 'bgr-locked': !role.unlocked }">
      <h2>{{ role.label }}</h2>
      <p v-if="!role.unlocked" class="bgr-muted">Отключва се с гараж ниво {{ role.unlock_level }}.</p>
      <p v-if="role.current" class="bgr-muted">
        Сега: {{ role.current.name }}, умение {{ role.current.skill }}, {{ money(role.current.salary) }}/седм.
      </p>
      <p v-if="!role.candidates.length" class="bgr-muted">Няма кандидати тази седмица.</p>
      <div v-else class="bgr-scroll">
        <table class="bgr-table">
          <tbody>
            <tr v-for="candidate in role.candidates" :key="candidate.id">
              <td>{{ candidate.name }}</td>
              <td><HealthBar :value="candidate.skill" /></td>
              <td>{{ money(candidate.salary) }}/седм.</td>
              <td class="bgr-right">
                <button class="bgr-small" :disabled="busy || !role.unlocked" @click="hireCandidate(role, candidate.id, candidate.name)">Наеми</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
