import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const SUN: [number, number][] = [[7.9, 17.3], [7.4, 17.9], [6.8, 18.5], [6.8, 19.9], [6.1, 20.5], [5.8, 20.9], [6, 20.9], [6.5, 20.3], [7, 19.5], [7.5, 18.7], [7.2, 17.1], [7.8, 16.9]];

export function useClock() {
  const now = ref(new Date());
  let timer = 0;
  onMounted(() => {
    timer = window.setInterval(() => (now.value = new Date()), 20000);
  });
  onBeforeUnmount(() => window.clearInterval(timer));

  const night = computed(() => {
    const hour = now.value.getHours() + now.value.getMinutes() / 60;
    const [rise, set] = SUN[now.value.getMonth()];
    return hour < rise || hour >= set;
  });
  const hands = computed(() => {
    const minutes = now.value.getMinutes();
    return { hour: ((now.value.getHours() % 12) + minutes / 60) * 30, minute: minutes * 6 };
  });
  const time = computed(() => `${now.value.getHours()}:${String(now.value.getMinutes()).padStart(2, '0')}`);

  return { night, hands, time };
}
