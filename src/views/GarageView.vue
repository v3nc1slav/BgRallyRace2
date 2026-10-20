<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { money } from '../format';
import { fireStaff, getGarage, mountItem, repairItem, setActiveCar, upgradeGarage, type CrewMember, type Garage, type Stats } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';

const garage = ref<Garage | null>(null);
const { busy, message, error, run } = useAction();

const statLabels: Record<keyof Stats, string> = {
  power: 'Мощност',
  handling: 'Управление',
  braking: 'Спирачки',
  reliability: 'Надеждност',
};

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
  if (window.confirm(`Да освободиш ли ${member.name} (${member.role_label.toLowerCase()})?`)) {
    act(() => fireStaff(member.id));
  }
}

function bonuses(stats: Stats, fuel = 0) {
  const list = (Object.keys(statLabels) as (keyof Stats)[])
    .filter((key) => stats[key])
    .map((key) => `+${stats[key]} ${statLabels[key].toLowerCase()}`);
  if (fuel) {
    list.push(`${fuel > 0 ? '+' : ''}${fuel}% гориво`);
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
        <h2>Гараж ниво {{ garage.garage.level }}</h2>
        <p v-if="garage.garage.next" class="bgr-muted">
          Ниво {{ garage.garage.next.level }}: {{ money(garage.garage.next.price) }}, нужно ниво на мениджъра {{ garage.garage.next.min_level }}.
          Отключва: {{ garage.garage.next.unlocks || 'нищо ново' }}.
        </p>
        <p v-else class="bgr-muted">Гаражът е на максимално ниво.</p>
        <div class="bgr-actions">
          <button v-if="garage.garage.next && garage.garage.permit" class="bgr-small" :disabled="busy || !canUpgrade(garage.garage.next)" @click="act(upgradeGarage)">
            Подобри гаража
          </button>
          <RouterLink v-else-if="garage.garage.next" to="/city/hall" class="bgr-small-link">Нужно е разрешение от кмета</RouterLink>
          <RouterLink to="/city/bar" class="bgr-small-link">Наеми служители в бара</RouterLink>
        </div>
        <p class="bgr-muted">На ралито можеш да вземеш {{ garage.spares.tyres }} резервни гуми и {{ garage.spares.parts }} резервни части.</p>
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
        <p v-if="garage.car.problems.length" class="bgr-error">Отборът не е готов: {{ garage.car.problems.join(', ') }}.</p>
        <div class="bgr-tiles">
          <div v-for="(label, key) in statLabels" :key="key" class="bgr-tile">
            <span>{{ label }}</span>
            <b>{{ garage.car.stats[key] }}<small v-if="key === 'power'"> к.с.</small></b>
            <small v-if="garage.car.stats[key] !== garage.car.base[key]">база {{ garage.car.base[key] }}</small>
          </div>
          <div class="bgr-tile">
            <span>Състояние</span>
            <b>{{ garage.car.health }}%</b>
          </div>
          <div class="bgr-tile">
            <span>Разход</span>
            <b>{{ garage.car.fuel_consumption }}</b>
            <small>л/100 км<template v-if="garage.car.fuel_consumption !== garage.car.fuel_base"> · база {{ garage.car.fuel_base }}</template></small>
          </div>
        </div>
      </section>

      <section v-if="garage.car" class="bgr-card">
        <h2>Части</h2>
        <p class="bgr-muted">Работата се върши от: {{ garage.worker }}.</p>
        <div class="bgr-scroll">
          <table class="bgr-table">
            <tbody>
              <tr v-for="slot in garage.slots" :key="slot.type">
                <th>{{ slot.label }}</th>
                <td>
                  <template v-if="slot.item">
                    {{ slot.item.name }}
                    <small v-if="bonuses(slot.item.bonuses, slot.item.fuel_pct)" class="bgr-muted">{{ bonuses(slot.item.bonuses, slot.item.fuel_pct) }}</small>
                    <small v-if="slot.item.defect" class="bgr-error">некачествен ремонт</small>
                  </template>
                  <span v-else class="bgr-error">липсва</span>
                </td>
                <td>
                  <template v-if="slot.item">
                    <HealthBar :value="slot.item.health" />
                    <small v-if="slot.item.max_health < 100" class="bgr-muted">макс. {{ slot.item.max_health }}%</small>
                  </template>
                </td>
                <td class="bgr-right">
                  <button v-if="slot.item?.can_repair" class="bgr-small" :disabled="busy" @click="act(() => repairItem(slot.item!.id))">
                    Ремонт ({{ money(slot.item.repair_cost) }}, {{ garage.energy_costs.repair }} енергия)
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Гуми</h2>
        <div v-if="garage.tyre" class="bgr-row">
          <span>{{ garage.tyre.name }}</span>
          <HealthBar :value="garage.tyre.health" />
        </div>
        <p v-else class="bgr-error">Няма монтирани гуми.</p>
      </section>

      <section class="bgr-card">
        <h2>Склад</h2>
        <p v-if="!garage.storage.length" class="bgr-muted">Складът е празен. Купи части и гуми от магазина.</p>
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
                    Монтирай ({{ item.kind === 'part' ? garage.energy_costs.mount : garage.energy_costs.tyres }} енергия)
                  </button>
                  <small v-else-if="item.spare" class="bgr-muted">резервна за ралито</small>
                  <small v-else class="bgr-muted">не е за този клас</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="bgr-card">
        <h2>Служители</h2>
        <p v-if="!garage.crew.length" class="bgr-error">Нямаш служители. Наеми пилот и навигатор в бара.</p>
        <div v-else class="bgr-scroll">
          <table class="bgr-table">
            <thead>
              <tr><th>Роля</th><th>Име</th><th>Умение</th><th>Морал</th><th>Физ.</th><th>Репутация</th><th>Заплата</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="member in garage.crew" :key="member.id">
                <th>{{ member.role_label }}</th>
                <td>
                  {{ member.name }}
                  <small v-if="member.energy !== null" class="bgr-muted">{{ member.energy }} енергия днес</small>
                  <small v-if="member.unpaid" class="bgr-error">не е получил заплата</small>
                </td>
                <td><HealthBar :value="member.skill" /></td>
                <td><HealthBar v-if="member.morale !== null" :value="member.morale" /></td>
                <td>{{ member.physical ?? '' }}</td>
                <td>{{ member.reputation ?? '' }}</td>
                <td>{{ money(member.salary) }}/седм.</td>
                <td class="bgr-right"><button class="bgr-small bgr-secondary" :disabled="busy" @click="fire(member)">Освободи</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
