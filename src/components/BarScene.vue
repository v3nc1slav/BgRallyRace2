<script setup lang="ts">
import { computed } from 'vue';
import type { BarRole } from '../game';
import BarPerson, { type PersonLook } from './BarPerson.vue';

const props = defineProps<{ roles: BarRole[]; unread?: number }>();
const emit = defineEmits<{ rumors: []; chat: []; role: [role: BarRole] }>();

const W = 1000;
const H = 700;
const SEAT = 40;
const BASE = 0.45;
const HEAD = 138;
const TABLES = [
  { role: 'pilot', x: 125, y: 470, s: 0.46 },
  { role: 'navigator', x: 375, y: 470, s: 0.46 },
  { role: 'mechanic', x: 625, y: 470, s: 0.46 },
  { role: 'engineer', x: 875, y: 470, s: 0.46 },
  { role: 'psychologist', x: 125, y: 612, s: 0.5 },
  { role: 'chemist', x: 375, y: 612, s: 0.5 },
  { role: 'informant', x: 625, y: 612, s: 0.5 },
  { role: 'saboteur', x: 875, y: 612, s: 0.5 },
];
const BOOTH_SCALE = 0.42;
const BARTENDER_SCALE = 0.42;
const GUEST_SCALE = 0.44;
const STOOLS = [85, 170, 300, 385];
const CREW: Record<string, PersonLook[]> = {
  pilot: [
    { pose: 'beer', shirt: '#c62828', hair: '#2b1d14' },
    { pose: 'beer', mirror: true, shirt: '#1e88e5', cut: 'cap', hat: '#15171c', skin: '#c68e63', laugh: true },
  ],
  navigator: [
    { pose: 'paper', shirt: '#546e7a', hair: '#6d4c41', skin: '#f1cfb0' },
    { pose: 'coffee', mirror: true, shirt: '#00897b', cut: 'long', hair: '#3e2723' },
  ],
  mechanic: [
    { pose: 'cards', shirt: '#37474f', cut: 'cap', hat: '#f28c28', skin: '#c68e63' },
    { pose: 'cards', mirror: true, shirt: '#6d4c41', cut: 'bald', hair: '#4e342e', beard: true },
  ],
  engineer: [
    { pose: 'rest', shirt: '#5c6bc0', glasses: true, hair: '#212121' },
    { pose: 'talk', mirror: true, shirt: '#ef6c00', cut: 'long', hair: '#a1662f', skin: '#f1cfb0' },
  ],
  psychologist: [
    { pose: 'coffee', shirt: '#8e24aa', cut: 'long', hair: '#212121', glasses: true, skin: '#8d5a3b' },
    { pose: 'talk', mirror: true, shirt: '#43a047', hair: '#8d6e63' },
  ],
  chemist: [
    { pose: 'cocktail', shirt: '#eceff1', glasses: true, cut: 'bald', hair: '#9e9e9e' },
    { pose: 'rest', mirror: true, shirt: '#00838f', cut: 'long', hair: '#d84315' },
  ],
  informant: [
    { pose: 'paper', shirt: '#5d4037', cut: 'hat', hat: '#3e2723' },
    { pose: 'whisper', mirror: true, shirt: '#455a64', hair: '#263238', skin: '#c68e63' },
  ],
  saboteur: [
    { pose: 'smoke', shirt: '#212121', cut: 'hood', hat: '#2b2f37', skin: '#d9a67e' },
    { pose: 'rest', mirror: true, shirt: '#4e342e', cut: 'cap', hat: '#263238', beard: true, hair: '#1b1b1b' },
  ],
};
const BOOTH: PersonLook[] = [
  { pose: 'beer', shirt: '#2e7d32', hair: '#5d4037' },
  { pose: 'talk', shirt: '#f4511e', cut: 'long', hair: '#212121', skin: '#8d5a3b', laugh: true },
  { pose: 'coffee', mirror: true, shirt: '#3949ab', cut: 'bald', hair: '#757575', beard: true },
];
const BOTTLE_COLORS = ['#2e7d32', '#b5651d', '#cfe8f3', '#8e1b2a', '#1f5f8b', '#d4a017', '#5d4037'];
const BOTTLES = [110, 170].flatMap((base, row) =>
  Array.from({ length: 12 }, (_, index) => ({ x: 62 + index * 30 + row * 6, base, color: BOTTLE_COLORS[(index + row * 3) % BOTTLE_COLORS.length], tall: 28 + ((index * 7 + row * 5) % 4) * 4 })),
);
const GLASSES = Array.from({ length: 13 }, (_, index) => 60 + index * 28);
const PLANKS = [362, 398, 438, 482, 532, 586, 644];

