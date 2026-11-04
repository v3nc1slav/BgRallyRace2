<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { ask, tell } from '../dialog';
import { t } from '../i18n';
import BarScene from '../components/BarScene.vue';
import ChatBox from '../components/ChatBox.vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money, stamp } from '../format';
import { getBar, hire, type BarRole, type Rumor } from '../game';
import { useAction } from '../useAction';

const roles = ref<BarRole[]>([]);
const rumors = ref<Rumor[]>([]);
const rumorsNamed = ref(false);
const open = ref<string | null>(null);
const closer = ref<HTMLButtonElement>();
const { busy, message, error, run } = useAction();

const selected = computed(() => roles.value.find((role) => role.role === open.value) ?? null);

onMounted(() =>
  run(async () => {
    const data = await getBar();
    roles.value = data.bar.roles;
    rumors.value = data.bar.rumors;
    rumorsNamed.value = data.bar.rumors_named;
  }),
);

async function show(list: string) {
  message.value = '';
  error.value = '';
  open.value = list;
  await nextTick();
  closer.value?.focus();
}

function pick(role: BarRole) {
  if (!role.unlocked) {
    tell(t('bar.unlock', { level: role.unlock_level }), { title: role.label });
    return;
  }
  show(role.role);
}

async function hireCandidate(role: BarRole, id: number, name: string) {
  if (role.current && !await ask(t('bar.replaceConfirm', { name, current: role.current.name }))) {
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
  <section class="bgr-card">
    <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
    <div class="bgr-scene-stage" style="--ratio: 1.47">
      <BarScene :roles="roles" :inert="!!open" @rumors="show('rumors')" @chat="show('chat')" @role="pick" />
      <div v-if="open" class="bgr-scene-list">
        <button ref="closer" class="bgr-scene-close" :aria-label="$t('bar.close')" @click="open = null">&times;</button>

        <template v-if="open === 'rumors'">
          <h2>{{ $t('bar.rumors') }}</h2>
          <p v-if="!rumorsNamed" class="bgr-muted">{{ $t('bar.informant') }}</p>
          <p v-if="!rumors.length" class="bgr-muted">{{ $t('bar.quiet') }}</p>
          <ul v-else class="bgr-chronicle">
            <li v-for="(rumor, index) in rumors" :key="index">
              <small class="bgr-muted">{{ stamp(rumor.at) }}</small>
              {{ rumor.text }}
            </li>
          </ul>
        </template>

        <ChatBox v-else-if="open === 'chat'" />

        <template v-else-if="selected">
          <h2>{{ selected.label }}</h2>
          <Feedback :message="message" :error="error" />
          <p v-if="selected.current" class="bgr-muted">
            {{ $t('bar.current', { name: selected.current.name, skill: selected.current.skill, pay: money(selected.current.salary) }) }}
          </p>
          <p v-if="!selected.candidates.length" class="bgr-muted">{{ $t('bar.none') }}</p>
          <div v-else class="bgr-scroll">
            <table class="bgr-table">
              <tbody>
                <tr v-for="candidate in selected.candidates" :key="candidate.id">
                  <td>{{ candidate.name }}</td>
                  <td><HealthBar :value="candidate.skill" /></td>
                  <td>{{ $t('common.perWeek', { pay: money(candidate.salary) }) }}</td>
                  <td class="bgr-right">
                    <button class="bgr-small" :disabled="busy" @click="hireCandidate(selected, candidate.id, candidate.name)">{{ $t('bar.hire') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>

    <Feedback v-if="!open" :message="message" :error="error" />
    <p class="bgr-muted bgr-bar-info">{{ $t('bar.intro') }}</p>
  </section>
</template>
