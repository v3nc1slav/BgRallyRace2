<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money } from '../format';
import { fireStaff, getGarage, mountItem, repairItem, setActiveCar, upgradeGarage, type CrewMember, type Garage, type Stats } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const garage = ref<Garage | null>(null);
const { busy, message, error, run } = useAction();

const statLabels = computed<Record<keyof Stats, string>>(() => ({
  power: t('stats.power'),
  handling: t('stats.handling'),
  braking: t('stats.braking'),
  reliability: t('stats.reliability'),
}));

onMounted(() =>
  run(async () => {
    garage.value = (await getGarage()).garage;
  }),
);

async function act(task: () => Promise<{ garage: Garage; message: string }>) {
  const result = await run(task);
  if (result) {
    garage.value = result.garage;
    message.value = result.message;
  }
}

function fire(member: CrewMember) {
  if (window.confirm(t('garage.fireConfirm', { name: member.name, role: member.role_label.toLowerCase() }))) {
    act(() => fireStaff(member.id));
  }
}

function bonuses(stats: Stats, fuel = 0) {
  const list = (Object.keys(statLabels.value) as (keyof Stats)[])
    .filter((key) => stats[key])
    .map((key) => `+${stats[key]} ${statLabels.value[key].toLowerCase()}`);
  if (fuel) {
    list.push(t('stats.fuel', { sign: fuel > 0 ? '+' : '', pct: fuel }));
  }
  return list.join(', ');
}

function canUpgrade(next: NonNullable<Garage['garage']['next']>) {
  const player = session.player;
  return !!player && player.level >= next.min_level && player.money >= next.price;
}
</script>

