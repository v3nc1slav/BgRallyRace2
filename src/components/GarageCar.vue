<script setup lang="ts">
import { BODY, ROLL } from './garageGeometry';

defineProps<{
  color: string;
  open?: boolean;
  lifted?: boolean;
  number?: string | number;
  livery?: Partial<Record<'doors' | 'hood' | 'roof' | 'suits', string>>;
}>();

const WHEELS = [70, 270];
const FAR = [82, 282];
const SPOKES = [0, 72, 144, 216, 288];
</script>

<template>
  <g class="bgr-gs-car">
    <g v-if="lifted">
      <g v-for="x in FAR" :key="`far-${x}`" :transform="`translate(${x} 128)`">
        <circle r="31" fill="#0f1013" />
        <circle r="17" fill="#3d424c" />
        <circle r="14" fill="none" stroke="#8d939c" stroke-width="3" />
        <circle r="4" fill="#8d939c" />
      </g>
    </g>
    <g :transform="lifted ? `rotate(${ROLL.angle} ${ROLL.x} ${ROLL.y})` : undefined">
      <g v-if="lifted">
        <path d="M14 100 L334 96 L328 128 Q300 136 240 134 L100 136 Q40 136 20 130 Z" fill="#1e2127" stroke="#0d0f12" stroke-width="2" />
        <path d="M24 122 L324 116" stroke="#3a3f47" stroke-width="6" />
        <path d="M112 128 L332 120" stroke="#9aa1ad" stroke-width="5" stroke-linecap="round" />
        <rect x="324" y="114" width="16" height="9" rx="4" fill="#6b7280" />
        <rect x="118" y="106" width="40" height="16" rx="4" fill="#4b525c" stroke="#0d0f12" stroke-width="1.5" />
        <rect x="226" y="106" width="54" height="14" rx="5" fill="#3d424c" stroke="#0d0f12" stroke-width="1.5" />
        <path d="M40 112 L104 118 M240 114 L300 112" stroke="#6b7280" stroke-width="4" stroke-linecap="round" />
        <path d="M70 116 L270 114" stroke="#5b6270" stroke-width="3" />
      </g>
      <g v-if="open">
        <path d="M300 46 L316 -10" stroke="#9aa1ad" stroke-width="2" />
        <polygon points="266,12 334,-40 346,-30 278,22" :fill="color" stroke="#0d0f12" stroke-width="2" />
        <polygon points="278,8 326,-29 333,-23 285,13" fill="#7fa6bd" opacity="0.85" />
        <polygon points="332,-42 356,-48 358,-40 340,-32" fill="#1d2026" />
      </g>
      <path :d="BODY" :fill="color" stroke="#0d0f12" stroke-width="2" />
      <path d="M60 86 L330 70 L334 79 L62 95 Z" fill="#ffffff" opacity="0.85" />
      <path d="M62 95 L334 79 L336 84 L63 100 Z" fill="#15171c" opacity="0.35" />
      <path d="M136 52 L170 21 L204 21 L204 52 Z" fill="#9fc3d8" stroke="#0d0f12" stroke-width="1.5" />
      <path d="M212 52 L212 21 L258 21 Q264 21 268 26 L290 47 L290 52 Z" fill="#9fc3d8" stroke="#0d0f12" stroke-width="1.5" />
      <path v-if="open" d="M278 22 L312 48 L292 50 L276 34 Z" fill="#1d2026" />
      <circle v-if="open" cx="296" cy="44" r="7" fill="#17181c" stroke="#9aa1ad" stroke-width="2" />
      <path d="M130 52 L168 17" stroke="#0d0f12" stroke-width="2" />
      <path d="M134 54 L134 104 M210 54 L210 104" stroke="#0d0f12" stroke-width="1.5" opacity="0.55" />
      <rect x="180" y="60" width="12" height="3" rx="1.5" fill="#0d0f12" opacity="0.6" />
      <rect x="244" y="60" width="12" height="3" rx="1.5" fill="#0d0f12" opacity="0.6" />
      <path d="M140 49 L128 47 L128 55 L140 56 Z" :fill="color" stroke="#0d0f12" stroke-width="1.5" />
      <path d="M6 80 Q4 74 14 72 L30 70 L28 78 Z" fill="#ffe08a" stroke="#0d0f12" stroke-width="1" />
      <ellipse cx="44" cy="66" rx="7" ry="4" fill="#ffe08a" stroke="#0d0f12" stroke-width="1" />
      <rect x="333" y="63" width="6" height="12" rx="1" fill="#d62828" />
      <rect x="106" y="98" width="128" height="8" fill="#1d2026" />
      <path d="M2 90 L8 104 L34 104 L36 96 Z M306 104 L330 106 Q338 106 340 96 L340 92 L306 96 Z" fill="#1d2026" />
      <rect x="186" y="5" width="68" height="8" rx="2" fill="#1d2026" />
      <text v-if="livery?.roof" x="220" y="11.5" class="bgr-gs-sponsor" font-size="6.5">{{ livery.roof }}</text>
      <text v-if="livery?.hood" x="82" y="64" class="bgr-gs-sponsor" font-size="7" transform="rotate(-8 82 64)">{{ livery.hood }}</text>
      <circle v-if="number !== undefined" cx="160" cy="72" r="10" fill="#ffffff" stroke="#0d0f12" stroke-width="1" />
      <text v-if="number !== undefined" x="160" y="76.5" class="bgr-gs-number">{{ number }}</text>
      <text v-if="livery?.doors" x="200" y="96" class="bgr-gs-sponsor" font-size="10">{{ livery.doors }}</text>
      <g v-for="x in WHEELS" :key="x" :transform="`translate(${x} 108)`">
        <circle r="32" fill="#16171b" />
        <circle r="30" fill="none" stroke="#2c2f36" stroke-width="3" stroke-dasharray="4 3" />
        <circle r="19" fill="#5b6270" />
        <path d="M-9 -16 A18 18 0 0 1 11 -15 L7 -10 A12 12 0 0 0 -6 -11 Z" fill="#d62828" />
        <circle r="15" fill="none" stroke="#c5cbd3" stroke-width="4" />
        <line v-for="angle in SPOKES" :key="angle" x1="0" y1="0" x2="0" y2="-14" stroke="#c5cbd3" stroke-width="3" :transform="`rotate(${angle})`" />
        <circle r="4" fill="#e9ecf1" />
      </g>
    </g>
  </g>
</template>
