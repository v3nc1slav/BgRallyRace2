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
const u = `route${Date.now()}`;
let rallyId = 0, m = 0, uid = 0;
try {
  await api('GET', 'me');
  let r = await api('POST', 'auth/register', { username: u, email: `${u}@example.com`, password: 'testtest123', city_id: 6 });
  m = r.data.player.id; uid = r.data.user.id;
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('Route ${u}', 6, DATE_ADD(NOW(), INTERVAL 3 DAY), 99, 'dry', '19,16', 100, '100', 'scheduled')`);
  rallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'Route ${u}'`));
  r = await api('POST', `rallies/${rallyId}/register`, { styles: {}, spares: { tyres: [], parts: [] } });
  check('registered', r.status === 200, r.data.message);
  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 20 SECOND) WHERE id = ${rallyId}`);
  r = await api('GET', `rallies/${rallyId}`);
  const stages = r.data.rally.broadcast?.timeline?.stages ?? [];
  const shushnya = stages.find((s) => s.name === 'Шушня');
  check('traced route in timeline', shushnya?.route?.points.length === 57 && shushnya.route.labels.length === 13, `aspect ${shushnya?.route?.aspect}, first ${JSON.stringify(shushnya?.route?.points[0])}, labels ${shushnya?.route?.labels.map((l) => l.name).slice(0, 4).join(', ')}`);
  const tl = r.data.rally.broadcast.timeline;
  check('timeline has start and weather', !!tl.start_at && tl.weather?.start === 'dry', `start ${tl.start_at}, weather ${JSON.stringify(tl.weather)}`);
  check('route has zones, rivers and pois', shushnya.route.zones?.length === 14 && shushnya.route.rivers?.length === 1 && shushnya.route.pois?.length === 6, `zones ${shushnya.route.zones?.length}, pois ${shushnya.route.pois?.map((p) => p.type).join(',')}`);
  const generated = stages.find((s) => s.name !== 'Шушня');
  check('other stage stays generated', generated && generated.route === null, generated?.name);
} catch (e) { console.error('ERROR', e); process.exitCode = 1; }
finally {
  if (rallyId) { for (const t of ['stage_times', 'events', 'rally_runs', 'entries']) sql(`DELETE FROM wp_bgr_${t} WHERE rally_id = ${rallyId}`); sql(`DELETE FROM wp_bgr_rallies WHERE id = ${rallyId}`); }
  if (m) { for (const t of ['items', 'staff', 'player_cars', 'ledger', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${m}`); sql(`DELETE FROM wp_bgr_managers WHERE id = ${m}`); }
  if (uid) { sql(`DELETE FROM wp_usermeta WHERE user_id = ${uid}`); sql(`DELETE FROM wp_users WHERE ID = ${uid}`); }
  sql('DELETE FROM wp_bgr_bots WHERE id NOT IN (SELECT bot_id FROM wp_bgr_entries)');
}
