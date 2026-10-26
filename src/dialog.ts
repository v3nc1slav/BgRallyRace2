import { reactive } from 'vue';
import { t } from './i18n';

interface Request {
  text: string;
  title: string;
  ok: string;
  cancel: string | null;
  resolve: (value: boolean) => void;
}

interface Options {
  title?: string;
  ok?: string;
  cancel?: string;
}

export const dialog = reactive<{ current: Request | null }>({ current: null });
const queue: Request[] = [];

function open(request: Request) {
  if (dialog.current) {
    queue.push(request);
  } else {
    dialog.current = request;
  }
}

export function ask(text: string, options: Options = {}): Promise<boolean> {
  return new Promise((resolve) =>
    open({ text, title: options.title ?? '', ok: options.ok ?? t('dialog.yes'), cancel: options.cancel ?? t('dialog.no'), resolve }),
  );
}

export function tell(text: string, options: Omit<Options, 'cancel'> = {}): Promise<void> {
  return new Promise((resolve) => open({ text, title: options.title ?? '', ok: options.ok ?? t('dialog.ok'), cancel: null, resolve: () => resolve() }));
}

export function answer(value: boolean) {
  const current = dialog.current;
  if (!current) {
    return;
  }
  dialog.current = queue.shift() ?? null;
  current.resolve(value);
}
