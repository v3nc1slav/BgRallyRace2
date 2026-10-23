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
    <h2>{{ $t('ads.title') }}</h2>
    <p class="bgr-muted">{{ $t('ads.intro') }}</p>
    <Feedback :message="message" :error="error" />
    <p v-if="session.player?.perks.discount" class="bgr-ok">{{ $t('ads.discount', { pct: session.player.perks.discount }) }}</p>
    <p v-if="session.player?.perks.retry" class="bgr-ok">{{ $t('ads.retry') }}</p>
    <template v-if="ads">
      <p v-if="ads.cooldown > 0" class="bgr-muted">{{ $t('ads.cooldown', { seconds: ads.cooldown }) }}</p>
      <div class="bgr-scroll">
        <table class="bgr-table">
          <tbody>
            <tr v-for="reward in ads.rewards" :key="reward.key">
              <td>
                {{ reward.label }}
                <small class="bgr-muted">{{ reward.blocked || $t('ads.remaining', { left: reward.left, daily: reward.daily }) }}</small>
              </td>
              <td class="bgr-right">
                <button class="bgr-small" :disabled="busy || !reward.left || !!reward.blocked || ads.cooldown > 0" @click="watch(reward)">{{ $t('ads.watch') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
