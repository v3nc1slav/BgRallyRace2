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
const u = `city${Date.now()}`;
await api('GET', 'me');
let r = await api('POST', 'auth/register', { username: u, email: `${u}@example.com`, password: 'testtest123', city_id: 3 });
const m = r.data.player.id, uid = r.data.user.id;
r = await api('GET', 'city');
check('city endpoint', r.status === 200 && r.data.city.privileges.length === 2, `${r.data.city.name}: ${r.data.city.privileges.join('; ')}`);
check('perks sentence', r.data.city.perks.startsWith('Тук ') && r.data.city.perks.endsWith('.'), r.data.city.perks);
check('own track is a plot for sale', r.data.city.own_track.status === '' && r.data.city.own_track.progress === 0);
sql(`UPDATE wp_bgr_managers SET track_status = 'building', track_ready_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ${m}`);
r = await api('GET', 'city');
const progress = r.data.city.own_track.progress;
check('own track under construction shows progress', r.data.city.own_track.status === 'building' && progress > 0.6 && progress < 0.7 && !!r.data.city.own_track.ready_at, `${progress}`);
sql(`UPDATE wp_bgr_managers SET track_ready_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ${m}`);
r = await api('GET', 'city');
check('finished construction opens the track', r.data.city.own_track.status === 'open' && r.data.city.own_track.progress === 1);
const keys = (data) => data.city.badges.map((b) => b.key).sort().join(',');
check('new player sees the bar badge', keys(r.data) === 'bar', keys(r.data));
await api('GET', 'bar');
sql(`INSERT INTO wp_bgr_loans (manager_id, principal, interest, weeks, installment, remaining, overdue, status, created_at) VALUES (${m}, 1000, 50, 4, 263, 1050, 289, 'active', NOW())`);
sql(`INSERT INTO wp_bgr_street_races (city_id, stage_id, challenger_id, bet, status, created_at) VALUES (3, 1, 999999, 100, 'open', NOW())`);
r = await api('GET', 'city');
const badges = r.data.city.badges;
check('badges for overdue loan and open challenge, bar seen', keys(r.data) === 'bank,black' && badges.find((b) => b.key === 'bank').text.includes('289'), badges.map((b) => b.text).join('; '));
sql(`DELETE FROM wp_bgr_street_races WHERE challenger_id = 999999`);
sql(`DELETE FROM wp_bgr_loans WHERE manager_id = ${m}`);
r = await api('GET', 'garage');
check('garage without privileges', r.status === 200 && !('privileges' in r.data.garage));
for (const t of ['items', 'staff', 'player_cars', 'ledger', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${m}`);
sql(`DELETE FROM wp_bgr_managers WHERE id = ${m}`); sql(`DELETE FROM wp_usermeta WHERE user_id = ${uid}`); sql(`DELETE FROM wp_users WHERE ID = ${uid}`);
