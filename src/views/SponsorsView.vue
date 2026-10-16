<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import HealthBar from '../components/HealthBar.vue';
import { date, money } from '../format';
import { getSponsors, negotiate, type Sponsors } from '../game';
import { useAction } from '../useAction';

const data = ref<Sponsors | null>(null);
const { busy, message, error, run } = useAction();

onMounted(() =>
  run(async () => {
    data.value = (await getSponsors()).sponsors;
  }),
);

async function start(id: number) {
  const result = await run(() => negotiate(id));
  if (result) {
    data.value = result.sponsors;
    message.value = result.message;
  }
}
</script>

<template>
  <div v-if="data" class="bgr-stack">
    <section class="bgr-card">
      <h1>Спонсори</h1>
      <p class="bgr-muted">
        Преговорите напредват след всяко рали, в което участваш, но на всеки етап могат да се провалят.
        Спонсорът плаща за всяко рали: цялата сума и бонус при изпълнена цел, половината при неизпълнена.
        {{ data.misses_limit }} неизпълнени цели поред прекратяват договора.
      </p>
      <Feedback :message="message" :error="error" />
      <div class="bgr-tiles">
        <div v-for="slot in data.slots" :key="slot.slot" class="bgr-tile" :class="{ 'bgr-locked': !slot.unlocked }">
          <span>{{ slot.label }}</span>
          <template v-if="slot.contract">
            <b>{{ slot.contract.sponsor }}</b>
            <template v-if="slot.contract.status === 'negotiating'">
              <small>Преговори</small>
              <HealthBar :value="slot.contract.progress" />
            </template>
            <template v-else>
              <small>{{ money(slot.contract.payment) }} за рали, бонус {{ money(slot.contract.bonus) }} за топ {{ slot.contract.goal_place }}</small>
              <small v-if="slot.contract.ends_at">до {{ date(slot.contract.ends_at) }}</small>
              <small v-if="slot.contract.misses" class="bgr-error">неизпълнени цели: {{ slot.contract.misses }}</small>
            </template>
          </template>
          <b v-else-if="slot.unlocked">свободно</b>
          <small v-else>от ниво {{ slot.unlock_level }}</small>
        </div>
      </div>
    </section>

    <section class="bgr-card">
      <h2>Оферти</h2>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <thead>
            <tr><th>Спонсор</th><th>Място</th><th>За рали</th><th>Цел</th><th>Срок</th><th>Етап</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="offer in data.offers" :key="offer.id" :class="{ 'bgr-locked': offer.locked }">
              <td>
                {{ offer.name }}
                <small class="bgr-muted">{{ offer.city }} <span v-if="offer.local" class="bgr-tag">местен</span></small>
              </td>
              <td>{{ offer.slot_label }}</td>
              <td>{{ money(offer.payment) }}<small class="bgr-muted">+ {{ money(offer.bonus) }} бонус</small></td>
              <td>топ {{ offer.goal_place }}</td>
              <td>{{ offer.weeks }} седм.</td>
              <td>+{{ offer.progress_step }}%<small class="bgr-muted">риск {{ offer.risk }}%</small></td>
              <td class="bgr-right">
                <small v-if="offer.locked" class="bgr-muted">от ниво {{ offer.min_level }}</small>
                <button v-else-if="offer.available" class="bgr-small" :disabled="busy" @click="start(offer.id)">
                  Преговори ({{ data.energy_cost }} енергия)
                </button>
                <small v-else class="bgr-muted">мястото не е свободно</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <section v-else class="bgr-card"><Feedback :error="error" /></section>
</template>
