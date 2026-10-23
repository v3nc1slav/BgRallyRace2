<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LANGS, setLang, type Lang } from '../i18n';
import { loadSession, session } from '../session';

const { locale } = useI18n();

function choose(code: Lang) {
  if (code === locale.value) {
    return;
  }
  setLang(code);
  if (session.player) {
    loadSession().catch(() => undefined);
  }
}
</script>

<template>
  <div class="bgr-lang" role="group" :aria-label="$t('lang.label')">
    <button
      v-for="item in LANGS"
      :key="item.code"
      type="button"
      class="bgr-small"
      :class="{ 'bgr-secondary': locale !== item.code }"
      :aria-pressed="locale === item.code"
      :title="item.label"
      @click="choose(item.code)"
    >
      {{ item.code.toUpperCase() }}
    </button>
  </div>
</template>
