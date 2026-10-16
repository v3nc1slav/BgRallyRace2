<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Feedback from '../components/Feedback.vue';
import StageMap from '../components/StageMap.vue';
import { date, duration, gap, money, when } from '../format';
import { doRecon, getRally, registerRally, saveStyles, type RallyDetail, type SpareSelection } from '../game';
import { useAction } from '../useAction';
import { statusLabels } from './rallyStatus';

const route = useRoute();
const rally = ref<RallyDetail | null>(null);
const styles = reactive<Record<string, string>>({});
const spares = reactive<SpareSelection>({ tyres: [], parts: [] });
const { busy, message, error, run } = useAction();
let timer: number | undefined;

const id = computed(() => Number(route.params.id));
const editable = computed(() => !!rally.value && (rally.value.can_register || rally.value.can_change_styles));
const watching = computed(() => !!rally.value && (rally.value.status === 'live' || rally.value.status === 'closed'));

function apply(data: RallyDetail, reset: boolean) {
  rally.value = data;
  if (!reset) {
    return;
  }
  for (const stage of data.stages) {
    styles[stage.id] = data.entry?.styles[stage.id] ?? 'normal';
  }
  spares.tyres = [...data.spares.selected.tyres];
  spares.parts = [...data.spares.selected.parts];
}

async function load(reset = false) {
  const data = await run(() => getRally(id.value));
  if (data) {
    apply(data.rally, reset);
  }
}

async function act(task: () => Promise<{ rally: RallyDetail; message: string }>) {
  const result = await run(task);
  if (result) {
    apply(result.rally, true);
    message.value = result.message;
  }
}

function toggle(list: number[], itemId: number, limit: number) {
  const index = list.indexOf(itemId);
  if (index >= 0) {
    list.splice(index, 1);
  } else if (list.length < limit) {
    list.push(itemId);
  }
}

watch(watching, (on) => {
  window.clearInterval(timer);
  timer = on ? window.setInterval(() => load(), 10000) : undefined;
});

onMounted(() => load(true));
onBeforeUnmount(() => window.clearInterval(timer));
</script>

