<script setup lang="ts">
import { computed } from 'vue';
import BarPerson, { type PersonLook } from './BarPerson.vue';

const props = withDefaults(defineProps<{ x: number; y: number; scale?: number; look?: PersonLook; pants?: string; still?: boolean; run?: boolean }>(), {
  scale: 0.4,
  look: () => ({}),
  pants: '#2b2f37',
});

const FEET = 235;
const head = computed(() => props.y - FEET * props.scale);
</script>

<template>
  <g class="bgr-mall-walker" :class="{ still, run }">
    <g :transform="`translate(${x} ${head}) scale(${scale})`">
      <g class="bgr-mall-leg">
        <rect x="-30" y="128" width="26" height="98" rx="9" :fill="pants" />
        <ellipse cx="-17" cy="229" rx="17" ry="7" fill="#15171c" />
      </g>
      <g class="bgr-mall-leg bgr-mall-leg-b">
        <rect x="4" y="128" width="26" height="98" rx="9" :fill="pants" />
        <ellipse cx="17" cy="229" rx="17" ry="7" fill="#15171c" />
      </g>
    </g>
    <BarPerson v-bind="look" :x="x" :y="head" :scale="scale" />
  </g>
</template>
