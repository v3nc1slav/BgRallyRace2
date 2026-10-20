import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

function client() {
  const cookies = {};
  let nonce = '';
  return async function api(method, path, body) {
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
    try { data = JSON.parse(text); } catch { data = text.slice(0, 800); }
    if (data?.nonce) nonce = data.nonce;
    return { status: res.status, data };
  };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const [A, B, C] = [client(), client(), client()];
const ids = [];
const users = [];
const rallies = [];
let restore = null;
const hex = (text) => `CONVERT(X'${Buffer.from(text).toString('hex')}' USING utf8mb4)`;

async function register(api, prefix) {
  await api('GET', 'me');
  const r = await api('POST', 'auth/register', { username: `${prefix}${stamp}`, email: `${prefix}${stamp}@example.com`, password: 'testtest123', city_id: 1 });
  ids.push(r.data.player.id);
  users.push(r.data.user.id);
  return r.data.player.id;
}

function hireStaff(managerId, role, name, skill) {
  sql(`INSERT INTO wp_bgr_staff (manager_id, role, name, skill, created_at) VALUES (${managerId}, '${role}', ${hex(name)}, ${skill}, NOW())`);
}

function createRally(label) {
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('${label} ${stamp}', 1, DATE_ADD(NOW(), INTERVAL 3 DAY), 97, 'dry', '1', 0, '0', 'scheduled')`);
  const id = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = '${label} ${stamp}'`));
  rallies.push(id);
  return id;
}

async function runRally(id) {
  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 20 SECOND) WHERE id = ${id}`);
  await A('GET', `rallies/${id}`);
  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ${id}`);
  sql(`UPDATE wp_bgr_rally_runs SET broadcast_end = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE rally_id = ${id}`);
  await A('GET', `rallies/${id}`);
}

