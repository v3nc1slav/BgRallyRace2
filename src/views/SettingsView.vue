<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import LangSwitch from '../components/LangSwitch.vue';
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
      <p><RouterLink to="/profile">&larr; {{ $t('settings.back') }}</RouterLink></p>
      <h1>{{ $t('settings.title') }}</h1>
      <h2>{{ $t('settings.language') }}</h2>
      <p class="bgr-muted">{{ $t('settings.languageHint') }}</p>
      <LangSwitch class="bgr-lang-start" />
      <Feedback :message="message" :error="error" />

      <template v-if="info">
        <h2>{{ $t('settings.device') }}</h2>
        <p v-if="!info.enabled" class="bgr-muted">{{ $t('settings.notConfigured') }}</p>
        <template v-else>
          <p class="bgr-muted">
            {{ here ? $t('settings.on') : $t('settings.pitch') }}
            {{ $t('settings.devices', { count: info.devices }) }}
          </p>
          <button v-if="!here" :disabled="busy" @click="act(() => enablePush(info!))">{{ $t('settings.enable') }}</button>
          <button v-else class="bgr-secondary" :disabled="busy" @click="act(disablePush)">{{ $t('settings.disable') }}</button>
        </template>

        <h2>{{ $t('settings.types') }}</h2>
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
