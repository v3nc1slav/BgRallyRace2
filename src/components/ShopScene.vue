<script setup lang="ts">
import type { ShopSection } from '../game';
import GarageCar from './GarageCar.vue';
import PartIcon from './PartIcon.vue';

const emit = defineEmits<{ open: [section: ShopSection] }>();

const TOP = 104;
const WIDTH = 296;
const HEIGHT = 326;
const SECTIONS: { key: ShopSection; x: number }[] = [
  { key: 'cars', x: 36 },
  { key: 'parts', x: 352 },
  { key: 'tyres', x: 668 },
];
const PARTS = [
  { type: 'engine', x: 62, y: 160 },
  { type: 'turbo', x: 170, y: 160 },
  { type: 'gearbox', x: 62, y: 248 },
  { type: 'suspension', x: 170, y: 248 },
  { type: 'brakes', x: 62, y: 336 },
  { type: 'chassis', x: 170, y: 336 },
];
const SHELVES = [230, 318, 406];
const TYRE_ROWS = [188, 268, 348];
const TYRE_COLUMNS = [56, 148, 240];
const SPOKES = [0, 60, 120];
</script>

<template>
  <div class="bgr-shop-scene">
    <svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="440" fill="#3f4653" />
      <rect width="1000" height="40" fill="#23272f" />
      <rect v-for="x in [120, 440, 760]" :key="x" :x="x" y="32" width="120" height="8" rx="2" fill="#fff4c9" />
      <rect x="290" y="50" width="420" height="44" rx="6" fill="#15171c" stroke="#e63946" stroke-width="3" />
      <text class="bgr-shop-sign" x="500" y="81">{{ $t('shop.title') }}</text>

      <rect y="440" width="1000" height="180" fill="#6a717e" />
      <g stroke="#59606c" stroke-width="2">
        <line v-for="x in [120, 300, 500, 700, 880]" :key="x" :x1="500 + (x - 500) * 0.72" y1="440" :x2="x" y2="620" />
        <line x1="0" y1="500" x2="1000" y2="500" />
        <line x1="0" y1="560" x2="1000" y2="560" />
      </g>
      <rect y="434" width="1000" height="7" fill="#23272f" />

      <g
        v-for="section in SECTIONS"
        :key="section.key"
        class="bgr-gs-hot bgr-shop-section"
        :data-section="section.key"
        role="button"
        tabindex="0"
        :aria-label="$t(`shop.${section.key}`)"
        @click="emit('open', section.key)"
        @keydown.enter="emit('open', section.key)"
        @keydown.space.prevent="emit('open', section.key)"
      >
        <g :transform="`translate(${section.x} 0)`">
          <rect :y="TOP" :width="WIDTH" :height="HEIGHT" rx="8" fill="#e4e8ee" stroke="#15171c" stroke-width="4" />
          <path :d="`M0 ${TOP + 44} V${TOP + 8} Q0 ${TOP} 8 ${TOP} H${WIDTH - 8} Q${WIDTH} ${TOP} ${WIDTH} ${TOP + 8} V${TOP + 44} Z`" fill="#e63946" stroke="#15171c" stroke-width="4" />
          <text class="bgr-shop-label" :x="WIDTH / 2" :y="TOP + 32">{{ $t(`shop.${section.key}`) }}</text>

          <template v-if="section.key === 'cars'">
            <path d="M6 150 L60 150 L24 410 L6 410 Z M290 150 L236 150 L272 410 L290 410 Z" fill="#fff4c9" opacity="0.5" />
            <ellipse cx="148" cy="404" rx="126" ry="17" fill="#b4bbc6" stroke="#8d939c" stroke-width="2" />
            <g transform="translate(32 300) scale(0.68)">
              <GarageCar color="#e63946" />
            </g>
          </template>

          <template v-else-if="section.key === 'parts'">
            <rect v-for="y in SHELVES" :key="y" x="14" :y="y" width="268" height="7" fill="#a67c52" stroke="#6f4f2f" stroke-width="1" />
            <g v-for="part in PARTS" :key="part.type" :transform="`translate(${part.x} ${part.y}) scale(2.1)`">
              <PartIcon :type="part.type" :x="0" :y="0" />
            </g>
          </template>

          <template v-else>
            <rect v-for="y in [226, 306, 386]" :key="y" x="12" :y="y" width="272" height="6" fill="#8d939c" />
            <rect x="14" y="150" width="6" height="276" fill="#6b7280" />
            <rect x="276" y="150" width="6" height="276" fill="#6b7280" />
            <g v-for="y in TYRE_ROWS" :key="y">
              <g v-for="x in TYRE_COLUMNS" :key="x" :transform="`translate(${x} ${y})`">
                <circle r="37" fill="#16181d" />
                <circle r="30" fill="none" stroke="#2f333b" stroke-width="5" stroke-dasharray="6 5" />
                <circle r="20" fill="#c3c9d2" stroke="#6b7280" stroke-width="2" />
                <line v-for="angle in SPOKES" :key="angle" x1="-16" y1="0" x2="16" y2="0" stroke="#6b7280" stroke-width="4" :transform="`rotate(${angle})`" />
                <circle r="5" fill="#3d424c" />
              </g>
            </g>
          </template>
        </g>
      </g>

      <g class="bgr-shop-seller">
        <path d="M436 524 L441 464 C443 446 456 437 476 432 L489 428 H511 L524 432 C544 437 557 446 559 464 L564 524 Z" fill="#2f5d8a" />
        <path d="M441 464 C443 446 456 437 476 432 L470 524 H436 Z" fill="#284f76" />
        <path d="M471 450 H529 L540 524 H460 Z" fill="#a92c37" />
        <path d="M474 451 L484 431 M526 451 L516 431" stroke="#a92c37" stroke-width="7" />
        <rect x="508" y="466" width="17" height="8" rx="1.5" fill="#f4f1ea" />
        <path d="M489 410 V430 Q500 442 511 430 V410 Z" fill="#d9a67e" />
        <path d="M489 426 L478 433 L490 449 L500 438 Z M511 426 L522 433 L510 449 L500 438 Z" fill="#3f78ae" />
        <path d="M450 454 C440 468 432 480 430 494" fill="none" stroke="#2f5d8a" stroke-width="21" stroke-linecap="round" />
        <path d="M430 494 C434 504 444 510 458 511" fill="none" stroke="#e9bd97" stroke-width="14" stroke-linecap="round" />
        <path d="M455 512 Q466 511 472 514 L456 517 Z" fill="#e9bd97" />
        <path d="M550 454 C562 466 572 474 584 478" fill="none" stroke="#2f5d8a" stroke-width="21" stroke-linecap="round" />
        <path d="M584 478 C592 468 598 458 603 447" fill="none" stroke="#e9bd97" stroke-width="13" stroke-linecap="round" />
        <g fill="none" stroke="#e9bd97" stroke-width="4.2" stroke-linecap="round">
          <path d="M604 444 L606 427" />
          <path d="M604 444 L612 428" />
          <path d="M605 445 L617 432" />
          <path d="M606 447 L620 438" />
          <path d="M600 447 L595 436" />
        </g>
        <ellipse cx="605" cy="444" rx="8" ry="7" fill="#e9bd97" />
        <ellipse cx="475" cy="384" rx="4" ry="8" fill="#d9a67e" />
        <ellipse cx="525" cy="384" rx="4" ry="8" fill="#d9a67e" />
        <path d="M476 378 C476 358 488 352 500 352 C512 352 524 358 524 378 C524 396 518 410 508 416 C503 419 497 419 492 416 C482 410 476 396 476 378 Z" fill="#e9bd97" />
        <path d="M512 356 C520 362 524 368 524 378 C524 396 518 410 508 416 C514 402 516 372 512 356 Z" fill="#d9a67e" opacity="0.55" />
        <path d="M474 382 C469 356 485 341 504 342 C523 342 533 358 527 383 C526 373 522 365 514 361 C503 367 488 367 480 364 C476 368 475 375 474 382 Z" fill="#3a2a20" />
        <path d="M483 376 Q490 372 496 375 M504 375 Q510 372 517 376" fill="none" stroke="#3a2a20" stroke-width="2.2" stroke-linecap="round" />
        <ellipse cx="490" cy="382" rx="3.8" ry="2.5" fill="#fff" />
        <ellipse cx="510" cy="382" rx="3.8" ry="2.5" fill="#fff" />
        <circle cx="490.6" cy="382" r="1.9" fill="#3b2a1e" />
        <circle cx="510.6" cy="382" r="1.9" fill="#3b2a1e" />
        <path d="M500 383 L497 395 Q500 398 503 396" fill="none" stroke="#c99673" stroke-width="1.8" stroke-linecap="round" />
        <path d="M489 403 Q500 412 511 403" fill="none" stroke="#a8564a" stroke-width="2.2" stroke-linecap="round" />
      </g>

      <rect x="312" y="526" width="376" height="94" fill="#8b2430" />
      <rect x="312" y="556" width="376" height="10" fill="#f4d35e" />
      <rect x="300" y="514" width="400" height="16" rx="3" fill="#d7dbe0" stroke="#2b2f37" stroke-width="2" />
      <rect x="332" y="474" width="66" height="40" rx="4" fill="#2b2f37" />
      <rect x="340" y="480" width="50" height="13" fill="#7fd1ae" />
      <g fill="#9aa1ad">
        <rect v-for="x in [342, 354, 366, 378]" :key="x" :x="x" y="499" width="8" height="8" rx="1" />
      </g>
    </svg>
    <p class="bgr-shop-talk">{{ $t('shop.welcome') }}</p>
  </div>
</template>
