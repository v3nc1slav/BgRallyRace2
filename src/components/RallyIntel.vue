<script setup lang="ts">
import { ref, watch } from 'vue';
import { ask } from '../dialog';
import { money, stamp } from '../format';
import type { RallyIntel } from '../game';
import { t as translate } from '../i18n';

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

async function order() {
  const team = props.intel.sabotage?.targets.find((t) => t.id === target.value)?.team;
  if (team && await ask(translate('intel.confirm', { team }))) {
    emit('sabotage', target.value, kind.value);
  }
}
</script>

<template>
  <section class="bgr-card">
    <h2>{{ $t('intel.title') }}</h2>

    <template v-if="intel.informant">
      <h3>{{ $t('intel.informant', { name: intel.informant.name }) }} <small class="bgr-muted">{{ $t('intel.skill', { skill: intel.informant.skill }) }}</small></h3>
      <div v-for="(warning, index) in intel.warnings" :key="index" class="bgr-panel">
        <p class="bgr-error">{{ $t('intel.warning', { time: stamp(warning.at) }) }}</p>
        <template v-if="warning.suspects">
          <p class="bgr-muted">{{ $t('intel.suspects') }}</p>
          <ul>
            <li v-for="suspect in warning.suspects" :key="suspect.team">{{ suspect.team }} – {{ suspect.chance }}%</li>
          </ul>
        </template>
        <p v-else class="bgr-muted">{{ $t('intel.unknown') }}</p>
      </div>

      <template v-if="intel.scouting">
        <p v-if="!intel.scouting.length" class="bgr-muted">{{ $t('intel.noRivals') }}</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>{{ $t('intel.team') }}</th><th>{{ $t('intel.carTyres') }}</th><th>{{ $t('intel.parts') }}</th><th>{{ $t('intel.crew') }}</th></tr>
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
                  <small v-else class="bgr-muted">{{ $t('intel.needSkill') }}</small>
                </td>
                <td>
                  <template v-if="report.crew">{{ $t('intel.crewLine', { pilot: report.crew.pilot, navigator: report.crew.navigator }) }}</template>
                  <small v-else class="bgr-muted">{{ $t('intel.needSkillCrew') }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <template v-if="intel.sabotage">
      <h3>{{ $t('intel.saboteur', { name: intel.sabotage.saboteur.name }) }} <small class="bgr-muted">{{ $t('intel.skill', { skill: intel.sabotage.saboteur.skill }) }}</small></h3>
      <ul v-if="intel.sabotage.orders.length">
        <li v-for="(item, index) in intel.sabotage.orders" :key="index">
          {{ $t('intel.order', { kind: item.kind_label, team: item.team, status: item.status_label.toLowerCase() }) }}
          <span v-if="item.caught" class="bgr-error">{{ $t('intel.caught') }}</span>
        </li>
      </ul>
      <p v-if="!intel.sabotage.open" class="bgr-muted">{{ $t('intel.closed') }}</p>
      <p v-else-if="intel.sabotage.used_week" class="bgr-muted">{{ $t('intel.used') }}</p>
      <p v-else-if="!intel.sabotage.targets.length" class="bgr-muted">
        {{ $t('intel.noTarget', { gap: intel.sabotage.level_gap }) }}
      </p>
      <form v-else class="bgr-form" @submit.prevent="order">
        <label>
          {{ $t('intel.target') }}
          <select v-model.number="target">
            <option v-for="item in intel.sabotage.targets" :key="item.id" :value="item.id">{{ $t('intel.targetLine', { team: item.team, level: item.level }) }}</option>
          </select>
        </label>
        <label>
          {{ $t('intel.kind') }}
          <select v-model="kind">
            <option v-for="(label, key) in intel.sabotage.kinds" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <p class="bgr-muted">{{ $t('intel.kindsHint') }}</p>
        <button :disabled="busy">{{ $t('intel.submit', { cost: money(intel.sabotage.cost), energy: intel.sabotage.energy }) }}</button>
      </form>
    </template>
  </section>
</template>
