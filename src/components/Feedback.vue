<script setup lang="ts">
defineProps<{ message?: string; error?: string }>();
</script>

<template>
  <p v-if="error" class="bgr-error bgr-feedback">{{ error }}</p>
  <p v-else-if="message" class="bgr-ok bgr-feedback">{{ message }}</p>
</template>
