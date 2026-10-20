<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { getNotifications, saveNotificationPreferences, type NotifyInfo } from '../game';
import { disablePush, enablePush, storedPushToken } from '../push';
import { useAction } from '../useAction';

const info = ref<NotifyInfo | null>(null);
const here = ref(!!storedPushToken());
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    info.value = (await getNotifications()).notifications;
  }),
);

async function act(task: () => Promise<{ notifications: NotifyInfo; message: string }>) {
  const result = await run(task);
  if (result) {
    info.value = result.notifications;
    message.value = result.message;
    here.value = !!storedPushToken();
  }
}

function toggle(key: string, on: boolean) {
  if (!info.value) {
    return;
  }
  const keys = info.value.types.filter((type) => (type.key === key ? on : type.on)).map((type) => type.key);
  act(() => saveNotificationPreferences(keys));
}
</script>

<template>
  <div class="bgr-stack">
    <section class="bgr-card">
      <p><RouterLink to="/profile">&larr; Профил</RouterLink></p>
      <h1>Настройки</h1>
      <Feedback :message="message" :error="error" />

      <template v-if="info">
        <h2>Известия на това устройство</h2>
        <p v-if="!info.enabled" class="bgr-muted">Известията още не са настроени от администратора.</p>
        <template v-else>
          <p class="bgr-muted">
            {{ here ? 'Известията са включени на това устройство.' : 'Включи известията, за да научаваш за ралитата, резултатите и пазара, без да отваряш играта.' }}
            Устройства с известия: {{ info.devices }}.
          </p>
          <button v-if="!here" :disabled="busy" @click="act(() => enablePush(info!))">Включи известията</button>
          <button v-else class="bgr-secondary" :disabled="busy" @click="act(disablePush)">Изключи на това устройство</button>
        </template>

        <h2>Кои известия да получавам</h2>
        <div class="bgr-columns">
          <label v-for="type in info.types" :key="type.key" class="bgr-check">
            <input type="checkbox" :checked="type.on" :disabled="busy" @change="toggle(type.key, ($event.target as HTMLInputElement).checked)" />
            {{ type.label }}
          </label>
        </div>
      </template>
    </section>
  </div>
</template>
