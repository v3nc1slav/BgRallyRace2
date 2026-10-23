import { BASE, php, settings, sql } from '../env.mjs';

async function call(method, path, { body, token, lang, chosen } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (lang) headers['X-BGR-Lang'] = lang;
  if (chosen) headers['X-BGR-Lang-Set'] = '1';
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
  return { status: res.status, data };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const users = [];
const managers = [];
let restore = null;
let rumor = 0;
const job = (...args) => php('run_job.php', ...args.map(String));
const latest = async (player) => (await call('GET', 'inbox', { token: player.token })).data.inbox?.[0]?.text ?? '';

async function register(name, lang) {
  const r = await call('POST', 'auth/register', { lang, body: { username: name, email: `${name}@example.com`, password: 'testtest123', city_id: 1, mode: 'token', device: 'test' } });
  users.push(r.data.user.id);
  managers.push(r.data.player.id);
  return { id: r.data.player.id, token: r.data.token };
}

try {
  restore = settings({ black_bet_min: 100, black_risk: 0 });
  const en = await register(`en${stamp}`, 'en');
  const bg = await register(`bg${stamp}`, 'bg');
  check('language is saved at registration', sql(`SELECT lang FROM wp_bgr_managers WHERE id = ${en.id}`) === 'en');

  let r = await call('POST', 'jobs/quit', { token: en.token, lang: 'en' });
  check('error message in English', r.status === 400 && r.data.message === 'You do not have a job.', r.data.message);
  r = await call('POST', 'jobs/quit', { token: en.token, lang: 'bg' });
  check('a guessed language does not override the profile', r.data.message === 'You do not have a job.' && sql(`SELECT lang FROM wp_bgr_managers WHERE id = ${en.id}`) === 'en', r.data.message);
  const state = await call('GET', 'garage', { token: en.token, lang: 'bg' });
  check('the profile language is returned', state.data.player?.lang === 'en', state.data.player?.lang);
  r = await call('POST', 'jobs/quit', { token: en.token, lang: 'bg', chosen: true });
  check('same error in Bulgarian', r.data.message === 'Нямаш работа.', r.data.message);
  check('a chosen language is saved', sql(`SELECT lang FROM wp_bgr_managers WHERE id = ${en.id}`) === 'bg');
  await call('GET', 'garage', { token: en.token, lang: 'en', chosen: true });
  r = await call('POST', 'jobs/quit', { token: en.token });
  check('without a header the saved language is used', r.data.message === 'You do not have a job.', r.data.message);

  r = await call('GET', 'garage', { token: en.token, lang: 'en' });
  const slots = r.data.garage?.slots ?? [];
  check('labels are translated', slots.some((slot) => slot.label === 'Engine') && r.data.garage.crew.some((member) => member.role_label === 'Driver'), JSON.stringify(slots.map((slot) => slot.label)));
  r = await call('GET', 'garage', { token: bg.token, lang: 'bg' });
  check('labels stay Bulgarian for bg', (r.data.garage?.slots ?? []).some((slot) => slot.label === 'Двигател'));

  r = await call('GET', 'city', { token: en.token, lang: 'en' });
  check('city perks in English', /^(Here |The city has no privileges)/.test(r.data.city?.perks ?? ''), r.data.city?.perks);

  sql(`UPDATE wp_bgr_managers SET payroll_week = '2000-01' WHERE id = ${en.id}`);
  job('payroll', en.id);
  check('cron inbox in the player language', (await latest(en)).startsWith('Salaries paid: €'), (await latest(en)));
  sql(`UPDATE wp_bgr_managers SET payroll_week = '2000-01' WHERE id = ${bg.id}`);
  job('payroll', bg.id);
  check('cron inbox in Bulgarian for bg', (await latest(bg)).startsWith('Платени заплати:'), (await latest(bg)));

  const stage = Number(sql('SELECT id FROM wp_bgr_stages WHERE city_id = 1 AND active = 1 ORDER BY position, id LIMIT 1'));
  r = await call('POST', 'black/challenge', { token: en.token, lang: 'en', body: { stage_id: stage, bet: 100 } });
  check('challenge message in English', (r.data.message ?? '').startsWith('Challenge posted: €100'), r.data.message);
  const challenge = Number(sql(`SELECT id FROM wp_bgr_street_races WHERE challenger_id = ${en.id} AND status = 'open' ORDER BY id DESC LIMIT 1`));
  r = await call('POST', 'black/accept', { token: bg.token, lang: 'bg', body: { challenge_id: challenge } });
  check('the accepting player reads Bulgarian', (r.data.message ?? '').startsWith('Черна писта'), r.data.message);
  check('the challenger gets the result in English', (await latest(en)).startsWith('Black track, “Vitosha – Boyana”'), (await latest(en)));

  r = await call('GET', 'garage', { token: en.token, lang: 'en' });
  check('catalog names in English', JSON.stringify(r.data.garage).includes('Standard engine') && r.data.player?.city === 'Sofia', r.data.player?.city);
  r = await call('GET', 'garage', { token: bg.token, lang: 'bg' });
  check('catalog names stay Bulgarian', JSON.stringify(r.data.garage).includes('Стандартен двигател') && r.data.player?.city === 'София', r.data.player?.city);

  const rendered = JSON.parse(php('i18n.php', 'render'));
  check('chronicle in English', rendered.en === 'Rally Sofia starts. 8 crews are at the start. Weather: rain. Иван made a mistake at the 2nd corner and lost 7 s. Stage 1 “Plana”: fastest in Class 3 is Иван – 9:01.2.', rendered.en);
  check('chronicle in Bulgarian', rendered.bg === 'Ралито „Рали София“ започва. На старта са 8 екипажа. Времето: дъжд. Иван сгреши на 2-рия завой и загуби 7 сек. Етап 1 „Плана“: най-бърз в Клас 3 е Иван – 9:01.2.', rendered.bg);
  check('old chronicle text stays as it was', rendered.plain === 'Стар текст');

  rumor = Number(php('i18n.php', 'rumor', 1));
  r = await call('GET', 'bar', { token: en.token, lang: 'en' });
  check('rumor in English', (r.data.bar?.rumors ?? []).some((item) => item.text === 'The police fined a team from the city €300.'), JSON.stringify(r.data.bar?.rumors?.[0]));
  r = await call('GET', 'bar', { token: bg.token, lang: 'bg' });
  check('rumor in Bulgarian', (r.data.bar?.rumors ?? []).some((item) => item.text === 'Полицията глоби отбор от града с 300 €.'), JSON.stringify(r.data.bar?.rumors?.[0]));
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  if (rumor) sql(`DELETE FROM wp_bgr_rumors WHERE id = ${rumor}`);
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    sql(`DELETE FROM wp_bgr_street_races WHERE challenger_id = ${id} OR opponent_id = ${id}`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'loans']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    for (const t of ['app_tokens', 'push_devices', 'push_queue']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
