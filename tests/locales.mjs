import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (lang) => JSON.parse(readFileSync(join(root, 'backend/car-racer-backend/locales', `${lang}.json`), 'utf8'));
const flat = (node, trail = '', out = {}) => {
  for (const [key, value] of Object.entries(node)) {
    const path = trail ? `${trail}.${key}` : key;
    if (value && typeof value === 'object') flat(value, path, out);
    else out[path] = value;
  }
  return out;
};
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(vue|ts|php)$/.test(name)) out.push(path);
  }
  return out;
};

const bg = flat(load('bg'));
const en = flat(load('en'));
const code = [...walk(join(root, 'src')), ...walk(join(root, 'backend/car-racer-backend/includes'))].map((file) => readFileSync(file, 'utf8')).join('\n');
const params = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');
const used = new Set([...code.matchAll(/(?:\$t|\bt|I18n::t|I18n::msg|I18n::text|I18n::has)\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g)].map((match) => match[1]));
let failed = 0;

function report(label, list) {
  console.log(`${list.length ? 'FAIL' : 'OK  '} ${label}${list.length ? `: ${list.slice(0, 20).join(', ')}` : ''}`);
  failed += list.length ? 1 : 0;
}

report('every key exists in English', Object.keys(bg).filter((key) => !(key in en)));
report('every key exists in Bulgarian', Object.keys(en).filter((key) => !(key in bg)));
report('placeholders match', Object.keys(bg).filter((key) => key in en && params(bg[key]) !== params(en[key])));
report('no Cyrillic in English', Object.keys(en).filter((key) => /[а-яА-Я]/.test(String(en[key]))));
report('every key used in the code exists', [...used].filter((key) => !key.endsWith('.') && !(key in bg)));

process.exitCode = failed ? 1 : 0;
