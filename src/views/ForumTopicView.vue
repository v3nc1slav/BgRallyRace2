<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '../i18n';
import { useRoute } from 'vue-router';
import Feedback from '../components/Feedback.vue';
import { stamp, when } from '../format';
import { getTopic, replyTopic, reportMessage, type ChatMessage, type TopicInfo } from '../game';
import { useAction } from '../useAction';

const route = useRoute();
const id = Number(route.params.id);
const topic = ref<TopicInfo | null>(null);
const text = ref('');
const { busy, message, error, run } = useAction();

async function load(page = 1) {
  const result = await run(() => getTopic(id, page));
  if (result) {
    topic.value = result.topic;
  }
}

async function reply() {
  const result = await run(() => replyTopic(id, text.value));
  if (result) {
    topic.value = result.topic;
    message.value = result.message;
    text.value = '';
  }
}

async function report(post: ChatMessage) {
  if (window.confirm(t('forum.reportConfirm', { author: post.author }))) {
    const result = await run(() => reportMessage(post.id));
    if (result) {
      message.value = t('forum.reported');
    }
  }
}

onMounted(() => load());
</script>

<template>
  <section class="bgr-card">
    <p><RouterLink to="/forum">&larr; {{ $t('forum.title') }}</RouterLink></p>
    <Feedback :message="message" :error="error" />

    <template v-if="topic">
      <h1>{{ topic.topic.title }}</h1>
      <p class="bgr-muted">{{ topic.topic.section_label }}</p>

      <article v-for="post in topic.posts" :key="post.id" class="bgr-post" :class="{ own: post.own }">
        <header>
          <b>{{ post.author }}</b>
          <small class="bgr-muted">{{ stamp(post.at) }}</small>
          <button v-if="!post.own" class="bgr-link bgr-report" @click="report(post)">{{ $t('common.report') }}</button>
        </header>
        <p>{{ post.text }}</p>
      </article>

      <div v-if="topic.pages > 1" class="bgr-tabs bgr-wrap">
        <button v-for="page in topic.pages" :key="page" :class="{ active: page === topic.page }" @click="load(page)">{{ page }}</button>
      </div>

      <p v-if="topic.muted_until" class="bgr-error">{{ $t('common.mutedUntil', { time: when(topic.muted_until) }) }}</p>
      <form v-else class="bgr-form bgr-panel" @submit.prevent="reply">
        <label>
          {{ $t('forum.reply') }}
          <textarea v-model="text" rows="4" :maxlength="topic.max_length" required />
        </label>
        <button :disabled="busy || !text.trim()">{{ $t('common.publish') }}</button>
      </form>
    </template>
  </section>
</template>
