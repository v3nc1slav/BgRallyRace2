<script setup lang="ts">
import { computed } from 'vue';
import { useClock } from '../daylight';
import { t } from '../i18n';
import BarPerson from './BarPerson.vue';

defineProps<{ name: string; risks: { official: number; black: number } | null }>();
const emit = defineEmits<{ report: []; bribe: [] }>();

const { night, hands, time } = useClock();

const W = 1000;
const H = 560;
const FLAG = ['#ffffff', '#00966e', '#d62612'];
const LIGHTS = [130, 420, 650];
const BINDERS = ['#1f5f8b', '#2a6fdb', '#c9a14a', '#ececec', '#2e7d32', '#1f5f8b', '#8e1b2a', '#ececec'];
const SHELVES = [200, 250, 300];
const NOTES = [
  { x: 102, y: 192, w: 56, h: 60, fill: '#fdfcf7', r: -3, pin: '#e63946' },
  { x: 168, y: 196, w: 50, h: 46, fill: '#fff4c9', r: 2, pin: '#2a6fdb' },
  { x: 226, y: 190, w: 50, h: 62, fill: '#dbe9ff', r: -2, pin: '#f4c430' },
  { x: 110, y: 262, w: 64, h: 56, fill: '#fdfcf7', r: 2, pin: '#2e7d32' },
  { x: 196, y: 258, w: 70, h: 58, fill: '#fdfcf7', r: -1, pin: '#8e24aa' },
];
const STARS = [[346, 92], [372, 78], [404, 104], [352, 132], [414, 140]];
const WANTED = [0, 1, 2, 3, 4, 5].map((index) => ({ x: 620 + (index % 3) * 27, y: 118 + Math.floor(index / 3) * 34 }));
const SLATS = Array.from({ length: 13 }, (_, index) => 36 + index * 8);

const chief = computed(() => t('police.scene.chief').split(' '));
const flag = (index: number) => {
  const x0 = 40 + (index * 44) / 3;
  const x1 = x0 + 44 / 3;
  const bottom = (x: number) => (300 - ((x - 40) * 16) / 44).toFixed(1);
  return `${x0},46 ${x1},46 ${x1},${bottom(x1)} ${x0},${bottom(x0)}`;
};
</script>

