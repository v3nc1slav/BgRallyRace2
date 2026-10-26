<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import GarageCar from './GarageCar.vue';
import GarageDecor from './GarageDecor.vue';
import PartIcon from './PartIcon.vue';
import { ROLL } from './garageGeometry';
import { ask, tell } from '../dialog';
import { money } from '../format';
import type { Garage, StorageItem } from '../game';
import { t } from '../i18n';

const props = defineProps<{ garage: Garage; level: number; cash: number; busy: boolean }>();
const emit = defineEmits<{ upgrade: []; activate: [id: number]; repair: [id: number]; mount: [id: number] }>();
const router = useRouter();

const W = 1000;
const H = 680;
const CAR = { x: 300, y: 405, scale: 1.2 };
const FLOOR = 598;
const place = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

function toScene(x: number, y: number) {
  const angle = (ROLL.angle * Math.PI) / 180;
  const dx = x - ROLL.x;
  const dy = y - ROLL.y;
  return {
    x: CAR.x + (ROLL.x + dx * Math.cos(angle) - dy * Math.sin(angle)) * CAR.scale,
    y: CAR.y + (ROLL.y + dx * Math.sin(angle) + dy * Math.cos(angle)) * CAR.scale,
  };
}

const root = ref<HTMLElement>();
const compact = ref(false);
const scale = ref(1);
let observer: ResizeObserver | null = null;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    compact.value = entry.contentRect.width < 640;
    scale.value = entry.contentRect.width / W;
  });
  if (root.value) {
    observer.observe(root.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

const level = computed(() => props.garage.garage.level);
const COLORS = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#e9c46a', '#8338ec', '#06d6a0', '#ef476f'];

function colorOf(name: string) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

const lamps = computed(() => (level.value >= 4 ? [470, 630, 790] : level.value >= 2 ? [480, 700] : [520]));

const TYRE_COLORS: Record<string, string> = { asphalt_dry: '#aab1bc', asphalt_wet: '#3a86ff', gravel: '#c58b4a', snow: '#eef4ff' };
const storedTyres = computed(() => props.garage.storage.filter((item) => item.kind !== 'part'));
const rackRows = computed(() => Math.min(5, Math.max(1, level.value)));
const rackTyres = computed(() => storedTyres.value.flatMap((item) => Array<StorageItem>(item.kind === 'tyre' ? 4 : 1).fill(item)));
const rackSlots = computed(() => {
  const slots: { x: number; y: number; item: StorageItem | null }[] = [];
  for (let row = 0; row < rackRows.value; row++) {
    for (let col = 0; col < 4; col++) {
      slots.push({ x: 42 + col * 38, y: 526 - row * 72, item: rackTyres.value[row * 4 + col] ?? null });
    }
  }
  return slots;
});
const rackTop = computed(() => 588 - rackRows.value * 72 - 6);
const rackExtra = computed(() => Math.max(0, rackTyres.value.length - rackRows.value * 4));

const SHELVES = [256, 190, 124];
const storedParts = computed(() => props.garage.storage.filter((item) => item.kind === 'part'));
const shelfRows = computed(() => [1, 2, 2, 3, 3][Math.min(5, level.value) - 1] ?? 1);
const shelfItems = computed(() => {
  const list: { x: number; y: number; item: StorageItem }[] = [];
  storedParts.value.slice(0, shelfRows.value * 9).forEach((item, index) => {
    const row = Math.floor(index / 9);
    list.push({ x: 306 + (index % 9) * 36, y: SHELVES[row] - 26, item });
  });
  return list;
});
const shelfExtra = computed(() => Math.max(0, storedParts.value.length - shelfRows.value * 9));

const bayOpen = computed(() => props.garage.garage.car_slots >= 2);
const parked = computed(() => props.garage.cars.find((car) => !car.active) ?? null);

const next = computed(() => props.garage.garage.next);
const needs = computed(() =>
  next.value
    ? [
        { key: 'level', ok: props.level >= next.value.min_level, text: t('garage.scene.needLevel', { level: next.value.min_level, have: props.level }) },
        { key: 'money', ok: props.cash >= next.value.price, text: t('garage.scene.needMoney', { price: money(next.value.price), have: money(props.cash) }) },
        { key: 'permit', ok: props.garage.garage.permit, text: t('garage.scene.needPermit') },
      ]
    : [],
);
const ready = computed(() => needs.value.length > 0 && needs.value.every((need) => need.ok));
const showNeeds = ref(false);

async function upgrade() {
  if (!next.value || props.busy) {
    return;
  }
  if (!ready.value) {
    showNeeds.value = !showNeeds.value;
    return;
  }
  if (await ask(t('garage.scene.confirm', { level: next.value.level, price: money(next.value.price) }), { title: t('garage.scene.upgrade') })) {
    emit('upgrade');
  }
}

interface Balloon {
  key: string;
  anchor: { x: number; y: number };
  at: { x: number; y: number };
  label: string;
  value: string;
  short: string;
  detail: string;
  weak: boolean;
}

const PARTS: { type: string; anchor: [number, number]; at: { x: number; y: number } }[] = [
  { type: 'engine', anchor: [52, 66], at: { x: 245, y: 336 } },
  { type: 'turbo', anchor: [104, 82], at: { x: 425, y: 330 } },
  { type: 'suspension', anchor: [70, 84], at: { x: 250, y: 642 } },
  { type: 'gearbox', anchor: [138, 118], at: { x: 410, y: 650 } },
  { type: 'chassis', anchor: [205, 124], at: { x: 570, y: 650 } },
  { type: 'brakes', anchor: [271, 95], at: { x: 730, y: 642 } },
];

const slot = (type: string) => props.garage.slots.find((item) => item.type === type) ?? null;
const percent = (value: number) => `${Math.round(value)}%`;

function statLine(type: string) {
  const car = props.garage.car;
  if (!car) {
    return '';
  }
  const stats: Record<string, string> = {
    engine: `${car.stats.power} ${t('stats.hp')}`,
    gearbox: `${t('stats.reliability').toLowerCase()} ${car.stats.reliability}`,
    suspension: `${t('stats.handling').toLowerCase()} ${car.stats.handling}`,
    brakes: `${t('stats.braking').toLowerCase()} ${car.stats.braking}`,
  };
  return stats[type] ?? slot(type)?.item?.name ?? '';
}

const balloons = computed<Balloon[]>(() => {
  if (!props.garage.car) {
    return [];
  }
  const parts = PARTS.map(({ type, anchor, at }): Balloon => {
    const found = slot(type);
    const health = found?.item?.health ?? null;
    return {
      key: type,
      anchor: toScene(anchor[0], anchor[1]),
      at,
      label: found?.label ?? type,
      value: health === null ? t('garage.missing') : percent(health),
      short: `${t(`garage.scene.short.${type}`)} ${health === null ? '✗' : percent(health)}`,
      detail: statLine(type),
      weak: health === null || health < 30,
    };
  });
  const tyre = props.garage.tyre;
  parts.push({
    key: 'tyres',
    anchor: toScene(270, 138),
    at: { x: 890, y: 645 },
    label: t('garage.tyres'),
    value: tyre ? percent(tyre.health) : t('garage.missing'),
    short: `${t('garage.scene.short.tyres')} ${tyre ? percent(tyre.health) : '✗'}`,
    detail: tyre ? `${tyre.type_label} · ${tyre.compound_label}` : '',
    weak: !tyre || tyre.health < 30,
  });
  return parts;
});

const opened = ref('');

async function pick(balloon: Balloon) {
  if (compact.value && opened.value !== balloon.key) {
    opened.value = balloon.key;
    return;
  }
  opened.value = '';
  if (balloon.key === 'tyres') {
    tell(t('garage.scene.tyresHint'), { title: t('garage.tyres') });
    return;
  }
  const found = slot(balloon.key);
  const item = found?.item;
  if (!found || !item) {
    tell(t('garage.scene.missingPart', { part: found?.label.toLowerCase() ?? balloon.key }), { title: found?.label });
    return;
  }
  if (!item.can_repair) {
    tell(t('garage.scene.noRepair', { name: item.name, pct: percent(item.health) }), { title: found.label });
    return;
  }
  if (await ask(t('garage.scene.repairConfirm', { name: item.name, pct: percent(item.health), cost: money(item.repair_cost), energy: props.garage.energy_costs.repair }), { title: t('garage.scene.repairTitle'), ok: t('garage.scene.repairOk') })) {
    emit('repair', item.id);
  }
}

async function mount(item: StorageItem) {
  listing.value = '';
  if (item.spare) {
    tell(t('garage.scene.spareTyre', { name: item.name }), { title: t('garage.tyres') });
    return;
  }
  if (!item.compatible) {
    tell(t('garage.scene.wrongClass', { name: item.name }), { title: item.type_label });
    return;
  }
  const current = item.kind === 'part' ? slot(item.type)?.item?.name : props.garage.tyre?.name;
  const energy = item.kind === 'part' ? props.garage.energy_costs.mount : props.garage.energy_costs.tyres;
  const text = current
    ? t('garage.scene.swapConfirm', { old: current, name: item.name, energy })
    : t('garage.scene.putConfirm', { name: item.name, energy });
  if (await ask(text, { title: t('garage.scene.swapTitle'), ok: t('garage.scene.swapOk') })) {
    emit('mount', item.id);
  }
}

const listing = ref<'' | 'parts' | 'tyres'>('');
const listed = computed(() => (listing.value === 'parts' ? storedParts.value : listing.value === 'tyres' ? storedTyres.value : []));

function choose(kind: 'parts' | 'tyres', item: StorageItem | null) {
  if (compact.value || !item) {
    listing.value = listing.value === kind ? '' : kind;
    return;
  }
  mount(item);
}

const jack = computed(() => {
  const top = toScene(104, 104);
  return { x: top.x, top: top.y, mid: (top.y + FLOOR) / 2 };
});
const trunk = computed(() => ({ anchor: toScene(296, 44), at: { x: 728, y: 336 } }));

function showTrophies() {
  const count = (place: number) => props.garage.trophies.filter((trophy) => trophy.place === place).length;
  tell(props.garage.trophies.length ? t('garage.scene.trophiesSummary', { wins: count(1), second: count(2), third: count(3) }) : t('garage.scene.trophiesEmpty'), { title: t('garage.scene.trophies') });
}
</script>

<template>
  <div ref="root" class="bgr-garage" :class="{ 'bgr-garage-compact': compact }" :style="{ '--gs': scale }">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="$t('garage.scene.label')">
      <defs>
        <linearGradient id="bgr-gs-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff3c4" stop-opacity="0.35" />
          <stop offset="1" stop-color="#fff3c4" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="bgr-gs-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.12" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" :width="W" :height="H" fill="#2a2e36" />
      <rect x="0" y="34" :width="W" height="412" :fill="level >= 3 ? '#454c59' : '#3d424c'" />
      <g opacity="0.25" stroke="#1f232a" stroke-width="2">
        <line v-for="x in [125, 250, 375, 500, 625, 750, 875]" :key="x" :x1="x" y1="34" :x2="x" y2="446" />
        <line v-if="level < 3" x1="0" y1="240" :x2="W" y2="240" />
      </g>
      <rect v-if="level >= 3" x="0" y="330" :width="W" height="10" fill="#e63946" opacity="0.8" />
      <rect x="0" y="0" :width="W" height="34" fill="#1c1f25" />
      <line v-for="x in [0, 200, 400, 600, 800]" :key="`beam-${x}`" :x1="x + 100" y1="0" :x2="x + 100" y2="34" stroke="#2b2f37" stroke-width="10" />
      <rect x="170" y="56" width="240" height="44" rx="6" fill="#15171c" stroke="#e63946" stroke-width="3" />

      <polygon :points="`0,446 1000,446 1000,${H} 0,${H}`" :fill="level >= 4 ? '#4a5160' : level >= 2 ? '#646a73' : '#5b5f66'" />
      <g v-if="level >= 2 && level < 4" stroke="#50555d" stroke-width="2">
        <line v-for="y in [470, 504, 550, 612]" :key="`tile-${y}`" x1="0" :y1="y" :x2="W" :y2="y" />
        <line v-for="x in [-400, -200, 0, 200, 400, 600, 800, 1000, 1200, 1400]" :key="`ray-${x}`" :x1="500 + (x - 500) * 0.35" y1="446" :x2="x" :y2="H" />
      </g>
      <g v-if="level >= 4">
        <rect x="0" y="446" :width="W" :height="H - 446" fill="url(#bgr-gs-gloss)" />
        <line x1="24" y1="664" x2="976" y2="664" stroke="#f4d35e" stroke-width="5" stroke-dasharray="26 14" />
      </g>
      <g v-if="level === 1" stroke="#4a4e55" stroke-width="2" fill="none">
        <path d="M120 470 l30 14 l18 -6 l26 20" />
        <path d="M760 520 l-24 18 l10 22" />
        <ellipse cx="600" cy="640" rx="46" ry="9" fill="#3f4248" stroke="none" opacity="0.7" />
      </g>
      <rect x="0" y="440" :width="W" height="8" fill="#23262d" />

      <g v-for="x in lamps" :key="`lamp-${x}`">
        <line :x1="x" y1="34" :x2="x" y2="58" stroke="#111" stroke-width="2" />
        <polygon :points="`${x - 20},72 ${x + 20},72 ${x + 12},58 ${x - 12},58`" fill="#30343c" />
        <ellipse :cx="x" cy="72" rx="12" ry="4" fill="#fff3c4" />
        <polygon :points="`${x - 14},74 ${x + 14},74 ${x + 170},590 ${x - 170},590`" fill="url(#bgr-gs-light)" />
      </g>

      <g v-if="garage.garage.security">
        <path d="M52 34 L56 48" stroke="#111" stroke-width="3" />
        <rect x="42" y="46" width="34" height="16" rx="4" fill="#d7dbe0" transform="rotate(14 59 54)" />
        <circle cx="74" cy="60" r="4" fill="#15171c" />
        <circle class="bgr-gs-led" cx="50" cy="52" r="2.5" fill="#ff4d4d" />
      </g>

      <GarageDecor layer="wall" :level="level" :trophies="garage.trophies" @trophies="showTrophies" />

      <g v-if="level >= 2">
        <rect x="212" y="140" width="80" height="150" rx="4" fill="#8b6f4e" />
        <g fill="#6b543b">
          <circle v-for="index in 24" :key="`hole-${index}`" :cx="224 + ((index - 1) % 6) * 11" :cy="152 + Math.floor((index - 1) / 6) * 34" r="2" />
        </g>
        <path d="M226 170 l0 50 M220 170 l12 0" stroke="#c5cbd3" stroke-width="5" stroke-linecap="round" />
        <path d="M252 168 l0 56" stroke="#c5cbd3" stroke-width="4" stroke-linecap="round" />
        <circle cx="252" cy="166" r="7" fill="none" stroke="#c5cbd3" stroke-width="4" />
        <path d="M276 172 l0 44 M268 172 l16 0 l0 10 l-16 0 z" stroke="#e63946" stroke-width="4" fill="#e63946" />
        <path d="M222 250 l60 0" stroke="#3a3f47" stroke-width="5" />
        <circle cx="236" cy="268" r="9" fill="none" stroke="#f4d35e" stroke-width="4" />
        <rect x="256" y="258" width="26" height="20" rx="3" fill="#457b9d" />
      </g>

      <g>
        <g v-for="row in shelfRows" :key="`shelf-${row}`">
          <rect x="300" :y="SHELVES[row - 1]" width="334" height="7" fill="#a0784f" />
          <path :d="`M310 ${SHELVES[row - 1] + 7} l0 14 l14 -14 M624 ${SHELVES[row - 1] + 7} l0 14 l-14 -14`" stroke="#6b543b" stroke-width="3" fill="none" />
        </g>
        <g
          v-for="entry in shelfItems"
          :key="`part-${entry.item.id}`"
          class="bgr-gs-hot bgr-gs-box"
          :class="{ 'bgr-gs-dim': !entry.item.compatible }"
          role="button"
          tabindex="0"
          @click="choose('parts', entry.item)"
          @keydown.enter="choose('parts', entry.item)"
        >
          <title>{{ entry.item.name }} · {{ Math.round(entry.item.health) }}%</title>
          <rect :x="entry.x - 2" :y="entry.y - 2" width="34" height="30" fill="transparent" />
          <PartIcon :type="entry.item.type" :x="entry.x" :y="entry.y" />
        </g>
      </g>

      <g v-if="bayOpen">
        <line x1="652" y1="444" x2="804" y2="444" stroke="#f4d35e" stroke-width="3" stroke-dasharray="10 8" />
        <g
          v-if="parked"
          class="bgr-gs-hot bgr-gs-parked"
          role="button"
          tabindex="0"
          transform="translate(658 382) scale(0.42)"
          @click="emit('activate', parked.player_car_id)"
          @keydown.enter="emit('activate', parked.player_car_id)"
        >
          <title>{{ $t('garage.scene.parked', { name: parked.name }) }}</title>
          <GarageCar :color="colorOf(parked.name)" />
        </g>
      </g>

      <g>
        <rect x="32" :y="rackTop" width="6" :height="588 - rackTop + 8" fill="#9aa1ad" />
        <rect x="192" :y="rackTop" width="6" :height="588 - rackTop + 8" fill="#9aa1ad" />
        <rect x="32" :y="rackTop" width="166" height="6" fill="#9aa1ad" />
        <g v-for="row in rackRows" :key="`bar-${row}`">
          <rect x="32" :y="588 - (row - 1) * 72" width="166" height="6" fill="#7d8590" />
        </g>
        <g v-for="(tyreSlot, index) in rackSlots" :key="`tyre-${index}`">
          <g
            v-if="tyreSlot.item"
            class="bgr-gs-hot bgr-gs-tyre"
            :class="{ 'bgr-gs-dim': tyreSlot.item.spare }"
            role="button"
            tabindex="0"
            @click="choose('tyres', tyreSlot.item)"
            @keydown.enter="choose('tyres', tyreSlot.item)"
          >
            <title>{{ tyreSlot.item.name }} · {{ Math.round(tyreSlot.item.health) }}%</title>
            <rect :x="tyreSlot.x" :y="tyreSlot.y" width="32" height="62" rx="10" fill="#16171b" />
            <path :d="`M${tyreSlot.x + 5} ${tyreSlot.y + 10} h22 M${tyreSlot.x + 5} ${tyreSlot.y + 50} h22`" stroke="#2c2f36" stroke-width="3" />
            <rect :x="tyreSlot.x + 3" :y="tyreSlot.y + 27" width="26" height="8" rx="2" :fill="TYRE_COLORS[tyreSlot.item.type] ?? '#aab1bc'" />
          </g>
        </g>
      </g>

      <g class="bgr-gs-hot" role="button" tabindex="0" @click="router.push('/garage/staff')" @keydown.enter="router.push('/garage/staff')">
        <title>{{ $t('garage.staff') }}</title>
        <rect x="834" y="188" width="124" height="258" fill="#1c1f25" />
        <rect x="842" y="196" width="108" height="248" fill="#59606b" />
        <rect x="858" y="212" width="76" height="56" rx="3" fill="#9fc3d8" opacity="0.75" />
        <line x1="896" y1="212" x2="896" y2="268" stroke="#59606b" stroke-width="4" />
        <rect x="850" y="292" width="92" height="4" fill="#4b525c" />
        <rect x="850" y="392" width="92" height="4" fill="#4b525c" />
        <rect x="928" y="326" width="8" height="24" rx="3" fill="#d7dbe0" />
        <rect x="826" y="442" width="140" height="6" fill="#2b2f37" />
      </g>

      <GarageDecor layer="floor" :level="level" :trophies="garage.trophies" />

      <ellipse :cx="CAR.x + 210" :cy="FLOOR" rx="230" ry="12" fill="#000" opacity="0.3" />
      <g v-if="garage.car" :transform="`translate(${CAR.x} ${CAR.y}) scale(${CAR.scale})`">
        <GarageCar :color="colorOf(garage.car.name)" :livery="garage.livery" :number="garage.car.class" open lifted />
      </g>
      <g v-if="garage.car">
        <rect :x="jack.x - 22" :y="FLOOR - 6" width="44" height="7" rx="2" fill="#30343c" />
        <path :d="`M${jack.x} ${FLOOR - 6} L${jack.x - 15} ${jack.mid} L${jack.x} ${jack.top + 6} L${jack.x + 15} ${jack.mid} Z`" fill="none" stroke="#e63946" stroke-width="4" stroke-linejoin="round" />
        <path :d="`M${jack.x - 15} ${jack.mid} L${jack.x + 15} ${jack.mid} l22 12`" stroke="#9aa1ad" stroke-width="2.5" />
        <rect :x="jack.x - 12" :y="jack.top" width="24" height="7" rx="2" fill="#30343c" />
      </g>

      <g v-for="balloon in balloons" :key="`line-${balloon.key}`" class="bgr-gs-leader">
        <line :x1="balloon.anchor.x" :y1="balloon.anchor.y" :x2="balloon.at.x" :y2="balloon.at.y" />
        <circle :cx="balloon.anchor.x" :cy="balloon.anchor.y" r="4" />
      </g>
      <g v-if="garage.car" class="bgr-gs-leader">
        <line :x1="trunk.anchor.x" :y1="trunk.anchor.y" :x2="trunk.at.x" :y2="trunk.at.y" />
        <circle :cx="trunk.anchor.x" :cy="trunk.anchor.y" r="4" />
      </g>
    </svg>

    <div class="bgr-gs-layer">
      <div class="bgr-gs-sign" :style="place(290, 78)">{{ $t('garage.scene.sign', { level }) }}</div>
      <button class="bgr-gs-door" :style="place(896, 168)" @click="router.push('/garage/staff')">{{ $t('garage.scene.staff') }}</button>
      <button v-if="rackExtra" class="bgr-gs-extra" :style="place(115, rackTop - 18)" @click="listing = 'tyres'">+{{ rackExtra }}</button>
      <button v-if="shelfExtra" class="bgr-gs-extra" :style="place(648, SHELVES[shelfRows - 1] - 34)" @click="listing = 'parts'">+{{ shelfExtra }}</button>

      <template v-if="next">
        <button
          class="bgr-gs-up"
          :class="{ ready }"
          :style="place(946, 72)"
          :aria-label="$t('garage.scene.upgrade')"
          :title="$t('garage.scene.upgrade')"
          :disabled="busy"
          @click="upgrade"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 8h-4v8H9v-8H5z" /></svg>
        </button>
        <div v-if="showNeeds" class="bgr-gs-needs">
          <b>{{ $t('garage.scene.nextLevel', { level: next.level }) }}</b>
          <small v-if="next.unlocks" class="bgr-muted">{{ $t('garage.unlocks', { list: next.unlocks }) }}</small>
          <ul>
            <li v-for="need in needs" :key="need.key" :class="need.ok ? 'bgr-ok' : 'bgr-error'">{{ need.ok ? '✓' : '✗' }} {{ need.text }}</li>
          </ul>
          <RouterLink v-if="!garage.garage.permit" to="/city/hall">{{ $t('garage.scene.toHall') }}</RouterLink>
          <button class="bgr-small bgr-secondary" @click="showNeeds = false">{{ $t('garage.scene.close') }}</button>
        </div>
      </template>

      <div v-if="listing" class="bgr-gs-needs bgr-gs-list">
        <b>{{ listing === 'parts' ? $t('garage.scene.shelves') : $t('garage.scene.rack') }}</b>
        <button v-for="item in listed" :key="item.id" class="bgr-gs-item" :class="{ 'bgr-gs-dim': !item.compatible || item.spare }" :disabled="busy" @click="mount(item)">
          <span>{{ item.name }}</span>
          <small>{{ item.type_label }} · {{ Math.round(item.health) }}%</small>
        </button>
        <button class="bgr-small bgr-secondary" @click="listing = ''">{{ $t('garage.scene.close') }}</button>
      </div>

      <button
        v-for="balloon in balloons"
        :key="balloon.key"
        class="bgr-gs-balloon"
        :class="{ weak: balloon.weak, open: opened === balloon.key }"
        :style="place(balloon.at.x, balloon.at.y)"
        :disabled="busy"
        @click="pick(balloon)"
      >
        <template v-if="compact && opened !== balloon.key">{{ balloon.short }}</template>
        <template v-else>
          <small>{{ balloon.label }}</small>
          <b>{{ balloon.value }}</b>
          <small v-if="balloon.detail">{{ balloon.detail }}</small>
        </template>
      </button>

      <div v-if="garage.car" class="bgr-gs-trunk" :style="place(trunk.at.x, trunk.at.y)">
        <template v-if="compact">{{ $t('garage.scene.trunkShort', { tyres: garage.spares.tyres, parts: garage.spares.parts }) }}</template>
        <template v-else>
          <small>{{ $t('garage.scene.trunk') }}</small>
          <span>{{ $t('garage.scene.trunkTake', { tyres: garage.spares.tyres, parts: garage.spares.parts }) }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
