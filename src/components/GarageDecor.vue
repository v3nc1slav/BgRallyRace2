<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { BODY } from './garageGeometry';
import type { Garage } from '../game';
import { t } from '../i18n';

const props = defineProps<{ layer: 'wall' | 'floor'; level: number; trophies: Garage['trophies'] }>();
const emit = defineEmits<{ trophies: [] }>();

const now = ref(new Date());
let timer = 0;
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30000);
});
onBeforeUnmount(() => window.clearInterval(timer));

const hands = computed(() => {
  const hours = now.value.getHours() % 12;
  const minutes = now.value.getMinutes();
  return { hour: (hours + minutes / 60) * 30, minute: minutes * 6 };
});

const daylight = computed(() => {
  const hour = now.value.getHours() + now.value.getMinutes() / 60;
  if (hour >= 7 && hour < 19) {
    return 'day';
  }
  return (hour >= 6 && hour < 7) || (hour >= 19 && hour < 21) ? 'dusk' : 'night';
});

const SKY = { day: ['#8ecae6', '#d9eef6'], dusk: ['#6d597a', '#f4a261'], night: ['#0b1a2e', '#1d2d44'] };
const BUILDINGS = [
  { x: 664, w: 26, h: 58 },
  { x: 692, w: 20, h: 84 },
  { x: 714, w: 30, h: 46 },
  { x: 746, w: 18, h: 72 },
  { x: 766, w: 26, h: 56 },
];
const buildingColor = computed(() => ({ day: '#5c677d', dusk: '#3d4357', night: '#1a2130' })[daylight.value]);

const TROPHY_COLORS: Record<number, string> = { 1: '#f4c430', 2: '#c0c7d1', 3: '#cd7f32' };
const SHELF_Y = [200, 132];
const CAPACITY = 12;
const shown = computed(() =>
  props.trophies.slice(0, CAPACITY).map((trophy, index) => ({
    ...trophy,
    x: 40 + (index % 6) * 26,
    y: SHELF_Y[Math.floor(index / 6)] - 32,
    title: t('garage.scene.trophyTitle', { rally: trophy.rally, place: trophy.place }),
  })),
);
const extra = computed(() => Math.max(0, props.trophies.length - CAPACITY));
const shelves = computed(() => (props.trophies.length > 6 ? SHELF_Y : SHELF_Y.slice(0, 1)));
</script>