<template>
  <div class="bgr-scene bgr-police-scene">
    <svg :viewBox="`0 0 ${W} ${H}`" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgr-police-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#737980" />
          <stop offset="1" stop-color="#959ba1" />
        </linearGradient>
        <linearGradient id="bgr-police-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#666a6f" />
          <stop offset="1" stop-color="#43464a" />
        </linearGradient>
        <linearGradient id="bgr-police-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#6fb1e6" />
          <stop offset="1" stop-color="#d4ecfb" />
        </linearGradient>
        <linearGradient id="bgr-police-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#070d1a" />
          <stop offset="1" stop-color="#1f3050" />
        </linearGradient>
        <pattern id="bgr-police-cork" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#b98a5a" />
          <circle cx="2" cy="3" r="1" fill="#8a5f36" opacity="0.6" />
          <circle cx="6" cy="6" r="0.9" fill="#e2c194" opacity="0.6" />
        </pattern>
      </defs>

      <rect :width="W" height="342" fill="url(#bgr-police-wall)" />
      <rect :width="W" height="30" fill="#2e3237" />
      <path v-for="x in [100, 250, 400, 550, 700, 850]" :key="x" :d="`M${x} 0 V30`" stroke="#3d4248" stroke-width="2" />
      <rect y="342" :width="W" :height="H - 342" fill="url(#bgr-police-floor)" />
      <rect y="338" :width="W" height="6" fill="#3b3f45" />
      <g v-for="x in LIGHTS" :key="x">
        <path :d="`M${x + 12} 30 V50 M${x + 138} 30 V50`" stroke="#2b2f37" stroke-width="2" />
        <ellipse :cx="x + 75" cy="80" rx="120" ry="30" fill="#fffbe6" opacity="0.1" />
        <ellipse :cx="x + 75" cy="420" rx="70" ry="10" fill="#fffbe6" opacity="0.06" />
        <rect :x="x" y="50" width="150" height="9" rx="2" fill="#2b2f37" />
        <rect :x="x + 6" y="57" width="138" height="4" rx="2" fill="#fffbe6" />
      </g>

      <rect class="bgr-police-board" x="86" y="176" width="204" height="158" rx="3" fill="#6f4a2a" />
      <rect x="93" y="183" width="190" height="144" fill="url(#bgr-police-cork)" />
      <g v-for="note in NOTES" :key="note.x" :transform="`rotate(${note.r} ${note.x + note.w / 2} ${note.y + note.h / 2})`">
        <rect :x="note.x" :y="note.y" :width="note.w" :height="note.h" :fill="note.fill" />
        <path v-for="dy in [16, 26, 36]" :key="dy" :d="`M${note.x + 6} ${note.y + dy} H${note.x + note.w - 6}`" stroke="#b9bec6" stroke-width="2" />
        <circle :cx="note.x + note.w / 2" :cy="note.y + 5" r="3.5" :fill="note.pin" />
      </g>

      <g class="bgr-police-window" :data-time="night ? 'night' : 'day'">
        <rect x="330" y="58" width="100" height="178" fill="#2b2f37" />
        <rect x="335" y="63" width="90" height="168" :fill="night ? 'url(#bgr-police-night)' : 'url(#bgr-police-day)'" />
        <template v-if="night">
          <circle v-for="[x, y] in STARS" :key="`${x}-${y}`" :cx="x" :cy="y" r="1.6" fill="#fff" opacity="0.85" />
          <circle cx="398" cy="118" r="11" fill="#f4f1d0" />
          <circle cx="404" cy="113" r="10" fill="#0f1a2e" />
        </template>
        <template v-else>
          <circle cx="400" cy="104" r="12" fill="#fff3b0" />
          <ellipse cx="362" cy="138" rx="18" ry="7" fill="#fff" opacity="0.9" />
          <ellipse cx="374" cy="133" rx="12" ry="7" fill="#fff" opacity="0.9" />
        </template>
        <path d="M380 63 V231" stroke="#2b2f37" stroke-width="3" />
        <rect v-for="index in 5" :key="index" x="335" :y="58 + index * 5" width="90" height="4" fill="#d9dde2" />
      </g>

      <g class="bgr-police-clock">
        <title>{{ time }}</title>
        <circle cx="520" cy="92" r="22" fill="#f4f1ea" stroke="#2b2f37" stroke-width="4" />
        <path v-for="index in 12" :key="index" d="M520 73 V77" stroke="#2b2f37" :stroke-width="index % 3 ? 1.5 : 3" :transform="`rotate(${index * 30} 520 92)`" />
        <path class="bgr-police-hour" d="M520 92 V80" stroke="#15171c" stroke-width="3" stroke-linecap="round" :transform="`rotate(${hands.hour} 520 92)`" />
        <path class="bgr-police-minute" d="M520 92 V75" stroke="#15171c" stroke-width="2" stroke-linecap="round" :transform="`rotate(${hands.minute} 520 92)`" />
        <circle cx="520" cy="92" r="2.2" fill="#c62828" />
      </g>

      <rect x="436" y="150" width="176" height="180" fill="#3a2f28" />
      <g v-for="(y, row) in SHELVES" :key="y">
        <rect x="436" :y="y" width="176" height="5" fill="#5a4636" />
        <rect v-for="index in 16" :key="index" :x="432 + index * 10" :y="y - 40 + ((index + row) % 3) * 2" width="8" :height="40 - ((index + row) % 3) * 2" :fill="BINDERS[(index + row * 3) % BINDERS.length]" />
      </g>

      <rect x="612" y="110" width="88" height="78" fill="#6f4a2a" />
      <rect x="616" y="114" width="80" height="70" fill="url(#bgr-police-cork)" />
      <g v-for="(poster, index) in WANTED" :key="index">
        <rect :x="poster.x" :y="poster.y" width="22" height="30" fill="#fdfcf7" />
        <circle :cx="poster.x + 11" :cy="poster.y + 11" r="5" fill="#9aa1ad" />
        <path :d="`M${poster.x + 4} ${poster.y + 24} H${poster.x + 18}`" stroke="#9aa1ad" stroke-width="2" />
      </g>

      <path d="M722 76 H778 V118 Q778 142 750 152 Q722 142 722 118 Z" fill="#1d2b55" stroke="#c9a14a" stroke-width="3" />
      <text class="bgr-police-badge" x="750" y="96">{{ $t('police.scene.badge') }}</text>
      <path d="M750 104 L755 116 L768 116 L758 124 L762 137 L750 129 L738 137 L742 124 L732 116 L745 116 Z" fill="#e0b74a" />

      <BarPerson back :x="565" :y="262" :scale="0.42" shirt="#1f2a44" hair="#2b1d14" />
      <rect x="551" y="318" width="11" height="12" fill="#151c2c" />
      <rect x="568" y="318" width="11" height="12" fill="#151c2c" />
      <text class="bgr-police-back" x="565" y="296">{{ $t('police.scene.badge') }}</text>

      <rect x="446" y="300" width="48" height="40" rx="10" fill="#1b1d21" />
      <BarPerson :x="470" :y="296" :scale="0.34" uniform shirt="#1f2a44" hair="#2b1d14" pose="clasp" />
      <rect x="630" y="300" width="50" height="40" rx="10" fill="#1b1d21" />
      <BarPerson :x="655" :y="296" :scale="0.34" uniform shirt="#1f2a44" hair="#151515" skin="#c68e63" pose="clasp" />
      <path d="M430 326 H812 L816 334 H426 Z" fill="#7a5a3e" />
      <rect x="426" y="334" width="390" height="16" fill="#5a4030" />
      <g v-for="x in [500, 598]" :key="x">
        <rect :x="x" y="290" width="40" height="30" rx="2" fill="#23262b" />
        <rect :x="x + 3" y="293" width="34" height="23" fill="#4fc3f7" opacity="0.75" />
        <rect :x="x + 17" y="320" width="6" height="6" fill="#23262b" />
      </g>
      <path d="M700 326 L706 306 M698 308 L716 302 L720 312 Z" stroke="#2b2f37" stroke-width="2" fill="#2e7d32" />
      <ellipse cx="712" cy="318" rx="16" ry="5" fill="#fffbe6" opacity="0.35" />
      <rect x="740" y="306" width="34" height="20" fill="#f4f1ea" />
      <rect x="744" y="300" width="30" height="8" fill="#2a6fdb" />

      <g class="bgr-gs-hot" data-spot="inspector" role="button" tabindex="0" :aria-label="$t('police.scene.chief')" @click="emit('bribe')" @keydown.enter.prevent="emit('bribe')" @keydown.space.prevent="emit('bribe')">
        <rect x="822" y="30" width="178" height="440" fill="#6a645c" />
        <rect x="838" y="70" width="54" height="120" :fill="night ? '#2a3550' : '#e9dcc0'" />
        <rect v-for="y in SLATS.slice(0, 12)" :key="y" x="838" :y="y + 34" width="54" height="5" :fill="night ? '#4a5570' : '#b8ab90'" />
        <rect x="960" y="110" width="40" height="190" fill="#3a2f28" />
        <rect v-for="(color, index) in BINDERS.slice(0, 4)" :key="index" :x="964 + index * 9" y="150" width="7" height="36" :fill="color" />
        <rect v-for="(color, index) in BINDERS.slice(4)" :key="`b${index}`" :x="964 + index * 9" y="214" width="7" height="36" :fill="color" />
        <rect x="916" y="222" width="72" height="88" rx="14" fill="#3e2723" />
        <BarPerson :x="952" :y="252" :scale="0.46" shirt="#eef1f4" tie="#1d2b55" hair="#7b7b7b" skin="#e2b48f" pose="clasp" />
        <ellipse cx="884" cy="300" rx="42" ry="8" fill="#ffe9a8" opacity="0.4" />
        <path d="M862 296 H1000 V304 H858 Z" fill="#7a4a2e" />
        <rect x="858" y="304" width="142" height="26" fill="#5a3524" />
        <ellipse cx="880" cy="296" rx="10" ry="3" fill="#2b2f37" />
        <path d="M880 296 L886 276" stroke="#2b2f37" stroke-width="3" />
        <path d="M872 282 L898 270 L906 284 Z" fill="#2e7d32" />
        <rect x="926" y="288" width="26" height="8" fill="#f4f1ea" />

        <rect x="825" y="33" width="172" height="297" fill="#c8dbe8" opacity="0.16" />
        <path d="M840 33 L880 33 L825 140 V60 Z M930 33 L950 33 L908 120 L908 80 Z" fill="#fff" opacity="0.07" />
        <rect v-for="y in SLATS" :key="`s${y}`" x="825" :y="y" width="77" height="5" fill="#c8ccd1" opacity="0.85" />
        <rect x="914" y="56" width="76" height="48" rx="2" fill="#15171c" stroke="#c9a14a" stroke-width="1.5" />
        <text v-for="(word, index) in chief" :key="word" class="bgr-police-chief" x="952" :y="76 + index * 16 - (chief.length - 2) * 8">{{ word }}</text>
        <rect x="825" y="334" width="172" height="133" fill="#5a3524" />
        <rect x="834" y="344" width="62" height="112" fill="none" stroke="#3e2418" stroke-width="3" />
        <rect x="916" y="344" width="72" height="112" fill="none" stroke="#3e2418" stroke-width="3" />
        <rect x="912" y="376" width="6" height="32" rx="2" fill="#b7bec7" />
        <rect x="822" y="326" width="178" height="8" fill="#15171c" />
        <rect x="902" y="30" width="6" height="440" fill="#15171c" />
        <rect x="822" y="30" width="178" height="440" fill="none" stroke="#15171c" stroke-width="6" />
      </g>

      <g class="bgr-gs-hot" data-spot="clerk" role="button" tabindex="0" :aria-label="$t('police.scene.clerk')" @click="emit('report')" @keydown.enter.prevent="emit('report')" @keydown.space.prevent="emit('report')">
        <rect x="316" y="334" width="88" height="70" rx="12" fill="#1b1d21" />
        <BarPerson :x="360" :y="318" :scale="0.62" cut="bun" uniform shirt="#1f2a44" hair="#1b1410" skin="#e0b08a" />
      </g>

      <path d="M78 372 H660 L668 388 H70 Z" fill="#8a5634" />
      <rect x="70" y="388" width="598" height="172" fill="#5a3524" />
      <path v-for="x in [120, 560, 620]" :key="x" :d="`M${x} 396 V510`" stroke="#4a2a1b" stroke-width="2" opacity="0.6" />
      <rect x="70" y="516" width="598" height="8" fill="#a7adb5" />
      <rect x="170" y="410" width="360" height="80" rx="4" fill="#1d2b55" stroke="#c0c6cf" stroke-width="3" />
      <circle cx="208" cy="450" r="22" fill="none" stroke="#c9a14a" stroke-width="2.5" />
      <path d="M208 434 L212 445 L224 445 L214 452 L218 464 L208 457 L198 464 L202 452 L192 445 L204 445 Z" fill="#e0b74a" />
      <text class="bgr-police-desk" x="380" y="446">{{ $t('police.scene.desk') }}</text>
      <text class="bgr-police-desk small" x="380" y="474">{{ $t('police.scene.deskSub') }}</text>

      <rect x="410" y="306" width="66" height="58" rx="3" fill="#23262b" />
      <rect x="437" y="364" width="12" height="8" fill="#23262b" />
      <ellipse cx="443" cy="373" rx="20" ry="3" fill="#15171c" />
      <rect x="112" y="350" width="18" height="22" rx="2" fill="#2b2f37" />
      <path d="M116 350 L114 336 M121 350 V332 M126 350 L129 337" stroke-width="2.5" stroke="#2a6fdb" />
      <rect x="487" y="369" width="36" height="5" fill="#2b2f37" />
      <path d="M491 370 Q491 352 505 352 Q519 352 519 370 Z" fill="#c0c6cf" />
      <circle cx="505" cy="349" r="3" fill="#9aa1ad" />
      <path d="M530 370 L588 367 L596 376 L536 380 Z" fill="#f4f1ea" />
      <rect x="610" y="350" width="22" height="22" rx="2" fill="#e8eaed" />
      <ellipse v-for="(leaf, index) in [[-12, -4, -30], [0, -10, 0], [12, -4, 30], [-6, -2, -55], [8, -2, 55]]" :key="index" :cx="621 + leaf[0]" :cy="336 + leaf[1]" rx="6" ry="16" :fill="index % 2 ? '#43a047' : '#2e7d32'" :transform="`rotate(${leaf[2]} ${621 + leaf[0]} ${336 + leaf[1]})`" />

      <rect x="34" y="40" width="6" height="500" fill="#c9a14a" />
      <circle cx="37" cy="36" r="6" fill="#e0b74a" />
      <rect x="29" y="528" width="16" height="12" rx="2" fill="#2b2f37" />
      <ellipse cx="37" cy="541" rx="24" ry="6" fill="#2b2f37" />
      <polygon v-for="(color, index) in FLAG" :key="color" class="bgr-police-flag" :points="flag(index)" :fill="color" />
      <rect v-for="x in [50, 70]" :key="x" :x="x" y="46" width="4" height="250" fill="#000" opacity="0.12" />
    </svg>

    <button class="bgr-scene-talk" data-tail="down" data-anchor="bottom" style="--x: 30.5%; --y: 28.2cqw; --w: 23%; --tail: 22%" @click="emit('report')">
      {{ $t('police.welcome', { name }) }}
    </button>
    <button class="bgr-scene-talk" data-tail="right" style="--x: 68%; --y: 23cqw; --w: 23%; --tail: 18px" @click="emit('bribe')">{{ $t('police.inspector') }}</button>
    <div v-if="risks" class="bgr-police-notice" style="--x: 10%; --y: 19cqw; --w: 18%">
      <p>{{ $t('police.intro') }}</p>
      <p>{{ $t('police.riskOfficial') }}: <b>{{ risks.official }}%</b></p>
      <p>{{ $t('police.riskBlack') }}: <b>{{ risks.black }}%</b></p>
    </div>
  </div>
</template>
