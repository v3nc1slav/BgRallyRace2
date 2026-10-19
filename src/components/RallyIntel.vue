<script setup lang="ts">
import { ref, watch } from 'vue';
import { money, stamp } from '../format';
import type { RallyIntel } from '../game';

const props = defineProps<{ intel: RallyIntel; busy: boolean }>();
const emit = defineEmits<{ sabotage: [targetId: number, kind: string] }>();
const target = ref(0);
const kind = ref('tyres');

watch(
  () => props.intel.sabotage?.targets,
  (targets) => {
    if (targets && !targets.some((t) => t.id === target.value)) {
      target.value = targets[0]?.id ?? 0;
    }
  },
  { immediate: true },
);

function order() {
  const team = props.intel.sabotage?.targets.find((t) => t.id === target.value)?.team;
  if (team && window.confirm(`Да поръчаш ли саботаж срещу ${team}? Ако полицията хване саботьора, последиците са тежки.`)) {
    emit('sabotage', target.value, kind.value);
  }
}
</script>

<template>
  <section class="bgr-card">
    <h2>Разузнаване и саботаж</h2>

    <template v-if="intel.informant">
      <h3>Информатор {{ intel.informant.name }} <small class="bgr-muted">умение {{ intel.informant.skill }}</small></h3>
      <div v-for="(warning, index) in intel.warnings" :key="index" class="bgr-panel">
        <p class="bgr-error">Готви се саботаж срещу колата ти ({{ stamp(warning.at) }}).</p>
        <template v-if="warning.suspects">
          <p class="bgr-muted">Заподозрени:</p>
          <ul>
            <li v-for="suspect in warning.suspects" :key="suspect.team">{{ suspect.team }} – {{ suspect.chance }}%</li>
          </ul>
        </template>
        <p v-else class="bgr-muted">Информаторът не знае кой стои зад това.</p>
      </div>

      <template v-if="intel.scouting">
        <p v-if="!intel.scouting.length" class="bgr-muted">Няма други отбори от твоя клас.</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>Отбор</th><th>Кола и гуми</th><th>Части</th><th>Екипаж</th></tr>
            </thead>
            <tbody>
              <tr v-for="report in intel.scouting" :key="report.team">
                <td>{{ report.team }}</td>
                <td>
                  {{ report.car }}
                  <small v-if="report.tyre" class="bgr-muted">{{ report.tyre.name }} · {{ report.tyre.health }}%</small>
                </td>
                <td>
                  <template v-if="report.parts">
                    <small v-for="part in report.parts" :key="part.label" class="bgr-muted">{{ part.label }}: {{ part.health }}%</small>
                  </template>
                  <small v-else class="bgr-muted">по-опитен информатор ще ги научи</small>
                </td>
                <td>
                  <template v-if="report.crew">пилот {{ report.crew.pilot }}, навигатор {{ report.crew.navigator }}</template>
                  <small v-else class="bgr-muted">по-опитен информатор ще го научи</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <template v-if="intel.sabotage">
      <h3>Саботьор {{ intel.sabotage.saboteur.name }} <small class="bgr-muted">умение {{ intel.sabotage.saboteur.skill }}</small></h3>
      <ul v-if="intel.sabotage.orders.length">
        <li v-for="(item, index) in intel.sabotage.orders" :key="index">
          {{ item.kind_label }} срещу {{ item.team }} – {{ item.status_label.toLowerCase() }}
          <span v-if="item.caught" class="bgr-error">· полицията го хвана</span>
        </li>
      </ul>
      <p v-if="!intel.sabotage.open" class="bgr-muted">Саботаж се поръчва, докато записването е отворено.</p>
      <p v-else-if="intel.sabotage.used_week" class="bgr-muted">Саботьорът вече има поръчка тази седмица.</p>
      <p v-else-if="!intel.sabotage.targets.length" class="bgr-muted">
        Няма подходяща цел: друг отбор от твоя клас, не повече от {{ intel.sabotage.level_gap }} нива под теб.
      </p>
      <form v-else class="bgr-form" @submit.prevent="order">
        <label>
          Цел
          <select v-model.number="target">
            <option v-for="item in intel.sabotage.targets" :key="item.id" :value="item.id">{{ item.team }} (ниво {{ item.level }})</option>
          </select>
        </label>
        <label>
          Вид
          <select v-model="kind">
            <option v-for="(label, key) in intel.sabotage.kinds" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <p class="bgr-muted">
          „Гуми“ – гумите на целта губят част от състоянието си. „Двигател“ – по-голям шанс за повреда в ралито.
          Охраната и информаторът на целта намаляват шанса за успех.
        </p>
        <button :disabled="busy">Поръчай ({{ money(intel.sabotage.cost) }}, {{ intel.sabotage.energy }} енергия)</button>
      </form>
    </template>
  </section>
</template>
