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
const NOW = "NOW()";
const username = `p3${stamp}`;
let managerId = 0;
let userId = 0;
let rallyId = 0;
const saved = sql('SELECT GROUP_CONCAT(CONCAT(id, ":", chance)) FROM wp_bgr_incidents');

try {
  await api('GET', 'me');
  let r = await api('POST', 'auth/register', { username, email: `${username}@example.com`, password: 'testtest123', city_id: 2 });
  managerId = r.data.player?.id;
  userId = r.data.user?.id;
  check('register in Plovdiv', r.status === 200 && r.data.player?.city === 'Пловдив');

  r = await api('GET', 'shop');
  const wet = r.data.tyres.find((t) => t.name === 'Асфалт мокро – твърда');
  const gravel = r.data.tyres.find((t) => t.name === 'Чакъл – твърда');
  const cityPct = r.data.price_pct / 100;
  check('tyre privilege 10% applied after city prices', wet.price === Math.round(wet.base_price * cityPct * 0.9), `set ${wet.base_price} -> ${wet.price} (city ${r.data.price_pct}%), single ${wet.single_price}`);
  check('single tyre = 25% of set with discount', wet.single_price === Math.round(wet.base_price * cityPct * 0.25 * 0.9));
  check('privileges listed', r.data.privileges.length === 2, r.data.privileges.join('; '));
  const engine = r.data.parts.find((p) => p.name === 'Стандартен двигател');
  const suspension = r.data.parts.find((p) => p.name === 'Стандартно окачване');

  sql(`UPDATE wp_bgr_managers SET garage_level = 3, money = 100000 WHERE id = ${managerId}`);
  for (let i = 0; i < 4; i++) await api('POST', 'shop/buy', { kind: 'spare_tyre', id: wet.id });
  await api('POST', 'shop/buy', { kind: 'spare_tyre', id: gravel.id });
  await api('POST', 'shop/buy', { kind: 'part', id: engine.id });
  r = await api('POST', 'shop/buy', { kind: 'part', id: suspension.id });
  check('bought spares', r.status === 200, `money ${r.data.player?.money}`);

  r = await api('GET', 'garage');
  const g = r.data.garage;
  check('garage shows spare capacity 6/3', g.spares.tyres === 6 && g.spares.parts === 3, JSON.stringify(g.spares));
  const spareTyre = g.storage.find((s) => s.spare);
  check('spare tyres in storage', g.storage.filter((s) => s.spare).length === 5, spareTyre?.type_label);
  r = await api('POST', 'garage/mount', { item_id: spareTyre.id });
  check('spare tyre cannot be mounted as set', r.status === 400, r.data.message);

  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, weather_change, change_chance, stage_ids, entry_fee, prizes, status)
       VALUES ('P3 ${stamp}', 2, DATE_ADD(${NOW}, INTERVAL 3 DAY), 99, 'dry', 'rain', 100, '4,5,6', 100, '3000,2000,1500,1000,800,600,400,300,200,100', 'scheduled')`);
  rallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'P3 ${stamp}'`));

  r = await api('GET', `rallies/${rallyId}`);
  const spares = r.data.rally.spares;
  check('rally offers spares with defaults', spares.capacity.tyres === 6 && spares.selected.tyres.length === 5 && spares.selected.parts.length === 2, JSON.stringify(spares.selected));

  r = await api('POST', `rallies/${rallyId}/register`, { styles: {}, spares: spares.selected });
  check('register with spares', r.status === 200 && r.data.rally.spares.selected.tyres.length === 5, r.data.message);

  sql("UPDATE wp_bgr_incidents SET chance = 0 WHERE type IN ('crash', 'chassis')");
  sql("UPDATE wp_bgr_incidents SET chance = 35 WHERE type = 'breakdown'");
  sql("UPDATE wp_bgr_incidents SET chance = 30 WHERE type = 'puncture'");

  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(${NOW}, INTERVAL 20 SECOND) WHERE id = ${rallyId}`);
  r = await api('GET', `rallies/${rallyId}`);
  const live = r.data.rally.broadcast;
  const tl = live?.timeline;
  check('live timeline present', live?.state === 'live' && tl?.stages.length === 3 && tl.crews.length > 0, `crews ${tl?.crews.length}, scale ${tl?.scale}, revealed ${tl?.revealed}/${tl?.duration}`);
  const sampleLeg = tl?.crews[0]?.legs['1'];
  check('legs have start/end', sampleLeg && typeof sampleLeg.start === 'number', JSON.stringify(sampleLeg));

  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(${NOW}, INTERVAL 3 HOUR) WHERE id = ${rallyId}`);
  sql(`UPDATE wp_bgr_rally_runs SET broadcast_end = DATE_SUB(${NOW}, INTERVAL 1 HOUR) WHERE rally_id = ${rallyId}`);
  r = await api('GET', `rallies/${rallyId}`);
  const done = r.data.rally.broadcast;
  const texts = done.events.map((e) => e.text).reverse();
  check('weather changed during rally', done.events.some((e) => e.type === 'weather'), texts.find((t) => t.includes('вали')));
  const types = done.events.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {});
  console.log('     event types:', JSON.stringify(types));
  const me = done.classification[0].rows.find((x) => x.is_me);
  console.log('     my story:', texts.filter((t) => me && t.includes(me.pilot)));
  check('classified', !!me, `place ${me?.place}, status ${me?.status}`);
  const fullLegs = done.timeline.crews.reduce((n, c) => n + Object.keys(c.legs).length, 0);
  check('replay timeline complete', done.timeline.finished && fullLegs > 0, `${fullLegs} legs`);

  r = await api('GET', 'garage');
  const after = r.data.garage;
  const effects = JSON.parse(sql(`SELECT effects FROM wp_bgr_entries WHERE rally_id = ${rallyId} AND manager_id = ${managerId}`));
  console.log('     effects:', JSON.stringify(effects));
  const spareLeft = after.storage.filter((s) => s.spare).length;
  check('consumed spare tyres removed', spareLeft === 5 - effects.remove.length, `left ${spareLeft}, removed ${effects.remove.length}`);
  if (effects.tyre_set) {
    check('weather tyre swap mounted new set', after.tyre?.name === 'Асфалт мокро – твърда', `${after.tyre?.name} ${after.tyre?.health}%`);
  }
  if (effects.mount.length) {
    check('spare part mounted after breakdown', effects.mount.every((id) => after.slots.some((s) => s.item?.id === id)));
  }
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  for (const pair of saved.split(',')) {
    const [id, chance] = pair.split(':');
    sql(`UPDATE wp_bgr_incidents SET chance = ${chance} WHERE id = ${id}`);
  }
  if (rallyId) {
    for (const table of ['stage_times', 'events', 'rally_runs', 'entries']) sql(`DELETE FROM wp_bgr_${table} WHERE rally_id = ${rallyId}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${rallyId}`);
  }
  if (managerId) {
    for (const table of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox']) sql(`DELETE FROM wp_bgr_${table} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
  sql('DELETE FROM wp_bgr_bots WHERE id NOT IN (SELECT bot_id FROM wp_bgr_entries)');
  console.log('restored incidents:', sql('SELECT GROUP_CONCAT(CONCAT(id, ":", chance)) FROM wp_bgr_incidents') === saved, '| cleanup done');
}
