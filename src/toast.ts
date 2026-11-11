import { reactive } from 'vue';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

const LIMIT = 3;
const SECONDS = { ok: 5, error: 8 };

export const toasts = reactive<Toast[]>([]);
const timers = new Map<number, number>();
let next = 1;

function schedule(item: Toast) {
  timers.set(item.id, window.setTimeout(() => dismiss(item.id), SECONDS[item.kind] * 1000));
}

export function dismiss(id: number) {
  window.clearTimeout(timers.get(id));
  timers.delete(id);
  const index = toasts.findIndex((item) => item.id === id);
  if (index >= 0) {
    toasts.splice(index, 1);
  }
}

export function toast(text: string, kind: Toast['kind'] = 'ok') {
  if (!text) {
    return;
  }
  toasts.filter((item) => item.text === text && item.kind === kind).forEach((item) => dismiss(item.id));
  const item = { id: next++, text, kind };
  toasts.unshift(item);
  schedule(item);
  while (toasts.length > LIMIT) {
    dismiss(toasts[toasts.length - 1].id);
  }
}

export function hold(id: number) {
  window.clearTimeout(timers.get(id));
}

export function release(id: number) {
  const item = toasts.find((entry) => entry.id === id);
  if (item) {
    schedule(item);
  }
}
