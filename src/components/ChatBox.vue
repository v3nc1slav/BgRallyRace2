<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ask } from '../dialog';
import { t } from '../i18n';
import { errorMessage } from '../api';
import { stamp, when } from '../format';
import { getChat, reportMessage, sendChat, type ChatInfo, type ChatMessage } from '../game';

const POLL_MS = 10000;
const KEEP = 100;

const messages = ref<ChatMessage[]>([]);
const mutedUntil = ref<string | null>(null);
const maxLength = ref(300);
const text = ref('');
const error = ref('');
const notice = ref('');
const busy = ref(false);
const list = ref<HTMLElement | null>(null);
let timer = 0;

const lastId = () => messages.value.at(-1)?.id ?? 0;

async function apply(chat: ChatInfo) {
  mutedUntil.value = chat.muted_until;
  maxLength.value = chat.max_length;
  const fresh = chat.messages.filter((m) => m.id > lastId());
  if (!fresh.length) {
    return;
  }
  messages.value = [...messages.value, ...fresh].slice(-KEEP);
  await nextTick();
  list.value?.scrollTo({ top: list.value.scrollHeight });
}

async function poll() {
  try {
    await apply((await getChat(lastId())).chat);
  } catch {
    return;
  }
}

async function send() {
  if (!text.value.trim()) {
    return;
  }
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await apply((await sendChat(text.value, lastId())).chat);
    text.value = '';
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function report(message: ChatMessage) {
  if (!await ask(t('chat.reportConfirm', { author: message.author }))) {
    return;
  }
  try {
    await reportMessage(message.id);
    notice.value = t('chat.reported');
  } catch (e) {
    error.value = errorMessage(e);
  }
}

onMounted(() => {
  poll();
  timer = window.setInterval(poll, POLL_MS);
});
onBeforeUnmount(() => window.clearInterval(timer));
</script>

<template>
  <section class="bgr-card">
    <h2>{{ $t('chat.title') }}</h2>
    <div ref="list" class="bgr-chat">
      <p v-if="!messages.length" class="bgr-muted">{{ $t('chat.empty') }}</p>
      <div v-for="message in messages" :key="message.id" class="bgr-chat-line" :class="{ own: message.own }">
        <small class="bgr-muted">{{ stamp(message.at) }}</small>
        <b>{{ message.author }}</b>
        <span>{{ message.text }}</span>
        <button v-if="!message.own" class="bgr-link bgr-report" :title="$t('common.reportTitle')" @click="report(message)">{{ $t('common.report') }}</button>
      </div>
    </div>
    <p v-if="mutedUntil" class="bgr-error">{{ $t('common.mutedUntil', { time: when(mutedUntil) }) }}</p>
    <form v-else class="bgr-chat-form" @submit.prevent="send">
      <input v-model="text" :maxlength="maxLength" :placeholder="$t('chat.placeholder')" />
      <button :disabled="busy || !text.trim()">{{ $t('chat.send') }}</button>
    </form>
    <p v-if="error" class="bgr-error">{{ error }}</p>
    <p v-else-if="notice" class="bgr-ok">{{ notice }}</p>
  </section>
</template>
