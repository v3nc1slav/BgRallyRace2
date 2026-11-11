<script setup lang="ts">
import { computed } from 'vue';

export interface PersonLook {
  skin?: string;
  shirt?: string;
  hair?: string;
  hat?: string;
  cut?: 'short' | 'long' | 'bun' | 'bald' | 'cap' | 'hat' | 'hood';
  pose?: 'rest' | 'beer' | 'coffee' | 'cocktail' | 'cards' | 'paper' | 'talk' | 'whisper' | 'smoke' | 'polish' | 'walk' | 'bag' | 'clasp';
  bagColor?: string;
  mirror?: boolean;
  glasses?: boolean;
  beard?: boolean;
  laugh?: boolean;
  apron?: string;
  bow?: boolean;
  tie?: string;
  shirtFront?: string;
  uniform?: boolean;
  back?: boolean;
}

const props = withDefaults(defineProps<PersonLook & { x: number; y: number; scale?: number }>(), {
  scale: 0.45,
  skin: '#e9bd97',
  shirt: '#2f5d8a',
  hair: '#3a2a20',
  hat: '#c62828',
  cut: 'short',
  pose: 'rest',
});

function shade(hex: string, factor: number) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.min(255, Math.round(((value >> shift) & 255) * factor));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

const ARMS: Record<NonNullable<PersonLook['pose']>, [number, number, number, number][]> = {
  rest: [[-62, 104, -34, 128], [62, 104, 34, 128]],
  beer: [[-62, 104, -34, 128], [66, 100, 50, 46]],
  coffee: [[-62, 104, -34, 128], [62, 106, 36, 98]],
  cocktail: [[-62, 104, -34, 128], [62, 106, 38, 94]],
  cards: [[-58, 104, -16, 102], [58, 104, 16, 102]],
  paper: [[-60, 100, -44, 84], [60, 100, 44, 84]],
  talk: [[-62, 104, -34, 128], [70, 92, 60, 42]],
  whisper: [[-62, 104, -34, 128], [58, 96, 26, 28]],
  smoke: [[-62, 104, -34, 128], [60, 96, 24, 26]],
  polish: [[-56, 100, -14, 82], [56, 100, 14, 90]],
  walk: [[-64, 98, -68, 138], [64, 98, 68, 138]],
  bag: [[-64, 98, -68, 138], [64, 98, 70, 136]],
  clasp: [[-58, 106, -10, 106], [58, 106, 10, 106]],
};

const transform = computed(() => `translate(${props.x} ${props.y}) scale(${props.mirror ? -props.scale : props.scale} ${props.scale})`);
const arms = computed(() => ARMS[props.pose].map(([ex, ey, hx, hy], index) => ({ shoulder: index ? 48 : -48, ex, ey, hx, hy })));
const skinShade = computed(() => shade(props.skin, 0.88));
const shirtShade = computed(() => shade(props.shirt, 0.82));
const collar = computed(() => shade(props.shirt, 1.18));
</script>

