import { BASE, option, settings, sql } from '../env.mjs';

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
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
const rallies = [];
let restore = null;
let restoreLevels;

async function register(prefix, cityId) {
  const r = await call('POST', 'auth/register', { body: { username: `${prefix}${stamp}`, email: `${prefix}${stamp}@example.com`, password: 'testtest123', city_id: cityId, mode: 'token', device: 'test' } });
  users.push(r.data.user.id);
  managers.push(r.data.player.id);
  return { token: r.data.token, id: r.data.player.id };
}

const day = (offset) => sql(`SELECT DATE_ADD(CURDATE(), INTERVAL ${offset} DAY)`);
const playerOf = async (token) => (await call('GET', 'garage', { token })).data.player;

try {
  restore = settings({ xp_daily_cap: 10, xp_black_training: 5, xp_fitness: 3, xp_mount: 3, xp_repair: 5, move_sponsor_risk: 100, black_risk: 0, black_risk_bribe: 0 });
  restoreLevels = option('bgr_level_xp');
  option('bgr_level_xp', null);

  const a = await register('ga', 1);
  sql(`UPDATE wp_bgr_managers SET money = 100000 WHERE id = ${a.id}`);

  let r = await call('GET', 'shop', { token: a.token });
  const shop = r.data;
  const standard = shop.parts.find((p) => p.name === 'Стандартен двигател');
  const car = shop.cars[0];
  check('city prices 110% in Sofia', shop.price_pct === 110, `${shop.price_pct}%`);
  check('part price = base × city × privilege', standard.price === Math.round(standard.base_price * 1.1 * 0.95), `${standard.base_price} -> ${standard.price}`);
  check('car price = base × city', car.price === Math.round(car.base_price * 1.1), `${car.base_price} -> ${car.price}`);
  check('no snow tyres in Sofia', !shop.tyres.some((t) => t.type_label === 'Сняг') && shop.parts.some((p) => p.name === 'Състезателен двигател'));
  const sport = shop.parts.find((p) => p.name === 'Спортен двигател');
  check('sport engine burns 5% more fuel', sport.fuel_pct === 5);

  const snow = Number(sql("SELECT id FROM wp_bgr_tyres WHERE type = 'snow' LIMIT 1"));
  r = await call('POST', 'shop/buy', { token: a.token, body: { kind: 'tyre', id: snow } });
  check('snow tyres not sold in Sofia', r.status === 400 && r.data.message.includes('пазара'), r.data.message);

  r = await call('GET', 'garage', { token: a.token });
  const base = r.data.garage.car.fuel_base;
  check('standard parts keep base consumption', r.data.garage.car.fuel_consumption === base, `${base}`);
  const engineItem = r.data.garage.slots.find((s) => s.type === 'engine').item;
  sql(`UPDATE wp_bgr_items SET catalog_id = ${sport.id} WHERE id = ${engineItem.id}`);
  r = await call('GET', 'garage', { token: a.token });
  check('sport engine raises consumption', Math.abs(r.data.garage.car.fuel_consumption - base * 1.05) < 0.01, `${base} -> ${r.data.garage.car.fuel_consumption}`);
  sql(`UPDATE wp_bgr_items SET catalog_id = ${standard.id} WHERE id = ${engineItem.id}`);

  let player = r.data.player;
  const xp0 = player.xp;
  const stage = Number(sql('SELECT id FROM wp_bgr_stages WHERE city_id = 1 AND active = 1 ORDER BY position, id LIMIT 1'));
  r = await call('POST', 'black/train', { token: a.token, body: { stage_id: stage } });
  check('black training gives 5 xp', r.status === 200 && r.data.player.xp === xp0 + 5 && r.data.message.includes('+5 опит'), r.data.message);

  const pilot = Number(sql(`SELECT id FROM wp_bgr_staff WHERE manager_id = ${a.id} AND role = 'pilot'`));
  r = await call('POST', 'mall/fitness', { token: a.token, body: { staff_id: pilot } });
  check('fitness gives 3 xp', r.status === 200 && r.data.player.xp === xp0 + 8, r.data.message);

  r = await call('POST', 'shop/buy', { token: a.token, body: { kind: 'part', id: standard.id } });
  r = await call('GET', 'garage', { token: a.token });
  const spare = r.data.garage.storage.find((s) => s.kind === 'part' && s.name === 'Стандартен двигател');
  r = await call('POST', 'garage/mount', { token: a.token, body: { item_id: spare.id } });
  check('mount by manager is capped at 2 xp', r.status === 200 && r.data.player.xp === xp0 + 10 && r.data.player.xp_today === 10, r.data.message);

  const engine = r.data.garage.slots.find((s) => s.type === 'engine').item;
  sql(`UPDATE wp_bgr_items SET health = 50 WHERE id = ${engine.id}`);
  r = await call('POST', 'garage/repair', { token: a.token, body: { item_id: engine.id } });
  check('repair over the daily cap gives no xp', r.status === 200 && r.data.player.xp === xp0 + 10 && r.data.message.includes('лимит'), r.data.message);

  option('bgr_level_xp', { 2: 5, 3: 8 });
  sql(`UPDATE wp_bgr_managers SET xp_today = 0 WHERE id = ${a.id}`);
  settings({ xp_daily_cap: 40 });
  r = await call('POST', 'mall/fitness', { token: a.token, body: { staff_id: Number(sql(`SELECT id FROM wp_bgr_staff WHERE manager_id = ${a.id} AND role = 'navigator'`)) } });
  check('custom level table is used', r.data.player.level === 3 && r.data.player.xp_next === 580, `level ${r.data.player.level}, next ${r.data.player.xp_next}`);
  option('bgr_level_xp', null);
  sql(`UPDATE wp_bgr_managers SET level = 1 WHERE id = ${a.id}`);

  const energyMax = (await playerOf(a.token)).energy_max;
  sql(`UPDATE wp_bgr_managers SET energy = 5, energy_date = '${day(-1)}', tired_days = 2 WHERE id = ${a.id}`);
  player = await playerOf(a.token);
  check('third spent day → 90% energy', player.fatigue.pct === 90 && player.fatigue.days === 3 && player.energy === Math.round(energyMax * 0.9), JSON.stringify(player.fatigue) + ` energy ${player.energy}`);
  sql(`UPDATE wp_bgr_managers SET energy = 9, energy_date = '${day(-1)}' WHERE id = ${a.id}`);
  player = await playerOf(a.token);
  check('next spent day → 80% energy', player.fatigue.pct === 80 && player.energy === Math.round(energyMax * 0.8), `${player.fatigue.pct}% energy ${player.energy}`);
  sql(`UPDATE wp_bgr_managers SET energy = 10, energy_date = '${day(-1)}' WHERE id = ${a.id}`);
  player = await playerOf(a.token);
  check('a rested day restores 100%', player.fatigue.pct === 100 && player.fatigue.days === 0 && player.energy === energyMax, `${player.fatigue.pct}%`);
  sql(`UPDATE wp_bgr_managers SET energy = 0, energy_date = '${day(-3)}', tired_days = 5 WHERE id = ${a.id}`);
  player = await playerOf(a.token);
  check('days away count as rest', player.fatigue.pct === 100 && player.fatigue.days === 0);

  const job = Number(sql('SELECT id FROM wp_bgr_jobs WHERE active = 1 AND min_level <= 1 ORDER BY pay LIMIT 1'));
  await call('POST', 'jobs/take', { token: a.token, body: { id: job } });
  await call('POST', 'black/challenge', { token: a.token, body: { stage_id: stage, bet: 300 } });
  const local = sql("SELECT id, slot FROM wp_bgr_sponsors WHERE city_id = 1 ORDER BY id LIMIT 2").split(/\r?\n/).map((row) => row.split('\t'));
  const away = sql("SELECT id, slot FROM wp_bgr_sponsors WHERE city_id <> 1 ORDER BY id LIMIT 1").split('\t');
  const contract = (sponsor, slot, status) => sql(`INSERT INTO wp_bgr_contracts (manager_id, sponsor_id, slot, status, payment, goal_place, bonus, weeks, local, created_at) VALUES (${a.id}, ${sponsor}, '${slot}', '${status}', 500, 5, 300, 10, 1, NOW())`);
  contract(local[0][0], local[0][1], 'active');
  contract(local[1][0], local[1][1], 'negotiating');
  contract(away[0], away[1], 'active');
  sql(`INSERT INTO wp_bgr_bribes (manager_id, institution, status, week, expires_at, created_at) VALUES (${a.id}, 'police', 'active', '', DATE_ADD(NOW(), INTERVAL 5 HOUR), NOW())`);
  sql(`UPDATE wp_bgr_managers SET track_status = 'open', energy = 100 WHERE id = ${a.id}`);

  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('Move ${stamp}', 1, DATE_ADD(NOW(), INTERVAL 3 DAY), 95, 'dry', '1', 0, '0', 'scheduled')`);
  const rally = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'Move ${stamp}'`));
  rallies.push(rally);
  sql(`INSERT INTO wp_bgr_entries (rally_id, manager_id, class, created_at) VALUES (${rally}, ${a.id}, '1', NOW())`);

  r = await call('GET', 'hall', { token: a.token });
  const move = r.data.hall.move;
  check('move offer', move.cost === 2000 + 200 * r.data.player.level && move.energy === 30 && move.cities.length >= 5 && !move.cities.some((c) => c.id === 1), `cost ${move.cost}, ${move.cities.length} cities`);
  check('move blocked while registered', move.blocked.includes('записан'), move.blocked);
  r = await call('POST', 'hall/move', { token: a.token, body: { city_id: 2 } });
  check('move refused while registered', r.status === 400, r.data.message);
  sql(`DELETE FROM wp_bgr_entries WHERE rally_id = ${rally}`);

  const before = (await playerOf(a.token));
  r = await call('POST', 'hall/move', { token: a.token, body: { city_id: 2 } });
  const after = r.data.player;
  const refund = 300;
  check('moved to Plovdiv', r.status === 200 && after.city_id === 2, r.data.message);
  check('move costs money and energy', after.money === before.money - move.cost + refund && after.energy === before.energy - 30, `${before.money} -> ${after.money}, energy ${before.energy} -> ${after.energy}`);
  check('job ended', after.job === null);
  check('job can be taken again', (await call('GET', 'jobs', { token: a.token })).data.jobs.can_take === true);
  check('own track lost', sql(`SELECT track_status FROM wp_bgr_managers WHERE id = ${a.id}`) === '');
  check('open challenge cancelled', sql(`SELECT COUNT(*) FROM wp_bgr_street_races WHERE challenger_id = ${a.id} AND status = 'open'`) === '0');
  check('bribe expired', sql(`SELECT status FROM wp_bgr_bribes WHERE manager_id = ${a.id}`) === 'expired');
  const statuses = sql(`SELECT status FROM wp_bgr_contracts WHERE manager_id = ${a.id} ORDER BY id`).split(/\r?\n/);
  check('local sponsors: terminated and negotiation cancelled, others stay', statuses.join(',') === 'terminated,failed,active', statuses.join(','));
  check('move in ledger', sql(`SELECT COUNT(*) FROM wp_bgr_ledger WHERE manager_id = ${a.id} AND reason = 'move'`) === '1');

  r = await call('GET', 'shop', { token: a.token });
  check('Plovdiv shop prices', r.data.price_pct === 105);
  r = await call('POST', 'hall/move', { token: a.token, body: { city_id: 3 } });
  check('second move in the season refused', r.status === 400 && r.data.message.includes('веднъж на сезон'), r.data.message);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  if (restoreLevels !== undefined) option('bgr_level_xp', restoreLevels === null ? null : restoreLevels);
  for (const id of rallies) {
    sql(`DELETE FROM wp_bgr_entries WHERE rally_id = ${id}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${id}`);
  }
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    sql(`DELETE FROM wp_bgr_street_races WHERE challenger_id = ${id}`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    for (const t of ['app_tokens', 'push_devices', 'push_queue']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
