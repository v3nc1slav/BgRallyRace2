<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { CityView } from '../city';
import type { CityPlace } from '../scenes/CityScene';

const props = defineProps<{ name: string; perks: string; places: CityPlace[] }>();
const emit = defineEmits<{ failed: [] }>();
const router = useRouter();
const box = ref<HTMLElement>();
let view: CityView | null = null;
let observer: ResizeObserver | null = null;
let unmounted = false;

onMounted(async () => {
  try {
    const { createCityView } = await import('../city');
    if (unmounted || !box.value) {
      return;
    }
    view = createCityView(box.value, props.name, props.places, (to) => router.push(to));
    view.setPerks(props.perks);
    observer = new ResizeObserver(() => view?.resize());
    observer.observe(box.value);
  } catch {
    emit('failed');
  }
});

watch(
  () => props.perks,
  (text) => view?.setPerks(text),
);

onBeforeUnmount(() => {
  unmounted = true;
  observer?.disconnect();
  view?.destroy();
});
</script>

<template>
  <div class="bgr-city-map">
    <div ref="box" class="bgr-city-canvas" @wheel.prevent></div>
    <div class="bgr-city-tools">
      <button class="bgr-small bgr-secondary" aria-label="Приближи" @click="view?.zoomBy(1.3)">+</button>
      <button class="bgr-small bgr-secondary" aria-label="Отдалечи" @click="view?.zoomBy(0.77)">−</button>
      <button class="bgr-small bgr-secondary" @click="view?.reset()">Целият град</button>
    </div>
  </div>
</template>
