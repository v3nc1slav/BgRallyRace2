<script setup lang="ts">
import type { PersonLook } from './BarPerson.vue';
import BarPerson from './BarPerson.vue';
import MallWalker from './MallWalker.vue';

export type MallShop = 'fitness' | 'clothes' | 'shoes' | 'accessories';

const emit = defineEmits<{ open: [shop: MallShop] }>();

const W = 1000;
const SHOPS: { key: MallShop; x: number; color: string; inside: string }[] = [
  { key: 'fitness', x: 20, color: '#2e7d32', inside: '#dfe9e1' },
  { key: 'clothes', x: 265, color: '#8e24aa', inside: '#efe7f3' },
  { key: 'shoes', x: 510, color: '#ef6c00', inside: '#f6ede2' },
  { key: 'accessories', x: 755, color: '#1f5f8b', inside: '#e3edf5' },
];
const DECOR = [
  { key: 'restaurant', x: 20, w: 215, color: '#7a1f2b', inside: '#f6e2c4' },
  { key: 'food', x: 245, w: 180, color: '#e65100', inside: '#fff3d6' },
  { key: 'zoo', x: 610, w: 180, color: '#2e7d32', inside: '#e6f2e1' },
  { key: 'electronics', x: 800, w: 180, color: '#263238', inside: '#e8ebef' },
];
const SUITS = ['#1a237e', '#455a64', '#212121'];
const SHOES = ['#e63946', '#2b2f37', '#f4f1ea', '#1e88e5', '#f28c28', '#6d4c41'];
const DINERS: PersonLook[][] = [
  [
    { pose: 'cocktail', shirt: '#fafafa', cut: 'long', hair: '#212121' },
    { pose: 'talk', mirror: true, shirt: '#263238', hair: '#4e342e' },
  ],
  [
    { pose: 'coffee', shirt: '#8d6e63', cut: 'bald', hair: '#9e9e9e', beard: true },
    { pose: 'rest', mirror: true, shirt: '#d81b60', cut: 'long', hair: '#d84315', skin: '#c68e63' },
  ],
];
const WALKERS: { x: number; y: number; s: number; look: PersonLook; pants: string; d: number; delay: number; reverse?: boolean }[] = [
  { x: 120, y: 686, s: 0.46, look: { pose: 'bag', shirt: '#1e88e5', hair: '#3e2723', bagColor: '#f28c28' }, pants: '#37474f', d: 34, delay: 6 },
  { x: 380, y: 678, s: 0.44, look: { pose: 'walk', shirt: '#e91e63', cut: 'long', hair: '#212121', skin: '#c68e63' }, pants: '#1a237e', d: 41, delay: 20, reverse: true },
  { x: 720, y: 692, s: 0.48, look: { pose: 'walk', shirt: '#43a047', cut: 'cap', hat: '#263238', back: true }, pants: '#5d4037', d: 29, delay: 12 },
  { x: 880, y: 682, s: 0.45, look: { pose: 'bag', shirt: '#ffb300', cut: 'bald', hair: '#6d4c41', beard: true, bagColor: '#8e24aa' }, pants: '#263238', d: 38, delay: 30, reverse: true },
  { x: 200, y: 300, s: 0.34, look: { pose: 'walk', shirt: '#00897b', cut: 'long', hair: '#a1662f' }, pants: '#37474f', d: 36, delay: 8 },
  { x: 760, y: 300, s: 0.34, look: { pose: 'walk', shirt: '#5c6bc0', hair: '#212121', back: true }, pants: '#212121', d: 44, delay: 25, reverse: true },
];
const STEPS = Array.from({ length: 13 }, (_, index) => (index + 1) / 14);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ride = (t: number) => ({ x: lerp(469, 589, t), y: lerp(690, 302, t) });
const RIDE_SECONDS = 30;
const FLOOR = 300;
const RIDERS: { look: PersonLook; pants: string; rest: number }[] = [
  { look: { pose: 'bag', shirt: '#6d4c41', cut: 'long', hair: '#3e2723', bagColor: '#1e88e5' }, pants: '#37474f', rest: 0.3 },
  { look: { pose: 'walk', shirt: '#ef6c00', hair: '#212121', back: true }, pants: '#263238', rest: 0.68 },
  { look: { pose: 'walk', shirt: '#7b1fa2', cut: 'cap', hat: '#c62828', skin: '#c68e63' }, pants: '#1a237e', rest: 0.5 },
];
const rest = (t: number) => `translate(${ride(t).x} ${ride(t).y}) scale(0.38)`;

