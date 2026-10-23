<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchCities, type City } from '../session';

const model = defineModel<number>({ required: true });
const cities = ref<City[]>([]);

onMounted(async () => {
  cities.value = await fetchCities().catch(() => []);
});
</script>

<template>
  <select v-model.number="model" required>
    <option :value="0" disabled>{{ $t('auth.chooseCity') }}</option>
    <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
  </select>
</template>
