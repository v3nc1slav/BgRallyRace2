<script setup lang="ts">
import { useClock } from '../daylight';
import BarPerson from './BarPerson.vue';

defineProps<{ name: string }>();

const W = 1000;
const H = 560;
const { night } = useClock();

const BOOK_COLORS = ['#1d2b55', '#6b1f24', '#1f4d3a', '#e8dcc0', '#24345f', '#7a2a22', '#2a5a44'];
const SHELF_ROWS = [110, 180, 250];
const BAYS = [34, 132];
const BOOKS = SHELF_ROWS.flatMap((base, row) =>
  BAYS.flatMap((left, bay) => {
    const count = row === 0 && bay === 0 ? 5 : row === 1 && bay === 1 ? 6 : 9;
    return Array.from({ length: count }, (_, index) => ({
      x: left + index * 9.5,
      base,
      tall: 44 + ((index * 5 + row * 3 + bay) % 4) * 4,
      color: BOOK_COLORS[(index + row * 2 + bay * 3) % BOOK_COLORS.length],
    }));
  }),
);
const IVY = Array.from({ length: 16 }, (_, index) => ({ x: 232 + Math.sin(index * 0.8) * 9, y: 36 + index * 12, r: index % 2 ? 35 : -35 }));
const LAUREL = [0, 1, 2, 3, 4].map((index) => ({ x: 490 - index * 11, y: 206 - index * 3 - index * index * 0.7, r: -24 - index * 9 }));
const TUFTS = [0, 1, 2].flatMap((row) => [0, 1, 2, 3, 4].map((col) => ({ x: 456 + col * 22 + (row % 2) * 11, y: 228 + row * 22 })));
const HYDRANGEA = [[478, 436, '#e891b8', 16], [500, 424, '#f2a7c8', 16], [522, 436, '#d97aa6', 16], [466, 452, '#d97aa6', 15], [488, 452, '#f2a7c8', 16], [512, 452, '#e891b8', 16], [534, 452, '#f2a7c8', 15]] as const;
const FLOWERS = [[252, 262], [264, 250], [278, 257], [268, 272], [286, 244], [244, 248]];
const STARS = Array.from({ length: 12 }, (_, index) => ({ x: 735 + Math.sin((index * Math.PI) / 6) * 14, y: 122 - Math.cos((index * Math.PI) / 6) * 14 }));
const SKY_STARS = [[812, 92], [846, 78], [878, 104], [826, 140], [868, 152]];