try {
  restore = settings({ warn_base: 100, warn_max: 100, sabotage_base: 100, sabotage_max: 100, sabotage_warned: 0, catch_base: 0, catch_min: 0, report_chance: 100, sabotage_sponsor_risk: 100 });
  const a = await register(A, 'sa');
  const b = await register(B, 'sb');
  const c = await register(C, 'sc');
  sql(`UPDATE wp_bgr_managers SET level = 40, garage_level = 5, money = 200000 WHERE id = ${a}`);
  sql(`UPDATE wp_bgr_managers SET level = 38, money = 50000 WHERE id = ${b}`);
  sql(`UPDATE wp_bgr_managers SET level = 30, money = 50000 WHERE id = ${c}`);
  hireStaff(a, 'saboteur', 'Сенчо Тихия', 80);
  hireStaff(b, 'informant', 'Ухо Слухов', 90);
  check('three players', a && b && c);

  const carId = Number(sql("SELECT id FROM wp_bgr_cars WHERE active = 1 AND class = '3' ORDER BY price LIMIT 1"));
  let r = await A('POST', 'shop/buy-car', { id: carId });
  r = await A('GET', 'garage');
  await A('POST', 'garage/active', { player_car_id: r.data.garage.cars.find((car) => !car.active).player_car_id });
  r = await C('GET', 'bar');
  check('anonymous rumor without informant', r.data.bar.rumors_named === false && r.data.bar.rumors.some((x) => x.text.startsWith('Отбор от града купи')), r.data.bar.rumors[0]?.text);
  r = await B('GET', 'bar');
  check('named rumor with informant', r.data.bar.rumors_named === true && r.data.bar.rumors.some((x) => x.text.startsWith(`sa${stamp} купи`)), r.data.bar.rumors[0]?.text);

  const rally = createRally('Sab');
  let registered = 0;
  for (const api of [A, B, C]) {
    r = await api('POST', `rallies/${rally}/register`, { styles: {}, spares: { tyres: [], parts: [] } });
    registered += r.status === 200 ? 1 : 0;
  }
  check('all three registered', registered === 3, r.data.message);

  r = await A('GET', `rallies/${rally}`);
  const panel = r.data.rally.intel?.sabotage;
  check('sabotage panel for saboteur owner', !!panel && panel.open && panel.targets.some((t) => t.id === b) && !panel.targets.some((t) => t.id === c), `targets ${panel?.targets.map((t) => `${t.team}/${t.level}`).join(', ')}`);
  check('no scouting without informant', r.data.rally.intel.scouting === null);
  r = await B('GET', `rallies/${rally}`);
  const scouting = r.data.rally.intel?.scouting;
  check('informant scouts rivals exactly', scouting?.length === 2 && scouting[0].parts?.length === 6 && scouting[0].crew !== null, `${scouting?.[0]?.team}: ${scouting?.[0]?.car}, tyre ${scouting?.[0]?.tyre?.health}%, pilot ${scouting?.[0]?.crew?.pilot}`);

  r = await A('POST', `rallies/${rally}/sabotage`, { target_id: c, kind: 'tyres' });
  check('target too low refused', r.status === 400, r.data.message);
  const before = (await A('GET', 'me')).data.player;
  r = await A('POST', `rallies/${rally}/sabotage`, { target_id: b, kind: 'tyres' });
  check('sabotage ordered', r.status === 200 && r.data.player.energy === before.energy - 20 && r.data.player.money === before.money - 1000, r.data.message);
  r = await A('POST', `rallies/${rally}/sabotage`, { target_id: b, kind: 'engine' });
  check('one sabotage per week', r.status === 400 && r.data.message.includes('седмица'), r.data.message);

  r = await B('GET', `rallies/${rally}`);
  const suspects = r.data.rally.intel.warnings[0]?.suspects ?? [];
  const real = suspects.find((s) => s.team === `sa${stamp}`);
  const total = suspects.reduce((sum, s) => sum + s.chance, 0);
  check('warning lists suspects', suspects.length === 3 && total === 100 && real && real.chance >= 36 && real.chance <= 44, suspects.map((s) => `${s.team} ${s.chance}%`).join(', '));
  r = await B('GET', 'inbox');
  check('warning in inbox', r.data.inbox.some((x) => x.text.includes('готви саботаж') && x.text.includes('Заподозрени')), r.data.inbox[0]?.text);

  const tyreBefore = Number(sql(`SELECT i.health FROM wp_bgr_items i JOIN wp_bgr_entries e ON e.player_car_id = i.player_car_id WHERE e.rally_id = ${rally} AND e.manager_id = ${b} AND i.kind = 'tyre'`));
  await runRally(rally);
  const tyreAfter = Number(sql(`SELECT i.health FROM wp_bgr_items i JOIN wp_bgr_entries e ON e.player_car_id = i.player_car_id WHERE e.rally_id = ${rally} AND e.manager_id = ${b} AND i.kind = 'tyre'`));
  const row = sql(`SELECT status, caught FROM wp_bgr_sabotages WHERE rally_id = ${rally}`);
  check('sabotage succeeded, tyres cut', row === 'success\t0' && tyreAfter <= tyreBefore - 30, `${row} tyre ${tyreBefore} -> ${tyreAfter}`);
  r = await A('GET', 'inbox');
  check('orderer told about success', r.data.inbox.some((x) => x.text.includes('успя')));

  sql(`UPDATE wp_bgr_managers SET track_status = 'open', level = 40 WHERE id = ${a}`);
  sql(`INSERT INTO wp_bgr_contracts (manager_id, sponsor_id, slot, status, progress, payment, goal_place, bonus, weeks, created_at) VALUES (${a}, 1, 'doors', 'active', 100, 500, 5, 0, 4, NOW())`);
  const repBefore = Number(sql(`SELECT reputation FROM wp_bgr_staff WHERE manager_id = ${a} AND role = 'pilot'`));
  r = await B('GET', 'police');
  check('rally can be reported', r.data.police.reports.some((x) => x.id === rally));
  const moneyA = Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${a}`));
  r = await B('POST', 'police/report', { rally_id: rally });
  check('report uncovers sabotage', r.status === 200 && r.data.message.includes(`sa${stamp}`) && !r.data.police.reports.some((x) => x.id === rally), r.data.message);
  r = await B('POST', 'police/report', { rally_id: rally });
  check('second report refused', r.status === 400, r.data.message);

  const fine = 3000 + 200 * 40;
  check('orderer fined', Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${a}`)) === moneyA - fine);
  check('saboteur arrested', sql(`SELECT COUNT(*) FROM wp_bgr_staff WHERE manager_id = ${a} AND role = 'saboteur'`) === '0');
  check('track closed and banned', sql(`SELECT CONCAT(track_status, '/', track_ban_season > 0) FROM wp_bgr_managers WHERE id = ${a}`) === 'closed/1');
  check('crew reputation lost', Number(sql(`SELECT reputation FROM wp_bgr_staff WHERE manager_id = ${a} AND role = 'pilot'`)) === Math.max(0, repBefore - 10));
  check('sponsor terminated', sql(`SELECT status FROM wp_bgr_contracts WHERE manager_id = ${a}`) === 'terminated');
  r = await B('GET', 'inbox');
  check('victim learns who ordered', r.data.inbox.some((x) => x.text.includes('поръчан от') && x.text.includes(`sa${stamp}`)));
  r = await C('GET', 'bar');
  check('anonymous sabotage rumor', r.data.bar.rumors.some((x) => x.text === 'Полицията разкри саботаж, поръчан от отбор от града.'));

  sql(`UPDATE wp_bgr_managers SET level = 45, money = 300000 WHERE id = ${a}`);
  r = await A('POST', 'hall/negotiate', { kind: 'track' });
  check('mayor refuses track after sabotage', r.status === 400 && r.data.message.includes('саботаж'), r.data.message);

  settings({ catch_base: 100, catch_min: 100 });
  hireStaff(a, 'saboteur', 'Сенчо Втори', 50);
  sql(`UPDATE wp_bgr_sabotages SET week = '2000-01' WHERE manager_id = ${a}`);
  sql(`UPDATE wp_bgr_managers SET level = 40 WHERE id = ${a}`);
  sql(`UPDATE wp_bgr_managers SET level = 38 WHERE id = ${b}`);
  sql(`UPDATE wp_bgr_items SET health = 100 WHERE manager_id IN (${a}, ${b})`);
  const second = createRally('Sab2');
  for (const api of [A, B]) {
    r = await api('POST', `rallies/${second}/register`, { styles: {}, spares: { tyres: [], parts: [] } });
    check('registered for the second rally', r.status === 200, r.data.message);
  }
  r = await A('POST', `rallies/${second}/sabotage`, { target_id: b, kind: 'engine' });
  check('engine sabotage ordered', r.status === 200, r.data.message);
  await runRally(second);
  const caught = sql(`SELECT CONCAT(status, '/', caught) FROM wp_bgr_sabotages WHERE rally_id = ${second}`);
  r = await A('GET', 'inbox');
  check('police catch at the start', caught.endsWith('/1') && r.data.inbox.some((x) => x.text.startsWith('Полицията разкри саботажа ти')), `${caught} ${r.data.inbox[0]?.text}`);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  for (const id of rallies) {
    for (const t of ['stage_times', 'events', 'rally_runs', 'entries', 'sabotages']) sql(`DELETE FROM wp_bgr_${t} WHERE rally_id = ${id}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${id}`);
  }
  sql("DELETE FROM wp_bgr_rumors WHERE named LIKE '%" + stamp + "%' OR anon LIKE '%sab%'");
  for (const id of ids) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes', 'mayor_requests', 'sabotages', 'loans', 'listings']) sql(`DELETE FROM wp_bgr_${t} WHERE ${t === 'listings' ? 'seller_id' : 'manager_id'} = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  sql('DELETE FROM wp_bgr_bots WHERE id NOT IN (SELECT bot_id FROM wp_bgr_entries)');
  console.log('cleanup done');
}
