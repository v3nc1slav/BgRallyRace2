<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Leg, Timeline } from '../game';
import type { StageView } from '../race';
import { darkness } from '../scenes/map/effects';
import type { CameraMode, CarMarker, Weather } from '../scenes/RaceScene';

const props = defineProps<{ timeline: Timeline }>();

const REPLAY_SECONDS = 180;

const container = ref<HTMLElement>();
const replaying = ref(false);
const manualSeq = ref<number | null>(null);
const currentSeq = ref(1);
const camera = ref<CameraMode>('all');
const hasMe = computed(() => props.timeline.crews.some((crew) => crew.is_me));

watch(camera, (mode) => view?.setCamera(mode));

function weatherAt(t: number): Weather {
  const { start, change } = props.timeline.weather;
  return change && t >= change.at ? change.to : start;
}
let view: StageView | null = null;
let frame = 0;
let fetchedAt = performance.now();
let lastFrame = performance.now();
let replayTime = 0;
let unmounted = false;

const medians = computed(() => {
  const result: Record<number, number> = {};
  for (const stage of props.timeline.stages) {
    const drives = props.timeline.crews
      .map((crew) => crew.legs[stage.seq])
      .filter((leg): leg is Leg => !!leg && leg.end !== null && !leg.stop)
      .map((leg) => leg.end! - leg.start - leg.pauses.reduce((sum, [, dur]) => sum + dur, 0))
      .sort((a, b) => a - b);
    result[stage.seq] = drives.length ? drives[Math.floor(drives.length / 2)] : 600;
  }
  return result;
});

watch(
  () => props.timeline,
  () => {
    fetchedAt = performance.now();
  },
);

function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function now(timestamp: number) {
  const { duration, revealed, scale, finished } = props.timeline;
  if (replaying.value) {
    replayTime += ((timestamp - lastFrame) / 1000) * (duration / REPLAY_SECONDS);
    if (replayTime >= duration) {
      replaying.value = false;
    }
    return Math.min(replayTime, duration);
  }
  if (finished) {
    return duration;
  }
  return Math.min(duration, revealed + ((timestamp - fetchedAt) / 1000) * scale);
}

function driven(leg: Leg, until: number) {
  let time = until - leg.start;
  for (const [at, dur] of leg.pauses) {
    time -= Math.max(0, Math.min(until, at + dur) - Math.max(leg.start, at));
  }
  return Math.max(0, time);
}

function marker(leg: Leg, t: number, median: number): Omit<CarMarker, 'id' | 'number' | 'me'> | 'done' | null {
  if (t < leg.start) {
    return null;
  }
  if (leg.end !== null && !leg.stop && t >= leg.end) {
    return 'done';
  }

  const until = leg.end !== null ? Math.min(t, leg.end) : t;
  const total = leg.end !== null && !leg.stop ? Math.max(1, driven(leg, leg.end)) : median;
  const f = Math.min(leg.stop ? 0.98 : 1, driven(leg, until) / total);
  const paused = leg.pauses.some(([at, dur]) => t >= at && t < at + dur);
  const stopped = leg.stop && leg.end !== null && t >= leg.end;

  return { f, state: stopped ? 'stop' : paused ? 'pause' : 'run' };
}

function stageAt(t: number) {
  let seq = 1;
  for (const crew of props.timeline.crews) {
    for (const [key, leg] of Object.entries(crew.legs)) {
      if (leg.start <= t) {
        seq = Math.max(seq, Number(key));
      }
    }
  }
  return seq;
}

function render(timestamp: number) {
  const t = now(timestamp);
  lastFrame = timestamp;

  const seq = manualSeq.value ?? stageAt(t);
  currentSeq.value = seq;
  const stage = props.timeline.stages.find((item) => item.seq === seq);

  if (view && stage) {
    const cars: CarMarker[] = [];
    let done = 0;
    for (const crew of props.timeline.crews) {
      const leg = crew.legs[seq];
      const state = leg ? marker(leg, t, medians.value[seq]) : null;
      if (state === 'done') {
        done++;
      } else if (state) {
        cars.push({ id: crew.id, number: crew.number, me: crew.is_me, ...state });
      }
    }

    const running = cars.filter((car) => car.state !== 'stop').length;
    const caption = props.timeline.finished && !replaying.value
      ? 'Ралито приключи. Пусни повторението, за да го изгледаш отново.'
      : `Време от старта ${clock(t)} · на трасето ${running} · финиширали ${done}`;
    view.render(stage, cars, caption, { weather: weatherAt(t), darkness: darkness(props.timeline.start_at, t) });
  }

  frame = requestAnimationFrame(render);
}

function replay() {
  replayTime = 0;
  manualSeq.value = null;
  replaying.value = true;
}

onMounted(async () => {
  const { createStageView } = await import('../race');
  if (unmounted || !container.value) {
    return;
  }
  view = createStageView(container.value);
  window.setTimeout(() => view?.setCamera(camera.value), 300);
  frame = requestAnimationFrame(render);
});

onBeforeUnmount(() => {
  unmounted = true;
  cancelAnimationFrame(frame);
  view?.destroy();
});
</script>

<template>
  <div class="bgr-map">
    <div class="bgr-map-controls">
      <div class="bgr-tabs">
        <button :class="{ active: manualSeq === null }" @click="manualSeq = null">Авто</button>
        <button
          v-for="stage in timeline.stages"
          :key="stage.seq"
          :class="{ active: manualSeq === stage.seq || (manualSeq === null && currentSeq === stage.seq) }"
          @click="manualSeq = stage.seq"
        >
          Етап {{ stage.seq }}
        </button>
      </div>
      <div class="bgr-tabs">
        <button :class="{ active: camera === 'all' }" @click="camera = 'all'">Цял етап</button>
        <button v-if="hasMe" :class="{ active: camera === 'me' }" @click="camera = 'me'">Моята кола</button>
        <button :class="{ active: camera === 'leader' }" @click="camera = 'leader'">Лидер</button>
        <button v-if="timeline.finished" @click="replay">{{ replaying ? 'Отначало' : 'Повторение' }}</button>
        <button title="Отдалечи" @click="view?.zoomBy(0.8)">−</button>
        <button title="Приближи" @click="view?.zoomBy(1.25)">+</button>
      </div>
    </div>
    <div ref="container" class="bgr-race"></div>
  </div>
</template>
