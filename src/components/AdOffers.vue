<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { watchAd } from '../ads';
import { getAds, type AdReward, type AdsInfo } from '../game';
import { session } from '../session';
import { useAction } from '../useAction';
import Feedback from './Feedback.vue';

const ads = ref<AdsInfo | null>(null);
const { busy, message, error, run } = useAction();
let timer = 0;

onMounted(() => {
  run(async () => {
    ads.value = (await getAds()).ads;
  });
  timer = window.setInterval(() => {
    if (ads.value?.cooldown) {
      ads.value.cooldown -= 1;
    }
  }, 1000);
});
onBeforeUnmount(() => window.clearInterval(timer));

async function watch(reward: AdReward) {
  const result = await run(() => watchAd(reward.key));
  if (result) {
    ads.value = result.ads;
    message.value = result.message;
  }
}
</script>

<template>
  <section class="bgr-card">
    <h2>Бонуси срещу реклама</h2>
    <p class="bgr-muted">Рекламата се гледа само ако искаш. Наградата идва, след като я изгледаш докрай.</p>
    <Feedback :message="message" :error="error" />
    <p v-if="session.player?.perks.discount" class="bgr-ok">Имаш {{ session.player.perks.discount }}% отстъпка за следващата покупка от магазина.</p>
    <p v-if="session.player?.perks.retry" class="bgr-ok">Имаш втори опит при кмета или при отказан подкуп.</p>
    <template v-if="ads">
      <p v-if="ads.cooldown > 0" class="bgr-muted">Следващата реклама – след {{ ads.cooldown }} сек.</p>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <tbody>
            <tr v-for="reward in ads.rewards" :key="reward.key">
              <td>
                {{ reward.label }}
                <small class="bgr-muted">{{ reward.blocked || `остават ${reward.left} от ${reward.daily} днес` }}</small>
              </td>
              <td class="bgr-right">
                <button class="bgr-small" :disabled="busy || !reward.left || !!reward.blocked || ads.cooldown > 0" @click="watch(reward)">Гледай</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