<template>
  <div class="bgr-stack">
    <Feedback :message="message" :error="error" />

    <template v-if="garage">
      <section class="bgr-card">
        <p><RouterLink to="/city">&larr; {{ $t('common.backCity') }}</RouterLink></p>
        <h2>{{ $t('garage.level', { level: garage.garage.level }) }}</h2>
        <p v-if="garage.garage.next" class="bgr-muted">
          {{ $t('garage.next', { level: garage.garage.next.level, price: money(garage.garage.next.price), min: garage.garage.next.min_level }) }}
          {{ $t('garage.unlocks', { list: garage.garage.next.unlocks || $t('garage.nothingNew') }) }}
        </p>
        <p v-else class="bgr-muted">{{ $t('garage.max') }}</p>
        <div class="bgr-actions">
          <button v-if="garage.garage.next && garage.garage.permit" class="bgr-small" :disabled="busy || !canUpgrade(garage.garage.next)" @click="act(upgradeGarage)">
            {{ $t('garage.upgrade') }}
          </button>
          <RouterLink v-else-if="garage.garage.next" to="/city/hall" class="bgr-small-link">{{ $t('garage.permit') }}</RouterLink>
          <RouterLink to="/city/bar" class="bgr-small-link">{{ $t('garage.hire') }}</RouterLink>
        </div>
        <p class="bgr-muted">{{ $t('garage.spares', { tyres: garage.spares.tyres, parts: garage.spares.parts }) }}</p>
        <div>
        </div>
        <div v-if="garage.cars.length > 1" class="bgr-tabs bgr-cars">
          <button
            v-for="car in garage.cars"
            :key="car.player_car_id"
            :class="{ active: car.active }"
            :disabled="busy || car.active"
            @click="act(() => setActiveCar(car.player_car_id))"
          >
            {{ car.name }} · {{ car.class_label }}
          </button>
        </div>
      </section>

      <section v-if="garage.car" class="bgr-card">
        <h1>{{ garage.car.name }} <span class="bgr-tag">{{ garage.car.class_label }}</span></h1>
        <p v-if="garage.car.problems.length" class="bgr-error">{{ $t('garage.notReady', { list: garage.car.problems.join(', ') }) }}</p>
        <div class="bgr-tiles">
          <div v-for="(label, key) in statLabels" :key="key" class="bgr-tile">
            <span>{{ label }}</span>
            <b>{{ garage.car.stats[key] }}<small v-if="key === 'power'"> {{ $t('stats.hp') }}</small></b>
            <small v-if="garage.car.stats[key] !== garage.car.base[key]">{{ $t('garage.base', { value: garage.car.base[key] }) }}</small>
          </div>
          <div class="bgr-tile">
            <span>{{ $t('garage.health') }}</span>
            <b>{{ garage.car.health }}%</b>
          </div>
          <div class="bgr-tile">
            <span>{{ $t('garage.consumption') }}</span>
            <b>{{ garage.car.fuel_consumption }}</b>
            <small>{{ $t('garage.consumptionUnit') }}<template v-if="garage.car.fuel_consumption !== garage.car.fuel_base"> · {{ $t('garage.base', { value: garage.car.fuel_base }) }}</template></small>
          </div>
        </div>
      </section>

      <section v-if="garage.car" class="bgr-card">
        <h2>{{ $t('garage.parts') }}</h2>
        <p class="bgr-muted">{{ $t('garage.worker', { worker: garage.worker }) }}</p>
        <div class="bgr-scroll">
          <table class="bgr-table">
            <tbody>
              <tr v-for="slot in garage.slots" :key="slot.type">
                <th>{{ slot.label }}</th>
                <td>
                  <template v-if="slot.item">
                    {{ slot.item.name }}
                    <small v-if="bonuses(slot.item.bonuses, slot.item.fuel_pct)" class="bgr-muted">{{ bonuses(slot.item.bonuses, slot.item.fuel_pct) }}</small>
                    <small v-if="slot.item.defect" class="bgr-error">{{ $t('garage.poorRepair') }}</small>
                  </template>
                  <span v-else class="bgr-error">{{ $t('garage.missing') }}</span>
                </td>
                <td>
                  <template v-if="slot.item">
                    <HealthBar :value="slot.item.health" />
                    <small v-if="slot.item.max_health < 100" class="bgr-muted">{{ $t('garage.maxHealth', { pct: slot.item.max_health }) }}</small>
                  </template>
                </td>
                <td class="bgr-right">
                  <button v-if="slot.item?.can_repair" class="bgr-small" :disabled="busy" @click="act(() => repairItem(slot.item!.id))">
                    {{ $t('garage.repair', { cost: money(slot.item.repair_cost), energy: garage.energy_costs.repair }) }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>{{ $t('garage.tyres') }}</h2>
        <div v-if="garage.tyre" class="bgr-row">
          <span>{{ garage.tyre.name }}</span>
          <HealthBar :value="garage.tyre.health" />
        </div>
        <p v-else class="bgr-error">{{ $t('garage.noTyres') }}</p>
      </section>

      <section class="bgr-card">
        <h2>{{ $t('garage.storage') }}</h2>
        <p v-if="!garage.storage.length" class="bgr-muted">{{ $t('garage.emptyStorage') }}</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <tbody>
              <tr v-for="item in garage.storage" :key="item.id">
                <td>
                  {{ item.name }}
                  <small class="bgr-muted">{{ item.type_label }}</small>
                </td>
                <td><HealthBar :value="item.health" /></td>
                <td class="bgr-right">
                  <button v-if="item.compatible" class="bgr-small" :disabled="busy" @click="act(() => mountItem(item.id))">
                    {{ $t('garage.mount', { energy: item.kind === 'part' ? garage.energy_costs.mount : garage.energy_costs.tyres }) }}
                  </button>
                  <small v-else-if="item.spare" class="bgr-muted">{{ $t('garage.spare') }}</small>
                  <small v-else class="bgr-muted">{{ $t('garage.wrongClass') }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="bgr-card">
        <h2>{{ $t('garage.staff') }}</h2>
        <p v-if="!garage.crew.length" class="bgr-error">{{ $t('garage.noStaff') }}</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>{{ $t('garage.role') }}</th><th>{{ $t('garage.name') }}</th><th>{{ $t('garage.skill') }}</th><th>{{ $t('garage.morale') }}</th><th>{{ $t('garage.physical') }}</th><th>{{ $t('garage.reputation') }}</th><th>{{ $t('garage.salary') }}</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="member in garage.crew" :key="member.id">
                <th>{{ member.role_label }}</th>
                <td>
                  {{ member.name }}
                  <small v-if="member.energy !== null" class="bgr-muted">{{ $t('garage.energyToday', { energy: member.energy }) }}</small>
                  <small v-if="member.unpaid" class="bgr-error">{{ $t('garage.unpaid') }}</small>
                </td>
                <td><HealthBar :value="member.skill" /></td>
                <td><HealthBar v-if="member.morale !== null" :value="member.morale" /></td>
                <td>{{ member.physical ?? '' }}</td>
                <td>{{ member.reputation ?? '' }}</td>
                <td>{{ $t('garage.perWeek', { amount: money(member.salary) }) }}</td>
                <td class="bgr-right"><button class="bgr-small bgr-secondary" :disabled="busy" @click="fire(member)">{{ $t('garage.fire') }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
