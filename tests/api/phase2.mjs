import { execFileSync } from 'node:child_process';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

const cookies = {};
let nonce = '';

async function api(method, path, body) {
  const headers = { Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') };
  if (nonce) headers['X-WP-Nonce'] = nonce;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  for (const cookie of res.headers.getSetCookie()) {
    const [pair, ...attrs] = cookie.split(';');
    const [name, ...rest] = pair.split('=');
    const expires = attrs.find((a) => a.trim().toLowerCase().startsWith('expires='));
    if (expires && Date.parse(expires.split('=')[1]) < Date.now()) delete cookies[name.trim()];
    else cookies[name.trim()] = rest.join('=');
  }
  if (res.headers.get('x-wp-nonce')) nonce = res.headers.get('x-wp-nonce');
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 800);
  }
  if (data?.nonce) nonce = data.nonce;
  return { status: res.status, data };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const OFFSET = Number(sql("SELECT option_value FROM wp_options WHERE option_name = 'gmt_offset'")) || 0;
const username = `phase${stamp}`;
let managerId = 0;
let userId = 0;
let rallyId = 0;

try {
  await api('GET', 'me');
  let r = await api('POST', 'auth/register', { username, email: `${username}@example.com`, password: 'testtest123', city_id: 1 });
  managerId = r.data.player?.id;
  userId = r.data.user?.id;
  check('register', r.status === 200 && managerId, `garage_level ${r.data.player?.garage_level}`);

  r = await api('GET', 'garage');
  let g = r.data.garage;
  check('garage level 1 with next level info', g.garage.level === 1 && g.garage.next?.price === 15000 && g.garage.next?.min_level === 5, JSON.stringify(g.garage.next));
  check('crew has salaries', g.crew.every((c) => c.salary > 0), g.crew.map((c) => `${c.role_label} ${c.salary}€ морал ${c.morale}`).join('; '));

  r = await api('POST', 'garage/upgrade');
  check('upgrade refused at level 1', r.status === 400, r.data.message);

  r = await api('GET', 'bar');
  const bar = r.data.bar;
  const pilots = bar.roles.find((x) => x.role === 'pilot');
  const mechanicRole = bar.roles.find((x) => x.role === 'mechanic');
  check('bar has candidates', pilots.candidates.length > 0, `${bar.roles.map((x) => `${x.label}:${x.candidates.length}${x.unlocked ? '' : '🔒' + x.unlock_level}`).join(' ')}`);
  check('mechanic locked at garage 1', !mechanicRole.unlocked && mechanicRole.unlock_level === 2);

  r = await api('POST', 'bar/hire', { candidate_id: mechanicRole.candidates[0].id });
  check('hiring locked role refused', r.status === 400, r.data.message);

  const best = [...pilots.candidates].sort((a, b) => b.skill - a.skill)[0];
  r = await api('POST', 'bar/hire', { candidate_id: best.id });
  check('hire new pilot (replaces old)', r.status === 200, r.data.message);
  r = await api('POST', 'bar/hire', { candidate_id: best.id });
  check('same candidate cannot be hired twice', r.status === 404, r.data.message);

  sql(`UPDATE wp_bgr_managers SET level = 12, money = 300000 WHERE id = ${managerId}`);
  for (let i = 0; i < 3; i++) sql(`INSERT INTO wp_bgr_mayor_requests (manager_id, kind, status, request_date, created_at) VALUES (${managerId}, 'garage', 'approved', CURDATE(), NOW())`);
  r = await api('POST', 'garage/upgrade');
  check('upgrade to garage 2', r.status === 200 && r.data.garage.garage.level === 2, r.data.message);
  r = await api('POST', 'garage/upgrade');
  check('upgrade to garage 3', r.status === 200 && r.data.garage.garage.level === 3, r.data.message);
  r = await api('POST', 'garage/upgrade');
  check('garage 4 needs manager level 25', r.status === 400, r.data.message);

  r = await api('GET', 'bar');
  for (const role of ['mechanic', 'engineer', 'psychologist']) {
    const candidate = r.data.bar.roles.find((x) => x.role === role).candidates[0];
    const hired = await api('POST', 'bar/hire', { candidate_id: candidate.id });
    check(`hire ${role}`, hired.status === 200, hired.data.message);
  }
  const chemist = r.data.bar.roles.find((x) => x.role === 'chemist');
  check('chemist still locked at garage 3', !chemist.unlocked && chemist.unlock_level === 4);

  r = await api('GET', 'garage');
  g = r.data.garage;
  const engine = g.slots[0].item;
  sql(`UPDATE wp_bgr_items SET health = 40 WHERE id = ${engine.id}`);
  const energyBefore = r.data.player.energy;
  r = await api('POST', 'garage/repair', { item_id: engine.id });
  check('mechanic repairs, manager energy untouched', r.status === 200 && r.data.player.energy === energyBefore, `${r.data.message} | ${r.data.garage.worker}`);

  r = await api('GET', 'shop');
  const kometa = r.data.cars.find((c) => c.name === 'Комета R4');
  check('shop lists cars with trade-in', r.data.cars.length === 6 && r.data.trade_in?.name === 'Ласка R4', `trade-in ${JSON.stringify(r.data.trade_in)}`);
  r = await api('POST', 'shop/buy-car', { id: kometa.id });
  check('buy car with trade-in', r.status === 200, r.data.message);
  r = await api('GET', 'garage');
  g = r.data.garage;
  check('new car active, standard parts, no tyres', g.car.name === 'Комета R4' && g.slots.every((s) => s.item) && !g.tyre && g.cars.length === 1, `problems: ${g.car.problems.join(', ')}`);
  const tyres = g.storage.find((s) => s.kind === 'tyre');
  r = await api('POST', 'garage/mount', { item_id: tyres.id });
  check('mount old tyres on new car', r.status === 200 && r.data.garage.tyre, r.data.message);

  r = await api('GET', 'sponsors');
  let s = r.data.sponsors;
  check('slots: doors unlocked, hood locked', s.slots[0].unlocked && !s.slots[1].unlocked, s.slots.map((x) => `${x.label}:${x.unlocked ? 'да' : x.unlock_level}`).join(' '));
  const vitosha = s.offers.find((o) => o.name === 'Витоша Ойл');
  check('local sponsor terms adjusted', vitosha.local && vitosha.payment === 660 && vitosha.goal_place === 3, `payment ${vitosha.payment}, goal ${vitosha.goal_place}, step ${vitosha.progress_step}%, risk ${vitosha.risk}%`);
  r = await api('POST', `sponsors/${vitosha.id}/negotiate`);
  check('start negotiation', r.status === 200 && r.data.sponsors.slots[0].contract?.status === 'negotiating', r.data.message);
  const other = s.offers.find((o) => o.slot_label === 'Врати' && o.name !== 'Витоша Ойл');
  r = await api('POST', `sponsors/${other.id}/negotiate`);
  check('second negotiation for same slot refused', r.status === 400, r.data.message);

  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status)
       VALUES ('Test ${stamp}', 1, DATE_ADD(NOW(), INTERVAL 3 DAY), 99, 'dry', '1,2,3', 100, '3000,2000,1500,1000,800,600,400,300,200,100', 'scheduled')`);
  rallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'Test ${stamp}'`));
  r = await api('POST', `rallies/${rallyId}/register`, { styles: {} });
  check('register for rally', r.status === 200, r.data.message);
  r = await api('POST', 'shop/buy-car', { id: kometa.id });
  check('car change blocked while registered', r.status === 400, r.data.message);

  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 3 HOUR) WHERE id = ${rallyId}`);
  await api('GET', `rallies/${rallyId}`);
  sql(`UPDATE wp_bgr_rally_runs SET broadcast_end = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE rally_id = ${rallyId}`);
  r = await api('GET', `rallies/${rallyId}`);
  const me = r.data.rally.broadcast?.classification?.[0]?.rows.find((x) => x.is_me);
  check('rally published', r.data.rally.status === 'finished' && me, `place ${me?.place}/${r.data.rally.broadcast?.classification?.[0]?.rows.length}`);

  r = await api('GET', 'inbox');
  console.log('     inbox:', r.data.inbox.map((x) => x.text));
  check('inbox has rally result and sponsor news', r.data.inbox.some((x) => x.text.startsWith('Test')) && r.data.inbox.some((x) => x.text.includes('Витоша')));

  r = await api('GET', 'garage');
  console.log('     crew:', r.data.garage.crew.map((c) => `${c.role_label} ${c.name} умение ${c.skill}${c.morale !== null ? ` морал ${c.morale} реп ${c.reputation}` : ''}${c.energy !== null ? ` енергия ${c.energy}` : ''}`).join('; '));

  const salaries = r.data.garage.crew.reduce((sum, c) => sum + c.salary, 0);
  const moneyBefore = r.data.player.money;
  sql(`UPDATE wp_bgr_managers SET payroll_week = '2026-01' WHERE id = ${managerId}`);
  r = await api('GET', 'me');
  check('weekly payroll charged', r.data.player.money === moneyBefore - salaries, `${moneyBefore} -> ${r.data.player.money} (заплати ${salaries})`);

  sql(`UPDATE wp_bgr_managers SET money = 0, payroll_week = '2026-01' WHERE id = ${managerId}`);
  await api('GET', 'me');
  sql(`UPDATE wp_bgr_managers SET payroll_week = '2026-01' WHERE id = ${managerId}`);
  await api('GET', 'me');
  r = await api('GET', 'garage');
  check('unpaid staff leave after two weeks', r.data.garage.crew.length === 0 && r.data.garage.car.problems.includes('няма пилот'), `crew ${r.data.garage.crew.length}, problems ${r.data.garage.car.problems.join(', ')}`);
  r = await api('GET', 'inbox');
  console.log('     inbox top:', r.data.inbox.slice(0, 4).map((x) => x.text));
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (rallyId) {
    for (const table of ['stage_times', 'events', 'rally_runs', 'entries']) sql(`DELETE FROM wp_bgr_${table} WHERE rally_id = ${rallyId}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${rallyId}`);
  }
  if (managerId) {
    for (const table of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'mayor_requests']) sql(`DELETE FROM wp_bgr_${table} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
  sql('DELETE FROM wp_bgr_bots WHERE id NOT IN (SELECT bot_id FROM wp_bgr_entries)');
  sql('DELETE FROM wp_bgr_candidates WHERE city_id = 1');
  sql("DELETE FROM wp_options WHERE option_name LIKE '_transient%bgr_bar_1_%'");
  console.log('cleanup done');
}
