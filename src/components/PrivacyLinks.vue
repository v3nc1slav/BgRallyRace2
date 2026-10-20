<script setup lang="ts">
import { session } from '../session';
</script>

<template>
  <p v-if="session.links.privacy || session.links.deletion" class="bgr-muted bgr-legal">
    <a v-if="session.links.privacy" :href="session.links.privacy" target="_blank" rel="noopener">Политика за поверителност</a>
    <a v-if="session.links.deletion" :href="session.links.deletion" target="_blank" rel="noopener">Изтриване на профила</a>
  </p>
</template>