<template>
  <div v-if="rally" class="bgr-stack">
    <section class="bgr-card">
      <p><RouterLink to="/rallies">&larr; Всички ралита</RouterLink></p>
      <h1>
        {{ rally.name }}
        <span class="bgr-status" :class="rally.status">{{ statusLabels[rally.status] }}</span>
      </h1>
      <p class="bgr-muted">
        {{ when(rally.start_at) }} · {{ rally.city }}
        <span v-if="rally.home" class="bgr-tag">домакин</span>
      </p>
      <dl class="bgr-stats-list">
        <dt>Прогноза</dt>
        <dd>{{ rally.weather ?? 'ще разбереш след тренировката' }}</dd>
        <dt>Записване до</dt>
        <dd>{{ when(rally.deadline) }}</dd>
        <dt>Тренировка</dt>
        <dd>{{ date(rally.recon_date) }}</dd>
        <dt>Разстояние</dt>
        <dd>{{ rally.stages.length }} етапа, {{ rally.total_km }} км</dd>
      </dl>

      <Feedback :message="message" :error="error" />

      <div v-if="rally.can_register" class="bgr-panel">
        <p>
          Такса {{ money(rally.costs.entry_fee) }} + път {{ money(rally.costs.travel) }} + гориво {{ money(rally.costs.fuel) }} =
          <b>{{ money(rally.costs.total) }}</b>
        </p>
        <p class="bgr-muted">Преди записване избери стила за всеки етап и резервните по-долу.</p>
        <button :disabled="busy" @click="act(() => registerRally(rally!.id, styles, spares))">Запиши се</button>
      </div>

      <div v-if="rally.entry" class="bgr-panel">
        <p>Записан си със стартов номер <b>{{ rally.entry.start_number }}</b>. Платено: {{ money(rally.entry.costs) }}.</p>
        <p v-if="rally.entry.recon" class="bgr-ok">Тренировката е направена.</p>
        <button v-else-if="rally.can_recon" :disabled="busy" @click="act(() => doRecon(rally!.id))">Направи тренировка (енергия и гориво)</button>
        <p v-else-if="rally.status === 'open' || rally.status === 'closed'" class="bgr-muted">Тренировката е в деня преди ралито: {{ date(rally.recon_date) }}.</p>
      </div>
    </section>

    <section class="bgr-card">
      <h2>Етапи</h2>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead>
            <tr><th>#</th><th>Етап</th><th>Настилка</th><th>Характер</th><th>Трудност</th><th v-if="editable || rally.entry">Стил</th></tr>
          </thead>
          <tbody>
            <tr v-for="(stage, index) in rally.stages" :key="stage.id">
              <td>{{ index + 1 }}</td>
              <td>{{ stage.name }}<small class="bgr-muted">{{ stage.length_km }} км · {{ stage.turns }} завоя</small></td>
              <td>{{ stage.surface_label }}</td>
              <td>{{ stage.profile_label }}</td>
              <td>{{ stage.difficulty }}/10</td>
              <td v-if="editable || rally.entry">
                <select v-model="styles[stage.id]" :disabled="!editable">
                  <option v-for="(label, key) in rally.style_options" :key="key" :value="key">{{ label }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template v-if="editable || rally.entry">
        <h2>Резервни</h2>
        <p class="bgr-muted">
          Спукана гума без резервна или счупена част без резервна означава отпадане. При дъжд или сняг екипажът сменя гумите само ако носи 4 подходящи резервни.
        </p>
        <div class="bgr-columns">
          <div>
            <h3>Гуми {{ spares.tyres.length }}/{{ rally.spares.capacity.tyres }}</h3>
            <p v-if="!rally.spares.tyres.length" class="bgr-muted">Нямаш резервни гуми. Купи единични гуми от магазина.</p>
            <label v-for="tyre in rally.spares.tyres" :key="tyre.id" class="bgr-check">
              <input
                type="checkbox"
                :checked="spares.tyres.includes(tyre.id)"
                :disabled="!editable || (!spares.tyres.includes(tyre.id) && spares.tyres.length >= rally.spares.capacity.tyres)"
                @change="toggle(spares.tyres, tyre.id, rally.spares.capacity.tyres)"
              />
              {{ tyre.name }} <small class="bgr-muted">{{ tyre.health }}%</small>
            </label>
          </div>
          <div>
            <h3>Части {{ spares.parts.length }}/{{ rally.spares.capacity.parts }}</h3>
            <p v-if="!rally.spares.capacity.parts" class="bgr-muted">Резервни части се носят от гараж ниво 2.</p>
            <p v-else-if="!rally.spares.parts.length" class="bgr-muted">В склада няма подходящи части.</p>
            <label v-for="part in rally.spares.parts" :key="part.id" class="bgr-check">
              <input
                type="checkbox"
                :checked="spares.parts.includes(part.id)"
                :disabled="!editable || (!spares.parts.includes(part.id) && spares.parts.length >= rally.spares.capacity.parts)"
                @change="toggle(spares.parts, part.id, rally.spares.capacity.parts)"
              />
              {{ part.name }} <small class="bgr-muted">{{ part.type_label }}, {{ part.health }}%</small>
            </label>
          </div>
        </div>
      </template>

      <button v-if="rally.entry && rally.can_change_styles" class="bgr-small" :disabled="busy" @click="act(() => saveStyles(rally!.id, styles, spares))">
        Запази стила и резервните
      </button>
    </section>

    <section v-if="rally.broadcast" class="bgr-card">
      <h2>{{ rally.broadcast.state === 'finished' ? 'Резултати' : 'Предаване на живо' }}</h2>
      <p v-if="rally.broadcast.state === 'waiting'" class="bgr-muted">Предаването започва в {{ when(rally.start_at) }}.</p>

      <StageMap v-if="rally.broadcast.timeline" :timeline="rally.broadcast.timeline" />

      <template v-if="rally.broadcast.state === 'live'">
        <span class="bgr-bar high"><span :style="{ width: `${rally.broadcast.progress}%` }"></span><em>{{ rally.broadcast.progress }}%</em></span>
        <div v-for="group in rally.broadcast.table" :key="group.class" class="bgr-scroll">
          <h3>{{ group.label }}</h3>
          <table class="bgr-table">
            <thead><tr><th>#</th><th>Пилот</th><th>Етапи</th><th>Време</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(row, index) in group.rows" :key="row.team + index" :class="{ 'bgr-me': row.is_me }">
                <td>{{ index + 1 }}</td>
                <td>{{ row.pilot }}<small class="bgr-muted">{{ row.team }}</small></td>
                <td>{{ row.dns ? 'не стартира' : row.stages }}</td>
                <td>{{ row.stages ? duration(row.total_ms) : '' }}</td>
                <td class="bgr-muted">{{ row.stages === group.rows[0].stages ? gap(row.total_ms - group.rows[0].total_ms) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-if="rally.broadcast.classification">
        <div v-for="group in rally.broadcast.classification" :key="group.class" class="bgr-scroll">
          <h3>{{ group.label }}</h3>
          <table class="bgr-table">
            <thead><tr><th>Място</th><th>Пилот</th><th>Време</th><th>Точки</th><th>Награда</th></tr></thead>
            <tbody>
              <tr v-for="row in group.rows" :key="row.place" :class="{ 'bgr-me': row.is_me }">
                <td>{{ row.place }}</td>
                <td>{{ row.pilot }}<small class="bgr-muted">{{ row.team }}</small></td>
                <td>{{ row.status === 'finished' ? duration(row.total_ms) : 'отпадна' }}</td>
                <td>{{ row.points || '' }}</td>
                <td>{{ row.prize ? money(row.prize) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-if="rally.broadcast.events?.length">
        <h3>Хроника</h3>
        <ul class="bgr-chronicle">
          <li v-for="(event, index) in rally.broadcast.events" :key="index" :class="event.type">{{ event.text }}</li>
        </ul>
      </template>
    </section>

    <section v-if="rally.start_list.length" class="bgr-card">
      <h2>Стартов списък</h2>
      <ol class="bgr-start-list">
        <li v-for="row in rally.start_list" :key="row.start_number" :class="{ 'bgr-me': row.is_me }">
          <b>{{ row.start_number }}</b> {{ row.team }} <small class="bgr-muted">{{ row.class_label }}</small>
        </li>
      </ol>
    </section>
  </div>
  <section v-else class="bgr-card">
    <Feedback :error="error" />
  </section>
</template>