<template>
  <g v-if="layer === 'wall'">
    <g class="bgr-gs-window" :data-daylight="daylight">
      <defs>
        <clipPath id="bgr-gs-glass">
          <rect x="664" y="158" width="128" height="120" />
        </clipPath>
        <linearGradient id="bgr-gs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="SKY[daylight][0]" />
          <stop offset="1" :stop-color="SKY[daylight][1]" />
        </linearGradient>
      </defs>
      <rect x="656" y="150" width="144" height="136" rx="4" fill="#1c1f25" />
      <g clip-path="url(#bgr-gs-glass)">
        <rect x="664" y="158" width="128" height="120" fill="url(#bgr-gs-sky)" />
        <circle v-if="daylight === 'day'" cx="770" cy="180" r="11" fill="#ffd166" />
        <circle v-else-if="daylight === 'night'" cx="772" cy="178" r="8" fill="#e9ecf1" />
        <g v-if="daylight === 'night'" fill="#ffffff">
          <circle v-for="(star, index) in [[676, 170], [700, 166], [724, 182], [748, 168], [688, 190]]" :key="index" :cx="star[0]" :cy="star[1]" r="1.2" />
        </g>
        <g v-for="(building, index) in BUILDINGS" :key="index">
          <rect :x="building.x" :y="262 - building.h" :width="building.w" :height="building.h" :fill="buildingColor" />
          <g v-if="daylight !== 'day'" fill="#ffd166" opacity="0.85">
            <rect v-for="row in Math.floor(building.h / 16)" :key="row" :x="building.x + 5" :y="262 - building.h + row * 14 - 6" width="5" height="5" />
          </g>
        </g>
        <rect x="664" y="262" width="128" height="16" fill="#3a3f47" />
        <line x1="664" y1="270" x2="792" y2="270" stroke="#f4d35e" stroke-width="1.5" stroke-dasharray="6 6" />
        <g class="bgr-gs-passing">
          <rect x="640" y="257" width="26" height="9" rx="3" fill="#e63946" />
          <rect x="646" y="252" width="14" height="6" rx="2" fill="#9fc3d8" />
          <circle cx="646" cy="267" r="3" fill="#15171c" />
          <circle cx="660" cy="267" r="3" fill="#15171c" />
        </g>
      </g>
      <rect x="726" y="158" width="4" height="120" fill="#1c1f25" />
      <rect x="664" y="216" width="128" height="4" fill="#1c1f25" />
      <rect x="650" y="286" width="156" height="8" rx="2" fill="#2b2f37" />
      <rect v-if="daylight === 'day'" x="664" y="158" width="128" height="120" fill="#ffffff" opacity="0.06" />
    </g>

    <g class="bgr-gs-clock" :transform="`translate(575 74)`">
      <circle r="20" fill="#f1f3f5" stroke="#2b2f37" stroke-width="4" />
      <line v-for="index in 12" :key="index" x1="0" y1="-16" x2="0" y2="-13" stroke="#2b2f37" stroke-width="2" :transform="`rotate(${index * 30})`" />
      <line x1="0" y1="2" x2="0" y2="-9" stroke="#15171c" stroke-width="3" stroke-linecap="round" :transform="`rotate(${hands.hour})`" />
      <line x1="0" y1="3" x2="0" y2="-14" stroke="#e63946" stroke-width="2" stroke-linecap="round" :transform="`rotate(${hands.minute})`" />
      <circle r="2.5" fill="#15171c" />
    </g>

    <g class="bgr-gs-firstaid">
      <rect x="232" y="382" width="34" height="26" rx="3" fill="#f1f3f5" stroke="#9aa1ad" stroke-width="1.5" />
      <rect x="245" y="386" width="8" height="18" fill="#d62828" />
      <rect x="240" y="391" width="18" height="8" fill="#d62828" />
    </g>

    <g class="bgr-gs-hot bgr-gs-trophies" role="button" tabindex="0" @click="emit('trophies')" @keydown.enter="emit('trophies')">
      <title>{{ trophies.length ? $t('garage.scene.trophies') : $t('garage.scene.trophiesEmpty') }}</title>
      <g v-for="y in shelves" :key="`trophy-shelf-${y}`">
        <rect x="30" :y="y" width="170" height="6" fill="#6b543b" />
        <path :d="`M40 ${y + 6} l0 10 l10 -10 M190 ${y + 6} l0 10 l-10 -10`" stroke="#4b3a28" stroke-width="3" fill="none" />
      </g>
      <rect x="30" y="94" width="170" height="214" fill="transparent" />
      <g v-for="(trophy, index) in shown" :key="`trophy-${index}`" class="bgr-gs-trophy">
        <title>{{ trophy.title }}</title>
        <template v-if="trophy.place === 1">
          <path :d="`M${trophy.x + 3} ${trophy.y + 2} h16 v6 q0 9 -8 11 q-8 -2 -8 -11 z`" :fill="TROPHY_COLORS[1]" stroke="#9c7a12" stroke-width="1" />
          <path :d="`M${trophy.x + 3} ${trophy.y + 5} q-5 1 -2 7 M${trophy.x + 19} ${trophy.y + 5} q5 1 2 7`" fill="none" :stroke="TROPHY_COLORS[1]" stroke-width="2" />
          <rect :x="trophy.x + 9.5" :y="trophy.y + 19" width="3" height="6" :fill="TROPHY_COLORS[1]" />
          <rect :x="trophy.x + 5" :y="trophy.y + 25" width="12" height="7" rx="1" fill="#4b3a28" />
        </template>
        <template v-else>
          <polygon :points="`${trophy.x + 5},${trophy.y + 4} ${trophy.x + 11},${trophy.y + 16} ${trophy.x + 17},${trophy.y + 4}`" :fill="trophy.place === 2 ? '#457b9d' : '#e63946'" />
          <circle :cx="trophy.x + 11" :cy="trophy.y + 22" r="8" :fill="TROPHY_COLORS[trophy.place]" stroke="#5b6270" stroke-width="1" />
          <text :x="trophy.x + 11" :y="trophy.y + 25.5" class="bgr-gs-medal">{{ trophy.place }}</text>
        </template>
      </g>
      <text v-if="extra" x="196" :y="SHELF_Y[1] - 8" class="bgr-gs-medal" text-anchor="end">+{{ extra }}</text>
      <g v-if="!trophies.length">
        <rect x="88" y="206" width="54" height="14" rx="2" fill="#b08d57" stroke="#6b543b" stroke-width="1" />
        <text x="115" y="216.5" class="bgr-gs-plaque">{{ $t('garage.scene.trophies') }}</text>
      </g>
    </g>
  </g>

  <g v-else>
    <g class="bgr-gs-extinguisher">
      <rect x="203" y="536" width="22" height="8" rx="2" fill="#2b2f37" />
      <rect x="205" y="540" width="18" height="54" rx="7" fill="#d62828" stroke="#8b1a1a" stroke-width="1.5" />
      <rect x="205" y="556" width="18" height="12" fill="#f1f3f5" />
      <path d="M223 544 q12 4 6 24" fill="none" stroke="#15171c" stroke-width="3" />
    </g>

    <g v-if="level >= 2" class="bgr-gs-bench">
      <g v-if="level >= 4">
        <rect x="846" y="495" width="138" height="96" fill="#c0392b" stroke="#8b1a1a" stroke-width="2" />
        <g v-for="row in 3" :key="`drawer-${row}`">
          <rect x="852" :y="499 + (row - 1) * 30" width="126" height="26" fill="#d0473a" stroke="#8b1a1a" stroke-width="1" />
          <rect x="903" :y="510 + (row - 1) * 30" width="24" height="4" rx="2" fill="#d7dbe0" />
        </g>
      </g>
      <g v-else>
        <rect x="846" y="495" width="9" height="96" fill="#6b543b" />
        <rect x="975" y="495" width="9" height="96" fill="#6b543b" />
        <rect x="846" y="560" width="138" height="6" fill="#6b543b" />
        <g v-if="level >= 3">
          <rect x="862" y="542" width="30" height="18" rx="2" fill="#c9a36b" stroke="#8b6f4e" stroke-width="1" />
          <rect x="898" y="546" width="26" height="14" rx="2" fill="#c9a36b" stroke="#8b6f4e" stroke-width="1" />
        </g>
      </g>
      <rect x="840" y="486" width="150" height="10" rx="2" :fill="level >= 4 ? '#8d939c' : '#8b6f4e'" stroke="#2b2f37" stroke-width="1.5" />
      <rect x="844" y="472" width="20" height="14" fill="#6b7280" stroke="#2b2f37" stroke-width="1" />
      <rect x="840" y="468" width="8" height="8" fill="#9aa1ad" />
      <path d="M874 484 l26 -6 M896 476 l6 4" stroke="#c5cbd3" stroke-width="3" stroke-linecap="round" />
      <path d="M906 484 l20 0 M922 478 l0 10" stroke="#e63946" stroke-width="3" stroke-linecap="round" />
      <g v-if="level >= 3">
        <rect x="944" y="468" width="38" height="18" rx="2" fill="#c0392b" stroke="#8b1a1a" stroke-width="1" />
        <path d="M954 468 q9 -8 18 0" fill="none" stroke="#2b2f37" stroke-width="2.5" />
      </g>
      <g v-if="level >= 5" class="bgr-gs-monitor">
        <rect x="878" y="440" width="58" height="38" rx="3" fill="#15171c" stroke="#2b2f37" stroke-width="2" />
        <rect x="882" y="444" width="50" height="30" fill="#0d1b2a" />
        <path :d="BODY" transform="translate(884 451) scale(0.135)" fill="none" stroke="#06d6a0" stroke-width="7" />
        <rect x="903" y="478" width="8" height="8" fill="#2b2f37" />
      </g>
      <g v-else class="bgr-gs-blueprint">
        <path d="M884 486 l8 -44 M930 486 l-8 -44" stroke="#6b543b" stroke-width="3" />
        <rect x="878" y="440" width="58" height="36" rx="1" fill="#1d4e89" stroke="#0d2a4a" stroke-width="1.5" />
        <path d="M878 452 h58 M878 464 h58 M897 440 v36 M917 440 v36" stroke="#3d72b0" stroke-width="0.8" />
        <path :d="BODY" transform="translate(884 448) scale(0.135)" fill="none" stroke="#ffffff" stroke-width="7" />
      </g>
    </g>
  </g>
</template>