const walk = (walker: (typeof WALKERS)[number]) => ({
  '--from': `${-walker.x - 140}px`,
  '--to': `${W - walker.x + 140}px`,
  animationDuration: `${walker.d}s`,
  animationDelay: `-${walker.delay}s`,
  animationDirection: walker.reverse ? 'reverse' : 'normal',
});
</script>

<template>
  <div class="bgr-scene bgr-mall-scene">
    <svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="bgr-mall-above">
          <rect width="1000" :height="FLOOR" />
        </clipPath>
        <clipPath id="bgr-mall-below">
          <rect :y="FLOOR" width="1000" :height="700 - FLOOR" />
        </clipPath>
      </defs>
      <rect width="1000" height="48" fill="#2b3a4f" />
      <g stroke="#3f5470" stroke-width="3">
        <line v-for="x in [125, 250, 375, 625, 750, 875]" :key="x" :x1="x" y1="0" :x2="x" y2="48" />
      </g>
      <rect x="430" y="8" width="140" height="34" rx="5" fill="#7a1f2b" stroke="#fff" stroke-width="2" />
      <text class="bgr-mall-sign" x="500" y="33">{{ $t('mall.title') }}</text>
      <rect y="48" width="1000" height="252" fill="#e6e1d7" />
      <rect y="318" width="1000" height="274" fill="#d8d2c6" />
      <rect y="592" width="1000" height="108" fill="#cfc8bb" />
      <g stroke="#bdb5a6" stroke-width="2">
        <line v-for="y in [622, 656]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" />
        <line v-for="x in [100, 300, 500, 700, 900]" :key="x" :x1="x" y1="592" :x2="500 + (x - 500) * 1.3" y2="700" />
      </g>

      <g
        v-for="shop in SHOPS"
        :key="shop.key"
        class="bgr-gs-hot bgr-mall-shop"
        :data-shop="shop.key"
        role="button"
        tabindex="0"
        :aria-label="$t(`mall.shops.${shop.key}`)"
        @click="emit('open', shop.key)"
        @keydown.enter.prevent="emit('open', shop.key)"
        @keydown.space.prevent="emit('open', shop.key)"
      >
        <g :transform="`translate(${shop.x} 0)`">
          <rect y="70" width="225" height="216" :fill="shop.inside" stroke="#5b6270" stroke-width="4" />
          <rect y="70" width="225" height="36" :fill="shop.color" stroke="#5b6270" stroke-width="4" />
          <text class="bgr-mall-sign" x="112" y="96">{{ $t(`mall.shops.${shop.key}`) }}</text>

          <template v-if="shop.key === 'fitness'">
            <rect x="12" y="120" width="62" height="44" rx="3" fill="#2e7d32" opacity="0.85" />
            <path d="M24 152 L36 134 L46 146 L56 128 L64 152 Z" fill="#fff" opacity="0.7" />
            <line x1="138" y1="150" x2="214" y2="150" stroke="#9aa1ad" stroke-width="4" />
            <rect x="144" y="136" width="8" height="28" rx="2" fill="#e63946" />
            <rect x="200" y="136" width="8" height="28" rx="2" fill="#e63946" />
            <rect x="8" y="256" width="209" height="30" fill="#4a5160" />
            <MallWalker :x="62" :y="254" :scale="0.3" run :look="{ pose: 'walk', shirt: '#e53935', hair: '#212121' }" pants="#212121" />
            <path d="M18 262 L118 262 L124 252 L24 252 Z" fill="#2b2f37" />
            <rect x="112" y="200" width="6" height="56" fill="#5b6270" />
            <rect x="98" y="192" width="34" height="14" rx="3" fill="#37474f" />
            <rect x="102" y="195" width="14" height="6" fill="#7fd1ae" />
            <rect x="150" y="238" width="64" height="7" fill="#5b6270" />
            <g v-for="dx in [0, 22, 44]" :key="dx" :transform="`translate(${154 + dx} 230)`">
              <rect x="0" y="-2" width="12" height="4" fill="#9aa1ad" />
              <rect x="-3" y="-6" width="5" height="12" rx="1" fill="#2b2f37" />
              <rect x="10" y="-6" width="5" height="12" rx="1" fill="#2b2f37" />
            </g>
          </template>

          <template v-else-if="shop.key === 'clothes'">
            <line x1="12" y1="124" x2="213" y2="124" stroke="#9aa1ad" stroke-width="3" />
            <g v-for="(color, index) in SUITS" :key="color" :transform="`translate(${48 + index * 64} 0)`">
              <ellipse cx="0" cy="152" rx="11" ry="13" fill="#d7dbe0" />
              <rect x="-4" y="164" width="8" height="8" fill="#c3c9d2" />
              <path d="M-25 250 L-23 182 Q0 168 23 182 L25 250 Z" :fill="color" />
              <path d="M-8 172 L0 196 L8 172 Z" fill="#f4f1ea" />
              <path d="M0 176 V202" stroke="#c62828" stroke-width="3" />
              <path d="M-8 172 L-2 206 M8 172 L2 206" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2" />
              <rect x="-2" y="250" width="4" height="26" fill="#9aa1ad" />
              <ellipse cx="0" cy="278" rx="14" ry="4" fill="#5b6270" />
            </g>
          </template>

          <template v-else-if="shop.key === 'shoes'">
            <g v-for="(y, row) in [160, 212, 264]" :key="y">
              <rect x="10" :y="y" width="205" height="6" fill="#a67c52" />
              <g v-for="col in 4" :key="col" :transform="`translate(${20 + (col - 1) * 50} ${y})`">
                <path d="M0 0 H31 Q35 0 34 -5 L25 -8 Q19 -15 11 -15 H2 Z" :fill="SHOES[(row * 4 + col) % SHOES.length]" stroke="#2b2f37" stroke-width="1.5" />
                <path d="M1 0 H32" stroke="#f4f1ea" stroke-width="2" />
              </g>
            </g>
          </template>

          <template v-else>
            <g v-for="x in [40, 100]" :key="x" fill="#2b2f37">
              <ellipse :cx="x - 12" cy="140" rx="11" ry="8" />
              <ellipse :cx="x + 12" cy="140" rx="11" ry="8" />
              <path :d="`M${x - 2} 138 H${x + 2}`" stroke="#2b2f37" stroke-width="3" />
            </g>
            <path d="M154 150 Q165 128 176 150" fill="none" stroke="#5d2a6a" stroke-width="3" />
            <rect x="145" y="148" width="42" height="30" rx="4" fill="#8e24aa" />
            <path d="M60 172 Q100 204 140 172" fill="none" stroke="#c9a14a" stroke-width="2" />
            <circle cx="100" cy="188" r="5" fill="#e63946" />
            <rect x="20" y="228" width="185" height="56" fill="#cfe6f2" opacity="0.85" stroke="#9aa1ad" stroke-width="2" />
            <g v-for="(x, index) in [44, 84, 124, 164]" :key="x">
              <rect :x="x - 4" y="208" width="8" height="24" rx="2" fill="#3e2723" />
              <circle :cx="x" cy="220" r="9" :fill="index % 2 ? '#c0c7d1' : '#d4a017'" />
              <circle :cx="x" cy="220" r="6" fill="#fff" />
            </g>
          </template>
        </g>
      </g>

      <MallWalker v-for="walker in WALKERS.slice(4)" :key="walker.x" class="bgr-mall-path" :style="walk(walker)" :x="walker.x" :y="walker.y" :scale="walker.s" :look="walker.look" :pants="walker.pants" />
      <g class="bgr-mall-riders" clip-path="url(#bgr-mall-above)">
        <g
          v-for="(rider, index) in RIDERS"
          :key="index"
          class="bgr-mall-rider"
          :style="{ animationDuration: `${RIDE_SECONDS}s`, animationDelay: `-${(index * RIDE_SECONDS) / RIDERS.length}s` }"
          :transform="rest(rider.rest)"
        >
          <MallWalker :x="0" :y="0" :scale="1" :look="rider.look" :pants="rider.pants" />
        </g>
      </g>
      <rect class="bgr-mall-railing" x="0" y="256" width="556" height="46" fill="rgba(200, 230, 245, 0.3)" stroke="#9aa1ad" stroke-width="2" />
      <rect x="622" y="256" width="378" height="46" fill="rgba(200, 230, 245, 0.3)" stroke="#9aa1ad" stroke-width="2" />
      <path d="M0 256 H556 M622 256 H1000" stroke="#c3c9d2" stroke-width="5" />
      <rect y="300" width="1000" height="18" fill="#9aa1ad" />
      <rect y="316" width="1000" height="4" fill="#7d838c" />

      <g v-for="shop in DECOR" :key="shop.key" class="bgr-mall-decor" :data-shop="shop.key">
        <g :transform="`translate(${shop.x} 0)`">
          <rect y="336" :width="shop.w" height="256" :fill="shop.inside" stroke="#5b6270" stroke-width="4" />
          <rect y="336" :width="shop.w" height="32" :fill="shop.color" stroke="#5b6270" stroke-width="4" />
          <text class="bgr-mall-sign small" :x="shop.w / 2" y="359">{{ $t(`mall.shops.${shop.key}`) }}</text>

          <template v-if="shop.key === 'restaurant'">
            <g v-for="x in [70, 160]" :key="x">
              <line :x1="x" y1="370" :x2="x" y2="392" stroke="#5b6270" stroke-width="2" />
              <path :d="`M${x - 12} 404 L${x - 6} 392 H${x + 6} L${x + 12} 404 Z`" fill="#c9a14a" />
            </g>
            <g v-for="(pair, index) in DINERS" :key="index">
              <rect v-for="side in [-1, 1]" :key="side" :x="70 + index * 90 + side * 26 - 14" y="526" width="28" height="22" rx="5" fill="#5a341f" />
              <BarPerson v-for="(person, seat) in pair" :key="seat" v-bind="person" :x="70 + index * 90 + (seat ? 26 : -26)" :y="548 - 138 * 0.3" :scale="0.3" />
              <ellipse :cx="70 + index * 90" cy="552" rx="42" ry="10" fill="#8d5a36" stroke="#4a2c1a" stroke-width="2" />
              <rect :x="70 + index * 90 - 3" y="552" width="6" height="30" fill="#4a2c1a" />
              <path :d="`M${70 + index * 90 - 4} 546 L${70 + index * 90 + 4} 546 L${70 + index * 90} 552 Z`" fill="#8e1b2a" />
            </g>
            <rect x="192" y="556" width="16" height="22" fill="#a67c52" />
            <circle cx="200" cy="548" r="14" fill="#43a047" />
          </template>

          <template v-else-if="shop.key === 'food'">
            <rect x="14" y="380" width="152" height="46" rx="3" fill="#2b2f37" />
            <path d="M28 404 Q40 390 52 404 Z" fill="#d4a017" />
            <rect x="28" y="404" width="24" height="4" fill="#6d4c41" />
            <rect x="28" y="408" width="24" height="5" rx="2" fill="#d4a017" />
            <path d="M80 398 L84 416 H98 L102 398 Z" fill="#e63946" />
            <path d="M84 398 V388 M89 398 V386 M94 398 V388 M99 398 V387" stroke="#f4d35e" stroke-width="3" />
            <path d="M128 396 L132 418 H144 L148 396 Z" fill="#1e88e5" />
            <path d="M140 396 L146 384" stroke="#f4f1ea" stroke-width="2" />
            <BarPerson :x="90" :y="528 - 140 * 0.36" :scale="0.36" cut="cap" hat="#f4d35e" shirt="#c62828" apron="#f4f1ea" />
            <rect x="0" y="522" width="180" height="8" fill="#d7dbe0" />
            <rect x="6" y="530" width="168" height="62" fill="#c62828" />
            <rect x="6" y="550" width="168" height="8" fill="#f4d35e" />
            <rect x="126" y="514" width="34" height="8" rx="2" fill="#a67c52" />
            <path d="M132 514 Q143 504 154 514 Z" fill="#d4a017" />
          </template>

          <template v-else-if="shop.key === 'zoo'">
            <rect x="14" y="400" width="84" height="60" fill="#4fc3f7" opacity="0.85" stroke="#37474f" stroke-width="4" />
            <rect x="14" y="460" width="84" height="32" fill="#6d4c41" />
            <g v-for="fish in [{ x: 40, y: 420, c: '#f28c28' }, { x: 72, y: 442, c: '#f4d35e' }]" :key="fish.x">
              <ellipse :cx="fish.x" :cy="fish.y" rx="9" ry="5" :fill="fish.c" />
              <path :d="`M${fish.x + 8} ${fish.y} L${fish.x + 15} ${fish.y - 5} V${fish.y + 5} Z`" :fill="fish.c" />
            </g>
            <circle v-for="(y, index) in [448, 436, 424]" :key="y" :cx="56 + index * 2" :cy="y" r="2.5" fill="#fff" opacity="0.7" />
            <line x1="145" y1="370" x2="145" y2="388" stroke="#9aa1ad" stroke-width="2" />
            <path d="M122 440 V412 Q145 384 168 412 V440 Z" fill="none" stroke="#9aa1ad" stroke-width="2.5" />
            <path d="M134 400 V440 M145 392 V440 M156 400 V440" stroke="#9aa1ad" stroke-width="1.5" />
            <ellipse cx="145" cy="428" rx="7" ry="5" fill="#f4d35e" />
            <rect x="18" y="534" width="30" height="46" rx="3" fill="#43a047" />
            <rect x="52" y="544" width="26" height="36" rx="3" fill="#f28c28" />
            <path d="M118 560 Q114 542 122 534" fill="none" stroke="#c8925a" stroke-width="5" stroke-linecap="round" />
            <ellipse cx="135" cy="566" rx="22" ry="17" fill="#c8925a" />
            <circle cx="152" cy="540" r="14" fill="#c8925a" />
            <ellipse cx="144" cy="532" rx="5" ry="9" fill="#8d5a36" />
            <ellipse cx="162" cy="545" rx="6" ry="4" fill="#e0b48f" />
            <circle cx="165" cy="543" r="2" fill="#15171c" />
            <circle cx="153" cy="536" r="2" fill="#15171c" />
            <ellipse cx="128" cy="582" rx="8" ry="4" fill="#b07a48" />
            <ellipse cx="146" cy="582" rx="8" ry="4" fill="#b07a48" />
          </template>

          <template v-else>
            <g v-for="(screen, index) in ['#4fc3f7', '#7fd1ae', '#e63946', '#f4d35e']" :key="screen">
              <rect :x="16 + (index % 2) * 80" :y="386 + Math.floor(index / 2) * 54" width="70" height="44" rx="2" fill="#15171c" />
              <rect :x="20 + (index % 2) * 80" :y="390 + Math.floor(index / 2) * 54" width="62" height="36" :fill="screen" opacity="0.75" />
            </g>
            <rect x="10" y="540" width="160" height="10" fill="#9aa1ad" />
            <rect x="18" y="550" width="6" height="40" fill="#5b6270" />
            <rect x="156" y="550" width="6" height="40" fill="#5b6270" />
            <g v-for="x in [30, 98]" :key="x">
              <rect :x="x" y="514" width="40" height="24" rx="2" fill="#2b2f37" />
              <rect :x="x + 3" y="517" width="34" height="18" fill="#4fc3f7" opacity="0.8" />
              <path :d="`M${x - 4} 540 H${x + 44} L${x + 40} 536 H${x} Z`" fill="#c3c9d2" />
            </g>
            <rect x="146" y="522" width="10" height="18" rx="2" fill="#15171c" />
          </template>
        </g>
      </g>

      <g class="bgr-mall-escalator">
        <path d="M432 690 L506 690 L618 302 L560 302 Z" fill="#8d939c" />
        <path d="M444 690 L494 690 L606 302 L572 302 Z" fill="#5b6270" />
        <g stroke="#3d424c" stroke-width="2">
          <line v-for="t in STEPS" :key="t" :x1="lerp(444, 572, t)" :y1="lerp(690, 302, t)" :x2="lerp(494, 606, t)" :y2="lerp(690, 302, t)" />
        </g>
        <path class="bgr-mall-glass" d="M432 690 L560 302 L548 300 L432 650 Z" fill="rgba(200, 230, 245, 0.35)" />
        <path d="M432 650 L548 300" stroke="#15171c" stroke-width="6" stroke-linecap="round" />
      </g>
      <g class="bgr-mall-riders" clip-path="url(#bgr-mall-below)">
        <g
          v-for="(rider, index) in RIDERS"
          :key="index"
          class="bgr-mall-rider"
          :style="{ animationDuration: `${RIDE_SECONDS}s`, animationDelay: `-${(index * RIDE_SECONDS) / RIDERS.length}s` }"
          :transform="rest(rider.rest)"
        >
          <MallWalker :x="0" :y="0" :scale="1" :look="rider.look" :pants="rider.pants" />
        </g>
      </g>

      <MallWalker v-for="walker in WALKERS.slice(0, 4)" :key="walker.x" class="bgr-mall-path" :style="walk(walker)" :x="walker.x" :y="walker.y" :scale="walker.s" :look="walker.look" :pants="walker.pants" />
    </svg>
  </div>
</template>
