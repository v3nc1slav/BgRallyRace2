<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Feedback from '../components/Feedback.vue';
import { stamp, when } from '../format';
import { createTopic, getForum, type ForumInfo } from '../game';
import { useAction } from '../useAction';

const router = useRouter();
const forum = ref<ForumInfo | null>(null);
const section = ref('');
const writing = ref(false);
const draft = reactive({ section: 'general', title: '', text: '' });
const { busy, message, error, run } = useAction();

async function load(key = section.value) {
  section.value = key;
  const result = await run(() => getForum(key));
  if (result) {
    forum.value = result.forum;
  }
}

async function submit() {
  const result = await run(() => createTopic(draft.section, draft.title, draft.text));
  if (result) {
    router.push(`/forum/${result.topic.topic.id}`);
  }
}

onMounted(() => load());
</script>

<template>
  <section class="bgr-card">
    <h1>Форум</h1>
    <Feedback :message="message" :error="error" />

    <template v-if="forum">
      <div class="bgr-tabs bgr-wrap">
        <button :class="{ active: !section }" @click="load('')">Всички</button>
        <button v-for="item in forum.sections" :key="item.key" :class="{ active: section === item.key }" @click="load(item.key)">
          {{ item.label }} ({{ item.topics }})
        </button>
      </div>

      <p v-if="forum.muted_until" class="bgr-error">Заглушен си до {{ when(forum.muted_until) }}.</p>
      <template v-else-if="forum.can_create">
        <button v-if="!writing" class="bgr-small" @click="writing = true">Нова тема</button>
        <form v-else class="bgr-form bgr-panel" @submit.prevent="submit">
          <label>
            Раздел
            <select v-model="draft.section">
              <option v-for="item in forum.sections" :key="item.key" :value="item.key">{{ item.label }}</option>
            </select>
          </label>
          <label>
            Заглавие
            <input v-model="draft.title" maxlength="150" required />
          </label>
          <label>
            Текст
            <textarea v-model="draft.text" rows="5" :maxlength="forum.max_length" required />
          </label>
          <div class="bgr-actions">
            <button :disabled="busy">Публикувай</button>
            <button type="button" class="bgr-secondary" @click="writing = false">Отказ</button>
          </div>
        </form>
      </template>
      <p v-else class="bgr-muted">Нова тема можеш да отвориш от ниво {{ forum.topic_level }}. Отговаряш от първо ниво.</p>

      <p v-if="!forum.topics.length" class="bgr-muted">Няма теми.</p>
      <ul v-else class="bgr-list bgr-topics">
        <li v-for="topic in forum.topics" :key="topic.id">
          <RouterLink :to="`/forum/${topic.id}`" class="bgr-rally">
            <div>
              <b>{{ topic.title }}</b>
              <small class="bgr-muted">{{ topic.section_label }} · {{ topic.author }}</small>
            </div>
            <small class="bgr-muted">{{ topic.posts }} мнения · {{ stamp(topic.last_post_at) }}</small>
          </RouterLink>
        </li>
      </ul>
    </template>
  </section>
</template>