const star = (x: number, y: number, r: number) =>
  Array.from({ length: 10 }, (_, index) => {
    const angle = (index * Math.PI) / 5 - Math.PI / 2;
    const radius = index % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
const band = (x0: number, x1: number) => `${x0},50 ${x1},50 ${x1},${(272 - ((x1 - 663) * 14) / 37).toFixed(1)} ${x0},${(272 - ((x0 - 663) * 14) / 37).toFixed(1)}`;
</script>

<template>
  <div class="bgr-scene bgr-hall-scene">
    <svg :viewBox="`0 0 ${W} ${H}`" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgr-hall-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8cc4ee" />
          <stop offset="1" stop-color="#e3f2fb" />
        </linearGradient>
        <linearGradient id="bgr-hall-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#070d1a" />
          <stop offset="1" stop-color="#1f3050" />
        </linearGradient>
        <linearGradient id="bgr-hall-fabric" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ddd5c8" />
          <stop offset="1" stop-color="#b8ad9b" />
        </linearGradient>
        <linearGradient id="bgr-hall-art" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9cc3dd" />
          <stop offset="1" stop-color="#f1e3c6" />
        </linearGradient>
      </defs>

      <rect width="770" height="372" fill="#4a2a1b" />
      <rect width="770" height="22" fill="#2e1a10" />
      <g fill="#52301f" stroke="#3a1f13" stroke-width="4">
        <rect v-for="x in [292, 378, 464, 550, 636]" :key="x" :x="x" y="40" width="72" height="150" rx="2" />
        <rect v-for="x in [292, 378, 464, 550, 636]" :key="`l${x}`" :x="x" y="222" width="72" height="130" rx="2" />
      </g>
      <rect y="204" width="770" height="8" fill="#3a1f13" />
      <rect x="770" width="230" height="372" fill="#dccfb9" />
      <rect x="770" width="230" height="22" fill="#c4b59c" />
      <rect x="770" y="300" width="230" height="72" fill="#6b4a32" />
      <rect x="770" y="296" width="230" height="6" fill="#4a3020" />
      <rect y="372" :width="W" :height="H - 372" fill="#8a5a36" />
      <path v-for="y in [392, 418, 448, 484, 526]" :key="y" :d="`M0 ${y} H${W}`" stroke="#76492b" stroke-width="2" />
      <rect y="366" :width="W" height="8" fill="#2e1a10" />

      <path d="M120 440 H880 L1000 560 H0 Z" fill="#8c3b2e" />
      <path d="M140 448 H860 L968 556 H32 Z" fill="none" stroke="#e0c9a0" stroke-width="4" />
      <path d="M168 460 H832 L926 552 H74 Z" fill="#a24a38" />
      <ellipse cx="500" cy="506" rx="150" ry="34" fill="#e0c9a0" opacity="0.45" />
      <ellipse cx="500" cy="506" rx="96" ry="20" fill="#2f4a66" opacity="0.55" />
      <circle v-for="x in [240, 330, 670, 760]" :key="x" :cx="x" cy="500" r="6" fill="#e0c9a0" opacity="0.6" />

      <rect x="20" y="30" width="212" height="336" fill="#3b2416" />
      <rect x="30" y="40" width="192" height="214" fill="#24140c" />
      <rect x="124" y="40" width="4" height="214" fill="#3b2416" />
      <rect v-for="y in SHELF_ROWS" :key="y" x="30" :y="y" width="192" height="8" fill="#5a3a26" />
      <rect v-for="book in BOOKS" :key="`${book.x}-${book.base}`" :x="book.x" :y="book.base - book.tall" width="8" :height="book.tall" :fill="book.color" />
      <g fill="#d4af37">
        <rect x="88" y="100" width="26" height="10" />
        <path d="M94 100 L96 80 L90 72 L96 64 L106 66 L104 74 L110 78 L108 100 Z" />
      </g>
      <rect x="190" y="148" width="26" height="32" fill="#d4af37" />
      <rect x="194" y="152" width="18" height="24" fill="#f4efe6" />
      <rect x="30" y="262" width="192" height="98" fill="#3b2416" />
      <rect v-for="x in [36, 130]" :key="x" :x="x" y="268" width="86" height="86" fill="#4a2a1b" stroke="#24140c" stroke-width="3" />
      <circle v-for="x in [114, 138]" :key="x" :cx="x" cy="312" r="3" fill="#d4af37" />
      <ellipse v-for="(leaf, index) in IVY" :key="index" :cx="leaf.x" :cy="leaf.y" rx="8" ry="4.5" :fill="index % 3 ? '#2e7d32' : '#43a047'" :transform="`rotate(${leaf.r} ${leaf.x} ${leaf.y})`" />

      <path d="M474 58 L480 40 L490 52 L500 36 L510 52 L520 40 L526 58 Z" fill="#d4af37" />
      <path d="M470 62 H530 V100 Q530 128 500 140 Q470 128 470 100 Z" fill="#2e1a10" stroke="#d4af37" stroke-width="3" />
      <path d="M500 66 V136 M473 98 H527" stroke="#d4af37" stroke-width="2" />
      <circle v-for="[x, y] in [[486, 82], [514, 82], [486, 114], [514, 112]]" :key="`${x}-${y}`" :cx="x" :cy="y" r="5" fill="#2e7d32" stroke="#d4af37" stroke-width="1.5" />
      <text class="bgr-hall-title" x="500" y="176">{{ $t('hall.scene.title') }}</text>
      <g fill="#d4af37">
        <path d="M498 208 Q462 210 442 188" fill="none" stroke="#d4af37" stroke-width="2.5" />
        <path d="M502 208 Q538 210 558 188" fill="none" stroke="#d4af37" stroke-width="2.5" />
        <ellipse v-for="(leaf, index) in LAUREL" :key="index" :cx="leaf.x" :cy="leaf.y" rx="7" ry="3" :transform="`rotate(${leaf.r} ${leaf.x} ${leaf.y})`" />
        <ellipse v-for="(leaf, index) in LAUREL" :key="`r${index}`" :cx="1000 - leaf.x" :cy="leaf.y" rx="7" ry="3" :transform="`rotate(${-leaf.r} ${1000 - leaf.x} ${leaf.y})`" />
      </g>

      <rect x="659" y="40" width="4" height="290" fill="#c9a14a" />
      <circle cx="661" cy="38" r="5" fill="#e0b74a" />
      <polygon :points="band(663, 675.3)" fill="#ffffff" />
      <polygon :points="band(675.3, 687.6)" fill="#00966e" />
      <polygon :points="band(687.6, 700)" fill="#d62612" />
      <rect x="711" y="40" width="4" height="290" fill="#c9a14a" />
      <circle cx="713" cy="38" r="5" fill="#e0b74a" />
      <polygon points="715,50 756,50 756,268 715,280" fill="#1f3d99" />
      <polygon v-for="(point, index) in STARS" :key="index" :points="star(point.x, point.y, 3.2)" fill="#f4c430" />
      <rect v-for="x in [670, 690, 724, 744]" :key="x" :x="x" y="50" width="4" height="220" fill="#000" opacity="0.12" />

      <g class="bgr-hall-window" :data-time="night ? 'night' : 'day'">
        <rect x="790" y="60" width="110" height="232" fill="#f4efe6" />
        <rect x="796" y="66" width="98" height="220" :fill="night ? 'url(#bgr-hall-night)' : 'url(#bgr-hall-day)'" />
        <template v-if="night">
          <circle v-for="[x, y] in SKY_STARS" :key="`${x}-${y}`" :cx="x" :cy="y" r="1.6" fill="#fff" opacity="0.85" />
          <circle cx="852" cy="120" r="11" fill="#f4f1d0" />
          <circle cx="858" cy="115" r="10" fill="#0f1a2e" />
        </template>
        <template v-else>
          <circle cx="856" cy="110" r="12" fill="#fff3b0" />
          <ellipse cx="822" cy="150" rx="18" ry="7" fill="#fff" opacity="0.9" />
        </template>
        <path d="M845 66 V286 M796 176 H894" stroke="#f4efe6" stroke-width="5" />
      </g>
      <rect x="764" y="44" width="162" height="6" rx="3" fill="#8a6a3a" />
      <path d="M770 50 H814 Q804 170 818 300 H770 Z" fill="#cbbfa9" />
      <path d="M876 50 H920 V300 H872 Q886 170 876 50 Z" fill="#cbbfa9" />
      <path d="M784 54 V296 M798 54 Q792 170 800 296 M906 54 V296 M892 54 Q898 170 890 296" stroke="#b3a68e" stroke-width="2" />

      <rect x="932" y="66" width="80" height="104" fill="#c9a14a" />
      <rect x="940" y="74" width="64" height="88" fill="url(#bgr-hall-art)" />
      <path d="M940 128 L956 106 L970 122 L986 100 L1004 124 V162 H940 Z" fill="#7d9a62" />
      <rect v-for="x in [948, 966, 984]" :key="x" :x="x" y="138" width="14" height="12" fill="#f4efe6" />
      <path v-for="x in [948, 966, 984]" :key="`r${x}`" :d="`M${x - 2} 138 L${x + 7} 130 L${x + 16} 138 Z`" fill="#b84a2e" />

      <rect x="776" y="330" width="34" height="42" rx="3" fill="#8d6e63" />
      <path d="M793 330 V250" stroke="#5d4037" stroke-width="4" />
      <ellipse v-for="(leaf, index) in [[-20, 260], [18, 252], [-12, 236], [14, 228], [0, 214], [-24, 290], [22, 286], [-6, 270], [10, 302]]" :key="index" :cx="793 + leaf[0]" :cy="leaf[1]" rx="14" ry="7" :fill="index % 2 ? '#2e7d32' : '#43a047'" :transform="`rotate(${leaf[0] * 1.5} ${793 + leaf[0]} ${leaf[1]})`" />

      <path d="M840 334 Q840 318 858 318 H1000 V412 H840 Z" fill="#5a2a18" />
      <circle v-for="(x, index) in [868, 896, 924, 952, 980, 882, 910, 938, 966]" :key="index" :cx="x" :cy="index < 5 ? 344 : 370" r="2.5" fill="#3a1a0e" />
      <rect x="846" y="400" width="154" height="40" fill="#6b3420" />
      <rect x="846" y="440" width="154" height="30" fill="#4a2214" />
      <rect x="896" y="350" width="62" height="48" rx="8" fill="#e8e0d0" transform="rotate(-6 927 374)" />
      <path d="M824 362 Q824 340 846 340 Q868 340 868 362 V472 H824 Z" fill="#6b3420" />
      <rect x="830" y="470" width="8" height="10" fill="#2e1a10" />

      <rect x="440" y="212" width="120" height="108" rx="22" fill="#5a2e1c" />
      <circle v-for="(tuft, index) in TUFTS" :key="index" :cx="tuft.x" :cy="tuft.y" r="2.5" fill="#3e1f12" />
      <BarPerson :x="500" :y="254" :scale="0.62" shirt="#1f2a44" shirt-front="#f1f1f1" tie="#2a4f9a" hair="#6b625a" beard skin="#e0b08a" pose="clasp" />
      <path d="M456 284 H544 L539 318 H461 Z" fill="#2b2f37" />
      <circle cx="500" cy="300" r="4.5" fill="#4a4f58" />

      <path d="M228 318 H772 L782 332 H218 Z" fill="#6e3a22" />
      <path d="M446 318 H554 L548 323 H452 Z" fill="#3a3f47" />
      <rect x="218" y="332" width="564" height="8" fill="#4a2414" />
      <rect x="226" y="340" width="548" height="134" fill="#5a2e1c" />
      <g fill="#62331f" stroke="#3e1f12" stroke-width="4">
        <rect x="240" y="352" width="170" height="110" />
        <rect x="425" y="352" width="150" height="110" />
        <rect x="590" y="352" width="170" height="110" />
      </g>
      <g fill="none" stroke="#4a2414" stroke-width="2">
        <rect x="254" y="364" width="142" height="86" rx="6" />
        <rect x="439" y="364" width="122" height="86" rx="6" />
        <rect x="604" y="364" width="142" height="86" rx="6" />
      </g>
      <rect x="218" y="470" width="564" height="14" fill="#3e1f12" />

      <path d="M262 318 Q256 290 262 268 M268 318 Q272 286 284 252" stroke="#4a7a3a" stroke-width="2" fill="none" />
      <circle v-for="[x, y] in FLOWERS" :key="`${x}-${y}`" :cx="x" :cy="y" r="7" fill="#fdfcf7" stroke="#e5ddd0" />
      <circle v-for="[x, y] in FLOWERS" :key="`c${x}-${y}`" :cx="x" :cy="y" r="2" fill="#c9a14a" />
      <ellipse v-for="dx in [-12, 12]" :key="dx" :cx="266 + dx" cy="294" rx="12" ry="5" fill="#2e7d32" :transform="`rotate(${dx} ${266 + dx} 294)`" />
      <path d="M250 296 H282 L278 318 H254 Z" fill="#c9a14a" />
      <path d="M296 304 H346 V318 H296 Z M296 311 H346" fill="none" stroke="#2b2f37" stroke-width="2.5" />
      <path d="M372 314 L422 311 L428 318 L376 321 Z" fill="#f4f1ea" />
      <rect x="570" y="300" width="14" height="18" fill="#3e1f12" />
      <path d="M574 300 L572 288 M578 300 V286 M582 300 L585 289" stroke="#c0c6cf" stroke-width="2" />
      <rect x="600" y="306" width="40" height="12" rx="2" fill="#2b2f37" />
      <path d="M604 304 Q620 296 636 304" stroke="#2b2f37" stroke-width="6" fill="none" stroke-linecap="round" />
      <rect x="664" y="288" width="36" height="30" fill="#d4af37" />
      <rect x="668" y="292" width="28" height="22" fill="#cfe3f0" />
      <circle v-for="x in [675, 682, 689]" :key="x" :cx="x" cy="302" r="3" fill="#8d5a3b" />

      <g class="bgr-hall-table">
        <rect v-for="x in [424, 568]" :key="x" :x="x" y="512" width="8" height="56" fill="#2e1a10" />
        <rect v-for="x in [462, 532]" :key="`b${x}`" :x="x" y="512" width="6" height="30" fill="#24140c" />
        <ellipse cx="500" cy="510" rx="132" ry="29" fill="#3e1f12" />
        <ellipse cx="500" cy="505" rx="124" ry="25" fill="#2a2a30" />
        <ellipse cx="462" cy="498" rx="50" ry="7" fill="#fff" opacity="0.08" />
        <rect x="414" y="488" width="32" height="15" rx="2" fill="#c0c6cf" />
        <path d="M486 452 H514 L518 504 H482 Z" fill="#dff3fb" opacity="0.55" stroke="#fff" stroke-width="1.5" />
        <path d="M496 504 V452 M504 504 V454" stroke="#4a7a3a" stroke-width="2" />
        <circle v-for="([x, y, color, r], index) in HYDRANGEA" :key="index" :cx="x" :cy="y" :r="r" :fill="color" />
        <circle v-for="([x, y], index) in HYDRANGEA" :key="`d${index}`" :cx="x + 4" :cy="y - 4" r="4" fill="#fff" opacity="0.35" />
      </g>

      <g v-for="side in [1, -1]" :key="side" class="bgr-hall-chair" :transform="side < 0 ? `translate(${W} 0) scale(-1 1)` : undefined">
        <path d="M84 540 L80 562 M296 532 L300 556" stroke="#2e1a10" stroke-width="9" stroke-linecap="round" />
        <path d="M66 546 C58 486 60 428 78 398 C94 372 118 362 140 364 C160 366 172 382 176 404 C182 434 206 452 246 456 C280 459 304 460 316 474 C326 488 324 512 318 530 L310 546 Z" fill="url(#bgr-hall-fabric)" />
        <path d="M78 398 C94 372 118 362 140 364 C160 366 172 382 176 404 C182 434 206 452 246 456 C280 459 304 460 316 474" fill="none" stroke="#efe9df" stroke-width="5" stroke-linecap="round" />
        <path d="M70 528 Q190 540 314 522" fill="none" stroke="#8f8371" stroke-width="3.5" stroke-dasharray="0.5 7" stroke-linecap="round" />
        <path d="M316 474 C326 488 324 512 318 530" fill="none" stroke="#a89c8a" stroke-width="4" />
      </g>
    </svg>

    <p class="bgr-scene-talk" data-tail="right" style="--x: 26%; --y: 21.6cqw; --w: 20%; --tail: 26px">{{ $t('hall.welcome', { name }) }}</p>
  </div>
</template>