const tables = computed(() =>
  TABLES.flatMap((table) => {
    const data = props.roles.find((role) => role.role === table.role);
    const k = table.s / BASE;
    return data ? [{ ...table, k, seat: SEAT * k, data, crew: CREW[table.role] ?? [] }] : [];
  }),
);

const place = (x: number, y: number) => ({ '--x': `${(x / W) * 100}%`, '--y': `${(y / H) * 100}%` });
</script>

<template>
  <div class="bgr-scene bgr-bar-scene">
    <svg :viewBox="`0 0 ${W} ${H}`" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bgr-bar-glow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect :width="W" height="330" fill="#4a2f2a" />
      <g stroke="#3d2622" stroke-width="3">
        <line v-for="x in [80, 200, 320, 440, 560, 680, 800, 920]" :key="x" :x1="x" y1="24" :x2="x" y2="250" />
      </g>
      <rect y="250" :width="W" height="80" fill="#3a241f" />
      <rect y="248" :width="W" height="6" fill="#6b4231" />
      <rect :width="W" height="24" fill="#1f1512" />
      <rect y="330" :width="W" :height="H - 330" fill="#6e4a33" />
      <g stroke="#5a3a28" stroke-width="2">
        <line v-for="y in PLANKS" :key="y" x1="0" :y1="y" :x2="W" :y2="y" />
      </g>
      <rect y="326" :width="W" height="6" fill="#2a1a15" />

      <g class="bgr-gs-hot" data-spot="rumors" role="button" tabindex="0" :aria-label="$t('bar.rumors')" @click="emit('rumors')" @keydown.enter.prevent="emit('rumors')" @keydown.space.prevent="emit('rumors')">
        <text class="bgr-bar-neon" x="235" y="44" filter="url(#bgr-bar-glow)">{{ $t('bar.title') }}</text>
        <rect x="40" y="54" width="390" height="196" rx="4" fill="#2a1a15" stroke="#6b4231" stroke-width="4" />
        <rect v-for="y in [110, 170, 230]" :key="y" x="44" :y="y" width="382" height="8" fill="#8b5a36" />
        <g v-for="bottle in BOTTLES" :key="`${bottle.x}-${bottle.base}`">
          <rect :x="bottle.x - 8" :y="bottle.base - bottle.tall" width="16" :height="bottle.tall" rx="3" :fill="bottle.color" opacity="0.92" />
          <rect :x="bottle.x - 3" :y="bottle.base - bottle.tall - 12" width="6" height="13" :fill="bottle.color" />
          <rect :x="bottle.x - 6" :y="bottle.base - bottle.tall / 2 - 5" width="12" height="9" fill="#f4f1ea" opacity="0.75" />
        </g>
        <path v-for="x in GLASSES" :key="x" :d="`M${x - 9} 230 L${x - 7} 206 H${x + 7} L${x + 9} 230 Z`" fill="#dff3fb" opacity="0.55" stroke="#fff" stroke-width="1" />

        <BarPerson :x="235" :y="288 - 140 * BARTENDER_SCALE" :scale="BARTENDER_SCALE" pose="polish" shirt="#f4f1ea" apron="#2b2f37" bow hair="#3a2a20" />

        <rect x="30" y="288" width="420" height="16" rx="3" fill="#a0663c" stroke="#4a2c1a" stroke-width="2" />
        <rect x="40" y="304" width="400" height="70" fill="#6b3f26" />
        <rect v-for="x in [52, 152, 252, 352]" :key="x" :x="x" y="314" width="76" height="48" rx="3" fill="none" stroke="#4a2c1a" stroke-width="3" />
        <rect x="40" y="366" width="400" height="5" fill="#c9a14a" />
        <rect x="374" y="258" width="12" height="30" rx="3" fill="#b7bec7" />
        <rect v-for="(color, index) in ['#c62828', '#f4d35e', '#2e7d32']" :key="color" :x="371 + index * 7" y="250" width="4" height="11" rx="1.5" :fill="color" />
        <path d="M90 288 L91 272 H101 L102 288 Z" fill="#f2a93b" opacity="0.9" />
        <rect x="89" y="268" width="14" height="6" rx="3" fill="#fff8e6" />

        <g v-for="(x, index) in STOOLS" :key="x" class="bgr-bar-stool">
          <ellipse :cx="x" cy="385" rx="17" ry="4.5" fill="#5b6270" />
          <rect :x="x - 2.5" y="350" width="5" height="35" fill="#b7bec7" />
          <ellipse :cx="x" cy="369" rx="12" ry="3" fill="none" stroke="#9aa1ad" stroke-width="2.5" />
          <g v-if="index === 1" class="bgr-bar-guest">
            <rect :x="x - 12" y="348" width="10" height="21" rx="2" fill="#2b2f37" />
            <rect :x="x + 2" y="348" width="10" height="21" rx="2" fill="#2b2f37" />
            <ellipse v-for="dx in [-7, 7]" :key="dx" :cx="x + dx" cy="370" rx="6.5" ry="3" fill="#15171c" />
            <BarPerson back :x="x" :y="347 - 140 * GUEST_SCALE" :scale="GUEST_SCALE" shirt="#6a1b9a" hair="#4e342e" />
          </g>
          <ellipse :cx="x" cy="347" rx="22" ry="6" fill="#b71c1c" stroke="#7f1212" stroke-width="2" />
        </g>
      </g>

      <rect x="514" y="196" width="62" height="52" rx="3" fill="#1f1512" stroke="#c9a14a" stroke-width="3" />
      <path d="M521 238 L536 217 L547 228 L557 213 L569 238 Z" fill="#e63946" opacity="0.85" />
      <circle cx="620" cy="222" r="28" fill="#1b1b1b" />
      <circle cx="620" cy="222" r="21" fill="#f4f1ea" />
      <circle cx="620" cy="222" r="13" fill="#c62828" />
      <circle cx="620" cy="222" r="5" fill="#2e7d32" />

      <g class="bgr-gs-hot" data-spot="chat" role="button" tabindex="0" :aria-label="$t('chat.title')" @click="emit('chat')" @keydown.enter.prevent="emit('chat')" @keydown.space.prevent="emit('chat')">
        <rect x="664" y="226" width="312" height="126" rx="20" fill="#7a1f2b" stroke="#4a1018" stroke-width="3" />
        <path v-for="x in [716, 768, 820, 872, 924]" :key="x" :d="`M${x} 236 V340`" stroke="#5e1621" stroke-width="3" />
        <BarPerson v-for="(person, index) in BOOTH" :key="index" v-bind="person" :x="755 + index * 65" :y="345 - HEAD * BOOTH_SCALE" :scale="BOOTH_SCALE" />
        <ellipse cx="820" cy="375" rx="80" ry="10" fill="#000" opacity="0.25" />
        <rect x="814" y="345" width="12" height="30" fill="#4a2c1a" />
        <ellipse cx="820" cy="350" rx="112" ry="21" fill="#5a341f" />
        <ellipse cx="820" cy="345" rx="112" ry="21" fill="#8d5a36" stroke="#4a2c1a" stroke-width="2" />
        <g v-for="x in [770, 868]" :key="x">
          <rect :x="x - 7" y="326" width="14" height="18" rx="2" fill="#f2a93b" />
          <rect :x="x - 8" y="322" width="16" height="6" rx="3" fill="#fff8e6" />
        </g>
        <ellipse cx="820" cy="338" rx="16" ry="6" fill="#c9a14a" />
        <g v-if="unread" class="bgr-bar-unread" transform="translate(930 284)">
          <title>{{ $t('bar.unread', { count: unread }) }}</title>
          <circle r="15" fill="#e63946" stroke="#fff" stroke-width="3" />
          <text y="7" class="bgr-bar-unread-mark">!</text>
        </g>
      </g>

      <g
        v-for="table in tables"
        :key="table.role"
        class="bgr-gs-hot bgr-bar-table"
        :data-role="table.role"
        :data-locked="table.data.unlocked ? undefined : ''"
        role="button"
        tabindex="0"
        :aria-label="table.data.label"
        @click="emit('role', table.data)"
        @keydown.enter.prevent="emit('role', table.data)"
        @keydown.space.prevent="emit('role', table.data)"
      >
        <template v-if="table.data.unlocked">
            <rect v-for="side in [-1, 1]" :key="side" :x="table.x + side * table.seat - 30 * table.k" :y="table.y - 50 * table.k" :width="60 * table.k" :height="50 * table.k" :rx="10 * table.k" fill="#4a2c1a" />
          <BarPerson v-for="(person, index) in table.crew" :key="index" v-bind="person" :x="table.x + (index ? table.seat : -table.seat)" :y="table.y - HEAD * table.s" :scale="table.s" />
        </template>
        <ellipse :cx="table.x" :cy="table.y + 30 * table.k" :rx="60 * table.k" :ry="10 * table.k" fill="#000" opacity="0.25" />
        <rect :x="table.x - 6 * table.k" :y="table.y" :width="12 * table.k" :height="32 * table.k" fill="#4a2c1a" />
        <ellipse :cx="table.x" :cy="table.y + 5 * table.k" :rx="82 * table.k" :ry="20 * table.k" fill="#5a341f" />
        <ellipse :cx="table.x" :cy="table.y" :rx="82 * table.k" :ry="20 * table.k" fill="#8d5a36" stroke="#4a2c1a" stroke-width="2" />

        <template v-if="!table.data.unlocked">
          <g v-for="side in [-1, 1]" :key="side" fill="none" stroke="#3a2216" stroke-width="3" stroke-linecap="round">
            <path :d="`M${table.x + side * 34 - 20} ${table.y - 12} H${table.x + side * 34 + 20}`" stroke="#6b3f26" stroke-width="7" />
            <path :d="`M${table.x + side * 34 - 17} ${table.y - 14} L${table.x + side * 34 - 19} ${table.y - 50} M${table.x + side * 34 + 17} ${table.y - 14} L${table.x + side * 34 + 19} ${table.y - 50} M${table.x + side * 34 - 18} ${table.y - 34} H${table.x + side * 34 + 18}`" />
          </g>
        </template>
        <template v-else-if="table.role === 'pilot'">
          <rect :x="table.x - 10" :y="table.y - 14" width="13" height="16" rx="2" fill="#f2a93b" />
          <ellipse :cx="table.x + 16" :cy="table.y + 2" rx="12" ry="4" fill="#d7dbe0" />
        </template>
        <template v-else-if="table.role === 'navigator'">
          <path :d="`M${table.x - 32} ${table.y - 6} L${table.x + 4} ${table.y - 12} L${table.x + 10} ${table.y + 4} L${table.x - 26} ${table.y + 10} Z`" fill="#cfe3b4" stroke="#7d9a62" stroke-width="1.5" />
          <path :d="`M${table.x - 24} ${table.y - 2} Q${table.x - 10} ${table.y - 10} ${table.x + 2} ${table.y + 2}`" fill="none" stroke="#c62828" stroke-width="2" stroke-dasharray="3 2" />
        </template>
        <template v-else-if="table.role === 'mechanic'">
          <rect v-for="(dx, index) in [-14, -2, 10]" :key="dx" :x="table.x + dx" :y="table.y - 8 + index" width="11" height="15" rx="1.5" fill="#fff" stroke="#9aa1ad" />
          <ellipse v-for="dy in [0, -3, -6]" :key="dy" :cx="table.x + 34" :cy="table.y + 4 + dy" rx="8" ry="3" fill="#e63946" stroke="#8b1e28" />
        </template>
        <template v-else-if="table.role === 'engineer'">
          <path :d="`M${table.x - 34} ${table.y + 2} L${table.x - 4} ${table.y + 2} L${table.x + 2} ${table.y - 6} L${table.x - 28} ${table.y - 6} Z`" fill="#9aa1ad" />
          <rect :x="table.x - 30" :y="table.y - 32" width="30" height="26" rx="2" fill="#2b2f37" stroke="#9aa1ad" stroke-width="2" />
          <rect :x="table.x - 26" :y="table.y - 28" width="22" height="18" fill="#4fc3f7" opacity="0.8" />
        </template>
        <template v-else-if="table.role === 'psychologist'">
          <path :d="`M${table.x - 6} ${table.y - 14} Q${table.x - 10} ${table.y + 2} ${table.x + 6} ${table.y + 2} Q${table.x + 20} ${table.y + 2} ${table.x + 16} ${table.y - 14} Z`" fill="#f4f1ea" stroke="#9aa1ad" />
          <path :d="`M${table.x + 16} ${table.y - 10} Q${table.x + 24} ${table.y - 8} ${table.x + 16} ${table.y - 2}`" fill="none" stroke="#9aa1ad" stroke-width="2" />
        </template>
        <template v-else-if="table.role === 'chemist'">
          <rect :x="table.x - 4" :y="table.y - 30" width="10" height="30" rx="2" fill="#1f5f8b" />
          <path :d="`M${table.x + 14} ${table.y - 20} H${table.x + 32} L${table.x + 23} ${table.y - 8} Z`" fill="#b388ff" />
          <path :d="`M${table.x + 23} ${table.y - 8} V${table.y + 2}`" stroke="#e8f4f8" stroke-width="2" />
        </template>
        <template v-else-if="table.role === 'informant'">
          <rect :x="table.x - 8" :y="table.y - 10" width="24" height="14" rx="1" fill="#f1efe6" stroke="#b9b4a6" transform-origin="center" />
          <path :d="`M${table.x + 26} ${table.y - 10} H${table.x + 40} L${table.x + 38} ${table.y + 2} H${table.x + 28} Z`" fill="#f4f1ea" stroke="#9aa1ad" />
        </template>
        <template v-else-if="table.role === 'saboteur'">
          <ellipse :cx="table.x + 4" :cy="table.y" rx="14" ry="5" fill="#8d939c" stroke="#5b6270" />
          <path class="bgr-bar-smoke" :d="`M${table.x + 6} ${table.y - 4} C${table.x} ${table.y - 14} ${table.x + 12} ${table.y - 20} ${table.x + 6} ${table.y - 30}`" fill="none" stroke="#cfd8dc" stroke-width="2.5" opacity="0.6" />
          <rect :x="table.x - 30" :y="table.y - 16" width="12" height="16" rx="2" fill="#3e2723" opacity="0.85" />
        </template>
      </g>
    </svg>

    <button class="bgr-scene-talk" data-tail="left" style="--x: 27%; --y: 28.6%; --w: 22%" @click="emit('rumors')">{{ $t('bar.bartender') }}</button>
    <button class="bgr-scene-talk" data-tail="down" style="--x: 70%; --y: 30.1%; --w: 27%; --tail: 40%" @click="emit('chat')">{{ $t('bar.chatTalk') }}</button>
    <div class="bgr-scene-layer" :style="{ aspectRatio: `${W} / ${H}` }">
      <div v-for="table in tables" :key="table.role" class="bgr-bar-plate" :class="{ locked: !table.data.unlocked }" :style="place(table.x, table.y + 34)">
        {{ $t(`bar.table.${table.role}`) }}<span v-if="table.data.current" class="bgr-bar-hired" :aria-label="$t('bar.hired')"> ✓</span>
        <small v-if="!table.data.unlocked">{{ $t('bar.reserved', { level: table.data.unlock_level }) }}</small>
      </div>
    </div>
  </div>
</template>
