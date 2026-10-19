import { reactive } from 'vue';
import { ApiError } from './api';
import { claimAd, startAd, type AdStart } from './game';

interface RewardedEvent {
  slot: unknown;
  isEmpty?: boolean;
  makeRewardedVisible?: () => void;
}

type Listener = (event: RewardedEvent) => void;

interface PubAds {
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  setPrivacySettings(settings: Record<string, boolean>): void;
}

interface GoogleTag {
  cmd: { push(task: () => void): void };
  enums: { OutOfPageFormat: { REWARDED: number } };
  defineOutOfPageSlot(unit: string, format: number): { addService(service: PubAds): unknown } | null;
  pubads(): PubAds;
  enableServices(): void;
  display(slot: unknown): void;
  destroySlots(slots: unknown[]): void;
}

declare global {
  interface Window {
    googletag?: GoogleTag;
  }
}

export const testAd = reactive({ open: false, label: '', left: 0 });
let finish: ((watched: boolean) => void) | null = null;
let timer = 0;

function showTest(ad: AdStart): Promise<boolean> {
  testAd.open = true;
  testAd.label = ad.label;
  testAd.left = ad.seconds;
  return new Promise((resolve) => {
    finish = resolve;
    timer = window.setInterval(() => {
      testAd.left = Math.max(0, testAd.left - 1);
      if (!testAd.left) {
        window.clearInterval(timer);
      }
    }, 1000);
  });
}

export function closeTestAd() {
  window.clearInterval(timer);
  testAd.open = false;
  finish?.(testAd.left === 0);
  finish = null;
}

function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(src));
    document.head.appendChild(script);
  });
}

async function showGpt(ad: AdStart): Promise<boolean> {
  if (ad.publisher) {
    await loadScript(`https://fundingchoicesmessages.google.com/i/${ad.publisher}?ers=1`).catch(() => undefined);
  }
  window.googletag ??= { cmd: [] } as unknown as GoogleTag;
  await loadScript('https://securepubads.g.doubleclick.net/tag/js/gpt.js');
  const googletag = window.googletag as GoogleTag;

  return new Promise((resolve) => {
    googletag.cmd.push(() => {
      const slot = googletag.defineOutOfPageSlot(ad.gpt_unit, googletag.enums.OutOfPageFormat.REWARDED);
      if (!slot) {
        resolve(false);
        return;
      }
      const pubads = googletag.pubads();
      let granted = false;
      const handlers: Record<string, Listener> = {
        rewardedSlotReady: (event) => event.slot === slot && event.makeRewardedVisible?.(),
        rewardedSlotGranted: (event) => {
          if (event.slot === slot) {
            granted = true;
          }
        },
        rewardedSlotClosed: (event) => event.slot === slot && done(granted),
        slotRenderEnded: (event) => event.slot === slot && event.isEmpty && done(false),
      };
      const done = (watched: boolean) => {
        for (const [type, handler] of Object.entries(handlers)) {
          pubads.removeEventListener(type, handler);
        }
        googletag.destroySlots([slot]);
        resolve(watched);
      };

      for (const [type, handler] of Object.entries(handlers)) {
        pubads.addEventListener(type, handler);
      }
      if (!ad.publisher) {
        pubads.setPrivacySettings({ limitedAds: true });
      }
      slot.addService(pubads);
      googletag.enableServices();
      googletag.display(slot);
    });
  });
}

export async function watchAd(reward: string) {
  const { ad } = await startAd(reward);
  const watched = ad.provider === 'gpt' && ad.gpt_unit ? await showGpt(ad).catch(() => false) : await showTest(ad);
  if (!watched) {
    throw new ApiError('Рекламата не беше изгледана докрай, затова няма награда.', 0);
  }
  return claimAd(ad.view_id, ad.token);
}
