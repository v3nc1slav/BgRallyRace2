<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Feedback from '../components/Feedback.vue';
import { getStandings, type ClassGroup, type StandingRow } from '../game';
import { useAction } from '../useAction';

const season = ref(0);
const seasons = ref<number[]>([]);
const classes = ref<ClassGroup<StandingRow>[]>([]);
const { error, run } = useAction();

async function load(selected = 0) {
  const data = await run(() => getStandings(selected));
  if (data) {
    season.value = data.season;
    seasons.value = data.seasons;
    classes.value = data.classes;
  }
}

onMounted(() => load());
</script>

<template>
  <section class="bgr-card">
    <h1>Класиране</h1>
    <label v-if="seasons.length > 1" class="bgr-inline">
      Сезон
      <select :value="season" @change="load(Number(($event.target as HTMLSelectElement).value))">
        <option v-for="value in seasons" :key="value" :value="value">{{ value }}</option>
      </select>
    </label>
    <Feedback :error="error" />
    <p v-if="!classes.length && !error" class="bgr-muted">Все още няма завършили ралита през сезон {{ season }}.</p>

    <div v-for="group in classes" :key="group.class" class="bgr-scroll">
      <h2>{{ group.label }}</h2>
      <table class="bgr-table">
        <thead><tr><th>#</th><th>Отбор</th><th>Ралита</th><th>Победи</th><th>Точки</th></tr></thead>
        <tbody>
          <tr v-for="row in group.rows" :key="row.position" :class="{ 'bgr-me': row.is_me }">
            <td>{{ row.position }}</td>
            <td>{{ row.team }}</td>
            <td>{{ row.rallies }}</td>
            <td>{{ row.wins }}</td>
            <td><b>{{ row.points }}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
