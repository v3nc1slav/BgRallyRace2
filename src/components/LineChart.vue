<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  values: number[];
}

const props = defineProps<{ labels: string[]; titles: string[]; series: ChartSeries[]; format: (value: number) => string; detail?: (value: number) => string }>();

const HEIGHT = 240;
const box = ref<HTMLElement>();
const width = ref(600);
const active = ref<number | null>(null);
let observer: ResizeObserver | null = null;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = Math.max(280, Math.floor(entry.contentRect.width))));
  if (box.value) {
    observer.observe(box.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

function niceStep(value: number) {
  const power = 10 ** Math.floor(Math.log10(value));
  const ratio = value / power;
  return (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
}

const narrow = computed(() => width.value < 480);
const margin = computed(() => ({ top: 16, right: narrow.value ? 12 : 76, bottom: 28, left: narrow.value ? 60 : 72 }));
const count = computed(() => props.labels.length);
const peak = computed(() => Math.max(1, ...props.series.flatMap((s) => s.values)));
const tickStep = computed(() => niceStep(peak.value / 4));
const max = computed(() => Math.ceil(peak.value / tickStep.value) * tickStep.value);
const ticks = computed(() => Array.from({ length: Math.round(max.value / tickStep.value) + 1 }, (_, i) => i * tickStep.value));
const plotWidth = computed(() => width.value - margin.value.left - margin.value.right);
const plotHeight = HEIGHT - margin.value.top - margin.value.bottom;

const x = (i: number) => margin.value.left + (count.value <= 1 ? plotWidth.value / 2 : (i * plotWidth.value) / (count.value - 1));
const y = (value: number) => margin.value.top + plotHeight - (value / max.value) * plotHeight;

const paths = computed(() =>
  props.series.map((s) => ({ ...s, d: s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') })),
);

const labelStep = computed(() => Math.max(1, Math.ceil((count.value * 30) / Math.max(1, plotWidth.value))));
const showLabel = (i: number) => i % labelStep.value === 0 || i === count.value - 1;

const endLabels = computed(() => {
  const last = count.value - 1;
  const ends = props.series.map((s) => ({ key: s.key, name: s.name, y: y(s.values[last] ?? 0) }));
  const crowded = ends.some((a, i) => ends.some((b, j) => i < j && Math.abs(a.y - b.y) < 14));
  return last < 0 || crowded || narrow.value ? [] : ends;
});

const tipLeft = computed(() => {
  if (active.value === null) {
    return 0;
  }
  const left = x(active.value) + 12;
  return left + 190 > width.value ? x(active.value) - 202 : left;
});

function nearest(event: PointerEvent) {
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const ratio = (event.clientX - rect.left - margin.value.left) / Math.max(1, plotWidth.value);
  active.value = Math.min(count.value - 1, Math.max(0, Math.round(ratio * (count.value - 1))));
}

function step(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const current = active.value ?? count.value - 1;
    active.value = Math.min(count.value - 1, Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1)));
  }
}
</script>

<template>
  <div ref="box" class="bgr-chart">
    <div class="bgr-chart-legend">
      <span v-for="s in series" :key="s.key"><i :style="{ background: s.color }"></i>{{ s.name }}</span>
    </div>
    <div class="bgr-chart-plot">
      <svg
        :width="width"
        :height="HEIGHT"
        role="img"
        :aria-label="series.map((s) => s.name).join(' и ') + ' по ралита'"
        tabindex="0"
        @pointermove="nearest"
        @pointerleave="active = null"
        @keydown="step"
        @focus="active = count - 1"
        @blur="active = null"
      >
        <g class="bgr-chart-grid">
          <template v-for="tick in ticks" :key="tick">
            <line :x1="margin.left" :x2="width - margin.right" :y1="y(tick)" :y2="y(tick)" />
            <text :x="margin.left - 8" :y="y(tick)" text-anchor="end" dominant-baseline="middle">{{ format(tick) }}</text>
          </template>
          <template v-for="(label, i) in labels" :key="i">
            <text v-if="showLabel(i)" :x="x(i)" :y="HEIGHT - 8" text-anchor="middle">{{ label }}</text>
          </template>
        </g>
        <line v-if="active !== null" class="bgr-chart-cross" :x1="x(active)" :x2="x(active)" :y1="margin.top" :y2="margin.top + plotHeight" />
        <path v-for="p in paths" :key="p.key" :d="p.d" :stroke="p.color" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <g v-for="p in paths" :key="`${p.key}-dots`">
          <circle v-for="(v, i) in p.values" :key="i" :cx="x(i)" :cy="y(v)" :r="active === i ? 5 : 4" :fill="p.color" class="bgr-chart-dot" />
        </g>
        <g class="bgr-chart-grid">
          <text v-for="label in endLabels" :key="label.key" :x="width - margin.right + 10" :y="label.y" dominant-baseline="middle">{{ label.name }}</text>
        </g>
      </svg>
      <div v-if="active !== null" class="bgr-chart-tip" :style="{ left: `${tipLeft}px` }">
        <b>{{ titles[active] }}</b>
        <div v-for="s in series" :key="s.key">
          <i :style="{ background: s.color }"></i><strong>{{ (detail ?? format)(s.values[active] ?? 0) }}</strong> {{ s.name }}
        </div>
      </div>
    </div>
  </div>
</template>