<template>
  <g :transform="transform">
    <template v-if="back">
      <path v-if="cut === 'long'" d="M-31 -6 C-35 -34 -13 -47 2 -46 C22 -46 35 -33 31 -6 L33 50 Q0 58 -33 50 Z" :fill="hair" />
      <path d="M-64 140 L-59 80 C-57 62 -44 53 -24 48 L-11 44 H11 L24 48 C44 53 57 62 59 80 L64 140 Z" :fill="shirt" />
      <path d="M59 80 C57 62 44 53 24 48 L30 140 H64 Z" :fill="shirtShade" />
      <path d="M0 50 V140" :stroke="shirtShade" stroke-width="3" />
      <path d="M-11 26 V46 Q0 52 11 46 V26 Z" :fill="skinShade" />
      <path d="M-13 44 Q0 52 13 44 L16 51 Q0 60 -16 51 Z" :fill="collar" />
      <path d="M-48 62 Q-62 84 -60 106 M48 62 Q62 84 60 106" fill="none" :stroke="shirt" stroke-width="21" stroke-linecap="round" />
      <ellipse cx="-25" cy="0" rx="4" ry="8" :fill="skinShade" />
      <ellipse cx="25" cy="0" rx="4" ry="8" :fill="skinShade" />
      <path d="M-24 -6 C-24 -26 -12 -32 0 -32 C12 -32 24 -26 24 -6 C24 12 18 26 8 32 C3 35 -3 35 -8 32 C-18 26 -24 12 -24 -6 Z" :fill="cut === 'bald' ? skin : hair" />
      <path v-if="cut === 'bald'" d="M-24 4 C-22 18 -12 28 0 30 C12 28 22 18 24 4 C18 12 10 16 0 16 C-10 16 -18 12 -24 4 Z" :fill="hair" />
      <path v-else d="M-22 -14 C-12 -24 12 -24 22 -14" fill="none" :stroke="shade(hair, 0.75)" stroke-width="3" opacity="0.6" />
      <template v-if="cut === 'cap'">
        <path d="M-25 -8 C-25 -32 -12 -40 0 -40 C14 -40 25 -32 25 -8 Z" :fill="hat" />
        <path d="M-10 -9 H10" stroke="#f4f1ea" stroke-width="3" />
      </template>
    </template>
    <template v-else>
    <circle v-if="cut === 'bun'" cx="0" cy="-42" r="12" :fill="hair" />
    <path v-if="cut === 'long'" d="M-31 -6 C-35 -34 -13 -47 2 -46 C22 -46 35 -33 31 -6 L33 46 Q24 54 14 46 L-14 46 Q-24 54 -33 46 Z" :fill="hair" />
    <path d="M-64 140 L-59 80 C-57 62 -44 53 -24 48 L-11 44 H11 L24 48 C44 53 57 62 59 80 L64 140 Z" :fill="shirt" />
    <path d="M-59 80 C-57 62 -44 53 -24 48 L-30 140 H-64 Z" :fill="shirtShade" />
    <template v-if="apron">
      <path d="M-29 66 H29 L40 140 H-40 Z" :fill="apron" />
      <path d="M-26 67 L-16 47 M26 67 L16 47" :stroke="apron" stroke-width="7" />
    </template>
    <path d="M-11 26 V46 Q0 58 11 46 V26 Z" :fill="skinShade" />
    <path v-if="shirtFront" d="M-13 45 L0 78 L13 45 Z" :fill="shirtFront" />
    <path v-if="cut !== 'hood'" d="M-11 42 L-22 49 L-10 65 L0 54 Z M11 42 L22 49 L10 65 L0 54 Z" :fill="collar" />
    <path v-if="bow" d="M0 52 L-13 44 V60 Z M0 52 L13 44 V60 Z" fill="#c62828" />
    <path v-if="tie" d="M-5 49 H5 L3 57 L8 100 L0 110 L-8 100 L-3 57 Z" :fill="tie" />

    <ellipse cx="-25" cy="0" rx="4" ry="8" :fill="skinShade" />
    <ellipse cx="25" cy="0" rx="4" ry="8" :fill="skinShade" />
    <path d="M-24 -6 C-24 -26 -12 -32 0 -32 C12 -32 24 -26 24 -6 C24 12 18 26 8 32 C3 35 -3 35 -8 32 C-18 26 -24 12 -24 -6 Z" :fill="skin" />
    <path d="M12 -28 C20 -22 24 -16 24 -6 C24 12 18 26 8 32 C14 18 16 -12 12 -28 Z" :fill="skinShade" opacity="0.55" />
    <path v-if="cut === 'bald'" d="M-25 2 C-27 -10 -24 -16 -19 -18 L-18 -2 Z M25 2 C27 -10 24 -16 19 -18 L18 -2 Z" :fill="hair" />
    <path v-else-if="cut === 'long' || cut === 'bun'" d="M-25 -4 C-28 -26 -12 -38 4 -38 C20 -38 28 -24 26 -4 C22 -14 14 -20 4 -22 C-6 -18 -16 -16 -25 -4 Z" :fill="hair" />
    <path v-else-if="cut !== 'hood'" d="M-26 -2 C-31 -28 -15 -43 4 -42 C23 -42 33 -26 27 -1 C26 -11 22 -19 14 -23 C3 -17 -12 -17 -20 -20 C-24 -16 -25 -9 -26 -2 Z" :fill="hair" />
    <path v-if="beard" d="M-23 4 C-21 26 -10 37 0 37 C10 37 21 26 23 4 C17 15 10 21 0 21 C-10 21 -17 15 -23 4 Z" :fill="hair" />
    <path d="M-17 -8 Q-10 -12 -4 -9 M4 -9 Q10 -12 17 -8" fill="none" :stroke="cut === 'bald' ? skinShade : hair" stroke-width="2.4" stroke-linecap="round" />
    <ellipse cx="-10" cy="-2" rx="3.8" ry="2.5" fill="#fff" />
    <ellipse cx="10" cy="-2" rx="3.8" ry="2.5" fill="#fff" />
    <circle cx="-9.4" cy="-2" r="1.9" fill="#3b2a1e" />
    <circle cx="10.6" cy="-2" r="1.9" fill="#3b2a1e" />
    <g v-if="glasses" fill="rgba(255,255,255,0.15)" stroke="#2b2f37" stroke-width="2">
      <circle cx="-10" cy="-2" r="7" />
      <circle cx="10" cy="-2" r="7" />
      <path d="M-3 -2 H3" />
    </g>
    <path d="M0 -1 L-3 11 Q0 14 3 12" fill="none" :stroke="skinShade" stroke-width="2" stroke-linecap="round" />
    <path v-if="laugh" d="M-10 18 Q0 32 10 18 Z" fill="#7a2e2a" />
    <path v-else d="M-11 19 Q0 28 11 19" fill="none" stroke="#a8564a" stroke-width="2.4" stroke-linecap="round" />

    <path v-if="cut === 'hood'" d="M-36 34 C-42 -10 -26 -48 0 -48 C26 -48 42 -10 36 34 C28 24 24 4 24 -8 C22 -28 12 -36 0 -36 C-12 -36 -22 -28 -24 -8 C-24 4 -28 24 -36 34 Z" :fill="hat" />
    <template v-if="cut === 'cap'">
      <path d="M-25 -10 C-25 -32 -12 -40 0 -40 C14 -40 25 -32 25 -10 Z" :fill="hat" />
      <path d="M-25 -12 H40 Q42 -5 35 -5 H-25 Z" :fill="shade(hat, 0.78)" />
    </template>
    <template v-if="cut === 'hat'">
      <ellipse cx="0" cy="-16" rx="38" ry="7" :fill="hat" />
      <path d="M-20 -16 L-17 -42 Q0 -48 17 -42 L20 -16 Z" :fill="hat" />
      <rect x="-19.5" y="-25" width="39" height="6" fill="#15171c" />
    </template>

    <template v-if="pose === 'cards'">
      <g v-for="angle in [-22, 0, 22]" :key="angle" :transform="`rotate(${angle} 0 104)`">
        <rect x="-9" y="74" width="18" height="26" rx="2" fill="#fff" stroke="#9aa1ad" stroke-width="1.5" />
        <circle cx="0" cy="83" r="3" :fill="angle ? '#c62828' : '#15171c'" />
      </g>
    </template>
    <template v-if="pose === 'paper'">
      <rect x="-48" y="44" width="96" height="74" rx="2" fill="#f1efe6" stroke="#b9b4a6" stroke-width="2" />
      <rect x="-40" y="52" width="80" height="12" fill="#2b2f37" />
      <path d="M-40 72 H-4 M-40 80 H-4 M-40 88 H-4 M-40 96 H-4 M4 72 H40 M4 80 H40 M4 88 H40" stroke="#9aa1ad" stroke-width="3" />
    </template>

    <g v-for="(arm, index) in arms" :key="index">
      <path :d="`M${arm.shoulder} 62 Q${(arm.shoulder + arm.ex) / 2 + (index ? 6 : -6)} ${(62 + arm.ey) / 2} ${arm.ex} ${arm.ey}`" fill="none" :stroke="shirt" stroke-width="21" stroke-linecap="round" />
      <path :d="`M${arm.ex} ${arm.ey} L${arm.hx} ${arm.hy}`" fill="none" :stroke="skin" stroke-width="13" stroke-linecap="round" />
      <ellipse :cx="arm.hx" :cy="arm.hy" rx="8" ry="7" :fill="skin" />
    </g>

    <template v-if="uniform">
      <path d="M-52 58 L-28 51 M28 51 L52 58" stroke="#0d1322" stroke-width="7" stroke-linecap="round" />
      <path d="M14 70 H30 V82 Q22 90 14 82 Z" fill="#c9a14a" />
      <rect x="-32" y="74" width="20" height="6" rx="1" fill="#e8eaed" />
    </template>

    <template v-if="pose === 'beer'">
      <rect x="38" y="12" width="26" height="34" rx="3" fill="#f2a93b" stroke="#b9772a" stroke-width="2" />
      <rect x="36" y="6" width="30" height="10" rx="5" fill="#fff8e6" />
      <path d="M64 20 Q76 29 64 38" fill="none" stroke="#b9772a" stroke-width="4" />
    </template>
    <path v-if="pose === 'coffee'" d="M24 82 H48 L45 99 H27 Z" fill="#f4f1ea" stroke="#9aa1ad" stroke-width="1.5" />
    <template v-if="pose === 'cocktail'">
      <path d="M22 62 H54 L38 80 Z" fill="#7fd1ae" stroke="#e8f4f8" stroke-width="2" />
      <path d="M38 80 V96" stroke="#e8f4f8" stroke-width="2.5" />
    </template>
    <template v-if="pose === 'talk'">
      <path d="M60 40 L58 22 M60 40 L66 23 M61 41 L72 28 M62 43 L76 35 M56 44 L50 33" fill="none" :stroke="skin" stroke-width="4.5" stroke-linecap="round" />
    </template>
    <template v-if="pose === 'smoke'">
      <path d="M26 22 L44 12" stroke="#f4f1ea" stroke-width="3.5" stroke-linecap="round" />
      <circle cx="45" cy="11" r="2.4" fill="#ff7043" />
      <path class="bgr-bar-smoke" d="M48 4 C42 -6 54 -12 48 -22 C42 -30 52 -36 48 -46" fill="none" stroke="#cfd8dc" stroke-width="3" stroke-linecap="round" opacity="0.6" />
    </template>
    <template v-if="pose === 'bag'">
      <path d="M60 140 Q70 124 80 140" fill="none" stroke="#2b2f37" stroke-width="3" />
      <rect x="54" y="138" width="34" height="40" rx="3" :fill="bagColor ?? '#e63946'" />
    </template>
    <template v-if="pose === 'polish'">
      <path d="M-28 48 H-2 L-6 86 H-24 Z" fill="#dff3fb" opacity="0.85" stroke="#fff" stroke-width="2" />
      <path d="M2 76 Q16 70 28 78 L24 104 Q12 98 0 104 Z" fill="#f4f1ea" />
    </template>
    </template>
  </g>
</template>
