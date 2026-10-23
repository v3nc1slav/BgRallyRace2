import { createI18n } from 'vue-i18n';
import bg from '../backend/car-racer-backend/locales/bg.json';
import en from '../backend/car-racer-backend/locales/en.json';

export type Lang = 'bg' | 'en';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'bg', label: 'Български' },
  { code: 'en', label: 'English' },
];

const KEY = 'bgr-lang';

function saved(): Lang | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'bg' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

function guess(): Lang {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  if (languages.some((code) => code.toLowerCase().startsWith('bg'))) {
    return 'bg';
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Sofia' ? 'bg' : 'en';
  } catch {
    return 'bg';
  }
}

export const i18n = createI18n({ legacy: false, locale: saved() ?? guess(), fallbackLocale: 'bg', messages: { bg, en } });

export const t = i18n.global.t;

export function lang(): Lang {
  return i18n.global.locale.value as Lang;
}

export function locale() {
  return lang() === 'bg' ? 'bg-BG' : 'en-GB';
}

export function chosen() {
  return saved() !== null;
}

export function setLang(code: Lang) {
  i18n.global.locale.value = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    return;
  }
}

document.documentElement.lang = lang();
